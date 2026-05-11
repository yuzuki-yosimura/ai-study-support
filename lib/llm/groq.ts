export type GroqChatMessage = {
  role: string;
  content: string;
};

export type GroqChatResult = {
  ok: boolean;
  status: number;
  content: string | null;
  errorBody: unknown;
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export function defaultGroqModel(): string {
  return process.env.GROQ_MODEL || "llama-3.1-8b-instant";
}

export async function postGroqChatCompletions(
  messages: GroqChatMessage[]
): Promise<GroqChatResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      content: null,
      errorBody: { message: "GROQ_API_KEY is not set" },
    };
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: defaultGroqModel(),
      messages,
    }),
  });

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      status: res.status,
      content: null,
      errorBody: { message: "Invalid JSON from Groq" },
    };
  }

  const choices = data.choices as unknown;
  const first =
    Array.isArray(choices) && choices.length > 0
      ? (choices[0] as { message?: { content?: unknown } })
      : null;
  const content =
    first?.message && typeof first.message.content === "string"
      ? first.message.content
      : null;

  if (content != null && res.ok) {
    return { ok: true, status: res.status, content, errorBody: null };
  }

  return {
    ok: false,
    status: res.status,
    content,
    errorBody: data.error ?? data,
  };
}
