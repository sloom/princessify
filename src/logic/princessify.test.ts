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
assertEqual(detectAutoState('AUTO入'), 'on', 'AUTO入 → on');
assertEqual(detectAutoState('AUTO入り'), 'on', 'AUTO入り → on');
assertEqual(detectAutoState('オート入'), 'on', 'オート入 → on');

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

    // パーティー情報がないので推論モードにはならない（初期行が生成されない）
    assertNotIncludes(result, '1:30 開始', '@dangoなしでは初期行は生成されない');
    // 既存モードでも手動指示テキストには🌟が付く
    assertIncludes(result, '🌟', '@dangoなしでも手動指示に🌟が付く（既存モード）');
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

    // 初期状態行が出力に残っている（1:30の前に配置）
    assertIncludes(result, '水モネ、マホ、カスミ、リノセット', '初期状態行: 出力に残る');

    // 1:20 マホ: 注釈なし=SET、発動でSET OFF（🌟なし）
    assertIncludes(result, '1:20 マホ [❌〇〇〇ー]⬛', '初期状態行: 1:20 マホSET発動でOFF');
}

// 10. 初期状態行なし → 従来通り全OFF
{
    const tool = new Princessify();
    const input = [
        'マホ カスミ リノ 水モネ クルル',
        '1:20 マホ',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;

    // 初期行: マホ=SET ON（注釈なし=SETのため）
    assertIncludes(result, '1:30 開始 [⭕❌❌❌❌]', '初期状態行なし: マホがSET ON');

    // 1:20 マホ: 注釈なし=SET、発動でSET OFF（🌟なし）
    assertIncludes(result, '1:20 マホ [❌ーーーー]', '初期状態行なし: マホ発動でSET OFF');
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

    // 1:20 甲: 注釈なし=SET、甲には解除コマンドあり→解釈A（発動後も⭕維持、🌟なし）
    assertIncludes(result, '1:20 甲 [〇〇〇〇ー]', '統合11: 1:20 甲発動後も⭕維持（解釈A）');

    // 1:15 乙　甲解除: 乙のmanual UB（🌟あり）+ 甲解除で甲がOFF
    const line1_15 = getLine(result, '1:15');
    assertIncludes(line1_15, '🌟', '統合11: 1:15 乙に🌟あり');
    assertIncludes(line1_15, '[❌〇〇〇ー]', '統合11: 1:15 甲解除で甲がOFF（乙丙丁はON維持）');

    // 1:10 丙: 注釈なし=SET、解除コマンドなし→解釈B（発動でSET OFF、🌟なし）→ [ー〇❌〇ー]
    assertIncludes(result, '1:10 丙 [ー〇❌〇ー]', '統合11: 1:10 丙SET発動でOFF（解釈B）');
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

    // 1:10 カスミ: 注釈なし=SET、発動でSET OFF（🌟なし）→ [〇❌〇〇ー]
    assertIncludes(result, '1:10 カスミ [〇❌〇〇ー]⬛', 'E2E: 1:10 カスミSET発動でOFF');

    // 1:05 リノ　クルルセット: manual(🌟) + クルルON → カスミは❌済み → [〇ー〇〇⭕]⬛
    const line1_05 = getLine(result, '1:05');
    assertIncludes(line1_05, '[〇ー〇〇⭕]⬛', 'E2E: 1:05 クルルセット');

    // 1:00 クルル #通常cl: SET UB → ここでクルルOFF → [〇ー〇〇❌]⬛
    const line1_00 = getLine(result, '1:00');
    assertIncludes(line1_00, '[〇ー〇〇❌]⬛', 'E2E: 1:00 クルル通常cl SET OFF');

    // 0:55 水モネ　クルル、リノ解除: manual + リノOFF → [〇ー❌〇ー]⬛
    const line0_55 = getLine(result, '0:55');
    assertIncludes(line0_55, '[〇ー❌〇ー]⬛', 'E2E: 0:55 リノ解除');
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

// === channelMode: パーティ行前の無関係行スキップテスト ===
// テストリスト:
// [ ] パーティ行の前に無関係な行（1-2語）がある → パーティ検出される
// [ ] パーティ行の前に複数の無関係な行がある → パーティ検出される
// [ ] 無関係な行のみ（5語の行なし）→ タイムスタンプあればPartyGuideError
console.log('\n=== channelMode: パーティ行前の無関係行スキップテスト ===');

// 15. パーティ行の前に1-2語の無関係行がある → パーティ検出される
{
    const tool = new Princessify();
    const input = [
        '参考tl',
        'ゆうくん様',
        'マホ カスミ リノ 水モネ クルル',
        '水モネ、マホ、カスミ、リノセット　オートオフ',
        '1:22　水モネub中　水モネ解除',
        '1:17　カスミub中　クルルセット　オートオン',
    ].join('\n');
    let result: string | null = null;
    try {
        result = tool.convert(input, { channelMode: true });
    } catch (e) {
        // パーティ検出失敗で例外が飛んだ場合
    }
    assert(result !== null, 'パーティ前に無関係行: エラーにならず結果が返る');
    if (result) {
        // パーティが正しく検出され、推論モードで動作する
        assertIncludes(result, '1:30 開始', 'パーティ前に無関係行: 初期行が生成される');
        // パーティ行自体は除去される
        assertNotIncludes(result, 'マホ カスミ リノ 水モネ クルル', 'パーティ前に無関係行: パーティ行が除去される');
    }
}

// 16. パーティ行の前に複数の無関係行 + 空行がある → パーティ検出される
{
    const tool = new Princessify();
    const input = [
        '参考tl',
        '',
        'ゆうくん様',
        '',
        'マホ カスミ リノ 水モネ クルル',
        '1:20 マホ',
    ].join('\n');
    let result: string | null = null;
    try {
        result = tool.convert(input, { channelMode: true });
    } catch (e) {
        // パーティ検出失敗で例外が飛んだ場合
    }
    assert(result !== null, '複数無関係行+空行: エラーにならず結果が返る');
    if (result) {
        assertIncludes(result, '1:30 開始', '複数無関係行+空行: 初期行が生成される');
        assertIncludes(result, '1:20 マホ', '複数無関係行+空行: 推論モード動作');
    }
}

// 17. 無関係な行のみ（5語の行なし）+ タイムスタンプあり → PartyGuideError
{
    const tool = new Princessify();
    const input = [
        '参考tl',
        'ゆうくん様',
        '1:20 甲 手動発動',
    ].join('\n');
    let caught: PartyGuideError | null = null;
    try {
        tool.convert(input, { channelMode: true });
    } catch (e) {
        if (e instanceof PartyGuideError) caught = e;
    }
    assert(caught !== null, '無関係行のみ + タイムスタンプ → PartyGuideError');
}

// === channelMode: インライン命令キーワードを含む5語行のパーティ誤検出防止テスト ===
// テストリスト:
// [ ] 「水モネ マホ カスミ リノセット オートオフ」→ パーティ定義として誤検出しない
// [ ] 「甲セット 乙 丙 丁 戊」→ パーティ定義として誤検出しない
// [ ] 正常なパーティ行（キーワードなし5語）→ 従来通り検出される
console.log('\n=== channelMode: キーワード含む5語行の誤検出防止テスト ===');

// 18. キーワード含む5語行がパーティ行より先にある → パーティ定義として誤検出しない
// 正しいパーティでは「クルル」がSET UB（🌟なし）、誤パーティでは未認識でmanual（🌟あり）
{
    const tool = new Princessify();
    const input = [
        '水モネ マホ カスミ リノセット オートオフ',  // 5語だがキーワード「セット」「オートオフ」含む → スキップされるべき
        'マホ カスミ リノ 水モネ クルル',            // 正しいパーティ行
        '1:20 マホ',
        '1:10 クルル #通常cl',                      // 正しいパーティ→SET(🌟なし)、誤パーティ→manual(🌟あり)
    ].join('\n');
    let result: string | null = null;
    try {
        result = tool.convert(input, { channelMode: true });
    } catch (e) {
        // パーティ検出失敗で例外が飛んだ場合
    }
    assert(result !== null, 'キーワード含む5語行: エラーにならず結果が返る');
    if (result) {
        // 正しいパーティ（2行目）が検出され、クルルがSET UBとして認識されている（🌟なし）
        assertNotIncludes(result, '🌟1:10', 'キーワード含む5語行: クルルがSET UBとして認識（🌟なし）');
    }
}

// 19. 先頭語にキーワードが含まれる5語行がパーティ行より先 → スキップされる
// 誤パーティでは「甲解除」がメンバー名となり「甲」にマッチしない → SET UB未認識
{
    const tool = new Princessify();
    const input = [
        '甲解除 乙 丙 丁 戊',     // 5語だが「解除」含む → スキップされるべき
        '甲 乙 丙 丁 戊',          // 正しいパーティ行
        '1:20 乙',
        '1:10 甲 #通常cl',         // 正しいパーティ→SET(🌟なし)、誤パーティ→「甲」未認識でmanual(🌟あり)
    ].join('\n');
    let result: string | null = null;
    try {
        result = tool.convert(input, { channelMode: true });
    } catch (e) {
        // パーティ検出失敗で例外が飛んだ場合
    }
    assert(result !== null, 'キーワード先頭5語行: エラーにならず結果が返る');
    if (result) {
        // 正しいパーティ（2行目）が検出され、「甲」がSET UBとして認識されている（🌟なし）
        assertNotIncludes(result, '🌟1:10', 'キーワード先頭5語行: 甲がSET UBとして認識（🌟なし）');
    }
}

// === 初期行配置と空行整理テスト ===
// テストリスト:
// [ ] 無関係行+初期状態行が1:30の前に配置される
// [ ] 連続空行が圧縮される（最大1行）
// [ ] 初期状態行がそのまま残る（除去されない）
// [ ] 先頭・末尾の余分な空行がない
console.log('\n=== 初期行配置と空行整理テスト ===');

// 20. 無関係行+初期状態行が1:30の前に、連続空行が圧縮される
{
    const tool = new Princessify();
    const input = [
        'マホ カスミ リノ 水モネ クルル',
        '',
        '参考tl',
        'ゆうくん様',
        '水モネ、マホ、カスミ、リノセット　オートオフ',
        '1:22　水モネub中　水モネ解除',
        '1:17　カスミub中　クルルセット　オートオン',
    ].join('\n');
    const result = tool.convert(input, { channelMode: true })!;
    const lines = result.split('\n');

    // 1:30行が「参考tl」「ゆうくん様」「初期状態行」の後にある
    const idx1_30 = lines.findIndex(l => l.includes('1:30 開始'));
    const idxRef = lines.findIndex(l => l.includes('参考tl'));
    const idxAuthor = lines.findIndex(l => l.includes('ゆうくん様'));
    const idxInitState = lines.findIndex(l => l.includes('水モネ、マホ、カスミ、リノセット'));

    assert(idxRef !== -1, '配置: 参考tlが出力に残る');
    assert(idxAuthor !== -1, '配置: ゆうくん様が出力に残る');
    assert(idxInitState !== -1, '配置: 初期状態行が出力に残る');
    assert(idx1_30 !== -1, '配置: 1:30行が存在する');
    assert(idxRef < idx1_30, '配置: 参考tlが1:30の前');
    assert(idxAuthor < idx1_30, '配置: ゆうくん様が1:30の前');
    assert(idxInitState < idx1_30, '配置: 初期状態行が1:30の前');

    // 先頭が空行でない
    assert(lines[0].trim() !== '', '配置: 先頭が空行でない');

    // 連続空行が3行以上ない
    const hasTripleBlank = result.includes('\n\n\n');
    assert(!hasTripleBlank, '配置: 連続空行が3行以上ない');
}

// 21. 非channelModeでも初期状態行が残り、1:30が正しく配置される
{
    const tool = new Princessify();
    const input = [
        '@dango マホ カスミ リノ 水モネ クルル',
        '水モネ、マホ、カスミ、リノセット　オートオフ',
        '1:20 マホ',
    ].join('\n');
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    // 初期状態行が出力に残る
    assertIncludes(result, '水モネ、マホ、カスミ、リノセット', '非channelMode: 初期状態行が残る');

    // 1:30行が初期状態行の後にある
    const idx1_30 = lines.findIndex(l => l.includes('1:30 開始'));
    const idxInitState = lines.findIndex(l => l.includes('水モネ、マホ、カスミ、リノセット'));
    assert(idx1_30 !== -1, '非channelMode: 1:30行が存在する');
    assert(idxInitState < idx1_30, '非channelMode: 初期状態行が1:30の前');

    // 先頭が空行でない
    assert(lines[0].trim() !== '', '非channelMode: 先頭が空行でない');
}

// === パーティ並び順表示テスト ===
// テストリスト:
// [ ] 推論モード（@dango + 5人）: 出力の1行目が [キャラ1/キャラ2/キャラ3/キャラ4/キャラ5]
// [ ] 既存モード（@dango + 5人 + お団子あり）: 出力の1行目が同形式
// [ ] 既存モード（パーティ未指定 + お団子あり）: パーティ行なし
// [ ] channelMode: 出力の1行目が同形式
console.log('\n=== パーティ並び順表示テスト ===');

// 22. 推論モード: 出力の1行目がパーティ並び順
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲 手動発動
1:10 乙 #通常cl
`;
    const result = tool.convert(input)!;
    const firstLine = result.split('\n')[0];
    assertEqual(firstLine, '[甲/乙/丙/丁/戊]', '推論モード: 1行目にパーティ並び順');
}

// 23. 既存モード（パーティ5人 + お団子あり）: 出力の1行目がパーティ並び順
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:30 開始 [〇〇〇〇〇]
1:20 甲 [〇〇❌❌❌]
`;
    const result = tool.convert(input)!;
    const firstLine = result.split('\n')[0];
    assertEqual(firstLine, '[甲/乙/丙/丁/戊]', '既存モード（パーティあり）: 1行目にパーティ並び順');
}

// 24. 既存モード（パーティ未指定 + お団子あり）: パーティ行なし
{
    const tool = new Princessify();
    const input = `@dango

1:30 開始 [〇〇〇〇〇]
1:20 A [〇〇❌❌❌]
`;
    const result = tool.convert(input)!;
    assertNotIncludes(result, '[/', '既存モード（パーティなし）: パーティ行なし');
}

// 25. channelMode: 出力の1行目がパーティ並び順
{
    const tool = new Princessify();
    const input = `甲 乙 丙 丁 戊

1:20 甲 手動発動
1:10 乙 #通常cl
`;
    const result = tool.convert(input, { channelMode: true })!;
    const firstLine = result.split('\n')[0];
    assertEqual(firstLine, '[甲/乙/丙/丁/戊]', 'channelMode: 1行目にパーティ並び順');
}

// === 既存モード: 初期状態行テスト ===
// テストリスト:
// [ ] 初期状態行(XXOOO)がタイムスタンプ前にある → 最初のエントリは初期状態との差分
// [ ] 初期状態行にオートオン指示 → オート状態がONから開始、差分表示も正しい
// [ ] 括弧付き初期状態行 [XXOOO] → 正しく検出
// [ ] 初期状態行がない → 従来通りrenderInitialState（回帰テスト）
console.log('\n=== 既存モード: 初期状態行テスト ===');

// 26. 初期状態行(XXOOO)がタイムスタンプ前にある → 最初のエントリは初期状態との差分
{
    const tool = new Princessify();
    const input = `XXOOO

0:54 甲 OOXOO
0:51 乙 OOOOO
`;
    const result = tool.convert(input)!;
    // XXOOO=[F,F,T,T,T] → OOXOO=[T,T,F,T,T]: ⭕⭕❌〇〇
    assertIncludes(result, '[⭕⭕❌〇〇]', '初期状態行: 最初のエントリは初期状態との差分');
    // OOXOO=[T,T,F,T,T] → OOOOO=[T,T,T,T,T]: 〇〇⭕〇〇
    assertIncludes(result, '[〇〇⭕〇〇]', '初期状態行: 2番目のエントリも正しい差分');
}

// 27. 初期状態行にオートオン指示 → オート状態がONから始まる
{
    const tool = new Princessify();
    const input = `XXOOO オートオン

0:54 甲 OOXOO オートオフ
`;
    const result = tool.convert(input)!;
    // Auto: ON→OFF = 👉⬛
    assertIncludes(result, '[⭕⭕❌〇〇]👉⬛', '初期状態行: お団子とオート(ON→OFF)の両方が正しい');
}

// 28. 括弧付き初期状態行 [XXOOO] → 正しく検出
{
    const tool = new Princessify();
    const input = `[XXOOO]

0:54 甲 OOXOO
`;
    const result = tool.convert(input)!;
    assertIncludes(result, '[⭕⭕❌〇〇]', '括弧付き初期状態行: 正しく検出');
}

// 29. 初期状態行がない → 従来通りの動作（回帰テスト）
{
    const tool = new Princessify();
    const input = `0:54 甲 OOXOO
0:51 乙 OOOOO
`;
    const result = tool.convert(input)!;
    // 初期状態なし、最初のエントリは renderInitialState: OOXOO → [〇〇ー〇〇]
    assertIncludes(result, '[〇〇ー〇〇]', '初期状態なし: 従来通りrenderInitialState');
}

// === @dan / -dan プレフィックス対応テスト ===
// テストリスト:
// [ ] @dan + パーティ5人 → 推論モードで動作
// [ ] @danger → トリガーとして誤検出しない
// [ ] @mo → dangoトリガーとして誤検出しない（mochiの管轄）
console.log('\n=== @dan プレフィックステスト ===');

// 30. @dan + パーティ5人 → 推論モードで動作
{
    const tool = new Princessify();
    const input = `@dan 甲 乙 丙 丁 戊

1:20 甲 手動発動
`;
    const result = tool.convert(input)!;
    assertIncludes(result, '🌟', '@dan: 推論モードで動作');
}

// 31. @danger → トリガーとして誤検出しない
{
    const tool = new Princessify();
    const input = `@danger 注意

1:20 甲 OOOOO
`;
    const result = tool.convert(input)!;
    assertIncludes(result, '@danger', '@danger: トリガーとして誤検出しない');
}

// 32. @mo → dangoトリガーとして誤検出しない（mochiの管轄）
{
    const tool = new Princessify();
    const input = `@mo 甲 乙 丙 丁 戊

1:20 甲 OOOOO
`;
    const result = tool.convert(input)!;
    assertIncludes(result, '@mo', '@mo: dangoトリガーとして誤検出しない');
}

// ========================================
// 33. 複数行団子マージ（基本）
// タイムスタンプ行の次行に団子がある場合、色付け団子がタイムスタンプ行に表示されること
// ========================================
console.log('\n=== 33. 複数行団子マージ（基本） ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲
【ーーーーー】
1:10 乙
【ーーーー◯】
`;
    const result = tool.convert(input)!;
    // 1:20 甲 の行に色付け団子が含まれること
    const lines = result.split('\n');
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    assertIncludes(line120 ?? '', 'ー', '33a: 1:20行に団子文字が含まれる');
    // 継続行の生団子【ーーーーー】が出力から除去されること
    assertNotIncludes(result, '【ーーーーー】', '33b: 継続行の生団子が除去される');
    // 1:10 乙 の行に色付け団子が含まれること
    const line110 = lines.find(l => l.includes('1:10') && l.includes('乙'));
    assertIncludes(line110 ?? '', '⭕', '33c: 1:10行にOFF→ONの差分(⭕)が含まれる');
    assertNotIncludes(result, '【ーーーー◯】', '33d: 継続行の生団子が除去される');
}

// ========================================
// 34. 複数行団子＋AUTO指示マージ
// 次行に 【ーーーーー】AUTO入 がある場合、団子とAUTO状態の両方がマージされること
// ========================================
console.log('\n=== 34. 複数行団子＋AUTO指示マージ ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲
【ーーーーー】　AUTO ON
1:10 乙
【ーーーー◯】　AUTO OFF
`;
    const result = tool.convert(input)!;
    // AUTO ON → ✅ が1:20行に表示される
    const lines = result.split('\n');
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    assertIncludes(line120 ?? '', '✅', '34a: 1:20行にAUTO ON(✅)が含まれる');
    // AUTO OFF → ⬛ が1:10行に表示される
    const line110 = lines.find(l => l.includes('1:10') && l.includes('乙'));
    assertIncludes(line110 ?? '', '⬛', '34b: 1:10行にAUTO OFF(⬛)が含まれる');
    // 継続行のAUTOテキストがタイムスタンプ行に転記される
    assertIncludes(line120 ?? '', 'AUTO ON', '34c: AUTO ONテキストが1:20行に転記される');
    assertIncludes(line110 ?? '', 'AUTO OFF', '34d: AUTO OFFテキストが1:10行に転記される');
}

// ========================================
// 35. プリアンブルスキップ（channelMode）
// 「◆ユニオンバースト発動時間」以前をTL解析対象から除外し、出力にはそのまま残すこと
// ========================================
console.log('\n=== 35. プリアンブルスキップ（channelMode） ===');
{
    const tool = new Princessify();
    const input = `TL参考:Ark様
MS…117
----
◆パーティ編成
ジータ ★5 Lv367 RANK39
ミソラ ★5 Lv367 RANK39
----
◆ユニオンバースト発動時間
1:20 甲
【ーーーーー】
1:10 乙
【ーーーー◯】
`;
    try {
        const result = tool.convert(input, { channelMode: true })!;
        // プリアンブルが出力に残っている
        assertIncludes(result, 'TL参考:Ark様', '35a: プリアンブルが出力に残る');
        assertIncludes(result, '◆パーティ編成', '35b: パーティ編成行が出力に残る');
        assertIncludes(result, '◆ユニオンバースト発動時間', '35c: マーカー行が出力に残る');
        // TL部分は色付けされている（エラーにならない）
        assert(result !== null, '35d: エラーにならずに結果を返す');
        // 継続行の生団子は除去される
        assertNotIncludes(result, '【ーーーーー】', '35e: 継続行の生団子が除去される');
    } catch (e) {
        console.error(`❌ FAIL: 35: エラーが発生: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
        process.exitCode = 1;
    }
}

// ========================================
// 36. 同行団子と複数行団子の混在
// 一部は同行に団子あり、一部は次行 → 両方正しく処理されること
// ========================================
console.log('\n=== 36. 同行団子と複数行団子の混在 ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲
【ーーーーー】
1:10 乙 【ーーーー◯】
1:00 丙
【ーーー◯◯】
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    // 1:20 甲 → 複数行団子（マージ）
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    assertIncludes(line120 ?? '', 'ー', '36a: 1:20行に団子が含まれる（マージ）');
    // 1:10 乙 → 同行団子（既存動作）
    const line110 = lines.find(l => l.includes('1:10') && l.includes('乙'));
    assertIncludes(line110 ?? '', '⭕', '36b: 1:10行にOFF→ON差分が含まれる（同行）');
    // 1:00 丙 → 複数行団子（マージ）
    const line100 = lines.find(l => l.includes('1:00') && l.includes('丙'));
    assertIncludes(line100 ?? '', '⭕', '36c: 1:00行にOFF→ON差分が含まれる（マージ）');
}

// ========================================
// 37. パーティなし既存モード（channelMode）
// channelModeで団子ありパーティなし → エラーにならず色付け動作
// ========================================
console.log('\n=== 37. パーティなし既存モード ===');
{
    const tool = new Princessify();
    const input = `1:20 甲
【ーーーーー】
1:10 乙
【ーーーー◯】
`;
    try {
        const result = tool.convert(input, { channelMode: true })!;
        // エラーにならない
        assert(result !== null, '37a: パーティなしでもエラーにならない');
        // 色付けされている
        const lines = result.split('\n');
        const line120 = lines.find(l => l.includes('1:20'));
        assertIncludes(line120 ?? '', 'ー', '37b: 1:20行に団子が含まれる');
    } catch (e) {
        console.error(`❌ FAIL: 37: エラーが発生: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
        process.exitCode = 1;
    }
}

// ========================================
// 38. 継続行除去で空行が生じない
// マージした継続行が完全に除去され、空行として残らない
// ========================================
console.log('\n=== 38. 継続行除去で空行が生じない ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲
【ーーーーー】
1:10 乙
【ーーーー◯】
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    // 1:20甲の行と1:10乙の行は隣接しているべき（間に空行がない）
    const idx120 = lines.findIndex(l => l.includes('1:20') && l.includes('甲'));
    const idx110 = lines.findIndex(l => l.includes('1:10') && l.includes('乙'));
    assertEqual(idx110, idx120 + 1, '38a: 継続行除去後、1:20と1:10の間に空行がない');
}

// ========================================
// 39. AUTO入/切テキストがタイムスタンプ行に転記される
// 継続行のAUTO入/切テキストが消えずにタイムスタンプ行に残る
// ========================================
console.log('\n=== 39. AUTO入/切テキストのタイムスタンプ行転記 ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲
【ーーーーー】　AUTO入
1:10 乙
【ーーーー◯】　AUTO切
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    const line110 = lines.find(l => l.includes('1:10') && l.includes('乙'));
    // AUTO入テキストがタイムスタンプ行に転記されている
    assertIncludes(line120 ?? '', 'AUTO入', '39a: AUTO入が1:20行に転記される');
    // AUTO切テキストがタイムスタンプ行に転記されている
    assertIncludes(line110 ?? '', 'AUTO切', '39b: AUTO切が1:10行に転記される');
    // 継続行が完全に除去されている（空行にならない）
    const idx120 = lines.findIndex(l => l.includes('1:20') && l.includes('甲'));
    const idx110 = lines.findIndex(l => l.includes('1:10') && l.includes('乙'));
    assertEqual(idx110, idx120 + 1, '39c: 継続行除去後、空行がない');
}

// ========================================
// 40. 元からある空行は保持される
// 入力にある空行はそのまま残り、マージ由来の空行だけが消える
// ========================================
console.log('\n=== 40. 元からある空行の保持 ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲
【ーーーーー】

1:10 乙 敵UB

1:00 丙
【ーーーー◯】
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    // 1:20と敵UB行の間に空行がある（入力にあった空行）
    const idx120 = lines.findIndex(l => l.includes('1:20') && l.includes('甲'));
    const idxEnemy = lines.findIndex(l => l.includes('1:10') && l.includes('乙'));
    assert(idxEnemy > idx120 + 1, '40a: 元からある空行が保持される');
    // 1:00丙と次の行の間に空行がない（マージ由来）
    const idx100 = lines.findIndex(l => l.includes('1:00') && l.includes('丙'));
    // 1:00丙の直前が空行でないことを確認（マージ由来の空行がない）
    assert(idx100 === idxEnemy + 2 || idx100 === idxEnemy + 3, '40b: 元の空行のみ保持、マージ空行なし');
}

// ========================================
// 41. 🌟: パーティあり + 手動指示テキスト → 🌟が付く
// ========================================
console.log('\n=== 41. 既存モードで手動指示に🌟 ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲 ソングデバフ後 【ーーーーー】
1:10 乙
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    assertIncludes(line120 ?? '', '🌟', '41a: 手動指示テキストがある行に🌟');
    // 指示テキストがない行には🌟なし
    const line110 = lines.find(l => l.includes('1:10') && l.includes('乙'));
    assertNotIncludes(line110 ?? '', '🌟', '41b: 名前のみの行に🌟なし');
}

// ========================================
// 42. 🌟: パーティなし + 手動指示テキスト → 🌟が付く
// ========================================
console.log('\n=== 42. パーティなし既存モードで手動指示に🌟 ===');
{
    const tool = new Princessify();
    const input = `1:20 ランファ　ソングデバフ後
【ーーーーー】
1:10 ジータ
【ーーーーー】
`;
    try {
        const result = tool.convert(input, { channelMode: true })!;
        const lines = result.split('\n');
        const lineRan = lines.find(l => l.includes('1:20') && l.includes('ランファ'));
        assertIncludes(lineRan ?? '', '🌟', '42a: パーティなしでも手動指示に🌟');
        // 名前のみの行には🌟なし
        const lineJi = lines.find(l => l.includes('1:10') && l.includes('ジータ'));
        assertNotIncludes(lineJi ?? '', '🌟', '42b: パーティなし・名前のみに🌟なし');
    } catch (e) {
        console.error(`❌ FAIL: 42: エラー: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
        process.exitCode = 1;
    }
}

// ========================================
// 43. 🌟: AUTO UB に🌟なし
// ========================================
console.log('\n=== 43. AUTO UBに🌟なし ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲 手動発動 【ーーーーー】
1:10 乙 AUTO 【ーーーーー】
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    assertIncludes(line120 ?? '', '🌟', '43a: 手動行に🌟');
    const line110 = lines.find(l => l.includes('1:10') && l.includes('乙'));
    assertNotIncludes(line110 ?? '', '🌟', '43b: AUTO行に🌟なし');
}

// ========================================
// 44. 🌟: サブ行・敵UB・バトル開始に🌟なし
// ========================================
console.log('\n=== 44. サブ行・敵UB・開始終了に🌟なし ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:30 バトル開始 【ーーーーー】
1:20 甲 手動だよ 【ーーーーー】
(1:15 ワイバーン 補足テキスト) 【ーーーーー】
1:10 敵UB 【ーーーーー】
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    // バトル開始に🌟なし
    const lineStart = lines.find(l => l.includes('1:30') && l.includes('バトル開始'));
    assertNotIncludes(lineStart ?? '', '🌟', '44a: バトル開始に🌟なし');
    // 手動行に🌟
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    assertIncludes(line120 ?? '', '🌟', '44b: 手動行に🌟');
    // サブ行に🌟なし
    const lineSub = lines.find(l => l.includes('1:15') && l.includes('ワイバーン'));
    assertNotIncludes(lineSub ?? '', '🌟', '44c: サブ行に🌟なし');
    // 敵UBに🌟なし
    const lineEnemy = lines.find(l => l.includes('1:10') && l.includes('敵UB'));
    assertNotIncludes(lineEnemy ?? '', '🌟', '44d: 敵UBに🌟なし');
}

// ========================================
// 45. 🌟: 団子のみの行に🌟なし（既存テスト24と同等）
// ========================================
console.log('\n=== 45. 団子のみの行に🌟なし ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:30 開始 【〇〇〇〇〇】
1:20 甲 【〇〇ーーー】
`;
    const result = tool.convert(input)!;
    assertNotIncludes(result, '🌟', '45a: 団子のみの既存モードで🌟なし');
}

// ========================================
// 46. 🌟: 継続行マージ + 手動指示テキスト → 🌟が付く
// ========================================
console.log('\n=== 46. 継続行マージ + 手動指示に🌟 ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:20 甲 アンドレバフ後早め
【ーーーーー】　AUTO入
1:10 乙
【ーーーーー】　AUTO切
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const line120 = lines.find(l => l.includes('1:20') && l.includes('甲'));
    assertIncludes(line120 ?? '', '🌟', '46a: 継続行マージ後も手動指示に🌟');
    const line110 = lines.find(l => l.includes('1:10') && l.includes('乙'));
    assertNotIncludes(line110 ?? '', '🌟', '46b: 名前のみ + 継続行に🌟なし');
}

// ========================================
// 47. 裸のon/off: detectAutoState + 🌟抑制 + バトル開始除外
// ========================================
console.log('\n=== 47. 裸のon/off対応 ===');

// 47a: detectAutoState — 裸の "off" を認識
assert(detectAutoState('[〇ー〇〇ー]off') === 'off', '47a: 裸off → off');

// 47b: detectAutoState — 裸の "on" を認識
assert(detectAutoState('[〇ー〇〇ー]on') === 'on', '47b: 裸on → on');

// 47c: detectAutoState — 大文字もOK
assert(detectAutoState('[〇ー〇〇ー]OFF') === 'off', '47c: 裸OFF → off');
assert(detectAutoState('[〇ー〇〇ー]ON') === 'on', '47d: 裸ON → on');

// 47e: detectAutoState — 単語内の on/off には反応しない
assert(detectAutoState('1:04 offensive attack') === null, '47e: offensive → null');
assert(detectAutoState('1:04 ongoing battle') === null, '47f: ongoing → null');

// 47g: E2E — [団子]off の行に🌟が付かない + オートOFFが効く
{
    const tool = new Princessify();
    const input = `-dango
1:30 バトル開始　[〇ー〇〇ー]off
1:13 ヴルム　　　[〇〇〇〇ー]
1:04 ユイ　　　　秒数目押し　オートON
　　　　　　　　[〇〇〇〇ー]on
0:45 ヴルム　　　[〇〇ーー〇]off
0:25 ユイ　　　　[〇ー〇〇ー]on`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    // バトル開始に🌟なし
    const battleStart = lines.find(l => l.includes('1:30') && l.includes('バトル開始'));
    assertNotIncludes(battleStart ?? '', '🌟', '47g: バトル開始に🌟なし');

    // [団子]off行に🌟なし
    const vurm045 = lines.find(l => l.includes('0:45') && l.includes('ヴルム'));
    assertNotIncludes(vurm045 ?? '', '🌟', '47h: [団子]off行に🌟なし');

    // [団子]on行に🌟なし
    const yui025 = lines.find(l => l.includes('0:25') && l.includes('ユイ'));
    assertNotIncludes(yui025 ?? '', '🌟', '47i: [団子]on行に🌟なし');

    // 秒数目押し行には🌟あり（これは正しい動作）
    const yui104 = lines.find(l => l.includes('1:04') && l.includes('ユイ'));
    assertIncludes(yui104 ?? '', '🌟', '47j: 秒数目押し行には🌟あり');

    // オート状態: 初期OFF→off指示なのでOFF維持(⬛)
    assertIncludes(battleStart ?? '', '⬛', '47k: バトル開始でオートOFF維持(⬛)');

    // 0:45 ヴルムのoffでオートOFF
    assertIncludes(vurm045 ?? '', '👉⬛', '47l: 0:45でオートOFF(👉⬛)');

    // 0:25 ユイのonでオートON
    assertIncludes(yui025 ?? '', '👉✅', '47m: 0:25でオートON(👉✅)');
}

// 47n: バトル終了にも🌟なし
{
    const tool = new Princessify();
    const input = `-dango
1:30 バトル開始　[〇ー〇〇ー]
0:00 バトル終了`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const battleEnd = lines.find(l => l.includes('0:00') && l.includes('バトル終了'));
    assertNotIncludes(battleEnd ?? '', '🌟', '47n: バトル終了に🌟なし');
}

// ========================================
// 47o. 🌟: boss/ボス/敵で始まる行に🌟なし
// ========================================
console.log('\n=== 47o. boss/ボス/敵キーワードに🌟なし ===');
{
    const tool = new Princessify();
    const input = `-dango
1:30 バトル開始　[〇ー〇〇ー]
0:05 boss ヴァンピ　退場;w;
0:04 ボス 特殊行動
0:03 敵 全体攻撃`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    const bossLine = lines.find(l => l.includes('0:05') && l.includes('boss'));
    assertNotIncludes(bossLine ?? '', '🌟', '47o-1: boss行に🌟なし');

    const bosuLine = lines.find(l => l.includes('0:04') && l.includes('ボス'));
    assertNotIncludes(bosuLine ?? '', '🌟', '47o-2: ボス行に🌟なし');

    const tekiLine = lines.find(l => l.includes('0:03') && l.includes('敵'));
    assertNotIncludes(tekiLine ?? '', '🌟', '47o-3: 敵行に🌟なし');
}

// ========================================
// 48. 🌟: 【オートON/OFF】のみの行に🌟なし
// ========================================
console.log('\n=== 48. 【オートON/OFF】のみの行に🌟なし ===');
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊
✕〇〇✕〇　【オートOFF】

1:16 甲　✕〇〇〇〇　【オートON】
1:11 乙　〇〇〇〇✕　【オートOFF】
1:08 丙　〇✕〇〇〇
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    // 【オートON】のみの行に🌟なし
    const line116 = lines.find(l => l.includes('1:16') && l.includes('甲'));
    assertNotIncludes(line116 ?? '', '🌟', '48a: 【オートON】のみの行に🌟なし');

    // 【オートOFF】のみの行に🌟なし
    const line111 = lines.find(l => l.includes('1:11') && l.includes('乙'));
    assertNotIncludes(line111 ?? '', '🌟', '48b: 【オートOFF】のみの行に🌟なし');

    // 通常行にも🌟なし（キャラ名のみ）
    const line108 = lines.find(l => l.includes('1:08') && l.includes('丙'));
    assertNotIncludes(line108 ?? '', '🌟', '48c: キャラ名のみの行に🌟なし');
}

// 48d: 【オートON】＋手動指示テキストがある場合は🌟あり
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:16 甲 ソングデバフ後 ✕〇〇〇〇　【オートON】
1:11 乙　〇〇〇〇✕　【オートOFF】
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    // 手動指示テキスト＋【オートON】→🌟あり
    const line116 = lines.find(l => l.includes('1:16') && l.includes('甲'));
    assertIncludes(line116 ?? '', '🌟', '48d: 手動指示テキスト＋【オートON】→🌟あり');
}

// 49: SET{キャラ名}/{名前}セット/{名前}解除 を含む行に🌟が付かないこと

// 49a: パーティなし既存モードで SET{キャラ名} に🌟なし
{
    const tool = new Princessify();
    const input = `元TL：
OOOOO  Auto on
1:16   マホ   XOXXO
1:09   アイラ   XOXOX
0:02   ネフィ   SETスミレ   OOOXO
0:01   BOSSUB   SETアイラ   OOOOO
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    const line002 = lines.find(l => l.includes('0:02') && l.includes('ネフィ'));
    assertNotIncludes(line002 ?? '', '🌟', '49a: SETスミレを含む行に🌟なし');

    const line001 = lines.find(l => l.includes('0:01') && l.includes('BOSSUB'));
    assertNotIncludes(line001 ?? '', '🌟', '49b: SETアイラを含む行に🌟なし');
}

// 49c: パーティあり既存モードで {名前}セット に🌟なし
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:16   甲   XOXXO
0:02   丙   甲セット   OOOXO
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const line002 = lines.find(l => l.includes('0:02') && l.includes('丙'));
    assertNotIncludes(line002 ?? '', '🌟', '49c: {名前}セットを含む行に🌟なし');
}

// 49d: パーティあり既存モードで {名前}解除 に🌟なし
{
    const tool = new Princessify();
    const input = `@dango 甲 乙 丙 丁 戊

1:16   甲   XOXXO
0:02   丙   甲解除   OOOXO
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const line002 = lines.find(l => l.includes('0:02') && l.includes('丙'));
    assertNotIncludes(line002 ?? '', '🌟', '49d: {名前}解除を含む行に🌟なし');
}

// 50: キャラ名＋団子の継続行がマージされないこと
console.log('\n=== 50. キャラ名＋団子の継続行はマージしない ===');

// 50a: キャラ名＋団子の行が別行として出力に残ること
{
    const tool = new Princessify();
    const input = `〇－〇〇〇　オートOFF
1:05 ランファ　〇〇〇〇〇
     エキドナ　〇－〇〇〇
0:51 バーン　　〇〇〇〇〇
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    // ランファ行が出力に存在すること
    const ranfaLine = lines.find(l => l.includes('1:05') && l.includes('ランファ'));
    assertIncludes(ranfaLine ?? '', 'ランファ', '50a-1: ランファ行が出力に存在');

    // エキドナ行が出力に存在すること（マージされていないこと）
    const ekidoLine = lines.find(l => l.includes('エキドナ'));
    assertIncludes(ekidoLine ?? '', 'エキドナ', '50a-2: エキドナ行が出力に存在（マージされない）');
}

// 50b: ランファの団子がエキドナの団子で上書きされないこと
{
    const tool = new Princessify();
    const input = `〇〇〇〇〇
1:05 ランファ　〇〇〇〇〇
     エキドナ　〇－〇〇〇
0:51 バーン　　〇〇〇〇〇
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    const ranfaLine = lines.find(l => l.includes('1:05') && l.includes('ランファ'));
    // ランファの団子は全〇 → 前と同じなので差分なし（ー表示になるはず）
    // 重要なのは「❌」が含まれないこと（エキドナの〇－〇〇〇がマージされていない証拠）
    assertNotIncludes(ranfaLine ?? '', '❌', '50b: ランファの団子にエキドナの❌が混入しない');
}

// 50c: 純粋な団子のみの継続行は従来通りマージされること
{
    const tool = new Princessify();
    const input = `〇〇〇〇〇
1:05 ランファ
     〇〇〇〇〇
0:51 バーン　　〇〇〇〇〇
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    // ランファ行に団子が含まれている（マージされている）こと
    const ranfaLine = lines.find(l => l.includes('1:05') && l.includes('ランファ'));
    assertIncludes(ranfaLine ?? '', '〇', '50c: 団子のみ継続行はランファ行にマージされる');
}

// 50d: キャラ名＋団子＋AUTO指示の継続行もマージされないこと
{
    const tool = new Princessify();
    const input = `〇〇〇〇〇
0:51 バーン　　〇〇〇〇〇
     エキドナ　〇－〇〇〇　オートON
0:17 スミレ　　〇〇－〇〇
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');

    const ekidoLine = lines.find(l => l.includes('エキドナ'));
    assertIncludes(ekidoLine ?? '', 'エキドナ', '50d: キャラ名＋団子＋AUTO行もマージされない');
}

// 51: 「切」(AUTO OFF相当)に🌟が付かないこと
console.log('\n=== 51. 「切」に🌟なし ===');

// 51a: 団子の後の「切」に🌟なし
{
    const tool = new Princessify();
    const input = `〇〇〇〇〇
1:30　〇ー〇〇〇　切
1:05　ランファ　〇〇〇〇〇
`;
    const result = tool.convert(input)!;
    const lines = result.split('\n');
    const line130 = lines.find(l => l.includes('1:30'));
    assertNotIncludes(line130 ?? '', '🌟', '51a: 「切」に🌟なし');
}

// =============================================
// 推論モード: Phase X - 注釈なし=SET / (Auto)括弧対応
// =============================================

console.log('\n=== 推論モード: 注釈なし=SET、(Auto)対応 ===\n');

// テストX1: 注釈なし → 'set'
assertEqual(classifyUBType('', '1:19 クリア'), 'set', '注釈なし（空文字）→ set');
assertEqual(classifyUBType('   ', '1:19 クリア'), 'set', 'スペースのみ → set');

// テストX2: (Auto)括弧付き → 'auto'
assertEqual(classifyUBType('(Auto)', '1:14 ワカナ(Auto)'), 'auto', '(Auto) → auto');
assertEqual(classifyUBType('(オート)', '1:14 ワカナ(オート)'), 'auto', '(オート) → auto');

// テストX3: 注釈なしUBの推論統合テスト
// 甲（最初・注釈なし=SET）→ 初期行で⭕
// 乙（手動注釈あり）→ 🌟あり、乙の行で丙が⭕
// 丙（3番目・注釈なし=SET）→ 🌟なし、発動行で❌
{
    const tool = new Princessify();
    const input = `
@dango 甲 乙 丙 丁 戊

1:20 甲
1:10 乙 手動注釈
1:00 丙
`;
    const result = tool.convert(input);
    console.log('--- 推論結果（注釈なし=SET統合）---');
    console.log(result);
    console.log('--- テスト ---');

    // 初期行で甲がSET ON（最初エントリが注釈なし=SET）
    assertIncludes(result, '1:30 開始 [⭕', '注釈なし最初エントリ → 初期行で甲SET ON');
    // 甲の発動行に🌟なし
    assertNotIncludes(result, '🌟1:20', '注釈なしSET行に🌟は付かない');
    // 甲発動でSET OFF
    assertIncludes(result, '[❌ーーーー]', '甲発動行でSET OFF');
    // 乙（手動注釈）→ 🌟あり
    assertIncludes(result, '🌟1:10 乙 手動注釈', '手動注釈行に🌟あり');
    // 乙の行で丙がSET ON（丙が次に打つため）
    assertIncludes(result, '[ーー⭕ーー]', '乙の行で丙がSET ON');
    // 丙（注釈なし=SET）→ 🌟なし、SET OFF
    assertNotIncludes(result, '🌟1:00', '注釈なし丙行に🌟なし');
    assertIncludes(result, '[ーー❌ーー]', '丙発動行でSET OFF');
}

// テストX4: (Auto)括弧付き推論統合テスト
{
    const tool = new Princessify();
    const input = `
@dango 甲 乙 丙 丁 戊

1:20 甲
1:10 乙 (Auto)
1:00 丙
`;
    const result = tool.convert(input);
    console.log('--- 推論結果（(Auto)括弧）---');
    console.log(result);
    console.log('--- テスト ---');

    // (Auto)行に🌟なし
    assertNotIncludes(result, '🌟1:10 乙', '(Auto)行に🌟なし');
    // auto推論：直前にAUTO ON
    assertIncludes(result, '👉✅', '(Auto)直前にAUTO ON');
    // auto推論：発動行でAUTO OFF
    assertIncludes(result, '👉⬛', '(Auto)発動行にAUTO OFF');
}

// テストX5: 解釈A（解除コマンドあり）vs 解釈B（解除コマンドなし）の区別
// 甲: 1:15に「甲解除」あり → 1:20発動後も⭕維持（解釈A）
// 丙: 解除コマンドなし → 1:10発動後に❌（解釈B）
{
    const tool = new Princessify();
    const input = `
@dango 甲 乙 丙 丁 戊
甲セット
1:20 甲
1:15 乙　甲解除
1:10 丙
`;
    const result = tool.convert(input);
    console.log('--- 推論結果（解釈A vs 解釈B）---');
    console.log(result);
    console.log('--- テスト ---');

    // 解釈A: 甲には解除コマンドあり → 発動後も⭕維持（[〇...]）
    assertIncludes(result, '1:20 甲 [〇ーーーー]', '解釈A: 甲発動後も⭕維持');
    assertNotIncludes(result, '🌟1:20', '解釈A: 甲に🌟なし（SETなので）');
    // 甲解除のある乙行で甲が❌になる
    assertIncludes(result, '🌟1:15 乙', '解釈A: 乙はmanualで🌟あり');
    assertIncludes(result, '[❌ー⭕ーー]', '解釈A: 甲解除行で甲が❌、丙が⭕');
    // 解釈B: 丙には解除コマンドなし → 発動後に❌
    assertIncludes(result, '1:10 丙 [ーー❌ーー]', '解釈B: 丙発動後に❌');
    assertNotIncludes(result, '🌟1:10', '解釈B: 丙に🌟なし（SETなので）');
}

console.log('\n=== テスト完了 ===\n');
