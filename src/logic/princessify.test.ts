// src/logic/princessify.test.ts
import { Princessify, detectAutoState, renderAutoState } from './princessify';

// 簡易アサーション
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertIncludes(actual: string, expected: string, message: string) {
    if (!actual.includes(expected)) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected to include: "${expected}"`);
        console.error(`   Actual: "${actual}"`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertNotIncludes(actual: string, expected: string, message: string) {
    if (actual.includes(expected)) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected NOT to include: "${expected}"`);
        console.error(`   Actual: "${actual}"`);
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

// --- テストケース ---

console.log('\n=== ユーザー入力を正とするテスト ===\n');

const tool = new Princessify();

// ユーザーが既存のお団子で状態を指定している入力
// ◯→ーになった場合は❌を出力すべき
const input = `
@dango A B C D E

1:30 開始 [◯ー◯◯ー]
1:20 C [◯ー◯ーー]
1:10 A [ーー◯ーー]
`;

const result = tool.convert(input);
console.log('--- 変換結果 ---');
console.log(result);
console.log('--- テスト ---');

// 1:30 開始行: 初期状態 [◯ー◯◯ー] → そのまま維持
assertIncludes(result, '1:30 開始 [〇ー〇〇ー]', '開始行は初期状態として維持される');

// 1:20 C: [◯ー◯◯ー] → [◯ー◯ーー]
// D(index 3)が◯→ーなので❌になるべき
assertIncludes(result, '1:20 C [〇ー〇❌ー]', '◯→ーは❌になる');

// 1:10 A: [◯ー◯ーー] → [ーー◯ーー]
// A(index 0)が◯→ーなので❌になるべき
assertIncludes(result, '1:10 A [❌ー〇ーー]', '◯→ーは❌になる（2行目）');

console.log('\n=== 状態維持テスト ===\n');

const tool2 = new Princessify();

// ー→◯になった場合は⭕を出力すべき
const input2 = `
@dango A B C D E

1:30 開始 [ーーーーー]
1:20 A [◯ーーーー]
1:10 B [◯◯ーーー]
`;

const result2 = tool2.convert(input2);
console.log('--- 変換結果 ---');
console.log(result2);
console.log('--- テスト ---');

// 1:20 A: ー→◯ なので⭕
assertIncludes(result2, '1:20 A [⭕ーーーー]', 'ー→◯は⭕になる');

// 1:10 B: A維持(〇)、B追加(⭕)
assertIncludes(result2, '1:10 B [〇⭕ーーー]', '維持は〇、追加は⭕');

console.log('\n=== 入力揺らぎ対応テスト ===\n');

const tool3 = new Princessify();

// OFF状態の揺らぎ: x, X, ✕, -, ‐ などを認識
const input3 = `
@dango A B C D E

1:30 開始 [OxX✕-]
1:20 A [O-X✕x]
`;

const result3 = tool3.convert(input3);
console.log('--- 変換結果（OFF揺らぎ） ---');
console.log(result3);
console.log('--- テスト ---');

// 初期状態: O=〇, x=ー, X=ー, ✕=ー, -=ー → [〇ーーーー]
assertIncludes(result3, '1:30 開始 [〇ーーーー]', 'OFF状態の揺らぎ（x,X,✕,-）が正規化される');

// 2行目: 変化なし → [〇ーーーー]
assertIncludes(result3, '1:20 A [〇ーーーー]', '2行目も正規化される');

console.log('\n=== 括弧の揺らぎ対応テスト ===\n');

const tool4 = new Princessify();

// 括弧の揺らぎ: 【】 → [] に統一
const input4 = `
@dango A B C D E

1:30 開始 【〇ーーーー】
1:20 A 【〇〇ーーー】
`;

const result4 = tool4.convert(input4);
console.log('--- 変換結果（括弧揺らぎ） ---');
console.log(result4);
console.log('--- テスト ---');

// 括弧が[]に統一される
assertIncludes(result4, '1:30 開始 [〇ーーーー]', '【】が[]に統一される（初期行）');
assertIncludes(result4, '1:20 A [〇⭕ーーー]', '【】が[]に統一される（2行目）');

