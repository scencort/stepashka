import {
  CheckCircle2,
  Circle,
  Zap,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  X,
} from "lucide-react";

type CourseStepType = {
  id: number;
  title: string;
  kind: "theory" | "quiz" | "code";
  taskTypeLabel?: string;
  theoryText: string;
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
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  } text-[11px] px-2 py-0.5 rounded-md font-semibold`}
                >
                  {activeStep.kind === "theory"
                    ? "Теория"
                    : activeStep.kind === "quiz"
                      ? "Тест"
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
            <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text)] leading-relaxed text-sm whitespace-pre-wrap">
              {activeStep.theoryText || (
                <span className="text-[var(--muted)] italic">
                  Теоретический материал будет добавлен.
                </span>
              )}
            </div>
          )}

          {/* Quiz */}
          {activeStep.kind === "quiz" && (
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
          )}

          {/* Code */}
          {activeStep.kind === "code" && (
            <div className="space-y-3">
              {activeStep.theoryText && (
                <div className="text-sm text-[var(--text)] leading-relaxed p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] whitespace-pre-wrap">
                  {activeStep.theoryText}
                </div>
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
                placeholder="// Напишите код здесь..."
                className="w-full h-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-4 text-sm font-mono outline-none focus:border-primary/50 transition-colors resize-none"
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
                  (activeStep.kind !== "theory" && !stepAnswer.trim())
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
