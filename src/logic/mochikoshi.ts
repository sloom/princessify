// src/logic/mochikoshi.ts
// 持ち越し時間計算（同時凸）

export function calcCarryoverTime(
    bossHp: number,
    otherDamages: number[],
    lastDamage: number
): number {
    const remainingHp = bossHp - otherDamages.reduce((sum, d) => sum + d, 0);
    let coTime = (1 - remainingHp / lastDamage) * 90 + 20;
    if (coTime >= 90) coTime = 90;
    if (coTime <= 20) coTime = 0;
    return Math.ceil(coTime);
}

export function calcFullCarryoverDmg(remainingHp: number): string {
    return (remainingHp * 90 / 21).toFixed(1);
}

export interface CombinationResult {
    otherDamages: number[];
    otherLabels: (string | undefined)[];
    lastDamage: number;
    lastLabel: string | undefined;
    carryoverSec: number;
    fullCarryoverDmg: string;
}

export function generateAllCombinations(
    bossHp: number,
    damages: number[],
    labels?: (string | undefined)[]
): CombinationResult[] {
    const results: CombinationResult[] = [];
    const safeLabels = labels ?? damages.map(() => undefined);
    // 末尾から順に各人を〆として計算
    for (let i = damages.length - 1; i >= 0; i--) {
        const lastDamage = damages[i];
        const lastLabel = safeLabels[i];
        const otherDamages = damages.filter((_, idx) => idx !== i);
        const otherLabels = safeLabels.filter((_, idx) => idx !== i);
        const remainingHp = bossHp - otherDamages.reduce((sum, d) => sum + d, 0);
        results.push({
            otherDamages,
            otherLabels,
            lastDamage,
            lastLabel,
            carryoverSec: calcCarryoverTime(bossHp, otherDamages, lastDamage),
            fullCarryoverDmg: calcFullCarryoverDmg(remainingHp),
        });
    }
    return results;
}

export function normalizeToMan(value: number): number {
    if (!Number.isInteger(value) || value < 1000) {
        return value * 10000;
    }
    return value;
}

export interface MochiInput {
    bossHp: number;
    damages: number[];
    labels: (string | undefined)[];
}

export function parseMochiMessage(text: string): MochiInput | null {
    const match = text.match(/[@-](?:mochi|mo)\b(!?)\s+(.+)/);
    if (!match) return null;
    const raw = match[1] === '!';
    const tokens = match[2].trim().split(/\s+/);

    const numbers: number[] = [];
    const labels: (string | undefined)[] = [];

    for (const token of tokens) {
        const colonIdx = token.indexOf(':');
        if (colonIdx !== -1) {
            const numPart = token.substring(0, colonIdx);
            const labelPart = token.substring(colonIdx + 1);
            const num = Number(numPart);
            if (isNaN(num)) return null;
            numbers.push(num);
            labels.push(labelPart || undefined);
        } else {
            const num = Number(token);
            if (isNaN(num)) return null;
            numbers.push(num);
            labels.push(undefined);
        }
    }

    if (numbers.length < 3) return null;
    const normalized = raw ? numbers : numbers.map(normalizeToMan);
    return {
        bossHp: normalized[0],
        damages: normalized.slice(1),
        labels: labels.slice(1),
    };
}

export function formatMochiResult(bossHp: number, damages: number[], labels?: (string | undefined)[]): string {
    const combos = generateAllCombinations(bossHp, damages, labels);
    const blocks: string[] = [`👾 敵の残りHP: ${bossHp}`];
    combos.forEach((combo, idx) => {
        const parts: string[] = [];
        for (let i = 0; i < combo.otherDamages.length; i++) {
            const label = combo.otherLabels[i];
            parts.push(label
                ? `${i + 1}人目 ${label} ${combo.otherDamages[i]}`
                : `${i + 1}人目 ${combo.otherDamages[i]}`);
        }
        const lastN = combo.otherDamages.length + 1;
        parts.push(combo.lastLabel
            ? `${lastN}人目 ${combo.lastLabel}(〆) ${combo.lastDamage}`
            : `${lastN}人目(〆) ${combo.lastDamage}`);
        const orderLine = parts.join(' → ');
        const remainingHp = bossHp - combo.otherDamages.reduce((sum, d) => sum + d, 0);
        const header = combo.lastLabel
            ? `📌 パターン${idx + 1} ― ${combo.lastLabel}〆`
            : `📌 パターン${idx + 1}`;
        if (remainingHp <= 0) {
            blocks.push(`${header}\n  ${orderLine}\n  ⚠ 戦闘無効`);
        } else {
            blocks.push(`${header}\n  ${orderLine}\n  ⏰ 持ち越し ${combo.carryoverSec}秒 ｜ フル持ち越し必要DMG: ${combo.fullCarryoverDmg} 万`);
        }
    });
    return blocks.join('\n\n');
}
