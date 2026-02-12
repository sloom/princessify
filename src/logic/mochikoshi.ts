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

export interface Participant {
    originalIndex: number;
    damage: number;
    label: string | undefined;
    isCarryover: boolean;
}

export interface CombinationResult {
    participants: Participant[];
    last: Participant;
    nonParticipants: Participant[];
    carryoverSec: number;
    fullCarryoverDmg: string;
}

export function generateAllCombinations(
    bossHp: number,
    damages: number[],
    labels?: (string | undefined)[],
    carryovers?: boolean[]
): CombinationResult[] {
    const n = damages.length;
    const safeLabels = labels ?? damages.map(() => undefined);
    const safeCarryovers = carryovers ?? damages.map(() => false);
    const results: CombinationResult[] = [];

    // 全サブセット列挙（2人以上）
    for (let mask = 0; mask < (1 << n); mask++) {
        const indices: number[] = [];
        for (let j = 0; j < n; j++) {
            if (mask & (1 << j)) indices.push(j);
        }
        if (indices.length < 2) continue;

        // 各参加者を〆として試す（持ち越しメンバーは〆不可）
        for (const closerIdx of indices) {
            if (safeCarryovers[closerIdx]) continue;
            const others = indices.filter(i => i !== closerIdx);
            const otherSum = others.reduce((s, i) => s + damages[i], 0);
            const remainingHp = bossHp - otherSum;

            // 有効条件: 0 < remainingHp <= lastDamage
            if (remainingHp <= 0 || remainingHp > damages[closerIdx]) continue;

            const participants = others.map(i => ({
                originalIndex: i,
                damage: damages[i],
                label: safeLabels[i],
                isCarryover: safeCarryovers[i],
            }));
            const last: Participant = {
                originalIndex: closerIdx,
                damage: damages[closerIdx],
                label: safeLabels[closerIdx],
                isCarryover: safeCarryovers[closerIdx],
            };
            const nonIndices: number[] = [];
            for (let j = 0; j < n; j++) {
                if (!(mask & (1 << j))) nonIndices.push(j);
            }
            const nonParticipants = nonIndices.map(i => ({
                originalIndex: i,
                damage: damages[i],
                label: safeLabels[i],
                isCarryover: safeCarryovers[i],
            }));

            const otherDamages = others.map(i => damages[i]);
            results.push({
                participants,
                last,
                nonParticipants,
                carryoverSec: calcCarryoverTime(bossHp, otherDamages, damages[closerIdx]),
                fullCarryoverDmg: calcFullCarryoverDmg(remainingHp),
            });
        }
    }

    // ソート: 持ち越し秒数降順 → 参加人数降順 → 90秒同率時は〆ダメージ降順 → 残りHP昇順
    results.sort((a, b) => {
        if (b.carryoverSec !== a.carryoverSec) return b.carryoverSec - a.carryoverSec;
        const aTotal = a.participants.length + 1;
        const bTotal = b.participants.length + 1;
        if (bTotal !== aTotal) return bTotal - aTotal;
        if (a.carryoverSec === 90 && b.last.damage !== a.last.damage) return b.last.damage - a.last.damage;
        const aRemHp = bossHp - a.participants.reduce((s, p) => s + p.damage, 0);
        const bRemHp = bossHp - b.participants.reduce((s, p) => s + p.damage, 0);
        return aRemHp - bRemHp;
    });

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
    carryovers: boolean[];
}

const CARRYOVER_MARKER_RE = /[*💼]$/u;

