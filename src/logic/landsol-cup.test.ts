// src/logic/landsol-cup.test.ts
// ランドソル杯（ランキング）テスト

import { parseGachaRolls, computeTotalGems, buildRanking, formatRanking, formatRollBreakdown, getGameDayStart, getGameDayEnd, parseGameDate, detectDaysMismatch, GEMS_TABLE } from './landsol-cup';

// --- テストユーティリティ ---

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertEqual(actual: any, expected: any, message: string) {
    if (actual !== expected) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected: ${JSON.stringify(expected)}`);
        console.error(`   Actual:   ${JSON.stringify(actual)}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertDeepEqual(actual: any, expected: any, message: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected: ${e}`);
        console.error(`   Actual:   ${a}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertIncludes(actual: string, expected: string, message: string) {
    if (!actual.includes(expected)) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected to include: ${expected}`);
        console.error(`   Actual: ${actual}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertNotIncludes(actual: string, expected: string, message: string) {
    if (actual.includes(expected)) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected NOT to include: ${expected}`);
        console.error(`   Actual: ${actual}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

// ============================================================
// フェーズ1: parseGachaRolls
// ============================================================
console.log('\n=== フェーズ1: parseGachaRolls ===');

// 1. ハイフン区切り
assertDeepEqual(
    parseGachaRolls('3-3-3-3-2-4-1-2-2-3'),
    [3, 3, 3, 3, 2, 4, 1, 2, 2, 3],
    '1. ハイフン区切り'
);

// 2. 矢印区切り ->
assertDeepEqual(
    parseGachaRolls('3->1->2->1->4->2->3->2->2->1'),
    [3, 1, 2, 1, 4, 2, 3, 2, 2, 1],
    '2. 矢印区切り ->'
);

// 3. Unicode矢印 →
assertDeepEqual(
    parseGachaRolls('4→3→1→4→2→1→2→3→1→2'),
    [4, 3, 1, 4, 2, 1, 2, 3, 1, 2],
    '3. Unicode矢印 →'
);

// 4. 範囲外数値(5)を含む → null
assertEqual(
    parseGachaRolls('3-5-2-1'),
    null,
    '4. 範囲外数値(5)を含む → null'
);

// 5. 関係ないテキスト → null
assertEqual(
    parseGachaRolls('今日は良い天気です'),
    null,
    '5. 関係ないテキスト → null'
);

// 6. 空文字列 → null
assertEqual(
    parseGachaRolls(''),
    null,
    '6. 空文字列 → null'
);

// 7. 単独数字 → null
assertEqual(
    parseGachaRolls('3'),
    null,
    '7. 単独数字 → null'
);

// 8. 前後にテキスト付き（部分抽出OK）
assertDeepEqual(
    parseGachaRolls('今日の結果: 3-2-1-4'),
    [3, 2, 1, 4],
    '8. 前後にテキスト付き → 部分抽出'
);

// 9. 複数行メッセージで該当行がある場合
assertDeepEqual(
    parseGachaRolls('しばらく報告してなかったが\n2-2-3-1-3-2-4-3-1-4\n今日は4位'),
    [2, 2, 3, 1, 3, 2, 4, 3, 1, 4],
    '9. 複数行メッセージ → 該当行を抽出'
);

// 10. 0を含む → null
assertEqual(
    parseGachaRolls('0-2-3-1'),
    null,
    '10. 0を含む → null'
);

// 11. スペース付き
assertDeepEqual(
    parseGachaRolls('3 - 2 - 1 - 4'),
    [3, 2, 1, 4],
    '11. スペース付き → 柔軟対応'
);

// ============================================================
// フェーズ2: computeTotalGems
// ============================================================
console.log('\n=== フェーズ2: computeTotalGems ===');

// 12. 全て1位 → 500×3=1500
assertEqual(computeTotalGems([1, 1, 1]), 1500, '12. [1,1,1] → 1500');

// 13. 全て4位 → 250×3=750
assertEqual(computeTotalGems([4, 4, 4]), 750, '13. [4,4,4] → 750');

// 14. 混合 → 500+400+300+250=1450
assertEqual(computeTotalGems([1, 2, 3, 4]), 1450, '14. [1,2,3,4] → 1450');

// 15. 空配列 → 0
assertEqual(computeTotalGems([]), 0, '15. 空配列 → 0');

// ============================================================
// フェーズ3: buildRanking
// ============================================================
console.log('\n=== フェーズ3: buildRanking ===');

// 16. 3人の結果→石数降順
{
    const results: import('./landsol-cup').GachaResult[] = [
        { userId: '1', displayName: '甲', rolls: [3, 3], totalGems: 600 },
        { userId: '2', displayName: '乙', rolls: [1, 1], totalGems: 1000 },
        { userId: '3', displayName: '丙', rolls: [2, 2], totalGems: 800 },
    ];
    const ranking = buildRanking(results);
    assertEqual(ranking[0].displayName, '乙', '16a. 1位は乙(1000)');
    assertEqual(ranking[1].displayName, '丙', '16b. 2位は丙(800)');
    assertEqual(ranking[2].displayName, '甲', '16c. 3位は甲(600)');
    assertEqual(ranking[0].rank, 1, '16d. rank=1');
    assertEqual(ranking[1].rank, 2, '16e. rank=2');
    assertEqual(ranking[2].rank, 3, '16f. rank=3');
}

// 17. 同率順位
{
    const results: import('./landsol-cup').GachaResult[] = [
        { userId: '1', displayName: '甲', rolls: [1, 1], totalGems: 1000 },
        { userId: '2', displayName: '乙', rolls: [1, 1], totalGems: 1000 },
        { userId: '3', displayName: '丙', rolls: [3, 3], totalGems: 600 },
    ];
    const ranking = buildRanking(results);
    assertEqual(ranking[0].rank, 1, '17a. 甲は1位');
    assertEqual(ranking[1].rank, 1, '17b. 乙も1位（同率）');
    assertEqual(ranking[2].rank, 3, '17c. 丙は3位（2位をスキップ）');
}

// 18. 1人だけ
{
    const results: import('./landsol-cup').GachaResult[] = [
        { userId: '1', displayName: '甲', rolls: [2, 3], totalGems: 700 },
    ];
    const ranking = buildRanking(results);
    assertEqual(ranking.length, 1, '18a. 1人だけ → 要素1つ');
    assertEqual(ranking[0].rank, 1, '18b. rank=1');
}

// ============================================================
// フェーズ4: formatRanking
// ============================================================
console.log('\n=== フェーズ4: formatRanking ===');

// テスト用の固定日付
const testDate = new Date(2026, 1, 24); // 2026/2/24

// テスト用ランキングエントリ
const testEntries: import('./landsol-cup').RankingEntry[] = [
    { rank: 1, displayName: '乙', totalGems: 3500, rolls: [1,1,1,1,1,1,1] },
    { rank: 2, displayName: '丙', totalGems: 3150, rolls: [1,1,1,2,2,3,3] },
    { rank: 3, displayName: '甲', totalGems: 3000, rolls: [2,2,2,2,2,2,2] },
    { rank: 4, displayName: '丁', totalGems: 2800, rolls: [3,3,3,3,2,2,2] },
];

// 19. 3人以下 → メダル絵文字付き
{
    const out = formatRanking(testEntries.slice(0, 3), 'all', undefined, testDate);
    assertIncludes(out, '🥇', '19a. 1位にメダル🥇');
    assertIncludes(out, '🥈', '19b. 2位にメダル🥈');
    assertIncludes(out, '🥉', '19c. 3位にメダル🥉');
}

// 20. 4人以上 → 4位以降は全角スペースインデント
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '🥇', '20a. 1位にメダル');
    assertNotIncludes(out, '🏅', '20b. 4位にメダルなし');
    assertIncludes(out, '4位', '20c. 4位の行がある');
    // 4位は全角スペースでインデント
    assertIncludes(out, '\u3000 4位', '20d. 4位に全角スペースインデント');
}

// 21. mode='top', count=2 → 上位2件のみ
{
    const out = formatRanking(testEntries, 'top', 2, testDate);
    assertIncludes(out, '乙', '21a. top2に1位がいる');
    assertIncludes(out, '丙', '21b. top2に2位がいる');
    assertNotIncludes(out, '甲', '21c. top2に3位がいない');
}

// 22. mode='bottom', count=2 → ワーストランキング（下位2件、逆順、ワースト絵文字）
{
    const out = formatRanking(testEntries, 'bottom', 2, testDate);
    assertNotIncludes(out, '乙', '22a. bottom2に1位がいない');
    assertIncludes(out, '甲', '22b. bottom2に甲がいる');
    assertIncludes(out, '丁', '22c. bottom2に丁がいる');
    // ワースト絵文字
    assertIncludes(out, '💀', '22d. 1位に💀');
    assertIncludes(out, '🤡', '22e. 2位に🤡');
    // ヘッダーに「ワーストランキング」
    assertIncludes(out, 'ワーストランキング', '22f. ヘッダーにワーストランキング');
    // 各行には「ワースト」なし（N位のみ）
    assertIncludes(out, '💀 1位', '22g. 各行はN位のみ');
    assertNotIncludes(out, 'ワースト1位', '22h. 各行にワーストなし');
    // 逆順（最下位が先頭）
    const idx丁 = out.indexOf('丁');
    const idx甲 = out.indexOf('甲');
    assert(idx丁 < idx甲, '22i. 逆順: 丁（最下位）が甲より先');
    // 通常メダルは出ない
    assertNotIncludes(out, '🥇', '22j. 通常メダルは出ない');
}

// 22.5. mode='bottom', count=3 → 🫠が3位に付く
{
    const out = formatRanking(testEntries, 'bottom', 3, testDate);
    assertIncludes(out, '🫠', '22.5a. 3位に🫠');
    assertIncludes(out, '🫠 3位', '22.5b. 各行はN位のみ');
}

// 22.7. mode='bottom', countなし → 全件逆順（最下位が先頭）
{
    const out = formatRanking(testEntries, 'bottom', undefined, testDate);
    // 丁(2800)が最下位 → 先頭に来る
    const idx丁 = out.indexOf('丁');
    const idx乙 = out.indexOf('乙');
    assert(idx丁 < idx乙, '22.7a. countなしbottom: 丁（最下位）が乙より先');
    // 💀が1位（最下位）に付く
    assertIncludes(out, '💀 1位 丁', '22.7b. countなしbottom: 丁がワースト1位');
    // ヘッダーにワーストランキング
    assertIncludes(out, 'ワーストランキング', '22.7c. countなしbottom: ヘッダー');
}

// 23. mode='all' → 全件
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '乙', '23a. allに1位');
    assertIncludes(out, '丁', '23b. allに4位');
}

