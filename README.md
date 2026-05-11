# ai-study-support

中学レベルの英単語クイズと英語チャット。**Groq**（Chat Completions）を主に使い、失敗時は **SQLite の固定問題**へフォールバックします。回答は `QuizLog` に保存されます。

**スタック**: Next.js 14（App Router）、Tailwind v4、Prisma、SQLite、Groq（既定モデル `llama-3.1-8b-instant`）

## ビルド（Vercel / `npm run build`）

`build` スクリプトは **`prisma migrate deploy` → `prisma db seed` → `next build`** の順です。ビルド時点で **`DATABASE_URL` が有効**である必要があります。シードは **`QuizQuestion` を毎回作り直す**（`deleteMany` 後に投入）だけで、`QuizLog` は消しません。

## 開発（Docker）

前提: [Docker Desktop](https://www.docker.com/products/docker-desktop/) が起動していること（Compose v2）。

1. ルートに `.env` を用意する（`cp .env.example .env`）。少なくとも次を設定する。
   - `GROQ_API_KEY` … [Groq Console](https://console.groq.com/keys)
   - `DATABASE_URL` … 例 `file:./prisma/dev.db`（`.env.example` 参照）
   - `GROQ_MODEL` … 任意
2. 起動する。

   ```bash
   docker compose up
   ```

   初回はコンテナ内で `npm install` → `db:migrate` → `db:seed` → `next dev` が実行されます。ログに `Ready` が出たら [http://localhost:3000](http://localhost:3000) を開く。

3. 止める: `Ctrl+C` または `docker compose down`。

`node_modules` は Compose の名前付きボリューム、DB ファイルはホストの `prisma/` にマウントされます。問題を差し替えたあとはコンテナ内で `npm run db:seed` を実行してください。

## 使い方

| 入力 | 内容 |
|------|------|
| `/quiz` | クイズ（Groq 優先・失敗時 DB）5 問 |
| `/db` | クイズ（DB のみ）5 問 |
| `/chat` | チャットに戻る |

Groq が使えないときはチャットは定型文＋画面上部の通知バーです。

## ディレクトリの目安

| パス | 役割 |
|------|------|
| `app/page.tsx` | UI・クイズセッション |
| `app/api/chat/route.ts` | Groq / `quizFromDb` / フォールバック |
| `lib/llm/groq.ts` | Groq クライアント |
| `lib/quiz/fallback.ts` | クイズ JSON パース・DB 抽選 |
| `app/api/log`, `quiz-history` | 回答保存・履歴 |
| `prisma/` | スキーマ・マイグレーション・`seed.ts` |
