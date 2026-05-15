import { useEffect, useState, useRef } from "react";
import React from "react";
import MainLayout from "../layout/MainLayout";
import Card from "../components/ui/Card";
import { getAccessToken, API_BASE_URL } from "../lib/api";
import { Send, Bot, User } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// ── Markdown renderer ────────────────────────────────────────────────────────

function AiCodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="rounded-xl overflow-hidden border my-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
        <span>{lang || "code"}</span>
        <button onClick={copy} className="hover:opacity-70 transition-opacity">{copied ? "✓ скопировано" : "копировать"}</button>
      </div>
      <pre className="text-xs font-mono overflow-x-auto p-4 leading-relaxed whitespace-pre" style={{ background: "#1e1e2e", color: "#cdd6f4" }}>{code}</pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // split on **bold**, *italic*, `code`
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={idx++}>{text.slice(last, m.index)}</span>);
    if (m[2] !== undefined) parts.push(<strong key={idx++} className="font-bold">{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={idx++}>{m[3]}</em>);
    else if (m[4] !== undefined) parts.push(<code key={idx++} className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={idx++}>{text.slice(last)}</span>);
  return parts;
}

function AiMarkdown({ text }: { text: string }) {
  if (!text) return null;

  // Split by fenced code blocks first
  const segments: React.ReactNode[] = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let si = 0;

  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) {
      segments.push(<AiTextBlock key={si++} text={text.slice(last, m.index)} />);
    }
    segments.push(<AiCodeBlock key={si++} lang={m[1] || "code"} code={m[2].trimEnd()} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push(<AiTextBlock key={si++} text={text.slice(last)} />);
  }

  return <div className="space-y-0.5">{segments}</div>;
}

function AiTextBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let li = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip blank lines (used as separators)
    if (!trimmed) { i++; continue; }

    // Heading: # ## ###
    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1 ? "text-base font-bold mt-3 mb-1" : level === 2 ? "text-sm font-bold mt-2 mb-0.5" : "text-sm font-semibold mt-1.5";
      nodes.push(<p key={li++} className={cls} style={{ color: "var(--text)" }}>{renderInline(hMatch[2])}</p>);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*]{3,}$/.test(trimmed)) {
      nodes.push(<hr key={li++} className="my-2 border-[var(--border)]" />);
      i++; continue;
    }

    // List block: collect consecutive list items
    if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        const listMatch = l.match(/^(?:[-*+]|\d+\.)\s+(.*)/);
        if (!listMatch && l !== "") break;
        if (listMatch) {
          items.push(
            <li key={items.length} className="flex gap-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
              <span className="shrink-0 mt-0.5 text-rose-400">•</span>
              <span>{renderInline(listMatch[1])}</span>
            </li>
          );
        }
        i++;
      }
      if (items.length) nodes.push(<ul key={li++} className="space-y-1 my-1.5 pl-1">{items}</ul>);
      continue;
    }

    // Regular paragraph
    nodes.push(<p key={li++} className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{renderInline(trimmed)}</p>);
    i++;
  }

  return <>{nodes}</>;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AiReview() {
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Привет. Я AI-ассистент Gradus. Могу помочь с кодом, архитектурой, SQL, алгоритмами и roadmap по задачам.",
    },
  ]);
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
        const fallbackRes = await fetch(`${API_BASE_URL}/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            message,
            context: nextMessages
              .slice(-8)
              .map((item) => ({ role: item.role, content: item.content })),
          }),
        });
        const response = await fallbackRes.json() as { reply: string; model: string };

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

        <div className="grid grid-cols-1 gap-6 lg:gap-8">
          {/* Main Chat Area */}
          <Card className="flex flex-col h-[60vh] md:h-[700px] !p-0 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
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
                      {isAi ? (
                        <AiMarkdown text={item.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-white/95">{item.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
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
        </div>
      </div>
    </MainLayout>
  );
}
