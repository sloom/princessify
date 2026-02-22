// src/logic/route.ts
// 凸ルート計算（クランバトル）

// --- エラー型 ---

export class RouteError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RouteError';
    }
}

// --- データ型 ---

export interface PartyMember {
    name: string;
    mustRent: boolean;
}

export interface BossParty {
    bossIndex: number;
    members: PartyMember[];
}

export interface RouteInput {
    parties: BossParty[];
}

/** 1ルートの1バトルのレンタル情報 */
export interface BattleRental {
    bossIndex: number;
    rentalOptions: string[];   // レンタル候補キャラ名
    isFreeRental: boolean;     // 全5人がレンタル可能
}

/** 1つの有効ルート */
export interface ValidRoute {
    bosses: number[];           // 3ボスのインデックス（昇順）
    battles: BattleRental[];    // 3バトル分のレンタル情報
    isIndependent: boolean;     // レンタル選択が独立か
    /** 非独立の場合の各パターン（[battle0のレンタル名, battle1, battle2]） */
    dependentPatterns?: [string, string, string][];
}

// --- パース ---

const SEPARATOR = /[\s,、，]+/;
const ROUTE_TRIGGER = /[@-](?:route|rou)\b\s*([\s\S]*)/;

export function parsePartyLine(line: string): PartyMember[] {
    const tokens = line.trim().split(SEPARATOR).filter(t => t.length > 0);
    return tokens.map(token => {
        const mustRent = token.endsWith('*');
        const name = mustRent ? token.slice(0, -1) : token;
        return { name, mustRent };
    });
}

export function parseRouteMessage(text: string): RouteInput | null {
    const match = text.match(ROUTE_TRIGGER);
    if (!match) return null;

    const lines = match[1].split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parties: BossParty[] = lines.map((line, i) => ({
        bossIndex: i,
        members: parsePartyLine(line)
    }));

    return { parties };
}

// --- バリデーション ---

export function validateInput(input: RouteInput): void {
    if (input.parties.length !== 5) {
        throw new RouteError(`❌ パーティは5つ必要です（現在: ${input.parties.length}）`);
    }
    for (let i = 0; i < 5; i++) {
        const party = input.parties[i];
        if (party.members.length !== 5) {
            throw new RouteError(`❌ ${i + 1}ボスのパーティは5人必要です（現在: ${party.members.length}人）`);
        }
        const rentCount = party.members.filter(m => m.mustRent).length;
        if (rentCount > 1) {
            throw new RouteError(`❌ ${i + 1}ボスのパーティにレンタル必須(*)が${rentCount}人います（最大1人）`);
        }
    }
}

// --- ルート探索 ---

/** C(n,k) の組み合わせを列挙 */
function combinations(arr: number[], k: number): number[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = combinations(rest, k);
    return [...withFirst, ...withoutFirst];
}

/** 3バトルのレンタル割り当てが有効か検証 */
function isValidAssignment(
    battles: BossParty[],
    rentals: [number, number, number]
): boolean {
    // *マーカー制約チェック
    for (let b = 0; b < 3; b++) {
        const members = battles[b].members;
        for (let m = 0; m < 5; m++) {
            if (members[m].mustRent && m !== rentals[b]) return false;
        }
    }
    // 非レンタルキャラの重複チェック
    const used = new Set<string>();
    for (let b = 0; b < 3; b++) {
        const members = battles[b].members;
        for (let m = 0; m < 5; m++) {
            if (m === rentals[b]) continue;
            if (used.has(members[m].name)) return false;
            used.add(members[m].name);
        }
    }
    return true;
}

export function findAllRoutes(parties: BossParty[]): ValidRoute[] {
    const combos = combinations([0, 1, 2, 3, 4], 3);
    const results: ValidRoute[] = [];

    for (const combo of combos) {
        const battles = combo.map(i => parties[i]);

        // 全レンタル割り当てを探索
        const validPatterns: [number, number, number][] = [];
        for (let r0 = 0; r0 < 5; r0++) {
            for (let r1 = 0; r1 < 5; r1++) {
                for (let r2 = 0; r2 < 5; r2++) {
                    if (isValidAssignment(battles, [r0, r1, r2])) {
                        validPatterns.push([r0, r1, r2]);
                    }
                }
            }
        }

        if (validPatterns.length === 0) continue;

        // 各バトルのレンタル候補を集約
        const perBattleSets: Set<number>[] = [new Set(), new Set(), new Set()];
        for (const [r0, r1, r2] of validPatterns) {
            perBattleSets[0].add(r0);
            perBattleSets[1].add(r1);
            perBattleSets[2].add(r2);
        }

        // 独立性判定: デカルト積のサイズ == 有効パターン数か？
        const productSize = perBattleSets[0].size * perBattleSets[1].size * perBattleSets[2].size;
        const isIndependent = productSize === validPatterns.length;

        // レンタル候補を名前に変換
        const battleRentals: BattleRental[] = combo.map((bossIdx, i) => {
            const names = [...perBattleSets[i]].map(idx => battles[i].members[idx].name);
            return {
                bossIndex: bossIdx,
                rentalOptions: names,
                isFreeRental: perBattleSets[i].size === 5,
            };
        });

        const route: ValidRoute = {
            bosses: combo,
            battles: battleRentals,
            isIndependent,
        };

        // 非独立の場合、全パターンを名前で列挙
        if (!isIndependent) {
            route.dependentPatterns = validPatterns.map(([r0, r1, r2]) => [
                battles[0].members[r0].name,
                battles[1].members[r1].name,
                battles[2].members[r2].name,
            ]);
        }

        results.push(route);
    }

    return results;
}

