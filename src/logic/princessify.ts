// src/logic/princessify.ts

// ========================================
// 入力揺らぎ対応の文字マッピング
// 新しい文字を追加する場合はここに追記
// ========================================

// ON状態として認識する文字（丸っぽい表現）
const ON_CHARS = 'Oo0〇◯⭕';

// OFF状態として認識する文字（バツや横棒的な表現）
// ー(U+30FC):長音, －(U+FF0D):全角ハイフンマイナス, -(U+002D):半角ハイフン, 等
const OFF_CHARS = 'Xxー－❌✕✖×-‐−–—';

// 開き括弧として認識する文字
const OPEN_BRACKETS = '[［【(（{｛<＜〈《「『〔';

// 閉じ括弧として認識する文字
const CLOSE_BRACKETS = ']］】)）}｝>＞〉》」』〕';

// ========================================
// オートON/OFF検出
// ========================================

// オートON検出: 「オート」or「AUTO」+ ON/オン
const AUTO_ON_REGEX = /(?:オート|AUTO)[　 ]*(?:ON|ＯＮ|オン|おん)/i;

// オートOFF検出: 「オート」or「AUTO」+ OFF/オフ/切
const AUTO_OFF_REGEX = /(?:オート|AUTO)[　 ]*(?:OFF|ＯＦＦ|オフ|おふ|切り?)/i;

