import {
  CheckCircle2,
  Circle,
  Zap,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  X,
  Copy,
  CheckCheck,
} from "lucide-react";
import { useState as useStateLocal } from "react";

// ── Theory renderer ──────────────────────────────────────────────
function isCodeLine(line: string): boolean {
  if (!line.trim()) return false;
  if (line.startsWith("    ") || line.startsWith("\t")) return true;
  const s = line.trimStart();
  const cyrillic = (s.match(/[а-яА-ЯёЁ]/g) || []).length;
  if (cyrillic > 4) return false;
  return /^(def |class |import |from |for |while |if |elif |else:|return |print\(|try:|except|finally:|with |raise |pass\b|break\b|continue\b|async |await |#|lambda )/.test(s)
    || /^[a-zA-Z_]\w*(\s*[+\-*\/]?=(?!=)\s*|\s*\(|\s*\[)/.test(s);
}

type Segment = { type: "text"; lines: string[] } | { type: "code"; lines: string[] };

function parseTheory(text: string): Segment[] {
  const raw = text.split("\n");
  const segments: Segment[] = [];
  let i = 0;

  while (i < raw.length) {
    const line = raw[i];

    if (!line.trim()) {
      // blank line — attach to previous text segment or skip
      if (segments.length && segments[segments.length - 1].type === "text") {
        segments[segments.length - 1].lines.push("");
      }
      i++;
      continue;
    }

    if (isCodeLine(line)) {
      // collect consecutive code lines
      const codeLines: string[] = [];
      while (i < raw.length && (isCodeLine(raw[i]) || (raw[i].trim() === "" && i + 1 < raw.length && isCodeLine(raw[i + 1])))) {
        if (raw[i].trim() === "") {
          // blank inside code block — include if next is also code
          if (i + 1 < raw.length && isCodeLine(raw[i + 1])) {
            codeLines.push("");
          } else {
            break;
          }
        } else {
          codeLines.push(raw[i]);
        }
        i++;
      }
      if (codeLines.length) segments.push({ type: "code", lines: codeLines });
    } else {
      if (!segments.length || segments[segments.length - 1].type === "code") {
        segments.push({ type: "text", lines: [] });
      }
      segments[segments.length - 1].lines.push(line);
      i++;
    }
  }

  return segments.filter(s => s.lines.some(l => l.trim()));
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useStateLocal(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative group rounded-xl overflow-hidden border border-[var(--border)] bg-zinc-950 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-800 border-b border-zinc-700/60">
        <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-widest">code</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {copied ? <CheckCheck size={13} className="text-green-400" /> : <Copy size={13} />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-zinc-100 overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

function TheoryRenderer({ text }: { text: string }) {
  const segments = parseTheory(text);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <CodeBlock key={i} code={seg.lines.join("\n")} />
        ) : (
          <div key={i} className="text-[var(--text)] whitespace-pre-wrap">
            {seg.lines.join("\n").trim()}
          </div>
        )
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────

type CourseStepType = {
  id: number;
  title: string;
  kind: "theory" | "quiz" | "code" | "essay";
  taskTypeLabel?: string;
  theoryText: string;
  quizQuestion?: string;
  checks?: string[];
  checkCount?: number;
  options: string[];
  stepOrder: number;
  xp: number;
};

type StepProgress = {
  stepId: number;
  status: "started" | "completed";
  score: number;
  attempts: number;
  answerText: string;
  completedAt: string | null;
};

type AttemptEntry = {
  id: number;
  stepId: number;
  answer: string;
  passed: boolean;
  feedback: string;
  createdAt: string;
};

type Props = {
  activeStep: CourseStepType | null;
  activeProgress: StepProgress | null;
  previousStep: CourseStepType | null;
  nextStep: CourseStepType | null;
  contentLoading: boolean;
  stepAnswer: string;
  setStepAnswer: (v: string) => void;
  stepLoading: boolean;
  stepError: string;
  stepMessage: string;
  stepCheckResults: Array<{ name: string; passed: boolean }> | null;
  autoAdvance: boolean;
  setAutoAdvance: (v: boolean) => void;
  attemptHistory: AttemptEntry[];
  selectedStepId: number | null;
  submitLabel: string;
  onSubmitStep: () => void;
  onSelectStep: (stepId: number, answerText: string) => void;
};

export default function CourseStep(props: Props) {
  const {
    activeStep,
    activeProgress,
    previousStep,
    nextStep,
    contentLoading,
    stepAnswer,
    setStepAnswer,
    stepLoading,
    stepError,
    stepMessage,
    stepCheckResults,
    autoAdvance,
    setAutoAdvance,
    attemptHistory,
    selectedStepId,
    submitLabel,
    onSubmitStep,
    onSelectStep,
  } = props;

  const filteredAttempts = attemptHistory.filter(
    (a) => a.stepId === selectedStepId,
  );

  return (
    <>
      {!activeStep && !contentLoading && (
        <div className="card p-10 flex flex-col items-center justify-center text-center">
          <BookOpen size={32} className="text-[var(--border)] mb-3" />
          <p className="font-semibold text-[var(--text)] mb-1">
            Выберите шаг
          </p>
          <p className="text-sm text-[var(--muted)]">
            Нажмите на шаг в содержании курса справа
          </p>
        </div>
      )}

      {activeStep && (
        <div className="card p-6 space-y-5" id="active-step-container">
          {/* Step header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`badge ${
                    activeStep.kind === "theory"
                      ? "badge-neutral"
                      : activeStep.kind === "quiz"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : activeStep.kind === "essay"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  } text-[11px] px-2 py-0.5 rounded-md font-semibold`}
                >
                  {activeStep.kind === "theory"
                    ? "Теория"
                    : activeStep.kind === "quiz"
                      ? "Тест"
                      : activeStep.kind === "essay"
                        ? "Эссе"
                        : "Практика"}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  Шаг {activeStep.stepOrder}
                </span>
                {activeStep.xp > 0 && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                    <Zap size={11} />
                    {activeStep.xp} XP
                  </span>
                )}
                {activeProgress && activeProgress.attempts > 0 && (
                  <span className="text-xs text-[var(--muted)]">
                    {activeProgress.attempts}{" "}
                    {activeProgress.attempts === 1
                      ? "попытка"
                      : activeProgress.attempts >= 2 && activeProgress.attempts <= 4
                        ? "попытки"
                        : "попыток"}
                  </span>
                )}
              </div>
              <h2 className="font-display font-bold text-lg text-[var(--text)]">
                {activeStep.title}
              </h2>
            </div>
            {activeProgress?.status === "completed" && (
              <CheckCircle2
                size={20}
                className="text-green-500 shrink-0 mt-1"
              />
            )}
          </div>

          {/* Theory */}
          {activeStep.kind === "theory" && (
            activeStep.theoryText
              ? <TheoryRenderer text={activeStep.theoryText} />
              : <span className="text-[var(--muted)] italic text-sm">Теоретический материал будет добавлен.</span>
          )}

          {/* Quiz */}
          {activeStep.kind === "quiz" && (
            <div className="space-y-3">
              {activeStep.theoryText && (
                <TheoryRenderer text={activeStep.theoryText} />
              )}
              {activeStep.quizQuestion && (
                <p className="font-semibold text-[var(--text)] text-sm mt-2">{activeStep.quizQuestion}</p>
              )}
              <div className="space-y-2">
              {activeStep.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => setStepAnswer(option)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                    stepAnswer === option
                      ? "border-primary bg-primary-50 dark:bg-primary-900/20 text-primary font-medium"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        stepAnswer === option
                          ? "border-primary bg-primary"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {stepAnswer === option && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    {option}
                  </div>
                </button>
              ))}
              </div>
            </div>
          )}

          {/* Essay */}
          {activeStep.kind === "essay" && (
            <div className="space-y-3">
              {activeStep.theoryText && (
                <TheoryRenderer text={activeStep.theoryText} />
              )}
              <p className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-xl px-3 py-2">
                🤖 Ваш ответ будет оценён нейросетью по критериям: содержание, творчество, ясность, глубина анализа
              </p>
              <textarea
                value={stepAnswer}
                onChange={(e) => setStepAnswer(e.target.value)}
                placeholder="Напишите ваше эссе здесь..."
                className="w-full h-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-4 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>
          )}

          {/* Code */}
          {activeStep.kind === "code" && (
            <div className="space-y-3">
              {activeStep.theoryText && (
                <TheoryRenderer text={activeStep.theoryText} />
              )}
              {activeStep.checks && activeStep.checks.length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                    Требования
                  </p>
                  {activeStep.checks.map((check, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm text-[var(--text)]"
                    >
                      <div className="w-4 h-4 rounded border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center shrink-0">
                        <span className="text-[9px] text-[var(--muted)]">
                          {idx + 1}
                        </span>
                      </div>
                      {check}
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={stepAnswer}
                onChange={(e) => setStepAnswer(e.target.value)}
                placeholder={activeStep.taskTypeLabel === "Свободный ответ" ? "Напишите ваш развёрнутый ответ здесь..." : "// Напишите код здесь..."}
                className={`w-full h-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-4 text-sm outline-none focus:border-primary/50 transition-colors resize-none ${activeStep.taskTypeLabel === "Свободный ответ" ? "" : "font-mono"}`}
              />
            </div>
          )}

          {/* Check results */}
          {stepCheckResults && (
            <div className="space-y-1.5">
              {stepCheckResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    result.passed
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  }`}
                >
                  {result.passed ? <Check size={14} /> : <X size={14} />}
                  {result.name}
                </div>
              ))}
            </div>
          )}

          {/* Feedback */}
          {(stepMessage || stepError) && (
            <div
              className={`px-4 py-3 rounded-xl text-sm font-medium ${
                stepError
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400"
                  : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400"
              }`}
            >
              {stepError || stepMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              {previousStep && (
                <button
                  onClick={() => onSelectStep(previousStep.id, "")}
                  className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                  <ArrowLeft size={14} /> Назад
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-primary"
                />
                Авто-переход
              </label>
              <button
                onClick={onSubmitStep}
                disabled={
                  stepLoading ||
                  (activeStep.kind !== "theory" && activeStep.kind !== "essay" && !stepAnswer.trim()) ||
                  (activeStep.kind === "essay" && !stepAnswer.trim())
                }
                className="btn-primary px-5 py-2.5 text-sm gap-2"
              >
                {stepLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{submitLabel}</span>
                    {nextStep && <ArrowRight size={14} />}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attempt history */}
      {filteredAttempts.length > 0 && (
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            История попыток
          </p>
          <div className="space-y-2 max-h-48 overflow-auto">
            {filteredAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm ${
                  attempt.passed
                    ? "bg-green-50 dark:bg-green-900/10"
                    : "bg-[var(--surface)]"
                }`}
              >
                {attempt.passed ? (
                  <CheckCircle2
                    size={15}
                    className="text-green-500 mt-0.5 shrink-0"
                  />
                ) : (
                  <Circle
                    size={15}
                    className="text-[var(--muted)] mt-0.5 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--text)] truncate">
                    {attempt.feedback}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {new Date(attempt.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
