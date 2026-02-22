// src/logic/route.test.ts
// 凸ルート計算テスト

import { parsePartyLine, parseRouteMessage, validateInput, findAllRoutes,
         formatRouteResult, RouteInput, RouteError, BossParty, ValidRoute } from './route';

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

function assertThrows(fn: () => void, message: string) {
    try {
        fn();
        console.error(`❌ FAIL: ${message} (例外が発生しなかった)`);
        process.exitCode = 1;
    } catch (e) {
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

// ==============================================
// フェーズ1: パーステスト
// ==============================================

console.log('\n=== parsePartyLine テスト ===\n');

// [1] 基本5人パース（半角スペース区切り）
{
    const members = parsePartyLine('シナツ ジオツム パオイ スズナ アラクネ');
    assertEqual(members.length, 5, '[1] 5人パース');
    assertEqual(members[0].name, 'シナツ', '[1] 1人目の名前');
    assertEqual(members[4].name, 'アラクネ', '[1] 5人目の名前');
    assertEqual(members[0].mustRent, false, '[1] mustRent=false');
}

// [2] *マーカー検出
{
    const members = parsePartyLine('シナツ ジオツム パオイ スズナ* アラクネ');
    assertEqual(members[3].name, 'スズナ', '[2] *除去後の名前');
    assertEqual(members[3].mustRent, true, '[2] mustRent=true');
    assertEqual(members[0].mustRent, false, '[2] 他はfalse');
}

// [3] 全角スペース区切り
{
    const members = parsePartyLine('シナツ　ジオツム　パオイ　スズナ　アラクネ');
    assertEqual(members.length, 5, '[3] 全角スペースで5人パース');
    assertEqual(members[2].name, 'パオイ', '[3] 3人目の名前');
}

// [4] カンマ区切り（半角・全角）
{
    const m1 = parsePartyLine('シナツ,ジオツム,パオイ,スズナ,アラクネ');
    assertEqual(m1.length, 5, '[4a] 半角カンマで5人パース');

    const m2 = parsePartyLine('シナツ、ジオツム、パオイ、スズナ、アラクネ');
    assertEqual(m2.length, 5, '[4b] 全角カンマで5人パース');
}

// [5] 混在セパレータ
{
    const members = parsePartyLine('シナツ ジオツム,パオイ　スズナ、アラクネ');
    assertEqual(members.length, 5, '[5] 混在セパレータで5人パース');
}

console.log('\n=== parseRouteMessage テスト ===\n');

// [6] @route トリガー検出
{
    const input = parseRouteMessage('@route\n甲 乙 丙 丁 戊\nA B C D E\nF G H I J\nK L M N O\nP Q R S T');
    assert(input !== null, '[6] @route トリガーで非null');
    assertEqual(input!.parties.length, 5, '[6] 5パーティ');
}

// [7] -route トリガー検出
{
    const input = parseRouteMessage('-route\n甲 乙 丙 丁 戊\nA B C D E\nF G H I J\nK L M N O\nP Q R S T');
    assert(input !== null, '[7] -route トリガーで非null');
}

// [8] @rou 短縮形
{
    const input = parseRouteMessage('@rou\n甲 乙 丙 丁 戊\nA B C D E\nF G H I J\nK L M N O\nP Q R S T');
    assert(input !== null, '[8] @rou トリガーで非null');
}

// [9] -rou 短縮形
{
    const input = parseRouteMessage('-rou\n甲 乙 丙 丁 戊\nA B C D E\nF G H I J\nK L M N O\nP Q R S T');
    assert(input !== null, '[9] -rou トリガーで非null');
}

// [10] トリガーなし → null
{
    const input = parseRouteMessage('甲 乙 丙 丁 戊\nA B C D E');
    assertEqual(input, null, '[10] トリガーなしでnull');
}

// [11] 5パーティの正常パース（bossIndex確認）
{
    const input = parseRouteMessage(`@route
シナツ ジオツム パオイ スズナ* アラクネ
イサナギ 水タマキ* プリシェフィ 水エリコ 水アメス
スミレ 魔ジータ ヴァンピィ ネネカ エキドナ
イサナギ アイラ ネフィ アラクネ マホ
ユイ ソノ ラビリスタ アルノゾ 水アメス`);
    assert(input !== null, '[11] 完全入力で非null');
    assertEqual(input!.parties[0].bossIndex, 0, '[11] 1ボスのindex=0');
    assertEqual(input!.parties[4].bossIndex, 4, '[11] 5ボスのindex=4');
    assertEqual(input!.parties[0].members[3].name, 'スズナ', '[11] 1ボスの4人目');
    assertEqual(input!.parties[0].members[3].mustRent, true, '[11] スズナはmustRent');
    assertEqual(input!.parties[1].members[1].mustRent, true, '[11] 水タマキはmustRent');
}

// ==============================================
// フェーズ2: バリデーションテスト
// ==============================================

console.log('\n=== validateInput テスト ===\n');

// ヘルパー: 簡易パーティ生成
function makeParty(bossIndex: number, names: string[]): BossParty {
    return {
        bossIndex,
        members: names.map(n => {
            const mustRent = n.endsWith('*');
            return { name: mustRent ? n.slice(0, -1) : n, mustRent };
        })
    };
}

// [12] 正常入力（5パーティ各5人）→ エラーなし
{
    const input: RouteInput = {
        parties: [
            makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
            makeParty(1, ['己', '庚', '辛', '壬', '癸']),
            makeParty(2, ['子', '丑', '寅', '卯', '辰']),
            makeParty(3, ['巳', '午', '未', '申', '酉']),
            makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
        ]
    };
    let threw = false;
    try { validateInput(input); } catch { threw = true; }
    assertEqual(threw, false, '[12] 正常入力でエラーなし');
}

// [13] パーティ数が5でない → RouteError
{
    const input: RouteInput = {
        parties: [
            makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
            makeParty(1, ['己', '庚', '辛', '壬', '癸']),
        ]
    };
    assertThrows(() => validateInput(input), '[13] パーティ数2でRouteError');
}

// [14] メンバー数が5でない → RouteError
{
    const input: RouteInput = {
        parties: [
            makeParty(0, ['甲', '乙', '丙']),
            makeParty(1, ['己', '庚', '辛', '壬', '癸']),
            makeParty(2, ['子', '丑', '寅', '卯', '辰']),
            makeParty(3, ['巳', '午', '未', '申', '酉']),
            makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
        ]
    };
    assertThrows(() => validateInput(input), '[14] メンバー数3でRouteError');
}

// [15] 1パーティに*が2つ → RouteError
{
    const input: RouteInput = {
        parties: [
            makeParty(0, ['甲*', '乙*', '丙', '丁', '戊']),
            makeParty(1, ['己', '庚', '辛', '壬', '癸']),
            makeParty(2, ['子', '丑', '寅', '卯', '辰']),
            makeParty(3, ['巳', '午', '未', '申', '酉']),
            makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
        ]
    };
    assertThrows(() => validateInput(input), '[15] *が2つでRouteError');
}

// ==============================================
// フェーズ3: ルート探索テスト
// ==============================================

console.log('\n=== findAllRoutes テスト ===\n');

// [16] 完全に重複なし → 全組み合わせが有効（C(5,3)=10通り）
{
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['己', '庚', '辛', '壬', '癸']),
        makeParty(2, ['子', '丑', '寅', '卯', '辰']),
        makeParty(3, ['巳', '午', '未', '申', '酉']),
        makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
    ];
    const routes = findAllRoutes(parties);
    assertEqual(routes.length, 10, '[16] 重複なし → 10ルート');
}