export function parseMochiMessage(text: string): MochiInput | null {
    const match = text.match(/[@-](?:mochi|mo)\b(!?)\s+(.+)/);
    if (!match) return null;
    const raw = match[1] === '!';
    const tokens = match[2].trim().split(/\s+/);

    const numbers: number[] = [];
    const labels: (string | undefined)[] = [];
    const carryovers: boolean[] = [];

    for (const token of tokens) {
        const colonIdx = token.indexOf(':');
        if (colonIdx !== -1) {
            const left = token.substring(0, colonIdx);
            const right = token.substring(colonIdx + 1);

            // マーカーをストリップして数値判定
            const leftStripped = left.replace(CARRYOVER_MARKER_RE, '');
            const leftMarked = leftStripped !== left;
            const rightStripped = right.replace(CARRYOVER_MARKER_RE, '');
            const rightMarked = rightStripped !== right;

            const leftNum = Number(leftStripped);
            const rightNum = Number(rightStripped);
            if (!isNaN(leftNum) && leftStripped !== '') {
                // NUMBER:LABEL (例: 3:Alice, 2.8*:Bob)
                numbers.push(leftNum);
                labels.push(right || undefined);
                carryovers.push(leftMarked);
            } else if (!isNaN(rightNum) && rightStripped !== '') {
                // LABEL:NUMBER (例: Alice:3, Bob:2.8*)
                numbers.push(rightNum);
                labels.push(left || undefined);
                carryovers.push(rightMarked);
            } else {
                return null;
            }
        } else {
            // マーカーをストリップして数値判定
            const stripped = token.replace(CARRYOVER_MARKER_RE, '');
            const marked = stripped !== token;
            const num = Number(stripped);
            if (isNaN(num)) return null;
            numbers.push(num);
            labels.push(undefined);
            carryovers.push(marked);
        }
    }

    if (numbers.length < 3) return null;
    const normalized = raw ? numbers : numbers.map(normalizeToMan);
    return {
        bossHp: normalized[0],
        damages: normalized.slice(1),
        labels: labels.slice(1),
        carryovers: carryovers.slice(1),
    };
}

function renderCombos(
    bossHp: number,
    combos: CombinationResult[],
    maxItems: number,
    totalPeople: number
): string {
    const shown = combos.slice(0, maxItems);
    const blocks: string[] = [`👾 敵の残りHP: ${bossHp}  (${combos.length}通り)`];
    const multipleMax = combos.filter(c => c.carryoverSec === 90).length >= 2;

    shown.forEach((combo, idx) => {
        const totalParticipants = combo.participants.length + 1;
        const allParticipate = totalParticipants === totalPeople;

        const co = (p: Participant) => p.isCarryover ? '💼' : '';
        const parts: string[] = combo.participants.map(p =>
            p.label ? `${p.label}${co(p)} ${p.damage}` : `${p.damage}${co(p)}`
        );
        const lastPart = combo.last.label
            ? `${combo.last.label}(〆) ${combo.last.damage}`
            : `(〆) ${combo.last.damage}`;
        parts.push(lastPart);
        const orderLine = parts.join(' → ');

        const header = combo.last.label
            ? `📌 ${idx + 1}位 ― ${combo.last.label}〆`
            : `📌 ${idx + 1}位`;

        let participationInfo: string;
        if (allParticipate) {
            participationInfo = `[${totalPeople}人全員参加]`;
        } else {
            const nonLabels = combo.nonParticipants.map(p =>
                p.label ?? `${p.originalIndex + 1}人目`
            ).join(',');
            participationInfo = `[${totalParticipants}人参加 ⚠️不参加: ${nonLabels}]`;
        }

        const sortNote = (multipleMax && combo.carryoverSec === 90) ? ' ｜ ℹ️〆ダメージ順' : '';
        blocks.push(
            `${header}\n` +
            `  ${orderLine}\n` +
            `  ⏰ ${combo.carryoverSec}秒 ｜ ⚡${combo.fullCarryoverDmg}万 ｜ ${participationInfo}${sortNote}`
        );
    });

    if (combos.length > maxItems) {
        blocks.push(`…他 ${combos.length - maxItems} 通り`);
    }

    return blocks.join('\n\n');
}

export function formatMochiResult(bossHp: number, damages: number[], labels?: (string | undefined)[], carryovers?: boolean[]): string {
    if (damages.length > 10) {
        return '⚠️ ダメージの入力は最大10人までです。';
    }

    const combos = generateAllCombinations(bossHp, damages, labels, carryovers);

    if (combos.length === 0) {
        return `👾 敵の残りHP: ${bossHp}\n\n⚠️ 有効な組み合わせがありません。`;
    }

    for (let maxItems = Math.min(10, combos.length); maxItems >= 3; maxItems--) {
        const output = renderCombos(bossHp, combos, maxItems, damages.length);
        if (output.length <= 2000) return output;
    }
    return renderCombos(bossHp, combos, 3, damages.length);
}
