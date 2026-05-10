type DiscussionMessage = {
  id: number;
  author: string;
  text: string;
  createdAt: string;
};

type Props = {
  discussionMessages: DiscussionMessage[];
  discussionText: string;
  setDiscussionText: (v: string) => void;
  onPostMessage: () => void;
};

export default function CourseDiscussion(props: Props) {
  const { discussionMessages, discussionText, setDiscussionText, onPostMessage } =
    props;

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="font-semibold text-sm text-[var(--text)]">
          Обсуждение шага
        </p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Задавайте вопросы по теории и решениям
        </p>
      </div>

      <div className="flex gap-2">
        <textarea
          value={discussionText}
          onChange={(e) => setDiscussionText(e.target.value)}
          placeholder="Напишите вопрос по текущему шагу..."
          className="flex-1 h-20 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-3 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
        />
        <button
          onClick={onPostMessage}
          disabled={!discussionText.trim()}
          className="btn-primary px-4 py-2 text-sm self-end shrink-0"
        >
          Отправить
        </button>
      </div>

      <div className="space-y-3">
        {discussionMessages.map((msg) => (
          <div key={msg.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
              {msg.author.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {msg.author}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-[var(--text)] leading-relaxed">
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