console.log('\n=== 複合揺らぎテスト ===\n');

const tool5 = new Princessify();

// 複合ケース: 様々な揺らぎが混在
const input5 = `
@dango A B C D E

1:30 開始 【Ox0-‐】
1:20 A ［O〇oXx］
`;

const result5 = tool5.convert(input5);
console.log('--- 変換結果（複合揺らぎ） ---');
console.log(result5);
console.log('--- テスト ---');

// 【Ox0-‐】→ [〇ー〇ーー] (O=ON, x=OFF, 0=ON, -=OFF, ‐=OFF)
assertIncludes(result5, '1:30 開始 [〇ー〇ーー]', '複合揺らぎ（初期行）が正規化される');

// ［O〇oXx］→ [〇〇〇ーー] (O=ON, 〇=ON, o=ON, X=OFF, x=OFF)
// 前の状態 [〇ー〇ーー] からの差分
assertIncludes(result5, '1:20 A [〇⭕〇ーー]', '複合揺らぎ（2行目）が正規化される');

console.log('\n=== 括弧バリエーションテスト ===\n');

// 様々な括弧に対応
const bracketTests = [
    { name: '半角丸括弧 ()', input: '(〇ーーーー)' },
    { name: '全角丸括弧 （）', input: '（〇ーーーー）' },
    { name: '半角波括弧 {}', input: '{〇ーーーー}' },
    { name: '全角波括弧 ｛｝', input: '｛〇ーーーー｝' },
    { name: '半角山括弧 <>', input: '<〇ーーーー>' },
    { name: '全角山括弧 ＜＞', input: '＜〇ーーーー＞' },
    { name: '山括弧 〈〉', input: '〈〇ーーーー〉' },
    { name: '二重山括弧 《》', input: '《〇ーーーー》' },
    { name: '鉤括弧 「」', input: '「〇ーーーー」' },
    { name: '二重鉤括弧 『』', input: '『〇ーーーー』' },
    { name: '亀甲括弧 〔〕', input: '〔〇ーーーー〕' },
];

for (const test of bracketTests) {
    const tool = new Princessify();
    const input = `
@dango A B C D E

1:30 開始 ${test.input}
`;
    const result = tool.convert(input);
    assertIncludes(result, '1:30 開始 [〇ーーーー]', `${test.name} が [] に統一される`);
}

console.log('\n=== 括弧なしお団子テスト ===\n');

const tool6 = new Princessify();

// 括弧なしのお団子表記（XOXXX, OXOXX など）
const input6 = `
@dango ユニ エリコ ペコ ルカ シズル

1:30 開始 XOXXX オートOFF
1:06 ペコ OXOXX オートOFF
1:01 ペコ OXOOX オートON
`;

const result6 = tool6.convert(input6);
console.log('--- 変換結果（括弧なし） ---');
console.log(result6);
console.log('--- テスト ---');

// 1:30 初期状態: XOXXX → [ー〇ーーー]、オートOFF指示（デフォルトOFF→OFF=⬛）
assertIncludes(result6, '1:30 開始 [ー〇ーーー]⬛ オートOFF', '括弧なしお団子が認識される（初期行）+ オート⬛');

// 1:06 ペコ: XOXXX → OXOXX、オートOFF維持（⬛）
assertIncludes(result6, '1:06 ペコ [⭕❌⭕ーー]⬛ オートOFF', '括弧なしお団子の差分計算 + オート⬛');

// 1:01 ペコ: OXOXX → OXOOX、オートON切替（OFF→ON=👉✅）
assertIncludes(result6, '1:01 ペコ [〇ー〇⭕ー]👉✅ オートON', '括弧なしお団子の差分計算（2）+ オート👉✅');

console.log('\n=== 括弧なし複合テスト ===\n');

const tool7 = new Princessify();

// 大文字小文字混在
const input7 = `
@dango A B C D E

1:30 開始 xOxXo
1:20 A OoOxX
`;

const result7 = tool7.convert(input7);
console.log('--- 変換結果（大文字小文字混在） ---');
console.log(result7);
console.log('--- テスト ---');

