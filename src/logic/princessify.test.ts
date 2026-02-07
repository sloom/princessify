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

console.log('\n=== テスト完了 ===\n');