// [17] レンタルで重複解消可能
// ボス0とボス1に「甲」が被る。レンタルで解消可能。
{
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['甲', '庚', '辛', '壬', '癸']),
        makeParty(2, ['子', '丑', '寅', '卯', '辰']),
        makeParty(3, ['巳', '午', '未', '申', '酉']),
        makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
    ];
    const routes = findAllRoutes(parties);
    // ルート0-1-X: 甲が0と1に被るが、どちらかでレンタルすれば解消
    const route01x = routes.filter(r =>
        r.bosses.includes(0) && r.bosses.includes(1));
    assert(route01x.length > 0, '[17] 0-1を含むルートが存在（レンタルで解消）');
}

// [18] *マーカーがレンタルを強制
// ボス0: 甲*（レンタル必須）、ボス1: 甲がいる → 甲はボス0でレンタルされるので消費されず、ボス1で使える
{
    const parties = [
        makeParty(0, ['甲*', '乙', '丙', '丁', '戊']),
        makeParty(1, ['甲', '庚', '辛', '壬', '癸']),
        makeParty(2, ['子', '丑', '寅', '卯', '辰']),
        makeParty(3, ['巳', '午', '未', '申', '酉']),
        makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
    ];
    const routes = findAllRoutes(parties);
    const route01x = routes.filter(r =>
        r.bosses.includes(0) && r.bosses.includes(1));
    assert(route01x.length > 0, '[18] *で甲レンタル強制 → 0-1含むルート成立');
}

