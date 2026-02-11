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
    lastDamage: number;
    carryoverSec: number;
    fullCarryoverDmg: string;
}

export function generateAllCombinations(
    bossHp: number,
    damages: number[]
): CombinationResult[] {
    const results: CombinationResult[] = [];
    // 末尾から順に各人を〆として計算
    for (let i = damages.length - 1; i >= 0; i--) {
        const lastDamage = damages[i];
        const otherDamages = damages.filter((_, idx) => idx !== i);
        const remainingHp = bossHp - otherDamages.reduce((sum, d) => sum + d, 0);
        results.push({
            otherDamages,
            lastDamage,
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
}

export function parseMochiMessage(text: string): MochiInput | null {
    const match = text.match(/[@-](?:mochi|mo)\b(!?)\s+([\d.\s]+)/);
    if (!match) return null;
    const raw = match[1] === '!';
    const tokens = match[2].trim().split(/\s+/);
    const numbers = tokens.map(Number);
    if (numbers.some(isNaN) || numbers.length < 3) return null;
    const normalized = raw ? numbers : numbers.map(normalizeToMan);
    return { bossHp: normalized[0], damages: normalized.slice(1) };
}

export function formatMochiResult(bossHp: number, damages: number[]): string {
    const combos = generateAllCombinations(bossHp, damages);
    const blocks: string[] = [`🧮 敵の残りHP: ${bossHp}`];
    combos.forEach((combo, idx) => {
        const parts: string[] = [];
        for (let i = 0; i < combo.otherDamages.length; i++) {
            parts.push(`${i + 1}人目 ${combo.otherDamages[i]}`);
        }
        parts.push(`${combo.otherDamages.length + 1}人目(〆) ${combo.lastDamage}`);
        const orderLine = parts.join(' → ');
        const remainingHp = bossHp - combo.otherDamages.reduce((sum, d) => sum + d, 0);
        const header = `📌 パターン${idx + 1} ― 〆: ${combo.lastDamage}`;
        if (remainingHp <= 0) {
            blocks.push(`${header}\n  ${orderLine}\n  ⚠ 戦闘無効`);
        } else {
            blocks.push(`${header}\n  ${orderLine}\n  ⏱ 持ち越し ${combo.carryoverSec}秒 ｜ フル持ち越し必要DMG: ${combo.fullCarryoverDmg} 万`);
        }
    });
    return blocks.join('\n\n');
}
