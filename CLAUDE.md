# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

princessifyは、プリコネR向けのタイムライン（TL）を解析し、UB（ユニオンバースト）発動時のキャラ状態を可視化するDiscord Botです。

## 開発コマンド

```bash
# ロジックの手動テスト
npx ts-node test.ts

# Discord Botを起動
npx ts-node src/bot/index.ts

# 型チェック
npx tsc --noEmit
```

## アーキテクチャ

- `src/logic/princessify.ts`: TL変換のコアロジック
  - `@party`で5人のパーティメンバーを定義
  - 時間形式（`M:SS`）の行からUB発動を検出
  - 各UB発動時の「お団子」状態（⭕❌OX）を推論して付与
- `src/bot/index.ts`: Discord Bot（`@party`を含むメッセージに反応）

## 入力フォーマット

```
@party キャラ1 キャラ2 キャラ3 キャラ4 キャラ5

1:13 キャラ1
0:55 キャラ2 アクション説明
```

## 環境変数

`.env`ファイルに`DISCORD_TOKEN`を設定してBot起動
