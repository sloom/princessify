// src/bot/index.ts
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Princessify, PartyGuideError } from '../logic/princessify';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

// Botクライアントの作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // サーバーに参加する権限
        GatewayIntentBits.GuildMessages,    // メッセージを受け取る権限
        GatewayIntentBits.MessageContent    // メッセージの中身を読む権限
    ]
});

// 変換ツールのインスタンス
const tool = new Princessify();

// 特定チャンネルID（設定されている場合、そのチャンネルでは@dango不要で動作）
const CHANNEL_ID = process.env.CHANNEL_ID;

// 起動時のイベント
client.once(Events.ClientReady, c => {
    console.log(`🤖 準備完了！ ${c.user.tag} としてログインしました。`);
    if (CHANNEL_ID) {
        console.log(`📌 チャンネル ${CHANNEL_ID} を監視中`);
    }
});

// メッセージを受信した時のイベント
client.on(Events.MessageCreate, async message => {
    // 自分自身のメッセージは無視する（無限ループ防止）
    if (message.author.bot) return;

    const isTargetChannel = CHANNEL_ID !== undefined && message.channelId === CHANNEL_ID;
    const hasDangoTrigger = message.content.includes('@dango');

    if (isTargetChannel || hasDangoTrigger) {
        try {
            console.log(`📩 メッセージを受信: ${message.author.username}`);

            // 変換を実行
            const result = tool.convert(message.content, {
                channelMode: isTargetChannel && !hasDangoTrigger
            });

            // 結果を返信（コードブロックで囲むときれいです）
            await message.reply(`✨ **Princessify Result** ✨\n\`\`\`cs\n${result}\n\`\`\``);

        } catch (error) {
            if (error instanceof PartyGuideError) {
                await message.reply(error.message);
            } else {
                console.error(error);
                await message.reply("❌ エラーが発生しました。");
            }
        }
    }
});

// ログイン実行
client.login(process.env.DISCORD_TOKEN);