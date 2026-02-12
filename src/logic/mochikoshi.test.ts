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
// 2人: damages=[30000, 25000] → 2通り（carryoverSec降順ソート）
{
    const results = generateAllCombinations(50000, [30000, 25000]);
    assertEqual(results.length, 2, '全組み合わせ(2人): 2通り');
    // 1番目: 〆=25000, participants=[30000], co=38
    assertEqual(results[0].last.damage, 25000, '全組み合わせ(2人): 1番目の〆は25000');
    assertEqual(results[0].carryoverSec, 38, '全組み合わせ(2人): 1番目は38秒');
    assertEqual(results[0].fullCarryoverDmg, '85714.3', '全組み合わせ(2人): 1番目のフル持ち越しDMG');
    assertEqual(results[0].participants.length, 1, '全組み合わせ(2人): 1番目の参加者1人');
    assertEqual(results[0].participants[0].damage, 30000, '全組み合わせ(2人): 1番目の参加者30000');
    assertEqual(results[0].nonParticipants.length, 0, '全組み合わせ(2人): 1番目の不参加者0人');
    // 2番目: 〆=30000, participants=[25000], co=35
    assertEqual(results[1].last.damage, 30000, '全組み合わせ(2人): 2番目の〆は30000');
    assertEqual(results[1].carryoverSec, 35, '全組み合わせ(2人): 2番目は35秒');
    assertEqual(results[1].fullCarryoverDmg, '107142.9', '全組み合わせ(2人): 2番目のフル持ち越しDMG');
}

