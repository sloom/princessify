// src/logic/landsol-cup.ts
// ランドソル杯 — ランキング機能

// --- データ型 ---

export interface GachaResult {
    userId: string;
    displayName: string;
    rolls: number[];
    totalGems: number;
}

export interface RankingEntry {
    rank: number;
    displayName: string;
    totalGems: number;
    rolls: number[];
}

// --- 定数 ---

export const GEMS_TABLE: Record<number, number> = {
    1: 500,
    2: 400,
    3: 300,
    4: 250,
};

// --- パース ---

// 区切り文字: -> (矢印), → (Unicode矢印), - (ハイフン)  ※ -> を先にマッチさせる
const SEPARATOR = /\s*(?:->|→|-)\s*/;
// 広くマッチ: 任意の数字を区切り文字で連結したパターン（lookbehindで数字の一部でないことを確認）
const ROLL_PATTERN = /(?<!\d)\d(?:\s*(?:->|→|-)\s*\d)+/;

export function parseGachaRolls(text: string): number[] | null {
    for (const line of text.split('\n')) {
        const match = line.match(ROLL_PATTERN);
        if (!match) continue;

        const nums = match[0].split(SEPARATOR).map(Number);
        // すべて 1-4 の範囲であることをバリデーション（範囲外を含むシーケンス全体を拒否）
        if (nums.length >= 2 && nums.every(n => n >= 1 && n <= 4)) {
            return nums;
        }
    }
    return null;
}

// --- 集計 ---

export function computeTotalGems(rolls: number[]): number {
    return rolls.reduce((sum, roll) => sum + (GEMS_TABLE[roll] ?? 0), 0);
}

// --- ランキング ---

export function buildRanking(results: GachaResult[]): RankingEntry[] {
    const sorted = [...results].sort((a, b) => b.totalGems - a.totalGems);
    const entries: RankingEntry[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        // 同率処理: 前の人と同じ石数なら同じ順位
        const rank = (i > 0 && sorted[i - 1].totalGems === r.totalGems)
            ? entries[i - 1].rank
            : i + 1;
        entries.push({
            rank,
            displayName: r.displayName,
            totalGems: r.totalGems,
            rolls: r.rolls,
        });
    }
    return entries;
}

// --- 日数不一致検出 ---

export function detectDaysMismatch(entries: RankingEntry[]): { standardDays: number; mismatches: { name: string; days: number }[] } {
    if (entries.length === 0) return { standardDays: 0, mismatches: [] };

    // 各日数の出現回数を集計
    const countByDays = new Map<number, number>();
    for (const e of entries) {
        const days = e.rolls.length;
        countByDays.set(days, (countByDays.get(days) ?? 0) + 1);
    }

    // 最頻値を求める（同率なら最大値を採用）
    let maxCount = 0;
    let standardDays = 0;
    for (const [days, count] of countByDays) {
        if (count > maxCount || (count === maxCount && days > standardDays)) {
            maxCount = count;
            standardDays = days;
        }
    }

    // 基準日数と異なるメンバーを抽出
    const mismatches: { name: string; days: number }[] = [];
    for (const e of entries) {
        if (e.rolls.length !== standardDays) {
            mismatches.push({ name: e.displayName, days: e.rolls.length });
        }
    }

    return { standardDays, mismatches };
}

// --- フォーマット ---

export function formatRanking(entries: RankingEntry[], mode: 'top' | 'bottom' | 'all', count?: number, date?: Date): string {
    const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const WORST_MEDALS: Record<number, string> = { 1: '💀', 2: '🤡', 3: '🫠' };

    // mode に応じてスライス
    let display: RankingEntry[];
    if (mode === 'top' && count != null) {
        display = entries.slice(0, count);
    } else if (mode === 'bottom' && count != null) {
        // ワーストモード: 下位をスライスして逆順（最下位が先頭）
        display = [...entries.slice(-count)].reverse();
    } else {
        display = entries;
    }

    // 日付ヘッダー
    const d = date ?? new Date();
    const header = `🏆 ランドソル杯（${d.getMonth() + 1}/${d.getDate()}）`;

    // 各行のフォーマット
    const lines = display.map((e, i) => {
        const gems = e.totalGems.toLocaleString('en-US');
        if (mode === 'bottom') {
            const worstRank = i + 1;
            const medal = WORST_MEDALS[worstRank] ?? '  ';
            return `${medal} ワースト${worstRank}位 ${e.displayName}  💎${gems}`;
        }
        const medal = MEDALS[e.rank] ?? '  ';
        return `${medal} ${e.rank}位 ${e.displayName}  💎${gems}`;
    });

    let result = `${header}\n\n${lines.join('\n')}`;

    // 日数不一致の警告を追加
    const { standardDays, mismatches } = detectDaysMismatch(entries);
    if (mismatches.length > 0) {
        const names = mismatches.map(m => `${m.name}(${m.days}日)`).join(' / ');
        result += `\n\n集計対象: ${standardDays}日\n⚠️ 以下の方は集計対象日数が異なりました\n${names}`;
    }

    return result;
}

// --- ゲーム日境界 ---

export function getGameDayStart(now: Date): Date {
    const result = new Date(now);
    result.setMinutes(0, 0, 0);
    if (now.getHours() < 5) {
        // 5時前 → 前日の05:00
        result.setDate(result.getDate() - 1);
    }
    result.setHours(5);
    return result;
}