// [19] 重複過多で解消不可能
// ボス0,1,2に甲乙が2キャラ被り → 3ボスルートでレンタル1枠では解消不可
{
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['甲', '乙', '庚', '辛', '壬']),
        makeParty(2, ['甲', '乙', '子', '丑', '寅']),
        makeParty(3, ['巳', '午', '未', '申', '酉']),
        makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
    ];
    const routes = findAllRoutes(parties);
    const route012 = routes.filter(r =>
        r.bosses.includes(0) && r.bosses.includes(1) && r.bosses.includes(2));
    assertEqual(route012.length, 0, '[19] 0-1-2は不可能（甲乙が3パーティに被り）');
}

// [20] ユーザーサンプルで正しいルートを列挙
{
    const parties = [
        makeParty(0, ['シナツ', 'ジオツム', 'パオイ', 'スズナ*', 'アラクネ']),
        makeParty(1, ['イサナギ', '水タマキ*', 'プリシェフィ', '水エリコ', '水アメス']),
        makeParty(2, ['スミレ', '魔ジータ', 'ヴァンピィ', 'ネネカ', 'エキドナ']),
        makeParty(3, ['イサナギ', 'アイラ', 'ネフィ', 'アラクネ', 'マホ']),
        makeParty(4, ['ユイ', 'ソノ', 'ラビリスタ', 'アルノゾ', '水アメス']),
    ];
    const routes = findAllRoutes(parties);

    // 1→2→3 は成立するはず
    const r123 = routes.find(r =>
        r.bosses[0] === 0 && r.bosses[1] === 1 && r.bosses[2] === 2);
    assert(r123 !== undefined, '[20a] ルート1→2→3が存在');

    // 1→2→5 は成立するはず
    const r125 = routes.find(r =>
        r.bosses[0] === 0 && r.bosses[1] === 1 && r.bosses[2] === 4);
    assert(r125 !== undefined, '[20b] ルート1→2→5が存在');

    // 1→2→4 は不可能（イサナギ+アラクネが被り、*で2枠使用済み）
    const r124 = routes.find(r =>
        r.bosses[0] === 0 && r.bosses[1] === 1 && r.bosses[2] === 3);
    assertEqual(r124, undefined, '[20c] ルート1→2→4は不可能');
}

// [21] 有効ルートなし → 空配列
{
    // 全ボスに同じ3キャラが被る → どの3ボスの組み合わせも不可能
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['甲', '乙', '丙', '己', '庚']),
        makeParty(2, ['甲', '乙', '丙', '辛', '壬']),
        makeParty(3, ['甲', '乙', '丙', '癸', '子']),
        makeParty(4, ['甲', '乙', '丙', '丑', '寅']),
    ];
    const routes = findAllRoutes(parties);
    assertEqual(routes.length, 0, '[21] 全ルート不可能 → 空配列');
}

// ==============================================
// フェーズ4: 独立性判定テスト
// ==============================================

console.log('\n=== 独立性判定テスト ===\n');

