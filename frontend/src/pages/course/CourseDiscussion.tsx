// компонент обсуждения — чат для конкретного шага курса или всего курса целиком
// используется внутри CourseDetail.tsx на вкладке "Обсуждение"
//
// КАК РАБОТАЕТ:
//   props: courseId (обязательный), stepId (null = обсуждение всего курса, число = конкретный шаг)
//   fetchMessages() → GET /courses/:id/discussions?step_id=N — грузим сообщения при монтировании
//   после загрузки: bottomRef.current.scrollIntoView() — прокручиваем вниз к последним сообщениям
//   sendMessage() → POST /courses/:id/discussions { message, step_id? }
//     → бэк добавляет сообщение в discussions таблицу, возвращает созданный объект
//     → добавляем его в массив через setMessages([...prev, created])
//     → после отправки снова прокручиваем вниз через bottomRef
//
// АВТО-ПРОКРУТКА:
//   bottomRef — невидимый div в самом конце списка сообщений
//   scrollIntoView({ behavior: "smooth" }) — плавная прокрутка к нему
//   useEffect([messages]) — срабатывает при каждом изменении массива сообщений
//
// useCallback для fetchMessages:
//   без useCallback функция пересоздавалась бы при каждом рендере
//   useCallback([courseId, stepId]) — пересоздаётся только при смене курса или шага
//   это важно потому что fetchMessages передаётся в useEffect как зависимость
//
// ВРЕМЯ СООБЩЕНИЯ:
//   new Date(createdAt).toLocaleTimeString("ru-RU") — "14:32:05"
//   toLocaleDateString + toLocaleTimeString — форматирование под русскую локаль
import { useEffect, useState, useCallback, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";
import { api } from "../../lib/api";

// одно сообщение в чате
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
  stepId: number | null; // null — общее обсуждение курса, число — обсуждение конкретного шага
  stepTitle?: string;
};

export default function CourseDiscussion({ courseId, stepId, stepTitle }: Props) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null); // нужен для прокрутки вниз после новых сообщений
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // загружаем сообщения для текущего шага или всего курса
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      // если stepId задан — грузим только сообщения этого шага
      const url = stepId != null
        ? `/courses/${courseId}/discussions?step_id=${stepId}`
        : `/courses/${courseId}/discussions`;
      const data = await api.get<DiscussionMessage[]>(url);
      setMessages(data);
    } catch {
      /* тихо — не критично если обсуждение не загрузилось */
    } finally {
      setLoading(false);
    }
  }, [courseId, stepId]);

  // при смене шага — сбрасываем сообщения и загружаем новые
  useEffect(() => {
    setMessages([]);
    setText("");
    fetchMessages();
  }, [fetchMessages]);

  // после загрузки сообщений скроллим вниз автоматически
  useEffect(() => {
    if (messages.length > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // отправить новое сообщение
  const postMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const created = await api.post<DiscussionMessage>(
        `/courses/${courseId}/discussions`,
        { message: text.trim(), step_id: stepId ?? null }
      );
      // добавляем в конец списка не перезагружая всё
      setMessages((prev) => [...prev, created]);
      setText("");
    } catch {
      /* тихо */
    } finally {
      setSending(false);
    }
  };

  // ctrl+enter отправляет сообщение — удобнее чем кнопка
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void postMessage();
    }
  };

  // форматируем время сообщения — сегодня показываем время, вчера — "вчера", раньше — дату
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return `вчера, ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  // инициалы для аватара
  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  // цвет аватара зависит от первой буквы имени — детерминировано, не рандомно
  const getAvatarColor = (name: string) => {
    const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  };

  return (
    <div className="card p-5 space-y-4">
      {/* заголовок с иконкой — показывает название шага если передано */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquare size={15} className="text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm text-[var(--text)]">
            {stepId != null ? "Обсуждение шага" : "Обсуждение курса"}
          </p>
          {stepTitle && (
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-xs">
              {stepTitle}
            </p>
          )}
        </div>
      </div>

      {/* список сообщений со скроллом */}
      <div ref={scrollContainerRef} className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {/* скелетон при загрузке */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-[var(--border)] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-[var(--border)] rounded" />
                  <div className="h-3 w-full bg-[var(--border)] rounded" />
                  <div className="h-3 w-3/4 bg-[var(--border)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          // заглушка если никто ещё ничего не написал
          <div className="py-6 flex flex-col items-center gap-2 text-center">
            <MessageSquare size={28} className="text-[var(--border)]" />
            <p className="text-sm text-[var(--muted)]">
              Пока нет сообщений.<br />
              <span className="text-xs">Задайте первый вопрос по этому шагу!</span>
            </p>
          </div>
        ) : (
          // рендерим сообщения
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-3 group">
              {/* аватар — картинка если есть, иначе инициалы */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getAvatarColor(msg.userName)}`}
              >
                {msg.avatarUrl
                  ? <img src={msg.avatarUrl} alt={msg.userName} className="w-8 h-8 rounded-full object-cover" />
                  : getInitials(msg.userName)
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {msg.userName}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {msg.createdAt ? formatTime(msg.createdAt) : ""}
                  </span>
                </div>
                <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap break-words">
                  {msg.message}
                </p>
              </div>
            </div>
          ))
        )}
        {/* пустой div для автоскролла */}
        <div ref={bottomRef} />
      </div>

      {/* форма ввода — textarea + кнопка отправки */}
      <div className="flex gap-2 pt-1 border-t border-[var(--border)] items-center">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение... (Ctrl+Enter для отправки)"
          rows={2}
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-3 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
        />
        <button
          onClick={postMessage}
          disabled={!text.trim() || sending}
          className="btn-primary px-4 text-sm shrink-0 flex items-center gap-2 disabled:opacity-40 rounded-xl"
        >
          <Send size={16} />
          {sending ? "..." : "Отправить"}
        </button>
      </div>
    </div>
  );
}
