/**
 * SQLite（旧 dev.db 等）から PostgreSQL（現在の DATABASE_URL）へデータをコピーする。
 *
 * 前提:
 * - 移行先 Postgres にマイグレ済み（テーブルが存在する）
 * - SQLITE_SOURCE_PATH に読み取り元の .db ファイル
 * - DATABASE_URL が postgresql://...
 *
 * QuizQuestion: (question, answer) が既に Postgres に無い行だけ挿入
 * QuizLog: SQLite の全行をそのまま追加（二重実行すると履歴が二重になる）
 */

import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    )
    .get(name);
  return row != null;
}

async function main() {
  const rawPath = process.env.SQLITE_SOURCE_PATH;
  if (!rawPath?.trim()) {
    console.error(
      "環境変数 SQLITE_SOURCE_PATH を設定してください（例: ./prisma/dev.db）"
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.startsWith("postgresql:")) {
    console.error(
      "DATABASE_URL は PostgreSQL の接続文字列である必要があります（移行先）。"
    );
    process.exit(1);
  }

  const sqlitePath = path.resolve(process.cwd(), rawPath.trim());
  if (!fs.existsSync(sqlitePath)) {
    console.error(`SQLite ファイルが見つかりません: ${sqlitePath}`);
    process.exit(1);
  }

  const sqlite = new Database(sqlitePath, { fileMustExist: true, readonly: true });
  try {
    if (!tableExists(sqlite, "QuizLog")) {
      console.warn('SQLite に "QuizLog" テーブルがありません。スキップします。');
    } else {
      const logs = sqlite
        .prepare(
          `SELECT "question", "answer", "correct", "createdAt" FROM "QuizLog"`
        )
        .all() as {
          question: string;
          answer: string;
          correct: number | boolean;
          createdAt: string;
        }[];

      const logData = logs.map((l) => ({
        question: l.question,
        answer: l.answer,
        correct: Boolean(l.correct),
        createdAt: new Date(l.createdAt),
      }));

      if (logData.length > 0) {
        await prisma.quizLog.createMany({ data: logData });
      }
      console.log(`QuizLog: ${logData.length} 件を PostgreSQL に挿入しました。`);
    }

    if (!tableExists(sqlite, "QuizQuestion")) {
      console.warn(
        'SQLite に "QuizQuestion" テーブルがありません（旧 DB の可能性）。スキップします。'
      );
    } else {
      const questions = sqlite
        .prepare(
          `SELECT "question", "answer", "category" FROM "QuizQuestion"`
        )
        .all() as {
          question: string;
          answer: string;
          category: string | null;
        }[];

      let inserted = 0;
      for (const row of questions) {
        const exists = await prisma.quizQuestion.findFirst({
          where: { question: row.question, answer: row.answer },
        });
        if (!exists) {
          await prisma.quizQuestion.create({
            data: {
              question: row.question,
              answer: row.answer,
              category: row.category,
            },
          });
          inserted++;
        }
      }
      console.log(
        `QuizQuestion: ${inserted} 件を新規挿入（SQLite ${questions.length} 件のうち、既存と重複したものはスキップ）。`
      );
    }

    console.log("移行が完了しました。");
  } finally {
    sqlite.close();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
