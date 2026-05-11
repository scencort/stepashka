import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";

type DiscussionMessage = {
  id: number;
  userId: number;
  userName: string;
  avatarUrl: string;
  message: string;
  createdAt: string;
};

type Props = {
  courseId: number;
};

export default function CourseDiscussion({ courseId }: Props) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.get<DiscussionMessage[]>(
        `/courses/${courseId}/discussions`
      );
      setMessages(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const postMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const created = await api.post<DiscussionMessage>(
        `/courses/${courseId}/discussions`,
        { message: text.trim() }
      );
      setMessages((prev) => [...prev, created]);
      setText("");
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="font-semibold text-sm text-[var(--text)]">
          Обсуждение курса
        </p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Задавайте вопросы по теории и решениям
        </p>
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите сообщение..."
          className="flex-1 h-20 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-3 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
        />
        <button
          onClick={postMessage}
          disabled={!text.trim() || sending}
          className="btn-primary px-4 py-2 text-sm self-end shrink-0"
        >
          {sending ? "..." : "Отправить"}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--muted)]">Загрузка...</p>
      ) : messages.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Пока нет сообщений. Будьте первым!
        </p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                {msg.userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {msg.userName}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-[var(--text)] leading-relaxed">
                  {msg.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