// 24. 石数の💎フォーマット + —区切り
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '— 💎3,500', '24a. —区切り+💎+カンマ区切り');
    assertNotIncludes(out, '個', '24b. 「個」は表示しない');
}

// 25. 日付ヘッダー
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '2/24', '25. 日付ヘッダーに2/24を含む');
}

// ============================================================
// フェーズ5: getGameDayStart
// ============================================================
console.log('\n=== フェーズ5: getGameDayStart ===');

// 26. 10:00 → 当日05:00
{
    const now = new Date(2026, 1, 24, 10, 0);
    const start = getGameDayStart(now);
    assertEqual(start.getFullYear(), 2026, '26a. 年');
    assertEqual(start.getMonth(), 1, '26b. 月(0-indexed)');
    assertEqual(start.getDate(), 24, '26c. 日');
    assertEqual(start.getHours(), 5, '26d. 時');
    assertEqual(start.getMinutes(), 0, '26e. 分');
}

// 27. 03:00 → 前日05:00
{
    const now = new Date(2026, 1, 24, 3, 0);
    const start = getGameDayStart(now);
    assertEqual(start.getDate(), 23, '27a. 前日の日');
    assertEqual(start.getHours(), 5, '27b. 時');
}

// 28. 05:00ちょうど → 当日05:00
{
    const now = new Date(2026, 1, 24, 5, 0);
    const start = getGameDayStart(now);
    assertEqual(start.getDate(), 24, '28a. 当日の日');
    assertEqual(start.getHours(), 5, '28b. 時');
}

