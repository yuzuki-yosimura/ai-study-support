import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages, mode} = await req.json();
    const systemPrompt =
      mode === "quiz"
        ? `あなたは中学英語の家庭教師です。
ユーザーに英単語のクイズを1問ずつ出題してください。
出題形式は「日本語: ○○ → 英語で答えてください」としてください。
ユーザーの回答に対して「正解/不正解」と「正しい答え」を伝えた上で、次の問題を出してください。
一度に複数の問題は出さず、必ず1問ずつ出題してください。`
        : "あなたは親切なアシスタントです。ユーザーの質問に答えてください。";

    // フロントから渡された messages を OpenAI にそのまま渡す
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages.map((m: any) => ({
        role: m.role === "ai" ? "assistant" : m.role,
        content: m.content,
      })),
    });

    return NextResponse.json({
      reply: response.choices[0].message?.content || "応答できませんでした。",
    });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return NextResponse.json(
      { error: "APIリクエストに失敗しました" },
      { status: 500 }
    );
  }
}
