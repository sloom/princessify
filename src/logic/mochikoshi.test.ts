// src/logic/mochikoshi.test.ts
import { calcCarryoverTime, calcFullCarryoverDmg, generateAllCombinations, parseMochiMessage, formatMochiResult, normalizeToMan } from './mochikoshi';

// 簡易アサーション
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

// === テストリスト ===
// [x] 基本計算: 2人同時凸 (a=50000, b=[30000], x=25000) → 38秒
// [ ] 逆パターン: (a=50000, b=[25000], x=30000) → 35秒
// [ ] 上限90秒キャップ: (a=50000, b=[45000], x=25000) → 90秒
// [ ] 3人同時凸: (a=80000, b=[35000,30000], x=25000) → 56秒
// [ ] 下限: 持ち越し時間20秒以下 → 0秒
// [ ] フル持ち越し必要DMG計算
// [ ] 全組み合わせ生成 (2人・3人)
// [ ] メッセージパース
// [ ] 出力フォーマット
// [ ] 戦闘無効: 残りHPが他ダメージ合計以下
// [ ] 入力不正

console.log('=== 持ち越し時間計算テスト ===');

// --- 基本計算 ---
assertEqual(
    calcCarryoverTime(50000, [30000], 25000),
    38,
    '基本計算: a=50000, b=[30000], x=25000 → 38秒'
);

assertEqual(
    calcCarryoverTime(50000, [25000], 30000),
    35,
    '逆パターン: a=50000, b=[25000], x=30000 → 35秒'
);

// --- 上限・下限 ---
assertEqual(
    calcCarryoverTime(50000, [45000], 30000),
    90,
    '上限キャップ: 計算値95 → 90秒にキャップ（例2）'
);

// 残りHP = bossHp のケース（他ダメージなし相当 = rem/x = 1 → co=20 → 0に）
// a=50000, b=[], x=50000 → (1-50000/50000)*90+20=20 → 20以下なので0
assertEqual(
    calcCarryoverTime(50000, [], 50000),
    0,
    '下限: 持ち越し時間20秒ちょうど → 0秒'
);

// rem > x のケース: (1 - 40000/25000)*90+20 = -34+20 = -14 → 0
assertEqual(
    calcCarryoverTime(50000, [10000], 25000),
    0,
    '下限: 持ち越し時間がマイナス → 0秒'
);

// --- 3人同時凸 ---
// 例3: a=80000, b=[35000,30000], x=25000
// rem = 80000-35000-30000 = 15000
// (1 - 15000/25000)*90+20 = 0.4*90+20 = 36+20 = 56
assertEqual(
    calcCarryoverTime(80000, [35000, 30000], 25000),
    56,
    '3人同時凸: a=80000, b=[35000,30000], x=25000 → 56秒（例3）'
);

// --- フル持ち越し必要DMG ---
// rem = 50000-30000 = 20000, fullDmg = 20000 * 90 / 21 = 85714.285...
assertEqual(
    calcFullCarryoverDmg(20000),
    '85714.3',
    'フル持ち越し必要DMG: rem=20000 → 85714.3'
);

// rem = 50000-25000 = 25000, fullDmg = 25000 * 90 / 21 = 107142.857...
assertEqual(
    calcFullCarryoverDmg(25000),
    '107142.9',
    'フル持ち越し必要DMG: rem=25000 → 107142.9'
);

// --- 全組み合わせ生成 ---
// 2人: damages=[30000, 25000] → 〆が各人の2通り（入力末尾から順）
{
    const results = generateAllCombinations(50000, [30000, 25000]);
    assertEqual(results.length, 2, '全組み合わせ(2人): 2通り');
    // 1番目: others=[30000], 〆=25000, rem=20000, co=38
    assertEqual(results[0].lastDamage, 25000, '全組み合わせ(2人): 1番目の〆は25000');
    assertEqual(results[0].carryoverSec, 38, '全組み合わせ(2人): 1番目は38秒');
    assertEqual(results[0].fullCarryoverDmg, '85714.3', '全組み合わせ(2人): 1番目のフル持ち越しDMG');
    // 2番目: others=[25000], 〆=30000, rem=25000, co=35
    assertEqual(results[1].lastDamage, 30000, '全組み合わせ(2人): 2番目の〆は30000');
    assertEqual(results[1].carryoverSec, 35, '全組み合わせ(2人): 2番目は35秒');
    assertEqual(results[1].fullCarryoverDmg, '107142.9', '全組み合わせ(2人): 2番目のフル持ち越しDMG');
}

