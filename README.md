# ai-study-support

中学レベルの英単語クイズと英語チャット。**Groq**（Chat Completions）を主に使い、失敗時は **DB に登録した固定問題**へフォールバックします。回答は **PostgreSQL** の `QuizLog` に保存します。

**スタック**: Next.js 14（App Router）、Tailwind v4、Prisma、**PostgreSQL**、Groq（既定モデル `llama-3.1-8b-instant`）

## ビルド（Vercel / `npm run build`）

`build` は **`prisma migrate deploy` → `prisma db seed` → `next build`** の順です。ビルド時に **`DATABASE_URL`（Postgres の接続文字列）** が必要です。Neon 等では **`?sslmode=require`** が付いた URL をそのまま使うことが多いです。

シードは **`QuizQuestion` を毎回作り直す**（`deleteMany` 後に投入）だけで、`QuizLog` は消しません。

## 開発（Docker）

前提: [Docker Desktop](https://www.docker.com/products/docker-desktop/) が起動していること（Compose v2）。

1. ルートに `.env` を用意する（`cp .env.example .env`）。**必須は `GROQ_API_KEY`**。`GROQ_MODEL` は任意。
2. **`docker compose up`** で **`db`（Postgres 16）と `app`（Next）** が立ち上がります。`app` には **`DATABASE_URL` が Compose 側で上書き**され、`db` サービスに接続します（`.env` に古い SQLite の URLがあっても Docker 内では Postgres を使います）。
3. 初回は `app` 内で `npm install` → `db:migrate` → `db:seed` → `next dev`。ログに `Ready` が出たら [http://localhost:3000](http://localhost:3000) を開く。
4. 止める: `Ctrl+C` または `docker compose down`（DB データはボリューム `postgres_data` に残ります）。

ホストからだけ Postgres を触りたいときはポート **5432** が公開されています（`.env.example` の `localhost` の URL）。

問題バンクを差し替えたあとは `app` コンテナ内で `npm run db:seed` を実行してください。

## 旧 SQLite（`dev.db`）から PostgreSQL へデータ移行

1. **移行先の Postgres** にマイグレが済んでいること（空でも、シード済みでも可）。
2. 環境変数を付けて **1 回だけ**実行する。

   ```bash
   npm install
   export DATABASE_URL="postgresql://..."   # 移行先（Neon やローカル Docker の db 等）
   export SQLITE_SOURCE_PATH="./prisma/dev.db"   # 旧 SQLite ファイルのパス
   npm run db:migrate-from-sqlite
   ```

3. **挙動**
   - **`QuizLog`**: SQLite の全行を **そのまま追加**（`createdAt` も保持）。**スクリプトを二度実行すると履歴が二重**になるので、やり直す場合は先に Postgres 側で `QuizLog` を削除するなどしてください。
   - **`QuizQuestion`**: `(question, answer)` が Postgres に **まだ無い行だけ**挿入（シードと重複する行はスキップ）。

スクリプト本体: [`scripts/migrate-sqlite-to-pg.ts`](scripts/migrate-sqlite-to-pg.ts)（読み取りに **better-sqlite3** を使用）。

## ホストで `npm run dev` する場合

PostgreSQL が **`localhost:5432`** で動いている必要があります（例: `docker compose up -d db` だけ起動しておく）。`.env` の `DATABASE_URL` を `.env.example` の localhost 例に合わせます。

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