// [22] 独立パターン: *で強制レンタルが決まり、残りのバトルは自由
{
    // ボス0: 甲*（甲レンタル強制） ボス1: 庚*（庚レンタル強制） ボス2: 被りなし
    // → 各バトルのレンタルが独立に決定される
    const parties = [
        makeParty(0, ['甲*', '乙', '丙', '丁', '戊']),
        makeParty(1, ['庚*', '辛', '壬', '癸', '子']),
        makeParty(2, ['丑', '寅', '卯', '辰', '巳']),
        makeParty(3, ['午', '未', '申', '酉', '戌']),
        makeParty(4, ['亥', '鼠', '牛', '虎', '兎']),
    ];
    const routes = findAllRoutes(parties);
    const r012 = routes.find(r =>
        r.bosses[0] === 0 && r.bosses[1] === 1 && r.bosses[2] === 2);
    assert(r012 !== undefined, '[22] ルート0-1-2が存在');
    assertEqual(r012!.isIndependent, true, '[22] 独立パターン');
    // ボス0は甲のみ、ボス1は庚のみ
    assertEqual(r012!.battles[0].rentalOptions.length, 1, '[22] ボス0は甲1択');
    assertEqual(r012!.battles[0].rentalOptions[0], '甲', '[22] ボス0レンタル=甲');
    // ボス2はレンタル自由
    assertEqual(r012!.battles[2].isFreeRental, true, '[22] ボス2はレンタル自由');
}

// [23] 非独立パターン: ボスX,Y,Zにそれぞれ甲乙が被り、レンタル選択が相互依存
{
    // ボス0: {甲, 乙, 丙, 丁, 戊}
    // ボス1: {甲, 庚, 辛, 壬, 癸}
    // ボス2: {乙, 子, 丑, 寅, 卯}
    // 甲: ボス0,1に被り → どちらかでレンタル必要
    // 乙: ボス0,2に被り → どちらかでレンタル必要
    // ボス0で甲をレンタル → ボス1は自由、ボス2で乙をレンタル必要
    // ボス0で乙をレンタル → ボス1で甲をレンタル必要、ボス2は自由
    // → ボス0の選択がボス1,2に影響 → 非独立
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['甲', '庚', '辛', '壬', '癸']),
        makeParty(2, ['乙', '子', '丑', '寅', '卯']),
        makeParty(3, ['巳', '午', '未', '申', '酉']),
        makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
    ];
    const routes = findAllRoutes(parties);
    const r012 = routes.find(r =>
        r.bosses[0] === 0 && r.bosses[1] === 1 && r.bosses[2] === 2);
    assert(r012 !== undefined, '[23] ルート0-1-2が存在');
    assertEqual(r012!.isIndependent, false, '[23] 非独立パターン');
    assert(r012!.dependentPatterns !== undefined, '[23] dependentPatterns が存在');
    assert(r012!.dependentPatterns!.length >= 2, '[23] 2パターン以上');
}

// ==============================================
// フェーズ5: 出力フォーマットテスト
// ==============================================

console.log('\n=== formatRouteResult テスト ===\n');

// [24] レンタル固定1名 → "(キャラ名)" 表示
{
    const parties = [
        makeParty(0, ['シナツ', 'ジオツム', 'パオイ', 'スズナ*', 'アラクネ']),
        makeParty(1, ['イサナギ', '水タマキ*', 'プリシェフィ', '水エリコ', '水アメス']),
        makeParty(2, ['スミレ', '魔ジータ', 'ヴァンピィ', 'ネネカ', 'エキドナ']),
        makeParty(3, ['イサナギ', 'アイラ', 'ネフィ', 'アラクネ', 'マホ']),
        makeParty(4, ['ユイ', 'ソノ', 'ラビリスタ', 'アルノゾ', '水アメス']),
    ];
    const routes = findAllRoutes(parties);
    const output = formatRouteResult(routes, parties);
    const text = output.join('\n');
    // スズナ*はレンタル強制 → "(スズナ)" が含まれるはず
    assertIncludes(text, '(スズナ)', '[24] *キャラがレンタル括弧表示');
    // 水タマキ*も同様
    assertIncludes(text, '(水タマキ)', '[24] 水タマキもレンタル括弧表示');
}

