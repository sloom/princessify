// src/bot/override-store.test.ts
// OverrideStore テスト

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OverrideStore, StoredOverride } from './override-store';

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

// テスト用の一時ファイルパスを生成
function tmpFilePath(): string {
    return path.join(os.tmpdir(), `override-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

// テスト用のエントリを生成
function makeEntry(overrides?: Partial<StoredOverride>): StoredOverride {
    return {
        targetUserId: '111',
        targetDisplayName: 'テストユーザー',
        date: '2026/2/25',
        gameDayMs: 1740351600000,  // 2026/2/25 JST 05:00
        rolls: [1, 2, 3, 1],
        totalGems: 1450,
        registeredBy: '999',
        registeredAt: '2026-02-27T10:00:00.000Z',
        ...overrides,
    };
}

// ============================================================
// Phase A: OverrideStore 基本操作
// ============================================================

console.log('\n=== Phase A: OverrideStore 基本操作 ===\n');

// [A-01] ファイルなし → list は空配列
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    const result = store.list('ch1');
    assertDeepEqual(result, [], '[A-01] ファイルなし → list は空配列');
}

// [A-02] set → list で取得可能
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    const entry = makeEntry();
    store.set('ch1', entry);
    const list = store.list('ch1');
    assertEqual(list.length, 1, '[A-02] set → list の件数は1');
    assertEqual(list[0].targetUserId, '111', '[A-02] set → list でユーザーID取得可能');
    assertDeepEqual(list[0].rolls, [1, 2, 3, 1], '[A-02] set → list で rolls 取得可能');
    // cleanup
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-03] 同一 channel+user+date の set は上書き
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry({ rolls: [1, 1, 1, 1], totalGems: 2000 }));
    store.set('ch1', makeEntry({ rolls: [4, 4, 4, 4], totalGems: 1000 }));
    const list = store.list('ch1');
    assertEqual(list.length, 1, '[A-03] 同一キーは上書き → 件数1');
    assertDeepEqual(list[0].rolls, [4, 4, 4, 4], '[A-03] 同一キーは上書き → rolls更新');
    assertEqual(list[0].totalGems, 1000, '[A-03] 同一キーは上書き → totalGems更新');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-04] 同一ユーザーの別日付は別エントリ
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry({ date: '2026/2/25', gameDayMs: 1740351600000 }));
    store.set('ch1', makeEntry({ date: '2026/2/26', gameDayMs: 1740438000000 }));
    const list = store.list('ch1');
    assertEqual(list.length, 2, '[A-04] 別日付は別エントリ → 件数2');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-05] 別チャンネルは独立
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry());
    store.set('ch2', makeEntry({ targetUserId: '222', targetDisplayName: '別ユーザー' }));
    assertEqual(store.list('ch1').length, 1, '[A-05] ch1 は1件');
    assertEqual(store.list('ch2').length, 1, '[A-05] ch2 は1件');
    assertEqual(store.list('ch1')[0].targetUserId, '111', '[A-05] ch1 のユーザーは111');
    assertEqual(store.list('ch2')[0].targetUserId, '222', '[A-05] ch2 のユーザーは222');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-06] remove: 存在 → true + 削除
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry());
    const removed = store.remove('ch1', '111', '2026/2/25');
    assert(removed === true, '[A-06] remove 存在 → true');
    assertEqual(store.list('ch1').length, 0, '[A-06] remove 後 list は空');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-07] remove: 非存在 → false
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    const removed = store.remove('ch1', '999', '2026/2/25');
    assert(removed === false, '[A-07] remove 非存在 → false');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-08] clear: 全削除 → 件数返却
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry({ targetUserId: '111' }));
    store.set('ch1', makeEntry({ targetUserId: '222', targetDisplayName: 'ユーザー2' }));
    store.set('ch1', makeEntry({ targetUserId: '333', targetDisplayName: 'ユーザー3', date: '2026/2/26', gameDayMs: 1740438000000 }));
    const count = store.clear('ch1');
    assertEqual(count, 3, '[A-08] clear → 削除件数3');
    assertEqual(store.list('ch1').length, 0, '[A-08] clear 後 list は空');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-09] clear: 空 → 0
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    const count = store.clear('ch1');
    assertEqual(count, 0, '[A-09] clear 空チャンネル → 0');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [A-10] 永続化: set → 新インスタンスで読み戻し
{
    const fp = tmpFilePath();
    const store1 = new OverrideStore(fp);
    store1.set('ch1', makeEntry());
    store1.set('ch2', makeEntry({ targetUserId: '222', targetDisplayName: '別ユーザー' }));

    // 新しいインスタンスで読み込み
    const store2 = new OverrideStore(fp);
    assertEqual(store2.list('ch1').length, 1, '[A-10] 永続化 → ch1 読み戻し件数1');
    assertEqual(store2.list('ch2').length, 1, '[A-10] 永続化 → ch2 読み戻し件数1');
    assertEqual(store2.list('ch1')[0].targetUserId, '111', '[A-10] 永続化 → ch1 データ一致');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

console.log('\n✅ Phase A 完了\n');

// ============================================================
// Phase B: getForDateRange
// ============================================================

console.log('\n=== Phase B: getForDateRange ===\n');

// gameDayMs の目安（JST 05:00 基準のUTCミリ秒）
// 2026/2/24 JST 05:00 = Date.UTC(2026,1,23,20,0,0) = 1740340800000 に近い値
// テストでは相対的な値を使う
const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_MS = 1740351600000;  // 2026/2/25 JST 05:00 相当

// [B-01] 範囲内エントリを返す
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry({ date: '2026/2/25', gameDayMs: BASE_MS }));
    const result = store.getForDateRange('ch1', BASE_MS, BASE_MS + DAY_MS);
    assertEqual(result.length, 1, '[B-01] 範囲内エントリを返す');
    assertEqual(result[0].date, '2026/2/25', '[B-01] 正しいエントリ');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [B-02] 範囲外は含まない
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry({ date: '2026/2/24', gameDayMs: BASE_MS - DAY_MS }));
    store.set('ch1', makeEntry({ date: '2026/2/25', gameDayMs: BASE_MS }));
    store.set('ch1', makeEntry({ date: '2026/2/26', gameDayMs: BASE_MS + DAY_MS, targetUserId: '222', targetDisplayName: '別' }));
    // 2/25 の1日分だけ取得（2/24 は前日、2/26 は翌日で範囲外）
    const result = store.getForDateRange('ch1', BASE_MS, BASE_MS + DAY_MS);
    assertEqual(result.length, 1, '[B-02] 範囲外は含まない → 1件のみ');
    assertEqual(result[0].date, '2026/2/25', '[B-02] 範囲内のエントリのみ');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [B-03] 複数日のエントリを返す（since モード想定）
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    store.set('ch1', makeEntry({ date: '2026/2/24', gameDayMs: BASE_MS - DAY_MS }));
    store.set('ch1', makeEntry({ date: '2026/2/25', gameDayMs: BASE_MS, targetUserId: '222', targetDisplayName: '別' }));
    store.set('ch1', makeEntry({ date: '2026/2/26', gameDayMs: BASE_MS + DAY_MS, targetUserId: '333', targetDisplayName: '別2' }));
    // 2/24〜2/26 の3日分
    const result = store.getForDateRange('ch1', BASE_MS - DAY_MS, BASE_MS + 2 * DAY_MS);
    assertEqual(result.length, 3, '[B-03] since想定 → 3件');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// [B-04] 空チャンネル → 空配列
{
    const fp = tmpFilePath();
    const store = new OverrideStore(fp);
    const result = store.getForDateRange('ch1', BASE_MS, BASE_MS + DAY_MS);
    assertDeepEqual(result, [], '[B-04] 空チャンネル → 空配列');
}

console.log('\n✅ Phase B 完了\n');
