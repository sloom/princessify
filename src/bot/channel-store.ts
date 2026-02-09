// src/bot/channel-store.ts
import * as fs from 'fs';
import * as path from 'path';

export class ChannelStore {
    private channels: Set<string>;
    private readonly filePath: string;

    constructor(filePath: string, envChannels: string[]) {
        this.filePath = filePath;
        this.channels = new Set();
        this.load(envChannels);
    }

    add(channelId: string): boolean {
        if (this.channels.has(channelId)) return false;
        this.channels.add(channelId);
        this.save();
        return true;
    }

    remove(channelId: string): boolean {
        if (!this.channels.has(channelId)) return false;
        this.channels.delete(channelId);
        this.save();
        return true;
    }

    has(channelId: string): boolean {
        return this.channels.has(channelId);
    }

    listForGuild(guildChannelIds: string[]): string[] {
        const guildSet = new Set(guildChannelIds);
        return [...this.channels].filter(id => guildSet.has(id));
    }

    get size(): number {
        return this.channels.size;
    }

    private load(envChannels: string[]): void {
        if (fs.existsSync(this.filePath)) {
            const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            this.channels = new Set(data);
        } else if (envChannels.length > 0) {
            this.channels = new Set(envChannels);
            this.save();
        }
    }

    private save(): void {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.filePath, JSON.stringify([...this.channels], null, 2));
    }
}