// 28.5. UTC入力: サーバーがUTCでもJST 5:00を正しく計算する
{
    // Feb 24 08:18 UTC = Feb 24 17:18 JST → ゲーム日はFeb 24 05:00 JST = Feb 23 20:00 UTC
    const nowUtc = new Date(Date.UTC(2026, 1, 24, 8, 18));
    const start = getGameDayStart(nowUtc);
    assertEqual(start.getTime(), Date.UTC(2026, 1, 23, 20, 0, 0, 0), '28.5a. JST17:18 → Feb23 20:00 UTC');

    // Feb 24 18:00 UTC = Feb 25 03:00 JST → ゲーム日はFeb 24 05:00 JST = Feb 23 20:00 UTC
    const nowUtc2 = new Date(Date.UTC(2026, 1, 24, 18, 0));
    const start2 = getGameDayStart(nowUtc2);
    assertEqual(start2.getTime(), Date.UTC(2026, 1, 23, 20, 0, 0, 0), '28.5b. JST03:00 → 前日の20:00 UTC');

    // Feb 23 20:00 UTC = Feb 24 05:00 JST → ゲーム日はFeb 24 05:00 JST = Feb 23 20:00 UTC
    const nowUtc3 = new Date(Date.UTC(2026, 1, 23, 20, 0));
    const start3 = getGameDayStart(nowUtc3);
    assertEqual(start3.getTime(), Date.UTC(2026, 1, 23, 20, 0, 0, 0), '28.5c. JST05:00ちょうど → 当日の20:00 UTC');
}