// [25] レンタル自由 → "※レンタル自由" 表示
{
    const parties = [
        makeParty(0, ['シナツ', 'ジオツム', 'パオイ', 'スズナ*', 'アラクネ']),
        makeParty(1, ['イサナギ', '水タマキ*', 'プリシェフィ', '水エリコ', '水アメス']),
        makeParty(2, ['スミレ', '魔ジータ', 'ヴァンピィ', 'ネネカ', 'エキドナ']),
        makeParty(3, ['イサナギ', 'アイラ', 'ネフィ', 'アラクネ', 'マホ']),
        makeParty(4, ['ユイ', 'ソノ', 'ラビリスタ', 'アルノゾ', '水アメス']),
    ];
    const routes = findAllRoutes(parties);
    const output = formatRouteResult(routes, parties);
    const text = output.join('\n');
    // ルート1→2→3のボス3は被りなし → レンタル自由
    assertIncludes(text, 'レンタル自由', '[25] レンタル自由が表示される');
}

// [26] 複数候補(独立) → "(X or Y)" 表示
{
    // ボス0と1に甲が被る（*なし）。ボス2は被りなし。
    // → ボス0か1で甲をレンタル（複数候補）
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['甲', '庚', '辛', '壬', '癸']),
        makeParty(2, ['子', '丑', '寅', '卯', '辰']),
        makeParty(3, ['巳', '午', '未', '申', '酉']),
        makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
    ];
    const routes = findAllRoutes(parties);
    const output = formatRouteResult(routes, parties);
    const text = output.join('\n');
    // 複数候補がある場合: 独立なら "or"、非独立で少数なら "パターン"、非独立で多数ならコンパクト表示（"自由" を含む）
    assert(text.includes('or') || text.includes('パターン') || text.includes('自由'), '[26] 複数候補表示');
}

// [27] ボス絵文字の表示
{
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['己', '庚', '辛', '壬', '癸']),
        makeParty(2, ['子', '丑', '寅', '卯', '辰']),
        makeParty(3, ['巳', '午', '未', '申', '酉']),
        makeParty(4, ['戌', '亥', '鼠', '牛', '虎']),
    ];
    const routes = findAllRoutes(parties);
    const output = formatRouteResult(routes, parties);
    const text = output.join('\n');
    assertIncludes(text, '1🐲', '[27] ボス番号+絵文字表示');
    assertIncludes(text, '⚔️1→', '[27] コンパクトルート表示');
}

// [28] ルートなし → メッセージ
{
    const parties = [
        makeParty(0, ['甲', '乙', '丙', '丁', '戊']),
        makeParty(1, ['甲', '乙', '丙', '己', '庚']),
        makeParty(2, ['甲', '乙', '丙', '辛', '壬']),
        makeParty(3, ['甲', '乙', '丙', '癸', '子']),
        makeParty(4, ['甲', '乙', '丙', '丑', '寅']),
    ];
    const routes = findAllRoutes(parties);
    const output = formatRouteResult(routes, parties);
    const text = output.join('\n');
    assertIncludes(text, '見つかりません', '[28] ルートなしメッセージ');
}

// ==============================================
// フェーズ6: 統合テスト
// ==============================================

console.log('\n=== 統合テスト ===\n');

// [29] ユーザーサンプル入力 → エンドツーエンド
{
    const input = parseRouteMessage(`@route
シナツ ジオツム パオイ スズナ* アラクネ
イサナギ 水タマキ* プリシェフィ 水エリコ 水アメス
スミレ 魔ジータ ヴァンピィ ネネカ エキドナ
イサナギ アイラ ネフィ アラクネ マホ
ユイ ソノ ラビリスタ アルノゾ 水アメス`);
    assert(input !== null, '[29] パース成功');
    validateInput(input!);
    const routes = findAllRoutes(input!.parties);
    const output = formatRouteResult(routes, input!.parties);
    const text = output.join('\n');

    // ルート1→2→3が含まれる
    assertIncludes(text, '1→2→3', '[29a] ルート1→2→3が出力に含まれる');

    // ルート1→2→5が含まれる
    assertIncludes(text, '1→2→5', '[29b] ルート1→2→5が出力に含まれる');

    // ルート1→2→4は含まれない
    assert(!text.includes('1→2→4'), '[29c] ルート1→2→4は出力に含まれない');

    // レンタル表示: (スズナ) と (水タマキ) が含まれる
    assertIncludes(text, '(スズナ)', '[29d] スズナのレンタル括弧');
    assertIncludes(text, '(水タマキ)', '[29e] 水タマキのレンタル括弧');

    // ルート1→2→3のボス3はレンタル自由
    assertIncludes(text, 'レンタル自由', '[29f] レンタル自由が含まれる');

    // ルート1→2→5で水アメスがレンタル
    assertIncludes(text, '(水アメス)', '[29g] 水アメスのレンタル括弧');

    // デバッグ出力
    console.log('\n--- [29] 出力プレビュー ---');
    console.log(text);
    console.log('--- プレビュー終了 ---\n');
}

