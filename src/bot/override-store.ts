// src/bot/override-store.ts
// ランドソル杯 — 代理入力（オーバーライド）の永続化ストア

import * as fs from 'fs';
import * as path from 'path';

export interface StoredOverride {
    targetUserId: string;
    targetDisplayName: string;
    date: string;           // "2026/2/25" — 人間可読
    gameDayMs: number;      // getGameDayStart のタイムスタンプ — 範囲検索用
    rolls: number[];
    totalGems: number;
    registeredBy: string;
    registeredAt: string;   // ISO 8601
}

export class OverrideStore {
    private data: Map<string, StoredOverride[]>;
    private readonly filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
        this.data = new Map();
        this.load();
    }

    /** upsert: channelId + targetUserId + date で一意。同一キーなら上書き。 */
    set(channelId: string, entry: StoredOverride): void {
        let entries = this.data.get(channelId);
        if (!entries) {
            entries = [];
            this.data.set(channelId, entries);
        }
        const idx = entries.findIndex(
            e => e.targetUserId === entry.targetUserId && e.date === entry.date
        );
        if (idx >= 0) {
            entries[idx] = entry;
        } else {
            entries.push(entry);
        }
        this.save();
    }

    /** 指定エントリを削除。見つからなければ false。 */
    remove(channelId: string, targetUserId: string, date: string): boolean {
        const entries = this.data.get(channelId);
        if (!entries) return false;
        const idx = entries.findIndex(
            e => e.targetUserId === targetUserId && e.date === date
        );
        if (idx < 0) return false;
        entries.splice(idx, 1);
        if (entries.length === 0) {
            this.data.delete(channelId);
        }
        this.save();
        return true;
    }

    /** チャンネルの全オーバーライドを削除。削除件数を返す。 */
    clear(channelId: string): number {
        const entries = this.data.get(channelId);
        if (!entries || entries.length === 0) return 0;
        const count = entries.length;
        this.data.delete(channelId);
        this.save();
        return count;
    }

    /** チャンネルのオーバーライド一覧 */
    list(channelId: string): StoredOverride[] {
        return this.data.get(channelId) ?? [];
    }

    /** 日付範囲内のオーバーライドを取得: startMs <= gameDayMs < endMs */
    getForDateRange(channelId: string, startMs: number, endMs: number): StoredOverride[] {
        const entries = this.data.get(channelId);
        if (!entries) return [];
        return entries.filter(e => e.gameDayMs >= startMs && e.gameDayMs < endMs);
    }

    private load(): void {
        if (fs.existsSync(this.filePath)) {
            const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            this.data = new Map(Object.entries(raw));
        }
    }

    private save(): void {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const obj: Record<string, StoredOverride[]> = {};
        for (const [k, v] of this.data) {
            obj[k] = v;
        }
        fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
    }
}