// ============================================================
// フェーズ6: detectDaysMismatch
// ============================================================
console.log('\n=== フェーズ6: detectDaysMismatch ===');

// 29. 全員10日 → 不一致なし
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(10).fill(1) },
        { rank: 2, displayName: '乙', totalGems: 3000, rolls: new Array(10).fill(2) },
    ];
    const result = detectDaysMismatch(entries);
    assertEqual(result.standardDays, 10, '29a. 基準日数=10');
    assertEqual(result.mismatches.length, 0, '29b. 不一致なし');
}

// 30. 大半10日、1人9日
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(10).fill(1) },
        { rank: 2, displayName: '乙', totalGems: 3000, rolls: new Array(10).fill(2) },
        { rank: 3, displayName: '丙', totalGems: 2700, rolls: new Array(9).fill(3) },
    ];
    const result = detectDaysMismatch(entries);
    assertEqual(result.standardDays, 10, '30a. 基準日数=10');
    assertEqual(result.mismatches.length, 1, '30b. 不一致1人');
    assertEqual(result.mismatches[0].name, '丙', '30c. 丙が不一致');
    assertEqual(result.mismatches[0].days, 9, '30d. 丙は9日');
}

// 31. 全員バラバラ → 最頻値（同率なら最大値）
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 5000, rolls: new Array(10).fill(1) },
        { rank: 2, displayName: '乙', totalGems: 3600, rolls: new Array(9).fill(2) },
        { rank: 3, displayName: '丙', totalGems: 2400, rolls: new Array(8).fill(3) },
    ];
    const result = detectDaysMismatch(entries);
    // 全員異なる → 最頻値は全部1、同率なら最大値=10
    assertEqual(result.standardDays, 10, '31a. 同率時は最大値を基準');
    assertEqual(result.mismatches.length, 2, '31b. 2人が不一致');
}

// 32. 1人だけ
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 2500, rolls: new Array(5).fill(1) },
    ];
    const result = detectDaysMismatch(entries);
    assertEqual(result.standardDays, 5, '32a. 1人なら自身の日数が基準');
    assertEqual(result.mismatches.length, 0, '32b. 不一致なし');
}

