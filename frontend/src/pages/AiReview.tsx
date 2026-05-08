import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { fadeInUp } from "../lib/animations";
import { api } from "../lib/api";
import { Send, History, Code2, Bot, User } from "lucide-react";

type Verdict = {
  id?: number;
  quality: number;
  correctness: number;
  style: number;
  summary: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function AiReview() {
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: number; quality: number; created_at: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Привет. Я AI-ассистент Gradus. Могу помочь с кодом, архитектурой, SQL, алгоритмами и roadmap по задачам.",
    },
  ]);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    try {
      const data =
        await api.get<
          Array<{ id: number; quality: number; created_at: string }>
        >("/ai/review/history");
      setHistory(data);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const runCheck = async () => {
    setIsChecking(true);
    setVerdict(null);
    setError("");

    try {
      const response = await api.post<Verdict>("/ai/review/check", {
        sourceCode: code,
      });
      setVerdict(response);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверка не удалась");
    } finally {
      setIsChecking(false);
    }
  };

  const askAi = async () => {
    const message = chatInput.trim();
    if (!message) {
      return;
    }

    const nextMessages = [
      ...chatMessages,
      { role: "user" as const, content: message },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setError("");

    try {
      const baseUrl = String(import.meta.env.VITE_API_URL || "").replace(
        /\/+$/,
        "",
      );
      const accessToken = localStorage.getItem("gradus_access_token");
      const streamResponse = baseUrl
        ? await fetch(`${baseUrl}/ai/chat/stream`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {}),
            },
            body: JSON.stringify({
              message,
              context: nextMessages
                .slice(-8)
                .map((item) => ({ role: item.role, content: item.content })),
            }),
          })
        : null;

      if (streamResponse && streamResponse.ok && streamResponse.body) {
        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        let streamed = "";

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          streamed += decoder.decode(value, { stream: true });
          setChatMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: streamed };
            return next;
          });
        }
      } else {
        const response = await api.post<{ reply: string; model: string }>(
          "/ai/chat",
          {
            message,
            context: nextMessages
              .slice(-8)
              .map((item) => ({ role: item.role, content: item.content })),
          },
        );

        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${response.reply}\n\nmodel: ${response.model}`,
          },
        ]);
      }
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "Не удалось получить ответ AI";
      setError(messageText);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Ошибка: ${messageText}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <MainLayout>
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="space-y-6 lg:space-y-8"
      >
        <motion.div
          variants={fadeInUp}
          className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2"
        >
          <div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-2 tracking-tight">
              AI-ассистент
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Ваш личный ментор 24/7. Обсуждайте код, архитектуру и задачи.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Chat Area */}
          <Card className="xl:col-span-2 flex flex-col h-[700px] !p-0 overflow-hidden border border-white/60 dark:border-slate-700/60 shadow-lg shadow-slate-200/20 dark:shadow-black/20">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40 flex items-center justify-between backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                  <Bot size={20} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">
                    Gradus AI
                  </h3>
                  <p className="text-xs font-medium text-emerald-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Online
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800">
                GPT-4 / Llama 3
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/30 dark:bg-black/10">
              {chatMessages.map((item, index) => {
                const isAi = item.role === "assistant";
                return (
                  <motion.div
                    key={`${item.role}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-4 max-w-[85%] ${isAi ? "" : "ml-auto flex-row-reverse"}`}
                  >
                    <div className="shrink-0 mt-1">
                      {isAi ? (
                        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center border border-rose-200 dark:border-rose-500/30 shadow-sm">
                          <Bot
                            size={16}
                            className="text-rose-600 dark:text-rose-400"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center border border-slate-300 dark:border-zinc-700 shadow-sm">
                          <User
                            size={16}
                            className="text-slate-600 dark:text-slate-400"
                          />
                        </div>
                      )}
                    </div>
                    <div
                      className={`p-4 rounded-2xl shadow-sm ${
                        isAi
                          ? "bg-white/80 dark:bg-zinc-800/80 border border-white/60 dark:border-slate-700/60 rounded-tl-none"
                          : "bg-gradient-to-br from-rose-600 to-red-600 text-white rounded-tr-none shadow-rose-500/20"
                      }`}
                    >
                      <p
                        className={`text-sm whitespace-pre-wrap leading-relaxed ${isAi ? "text-slate-700 dark:text-slate-300" : "text-white/95"}`}
                      >
                        {item.content}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              {chatLoading && (
                <div className="flex gap-4 max-w-[85%]">
                  <div className="shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center border border-rose-200 dark:border-rose-500/30">
                      <Bot
                        size={16}
                        className="text-rose-600 dark:text-rose-400"
                      />
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border border-white/60 dark:border-slate-700/60 rounded-tl-none flex items-center gap-1.5 h-12">
                    <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"></span>
                    <span
                      className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-white/60 dark:bg-zinc-900/60 border-t border-white/60 dark:border-slate-700/60 backdrop-blur-xl">
              <div className="relative flex items-end gap-2 bg-white/60 dark:bg-zinc-900/80 border border-slate-200 dark:border-slate-700/80 rounded-[1.5rem] p-2 shadow-inner focus-within:ring-2 focus-within:ring-rose-500/30 transition-all">
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      askAi();
                    }
                  }}
                  placeholder="Спросите AI про код, архитектуру, паттерны..."
                  className="w-full min-h-[44px] max-h-[160px] bg-transparent outline-none resize-none px-3 py-2.5 text-sm"
                  rows={1}
                />
                <button
                  onClick={askAi}
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 disabled:opacity-50 disabled:pointer-events-none transition-all mb-0.5 mr-0.5"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                AI может допускать ошибки. Проверяйте важную информацию.
              </p>
            </div>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6 lg:space-y-8">
            <Card className="space-y-4 !rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Code2 size={20} />
                </div>
                <h3 className="font-bold text-lg">Быстрая проверка кода</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-4">
                Нужно оценить решение или найти баг? Откройте вкладку "AI Code
                Review" для детального анализа файла.
              </p>
              <div className="space-y-3">
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Вставьте код (опционально)..."
                  className="input-field min-h-[120px] text-sm py-3 font-mono"
                />
                <Button
                  onClick={runCheck}
                  disabled={isChecking || !code.trim()}
                  className="w-full !rounded-2xl"
                >
                  {isChecking ? "Проверяю..." : "Проверить код"}
                </Button>
              </div>

              <AnimatePresence>
                {verdict && !isChecking && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-2 border-t border-slate-200 dark:border-slate-700/60 mt-4"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold">Оценка:</span>
                      <span
                        className={`text-lg font-black ${verdict.quality >= 80 ? "text-emerald-500" : verdict.quality >= 50 ? "text-amber-500" : "text-rose-500"}`}
                      >
                        {verdict.quality}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {verdict.summary}
                    </p>
                  </motion.div>
                )}
                {error && !isChecking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="pt-2"
                  >
                    <p className="text-xs text-rose-500 font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            <Card className="space-y-4 !rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <History size={20} />
                </div>
                <h3 className="font-bold text-lg">История проверок</h3>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium text-center py-4">
                  Нет недавних проверок
                </p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700"
                    >
                      <p className="text-xs font-semibold text-slate-500">
                        Проверка #{item.id}
                      </p>
                      <span
                        className={`text-sm font-bold ${item.quality >= 80 ? "text-emerald-500" : item.quality >= 50 ? "text-amber-500" : "text-rose-500"}`}
                      >
                        {item.quality}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </motion.div>
    </MainLayout>
  );
}
