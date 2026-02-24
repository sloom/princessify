// src/bot/index.ts
import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, SnowflakeUtil, TextChannel, Collection, Message } from 'discord.js';
import { Princessify, PartyGuideError } from '../logic/princessify';
import { parseMochiMessage, formatMochiResult } from '../logic/mochikoshi';
import { parseRouteMessage, validateInput, findAllRoutes, formatRouteResult, RouteError } from '../logic/route';
import { parseGachaRolls, computeTotalGems, buildRanking, formatRanking, getGameDayStart, GachaResult } from '../logic/landsol-cup';
import { ChannelStore } from './channel-store';
import { createServer } from 'http';
import * as path from 'path';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

// Discord メッセージ上限（安全マージンを含む）
const DISCORD_MAX_LENGTH = 1950;

/**
 * 長い結果テキストをDiscordの文字数上限に収まるよう行単位で分割する。
 * 各チャンクは ```cs ... ``` コードブロックで囲まれ、最初のチャンクにのみ greeting を付与。
 */
export function splitForDiscord(body: string, greeting: string): string[] {
    const codeOpen = '```cs\n';
    const codeClose = '\n```';

    // 1チャンク目のオーバーヘッド: greeting\n```cs\n ... \n```
    const firstOverhead = greeting.length + 1 + codeOpen.length + codeClose.length;
    // 2チャンク目以降: ```cs\n ... \n```
    const laterOverhead = codeOpen.length + codeClose.length;

    const firstMax = DISCORD_MAX_LENGTH - firstOverhead;
    const laterMax = DISCORD_MAX_LENGTH - laterOverhead;

    // 分割不要
    if (body.length <= firstMax) {
        return [`${greeting}\n${codeOpen}${body}${codeClose}`];
    }

    const lines = body.split('\n');
    const chunks: string[] = [];
    let currentLines: string[] = [];
    let currentLen = 0;
    let isFirst = true;

    for (const line of lines) {
        const maxLen = isFirst ? firstMax : laterMax;
        // +1 は改行文字分（最初の行以外）
        const addLen = currentLines.length === 0 ? line.length : line.length + 1;

        if (currentLen + addLen > maxLen && currentLines.length > 0) {
            // チャンクを確定
            const content = currentLines.join('\n');
            if (isFirst) {
                chunks.push(`${greeting}\n${codeOpen}${content}${codeClose}`);
                isFirst = false;
            } else {
                chunks.push(`${codeOpen}${content}${codeClose}`);
            }
            currentLines = [line];
            currentLen = line.length;
        } else {
            currentLines.push(line);
            currentLen += addLen;
        }
    }

    // 残りを最後のチャンクに
    if (currentLines.length > 0) {
        const content = currentLines.join('\n');
        if (isFirst) {
            chunks.push(`${greeting}\n${codeOpen}${content}${codeClose}`);
        } else {
            chunks.push(`${codeOpen}${content}${codeClose}`);
        }
    }

    return chunks;
}

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

// モード別ランダムメッセージ
const MESSAGES_EXISTING = [
    '✨ふむ。最高のTLだな。',
    '✨感謝したまえよ。'
];
const MESSAGES_INFERENCE = [
    '✨ふむ。最高のTLだな。',
    '✨感謝したまえよ。',
    '✨推論の検証こそ学びだよ。'
];
function pickMessage(mode: 'inference' | 'existing'): string {
    const pool = mode === 'inference' ? MESSAGES_INFERENCE : MESSAGES_EXISTING;
    return pool[Math.floor(Math.random() * pool.length)];
}

// チャンネルストア（JSONファイルで永続化、.envはシード値）
const store = new ChannelStore(
    path.join(__dirname, '../../data/channels.json'),
    (process.env.CHANNEL_ID ?? '').split(',').map(s => s.trim()).filter(Boolean)
);

