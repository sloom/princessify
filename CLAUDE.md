# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

princessifyは、プリコネR向けのタイムライン（TL）を解析し、UB（ユニオンバースト）発動時のキャラ状態を可視化するDiscord Botです。

## 開発コマンド

```bash
# テスト実行
npx ts-node src/logic/princessify.test.ts   # お団子TLテスト（305テスト）
npx ts-node src/logic/route.test.ts          # 凸ルートテスト（64アサーション）
npx ts-node src/logic/landsol-cup.test.ts    # ランドソル杯テスト（68テスト）
npx ts-node src/logic/mochikoshi.test.ts     # 持ち越し計算テスト

# Discord Botを起動
npx ts-node src/bot/index.ts

# 型チェック
npx tsc --noEmit
```

## アーキテクチャ

### コアロジック
- `src/logic/princessify.ts`: TL変換（お団子/旗揚げ）のコアロジック
  - **既存モード**: ユーザーが記述したお団子状態を正として差分表示
  - **推論モード**: `@dango`ヘッダー＋パーティ5人でお団子を自動推論（SET/AUTO検出）
  - インライン命令: `{名前}セット/解除`、`オートオン/オフ` をTL内で認識
  - ゲームコピー形式: 「ユニオンバースト発動時間」行を起点として解析
  - 🌟マーカー: 手動目押しUBに🌟を付与
- `src/logic/mochikoshi.ts`: 持ち越し時間計算（同時凸の組み合わせ探索）
- `src/logic/route.ts`: 凸ルート計算（5パーティ×レンタル制約の全探索）
- `src/logic/landsol-cup.ts`: ランドソル杯ランキング（ガチャ結果集計）

### Bot / インフラ
- `src/bot/index.ts`: Discord Bot（メッセージ → route → mochi → dango の順でディスパッチ）
- `src/bot/channel-store.ts`: channelMode用のチャンネル永続化ストア
- `src/config/boss-emojis.json`: ボス絵文字設定（外部ファイル）

## Botコマンド一覧

| トリガー | 機能 |
|---------|------|
| `@dango` / `@party` | お団子TL変換（既存モード or 推論モード） |
| `@mochi` / `@mo` | 持ち越し時間計算（同時凸） |
| `@route` / `@rou` | 凸ルート計算（3凸×レンタル制約） |
| `/landsol-cup` | ランドソル杯ランキング（スラッシュコマンド） |
| `/dango add` / `remove` | channelMode設定（対象チャンネルでは`@dango`不要） |

## 入力フォーマット例

### お団子TL（@dango）
```
@dango キャラ1 キャラ2 キャラ3 キャラ4 キャラ5

1:13 キャラ1
0:55 キャラ2 アクション説明
```

### 持ち越し計算（@mochi）
```
@mochi ボスHP ダメージ1 ダメージ2 ダメージ3
```

### 凸ルート（@route）
```
@route
キャラA キャラB キャラC キャラD *キャラE
（5行のパーティ構成、*=レンタル必須）
```

## 環境変数

`.env`ファイルに`DISCORD_TOKEN`を設定してBot起動