// xOxXo → [ー〇ー ー〇]
assertIncludes(result7, '1:30 開始 [ー〇ーー〇]', '括弧なし大文字小文字混在（初期行）');

// xOxXo → OoOxX: [ー〇ーー〇] → [〇〇〇ーー]
assertIncludes(result7, '1:20 A [⭕〇⭕ー❌]', '括弧なし大文字小文字混在（差分）');

console.log('\n=== 全角ハイフンマイナステスト ===\n');

const tool8 = new Princessify();

// 全角ハイフンマイナス（U+FF0D）を使用
const input8 = `
@dango キョウカ スズメ エリス シズル ボス

1:30　バトル開始　[〇〇〇〇〇]
1:01　キョウカ　　[〇－－〇〇]
`;

const result8 = tool8.convert(input8);
console.log('--- 変換結果（全角ハイフンマイナス） ---');
console.log(result8);
console.log('--- テスト ---');

// 1:30 初期状態
assertIncludes(result8, '1:30　バトル開始　[〇〇〇〇〇]', '初期状態が維持される');

// 1:01 キョウカ: [〇〇〇〇〇] → [〇－－〇〇] (index 1,2: ON→OFF = ❌)
assertIncludes(result8, '1:01　キョウカ　　[〇❌❌〇〇]', '全角ハイフンマイナス（－）がOFFとして認識される');

console.log('\n=== @dango省略テスト ===\n');

const tool9 = new Princessify();

// @dangoなしで、行頭付近に時間がある行を処理
const input9 = `
1:30 開始 [〇〇〇〇〇]
1:20 アクション [〇〇ーーー]
1:10 終了 [ーーーーー]
`;

const result9 = tool9.convert(input9);
console.log('--- 変換結果（@dango省略） ---');
console.log(result9);
console.log('--- テスト ---');

// @dangoなしでも処理される
assertIncludes(result9, '1:30 開始 [〇〇〇〇〇]', '@dangoなしでも初期状態が処理される');
// [〇〇〇〇〇] → [〇〇ーーー]: index 2,3,4 が ON→OFF = ❌
assertIncludes(result9, '1:20 アクション [〇〇❌❌❌]', '@dangoなしでも差分計算される');
assertIncludes(result9, '1:10 終了 [❌❌ーーー]', '@dangoなしでも差分計算される（2）');

console.log('\n=== 行頭10文字以内テスト ===\n');

const tool10 = new Princessify();

// 行頭から10文字以内に時間がある場合のみ処理
const input10 = `
⭐️1:30 開始 [〇〇〇〇〇]
　　1:20 アクション [〇ーーーー]
これはコメントですよ 1:10 時間が遠いので処理対象外
`;

const result10 = tool10.convert(input10);
console.log('--- 変換結果（行頭10文字以内） ---');
console.log(result10);
console.log('--- テスト ---');

// 行頭付近に時間がある行は処理
assertIncludes(result10, '⭐️1:30 開始 [〇〇〇〇〇]', '行頭付近の時間は処理される');
assertIncludes(result10, '　　1:20 アクション [〇❌❌❌❌]', '全角空白後の時間も処理される');

// 行頭から離れた時間は処理されない（お団子が追加されない）
assertNotIncludes(result10, 'これはコメントですよ 1:10 時間が遠いので処理対象外 [', '行頭から離れた時間は処理されない');

console.log('\n=== @dangoトリガーテスト ===\n');

const tool11 = new Princessify();

// @dangoでトリガー、キャラ名指定なし
const input11 = `
@dango

1:30 開始 [〇〇〇〇〇]
1:20 アクション [〇〇ーーー]
`;

const result11 = tool11.convert(input11);
console.log('--- 変換結果（@dango） ---');
console.log(result11);
console.log('--- テスト ---');

assertIncludes(result11, '1:30 開始 [〇〇〇〇〇]', '@dangoで処理される');
assertIncludes(result11, '1:20 アクション [〇〇❌❌❌]', '@dangoで差分計算される');

console.log('\n=== @dango + キャラ名指定テスト ===\n');

const tool12 = new Princessify();

