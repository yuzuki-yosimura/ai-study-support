"use client";

import { useState, useRef, useEffect } from "react";
import {motion, AnimatePresence} from "framer-motion";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

const QUIZ_ROUNDS = 5;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"chat" | "quiz">("chat");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const[darkMode, setDarkMode] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<{ question: string; answer: string } | null>(null);
  const [quizHistory, setQuizHistory] = useState<{ question: string; answer: string }[]>([]);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  /** 今回の /quiz セッションで答えた問数（0〜QUIZ_ROUNDS） */
  const [quizAnsweredCount, setQuizAnsweredCount] = useState(0);
  /** 今回のセッションでの正解数 */
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  /** 5問目終了後、結果表示までの間に追加出題しない */
  const [quizFinishing, setQuizFinishing] = useState(false);
  /** /db セッションでは API に quizFromDb を送る（再レンダー前でも参照できるよう ref） */
  const quizFromDbOnlyRef = useRef(false);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ダークモード切替
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // クイズ履歴を取得
  const fetchQuizHistory = async () => {
    try {
      const res = await fetch("/api/quiz-history");
      const data = await res.json();
      setQuizHistory(data.history || []);
    } catch (error) {
      console.error("クイズ履歴の取得に失敗:", error);
    }
  };

  // クイズ問題生成（再帰は最大回数で打ち切り）
  const generateQuiz = async (attempt = 0): Promise<void> => {
    if (attempt > 12) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 998,
          role: "assistant",
          content: "問題の生成に繰り返し失敗しました。しばらくしてからもう一度お試しください。",
        },
      ]);
      return;
    }

    setLoading(true);
    try {
      await fetchQuizHistory();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "quiz",
          ...(quizFromDbOnlyRef.current ? { quizFromDb: true } : {}),
        }),
      });

      const data = await res.json();

      if (typeof data.notice === "string" && data.notice.trim()) {
        setApiNotice(data.notice.trim());
      }

      if (!res.ok || data.error) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "問題の取得に失敗しました。";
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 997, role: "assistant", content: msg },
        ]);
        return;
      }

      if (typeof data.quiz !== "string") {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 996,
            role: "assistant",
            content: "問題データの形式が不正です。",
          },
        ]);
        return;
      }

      let quiz: { question: string; answer: string };
      try {
        quiz = JSON.parse(data.quiz);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 995,
            role: "assistant",
            content: "問題の解析に失敗しました。",
          },
        ]);
        return;
      }

      const isDuplicate = quizHistory.some(
        (q) => q.question === quiz.question && q.answer === quiz.answer
      );

      if (isDuplicate) {
        console.log("重複問題を検出、再生成します");
        return await generateQuiz(attempt + 1);
      }


      setCurrentQuiz(quiz);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `問題: 「${quiz.question}」を英語で？`,
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 999,
          role: "assistant",
          content: "問題の生成に失敗しました。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // モード切替処理
  const handleModeSwitch = async (command: string) => {
    if (command === "/quiz") {
      quizFromDbOnlyRef.current = false;
      setMode("quiz");
      setQuizAnsweredCount(0);
      setQuizCorrectCount(0);
      setQuizFinishing(false);
      setCurrentQuiz(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: `クイズモードに切り替えました（Groq 優先）。${QUIZ_ROUNDS}問出題します！`,
        },
      ]);
      setInput("");
      await generateQuiz();
      return true;
    }
    if (command === "/db") {
      quizFromDbOnlyRef.current = true;
      setMode("quiz");
      setQuizAnsweredCount(0);
      setQuizCorrectCount(0);
      setQuizFinishing(false);
      setCurrentQuiz(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: `データベース出題モードです（全${QUIZ_ROUNDS}問）。登録済みの問題だけから出します。`,
        },
      ]);
      setInput("");
      await generateQuiz();
      return true;
    }
    if (command === "/chat") {
      quizFromDbOnlyRef.current = false;
      setMode("chat");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: "チャットモードに切り替えました。何でもお聞きください！",
        },
      ]);
      setInput("");
      return true;
    }
    return false;
  };

  // メッセージ送信
  const sendMessage = async () => {
    if (!input.trim()) return;

    // モード切替コマンドのチェック
    if (await handleModeSwitch(input)) {
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // ====== クイズモードの処理 ======
      if (mode === "quiz") {
        if (quizFinishing) {
          return;
        }
        if (currentQuiz === null) {
          // ====== 出題フェーズ ======
          await generateQuiz();
        } else {
          // ====== 回答フェーズ ======
          const isCorrect = input.trim().toLowerCase() === currentQuiz.answer.toLowerCase();
          const nextAnswered = quizAnsweredCount + 1;
          const nextCorrect = quizCorrectCount + (isCorrect ? 1 : 0);

          // DB保存
          await fetch("/api/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: currentQuiz.question,
              answer: currentQuiz.answer,
              correct: isCorrect,
            }),
          });

          // フィードバック表示
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 2,
              role: "assistant",
              content: isCorrect
                ? `正解！「${currentQuiz.answer}」です。`
                : `不正解。「${currentQuiz.answer}」が正しい答えです。`,
            },
          ]);

          setCurrentQuiz(null);

          if (nextAnswered >= QUIZ_ROUNDS) {
            setQuizFinishing(true);
            const pct = Math.round((nextCorrect / QUIZ_ROUNDS) * 100);
            setTimeout(() => {
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now() + 3,
                  role: "assistant",
                  content: `クイズ終了です。お疲れさまでした。\n${QUIZ_ROUNDS}問中 ${nextCorrect} 問正解（正答率 ${pct}%）\n\nもう一度（Groq 優先）なら「/quiz」、DB のみなら「/db」、チャットに戻るときは「/chat」と入力してください。`,
                },
              ]);
              setMode("chat");
              setQuizAnsweredCount(0);
              setQuizCorrectCount(0);
              setQuizFinishing(false);
            }, 1500);
          } else {
            setQuizAnsweredCount(nextAnswered);
            setQuizCorrectCount(nextCorrect);
            setTimeout(async () => {
              await generateQuiz();
            }, 1500);
          }
        }
      } else if (mode === "chat") {
        // ====== 通常チャット ======
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            mode: "chat",
          }),
        });

        const data = await res.json();

        if (typeof data.notice === "string" && data.notice.trim()) {
          setApiNotice(data.notice.trim());
        }

        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, role: "assistant", content: data.reply },
          ]);
        } else if (data.error) {
          const errText =
            typeof data.error === "string" ? data.error : "チャットに失敗しました。";
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, role: "assistant", content: errText },
          ]);
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 999,
          role: "assistant",
          content: "エラーが発生しました。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* ヘッダー */}
      <div className="p-2 bg-white dark:bg-gray-800 border-b flex justify-between items-center">
        <h1 className="font-bold text-lg text-gray-800 dark:text-gray-100">AI学習サポートアプリ</h1>
        <button onClick={() => setDarkMode(!darkMode)}
          className="px-3 py-1 text-sm rounded bg-blue-500 text-white">
          {darkMode ? "ライトモード" : "ダークモード"}
        </button>
      </div>
      {apiNotice && (
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 text-sm bg-amber-100 text-amber-950 border-b border-amber-200 dark:bg-amber-950/40 dark:text-amber-50 dark:border-amber-800"
          role="status"
        >
          <span className="flex-1">{apiNotice}</span>
          <button
            type="button"
            onClick={() => setApiNotice(null)}
            className="shrink-0 rounded px-2 py-0.5 text-amber-900 hover:bg-amber-200/80 dark:text-amber-100 dark:hover:bg-amber-900/60"
            aria-label="通知を閉じる"
          >
            ×
          </button>
        </div>
      )}
      {/* チャット履歴 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-100 dark:bg-gray-900">
        <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
               className={`px-4 py-2 rounded-2xl max-w-[80%] sm:max-w-md break-words ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300 text-black dark:bg-gray-700 dark:text-white"
              }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
            className="flex justify-start"
          >
            <div className="px-4 py-2 rounded-2xl bg-gray-300 text-black animate-pulse dark:text-white dark:bg-gray-700">
              考え中...
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力フォーム */}
      {mode === "chat" ? (
      <div className="p-4 bg-white border-t flex gap-2 dark:bg-gray-900">
        <input
          type="text"
          className="flex-1 border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-white"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="メッセージを入力..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          送信
        </button>
      </div>
      ) : (
      <div className="p-4 bg-white border-t flex gap-2 dark:bg-gray-900">
        <input
          type="text"
          className="flex-1 border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-white"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={
            quizFinishing
              ? "結果を表示しています…"
              : `第 ${quizAnsweredCount + 1} / ${QUIZ_ROUNDS} 問 — ${quizFromDbOnlyRef.current ? "DB出題 — " : ""}英単語で答えてね`
          }
          disabled={quizFinishing}
        />
        <button onClick={sendMessage}
        disabled={loading || quizFinishing}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            回答
        </button>
      </div>
      )}
    </main>
  );
}