// ============================================================
// フェーズ7: formatRanking（日数不一致警告付き）
// ============================================================
console.log('\n=== フェーズ7: formatRanking（日数不一致警告付き） ===');

// 33. 日数一致時 → 警告なし
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(10).fill(1) },
        { rank: 2, displayName: '乙', totalGems: 3000, rolls: new Array(10).fill(2) },
    ];
    const out = formatRanking(entries, 'all', undefined, testDate);
    assertNotIncludes(out, '⚠️', '33. 日数一致時は警告なし');
}

// 34. 日数不一致時 → 警告あり
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(10).fill(1) },
        { rank: 2, displayName: '乙', totalGems: 3000, rolls: new Array(10).fill(2) },
        { rank: 3, displayName: '丙', totalGems: 2700, rolls: new Array(9).fill(3) },
    ];
    const out = formatRanking(entries, 'all', undefined, testDate);
    assertIncludes(out, '集計対象: 10日', '34a. 基準日数を表示');
    assertIncludes(out, '⚠️', '34b. 警告マーク');
    assertIncludes(out, '丙', '34c. 不一致メンバー名');
    assertIncludes(out, '9日', '34d. 不一致の日数');
}

// ============================================================
// フェーズ8: formatRollBreakdown + detail オプション
// ============================================================
console.log('\n=== フェーズ8: formatRollBreakdown + detail ===');

// 35. formatRollBreakdown: 基本的な集計
{
    // [1,1,2,3,1,4,2,1,3,2] → ①4 ②3 ③2 ④1
    const out = formatRollBreakdown([1,1,2,3,1,4,2,1,3,2]);
    assertEqual(out, '①4 ②3 ③2 ④1', '35a. 基本的な集計');
}

// 36. formatRollBreakdown: 0回の等がある場合
{
    // [1,1,1] → ①3 ②0 ③0 ④0
    const out = formatRollBreakdown([1,1,1]);
    assertEqual(out, '①3 ②0 ③0 ④0', '36a. 0回の等がある場合');
}

// 37. formatRollBreakdown: 全て同じ等
{
    const out = formatRollBreakdown([4,4,4,4,4]);
    assertEqual(out, '①0 ②0 ③0 ④5', '37a. 全て4等');
}

// 38. formatRollBreakdown: 空配列
{
    const out = formatRollBreakdown([]);
    assertEqual(out, '①0 ②0 ③0 ④0', '38a. 空配列');
}

// 39. formatRanking + detail=true: 各行に内訳が付く
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '乙', totalGems: 3500, rolls: [1,1,1,1,1,1,1] },
        { rank: 2, displayName: '甲', totalGems: 2800, rolls: [2,2,2,2,3,3,3] },
    ];
    const out = formatRanking(entries, 'all', undefined, testDate, true);
    assertIncludes(out, '①7 ②0 ③0 ④0', '39a. 乙の内訳');
    assertIncludes(out, '①0 ②4 ③3 ④0', '39b. 甲の内訳');
}

// 40. formatRanking + detail=false（デフォルト）: 内訳なし
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertNotIncludes(out, '①', '40a. デフォルトでは内訳なし');
}

// 41. formatRanking + detail=true + bottomモード
{
    const out = formatRanking(testEntries, 'bottom', 2, testDate, true);
    assertIncludes(out, '①0 ②3 ③4 ④0', '41a. bottomモードでも内訳あり（丁）');
}

// ============================================================
// フェーズ9: parseGameDate
// ============================================================
console.log('\n=== フェーズ9: parseGameDate ===');

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ヘルパー: DateからJST時刻を読み取る
function jstHour(d: Date): number { return new Date(d.getTime() + JST_OFFSET_MS).getUTCHours(); }
function jstMonth(d: Date): number { return new Date(d.getTime() + JST_OFFSET_MS).getUTCMonth() + 1; }
function jstDay(d: Date): number { return new Date(d.getTime() + JST_OFFSET_MS).getUTCDate(); }
function jstYear(d: Date): number { return new Date(d.getTime() + JST_OFFSET_MS).getUTCFullYear(); }

