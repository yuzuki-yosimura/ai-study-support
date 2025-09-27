"use client";

import { useState, useRef, useEffect } from "react";
import {motion, AnimatePresence} from "framer-motion";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"chat" | "quiz">("chat");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const[darkMode, setDarkMode] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<{ question: string; answer: string } | null>(null);
  const [quizHistory, setQuizHistory] = useState<{ question: string; answer: string }[]>([]);


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

  // クイズ問題生成
  const generateQuiz = async () => {
    setLoading(true);
    try {
      // まずクイズ履歴を取得
      await fetchQuizHistory();
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quiz" }),
      });

      const data = await res.json();
      const quiz = JSON.parse(data.quiz); // { question, answer }

      // 重複チェック（念のため）
      const isDuplicate = quizHistory.some(
        (q) => q.question === quiz.question && q.answer === quiz.answer
      );

      if (isDuplicate) {
        // 重複している場合は再生成
        console.log("重複問題を検出、再生成します");
        return await generateQuiz();
      }

      // フロントに保持
      setCurrentQuiz(quiz);

      // 出題メッセージ
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
      setMode("quiz");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: "クイズモードに切り替えました。問題を出しますね！",
        },
      ]);
      setInput("");
      // 即座に問題を生成
      await generateQuiz();
      return true;
    } else if (command === "/chat") {
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
        if (currentQuiz === null) {
          // ====== 出題フェーズ ======
          await generateQuiz();
        } else {
          // ====== 回答フェーズ ======
          const isCorrect = input.trim().toLowerCase() === currentQuiz.answer.toLowerCase();

          // DB保存
          await fetch("/api/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: currentQuiz.question,
              answer: currentQuiz.answer,
              userInput: input,
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

          // 次の問題を出す準備（stateをリセット）
          setCurrentQuiz(null);
          
          // 少し待ってから次の問題を出題
          setTimeout(async () => {
            await generateQuiz();
          }, 1500);
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
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, role: "assistant", content: data.reply },
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
          placeholder="英単語で答えてね"
        />
        <button onClick={sendMessage}
        disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            回答
        </button>
      </div>
      )}
    </main>
  );
}