// src/logic/princessify.test.ts
import { Princessify } from './princessify';

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

function assertEqual(actual: string, expected: string, message: string) {
    if (actual !== expected) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected: "${expected}"`);
        console.error(`   Actual:   "${actual}"`);
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
@party A B C D E

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
@party A B C D E

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
@party A B C D E

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
@party A B C D E

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
@party A B C D E

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
@party A B C D E

1:30 開始 ${test.input}
`;
    const result = tool.convert(input);
    assertIncludes(result, '1:30 開始 [〇ーーーー]', `${test.name} が [] に統一される`);
}

console.log('\n=== 括弧なしお団子テスト ===\n');

const tool6 = new Princessify();

// 括弧なしのお団子表記（XOXXX, OXOXX など）
const input6 = `
@party ユニ エリコ ペコ ルカ シズル

1:30 開始 XOXXX オートOFF
1:06 ペコ OXOXX オートOFF
1:01 ペコ OXOOX オートON
`;

const result6 = tool6.convert(input6);
console.log('--- 変換結果（括弧なし） ---');
console.log(result6);
console.log('--- テスト ---');

// 1:30 初期状態: XOXXX → [ー〇ーーー]
assertIncludes(result6, '1:30 開始 [ー〇ーーー] オートOFF', '括弧なしお団子が認識される（初期行）');

// 1:06 ペコ: XOXXX → OXOXX (index 0: OFF→ON, index 1: ON→OFF, index 2: OFF→ON)
assertIncludes(result6, '1:06 ペコ [⭕❌⭕ーー] オートOFF', '括弧なしお団子の差分計算');

// 1:01 ペコ: OXOXX → OXOOX (index 3: OFF→ON)
assertIncludes(result6, '1:01 ペコ [〇ー〇⭕ー] オートON', '括弧なしお団子の差分計算（2）');

console.log('\n=== 括弧なし複合テスト ===\n');

const tool7 = new Princessify();

// 大文字小文字混在
const input7 = `
@party A B C D E

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
@party キョウカ スズメ エリス シズル ボス

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

console.log('\n=== @party省略テスト ===\n');

const tool9 = new Princessify();

// @partyなしで、行頭付近に時間がある行を処理
const input9 = `
1:30 開始 [〇〇〇〇〇]
1:20 アクション [〇〇ーーー]
1:10 終了 [ーーーーー]
`;

const result9 = tool9.convert(input9);
console.log('--- 変換結果（@party省略） ---');
console.log(result9);
console.log('--- テスト ---');

// @partyなしでも処理される
assertIncludes(result9, '1:30 開始 [〇〇〇〇〇]', '@partyなしでも初期状態が処理される');
// [〇〇〇〇〇] → [〇〇ーーー]: index 2,3,4 が ON→OFF = ❌
assertIncludes(result9, '1:20 アクション [〇〇❌❌❌]', '@partyなしでも差分計算される');
assertIncludes(result9, '1:10 終了 [❌❌ーーー]', '@partyなしでも差分計算される（2）');

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

console.log('\n=== テスト完了 ===\n');