// 42. M/D形式: '2/24' → JST 2/24 12:00
{
    const d = parseGameDate('2/24', 2026);
    assert(d !== null, '42a. 2/24 はnullでない');
    assertEqual(jstMonth(d!), 2, '42b. 月=2');
    assertEqual(jstDay(d!), 24, '42c. 日=24');
    assertEqual(jstHour(d!), 12, '42d. JST 12:00');
    assertEqual(jstYear(d!), 2026, '42e. 年=2026');
}

// 43. M/D形式: '12/31'
{
    const d = parseGameDate('12/31', 2026);
    assert(d !== null, '43a. 12/31 はnullでない');
    assertEqual(jstMonth(d!), 12, '43b. 月=12');
    assertEqual(jstDay(d!), 31, '43c. 日=31');
}

// 44. YYYY/M/D形式: '2026/2/24'
{
    const d = parseGameDate('2026/2/24');
    assert(d !== null, '44a. 2026/2/24 はnullでない');
    assertEqual(jstYear(d!), 2026, '44b. 年=2026');
    assertEqual(jstMonth(d!), 2, '44c. 月=2');
    assertEqual(jstDay(d!), 24, '44d. 日=24');
    assertEqual(jstHour(d!), 12, '44e. JST 12:00');
}

// 45. YYYY/M/D形式: '2026/12/31'
{
    const d = parseGameDate('2026/12/31');
    assert(d !== null, '45a. 2026/12/31 はnullでない');
    assertEqual(jstYear(d!), 2026, '45b. 年=2026');
    assertEqual(jstMonth(d!), 12, '45c. 月=12');
    assertEqual(jstDay(d!), 31, '45d. 日=31');
}

// 46. null → null
{
    assertEqual(parseGameDate(null), null, '46. null → null');
}

// 47. 空文字 → null
{
    assertEqual(parseGameDate(''), null, '47. 空文字 → null');
}

// 48. 不正文字列 → null
{
    assertEqual(parseGameDate('abc'), null, '48. abc → null');
}

// 49. 月が13 → null
{
    assertEqual(parseGameDate('13/1'), null, '49. 13/1 → null');
}

// 50. 日が0 → null
{
    assertEqual(parseGameDate('2/0'), null, '50. 2/0 → null');
}

// 51. Integration: getGameDayStart(parseGameDate('2/24')) → JST 2/24 5:00
{
    const d = parseGameDate('2/24', 2026);
    const start = getGameDayStart(d!);
    assertEqual(jstMonth(start), 2, '51a. ゲーム日 月=2');
    assertEqual(jstDay(start), 24, '51b. ゲーム日 日=24');
    assertEqual(jstHour(start), 5, '51c. ゲーム日 5:00');
}

// ============================================================
// フェーズ10: getGameDayEnd
// ============================================================
console.log('\n=== フェーズ10: getGameDayEnd ===');

// 52. gameDayStart(2/24 JST 5:00) → 2/25 JST 5:00（+24h）
{
    const start = getGameDayStart(parseGameDate('2/24', 2026)!);
    const end = getGameDayEnd(start);
    assertEqual(jstMonth(end), 2, '52a. end 月=2');
    assertEqual(jstDay(end), 25, '52b. end 日=25');
    assertEqual(jstHour(end), 5, '52c. end 5:00');
    assertEqual(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000, '52d. 差分=24h');
}

// ============================================================
// フェーズ11: formatRanking JSTヘッダー修正
// ============================================================
console.log('\n=== フェーズ11: formatRanking JSTヘッダー ===');

// 53. gameDayStart (UTC 2/23 20:00 = JST 2/24 5:00) を渡す → ヘッダーに "2/24"
{
    const gameDayStart = getGameDayStart(parseGameDate('2/24', 2026)!);
    // gameDayStart は UTC 2/23 20:00 (= JST 2/24 5:00)
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: [1,1,1,1,1,1,1] },
    ];
    const out = formatRanking(entries, 'all', undefined, gameDayStart);
    assertIncludes(out, '2/24', '53a. ヘッダーに2/24（JST日付）');
    assert(!out.includes('2/23'), '53b. 2/23（UTC日付）は含まない');
}