// @dangoでキャラ名も指定可能
const input12 = `
@dango A B C D E

1:30 開始 [〇〇〇〇〇]
1:20 A アクション
`;

const result12 = tool12.convert(input12);
console.log('--- 変換結果（@dango + キャラ名） ---');
console.log(result12);
console.log('--- テスト ---');

// キャラ名Aがある行も処理される（お団子なしでも）
assertIncludes(result12, '1:20 A アクション [〇〇〇〇〇]', '@dango + キャラ名指定で動作');

// =============================================
// オートON/OFF検出テスト (Phase 1)
// =============================================

console.log('\n=== オート検出: 基本テスト ===\n');

// テスト1: オートOFF → OFF切替を検出
assertEqual(detectAutoState('オートOFF'), 'off', 'オートOFF → off');

// テスト2: オートON → ON切替を検出
assertEqual(detectAutoState('オートON'), 'on', 'オートON → on');

// テスト3: オートのみ → 状態変更なし
assertEqual(detectAutoState('オート'), null, 'オート のみ → null');
assertEqual(detectAutoState('AUTO'), null, 'AUTO のみ → null');
assertEqual(detectAutoState('オートで発動'), null, 'オートで発動 → null');

console.log('\n=== オート検出: 表記揺らぎテスト ===\n');

// テスト4: 表記揺らぎ
assertEqual(detectAutoState('オートオン'), 'on', 'オートオン → on');
assertEqual(detectAutoState('オートオフ'), 'off', 'オートオフ → off');
assertEqual(detectAutoState('AUTO ON'), 'on', 'AUTO ON → on');
assertEqual(detectAutoState('AUTO OFF'), 'off', 'AUTO OFF → off');
assertEqual(detectAutoState('auto on'), 'on', 'auto on → on');
assertEqual(detectAutoState('auto off'), 'off', 'auto off → off');
assertEqual(detectAutoState('オート切'), 'off', 'オート切 → off');
assertEqual(detectAutoState('オート切り'), 'off', 'オート切り → off');

console.log('\n=== オート検出: 独立した「切」テスト ===\n');

// テスト5: 独立した「切」→ OFF
assertEqual(detectAutoState("'切"), 'off', "'切 → off");
assertEqual(detectAutoState('#切'), 'off', '#切 → off');
assertEqual(detectAutoState('切 スキル'), 'off', '行頭の切+スペース → off');

// テスト6: 日本語文中の「切」→ 誤検出しない
assertEqual(detectAutoState('見切れてしまうので注意'), null, '見切れ → null（誤検出しない）');
assertEqual(detectAutoState('大切なポイント'), null, '大切 → null（誤検出しない）');

// =============================================
// オート状態描画テスト (Phase 2)
// =============================================

console.log('\n=== オート状態描画テスト ===\n');

// テスト7: OFF→OFF = ⬛
assertEqual(renderAutoState(false, false), '⬛', 'OFF→OFF = ⬛');

// テスト8: ON→ON = ✅
assertEqual(renderAutoState(true, true), '✅', 'ON→ON = ✅');

// テスト9: OFF→ON = 👉✅
assertEqual(renderAutoState(false, true), '👉✅', 'OFF→ON = 👉✅');

// テスト10: ON→OFF = 👉⬛
assertEqual(renderAutoState(true, false), '👉⬛', 'ON→OFF = 👉⬛');

// =============================================
// オート統合テスト (Phase 3)
// =============================================

console.log('\n=== オート統合: デフォルトOFF + オートOFF行 ===\n');

// テスト11: デフォルトOFF + オートOFF行 → 初行は👉⬛（OFF→OFFだがオートOFF指示あり）
// 実は初行でオートOFFの指示 → デフォルトがOFFなのでOFF維持 = ⬛ではなく、
// detectAutoStateが'off'を返し、初行のデフォルトOFFから変化なしなので⬛
const tool13 = new Princessify();
const input13 = `
@dango A B C D E

1:30 開始 [〇〇〇〇〇] オートOFF
1:20 A [〇〇ーーー] オートON
1:10 B [〇〇〇ーー]
`;

const result13 = tool13.convert(input13);
console.log('--- 変換結果（オートOFF→ON→維持） ---');
console.log(result13);
console.log('--- テスト ---');

