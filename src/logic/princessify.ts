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

interface TimelineEntry {
    lineIndex: number;      // 元の行番号
    originalText: string;   // 元の行テキスト
    timeStr: string;        // "1:13" など
    actorIndex: number;     // 0〜4 (パーティの誰か) -1なら不明
    actorName: string;      // キャラ名
    userState: boolean[];   // ユーザーが指定したお団子状態（あれば）
    hasUserDango: boolean;  // ユーザーがお団子を指定しているか
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

export class Princessify {
    private party: string[] = [];

    // 括弧付きお団子を見つける正規表現
    private readonly bracketedDangoRegex = buildBracketedDangoRegex();

    // 括弧なしお団子を見つける正規表現（5文字ちょうど）
    private readonly noBracketDangoRegex = buildNoBracketDangoRegex();

    public convert(inputText: string): string {
        const lines = inputText.split('\n');

        // 1. ヘッダー解析（@partyは省略可能）
        this.parseHeader(lines);

        // 2. タイムライン解析
        const entries = this.parseTimeline(lines);

        // 3. 推論と整形
        return this.inferAndRender(entries, lines);
    }

    private parseHeader(lines: string[]) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('@party')) {
                const parts = trimmed.substring(6).trim().split(/\s+/);
                if (parts.length === 5) {
                    this.party = parts;
                }
                break;
            }
        }
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

            // 処理対象の条件: 行頭付近に時間がある OR お団子がある OR キャラ名がある
            if (hasTimeNearStart || hasUserDango || actorIndex !== -1) {
                entries.push({
                    lineIndex,
                    originalText: line,
                    timeStr,
                    actorIndex,
                    actorName,
                    userState,
                    hasUserDango
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

            // 元のテキストへの埋め込み
            let newText = currentEntry.originalText;

            if (this.bracketedDangoRegex.test(newText)) {
                // 括弧付きお団子がある場合 -> 置換する
                newText = newText.replace(this.bracketedDangoRegex, dangoStr);
            } else if (this.noBracketDangoRegex.test(newText)) {
                // 括弧なしお団子がある場合 -> 置換する
                newText = newText.replace(this.noBracketDangoRegex, dangoStr);
            } else {
                // ない場合 -> 行末に追加
                newText = `${newText} ${dangoStr}`;
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
}