// 3人: damages=[35000, 30000, 25000] → 3通り
{
    const results = generateAllCombinations(80000, [35000, 30000, 25000]);
    assertEqual(results.length, 3, '全組み合わせ(3人): 3通り');
    // 〆=25000: others=[35000,30000], rem=15000, co=56
    assertEqual(results[0].lastDamage, 25000, '全組み合わせ(3人): 1番目の〆は25000');
    assertEqual(results[0].carryoverSec, 56, '全組み合わせ(3人): 1番目は56秒');
    // 〆=30000: others=[35000,25000], rem=20000, co=50
    assertEqual(results[1].lastDamage, 30000, '全組み合わせ(3人): 2番目の〆は30000');
    assertEqual(results[1].carryoverSec, 50, '全組み合わせ(3人): 2番目は50秒');
    // 〆=35000: others=[30000,25000], rem=25000, co=46
    assertEqual(results[2].lastDamage, 35000, '全組み合わせ(3人): 3番目の〆は35000');
    assertEqual(results[2].carryoverSec, 46, '全組み合わせ(3人): 3番目は46秒');
}

// --- メッセージパース ---
{
    const parsed = parseMochiMessage('@mochi 50000 30000 25000');
    assertEqual(parsed!.bossHp, 50000, 'パース: bossHp=50000');
    assertEqual(parsed!.damages.length, 2, 'パース: damages 2個');
    assertEqual(parsed!.damages[0], 30000, 'パース: damages[0]=30000');
    assertEqual(parsed!.damages[1], 25000, 'パース: damages[1]=25000');
}

// 3人入力
{
    const parsed = parseMochiMessage('@mochi 80000 35000 30000 25000');
    assertEqual(parsed!.bossHp, 80000, 'パース(3人): bossHp=80000');
    assertEqual(parsed!.damages.length, 3, 'パース(3人): damages 3個');
}

// @mochi を含まない → null
assertEqual(parseMochiMessage('hello world'), null, 'パース: @mochiなし → null');

// --- 出力フォーマット（案A: パターンヘッダ + 2行構成） ---
{
    const output = formatMochiResult(50000, [30000, 25000]);
    const lines = output.split('\n');
    assertEqual(lines[0], '🧮 敵の残りHP: 50000', 'フォーマット: 1行目はHP（絵文字付き）');
    assertEqual(lines[1], '', 'フォーマット: 2行目は空行');
    // パターン1: 〆=25000
    assertEqual(lines[2], '📌 パターン1 ― 〆: 25000', 'フォーマット: パターン1ヘッダ');
    assertEqual(lines[3], '  1人目 30000 → 2人目(〆) 25000', 'フォーマット: パターン1の順序');
    assertEqual(lines[4], '  ⏱ 持ち越し 38秒 ｜ フル持ち越し必要DMG: 85714.3 万', 'フォーマット: パターン1の結果');
    assertEqual(lines[5], '', 'フォーマット: パターン間の空行');
    // パターン2: 〆=30000
    assertEqual(lines[6], '📌 パターン2 ― 〆: 30000', 'フォーマット: パターン2ヘッダ');
    assertEqual(lines[7], '  1人目 25000 → 2人目(〆) 30000', 'フォーマット: パターン2の順序');
    assertEqual(lines[8], '  ⏱ 持ち越し 35秒 ｜ フル持ち越し必要DMG: 107142.9 万', 'フォーマット: パターン2の結果');
}

// --- エッジケース ---
// 数値が2つだけ（HP + ダメージ1つ）→ パース失敗（最低2人必要）
assertEqual(parseMochiMessage('@mochi 50000 30000'), null, 'パース: ダメージ1人 → null（最低2人必要）');

// 数値以外が混ざっている → パース失敗
assertEqual(parseMochiMessage('@mochi abc 30000 25000'), null, 'パース: 数値以外 → null');