// 54. 既存テストのtestDate (new Date(2026, 1, 24)) が引き続きパス
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '2/24', '54a. 既存testDateでも2/24表示');
}

// ============================================================
// フェーズ12: since モード
// ============================================================
console.log('\n=== フェーズ12: since モード ===');

// --- buildRanking: gameDay 伝播 ---

// 55. buildRanking が GachaResult の gameDay を RankingEntry にコピーする
{
    const gameDay = new Date(Date.UTC(2026, 1, 24, 20, 0)); // JST 2/25 05:00
    const results: import('./landsol-cup').GachaResult[] = [
        { userId: '1', displayName: '甲', rolls: [1, 1], totalGems: 1000, gameDay },
    ];
    const ranking = buildRanking(results);
    assertEqual(ranking[0].gameDay?.getTime(), gameDay.getTime(), '55. buildRanking が gameDay を伝播');
}

// 56. buildRanking で gameDay が undefined の場合も正常動作（後方互換）
{
    const results: import('./landsol-cup').GachaResult[] = [
        { userId: '1', displayName: '甲', rolls: [1, 1], totalGems: 1000 },
    ];
    const ranking = buildRanking(results);
    assertEqual(ranking[0].gameDay, undefined, '56. gameDay undefined でも正常');
}

// --- formatRanking: since ヘッダー ---

// 57. sinceMode=true → ヘッダーに日付範囲
{
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const latestDay = getGameDayStart(parseGameDate('2/25', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(6).fill(1), gameDay: latestDay },
        { rank: 2, displayName: '乙', totalGems: 3000, rolls: new Array(6).fill(2), gameDay: latestDay },
    ];
    const out = formatRanking(entries, 'all', undefined, sinceDate, false, true);
    assertIncludes(out, '2/20〜2/25', '57. since ヘッダーに日付範囲');
}

// 58. sinceMode + bottom → ワーストランキングヘッダー
{
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const latestDay = getGameDayStart(parseGameDate('2/25', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(6).fill(1), gameDay: latestDay },
    ];
    const out = formatRanking(entries, 'bottom', undefined, sinceDate, false, true);
    assertIncludes(out, '2/20〜2/25', '58a. since+bottom ヘッダーに範囲');
    assertIncludes(out, 'ワーストランキング', '58b. since+bottom ヘッダーにワースト');
}

// 59. sinceMode なし → 従来形式（〜なし）
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '2/24', '59a. 従来ヘッダー形式');
    assertNotIncludes(out, '〜', '59b. 範囲記号なし');
}

// --- formatRanking: since インライン注釈 ---

// 60. 最新ゲーム日と異なるユーザーに注釈
{
    const day24 = getGameDayStart(parseGameDate('2/24', 2026)!);
    const day25 = getGameDayStart(parseGameDate('2/25', 2026)!);
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(7).fill(1), gameDay: day25 },
        { rank: 2, displayName: '乙', totalGems: 2400, rolls: new Array(6).fill(2), gameDay: day24 },
    ];
    const out = formatRanking(entries, 'all', undefined, sinceDate, false, true);
    // 甲（最新日）に注釈なし
    const line甲 = out.split('\n').find(l => l.includes('甲'))!;
    assertNotIncludes(line甲, '※', '60a. 甲（最新日）に注釈なし');
    // 乙に注釈あり
    assertIncludes(out, '※2/24', '60b. 乙に※2/24');
    assertIncludes(out, '集計対象6回', '60c. 乙に集計対象6回');
}

// 61. 全員最新日 → 注釈なし
{
    const day25 = getGameDayStart(parseGameDate('2/25', 2026)!);
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(6).fill(1), gameDay: day25 },
        { rank: 2, displayName: '乙', totalGems: 3000, rolls: new Array(6).fill(2), gameDay: day25 },
    ];
    const out = formatRanking(entries, 'all', undefined, sinceDate, false, true);
    assertNotIncludes(out, '※', '61. 全員最新日 → 注釈なし');
}