// 起動時のイベント
client.once(Events.ClientReady, async c => {
    console.log(`🤖 準備完了！ ${c.user.tag} としてログインしました。`);
    if (store.size > 0) {
        console.log(`📌 ${store.size} チャンネルを監視中`);
    }

    // スラッシュコマンド登録
    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
    const commands = [
        new SlashCommandBuilder()
            .setName('dango')
            .setDescription('Princessify の設定')
            .addSubcommand(sub => sub.setName('add').setDescription('このチャンネルを監視対象に追加'))
            .addSubcommand(sub => sub.setName('remove').setDescription('このチャンネルを監視対象から削除'))
            .addSubcommand(sub => sub.setName('list').setDescription('このサーバーの監視チャンネル一覧'))
            .setDefaultMemberPermissions(null),
        new SlashCommandBuilder()
            .setName('landsol-cup')
            .setDescription('ランドソル杯 — ランキング')
            .addStringOption(opt =>
                opt.setName('mode')
                    .setDescription('表示モード')
                    .setRequired(false)
                    .addChoices(
                        { name: '上位', value: 'top' },
                        { name: '下位', value: 'bottom' },
                        { name: '全員', value: 'all' }
                    ))
            .addIntegerOption(opt =>
                opt.setName('count')
                    .setDescription('表示件数（上位/下位モード用）')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(50))
    ];
    try {
        await rest.put(Routes.applicationCommands(c.user.id), { body: commands.map(cmd => cmd.toJSON()) });
        console.log('📝 スラッシュコマンド登録完了');
    } catch (err) {
        console.error('スラッシュコマンド登録失敗:', err);
    }
});

// スラッシュコマンド処理
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // /landsol-cup コマンド
    if (interaction.commandName === 'landsol-cup') {
        await handleLandsolCup(interaction);
        return;
    }

    if (interaction.commandName !== 'dango') return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'add' || sub === 'remove') {
        // 権限チェック: サーバー管理権限
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: '⛔ この操作にはサーバー管理権限が必要です。', flags: MessageFlags.Ephemeral });
            return;
        }
    }

    if (sub === 'add') {
        const added = store.add(interaction.channelId);
        await interaction.reply({
            content: added
                ? `✅ <#${interaction.channelId}> を監視対象に追加しました。このチャンネルでは @dango なしでTLが処理されます。`
                : `ℹ️ <#${interaction.channelId}> は既に監視対象です。`,
            flags: MessageFlags.Ephemeral
        });
    } else if (sub === 'remove') {
        const removed = store.remove(interaction.channelId);
        await interaction.reply({
            content: removed
                ? `✅ <#${interaction.channelId}> を監視対象から削除しました。`
                : `ℹ️ <#${interaction.channelId}> は監視対象に含まれていません。`,
            flags: MessageFlags.Ephemeral
        });
    } else if (sub === 'list') {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: '⛔ サーバー内でのみ使用できます。', flags: MessageFlags.Ephemeral });
            return;
        }
        const guildChannelIds = guild.channels.cache
            .filter(ch => ch.type === ChannelType.GuildText)
            .map(ch => ch.id);
        const monitored = store.listForGuild(guildChannelIds);
        if (monitored.length === 0) {
            await interaction.reply({ content: 'ℹ️ このサーバーには監視対象のチャンネルがありません。', flags: MessageFlags.Ephemeral });
        } else {
            const list = monitored.map(id => `• <#${id}>`).join('\n');
            await interaction.reply({ content: `📌 **監視中のチャンネル:**\n${list}`, flags: MessageFlags.Ephemeral });
        }
    }
});