// 3人: damages=[35000, 30000, 25000] → 全員参加のみ有効（3通り）
{
    const results = generateAllCombinations(80000, [35000, 30000, 25000]);
    assertEqual(results.length, 3, '全組み合わせ(3人): 3通り');
    assertEqual(results[0].last.damage, 25000, '全組み合わせ(3人): 1番目の〆は25000');
    assertEqual(results[0].carryoverSec, 56, '全組み合わせ(3人): 1番目は56秒');
    assertEqual(results[1].last.damage, 30000, '全組み合わせ(3人): 2番目の〆は30000');
    assertEqual(results[1].carryoverSec, 50, '全組み合わせ(3人): 2番目は50秒');
    assertEqual(results[2].last.damage, 35000, '全組み合わせ(3人): 3番目の〆は35000');
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

// --- 出力フォーマット（ランキング形式） ---
{
    const output = formatMochiResult(50000, [30000, 25000]);
    const lines = output.split('\n');
    assertEqual(lines[0], '👾 敵の残りHP: 50000  (2通り)', 'フォーマット: 1行目はHP＋通り数');
    assertEqual(lines[1], '', 'フォーマット: 2行目は空行');
    // 1位: 〆=25000
    assertEqual(lines[2], '📌 1位', 'フォーマット: 1位ヘッダ');
    assertEqual(lines[3], '  30000 → (〆) 25000', 'フォーマット: 1位の順序');
    assertEqual(lines[4], '  ⏰ 38秒 ｜ ⚡85714.3万 ｜ [2人全員参加]', 'フォーマット: 1位の結果+参加情報');
    assertEqual(lines[5], '', 'フォーマット: パターン間の空行');
    // 2位: 〆=30000
    assertEqual(lines[6], '📌 2位', 'フォーマット: 2位ヘッダ');
    assertEqual(lines[7], '  25000 → (〆) 30000', 'フォーマット: 2位の順序');
    assertEqual(lines[8], '  ⏰ 35秒 ｜ ⚡107142.9万 ｜ [2人全員参加]', 'フォーマット: 2位の結果+参加情報');
}

// --- エッジケース ---
// 数値が2つだけ（HP + ダメージ1つ）→ パース失敗（最低2人必要）
assertEqual(parseMochiMessage('@mochi 50000 30000'), null, 'パース: ダメージ1人 → null（最低2人必要）');

// 数値以外が混ざっている → パース失敗
assertEqual(parseMochiMessage('@mochi abc 30000 25000'), null, 'パース: 数値以外 → null');

// 無効パターン除外: 全サブセット列挙により有効な組み合わせのみ表示
{
    const output = formatMochiResult(50000, [30000, 25000, 10000]);
    // 〆=10000(3人全員)は無効→除外、有効なサブセットのみ表示
    assertEqual(output.includes('⚠️無効'), false, 'サブセット: 無効パターンは出力に含まれない');
    assertEqual(output.includes('(4通り)'), true, 'サブセット: 有効な4通りが表示');
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

// === -mochi プレフィックス対応テスト ===
console.log('\n=== -mochi プレフィックステスト ===');

// -mochi で通常パースが動作する
{
    const parsed = parseMochiMessage('-mochi 5 3 2.5');
    assertEqual(parsed!.bossHp, 50000, '-mochi: 5 → 50000');
    assertEqual(parsed!.damages[0], 30000, '-mochi: 3 → 30000');
    assertEqual(parsed!.damages[1], 25000, '-mochi: 2.5 → 25000');
}

// -mochi! で生モードが動作する
{
    const parsed = parseMochiMessage('-mochi! 50000 30000 25000');
    assertEqual(parsed!.bossHp, 50000, '-mochi!: 生モード動作');
    assertEqual(parsed!.damages[0], 30000, '-mochi!: damages[0]=30000');
}

// === @mo / -mo 短縮プレフィックス対応テスト ===
console.log('\n=== @mo/-mo 短縮プレフィックステスト ===');

// @mo で通常パースが動作する
{
    const parsed = parseMochiMessage('@mo 5 3 2.5');
    assertEqual(parsed!.bossHp, 50000, '@mo: 5 → 50000');
    assertEqual(parsed!.damages[0], 30000, '@mo: 3 → 30000');
    assertEqual(parsed!.damages[1], 25000, '@mo: 2.5 → 25000');
}

// -mo で通常パースが動作する
{
    const parsed = parseMochiMessage('-mo 5 3 2.5');
    assertEqual(parsed!.bossHp, 50000, '-mo: 5 → 50000');
    assertEqual(parsed!.damages[0], 30000, '-mo: 3 → 30000');
}

// @mo! で生モードが動作する
{
    const parsed = parseMochiMessage('@mo! 50000 30000 25000');
    assertEqual(parsed!.bossHp, 50000, '@mo!: 生モード動作');
    assertEqual(parsed!.damages[0], 30000, '@mo!: damages[0]=30000');
}

// @morning → mochiとして誤検出しない
assertEqual(parseMochiMessage('@morning 5 3 2.5'), null, '@morning: mochiとして誤検出しない');

// === ラベル対応テスト ===
console.log('\n=== ラベル対応テスト ===');

// テスト1: ラベル付きパース
{
    const parsed = parseMochiMessage('@mochi 5 3:Alice 2.5:Bob');
    assertEqual(parsed!.bossHp, 50000, 'ラベル付き: bossHp=50000');
    assertEqual(parsed!.damages[0], 30000, 'ラベル付き: damages[0]=30000');
    assertEqual(parsed!.damages[1], 25000, 'ラベル付き: damages[1]=25000');
    assertEqual(parsed!.labels[0], 'Alice', 'ラベル付き: labels[0]=Alice');
    assertEqual(parsed!.labels[1], 'Bob', 'ラベル付き: labels[1]=Bob');
}

// テスト2: 混在（一部のみラベル）
{
    const parsed = parseMochiMessage('@mochi 5 3:Alice 2.5');
    assertEqual(parsed!.damages[0], 30000, '混在: damages[0]=30000');
    assertEqual(parsed!.damages[1], 25000, '混在: damages[1]=25000');
    assertEqual(parsed!.labels[0], 'Alice', '混在: labels[0]=Alice');
    assertEqual(parsed!.labels[1], undefined, '混在: labels[1]=undefined');
}

// テスト3: ラベルなし（後方互換）
{
    const parsed = parseMochiMessage('@mochi 5 3 2.5');
    assertEqual(parsed!.labels[0], undefined, '後方互換: labels[0]=undefined');
    assertEqual(parsed!.labels[1], undefined, '後方互換: labels[1]=undefined');
}

// テスト4: Discordメンション風
{
    const parsed = parseMochiMessage('@mochi 5 3:<@111> 2.5:<@222>');
    assertEqual(parsed!.damages[0], 30000, 'メンション: damages[0]=30000');
    assertEqual(parsed!.labels[0], '<@111>', 'メンション: labels[0]=<@111>');
    assertEqual(parsed!.labels[1], '<@222>', 'メンション: labels[1]=<@222>');
}

// テスト5: 生モード+ラベル
{
    const parsed = parseMochiMessage('@mochi! 50000 30000:Alice 25000:Bob');
    assertEqual(parsed!.bossHp, 50000, '生モード+ラベル: bossHp=50000');
    assertEqual(parsed!.damages[0], 30000, '生モード+ラベル: damages[0]=30000（変換なし）');
    assertEqual(parsed!.labels[0], 'Alice', '生モード+ラベル: labels[0]=Alice');
    assertEqual(parsed!.labels[1], 'Bob', '生モード+ラベル: labels[1]=Bob');
}

// テスト6: 3人+ラベル
{
    const parsed = parseMochiMessage('@mochi 8 3.5:甲 3:乙 2.5:丙');
    assertEqual(parsed!.damages.length, 3, '3人ラベル: damages 3個');
    assertEqual(parsed!.labels[0], '甲', '3人ラベル: labels[0]=甲');
    assertEqual(parsed!.labels[1], '乙', '3人ラベル: labels[1]=乙');
    assertEqual(parsed!.labels[2], '丙', '3人ラベル: labels[2]=丙');
}

// テスト10: generateAllCombinations labels付き
{
    const results = generateAllCombinations(50000, [30000, 25000], ['Alice', 'Bob']);
    // 1番目: 〆=Bob(25000), participants=[Alice(30000)]
    assertEqual(results[0].last.label, 'Bob', 'combi labels: 1番目の〆ラベル=Bob');
    assertEqual(results[0].participants[0].label, 'Alice', 'combi labels: 1番目の参加者ラベル=Alice');
    // 2番目: 〆=Alice(30000), participants=[Bob(25000)]
    assertEqual(results[1].last.label, 'Alice', 'combi labels: 2番目の〆ラベル=Alice');
    assertEqual(results[1].participants[0].label, 'Bob', 'combi labels: 2番目の参加者ラベル=Bob');
}

// テスト11: generateAllCombinations labels省略（後方互換）
{
    const results = generateAllCombinations(50000, [30000, 25000]);
    assertEqual(results[0].last.label, undefined, 'combi 省略: last.label=undefined');
    assertEqual(results[0].participants[0].label, undefined, 'combi 省略: participants[0].label=undefined');
}

// テスト7: ラベル付きフォーマット
{
    const output = formatMochiResult(50000, [30000, 25000], ['Alice', 'Bob']);
    const lines = output.split('\n');
    // ヘッダにラベル〆表示
    assertEqual(lines[2], '📌 1位 ― Bob〆', 'ラベルfmt: 1位ヘッダにBob〆');
    // 順序行にラベル表示
    assertEqual(lines[3], '  Alice 30000 → Bob(〆) 25000', 'ラベルfmt: 1位順序');
    // 2位
    assertEqual(lines[6], '📌 2位 ― Alice〆', 'ラベルfmt: 2位ヘッダにAlice〆');
    assertEqual(lines[7], '  Bob 25000 → Alice(〆) 30000', 'ラベルfmt: 2位順序');
}

// テスト8: ラベルなしフォーマット（後方互換）
{
    const output = formatMochiResult(50000, [30000, 25000]);
    const lines = output.split('\n');
    assertEqual(lines[2], '📌 1位', 'ラベルなしfmt: 1位ヘッダ（〆なし）');
    assertEqual(lines[3], '  30000 → (〆) 25000', 'ラベルなしfmt: 1位順序');
}

// テスト9: 混在ラベルフォーマット
{
    const output = formatMochiResult(50000, [30000, 25000], ['Alice', undefined]);
    const lines = output.split('\n');
    // 1位: 〆=undefinedなのでヘッダに〆なし
    assertEqual(lines[2], '📌 1位', '混在fmt: 1位ヘッダ（〆ラベルなし）');
    assertEqual(lines[3], '  Alice 30000 → (〆) 25000', '混在fmt: 1位順序');
    // 2位: 〆=Aliceなのでヘッダに〆あり
    assertEqual(lines[6], '📌 2位 ― Alice〆', '混在fmt: 2位ヘッダにAlice〆');
    assertEqual(lines[7], '  25000 → Alice(〆) 30000', '混在fmt: 2位順序');
}

// === 持ち越しマーカー対応テスト ===
console.log('\n=== 持ち越しマーカー対応テスト ===');

// C1: * マーカー付き数値（コロンなし）
{
    const parsed = parseMochiMessage('@mochi 5 3 2.8*');
    assertEqual(parsed !== null, true, 'C1: パース成功');
    assertEqual(parsed!.damages[1], 28000, 'C1: 2.8* → 28000');
    assertEqual(parsed!.carryovers[0], false, 'C1: carryovers[0]=false');
    assertEqual(parsed!.carryovers[1], true, 'C1: carryovers[1]=true');
}

// C2: 💼 マーカー付き数値（コロンなし）
{
    const parsed = parseMochiMessage('@mochi 5 3 2.8💼');
    assertEqual(parsed !== null, true, 'C2: パース成功');
    assertEqual(parsed!.damages[1], 28000, 'C2: 2.8💼 → 28000');
    assertEqual(parsed!.carryovers[1], true, 'C2: carryovers[1]=true');
}

// C3: LABEL:NUMBER* パターン
{
    const parsed = parseMochiMessage('@mochi 5 Alice:3 Bob:2.8*');
    assertEqual(parsed !== null, true, 'C3: パース成功');
    assertEqual(parsed!.damages[1], 28000, 'C3: Bob:2.8* → 28000');
    assertEqual(parsed!.labels[1], 'Bob', 'C3: labels[1]=Bob');
    assertEqual(parsed!.carryovers[0], false, 'C3: carryovers[0]=false');
    assertEqual(parsed!.carryovers[1], true, 'C3: carryovers[1]=true');
}

// C4: NUMBER*:LABEL パターン
{
    const parsed = parseMochiMessage('@mochi 5 3:Alice 2.8*:Bob');
    assertEqual(parsed !== null, true, 'C4: パース成功');
    assertEqual(parsed!.damages[1], 28000, 'C4: 2.8*:Bob → 28000');
    assertEqual(parsed!.labels[1], 'Bob', 'C4: labels[1]=Bob');
    assertEqual(parsed!.carryovers[1], true, 'C4: carryovers[1]=true');
}

// C5: マーカーなし → carryovers全false（後方互換）
{
    const parsed = parseMochiMessage('@mochi 5 3 2.5');
    assertEqual(parsed!.carryovers[0], false, 'C5: carryovers[0]=false');
    assertEqual(parsed!.carryovers[1], false, 'C5: carryovers[1]=false');
}

// C6: 複数人のうち1人だけマーカー
{
    const parsed = parseMochiMessage('@mochi 5.6 ゆりちゃん:3.0 キルヒアイス:2.8* ジルグ:1.7 いちにの:0.5');
    assertEqual(parsed !== null, true, 'C6: パース成功');
    assertEqual(parsed!.carryovers[0], false, 'C6: ゆりちゃん=false');
    assertEqual(parsed!.carryovers[1], true, 'C6: キルヒアイス=true');
    assertEqual(parsed!.carryovers[2], false, 'C6: ジルグ=false');
    assertEqual(parsed!.carryovers[3], false, 'C6: いちにの=false');
}

// === LABEL:NUMBER 逆順フォーマット対応テスト ===
console.log('\n=== LABEL:NUMBER 逆順フォーマットテスト ===');

// 逆順: ラベル:数値（Discordメンション風）
{
    const parsed = parseMochiMessage('@mochi 5 <@111>:3 <@222>:2.5');
    assertEqual(parsed!.damages[0], 30000, '逆順メンション: damages[0]=30000');
    assertEqual(parsed!.damages[1], 25000, '逆順メンション: damages[1]=25000');
    assertEqual(parsed!.labels[0], '<@111>', '逆順メンション: labels[0]=<@111>');
    assertEqual(parsed!.labels[1], '<@222>', '逆順メンション: labels[1]=<@222>');
}

// 逆順: プレーンテキスト
{
    const parsed = parseMochiMessage('@mochi 5 Alice:3 Bob:2.5');
    assertEqual(parsed!.damages[0], 30000, '逆順テキスト: damages[0]=30000');
    assertEqual(parsed!.labels[0], 'Alice', '逆順テキスト: labels[0]=Alice');
    assertEqual(parsed!.labels[1], 'Bob', '逆順テキスト: labels[1]=Bob');
}

// 逆順と正順の混在
{
    const parsed = parseMochiMessage('@mochi 5 <@111>:3 2.5:Bob');
    assertEqual(parsed!.damages[0], 30000, '逆正混在: damages[0]=30000');
    assertEqual(parsed!.damages[1], 25000, '逆正混在: damages[1]=25000');
    assertEqual(parsed!.labels[0], '<@111>', '逆正混在: labels[0]=<@111>');
    assertEqual(parsed!.labels[1], 'Bob', '逆正混在: labels[1]=Bob');
}

// 逆順 + 生モード
{
    const parsed = parseMochiMessage('@mochi! 50000 Alice:30000 Bob:25000');
    assertEqual(parsed!.damages[0], 30000, '逆順生モード: damages[0]=30000');
    assertEqual(parsed!.labels[0], 'Alice', '逆順生モード: labels[0]=Alice');
}

// === 持ち越しメンバー〆除外テスト ===
console.log('\n=== 持ち越しメンバー〆除外テスト ===');

// D1: carryoverメンバー(index=1, 28000)が〆から除外される
{
    // 元は8通り。index=1(28000)が〆の4通りが除外→残り4通り
    const results = generateAllCombinations(
        56000, [30000, 28000, 17000, 5000],
        ['ゆりちゃん', 'キルヒアイス', 'ジルグ', 'いちにの'],
        [false, true, false, false]
    );
    assertEqual(results.length, 4, 'D1: キルヒアイス〆除外→4通り');
    // 全結果でキルヒアイスが〆でないことを確認
    for (let i = 0; i < results.length; i++) {
        assertEqual(results[i].last.label !== 'キルヒアイス', true, `D1: ${i+1}位の〆はキルヒアイスでない`);
    }
}

// D2: carryoversなし（後方互換）→ 元通り8通り
{
    const results = generateAllCombinations(
        56000, [30000, 28000, 17000, 5000],
        ['ゆりちゃん', 'キルヒアイス', 'ジルグ', 'いちにの']
    );
    assertEqual(results.length, 8, 'D2: carryoversなし→8通り（後方互換）');
}

// D3: 2人中1人がcarryover → その人は〆にならない（1通りのみ）
{
    const results = generateAllCombinations(
        50000, [30000, 25000],
        ['甲', '乙'],
        [true, false]
    );
    assertEqual(results.length, 1, 'D3: 甲がcarryover→乙〆のみ');
    assertEqual(results[0].last.label, '乙', 'D3: 〆は乙');
}

// === 💼出力表示テスト ===
console.log('\n=== 💼出力表示テスト ===');

// F1: carryoverメンバーのダメージに💼が付く
{
    const output = formatMochiResult(
        50000, [30000, 25000],
        ['甲', '乙'],
        [true, false]
    );
    const lines = output.split('\n');
    // 甲がcarryover → 甲のダメージに💼、乙が〆（甲は〆不可）
    assertEqual(lines[2], '📌 1位 ― 乙〆', 'F1: 乙〆のみ');
    assertEqual(lines[3], '  甲💼 30000 → 乙(〆) 25000', 'F1: 甲に💼表示');
}

// F2: carryoverなし（後方互換）→ 💼なし
{
    const output = formatMochiResult(50000, [30000, 25000], ['甲', '乙']);
    assertEqual(output.includes('💼'), false, 'F2: carryoverなし→💼なし');
}

// F3: ラベルなしcarryover → ダメージの後に💼
{
    const output = formatMochiResult(
        50000, [30000, 25000],
        [undefined, undefined],
        [true, false]
    );
    const lines = output.split('\n');
    assertEqual(lines[3], '  30000💼 → (〆) 25000', 'F3: ラベルなしcarryover→30000💼');
}

// === サブセット列挙テスト ===
console.log('\n=== サブセット列挙テスト ===');

// A4: 4人具体例（boss=56000, [30000,28000,17000,5000]）→ 8通り
{
    const results = generateAllCombinations(56000, [30000, 28000, 17000, 5000]);
    assertEqual(results.length, 8, 'A4: 4人入力→8通り');
    // 1位: co=90, 4人全員, 〆=30000(A)（90秒同率→〆ダメージ降順）
    assertEqual(results[0].carryoverSec, 90, 'A4: 1位は90秒');
    assertEqual(results[0].last.damage, 30000, 'A4: 1位の〆は30000（高ダメージ〆優先）');
    assertEqual(results[0].participants.length, 3, 'A4: 1位の参加者3人');
    assertEqual(results[0].nonParticipants.length, 0, 'A4: 1位は不参加者なし');
    // 2位: co=90, 4人全員, 〆=28000(B)
    assertEqual(results[1].carryoverSec, 90, 'A4: 2位も90秒');
    assertEqual(results[1].last.damage, 28000, 'A4: 2位の〆は28000');
    // 3位: co=82, 3人{A,B,C}, 〆=28000(B), rem=9000
    assertEqual(results[2].carryoverSec, 82, 'A4: 3位は82秒');
    assertEqual(results[2].nonParticipants.length, 1, 'A4: 3位の不参加者1人');
    assertEqual(results[2].nonParticipants[0].damage, 5000, 'A4: 3位の不参加者はD(5000)');
    // 8位(最下位): co=26, 2人{A,B}, 〆=30000(A), rem=28000
    assertEqual(results[7].carryoverSec, 26, 'A4: 8位は26秒');
    assertEqual(results[7].last.damage, 30000, 'A4: 8位の〆は30000');
    assertEqual(results[7].participants.length, 1, 'A4: 8位の参加者1人');
    assertEqual(results[7].nonParticipants.length, 2, 'A4: 8位の不参加者2人');
}

// A7: 全組み合わせ無効 → 空配列
{
    const results = generateAllCombinations(100000, [20000, 10000]);
    assertEqual(results.length, 0, 'A7: 全無効→空配列');
}

// === ランキング出力テスト ===
console.log('\n=== ランキング出力テスト ===');

// B2: 4人入力→不参加者表示
{
    const output = formatMochiResult(56000, [30000, 28000, 17000, 5000], ['A', 'B', 'C', 'D']);
    assertEqual(output.includes('(8通り)'), true, 'B2: 8通り表示');
    assertEqual(output.includes('📌 1位 ― A〆'), true, 'B2: 1位はA〆（90秒同率→高ダメージ〆優先）');
    assertEqual(output.includes('[4人全員参加]'), true, 'B2: 全員参加パターンあり');
    assertEqual(output.includes('⚠️不参加:'), true, 'B2: 不参加者表示あり');
}

// B5: 10件超→「…他 N 通り」表示
{
    const output = formatMochiResult(10000, [9000, 8000, 7000, 6000, 5000]);
    assertEqual(output.includes('(20通り)'), true, 'B5: 20通り表示');
    assertEqual(output.includes('…他'), true, 'B5: 省略表示あり');
}

// B6: 全組み合わせ無効→エラーメッセージ
{
    const output = formatMochiResult(100000, [20000, 10000]);
    assertEqual(output.includes('⚠️ 有効な組み合わせがありません。'), true, 'B6: 全無効メッセージ');
}

// B7: 11人入力→エラーメッセージ
assertEqual(
    formatMochiResult(50000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    '⚠️ ダメージの入力は最大10人までです。',
    'B7: 11人入力はエラー'
);

// E1: 統合テスト（4人ラベル付きパース→フォーマット）
{
    const parsed = parseMochiMessage('@mochi 5.6 3:A 2.8:B 1.7:C 0.5:D');
    assertEqual(parsed !== null, true, 'E1: パース成功');
    const output = formatMochiResult(parsed!.bossHp, parsed!.damages, parsed!.labels);
    assertEqual(output.includes('(8通り)'), true, 'E1: 8通り');
    assertEqual(output.includes('📌 1位 ― A〆'), true, 'E1: 1位はA〆（90秒同率→高ダメージ〆優先）');
}

// === 持ち越しマーカー統合テスト ===
console.log('\n=== 持ち越しマーカー統合テスト ===');

// G1: ユーザーサンプル入力（キルヒアイスが持ち越し → キルヒアイス〆を除外）
{
    const parsed = parseMochiMessage('-mochi 5.6 ゆりちゃん:3.0 キルヒアイス:2.8* ジルグ:1.7 いちにの:0.5');
    assertEqual(parsed !== null, true, 'G1: パース成功');
    assertEqual(parsed!.carryovers[1], true, 'G1: キルヒアイス=carryover');
    const output = formatMochiResult(parsed!.bossHp, parsed!.damages, parsed!.labels, parsed!.carryovers);
    // 元は8通り、キルヒアイス〆4通り除外→4通り
    assertEqual(output.includes('(4通り)'), true, 'G1: 4通り');
    assertEqual(output.includes('キルヒアイス〆'), false, 'G1: キルヒアイス〆なし');
    assertEqual(output.includes('ゆりちゃん〆'), true, 'G1: ゆりちゃん〆あり');
    // キルヒアイスのダメージに💼が付く
    assertEqual(output.includes('キルヒアイス💼'), true, 'G1: キルヒアイス💼表示');
}

// G2: 💼マーカーでも同じ結果
{
    const parsed = parseMochiMessage('-mochi 5.6 ゆりちゃん:3.0 キルヒアイス:2.8💼 ジルグ:1.7 いちにの:0.5');
    assertEqual(parsed !== null, true, 'G2: 💼マーカーパース成功');
    assertEqual(parsed!.carryovers[1], true, 'G2: キルヒアイス=carryover');
    const output = formatMochiResult(parsed!.bossHp, parsed!.damages, parsed!.labels, parsed!.carryovers);
    assertEqual(output.includes('(4通り)'), true, 'G2: 4通り');
    assertEqual(output.includes('キルヒアイス〆'), false, 'G2: キルヒアイス〆なし');
}

// G3: マーカーなし → 従来通り8通り（後方互換）
{
    const parsed = parseMochiMessage('-mochi 5.6 ゆりちゃん:3.0 キルヒアイス:2.8 ジルグ:1.7 いちにの:0.5');
    const output = formatMochiResult(parsed!.bossHp, parsed!.damages, parsed!.labels, parsed!.carryovers);
    assertEqual(output.includes('(8通り)'), true, 'G3: マーカーなし→8通り');
    assertEqual(output.includes('💼'), false, 'G3: 💼なし');
}

// === 90秒同率時の〆ダメージ降順ソートテスト ===
console.log('\n=== 90秒同率時の〆ダメージ降順ソートテスト ===');

// H1: 2人とも90秒 → 〆ダメージが高い方が上位
{
    // boss=56000, ゆりちゃん:50000, キルヒアイス:48000
    // 〆=ゆりちゃん(50000): co=90, 〆=キルヒアイス(48000): co=90
    // 新ルール: 〆ダメージ降順 → ゆりちゃん〆(50000) が 1位
    const results = generateAllCombinations(56000, [50000, 48000], ['ゆりちゃん', 'キルヒアイス']);
    assertEqual(results.length, 2, 'H1: 2通り');
    assertEqual(results[0].carryoverSec, 90, 'H1: 1位は90秒');
    assertEqual(results[1].carryoverSec, 90, 'H1: 2位も90秒');
    assertEqual(results[0].last.label, 'ゆりちゃん', 'H1: 1位はゆりちゃん〆（ダメージ50000）');
    assertEqual(results[1].last.label, 'キルヒアイス', 'H1: 2位はキルヒアイス〆（ダメージ48000）');
}

// H2: 90秒でない同率 → 従来通り残りHP昇順（新ルール適用外）
{
    // boss=50000, damages=[30000, 25000]
    // 〆=25000: co=38, 〆=30000: co=35 → 同率ではないので影響なし
    const results = generateAllCombinations(50000, [30000, 25000]);
    assertEqual(results[0].last.damage, 25000, 'H2: 非90秒は従来通り（〆=25000が1位）');
    assertEqual(results[1].last.damage, 30000, 'H2: 非90秒は従来通り（〆=30000が2位）');
}

// H3: 統合テスト（ユーザー例: -mochi 5.6 ゆりちゃん:5.0 キルヒアイス:4.8）
{
    const parsed = parseMochiMessage('-mochi 5.6 ゆりちゃん:5.0 キルヒアイス:4.8');
    const output = formatMochiResult(parsed!.bossHp, parsed!.damages, parsed!.labels, parsed!.carryovers);
    assertEqual(output.includes('📌 1位 ― ゆりちゃん〆'), true, 'H3: 1位はゆりちゃん〆（ダメージ高い方）');
    assertEqual(output.includes('📌 2位 ― キルヒアイス〆'), true, 'H3: 2位はキルヒアイス〆');
}

// H4: 90秒が複数ある場合、情報行に「ℹ️〆ダメージ順」を表示
{
    const output = formatMochiResult(56000, [50000, 48000], ['ゆりちゃん', 'キルヒアイス']);
    const lines = output.split('\n');
    // 1位の情報行に表示
    assertEqual(lines[4].includes('ℹ️〆ダメージ順'), true, 'H4: 1位の情報行にℹ️〆ダメージ順');
    // 2位の情報行にも表示
    assertEqual(lines[8].includes('ℹ️〆ダメージ順'), true, 'H4: 2位の情報行にもℹ️〆ダメージ順');
}

// H5: 90秒が1つだけ → ℹ️〆ダメージ順は非表示
{
    // boss=56000, [30000,28000,17000,5000] → 1位のみ90秒、2位は82秒
    // ただしA4テストで1位も2位も90秒なので別のケースが必要
    // boss=50000, [30000,25000] → co=38,35 → どちらも90秒でない
    const output = formatMochiResult(50000, [30000, 25000]);
    assertEqual(output.includes('ℹ️〆ダメージ順'), false, 'H5: 90秒なし→ℹ️非表示');
}

// H6: 90秒が1つだけのケース → ℹ️非表示
{
    // boss=50000, [45000,30000] → 〆=30000: co=90, 〆=45000: co=30 → 90秒は1つだけ
    const output = formatMochiResult(50000, [45000, 30000]);
    assertEqual(output.includes('ℹ️〆ダメージ順'), false, 'H6: 90秒が1つだけ→ℹ️非表示');
}
