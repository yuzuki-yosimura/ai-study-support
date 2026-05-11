import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { postGroqChatCompletions } from "@/lib/llm/groq";
import {
  parseQuizJson,
  pickQuizQuestionFromDb,
  type QuizPair,
} from "@/lib/quiz/fallback";

const prisma = new PrismaClient();

const NOTICE_DB_FALLBACK =
  "APIの利用制限または応答形式の都合により、登録済みの問題から出題しています。";

const NOTICE_DB_ONLY =
  "登録済みデータベースから出題しています（/db モード）。";

const NOTICE_CHAT_DEGRADED =
  "AIチャットは現在利用できません（利用枠の上限など）。クイズは引き続き利用できます。";

const CHAT_STATIC_REPLY =
  "現在、AIチャットは一時的に利用できません（利用枠の上限など）。英単語クイズは「/quiz」（Groq 優先）または「/db」（DB のみ）でお使いいただけます。";

function toGroqMessages(
  rows: { role: string; content: string }[]
): { role: string; content: string }[] {
  return rows
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: String(m.content) }));
}

async function loadDistinctQuizPairs(): Promise<QuizPair[]> {
  return prisma.quizLog.findMany({
    select: { question: true, answer: true },
    distinct: ["question", "answer"],
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, mode, quizFromDb } = body as {
      messages?: unknown;
      mode?: string;
      quizFromDb?: boolean;
    };

    if (mode === "quiz") {
      let excludePrompt = "";
      let historyPairs: QuizPair[] = [];

      try {
        historyPairs = await loadDistinctQuizPairs();
        if (historyPairs.length > 0) {
          const historyText = historyPairs
            .map((q) => `「${q.question}」→「${q.answer}」`)
            .join("、");
          excludePrompt = `\n\n以下の問題は既に出題済みなので避けてください: ${historyText}`;
        }
      } catch (error) {
        console.error("Error fetching quiz history:", error);
      }

      if (quizFromDb === true) {
        const fromDbOnly = await pickQuizQuestionFromDb(prisma, historyPairs);
        if (fromDbOnly) {
          return NextResponse.json({
            quiz: JSON.stringify(fromDbOnly),
            source: "db",
            notice: NOTICE_DB_ONLY,
          });
        }
        return NextResponse.json(
          {
            error:
              "データベースに出題できる問題がありません。npm run db:seed を実行してください。",
          },
          { status: 503 }
        );
      }

      const promptMessages = [
        {
          role: "system",
          content:
            "あなたは英語学習の先生です。必ずJSONのみを返してください。",
        },
        {
          role: "user",
          content: `中学レベルの英単語クイズを1問作ってください。
日本語の意味と正解の英単語を次の形式で返してください:
{"question": "日本語の意味", "answer": "英単語"}${excludePrompt}`,
        },
      ];

      const groq = await postGroqChatCompletions(promptMessages);

      if (groq.ok && groq.content) {
        const parsed = parseQuizJson(groq.content);
        if (parsed) {
          return NextResponse.json({
            quiz: JSON.stringify(parsed),
            source: "groq",
          });
        }
      } else {
        console.error("Groq quiz failure:", groq.status, groq.errorBody);
      }

      const fromDb = await pickQuizQuestionFromDb(prisma, historyPairs);
      if (fromDb) {
        return NextResponse.json({
          quiz: JSON.stringify(fromDb),
          source: "db",
          notice: NOTICE_DB_FALLBACK,
        });
      }

      return NextResponse.json(
        {
          error:
            "問題を生成できませんでした。GROQ_API_KEY とデータベースのシード（npm run db:seed）を確認してください。",
        },
        { status: 503 }
      );
    }

    if (mode === "chat") {
      if (!Array.isArray(messages)) {
        return NextResponse.json(
          { error: "messages が不正です。" },
          { status: 400 }
        );
      }

      const promptMessages = toGroqMessages(
        messages as { role: string; content: string }[]
      );

      if (promptMessages.length === 0) {
        return NextResponse.json(
          { error: "送信できるメッセージがありません。" },
          { status: 400 }
        );
      }

      const groq = await postGroqChatCompletions(promptMessages);

      if (groq.ok && groq.content) {
        return NextResponse.json({
          reply: groq.content,
          source: "groq",
        });
      }

      console.error("Groq chat failure:", groq.status, groq.errorBody);

      return NextResponse.json({
        reply: CHAT_STATIC_REPLY,
        source: "static",
        degraded: true,
        notice: NOTICE_CHAT_DEGRADED,
      });
    }

    return NextResponse.json({ error: "不正な mode です。" }, { status: 400 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
