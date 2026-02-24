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

// --- 内訳フォーマット ---

const CIRCLED_NUMBERS = ['①', '②', '③', '④'];

export function formatRollBreakdown(rolls: number[]): string {
    const counts = [0, 0, 0, 0]; // index 0=1等, 1=2等, 2=3等, 3=4等
    for (const r of rolls) {
        if (r >= 1 && r <= 4) counts[r - 1]++;
    }
    return counts.map((c, i) => `${CIRCLED_NUMBERS[i]}${c}`).join(' ');
}

// --- フォーマット ---

export function formatRanking(entries: RankingEntry[], mode: 'top' | 'bottom' | 'all', count?: number, date?: Date, detail?: boolean): string {
    const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const WORST_MEDALS: Record<number, string> = { 1: '💀', 2: '🤡', 3: '🫠' };

    // mode に応じてスライス
    let display: RankingEntry[];
    if (mode === 'top' && count != null) {
        display = entries.slice(0, count);
    } else if (mode === 'bottom') {
        // ワーストモード: 逆順（最下位が先頭）、countがあればスライス
        const sliced = count != null ? entries.slice(-count) : entries;
        display = [...sliced].reverse();
    } else {
        display = entries;
    }

    // 日付ヘッダー（JST明示変換 — UTCサーバーでも正しい日付を表示）
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const d = date ?? new Date();
    const jstD = new Date(d.getTime() + JST_OFFSET_MS);
    let header = `🏆 ランドソル杯（${jstD.getUTCMonth() + 1}/${jstD.getUTCDate()}）`;
    if (mode === 'bottom') {
        header += 'ワーストランキング';
    }

    // 各行のフォーマット（メダルなし時は全角スペースで絵文字幅に合わせる）
    const lines = display.map((e, i) => {
        const gems = e.totalGems.toLocaleString('en-US');
        const breakdown = detail ? ` (${formatRollBreakdown(e.rolls)})` : '';
        if (mode === 'bottom') {
            const worstRank = i + 1;
            const medal = WORST_MEDALS[worstRank] ?? '\u3000';
            return `${medal} ${worstRank}位 ${e.displayName} — 💎${gems}${breakdown}`;
        }
        const medal = MEDALS[e.rank] ?? '\u3000';
        return `${medal} ${e.rank}位 ${e.displayName} — 💎${gems}${breakdown}`;
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

// --- 日付パース ---

const GAME_DATE_MD = /^(\d{1,2})\/(\d{1,2})$/;           // M/D
const GAME_DATE_YMD = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/; // YYYY/M/D

export function parseGameDate(input: string | null, referenceYear?: number): Date | null {
    if (!input) return null;

    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    let year: number, month: number, day: number;

    const mdMatch = input.match(GAME_DATE_MD);
    const ymdMatch = input.match(GAME_DATE_YMD);

    if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10);
        month = parseInt(ymdMatch[2], 10);
        day = parseInt(ymdMatch[3], 10);
    } else if (mdMatch) {
        year = referenceYear ?? new Date().getUTCFullYear();
        month = parseInt(mdMatch[1], 10);
        day = parseInt(mdMatch[2], 10);
    } else {
        return null;
    }

    // バリデーション: 月1-12, 日1-31
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    // Dateコンストラクタで実際に有効な日付か確認（JST 12:00 を構築）
    const utcMs = Date.UTC(year, month - 1, day, 12, 0, 0, 0) - JST_OFFSET_MS;
    const d = new Date(utcMs);

    // 月がずれていないか確認（例: 2/30 → 3/2 になる場合を弾く）
    const jstD = new Date(d.getTime() + JST_OFFSET_MS);
    if (jstD.getUTCMonth() !== month - 1 || jstD.getUTCDate() !== day) return null;

    return d;
}

// --- ゲーム日境界 ---

export function getGameDayStart(now: Date): Date {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

    // JST での現在時刻を計算（UTC timestamp に +9h して UTC メソッドで読む）
    const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
    const jstHour = jstNow.getUTCHours();
    let year = jstNow.getUTCFullYear();
    let month = jstNow.getUTCMonth();
    let day = jstNow.getUTCDate();

    if (jstHour < 5) {
        // JST 5時前 → 前日の 05:00 JST
        day -= 1;
    }

    // JST 05:00 を UTC に変換して返す
    return new Date(Date.UTC(year, month, day, 5, 0, 0, 0) - JST_OFFSET_MS);
}

export function getGameDayEnd(gameDayStart: Date): Date {
    return new Date(gameDayStart.getTime() + 24 * 60 * 60 * 1000);
}
