// src/logic/landsol-cup.test.ts
// ランドソル杯（ランキング）テスト

import { parseGachaRolls, computeTotalGems, buildRanking, formatRanking, getGameDayStart, detectDaysMismatch, GEMS_TABLE } from './landsol-cup';

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

// 20. 4人以上 → 4位以降はスペースインデント
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '🥇', '20a. 1位にメダル');
    assertNotIncludes(out, '🏅', '20b. 4位にメダルなし');
    // 4位の行が存在する
    assertIncludes(out, '4位', '20c. 4位の行がある');
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
    assertIncludes(out, '💀', '22d. ワースト1位に💀');
    assertIncludes(out, '🤡', '22e. ワースト2位に🤡');
    // ワーストN位ラベル
    assertIncludes(out, 'ワースト1位', '22f. ワースト1位ラベル');
    assertIncludes(out, 'ワースト2位', '22g. ワースト2位ラベル');
    // 逆順（最下位が先頭）
    const idx丁 = out.indexOf('丁');
    const idx甲 = out.indexOf('甲');
    assert(idx丁 < idx甲, '22h. 逆順: 丁（最下位）が甲より先');
    // 通常メダルは出ない
    assertNotIncludes(out, '🥇', '22i. 通常メダルは出ない');
}

// 22.5. mode='bottom', count=3 → 🫠がワースト3位に付く
{
    const out = formatRanking(testEntries, 'bottom', 3, testDate);
    assertIncludes(out, '🫠', '22.5a. ワースト3位に🫠');
    assertIncludes(out, 'ワースト3位', '22.5b. ワースト3位ラベル');
}

// 23. mode='all' → 全件
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '乙', '23a. allに1位');
    assertIncludes(out, '丁', '23b. allに4位');
}

// 24. 石数の💎フォーマット
{
    const out = formatRanking(testEntries, 'all', undefined, testDate);
    assertIncludes(out, '💎3,500', '24a. 💎+カンマ区切り');
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