// 独立した「切」の検出（オートOFF相当）
// 前が空白・行頭・ASCII記号の場合、かつ後ろが空白・行末の場合にマッチ
// 日本語文中の「切」（例:「見切れ」「大切」）は除外
const STANDALONE_KIRI_REGEX = /(?:^|[\s!-/:-@[-`{-~！-／：-＠［-｀｛-～'＃])切(?=\s|$)/;

export function detectAutoState(text: string): 'on' | 'off' | null {
    if (AUTO_ON_REGEX.test(text)) return 'on';
    if (AUTO_OFF_REGEX.test(text)) return 'off';
    if (STANDALONE_KIRI_REGEX.test(text)) return 'off';
    return null;
}

export function renderAutoState(prev: boolean, current: boolean): string {
    if (!prev && current) return '👉✅';   // OFF → ON
    if (prev && !current) return '👉⬛';   // ON → OFF
    if (current) return '✅';               // ON維持
    return '⬛';                             // OFF維持
}

// ========================================
// 推論モード: UBタイプ分類
// ========================================

export type UBType = 'manual' | 'set' | 'auto' | 'enemy' | 'none';

export function classifyUBType(
    textAfterCharName: string,
    fullLineText: string
): UBType {
    if (/^\d{1,2}:\d{2}[\s　]+敵UB/.test(fullLineText.trim())) return 'enemy';
    const firstToken = textAfterCharName.trim().split(/[\s　]+/)[0] || '';
    if (firstToken.startsWith('#')) return 'set';
    if (firstToken.toUpperCase() === 'AUTO' || firstToken === 'オート') return 'auto';
    if (/^[uU][bB]中$/.test(firstToken)) return 'none';
    return 'manual';
}

// ========================================
// 推論モード: 明示的SET検出
// ========================================

export function parseExplicitSets(
    text: string,
    party: string[]
): number[] {
    const results: number[] = [];
    const regex = /ここで(\S+?)(?:set|SET|セット)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const charName = match[1];
        const idx = party.indexOf(charName);
        if (idx !== -1) results.push(idx);
    }
    return results;
}

// ========================================
// 推論モード: インライン命令検出
// ========================================

export interface InlineInstructions {
    setOn: number[];    // SET ONするキャラのインデックス
    setOff: number[];   // SET OFFするキャラのインデックス
    autoOn: boolean;
    autoOff: boolean;
}

/**
 * カンマ区切り名前を展開し、末尾のアクションキーワード付きでパーティインデックスに変換する。
 * 例: "クルル、リノ解除" → match[1]="クルル、リノ", 名前を分割して各インデックスを返す
 */
function expandPartyNames(compoundName: string, party: string[]): number[] {
    const names = compoundName.split(/[、,]/).map(s => s.trim()).filter(Boolean);
    const indices: number[] = [];
    for (const name of names) {
        const idx = party.indexOf(name);
        if (idx !== -1) indices.push(idx);
    }
    return indices;
}

export function parseInlineInstructions(text: string, party: string[]): InlineInstructions {
    const setOn: number[] = [];
    const setOff: number[] = [];

    // AUTO検出（既存の detectAutoState を再利用）
    const autoState = detectAutoState(text);
    const autoOn = autoState === 'on';
    const autoOff = autoState === 'off';

    // SET OFF: {names}解除
    const offRegex = /(\S+?)解除/g;
    let m;
    while ((m = offRegex.exec(text)) !== null) {
        setOff.push(...expandPartyNames(m[1], party));
    }

    // SET ON: {names}セット|SET|set （ただし「ここで」の直後はスキップ）
    const onRegex = /(?<!ここで)(\S+?)(?:セット|SET|set)/g;
    while ((m = onRegex.exec(text)) !== null) {
        setOn.push(...expandPartyNames(m[1], party));
    }

    return { setOn, setOff, autoOn, autoOff };
}

interface TimelineEntry {
    lineIndex: number;      // 元の行番号
    originalText: string;   // 元の行テキスト
    timeStr: string;        // "1:13" など
    actorIndex: number;     // 0〜4 (パーティの誰か) -1なら不明
    actorName: string;      // キャラ名
    userState: boolean[];   // ユーザーが指定したお団子状態（あれば）
    hasUserDango: boolean;  // ユーザーがお団子を指定しているか
    autoStateChange: 'on' | 'off' | null;  // オートON/OFF切替指示
}

// 5つのスロットの状態（true=SET, false=UNSET）
type DangoState = boolean[];

// エスケープが必要な正規表現の特殊文字をエスケープ
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

// 括弧付きお団子を見つける正規表現を動的に生成
function buildBracketedDangoRegex(): RegExp {
    const openBrackets = escapeRegex(OPEN_BRACKETS);
    const closeBrackets = escapeRegex(CLOSE_BRACKETS);
    const dangoChars = escapeRegex(ON_CHARS + OFF_CHARS);
    return new RegExp(`[${openBrackets}]([${dangoChars}\\s]+)[${closeBrackets}]`);
}

// 括弧なしお団子を見つける正規表現を動的に生成（5文字ちょうど）
function buildNoBracketDangoRegex(): RegExp {
    const dangoChars = escapeRegex(ON_CHARS + OFF_CHARS);
    // 空白の後に5文字のお団子文字、その後に空白または行末
    return new RegExp(`(?<=\\s)([${dangoChars}]{5})(?=\\s|$)`);
}

export class PartyGuideError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PartyGuideError';
    }
}

export interface ConvertOptions {
    channelMode?: boolean;
}

export type ConvertMode = 'inference' | 'existing';

export class Princessify {
    private party: string[] = [];
    public lastMode: ConvertMode | null = null;

    // 括弧付きお団子を見つける正規表現
    private readonly bracketedDangoRegex = buildBracketedDangoRegex();

    // 括弧なしお団子を見つける正規表現（5文字ちょうど）
    private readonly noBracketDangoRegex = buildNoBracketDangoRegex();

    public convert(inputText: string, options?: ConvertOptions): string | null {
        this.party = [];
        const lines = inputText.split('\n');
        const channelMode = options?.channelMode ?? false;

        // 1. ヘッダー解析（@dangoは省略可能）
        const dangoLineIndex = this.parseHeader(lines, channelMode);

        // @dango行を出力から除去
        if (dangoLineIndex !== -1) {
            lines[dangoLineIndex] = '';
        }

        // 2. タイムライン解析
        const entries = this.parseTimeline(lines);

        // 3. モード判別
        const hasAnyUserDango = entries.some(e => e.hasUserDango);

        if (!hasAnyUserDango && dangoLineIndex !== -1) {
            // パーティ定義あり + お団子なし → 推論モードを試みる
            if (entries.length === 0) {
                // TL行がない → エラー
                throw channelMode ? this.buildChannelPartyGuide() : this.buildPartyGuide();
            }
            if (this.party.length === 5) {
                // 推論モード: お団子なし + パーティー指定あり
                this.lastMode = 'inference';
                return this.inferFromContext(lines, dangoLineIndex);
            }
            // 推論モードを試みたがパーティー未指定 → エラー
            throw this.buildPartyGuide();
        }

        // channelMode: お団子なし + パーティ定義もなし
        if (channelMode && !hasAnyUserDango && dangoLineIndex === -1) {
            if (entries.length === 0) {
                // タイムスタンプ行もなし → TLではない → 無視
                return null;
            }
            // タイムスタンプ行あり → TLっぽいがパーティ未定義 → エラー
            throw this.buildChannelPartyGuide();
        }

        // 既存モード: ユーザー指定のお団子がある
        this.lastMode = 'existing';
        return this.inferAndRender(entries, lines);
    }

    private parseHeader(lines: string[], channelMode: boolean = false): number {
        // まず @dango / -dango 行を探す（channelMode でも明示指定があれば優先）
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            const dangoMatch = trimmed.match(/^[@-]dango\s*(.*)/);
            if (dangoMatch) {
                const parts = dangoMatch[1].trim().split(/\s+/);
                if (parts.length === 5) {
                    this.party = parts;
                }
                return i;
            }
        }

        // channelMode: @dango がない場合、最初の意味のある行をパーティ定義とみなす
        if (channelMode) {
            const timeStartRegex = /^\d{1,2}:\d{2}/;
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (!trimmed) continue; // 空行スキップ
                if (timeStartRegex.test(trimmed)) continue; // TL行はスキップ
                const parts = trimmed.split(/\s+/);
                if (parts.length === 5 && !this.hasInlineKeywords(trimmed)) {
                    this.party = parts;
                    return i;
                }
                continue; // 5人でない非空行はスキップして探索を続ける
            }
        }

        return -1;
    }

    /**
     * インライン命令のキーワードを含むかチェック（パーティ定義候補のフィルタ用）
     */
    private hasInlineKeywords(text: string): boolean {
        return /(?:セット|SET|set|解除|オートオン|オートオフ|AUTO[　 ]*O(?:N|FF))/i.test(text);
    }

    /**
     * 既存のお団子文字列を解析して状態配列を返す
     */
    private parseDangoState(dangoContent: string): boolean[] {
        const state: boolean[] = [];
        for (const char of dangoContent) {
            // ON状態
            if (ON_CHARS.includes(char)) {
                state.push(true);
            }
            // OFF状態
            else if (OFF_CHARS.includes(char)) {
                state.push(false);
            }
            // スペースは無視
        }
        // 5要素に満たない場合はfalseで埋める
        while (state.length < 5) {
            state.push(false);
        }
        return state.slice(0, 5);
    }

    private parseTimeline(lines: string[]): TimelineEntry[] {
        const entries: TimelineEntry[] = [];
        const timeRegex = /(\d{1,2}:\d{2})/;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const trimmed = line.trim();
            const timeMatch = trimmed.match(timeRegex);

            // 時間がない行はスキップ
            if (!timeMatch) continue;

            const timeStr = timeMatch[1];

            // 行頭から10文字以内に時間があるかチェック
            const timePosition = trimmed.indexOf(timeStr);
            const hasTimeNearStart = timePosition >= 0 && timePosition <= 10;

            // キャラ名を探す（@partyが指定されている場合のみ）
            let actorIndex = -1;
            let actorName = "";
            for (let i = 0; i < this.party.length; i++) {
                if (trimmed.includes(this.party[i])) {
                    actorIndex = i;
                    actorName = this.party[i];
                    break;
                }
            }

            // 既存のお団子を探す（括弧付き優先、なければ括弧なし）
            let dangoMatch = trimmed.match(this.bracketedDangoRegex);
            let userState: boolean[] = [false, false, false, false, false];
            let hasUserDango = false;
            let hasBracketedDango = false;

            if (dangoMatch) {
                userState = this.parseDangoState(dangoMatch[1]);
                hasUserDango = true;
                hasBracketedDango = true;
            } else {
                // 括弧なしお団子を探す
                const noBracketMatch = trimmed.match(this.noBracketDangoRegex);
                if (noBracketMatch) {
                    userState = this.parseDangoState(noBracketMatch[1]);
                    hasUserDango = true;
                }
            }

            // オートON/OFF検出
            const autoStateChange = detectAutoState(trimmed);

            // 処理対象の条件: 行頭付近に時間がある OR お団子がある OR キャラ名がある
            if (hasTimeNearStart || hasUserDango || actorIndex !== -1) {
                entries.push({
                    lineIndex,
                    originalText: line,
                    timeStr,
                    actorIndex,
                    actorName,
                    userState,
                    hasUserDango,
                    autoStateChange
                });
            }
        }
        return entries;
    }

    /**
     * ロジック適用と文字列置換
     * ユーザーが指定したお団子状態を正として扱う
     */
    private inferAndRender(entries: TimelineEntry[], allLines: string[]): string {
        const resultLines = [...allLines];

        // 条件付き有効化: TL内にオートON/OFF指示が1つ以上あるか
        const hasAnyAutoDirective = entries.some(e => e.autoStateChange !== null);
        let prevAutoState = false; // デフォルトOFF

        for (let i = 0; i < entries.length; i++) {
            const currentEntry = entries[i];
            const prevEntry = entries[i - 1];
            const isFirstEntry = (i === 0);

            // 前の状態を取得
            const prevState: DangoState = prevEntry
                ? prevEntry.userState
                : [false, false, false, false, false];

            // 現在の状態（ユーザー指定があればそれを使う）
            const currentState: DangoState = currentEntry.hasUserDango
                ? currentEntry.userState
                : [...prevState]; // お団子がない場合は前の状態を維持

            // 次の行が参照できるように、推論した状態を保存
            currentEntry.userState = currentState;

            // 描画文字列生成
            // 最初の行は「初期状態」なので差分ではなく状態そのものを表示
            const dangoStr = isFirstEntry
                ? this.renderInitialState(currentState)
                : this.renderDango(prevState, currentState);

            // オート状態の追跡と描画
            let currentAutoState: boolean = prevAutoState;
            if (currentEntry.autoStateChange === 'on') {
                currentAutoState = true;
            } else if (currentEntry.autoStateChange === 'off') {
                currentAutoState = false;
            }

            const autoEmoji = hasAnyAutoDirective
                ? renderAutoState(prevAutoState, currentAutoState)
                : '';
            prevAutoState = currentAutoState;

            // お団子 + オート絵文字を結合
            const fullDangoStr = dangoStr + autoEmoji;

            // 元のテキストへの埋め込み
            let newText = currentEntry.originalText;

            if (this.bracketedDangoRegex.test(newText)) {
                // 括弧付きお団子がある場合 -> 置換する
                newText = newText.replace(this.bracketedDangoRegex, fullDangoStr);
            } else if (this.noBracketDangoRegex.test(newText)) {
                // 括弧なしお団子がある場合 -> 置換する
                newText = newText.replace(this.noBracketDangoRegex, fullDangoStr);
            } else {
                // ない場合 -> 行末に追加
                newText = `${newText} ${fullDangoStr}`;
            }

            // 結果リストの該当行を書き換える
            resultLines[currentEntry.lineIndex] = newText;
        }

        return resultLines.join('\n');
    }

    /**
     * 初期状態を描画（最初の行用、差分ではなく状態そのもの）
     */
    private renderInitialState(state: DangoState): string {
        let result = "";
        for (let i = 0; i < 5; i++) {
            result += state[i] ? "〇" : "ー";
        }
        return `[${result}]`;
    }

    private renderDango(prev: DangoState, current: DangoState): string {
        let result = "";
        for (let i = 0; i < 5; i++) {
            const p = prev[i];
            const c = current[i];

            if (!p && c) result += "⭕";      // SET (OFF -> ON)
            else if (p && !c) result += "❌"; // UNSET (ON -> OFF)
            else if (c) result += "〇";       // KEEP ON
            else result += "ー";              // KEEP OFF
        }
        return `[${result}]`;
    }

    // ========================================
    // 推論モード
    // ========================================

    private parseInferTimeline(lines: string[]): InferEntry[] {
        const entries: InferEntry[] = [];
        const timeStartRegex = /^(\d{1,2}:\d{2})/;
        let lastTimeStr = '';

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const trimmed = line.trim();
            if (!trimmed) continue;

            const timeMatch = trimmed.match(timeStartRegex);

            let timeStr: string;
            let isSubLine: boolean;

            if (timeMatch) {
                // タイムスタンプ付き行
                timeStr = timeMatch[1];
                isSubLine = false;
                lastTimeStr = timeStr;
            } else {
                // サブ行候補: 先頭が空白 + パーティーメンバー名を含む
                if (!/^[\s　]/.test(line)) continue;
                let hasPartyMember = false;
                for (const member of this.party) {
                    if (trimmed.includes(member)) {
                        hasPartyMember = true;
                        break;
                    }
                }
                if (!hasPartyMember) continue;
                timeStr = lastTimeStr;
                isSubLine = true;
            }

            // キャラ名を探す（テキスト内で最も早い位置に出現するメンバーを選択）
            let actorIndex = -1;
            let actorName = '';
            let actorPos = Infinity;
            for (let i = 0; i < this.party.length; i++) {
                const pos = trimmed.indexOf(this.party[i]);
                if (pos !== -1 && pos < actorPos) {
                    actorIndex = i;
                    actorName = this.party[i];
                    actorPos = pos;
                }
            }

            // キャラ名の後のテキストを抽出
            let textAfterChar = '';
            if (actorName) {
                textAfterChar = trimmed.substring(actorPos + actorName.length);
            }

            // UBタイプ分類
            const ubType = classifyUBType(textAfterChar, trimmed);

            // 明示的SET検出
            const explicitSets = parseExplicitSets(trimmed, this.party);

            // インライン命令検出
            const inlineInstructions = parseInlineInstructions(trimmed, this.party);

            entries.push({
                lineIndex,
                originalText: line,
                timeStr,
                actorIndex,
                actorName,
                ubType,
                isSubLine,
                explicitSets,
                inlineInstructions,
            });
        }

        return entries;
    }

    private inferFromContext(lines: string[], dangoLineIndex: number): string {
        const entries = this.parseInferTimeline(lines);
        const resultLines = [...lines];

        // 初期状態行の検出と解析
        // パーティ定義行と最初のタイムスタンプ行の間の非空行を初期状態として処理
        const initialState: boolean[] = [false, false, false, false, false];
        let initialAutoState = false;
        const firstEntryLine = entries.length > 0 ? entries[0].lineIndex : lines.length;
        const initialInstructions: InlineInstructions = { setOn: [], setOff: [], autoOn: false, autoOff: false };

        for (let i = dangoLineIndex + 1; i < firstEntryLine; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed) continue;
            const instr = parseInlineInstructions(trimmed, this.party);
            initialInstructions.setOn.push(...instr.setOn);
            initialInstructions.setOff.push(...instr.setOff);
            if (instr.autoOn) initialInstructions.autoOn = true;
            if (instr.autoOff) initialInstructions.autoOff = true;
            // 初期状態行は出力に残す（1:30の前に配置される）
        }

        // 初期状態を適用
        for (const idx of initialInstructions.setOn) {
            initialState[idx] = true;
        }
        for (const idx of initialInstructions.setOff) {
            initialState[idx] = false;
        }
        if (initialInstructions.autoOn) initialAutoState = true;
        if (initialInstructions.autoOff) initialAutoState = false;

        // AUTO UBがあるかどうか（初期状態 + インライン命令のauto指示も考慮）
        const hasAnyAutoUB = entries.some(e => e.ubType === 'auto')
            || entries.some(e => e.inlineInstructions.autoOn || e.inlineInstructions.autoOff)
            || initialInstructions.autoOn || initialInstructions.autoOff;

        // 明示的なオートON/OFF指示があるか（インライン命令 or 初期状態行）
        // ある場合、auto UBからの自動推論（autoOn/Off需要追加）をスキップする
        const hasExplicitAutoInstructions =
            entries.some(e => e.inlineInstructions.autoOn || e.inlineInstructions.autoOff)
            || initialInstructions.autoOn || initialInstructions.autoOff;

        // SET需要の計算
        interface Demands {
            setOn: number[];
            setOff: number[];
            autoOn: boolean;
            autoOff: boolean;
        }

        const demands = new Map<number, Demands>();
        const getDemands = (idx: number): Demands => {
            if (!demands.has(idx)) {
                demands.set(idx, { setOn: [], setOff: [], autoOn: false, autoOff: false });
            }
            return demands.get(idx)!;
        };

        // パス1: SET/AUTO需要の構築
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            // SET発動UB → 直前にSET ON、発動行でSET OFF
            if (entry.ubType === 'set' && entry.actorIndex !== -1) {
                if (i > 0) {
                    getDemands(i - 1).setOn.push(entry.actorIndex);
                }
                getDemands(i).setOff.push(entry.actorIndex);
            }

            // AUTO発動UB → 直前にAUTO ON、発動行でAUTO OFF
            // （明示的なオートON/OFF指示がTLにある場合はスキップ: ユーザーの指示が優先）
            if (entry.ubType === 'auto' && !hasExplicitAutoInstructions) {
                if (i > 0) {
                    getDemands(i - 1).autoOn = true;
                }
                getDemands(i).autoOff = true;
            }

            // 明示的SET指示
            if (entry.explicitSets.length > 0) {
                const d = getDemands(i);
                for (const charIdx of entry.explicitSets) {
                    if (!d.setOn.includes(charIdx)) {
                        d.setOn.push(charIdx);
                    }
                }
            }

            // インライン命令（当行で即座に適用）
            const inline = entry.inlineInstructions;
            if (inline.setOn.length > 0 || inline.setOff.length > 0 || inline.autoOn || inline.autoOff) {
                const d = getDemands(i);
                for (const charIdx of inline.setOn) {
                    if (!d.setOn.includes(charIdx)) {
                        d.setOn.push(charIdx);
                    }
                }
                for (const charIdx of inline.setOff) {
                    if (!d.setOff.includes(charIdx)) {
                        d.setOff.push(charIdx);
                    }
                }
                if (inline.autoOn) d.autoOn = true;
                if (inline.autoOff) d.autoOff = true;
            }
        }

        // パス2: 状態計算と描画
        const state: boolean[] = [...initialState];
        let autoState = initialAutoState;

        // 初期行の生成（初期状態を反映）
        const prevForInitial: DangoState = initialState.map(v => !v) as DangoState;
        const initialDango = this.renderDango(prevForInitial, initialState as DangoState);
        const initialAutoEmoji = hasAnyAutoUB ? renderAutoState(!initialAutoState, initialAutoState) : '';
        const initialLine = `1:30 開始 ${initialDango}${initialAutoEmoji}`;

        // @dango/パーティ行を除去（初期行は後で挿入）
        if (dangoLineIndex !== -1) {
            resultLines[dangoLineIndex] = '';
        }

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const d = getDemands(i);

            const prevState = [...state];
            const prevAutoState = autoState;

            // SET ON適用（先に適用）
            for (const charIdx of d.setOn) {
                state[charIdx] = true;
            }

            // SET OFF適用
            for (const charIdx of d.setOff) {
                state[charIdx] = false;
            }

            // AUTO適用
            if (d.autoOn) autoState = true;
            if (d.autoOff) autoState = false;

            // 描画
            const dangoStr = this.renderDango(prevState, [...state]);
            const autoEmoji = hasAnyAutoUB
                ? renderAutoState(prevAutoState, autoState)
                : '';
            const fullDangoStr = dangoStr + autoEmoji;

            // 🌟マーカー
            const isManual = entry.ubType === 'manual';

            // 出力行の構築
            let newText: string;
            if (isManual && !entry.isSubLine) {
                newText = `🌟${entry.originalText.trimStart()} ${fullDangoStr}`;
            } else if (entry.isSubLine) {
                newText = `${entry.originalText} ${fullDangoStr}`;
            } else {
                newText = `${entry.originalText} ${fullDangoStr}`;
            }

            resultLines[entry.lineIndex] = newText;
        }

        // 初期行(1:30 開始)を最初のTLエントリの直前に挿入
        if (entries.length > 0) {
            resultLines.splice(entries[0].lineIndex, 0, '', initialLine, '');
        }

        // 連続空行を圧縮し、前後の空白を除去
        return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    private buildPartyGuide(): PartyGuideError {
        return new PartyGuideError([
            '推論モードにはパーティーメンバー5人の指定が必要です。',
            '@dango の後にスペース区切りで左から順に5人のキャラ名を記述してください。',
            '',
            '例: @dango キャラ1 キャラ2 キャラ3 キャラ4 キャラ5',
        ].join('\n'));
    }

    private buildChannelPartyGuide(): PartyGuideError {
        return new PartyGuideError([
            'パーティーメンバー5人の指定が必要です。',
            '1行目にスペース区切りで左から順に5人のキャラ名を記述してください。',
            '',
            '例:',
            'キャラ1 キャラ2 キャラ3 キャラ4 キャラ5',
            '',
            '1:20 キャラ1 手動発動',
            '1:10 キャラ2 #通常cl',
        ].join('\n'));
    }
}

// 推論モード用のエントリ型
interface InferEntry {
    lineIndex: number;
    originalText: string;
    timeStr: string;
    actorIndex: number;
    actorName: string;
    ubType: UBType;
    isSubLine: boolean;
    explicitSets: number[];
    inlineInstructions: InlineInstructions;
}
