// src/bot/index.ts
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Princessify } from '../logic/princessify'; // ロジックを読み込み
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

// 起動時のイベント
client.once(Events.ClientReady, c => {
    console.log(`🤖 準備完了！ ${c.user.tag} としてログインしました。`);
});

// メッセージを受信した時のイベント
client.on(Events.MessageCreate, async message => {
    // 自分自身のメッセージは無視する（無限ループ防止）
    if (message.author.bot) return;

    // TL変換のトリガーとなる条件
    // ここでは「@party」が含まれているメッセージ全てに反応するようにします
    if (message.content.includes('@party')) {
        try {
            console.log(`📩 メッセージを受信: ${message.author.username}`);

            // 変換を実行
            const result = tool.convert(message.content);

            // 結果を返信（コードブロックで囲むときれいです）
            await message.reply(`✨ **Princessify Result** ✨\n\`\`\`text\n${result}\n\`\`\``);
            
        } catch (error) {
            console.error(error);
            await message.reply("❌ エラーが発生しました。");
        }
    }
});

// ログイン実行
client.login(process.env.DISCORD_TOKEN);