// --- 出力フォーマット ---

import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export function loadBossEmojis(): string[] {
    try {
        const filePath = path.join(process.cwd(), 'src/config/boss-emojis.json');
        const data = fs.readFileSync(filePath, 'utf-8');
        const emojis = JSON.parse(data);
        if (Array.isArray(emojis) && emojis.length >= 5) return emojis;
    } catch {}
    return DEFAULT_EMOJIS;
}

/** 1バトル行をフォーマット */
function formatBattleLine(
    battle: BattleRental,
    party: BossParty,
    emojis: string[],
    rentalName?: string // 非独立の場合、特定のレンタル名を指定
): string {
    const bossNum = battle.bossIndex + 1;
    const emoji = emojis[battle.bossIndex] ?? '';
    let line = `${bossNum}${emoji} `;

    const rentalToShow = rentalName ?? (battle.rentalOptions.length === 1 ? battle.rentalOptions[0] : null);

    if (battle.isFreeRental && !rentalName) {
        line += party.members.map(m => m.name).join(' ') + ' ※レンタル自由';
    } else if (rentalToShow) {
        line += party.members.map(m =>
            m.name === rentalToShow ? `(${m.name})` : m.name
        ).join(' ');
    } else {
        // 複数候補（独立）→ "(X or Y)" 表示
        const rentalSet = new Set(battle.rentalOptions);
        let orInserted = false;
        const parts: string[] = [];
        for (const m of party.members) {
            if (rentalSet.has(m.name) && !orInserted) {
                parts.push(`(${battle.rentalOptions.join(' or ')})`);
                orInserted = true;
            } else if (rentalSet.has(m.name) && orInserted) {
                parts.push(m.name);
            } else {
                parts.push(m.name);
            }
        }
        line += parts.join(' ');
    }

    return line;
}

/** 1ルート分をフォーマット */
function formatSingleRoute(route: ValidRoute, parties: BossParty[], emojis: string[]): string {
    const routeLabel = route.bosses.map(b => b + 1).join('→');
    const lines: string[] = [`⚔️${routeLabel}`];

    if (route.isIndependent) {
        for (let i = 0; i < 3; i++) {
            lines.push(formatBattleLine(route.battles[i], parties[route.bosses[i]], emojis));
        }
    } else if (route.dependentPatterns) {
        // 非独立: 重複を除いたユニークパターンを列挙
        const uniquePatterns = deduplicatePatterns(route.dependentPatterns);
        if (uniquePatterns.length === 1) {
            // 実質1パターン
            for (let i = 0; i < 3; i++) {
                lines.push(formatBattleLine(route.battles[i], parties[route.bosses[i]], emojis, uniquePatterns[0][i]));
            }
        } else {
            for (let p = 0; p < uniquePatterns.length; p++) {
                lines.push(`  パターン${String.fromCharCode(65 + p)}:`);
                for (let i = 0; i < 3; i++) {
                    lines.push(`  ${formatBattleLine(route.battles[i], parties[route.bosses[i]], emojis, uniquePatterns[p][i])}`);
                }
            }
        }
    }

    return lines.join('\n');
}

/** 非独立パターンから「レンタル自由なバトルの違い」を除去 */
function deduplicatePatterns(patterns: [string, string, string][]): [string, string, string][] {
    const seen = new Set<string>();
    const result: [string, string, string][] = [];
    for (const p of patterns) {
        const key = p.join('|');
        if (!seen.has(key)) {
            seen.add(key);
            result.push(p);
        }
    }
    return result;
}

export function formatRouteResult(routes: ValidRoute[], parties: BossParty[]): string[] {
    if (routes.length === 0) {
        return ['⚔️ 有効な凸ルートが見つかりませんでした'];
    }

    const emojis = loadBossEmojis();
    const header = `⚔️ ${routes.length}件の凸ルートが見つかりました\n`;
    const blocks: string[] = [];

    for (const route of routes) {
        blocks.push(formatSingleRoute(route, parties, emojis));
    }

    // 2000文字制限に配慮してメッセージ分割
    const messages: string[] = [];
    let current = header;

    for (const block of blocks) {
        if (current.length + block.length + 2 > 1900) {
            messages.push(current.trimEnd());
            current = '';
        }
        current += '\n' + block + '\n';
    }

    if (current.trim().length > 0) {
        messages.push(current.trimEnd());
    }

    return messages;
}