// 1:30 初行: オートOFF指示、デフォルトOFF→OFF = ⬛（初期状態OFF、OFF指示で変化なし）
assertIncludes(result13, '1:30 開始 [〇〇〇〇〇]⬛ オートOFF', 'デフォルトOFF + オートOFF → ⬛');

// 1:20: オートON指示、OFF→ON = 👉✅
assertIncludes(result13, '1:20 A [〇〇❌❌❌]👉✅ オートON', 'OFF→ON = 👉✅');

// 1:10: オート指示なし、ON維持 = ✅
assertIncludes(result13, '1:10 B [〇〇⭕ーー]✅', 'ON維持 = ✅');

console.log('\n=== オート統合: 複数回切替 ===\n');

// テスト12: オートON→OFF→ON の複数回切替
const tool14 = new Princessify();
const input14 = `
@dango A B C D E

1:30 開始 [〇〇〇〇〇] オートON
1:20 A [〇〇ーーー] オートOFF
1:10 B [〇〇〇ーー] オートON
`;

const result14 = tool14.convert(input14);
console.log('--- 変換結果（ON→OFF→ON切替） ---');
console.log(result14);
console.log('--- テスト ---');

assertIncludes(result14, '1:30 開始 [〇〇〇〇〇]👉✅ オートON', '初行でON切替 = 👉✅');
assertIncludes(result14, '1:20 A [〇〇❌❌❌]👉⬛ オートOFF', 'ON→OFF = 👉⬛');
assertIncludes(result14, '1:10 B [〇〇⭕ーー]👉✅ オートON', 'OFF→ON = 👉✅');

console.log('\n=== オート統合: オート指示なしTLでは絵文字なし ===\n');

// テスト13: オート指示がないTLでは絵文字が付かない
const tool15 = new Princessify();
const input15 = `
@dango A B C D E

1:30 開始 [〇〇〇〇〇]
1:20 A [〇〇ーーー]
`;

const result15 = tool15.convert(input15);
console.log('--- 変換結果（オート指示なし） ---');
console.log(result15);
console.log('--- テスト ---');

assertIncludes(result15, '1:30 開始 [〇〇〇〇〇]', 'オート指示なし → 絵文字なし');
assertNotIncludes(result15, '⬛', 'オート指示なしTLに⬛は付かない');
assertNotIncludes(result15, '✅', 'オート指示なしTLに✅は付かない');

console.log('\n=== オート統合: メモのみの行テスト ===\n');

// テスト14: 「オート」メモのみ → 状態変更なし、でも他の行にオート指示があれば絵文字は出る
const tool16 = new Princessify();
const input16 = `
@dango A B C D E

1:30 開始 [〇〇〇〇〇] オートOFF
1:20 A オート [〇〇ーーー]
1:10 B [〇〇〇ーー] オートON
`;

const result16 = tool16.convert(input16);
console.log('--- 変換結果（オートメモ行） ---');
console.log(result16);
console.log('--- テスト ---');

// 1:20: 「オート」のみ → 状態変更なし、前行のOFFを維持 = ⬛
assertIncludes(result16, '1:20 A オート [〇〇❌❌❌]⬛', 'オートメモ行は状態変更なし、⬛維持');

// 1:10: オートON → OFF→ON = 👉✅
assertIncludes(result16, '1:10 B [〇〇⭕ーー]👉✅ オートON', 'メモ行後のオートON → 👉✅');

console.log('\n=== @dango行が出力から除去されるテスト ===\n');

const tool17 = new Princessify();
const input17 = `
@dango A B C D E

1:30 開始 [〇〇〇〇〇]
1:20 A [〇〇ーーー]
`;

const result17 = tool17.convert(input17);
console.log('--- 変換結果（@dango除去） ---');
console.log(result17);
console.log('--- テスト ---');

assertNotIncludes(result17, '@dango', '@dango行が出力から除去される');
assertIncludes(result17, '1:30 開始 [〇〇〇〇〇]', '@dango除去後もTL行は維持');

console.log('\n=== テスト完了 ===\n');
