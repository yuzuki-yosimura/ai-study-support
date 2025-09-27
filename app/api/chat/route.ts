import { NextResponse } from "next/server";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, mode } = body; 
    // mode: "chat" | "quiz"

    let promptMessages;

    if (mode === "quiz") {
      // 🔹 クイズモード: 過去の問題を取得して除外
      let excludePrompt = "";
      
      try {
        const quizHistory = await prisma.quizLog.findMany({
          select: {
            question: true,
            answer: true,
          },
          distinct: ['question', 'answer'],
        });

        if (quizHistory.length > 0) {
          const historyText = quizHistory
            .map(q => `「${q.question}」→「${q.answer}」`)
            .join('、');
          excludePrompt = `\n\n以下の問題は既に出題済みなので避けてください: ${historyText}`;
        }
      } catch (error) {
        console.error('Error fetching quiz history:', error);
        // エラーが発生しても続行
      }

      promptMessages = [
        {
          role: "system",
          content: "あなたは英語学習の先生です。必ずJSONのみを返してください。",
        },
        {
          role: "user",
          content: `中学レベルの英単語クイズを1問作ってください。
日本語の意味と正解の英単語を次の形式で返してください:
{"question": "日本語の意味", "answer": "英単語"}${excludePrompt}`
        },
      ];
    } else {
      // 🔹 通常チャットモード
      promptMessages = messages;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // モデルは調整可
        messages: promptMessages,
      }),
    });

    const data = await res.json();

    // 🔹 クイズモードのときは JSON をそのまま返す
    if (mode === "quiz") {
      const content = data.choices[0].message.content;
      return NextResponse.json({ quiz: content });
    }

    // 🔹 通常チャット
    return NextResponse.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