// [30] 全パーティにわざと大量の被りを入れてルートなし
{
    const input = parseRouteMessage(`@route
甲 乙 丙 丁 戊
甲 乙 丙 己 庚
甲 乙 丙 辛 壬
甲 乙 丙 癸 子
甲 乙 丙 丑 寅`);
    assert(input !== null, '[30] パース成功');
    validateInput(input!);
    const routes = findAllRoutes(input!.parties);
    const output = formatRouteResult(routes, input!.parties);
    const text = output.join('\n');
    assertIncludes(text, '見つかりません', '[30] ルートなしメッセージ');
}

// [31] 非独立パターンの要約表示確認（パターン数が多い場合）
{
    const input = parseRouteMessage(`@route
甲 乙 丙 丁 戊
甲 庚 辛 壬 癸
乙 子 丑 寅 卯
巳 午 未 申 酉
戌 亥 鼠 牛 虎`);
    assert(input !== null, '[31] パース成功');
    validateInput(input!);
    const routes = findAllRoutes(input!.parties);
    const output = formatRouteResult(routes, input!.parties);
    const text = output.join('\n');

    // ルート1→2→3は非独立（甲:1,2被り、乙:1,3被り）→ 13パターン → コンパクト表示
    const r123section = text.split('⚔️1→2→3')[1]?.split('⚔️')[0] ?? '';
    // コンパクト表示: 折りたたみレンタル行に「自由」や制約キャラ名がある
    assertIncludes(r123section, '自由', '[31] コンパクト表示に自由がある');
    // 甲と乙の制約が見える
    assertIncludes(r123section, '甲', '[31b] 甲の制約が見える');
    assertIncludes(r123section, '乙', '[31c] 乙の制約が見える');
}

// ==============================================
// フェーズ7: 非独立パターン多数時の要約表示テスト
// ==============================================

console.log('\n=== 非独立パターン多数時の要約テスト ===\n');

// [32] *なし入力（バグ報告ケース）で出力がDiscord制限内に収まる
{
    const input = parseRouteMessage(`@route
シナツ ジオツム パオイ スズナ アラクネ
イサナギ 水タマキ プリシェフィ 水エリコ 水アメス
スミレ 魔ジータ ヴァンピィ ネネカ エキドナ
イサナギ アイラ ネフィ アラクネ マホ
ユイ ソノ ラビリスタ アルノゾ 水アメス`);
    assert(input !== null, '[32] パース成功');
    validateInput(input!);
    const routes = findAllRoutes(input!.parties);
    const output = formatRouteResult(routes, input!.parties);

    // 出力メッセージ数が3以下に収まること
    assert(output.length <= 3, `[32a] 出力メッセージ数が3以下 (実際: ${output.length})`);

    // 各メッセージが2000文字以下
    for (let i = 0; i < output.length; i++) {
        assert(output[i].length <= 1900, `[32b] メッセージ${i}が1900文字以下 (実際: ${output[i].length})`);
    }
}

// [33] 非独立パターン多数（>5）のルートは「パターンA/B」列挙ではなくコンパクト表示
{
    const input = parseRouteMessage(`@route
シナツ ジオツム パオイ スズナ アラクネ
イサナギ 水タマキ プリシェフィ 水エリコ 水アメス
スミレ 魔ジータ ヴァンピィ ネネカ エキドナ
イサナギ アイラ ネフィ アラクネ マホ
ユイ ソノ ラビリスタ アルノゾ 水アメス`);
    const routes = findAllRoutes(input!.parties);
    const output = formatRouteResult(routes, input!.parties);
    const text = output.join('\n');

    // ルート1-2-5は45パターンあるはず → パターンA/B列挙ではなくコンパクト表示
    const r125section = text.split('⚔️1→2→5')[1]?.split('⚔️')[0] ?? '';
    assert(!r125section.includes('パターンA'), `[33a] 45パターンのルートにパターンA列挙がない`);
    // 「※レンタル自由」が全3行にならない（実際に制約がある場合）
    // 水アメスが2ボスと5ボスで被るので、レンタル制約がある
    assertIncludes(r125section, '水アメス', '[33b] 水アメスのレンタル制約が表示される');
}