// 62. gameDay undefined → 注釈なし（後方互換）
{
    const day25 = getGameDayStart(parseGameDate('2/25', 2026)!);
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(6).fill(1), gameDay: day25 },
        { rank: 2, displayName: '乙', totalGems: 3000, rolls: new Array(6).fill(2) },
    ];
    const out = formatRanking(entries, 'all', undefined, sinceDate, false, true);
    const line乙 = out.split('\n').find(l => l.includes('乙'))!;
    assertNotIncludes(line乙, '※', '62. gameDay undefined → 注釈なし');
}

// 63. since + detail → 内訳と注釈が両方表示
{
    const day24 = getGameDayStart(parseGameDate('2/24', 2026)!);
    const day25 = getGameDayStart(parseGameDate('2/25', 2026)!);
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: [1,1,1,1,1,1,1], gameDay: day25 },
        { rank: 2, displayName: '乙', totalGems: 2400, rolls: [2,2,2,2,2,2], gameDay: day24 },
    ];
    const out = formatRanking(entries, 'all', undefined, sinceDate, true, true);
    assertIncludes(out, '①', '63a. 内訳が表示');
    assertIncludes(out, '※2/24', '63b. 注釈も表示');
}

// 64. since + bottom → ワーストでも注釈
{
    const day24 = getGameDayStart(parseGameDate('2/24', 2026)!);
    const day25 = getGameDayStart(parseGameDate('2/25', 2026)!);
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(7).fill(1), gameDay: day25 },
        { rank: 2, displayName: '乙', totalGems: 2400, rolls: new Array(6).fill(2), gameDay: day24 },
    ];
    const out = formatRanking(entries, 'bottom', 1, sinceDate, false, true);
    assertIncludes(out, '※2/24', '64. bottom + since でも注釈');
}

// 65. 集計対象N回 = rolls.length
{
    const day24 = getGameDayStart(parseGameDate('2/24', 2026)!);
    const day25 = getGameDayStart(parseGameDate('2/25', 2026)!);
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 4000, rolls: new Array(8).fill(1), gameDay: day25 },
        { rank: 2, displayName: '乙', totalGems: 1500, rolls: new Array(5).fill(3), gameDay: day24 },
    ];
    const out = formatRanking(entries, 'all', undefined, sinceDate, false, true);
    assertIncludes(out, '集計対象5回', '65. 集計対象5回 (rolls.length=5)');
}

// --- formatRanking: since フッター抑制 ---

// 66. sinceMode=true → detectDaysMismatch フッターなし
{
    const day25 = getGameDayStart(parseGameDate('2/25', 2026)!);
    const day24 = getGameDayStart(parseGameDate('2/24', 2026)!);
    const sinceDate = getGameDayStart(parseGameDate('2/20', 2026)!);
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(7).fill(1), gameDay: day25 },
        { rank: 2, displayName: '乙', totalGems: 2400, rolls: new Array(6).fill(2), gameDay: day24 },
    ];
    const out = formatRanking(entries, 'all', undefined, sinceDate, false, true);
    assertNotIncludes(out, '⚠️', '66. sinceMode → フッター警告なし');
}

// 67. sinceMode=false → 従来通りフッター表示（後方互換）
{
    const entries: import('./landsol-cup').RankingEntry[] = [
        { rank: 1, displayName: '甲', totalGems: 3500, rolls: new Array(10).fill(1) },
        { rank: 2, displayName: '乙', totalGems: 2700, rolls: new Array(9).fill(3) },
    ];
    const out = formatRanking(entries, 'all', undefined, testDate);
    assertIncludes(out, '⚠️', '67. sinceMode なし → 従来通りフッター表示');
}

// 68. parseGameDate で since 日付パース可能（既存機能確認）
{
    const d = parseGameDate('2/20', 2026);
    assert(d !== null, '68. parseGameDate で since 日付パース可能');
}