// 戦闘無効: 他ダメージ合計 >= bossHp → formatで「戦闘無効」
{
    const output = formatMochiResult(50000, [30000, 25000, 10000]);
    // 〆=10000: rem = 50000-30000-25000 = -5000 → 戦闘無効
    // 〆=25000: rem = 50000-30000-10000 = 10000 → 有効
    // 〆=30000: rem = 50000-25000-10000 = 15000 → 有効
    const lines = output.split('\n');
    assertEqual(lines[0], '🧮 敵の残りHP: 50000', 'エッジ(戦闘無効): 1行目はHP');
    // 〆=10000のパターンヘッダを探す
    const headerIdx = lines.findIndex(l => l.includes('〆: 10000'));
    assertEqual(headerIdx >= 0, true, 'エッジ(戦闘無効): 〆=10000のパターンが存在');
    // ヘッダの2行後（結果行）が戦闘無効
    assertEqual(lines[headerIdx + 2].includes('戦闘無効'), true, 'エッジ(戦闘無効): 他ダメージ合計>=HPの組み合わせは戦闘無効');
}

// === 単位自動解釈テスト ===
console.log('\n=== 単位自動解釈テスト ===');

// --- normalizeToMan ---
// 小数点あり → 億 (×10000)
assertEqual(normalizeToMan(5.0), 50000, 'normalizeToMan: 5.0 → 50000（億→万）');
assertEqual(normalizeToMan(2.5), 25000, 'normalizeToMan: 2.5 → 25000（億→万）');
assertEqual(normalizeToMan(3.0), 30000, 'normalizeToMan: 3.0 → 30000（億→万）');
// 整数 < 1000 → 億 (×10000)
assertEqual(normalizeToMan(5), 50000, 'normalizeToMan: 5 → 50000（整数<1000は億）');
assertEqual(normalizeToMan(8), 80000, 'normalizeToMan: 8 → 80000（整数<1000は億）');
assertEqual(normalizeToMan(999), 9990000, 'normalizeToMan: 999 → 9990000（境界: <1000は億）');
// 整数 >= 1000 → 万 (そのまま)
assertEqual(normalizeToMan(1000), 1000, 'normalizeToMan: 1000 → 1000（>=1000は万）');
assertEqual(normalizeToMan(50000), 50000, 'normalizeToMan: 50000 → 50000（万そのまま）');
assertEqual(normalizeToMan(25000), 25000, 'normalizeToMan: 25000 → 25000（万そのまま）');

// --- parseMochiMessage: 億入力・混在入力 ---
// 全部億表記
{
    const parsed = parseMochiMessage('@mochi 5 3 2.5');
    assertEqual(parsed!.bossHp, 50000, 'パース(億): 5 → 50000');
    assertEqual(parsed!.damages[0], 30000, 'パース(億): 3 → 30000');
    assertEqual(parsed!.damages[1], 25000, 'パース(億): 2.5 → 25000');
}

// 混在: HP万 + ダメージ億
{
    const parsed = parseMochiMessage('@mochi 50000 3.0 2.5');
    assertEqual(parsed!.bossHp, 50000, 'パース(混在1): 50000 → 50000');
    assertEqual(parsed!.damages[0], 30000, 'パース(混在1): 3.0 → 30000');
    assertEqual(parsed!.damages[1], 25000, 'パース(混在1): 2.5 → 25000');
}

// 混在: HP億 + ダメージ万 + ダメージ億
{
    const parsed = parseMochiMessage('@mochi 5.0 30000 2.5');
    assertEqual(parsed!.bossHp, 50000, 'パース(混在2): 5.0 → 50000');
    assertEqual(parsed!.damages[0], 30000, 'パース(混在2): 30000 → 30000');
    assertEqual(parsed!.damages[1], 25000, 'パース(混在2): 2.5 → 25000');
}

// --- @mochi! 生モード ---
{
    const parsed = parseMochiMessage('@mochi! 5 3 2.5');
    assertEqual(parsed!.bossHp, 5, '生モード: 5 → 5（変換なし）');
    assertEqual(parsed!.damages[0], 3, '生モード: 3 → 3（変換なし）');
    assertEqual(parsed!.damages[1], 2.5, '生モード: 2.5 → 2.5（変換なし）');
}

// 生モードでも従来の万入力はそのまま
{
    const parsed = parseMochiMessage('@mochi! 50000 30000 25000');
    assertEqual(parsed!.bossHp, 50000, '生モード(万): 50000 → 50000');
    assertEqual(parsed!.damages[0], 30000, '生モード(万): 30000 → 30000');
}