// [34] 非独立パターン少数（≤5）のルートは従来通りパターン列挙
{
    // ボス0,1に甲乙が2キャラ被り、ボス2は*で固定 → 非独立で2パターンのみ
    const input = parseRouteMessage(`@route
甲 乙 丙 丁 戊
甲 乙 辛 壬 癸
子* 丑 寅 卯 辰
巳 午 未 申 酉
戌 亥 鼠 牛 虎`);
    const routes = findAllRoutes(input!.parties);
    const r012 = routes.find(r =>
        r.bosses[0] === 0 && r.bosses[1] === 1 && r.bosses[2] === 2);
    assert(r012 !== undefined, '[34] ルート0-1-2が存在');
    assert(!r012!.isIndependent, '[34] 非独立');
    assert(r012!.dependentPatterns !== undefined && r012!.dependentPatterns.length <= 5,
        `[34] パターン数が5以下 (実際: ${r012!.dependentPatterns?.length})`);
    // パターン数が少ないので従来の列挙表示
    const output = formatRouteResult([r012!], input!.parties);
    const text = output.join('\n');
    assertIncludes(text, 'パターン', '[34] 少パターンは従来のパターン列挙');
}

// [35] ルート1→2→4でレンタル制約が正しく表示される（レンタル自由の誤表示がない）
{
    const input = parseRouteMessage(`@route
シナツ ジオツム パオイ スズナ アラクネ
イサナギ 水タマキ プリシェフィ 水エリコ 水アメス
スミレ 魔ジータ ヴァンピィ ネネカ エキドナ
イサナギ アイラ ネフィ アラクネ マホ
ユイ ソノ ラビリスタ アルノゾ 水アメス`);
    const routes = findAllRoutes(input!.parties);
    const output = formatRouteResult(routes, input!.parties);
    const text = output.join('\n');

    // ルート1-2-4のセクション
    const r124section = text.split('⚔️1→2→4')[1]?.split('⚔️')[0] ?? '';

    // アラクネとイサナギが被るので、レンタル制約が見える必要がある
    assertIncludes(r124section, 'アラクネ', '[35a] アラクネのレンタル制約が表示');
    assertIncludes(r124section, 'イサナギ', '[35b] イサナギのレンタル制約が表示');

    // 全行が「※レンタル自由」にはならない（少なくとも一部に制約がある）
    const freeCount = (r124section.match(/レンタル自由/g) || []).length;
    assert(freeCount < 3, `[35c] 全行がレンタル自由ではない (実際: ${freeCount})`);
}

// [36] ルート1→2→5のコンパクト表示で水アメスの制約が見える
{
    const input = parseRouteMessage(`@route
シナツ ジオツム パオイ スズナ アラクネ
イサナギ 水タマキ プリシェフィ 水エリコ 水アメス
スミレ 魔ジータ ヴァンピィ ネネカ エキドナ
イサナギ アイラ ネフィ アラクネ マホ
ユイ ソノ ラビリスタ アルノゾ 水アメス`);
    const routes = findAllRoutes(input!.parties);
    const output = formatRouteResult(routes, input!.parties);
    const text = output.join('\n');

    // ルート1-2-5のセクション（45パターン → コンパクト表示）
    const r125section = text.split('⚔️1→2→5')[1]?.split('⚔️')[0] ?? '';

    // コンパクトレンタル行があること（"ボス番号(キャラ名)" 形式）
    // 例: 2(水アメス) のような表示
    assert(r125section.includes('(水アメス)'), `[36a] 水アメスのレンタル制約がコンパクト表示`);

    // 「自由」がコンパクト行に含まれる（一部のバトルは自由）
    assertIncludes(r125section, '自由', '[36b] 自由なバトルも表示される');
}
