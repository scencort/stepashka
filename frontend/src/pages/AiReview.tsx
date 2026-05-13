import { useEffect, useState, useRef } from "react";
import MainLayout from "../layout/MainLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { api, getAccessToken, API_BASE_URL } from "../lib/api";
import { Send, History, Code2, Bot, User, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, ThumbsUp, CheckCircle } from "lucide-react";

type Verdict = {
  id?: number;
  quality: number;
  correctness: number;
  style: number;
  summary: string;
  issues?: string[];
  improvements?: string[];
  goodParts?: string[];
  sourceCode?: string;
  language?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function AiReview() {
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [history, setHistory] = useState<Array<Verdict & { id: number; createdAt: string }>>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
      const data = await api.get<Array<Verdict & { id: number; createdAt: string }>>("/ai/review/history");
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
      const accessToken = getAccessToken();
      const streamResponse = API_BASE_URL
        ? await fetch(`${API_BASE_URL}/ai/chat/stream`, {
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
        let buffer = "";
        let streamed = "";

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const raw = line.slice(6);
              if (raw === "[DONE]") continue;
              try {
                const parsed = JSON.parse(raw) as { content?: string };
                streamed += parsed.content ?? "";
              } catch {
                streamed += raw;
              }
            }
          }
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
            content: response.reply,
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
      <div className="space-y-6 lg:space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2">
          <div>
            <h2 className="text-2xl md:text-4xl font-extrabold mb-2 tracking-tight">
              AI-ассистент
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Ваш личный ментор 24/7. Обсуждайте код, архитектуру и задачи.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Chat Area */}
          <Card className="xl:col-span-2 flex flex-col h-[60vh] md:h-[700px] !p-0 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {/* Chat Header */}
            <div className="px-6 py-4 flex items-center justify-between z-10" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
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
            <div className="flex-1 overflow-auto p-6 space-y-6" style={{ background: "var(--bg)" }}>
              {chatMessages.map((item, index) => {
                const isAi = item.role === "assistant";
                return (
                  <div
                    key={`${item.role}-${index}`}
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
                      className={`p-4 rounded-2xl ${isAi ? "rounded-tl-none border" : "bg-gradient-to-br from-rose-600 to-red-700 text-white rounded-tr-none"}`}
                      style={isAi ? { background: "var(--surface)", borderColor: "var(--border)" } : undefined}
                    >
                      <p
                        className={`text-sm whitespace-pre-wrap leading-relaxed ${isAi ? "" : "text-white/95"}`}
                        style={isAi ? { color: "var(--text)" } : undefined}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
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
                  <div className="p-4 rounded-2xl rounded-tl-none border flex items-center gap-1.5 h-12" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
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
            <div className="p-4 border-t" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="relative flex items-center gap-2 rounded-[1.5rem] px-2 py-2 border focus-within:ring-2 focus-within:ring-rose-500/30 transition-all" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
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
                  className="w-full min-h-[44px] max-h-[160px] bg-transparent outline-none resize-none px-3 py-2 text-sm self-center"
                  rows={1}
                />
                <button
                  onClick={askAi}
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  <Send size={16} className="ml-0.5" />
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                AI может допускать ошибки. Проверяйте важную информацию.
              </p>
            </div>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6 lg:space-y-8">
            <Card className="space-y-4 !rounded-[2rem]" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-rose-500" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
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

              {verdict && !isChecking && (
                <div className="pt-2 border-t mt-4" style={{ borderColor: "var(--border)" }}>
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
                </div>
              )}
              {error && !isChecking && (
                <div className="pt-2">
                  <p className="text-xs text-rose-500 font-medium">{error}</p>
                </div>
              )}
            </Card>

            <Card className="space-y-4 !rounded-[2rem]" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-rose-500" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <History size={20} />
                </div>
                <h3 className="font-bold text-lg">История проверок</h3>
              </div>

              {history.length === 0 ? (
                <p className="text-sm font-medium text-center py-4" style={{ color: "var(--muted)" }}>
                  Нет недавних проверок
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-auto pr-1">
                  {history.map((item) => {
                    const avg = Math.round((item.quality + item.correctness + item.style) / 3);
                    const scoreColor = avg >= 80 ? "text-emerald-500" : avg >= 50 ? "text-amber-500" : "text-rose-500";
                    const isOpen = expandedId === item.id;
                    return (
                    <div key={item.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                      <button
                        onClick={() => setExpandedId(isOpen ? null : item.id)}
                        className="w-full text-left p-3 flex items-center justify-between gap-2 transition-colors"
                        style={{ background: "var(--bg)" }}
                      >
                        <div className="flex items-center gap-2">
                          <p className={`text-lg font-black ${scoreColor}`}>{avg}%</p>
                          <div className="flex gap-1.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
                            <span>Q:{item.quality}</span>
                            <span>C:{item.correctness}</span>
                            <span>S:{item.style}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                            {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                          </span>
                          {isOpen ? <ChevronUp size={13} style={{ color: "var(--muted)" }} /> : <ChevronDown size={13} style={{ color: "var(--muted)" }} />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 pt-2 space-y-3 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                          {item.sourceCode && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: "var(--muted)" }}><Code2 size={10} /> Код</p>
                              <pre className="text-xs font-mono rounded-xl p-2.5 overflow-auto max-h-36 whitespace-pre-wrap break-words border" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}>
                                {item.sourceCode}
                              </pre>
                            </div>
                          )}
                          <div className="text-xs rounded-xl p-2.5 border border-blue-200/30 bg-blue-500/5">
                            <p className="font-bold text-blue-400 mb-1 flex items-center gap-1"><CheckCircle size={10} /> Резюме</p>
                            <p style={{ color: "var(--text)" }}>{item.summary}</p>
                          </div>
                          {item.issues && item.issues.length > 0 && (
                            <div className="text-xs rounded-xl p-2.5 border border-rose-200/30 bg-rose-500/5 space-y-1">
                              <p className="font-bold text-rose-400 flex items-center gap-1"><AlertTriangle size={10} /> Проблемы</p>
                              {item.issues.map((s, i) => <p key={i} className="flex gap-1.5" style={{ color: "var(--text)" }}><span className="text-rose-400 shrink-0">•</span>{s}</p>)}
                            </div>
                          )}
                          {item.improvements && item.improvements.length > 0 && (
                            <div className="text-xs rounded-xl p-2.5 border border-amber-200/30 bg-amber-500/5 space-y-1">
                              <p className="font-bold text-amber-400 flex items-center gap-1"><Lightbulb size={10} /> Улучшения</p>
                              {item.improvements.map((s, i) => <p key={i} className="flex gap-1.5" style={{ color: "var(--text)" }}><span className="text-amber-400 shrink-0">•</span>{s}</p>)}
                            </div>
                          )}
                          {item.goodParts && item.goodParts.length > 0 && (
                            <div className="text-xs rounded-xl p-2.5 border border-emerald-200/30 bg-emerald-500/5 space-y-1">
                              <p className="font-bold text-emerald-400 flex items-center gap-1"><ThumbsUp size={10} /> Что хорошо</p>
                              {item.goodParts.map((s, i) => <p key={i} className="flex gap-1.5" style={{ color: "var(--text)" }}><span className="text-emerald-400 shrink-0">•</span>{s}</p>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