// メッセージを受信した時のイベント
client.on(Events.MessageCreate, async message => {
    // 自分自身のメッセージは無視する（無限ループ防止）
    if (message.author.bot) return;

    // @route: 凸ルート計算
    const routeInput = parseRouteMessage(message.content);
    if (routeInput) {
        try {
            validateInput(routeInput);
            const routes = findAllRoutes(routeInput.parties);
            const messages = formatRouteResult(routes, routeInput.parties);
            for (const msg of messages) {
                await message.reply(`\`\`\`cs\n${msg}\n\`\`\``);
            }
        } catch (error) {
            if (error instanceof RouteError) {
                await message.reply(error.message);
            } else {
                console.error(error);
                await message.reply("❌ エラーが発生しました。");
            }
        }
        return;
    }

    // @mochi: 持ち越し時間計算
    const mochiInput = parseMochiMessage(message.content);
    if (mochiInput) {
        const result = formatMochiResult(mochiInput.bossHp, mochiInput.damages, mochiInput.labels, mochiInput.carryovers);
        await message.reply(result);
        return;
    }

    const isTargetChannel = store.has(message.channelId);
    const hasDangoTrigger = /[@-](?:dango|dan)\b/.test(message.content);

    if (isTargetChannel || hasDangoTrigger) {
        try {
            console.log(`📩 メッセージを受信: ${message.author.username}`);

            // 変換を実行
            const result = tool.convert(message.content, {
                channelMode: isTargetChannel && !hasDangoTrigger
            });

            // null = TLではないメッセージ → 無視
            if (result === null) return;

            // 結果を返信（モード別ランダムメッセージ + コードブロック）
            const greeting = pickMessage(tool.lastMode ?? 'existing');
            const chunks = splitForDiscord(result, greeting);
            console.log(`📤 ${chunks.length}チャンク送信 (${chunks.map(c => c.length).join(', ')}文字)`);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }

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

// /landsol-cup ハンドラ
async function handleLandsolCup(interaction: import('discord.js').ChatInputCommandInteraction) {
    const mode = (interaction.options.getString('mode') ?? 'all') as 'top' | 'bottom' | 'all';
    const count = interaction.options.getInteger('count') ?? undefined;

    const channel = interaction.channel;
    if (!channel || !('messages' in channel)) {
        await interaction.reply({ content: '⛔ このチャンネルではメッセージを取得できません。', flags: MessageFlags.Ephemeral });
        return;
    }

    // 処理中を通知（3秒以上かかる可能性があるため deferReply）
    await interaction.deferReply();

    try {
        const now = new Date();
        const gameDayStart = getGameDayStart(now);
        const afterSnowflake = SnowflakeUtil.generate({ timestamp: gameDayStart.getTime() }).toString();

        // メッセージをページネーションで取得
        const allMessages: Message[] = [];
        let lastId: string | undefined;

        while (true) {
            const options: { limit: number; after: string } = { limit: 100, after: lastId ?? afterSnowflake };
            const fetched: Collection<string, Message> = await (channel as TextChannel).messages.fetch(options);
            if (fetched.size === 0) break;

            // after は指定IDより新しいメッセージを返す。IDの昇順（古い→新しい）で並べる
            const sorted = [...fetched.values()].sort((a, b) =>
                Number(BigInt(a.id) - BigInt(b.id))
            );
            allMessages.push(...sorted);
            lastId = sorted[sorted.length - 1].id;

            if (fetched.size < 100) break;
        }

        // 各ユーザーの最新メッセージからガチャ結果を抽出
        // Map<userId, GachaResult> で後勝ち（=最新が上書き）
        // メッセージは古い順に並んでいるので、後のほうが新しい
        const resultMap = new Map<string, GachaResult>();

        for (const msg of allMessages) {
            if (msg.author.bot) continue;

            const rolls = parseGachaRolls(msg.content);
            if (!rolls) continue;

            const displayName = msg.member?.displayName ?? msg.author.displayName ?? msg.author.username;
            resultMap.set(msg.author.id, {
                userId: msg.author.id,
                displayName,
                rolls,
                totalGems: computeTotalGems(rolls),
            });
        }

        if (resultMap.size === 0) {
            await interaction.editReply('ℹ️ 本日のランドソル杯の結果が見つかりませんでした。');
            return;
        }

        const results = [...resultMap.values()];
        const ranking = buildRanking(results);
        const output = formatRanking(ranking, mode, count, now);

        await interaction.editReply(output);
    } catch (error) {
        console.error('landsol-cup error:', error);
        await interaction.editReply('❌ ランキングの集計中にエラーが発生しました。');
    }
}

// ヘルスチェック用HTTPサーバー
const PORT = process.env.PORT || 3000;
createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}).listen(PORT, () => {
    console.log(`🌐 ヘルスチェックサーバー起動: ポート ${PORT}`);
});

// ログイン実行
client.login(process.env.DISCORD_TOKEN);
