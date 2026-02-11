// src/logic/princessify.test.ts
import { Princessify, PartyGuideError, detectAutoState, renderAutoState, classifyUBType, parseExplicitSets, parseInlineInstructions } from './princessify';

// 簡易アサーション
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertIncludes(actual: string | null, expected: string, message: string) {
    if (actual === null || !actual.includes(expected)) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected to include: "${expected}"`);
        console.error(`   Actual: ${JSON.stringify(actual)}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertNotIncludes(actual: string | null, expected: string, message: string) {
    if (actual !== null && actual.includes(expected)) {
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

// =============================================
// 推論モード: Phase 1 - UBタイプ分類テスト
// =============================================

console.log('\n=== 推論モード: UBタイプ分類 ===\n');

// テスト1: #で始まる → SET
assertEqual(classifyUBType('#通常cl', '1:10 ヴァンピィ #通常cl'), 'set', '#通常cl → set');

// テスト2: 最初のトークンが#でない → manual
assertEqual(classifyUBType('秒数最速 #エイドcl', '1:17 キャル 秒数最速 #エイドcl'), 'manual', '秒数最速 #エイドcl → manual');

// テスト3: AUTO → auto
assertEqual(classifyUBType('AUTO ここでネネカset', '1:02 ヴァンピィ AUTO ここでネネカset'), 'auto', 'AUTO → auto');

// テスト4: 敵UB → enemy
assertEqual(classifyUBType('ペタラcl', '0:41 敵UB ペタラcl'), 'enemy', '敵UB → enemy');

// テスト5: エイドcl最速（#なし） → manual
assertEqual(classifyUBType('エイドcl最速 秒数最速安定', '1:00 キャル エイドcl最速'), 'manual', 'エイドcl最速 → manual');

// テスト6: ブレス3hit最速（AUTOなし） → manual
assertEqual(classifyUBType('ブレス3hit最速 UBOK安定', '0:36 ヴァンピィ ブレス3hit最速'), 'manual', 'ブレス3hit最速 → manual');

// テスト6b: コメント内の敵UBは敵UBと判定しない
assertEqual(classifyUBType('ブレス3hit早め　0:48最速可、遅いと0:41敵UB前にリンクデバフ入らない', '0:49　ヴァンピィ　ブレス3hit早め　0:48最速可、遅いと0:41敵UB前にリンクデバフ入らない'), 'manual', 'コメント内の敵UBは敵UBと判定しない');

// カタカナ「オート」→ auto
assertEqual(classifyUBType('オート　クルル解除', '1:07 水モネ　オート　クルル解除'), 'auto', 'カタカナ オート → auto');
assertEqual(classifyUBType('オート', '0:53 水モネ　オート'), 'auto', 'カタカナ オート（単独）→ auto');

// 「オートオン」「オートオフ」は firstToken にならない想定だが、万が一なった場合は manual のまま
assertEqual(classifyUBType('オートオン', '1:20 甲　オートオン'), 'manual', 'オートオン → manual（AUTOではない）');

// ub中 → none（UB発動ではない、操作タイミングの注釈）
assertEqual(classifyUBType('ub中　水モネ解除', '1:22 水モネ ub中　水モネ解除'), 'none', 'ub中 → none');
assertEqual(classifyUBType('UB中　クルルセット', '1:17 カスミ UB中　クルルセット'), 'none', 'UB中（大文字）→ none');

// =============================================
// 推論モード: Phase 2 - 明示的SET検出テスト
// =============================================

console.log('\n=== 推論モード: 明示的SET検出 ===\n');

// テスト7: ここでネネカset → ネネカのインデックス
{
    const party = ['A', 'B', 'ネネカ', 'D', 'E'];
    const result = parseExplicitSets('ここでネネカset #サンダーデバフ後', party);
    assertEqual(result.length, 1, 'ここでネネカset → 1件検出');
    assertEqual(result[0], 2, 'ここでネネカset → index 2');
}

// テスト8: ここでエリスset → エリスのインデックス
{
    const party = ['エリス', 'B', 'C', 'D', 'E'];
    const result = parseExplicitSets('ここでエリスset', party);
    assertEqual(result.length, 1, 'ここでエリスset → 1件検出');
    assertEqual(result[0], 0, 'ここでエリスset → index 0');
}

// テスト9: そのままset → パーティー名なしなので空配列
{
    const party = ['エリス', 'エキドナ', 'ネネカ', 'キャル', 'ヴァンピィ'];
    const result = parseExplicitSets('遅れたらそのままset', party);
    assertEqual(result.length, 0, 'そのままset → 0件（パーティー名なし）');
}

// テスト10: SET指示なし → 空配列
{
    const party = ['A', 'B', 'C', 'D', 'E'];
    const result = parseExplicitSets('秒数最速 #エイドcl', party);
    assertEqual(result.length, 0, 'SET指示なし → 0件');
}

// =============================================
// 推論モード: Phase 3-6 統合テスト
// =============================================

console.log('\n=== 推論モード: 簡易推論テスト（手動→SET→手動）===\n');

// テスト11-16: 3行入力（手動→SET→手動）
// パーティー: A(0), B(1), C(2), D(3), E(4)
// 1:20 A 手動（manual）
// 1:10 B #通常cl（SET）→ 直前行(1:20)でB(1)をSET ON、1:10でSET OFF
// 1:00 C 手動（manual）
const toolInfer1 = new Princessify();
const inputInfer1 = `
@dango A B C D E

1:20 A 手動発動
1:10 B #通常cl
1:00 C 手動発動
`;

const resultInfer1 = toolInfer1.convert(inputInfer1);
console.log('--- 推論結果（簡易3行）---');
console.log(resultInfer1);
console.log('--- テスト ---');

// テスト11: 初期行が生成される
assertIncludes(resultInfer1, '1:30 開始 [❌❌❌❌❌]', '初期行が生成される');

// テスト12: 1:20（手動）にSET ON for B(1) が配置 + 🌟
assertIncludes(resultInfer1, '🌟1:20 A 手動発動', '手動行に🌟が付く');
assertIncludes(resultInfer1, '[ー⭕ーーー]', '1:20でB(1)がSET ON');

// テスト13: 1:10（SET）にSET OFF for B(1)
assertNotIncludes(resultInfer1, '🌟1:10', 'SET行に🌟は付かない');
assertIncludes(resultInfer1, '[ー❌ーーー]', '1:10でB(1)がSET OFF');

// テスト14: 1:00（手動）は状態変化なし
assertIncludes(resultInfer1, '🌟1:00 C 手動発動', '1:00の手動行に🌟');
assertIncludes(resultInfer1, '[ーーーーー]', '1:00は状態変化なし');

console.log('\n=== 推論モード: AUTO推論テスト ===\n');

// テスト17-19: AUTO推論
// パーティー名にAUTOと衝突しない名前を使用
const toolInfer2 = new Princessify();
const inputInfer2 = `
@dango 甲 乙 丙 丁 戊

1:20 甲 手動発動
1:10 乙 AUTO 発動
1:00 丙 手動発動
`;

const resultInfer2 = toolInfer2.convert(inputInfer2);
console.log('--- 推論結果（AUTO）---');
console.log(resultInfer2);
console.log('--- テスト ---');

// テスト17: 1:20（AUTO UBの直前）にAUTO ON
assertIncludes(resultInfer2, '👉✅', '1:20にAUTO ON (👉✅)');

// テスト18: 1:10（AUTO発動行）でAUTO OFF
assertIncludes(resultInfer2, '👉⬛', '1:10にAUTO OFF (👉⬛)');

// テスト19: AUTO UBがないTLでは絵文字なし
const toolInfer3 = new Princessify();
const inputInfer3 = `
@dango A B C D E

1:20 A 手動発動
1:10 B #通常cl
`;

const resultInfer3 = toolInfer3.convert(inputInfer3);
assertNotIncludes(resultInfer3, '✅', 'AUTO UBなしTLに✅は付かない');

console.log('\n=== 推論モード: サブ行テスト ===\n');

// テスト20: サブ行（タイムスタンプなし）がSETの場合
const toolInfer4 = new Princessify();
const inputInfer4 = `
@dango A B C D E

1:20 A 手動発動
1:10 B 手動発動
    C #通常cl
1:00 D 手動発動
`;

const resultInfer4 = toolInfer4.convert(inputInfer4);
console.log('--- 推論結果（サブ行）---');
console.log(resultInfer4);
console.log('--- テスト ---');

// メイン行(1:10 B)にC(2)のSET ONが配置される
assertIncludes(resultInfer4, '[ーー⭕ーー]', 'メイン行でC(2)がSET ON');
// サブ行(C #通常cl)でC(2)がSET OFF
assertIncludes(resultInfer4, '[ーー❌ーー]', 'サブ行でC(2)がSET OFF');

// =============================================
// Phase 7: モード自動判別テスト
// =============================================

console.log('\n=== Phase 7: お団子あり → 既存モード ===\n');

// テスト24: お団子ありの入力 → 既存モード（推論モードにならない）
{
    const tool = new Princessify();
    const input = `
@dango A B C D E

1:30 開始 [〇〇〇〇〇]
1:20 A [〇〇ーーー]
`;
    const result = tool.convert(input);
    console.log('--- 変換結果（お団子あり → 既存モード） ---');
    console.log(result);
    console.log('--- テスト ---');

    // 既存モードでは🌟は付かない
    assertNotIncludes(result, '🌟', 'お団子ありでは🌟が付かない（既存モード）');
    // 既存モードの差分計算が正しく動く
    assertIncludes(result, '1:20 A [〇〇❌❌❌]', 'お団子ありで差分計算が動く（既存モード）');
    // 初期行はそのまま（推論モードの自動生成ではない）
    assertIncludes(result, '1:30 開始 [〇〇〇〇〇]', 'ユーザー提供の初期行がそのまま維持');
}

console.log('\n=== Phase 7: お団子なし + @dango → 推論モード ===\n');

// テスト25: お団子なし + @dango → 推論モード
{
    const tool = new Princessify();
    const input = `
@dango A B C D E

1:20 A 手動発動
1:10 B #通常cl
`;
    const result = tool.convert(input);
    console.log('--- 変換結果（お団子なし → 推論モード） ---');
    console.log(result);
    console.log('--- テスト ---');

    // 推論モードでは🌟が付く
    assertIncludes(result, '🌟', 'お団子なしで🌟が付く（推論モード）');
    // 推論モードでは初期行が自動生成される
    assertIncludes(result, '1:30 開始 [❌❌❌❌❌]', '初期行が自動生成される（推論モード）');
    // 推論モードでSET ON/OFFが推論される
    assertIncludes(result, '⭕', '推論モードでSET ONが推論される');
    assertIncludes(result, '❌', '推論モードでSET OFFが推論される');
}

console.log('\n=== Phase 7: @dangoなし + お団子なし → 既存モード ===\n');

// テスト26: @dangoなし + お団子なし → 既存モード（パーティー不明なので推論不可）
{
    const tool = new Princessify();
    const input = `
1:20 A 手動発動
1:10 B 通常cl
`;
    const result = tool.convert(input);
    console.log('--- 変換結果（@dangoなし → 既存モード） ---');
    console.log(result);
    console.log('--- テスト ---');

    // パーティー情報がないので推論モードにはならない
    assertNotIncludes(result, '🌟', '@dangoなしでは推論モードにならない');
    assertNotIncludes(result, '1:30 開始', '@dangoなしでは初期行は生成されない');
}

// =============================================
// Phase 8: 統合テスト（フル入力）
// =============================================

console.log('\n=== Phase 8: 統合テスト（フル入力）===\n');

// ヘルパー: 特定の文字列を含む行を取得
function getLine(output: string | null, search: string): string {
    if (output === null) return '';
    return output.split('\n').find(line => line.includes(search)) || '';
}

const toolFull = new Princessify();
const inputFull = `@dango エリス エキドナ ネネカ キャル ヴァンピィ

1:17　キャル　　　秒数最速　#エイドcl　1:15サンダーをギフトバフ後
1:11　キャル　　　秒数視認17F〜　#エイドcl　1:09サンダーを悪巧みデバフ後
1:10　ヴァンピィ　#通常cl
1:04　キャル　　　#通常cl
1:02　ヴァンピィ　AUTO　ここでネネカset　#サンダーデバフ後
1:00　キャル　　　エイドcl最速　秒数最速安定
　　　ネネカ　　　#通常cl
0:51　キャル　　　エイドcl最速　秒数最速安定
0:49　ヴァンピィ　ブレス3hit早め　0:48最速可、遅いと0:41敵UB前にリンクデバフ入らない
0:45　キャル　　　エイドcl最速　秒数視認安定、ここまで遅いと0:41敵UB前に通常開始ない

0:41　敵UB　ペタラcl/待機/待機/通常cl/リンクデバフ入り

0:37　エリス　　　#テールcl
0:36　ヴァンピィ　ブレス3hit最速　UBOK安定
　　　キャル　　　#通常cl
0:35　エキドナ　　ペタラバフ後早め　○538m / ✕526m
0:33　キャル　　　#エイドcl
0:28　ネネカ　　　#ブライトcl
0:26　ヴァンピィ　ブレス3hit最速　秒数視認安定
0:24　キャル　　　エイドcl　適当でいい
0:17　キャル　　　エイドcl　適当でいい
0:16　ヴァンピィ　#ブレス3hit後ペタラ起動　0:36、0:26遅いとhit数欠損
0:13　キャル　　　通常cl　適当でいい
0:06　ヴァンピィ　ブレス1hit最速~2hitガチ最速　遅いと0:04敵UB来る
　　　キャル　　　#エイドcl
0:05　エキドナ　　悪巧み4hit最速　TP減少直前、遅れたらそのままset
0:03　ネネカ　　　#フォレセントcl　ここでエリスset
0:02　エリス　　　#テールcl
0:01　キャル　　　#サンダーTP`;

const resultFull = toolFull.convert(inputFull);
console.log('--- 推論結果（フル入力）---');
console.log(resultFull);
console.log('--- テスト ---');

// テスト28: 初期行
assertIncludes(resultFull, '1:30 開始 [❌❌❌❌❌]👉⬛', '初期行が正しく生成される');

// テスト29: 手動UBに🌟
assertIncludes(resultFull, '🌟1:17', '1:17（手動）に🌟');
assertIncludes(resultFull, '🌟1:11', '1:11（手動）に🌟');
assertIncludes(resultFull, '🌟1:00', '1:00（手動）に🌟');
assertIncludes(resultFull, '🌟0:49', '0:49（手動）に🌟');
assertIncludes(resultFull, '🌟0:05', '0:05（手動）に🌟');

// テスト30: SET/AUTO/敵UBに🌟なし
assertNotIncludes(resultFull, '🌟1:10', '1:10（SET）に🌟なし');
assertNotIncludes(resultFull, '🌟1:04', '1:04（SET）に🌟なし');
assertNotIncludes(resultFull, '🌟1:02', '1:02（AUTO）に🌟なし');
assertNotIncludes(resultFull, '🌟0:41', '0:41（敵UB）に🌟なし');
assertNotIncludes(resultFull, '🌟0:37', '0:37（SET）に🌟なし');

// テスト31: SET ON/OFF推論
{
    const line = getLine(resultFull, '1:11　キャル');
    assertIncludes(line, '[ーーーー⭕]', '1:11でヴァンピィ(4)がSET ON');
}
{
    const line = getLine(resultFull, '1:10　ヴァンピィ');
    assertIncludes(line, '[ーーー⭕❌]', '1:10でキャル(3)ON + ヴァンピィ(4)OFF');
}
{
    const line = getLine(resultFull, '1:04　キャル');
    assertIncludes(line, '[ーーー❌ー]', '1:04でキャル(3)がSET OFF');
}

// テスト32: AUTO推論
{
    const line = getLine(resultFull, '1:04　キャル');
    assertIncludes(line, '👉✅', '1:04でAUTO ON');
}
{
    const line = getLine(resultFull, '1:02　ヴァンピィ');
    assertIncludes(line, '👉⬛', '1:02でAUTO OFF');
}

// テスト33: 明示的SET（ここでネネカset）
{
    const line = getLine(resultFull, '1:02　ヴァンピィ');
    assertIncludes(line, '[ーー⭕ーー]', '1:02でネネカ(2)が明示的SET ON');
}

// テスト34: サブ行のSET OFF
{
    const line = getLine(resultFull, 'ネネカ　　　#通常cl');
    assertIncludes(line, '[ーー❌ーー]', 'サブ行でネネカ(2)がSET OFF');
}

// テスト35: 敵UBラインにSET ON配置
{
    const line = getLine(resultFull, '0:41　敵UB');
    assertIncludes(line, '[⭕ーーーー]', '0:41敵UBでエリス(0)がSET ON');
}

// テスト36: コメント内の「敵UB」で誤判定しない
{
    const line = getLine(resultFull, '0:49　ヴァンピィ');
    assertIncludes(line, '🌟', '0:49はコメントに敵UBがあるが手動UB');
}

// テスト37: 明示的SET（ここでエリスset）
{
    const line = getLine(resultFull, '0:03　ネネカ');
    assertIncludes(line, '[⭕ー❌ーー]', '0:03でエリス(0)ON + ネネカ(2)OFF');
}

// テスト38: 最後のSET連鎖
{
    const line = getLine(resultFull, '0:02　エリス');
    assertIncludes(line, '[❌ーー⭕ー]', '0:02でエリス(0)OFF + キャル(3)ON');
}
{
    const line = getLine(resultFull, '0:01　キャル');
    assertIncludes(line, '[ーーー❌ー]', '0:01でキャル(3)がSET OFF');
}

// =============================================
// パーティー未指定ガイドテスト
// =============================================

console.log('\n=== パーティー未指定ガイドテスト ===\n');

// テスト39: @dangoのみ（パーティー名なし）+ お団子なし → PartyGuideError
{
    const tool = new Princessify();
    const input = `@dango

1:17 キャル 秒数最速 #エイドcl
1:10 ヴァンピィ #通常cl
`;
    let caught: PartyGuideError | null = null;
    try {
        tool.convert(input);
    } catch (e) {
        if (e instanceof PartyGuideError) caught = e;
    }
    assert(caught !== null, 'パーティー未指定で PartyGuideError が投げられる');
    assertIncludes(caught!.message, '@dango', 'ガイドに@dangoの書式が含まれる');
    assertIncludes(caught!.message, 'キャラ1', 'ガイドにキャラ名プレースホルダーが含まれる');
}

// テスト40: @dango + パーティー名不足（3人）+ お団子なし → PartyGuideError
{
    const tool = new Princessify();
    const input = `@dango A B C

1:17 キャル 秒数最速 #エイドcl
1:10 ヴァンピィ #通常cl
`;
    let caught: PartyGuideError | null = null;
    try {
        tool.convert(input);
    } catch (e) {
        if (e instanceof PartyGuideError) caught = e;
    }
    assert(caught !== null, 'パーティー不足で PartyGuideError が投げられる');
    assertIncludes(caught!.message, '5', 'ガイドに5人必要であることが示される');
}

// テスト41: @dango + パーティー名なし + お団子あり → 既存モード（ガイドなし）
{
    const tool = new Princessify();
    const input = `@dango

1:30 開始 [〇〇〇〇〇]
1:20 A [〇〇ーーー]
`;
    const result = tool.convert(input);
    console.log('--- 変換結果（お団子あり + パーティー未指定）---');
    console.log(result);
    console.log('--- テスト ---');

    // お団子ありなら既存モードで処理（ガイドは不要）
    assertIncludes(result, '[〇〇〇〇〇]', 'お団子ありなら既存モードで処理');
    assertNotIncludes(result, 'キャラ1', 'お団子ありならガイドは出ない');
}

// =============================================
// channelMode テスト
// =============================================

console.log('\n=== channelMode: 基本推論テスト ===\n');

// テスト42: channelModeでお団子なし + 最初の行が5人パーティ → 推論モード
{
    const tool = new Princessify();
    const input = `甲 乙 丙 丁 戊

1:20 甲 手動発動
1:10 乙 #通常cl
1:00 丙 手動発動
`;
    const result = tool.convert(input, { channelMode: true });
    console.log('--- 変換結果（channelMode基本）---');
    console.log(result);
    console.log('--- テスト ---');

    // 推論モードで動作する
    assertIncludes(result, '1:30 開始 [❌❌❌❌❌]', 'channelMode: 初期行が生成される');
    assertIncludes(result, '🌟1:20', 'channelMode: 手動行に🌟');
    assertIncludes(result, '[ー⭕ーーー]', 'channelMode: 1:20で乙(1)がSET ON');
    // パーティ行が出力から除去される
    assertNotIncludes(result, '甲 乙 丙 丁 戊', 'channelMode: パーティ行が出力から除去される');
}

console.log('\n=== channelMode: 空行スキップテスト ===\n');

// テスト43: channelModeで先頭に空行がある場合スキップしてパーティを検出
{
    const tool = new Princessify();
    const input = `

甲 乙 丙 丁 戊

1:20 甲 手動発動
1:10 乙 #通常cl
`;
    const result = tool.convert(input, { channelMode: true });
    console.log('--- 変換結果（channelMode空行スキップ）---');
    console.log(result);
    console.log('--- テスト ---');

    assertIncludes(result, '1:30 開始 [❌❌❌❌❌]', 'channelMode: 空行スキップ後に推論モード動作');
    assertIncludes(result, '🌟1:20', 'channelMode: 空行スキップ後も手動行に🌟');
}

console.log('\n=== channelMode: お団子あり → 既存モードテスト ===\n');

// テスト44: channelModeでもお団子が入力にあれば既存モードで動作
{
    const tool = new Princessify();
    const input = `
1:30 開始 [〇〇〇〇〇]
1:20 アクション [〇〇ーーー]
1:10 終了 [ーーーーー]
`;
    const result = tool.convert(input, { channelMode: true });
    console.log('--- 変換結果（channelModeお団子あり）---');
    console.log(result);
    console.log('--- テスト ---');

    // 既存モード: 🌟は付かない、差分計算が動く
    assertNotIncludes(result, '🌟', 'channelMode + お団子あり: 🌟が付かない（既存モード）');
    assertIncludes(result, '1:20 アクション [〇〇❌❌❌]', 'channelMode + お団子あり: 差分計算される');
}

console.log('\n=== channelMode: パーティ定義なし → エラーテスト ===\n');

// テスト45: channelModeでお団子なし + パーティ定義なし → PartyGuideError（チャンネル用）
{
    const tool = new Princessify();
    const input = `
1:20 甲 手動発動
1:10 乙 #通常cl
`;
    let caught: PartyGuideError | null = null;
    try {
        tool.convert(input, { channelMode: true });
    } catch (e) {
        if (e instanceof PartyGuideError) caught = e;
    }
    assert(caught !== null, 'channelMode: パーティ定義なしで PartyGuideError が投げられる');
    assertIncludes(caught!.message, '1行目', 'channelMode: 一行目に書くよう案内');
    assertIncludes(caught!.message, '5人', 'channelMode: 5人必要であることが示される');
    assertNotIncludes(caught!.message, '@dango', 'channelMode: @dangoへの言及はない');
}

console.log('\n=== channelMode: @dango優先テスト ===\n');

// テスト46: channelModeでも@dangoがあれば@dangoを優先
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲 手動発動
1:10 乙 #通常cl
`;
    const result = tool.convert(input, { channelMode: true });
    console.log('--- 変換結果（channelMode + @dango）---');
    console.log(result);
    console.log('--- テスト ---');

    assertIncludes(result, '1:30 開始 [❌❌❌❌❌]', 'channelMode + @dango: 推論モード動作');
    assertIncludes(result, '🌟1:20', 'channelMode + @dango: 手動行に🌟');
    assertNotIncludes(result, '@dango', 'channelMode + @dango: @dango行が除去される');
}

console.log('\n=== パーティ状態リーク防止テスト ===\n');

// テスト47: 同一インスタンスで2回呼び出し、前回のパーティが漏れないこと
{
    const tool = new Princessify();

    // 1回目: パーティ付きで正常に推論
    const input1 = `@dango 甲 乙 丙 丁 戊

1:20 甲 手動発動
1:10 乙 #通常cl
`;
    tool.convert(input1);

    // 2回目: @dangoのみ（パーティ名なし）→ PartyGuideErrorが出るべき
    const input2 = `@dango

1:20 甲 手動発動
1:10 乙 #通常cl
`;
    let caught: PartyGuideError | null = null;
    try {
        tool.convert(input2);
    } catch (e) {
        if (e instanceof PartyGuideError) caught = e;
    }
    assert(caught !== null, '同一インスタンス2回目: 前回のパーティがリークせずエラーになる');
}

// === channelMode: パーティのみでTL行なし → エラーテスト ===
console.log('\n=== channelMode: パーティのみでTL行なし → エラーテスト ===\n');
{
    const tool = new Princessify();
    // パーティ名だけでTL行がない
    const input = `甲 乙 丙 丁 戊`;
    let caught: PartyGuideError | null = null;
    try {
        tool.convert(input, { channelMode: true });
    } catch (e) {
        if (e instanceof PartyGuideError) caught = e;
    }
    assert(caught !== null, 'channelMode: パーティのみでTL行なし → PartyGuideError');
}

// @dango + パーティのみでTL行なし → 同様にエラー
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊`;
    let caught: PartyGuideError | null = null;
    try {
        tool.convert(input);
    } catch (e) {
        if (e instanceof PartyGuideError) caught = e;
    }
    assert(caught !== null, '@dango: パーティのみでTL行なし → PartyGuideError');
}

// === lastMode プロパティテスト ===
console.log('\n=== lastMode テスト ===');
{
    const t = new Princessify();

    // 既存モード: ユーザーがお団子を提供
    const existingInput = `@dango 甲 乙 丙 丁 戊
1:13 甲 [〇〇〇〇〇]
0:55 乙 [〇❌〇〇〇]`;
    t.convert(existingInput);
    assert(t.lastMode === 'existing', 'lastMode: 既存モード → "existing"');

    // 推論モード: お団子なし
    const inferInput = `@dango 甲 乙 丙 丁 戊
1:13 甲
0:55 乙`;
    t.convert(inferInput);
    assert(t.lastMode === 'inference', 'lastMode: 推論モード → "inference"');

    // 初期値: convert前はnull
    const t2 = new Princessify();
    assert(t2.lastMode === null, 'lastMode: 初期値はnull');
}

// === -dango プレフィックス対応テスト ===
console.log('\n=== -dango プレフィックステスト ===');
{
    const t = new Princessify();

    // -dango で推論モードが動作する
    const inferInput = `-dango 甲 乙 丙 丁 戊
1:13 甲
0:55 乙`;
    const result = t.convert(inferInput);
    assert(t.lastMode === 'inference', '-dango: 推論モードが動作する');
    assertIncludes(result, '甲', '-dango: 結果に甲が含まれる');
}

{
    const t = new Princessify();

    // -dango で既存モードが動作する
    const existingInput = `-dango 甲 乙 丙 丁 戊
1:13 甲 [〇〇〇〇〇]
0:55 乙 [〇❌〇〇〇]`;
    t.convert(existingInput);
    assert(t.lastMode === 'existing', '-dango: 既存モードが動作する');
}

// === channelMode: TLでないメッセージは無視 ===
// テストリスト:
// [x] channelMode + 雑談テキスト（タイムスタンプなし、パーティなし）→ null
// [x] channelMode + 複数行の雑談テキスト → null
// [x] channelMode + タイムスタンプ行あり + パーティなし → 従来通り PartyGuideError
// [x] 通常モード(@dango) + TLなし → 従来通り PartyGuideError（既存テスト、動作に変更なし）
console.log('\n=== channelMode 非TLメッセージ無視テスト ===');
{
    const t = new Princessify();

    // 雑談メッセージ → null（無視）
    const result = t.convert('おはよう', { channelMode: true });
    assert(result === null, 'channelMode + 雑談テキスト → null');
}

{
    const t = new Princessify();

    // 複数行の雑談 → null（無視）
    const result = t.convert('おはよう\n今日もクラバト頑張ろう\nよろしく！', { channelMode: true });
    assert(result === null, 'channelMode + 複数行の雑談 → null');
}

{
    const t = new Princessify();

    // タイムスタンプ行あり + パーティなし → エラー（TLっぽいがパーティ未定義）
    let threw = false;
    try {
        t.convert('1:20 キャラA\n1:10 キャラB', { channelMode: true });
    } catch (e) {
        if (e instanceof PartyGuideError) threw = true;
    }
    assert(threw, 'channelMode + タイムスタンプあり + パーティなし → PartyGuideError');
}

{
    const t = new Princessify();

    // 通常モード（@dango付き）でTLなし → エラー（変更なし）
    let threw = false;
    try {
        t.convert('@dango 甲 乙 丙 丁 戊');
    } catch (e) {
        if (e instanceof PartyGuideError) threw = true;
    }
    assert(threw, '通常モード + @dango + TLなし → PartyGuideError');
}

// === parseInlineInstructions テスト ===
// テストリスト:
// [x] {name}セット 単体 → setOn
// [x] {name}解除 単体 → setOff
// [x] カンマ区切り クルル、リノ解除 → 複数setOff
// [x] オートオン / オートオフ → autoOn/autoOff
// [x] ここで{name}セット → スキップ（setOn=[]）
// [x] 混在: クルルセット　水モネ解除　オートオフ
// [x] パーティ名不一致 → 空
// [x] ub中は無視される
console.log('\n=== parseInlineInstructions テスト ===');
{
    const party = ['マホ', 'カスミ', 'リノ', '水モネ', 'クルル'];

    // 1. {name}セット → setOn
    {
        const r = parseInlineInstructions('水モネセット', party);
        assert(r.setOn.length === 1 && r.setOn[0] === 3, 'inline: 水モネセット → setOn=[3]');
        assert(r.setOff.length === 0, 'inline: 水モネセット → setOff=[]');
        assert(!r.autoOn && !r.autoOff, 'inline: 水モネセット → auto変更なし');
    }

    // 2. {name}解除 → setOff
    {
        const r = parseInlineInstructions('水モネ解除', party);
        assert(r.setOff.length === 1 && r.setOff[0] === 3, 'inline: 水モネ解除 → setOff=[3]');
        assert(r.setOn.length === 0, 'inline: 水モネ解除 → setOn=[]');
    }

    // 3. カンマ区切り解除
    {
        const r = parseInlineInstructions('クルル、リノ解除', party);
        assert(r.setOff.length === 2, 'inline: クルル、リノ解除 → setOff 2個');
        assert(r.setOff.includes(4), 'inline: クルル、リノ解除 → クルル(4)');
        assert(r.setOff.includes(2), 'inline: クルル、リノ解除 → リノ(2)');
    }

    // 4. オートオン
    {
        const r = parseInlineInstructions('クルルセット　オートオン', party);
        assert(r.setOn.includes(4), 'inline: クルルセット + オートオン → setOn=[4]');
        assert(r.autoOn === true, 'inline: オートオン → autoOn=true');
        assert(r.autoOff === false, 'inline: オートオン → autoOff=false');
    }

    // 4b. オートオフ
    {
        const r = parseInlineInstructions('水モネ解除　オートオフ', party);
        assert(r.setOff.includes(3), 'inline: 水モネ解除 + オートオフ → setOff=[3]');
        assert(r.autoOff === true, 'inline: オートオフ → autoOff=true');
    }

    // 5. ここで{name}セット → スキップ（parseExplicitSetsの管轄）
    {
        const r = parseInlineInstructions('ここで水モネセット', party);
        assert(r.setOn.length === 0, 'inline: ここで水モネセット → setOn=[]（スキップ）');
    }

    // 6. 混在パターン
    {
        const r = parseInlineInstructions('クルルセット　水モネ解除　オートオフ', party);
        assert(r.setOn.includes(4), 'inline混在: クルルセット → setOn=[4]');
        assert(r.setOff.includes(3), 'inline混在: 水モネ解除 → setOff=[3]');
        assert(r.autoOff === true, 'inline混在: オートオフ → autoOff=true');
    }

    // 7. パーティ名不一致 → 空
    {
        const r = parseInlineInstructions('未知キャラセット', party);
        assert(r.setOn.length === 0, 'inline: パーティ名不一致 → setOn=[]');
    }

    // 8. ub中は無視される
    {
        const r = parseInlineInstructions('水モネub中　水モネ解除', party);
        assert(r.setOff.includes(3), 'inline: ub中は無視、水モネ解除を検出');
        assert(r.setOn.length === 0, 'inline: ub中は無視、setOn=[]');
    }

    // カンマ区切りセット
    {
        const r = parseInlineInstructions('水モネ、マホ、カスミ、リノセット', party);
        assert(r.setOn.length === 4, 'inline: カンマ区切りセット → 4人');
        assert(r.setOn.includes(3), 'inline: 水モネ(3)');
        assert(r.setOn.includes(0), 'inline: マホ(0)');
        assert(r.setOn.includes(1), 'inline: カスミ(1)');
        assert(r.setOn.includes(2), 'inline: リノ(2)');
    }
}

// === Phase 2: 初期状態行テスト ===
// テストリスト:
// [x] 初期状態行あり → 1:30 開始に反映、初期状態行は出力から除去
// [x] 初期状態行なし → 従来通り全OFF（回帰確認）
console.log('\n=== 初期状態行テスト ===');

// 9. 初期状態行あり → 1:30 開始にSET ON/オートOFF反映
{
    const tool = new Princessify();
    const input = [
        'マホ カスミ リノ 水モネ クルル',
        '水モネ、マホ、カスミ、リノセット　オートオフ',
        '1:20 マホ',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;

    // 初期行: 4人ON(⭕) + クルルOFF(❌), auto OFF(👉⬛)
    assertIncludes(result, '1:30 開始 [⭕⭕⭕⭕❌]👉⬛', '初期状態行: 1:30にSET ON反映');

    // 初期状態行が出力から除去されている
    assertNotIncludes(result, '水モネ、マホ、カスミ、リノセット', '初期状態行: 出力から除去');

    // 1:20 マホ: manual UB, 初期状態維持
    assertIncludes(result, '🌟1:20 マホ [〇〇〇〇ー]⬛', '初期状態行: 1:20 マホの状態維持');
}

// 10. 初期状態行なし → 従来通り全OFF
{
    const tool = new Princessify();
    const input = [
        'マホ カスミ リノ 水モネ クルル',
        '1:20 マホ',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;

    // 初期行: 全OFF, autoなし
    assertIncludes(result, '1:30 開始 [❌❌❌❌❌]', '初期状態行なし: 全OFF');

    // 1:20 マホ: manual UB, 全OFF維持
    assertIncludes(result, '🌟1:20 マホ [ーーーーー]', '初期状態行なし: 1:20 マホ全OFF');
}

// === Phase 3: 推論モード統合テスト ===
// テストリスト:
// [x] インラインセット/解除がdango出力に反映
// [x] インラインオートオン/オフがauto出力に反映
// [x] 完全な入力例のE2Eテスト
console.log('\n=== 推論モード統合テスト ===');

// 11. インラインセット/解除がdango出力に反映
{
    const tool = new Princessify();
    const input = [
        '甲 乙 丙 丁 戊',
        '甲、乙、丙、丁セット',
        '1:20 甲',
        '1:15 乙　甲解除',
        '1:10 丙',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;

    // 初期状態: 甲乙丙丁=ON, 戊=OFF
    assertIncludes(result, '1:30 開始 [⭕⭕⭕⭕❌]', '統合11: 初期状態4人ON');

    // 1:20 甲: manual, 状態変化なし → [〇〇〇〇ー]
    assertIncludes(result, '🌟1:20 甲 [〇〇〇〇ー]', '統合11: 1:20 甲 状態維持');

    // 1:15 乙　甲解除: 乙のmanual UB + 甲をSET OFF → 甲=OFF
    // この行でinline命令「甲解除」が適用される
    const line1_15 = getLine(result, '1:15');
    assertIncludes(line1_15, '[❌〇〇〇ー]', '統合11: 1:15で甲解除 → 甲❌');

    // 1:10 丙: 甲=OFF維持 → [ー〇〇〇ー]
    assertIncludes(result, '🌟1:10 丙 [ー〇〇〇ー]', '統合11: 1:10 甲OFF維持');
}

// 12. インラインオートオン/オフがauto出力に反映
{
    const tool = new Princessify();
    const input = [
        '甲 乙 丙 丁 戊',
        '1:20 甲　オートオン',
        '1:15 乙　オートオフ',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;

    // 1:20 甲　オートオン: autoOn → auto=true
    const line1_20 = getLine(result, '1:20');
    assertIncludes(line1_20, '👉✅', '統合12: 1:20でオートオン');

    // 1:15 乙　オートオフ: autoOff → auto=false
    const line1_15 = getLine(result, '1:15');
    assertIncludes(line1_15, '👉⬛', '統合12: 1:15でオートオフ');
}

// 13. 完全なE2Eテスト（ユーザーの実際のパターンに近い入力）
{
    const tool = new Princessify();
    const input = [
        'マホ カスミ リノ 水モネ クルル',
        '水モネ、マホ、カスミ、リノセット　オートオフ',
        '1:10 カスミ',
        '1:05 リノ　クルルセット',
        '1:00 クルル #通常cl',
        '0:55 水モネ　クルル、リノ解除',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;

    // 初期: マホ=ON, カスミ=ON, リノ=ON, 水モネ=ON, クルル=OFF, auto=OFF
    assertIncludes(result, '1:30 開始 [⭕⭕⭕⭕❌]👉⬛', 'E2E: 初期状態');

    // 1:10 カスミ: manual, 状態維持 [〇〇〇〇ー]⬛
    assertIncludes(result, '🌟1:10 カスミ [〇〇〇〇ー]⬛', 'E2E: 1:10 カスミ');

    // 1:05 リノ　クルルセット: manual + クルルON → [〇〇〇〇⭕]⬛
    const line1_05 = getLine(result, '1:05');
    assertIncludes(line1_05, '[〇〇〇〇⭕]⬛', 'E2E: 1:05 クルルセット');

    // 1:00 クルル #通常cl: SET UB → 直前(1:05)でON、ここでOFF
    // でも1:05で既にクルルON（インラインセット） → ここでクルルOFF
    const line1_00 = getLine(result, '1:00');
    assertIncludes(line1_00, '[〇〇〇〇❌]⬛', 'E2E: 1:00 クルル通常cl SET OFF');

    // 0:55 水モネ　クルル、リノ解除: manual + クルルOFF(already) + リノOFF
    const line0_55 = getLine(result, '0:55');
    assertIncludes(line0_55, '[〇〇❌〇ー]⬛', 'E2E: 0:55 リノ解除');
}

// === 明示的オートON/OFF指示がある場合、auto UBがオート状態を変更しないテスト ===
// テストリスト:
// [x] 「水モネ オート」でautoがOFFにならない（明示的オートオン/オフがTLに存在する場合）
console.log('\n=== auto UBと明示的オート指示の競合テスト ===');

// 14. 明示的オートON/OFF指示がある場合、auto UB（{name} オート）はauto状態を変更しない
{
    const tool = new Princessify();
    const input = [
        'マホ カスミ リノ 水モネ クルル',
        '',
        '水モネ、マホ、カスミ、リノセット　オートオフ',
        '1:22　水モネub中　水モネ解除',
        '1:17　カスミub中　クルルセット　オートオン',
        '1:07　水モネ　オート　クルル解除　オートオフ',
        '1:03　カスミub中　クルルセット　オートオン',
        '0:53　水モネ　オート　水モネセット',
        '0:51　マホub中　マホ解除',
        '0:37　水モネub中　水モネ解除',
        '0:25　クルルub中　水モネセット',
        '0:23　カスミub中　マホセット',
        '0:11　カスミub中　クルル、リノ解除　オートオフ',
        '0:01　水モネub中　クルルセット',
        '0:01　クルルub中　リノセット',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;

    // 0:53: 水モネがオートで発動。1:03でオートオンされており、0:53では明示的オートオフがない。
    // → オートはONのまま維持されるべき（✅）
    const line0_53 = getLine(result, '0:53');
    assertNotIncludes(line0_53, '👉⬛', 'auto UBはオートをOFFにしない（明示的指示がある場合）');
    assertIncludes(line0_53, '✅', '0:53でオートON維持');

    // 0:11: 明示的「オートオフ」→ ここでOFFになる
    const line0_11 = getLine(result, '0:11');
    assertIncludes(line0_11, '👉⬛', '0:11で明示的オートオフ → 👉⬛');

    // 1:07: 明示的「オートオフ」→ ここでOFFになる（auto UBだが明示的指示もある）
    const line1_07 = getLine(result, '1:07');
    assertIncludes(line1_07, '👉⬛', '1:07で明示的オートオフ → 👉⬛');
}

console.log('\n=== テスト完了 ===\n');
