import type { PrismaClient } from "@prisma/client";

export type QuizPair = { question: string; answer: string };

function keyOf(p: QuizPair): string {
  const q = p.question.trim().toLowerCase();
  const a = p.answer.trim().toLowerCase();
  return `${q}\0${a}`;
}

export function parseQuizJson(raw: string): QuizPair | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(s);
  if (fence) s = fence[1].trim();
  try {
    const o = JSON.parse(s) as { question?: unknown; answer?: unknown };
    if (typeof o.question === "string" && typeof o.answer === "string") {
      const question = o.question.trim();
      const answer = o.answer.trim();
      if (question && answer) return { question, answer };
    }
  } catch {
    /* invalid JSON */
  }
  return null;
}

export async function pickQuizQuestionFromDb(
  prisma: PrismaClient,
  excludePairs: QuizPair[]
): Promise<QuizPair | null> {
  const exclude = new Set(excludePairs.map(keyOf));
  const all = await prisma.quizQuestion.findMany({
    select: { question: true, answer: true },
  });
  const candidates = all.filter((row) => !exclude.has(keyOf(row)));
  const pool = candidates.length > 0 ? candidates : all;
  if (pool.length === 0) return null;
  const i = Math.floor(Math.random() * pool.length);
  return pool[i];
}
