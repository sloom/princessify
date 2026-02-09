// src/bot/channel-store.test.ts
import { ChannelStore } from './channel-store';
import * as fs from 'fs';
import * as path from 'path';

// 簡易アサーション
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        console.error(`❌ FAIL: ${message}\n  expected: ${e}\n  actual:   ${a}`);
        process.exitCode = 1;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

// テスト用の一時ディレクトリ
const TEST_DIR = path.join(__dirname, '../../.test-tmp');
let testCounter = 0;

function freshPath(): string {
    testCounter++;
    return path.join(TEST_DIR, `channels-${testCounter}.json`);
}

// テスト前のクリーンアップ
if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
}
fs.mkdirSync(TEST_DIR, { recursive: true });

// =============================================
// ChannelStore テスト
// =============================================

console.log('\n=== ChannelStore: 初期化テスト ===\n');

// テスト1: 空のenvChannels + ファイルなし → 空のSetで初期化
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, []);
    assert(!store.has('123'), '空の初期化: has() は false');
    assertEqual(store.listForGuild(['123']), [], '空の初期化: listForGuild は空配列');
}

// テスト2: envChannelsあり + ファイルなし → envChannelsでファイルが作成される
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, ['111', '222']);
    assert(store.has('111'), 'envシード: 111が存在する');
    assert(store.has('222'), 'envシード: 222が存在する');
    assert(fs.existsSync(filePath), 'envシード: ファイルが作成される');
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert(saved.includes('111') && saved.includes('222'), 'envシード: ファイル内容が正しい');
}

// テスト3: ファイルあり → ファイルの内容が読み込まれる（envChannels無視）
{
    const filePath = freshPath();
    fs.writeFileSync(filePath, JSON.stringify(['333', '444']));
    const store = new ChannelStore(filePath, ['555', '666']);
    assert(store.has('333'), 'ファイル優先: 333が存在する');
    assert(store.has('444'), 'ファイル優先: 444が存在する');
    assert(!store.has('555'), 'ファイル優先: envの555は無視される');
    assert(!store.has('666'), 'ファイル優先: envの666は無視される');
}

console.log('\n=== ChannelStore: add/remove テスト ===\n');

// テスト4: add: 新規チャンネル追加 → true + ファイルに保存
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, []);
    const result = store.add('100');
    assert(result === true, 'add新規: trueを返す');
    assert(store.has('100'), 'add新規: has()がtrueになる');
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert(saved.includes('100'), 'add新規: ファイルに保存される');
}

// テスト5: add: 重複チャンネル → false
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, ['100']);
    const result = store.add('100');
    assert(result === false, 'add重複: falseを返す');
}

// テスト6: remove: 存在するチャンネル → true + ファイルに保存
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, ['100', '200']);
    const result = store.remove('100');
    assert(result === true, 'remove存在: trueを返す');
    assert(!store.has('100'), 'remove存在: has()がfalseになる');
    assert(store.has('200'), 'remove存在: 他のチャンネルは残る');
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert(!saved.includes('100'), 'remove存在: ファイルから削除される');
}

// テスト7: remove: 存在しないチャンネル → false
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, ['100']);
    const result = store.remove('999');
    assert(result === false, 'remove不在: falseを返す');
}

console.log('\n=== ChannelStore: listForGuild テスト ===\n');

// テスト8: listForGuild: サーバー内チャンネルのみ返す
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, ['100', '200', '300']);
    // サーバーAには100と300が存在、200は別サーバー
    const result = store.listForGuild(['100', '300', '400']);
    assertEqual(result.sort(), ['100', '300'], 'listForGuild: サーバー内チャンネルのみ返す');
}

// テスト9: listForGuild: 一致なし → 空配列
{
    const filePath = freshPath();
    const store = new ChannelStore(filePath, ['100', '200']);
    const result = store.listForGuild(['999']);
    assertEqual(result, [], 'listForGuild: 一致なしで空配列');
}

// クリーンアップ
fs.rmSync(TEST_DIR, { recursive: true });

console.log('\n=== ChannelStore テスト完了 ===\n');
