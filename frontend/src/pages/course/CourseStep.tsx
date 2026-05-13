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
  PartyPopper,
  ChevronDown,
  ChevronUp,
  Code2,
} from "lucide-react";
import { useState as useStateLocal, useRef, useMemo, useEffect as useEffectLocal } from "react";

// ── Dark mode detector ───────────────────────────────────────────
function useIsDark() {
  const [isDark, setIsDark] = useStateLocal(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffectLocal(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ── Python syntax highlighter ────────────────────────────────────
function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PY_KEYWORDS = new Set([
  "def","class","import","from","return","if","elif","else","for","while",
  "in","not","and","or","is","None","True","False","try","except","finally",
  "with","as","raise","pass","break","continue","lambda","async","await",
  "yield","global","nonlocal","del","assert","self","cls",
]);
const PY_BUILTINS = new Set([
  "print","len","range","str","int","float","list","dict","set","tuple",
  "bool","type","isinstance","hasattr","getattr","setattr","enumerate",
  "zip","map","filter","sorted","reversed","sum","min","max","abs","round",
  "open","super","input","repr","format","any","all","id","hex","bin","oct",
  "staticmethod","classmethod","property","Exception","ValueError","TypeError",
  "KeyError","IndexError","AttributeError","RuntimeError","StopIteration",
  "BaseModel","Field","FastAPI","List","Optional","Dict","Union",
]);

function highlightLine(line: string, dark: boolean): string {
  const c = dark
    ? { kw:"#c084fc", str:"#4ade80", cmt:"#6b7280", num:"#fb923c", builtin:"#38bdf8", fn:"#60a5fa", op:"#818cf8", plain:"#e2e8f0" }
    : { kw:"#7c3aed", str:"#15803d", cmt:"#6b7280", num:"#ea580c", builtin:"#0369a1", fn:"#1d4ed8", op:"#6366f1", plain:"#1e293b" };

  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === "#") {
      out += `<span style="color:${c.cmt};font-style:italic">${escHtml(line.slice(i))}</span>`;
      break;
    }
    // f/r/b prefix
    let pfx = "";
    if ("frbrb".includes(line[i]) && (line[i+1] === '"' || line[i+1] === "'")) {
      pfx = line[i++];
    }
    // String
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      const triple = line.slice(i, i+3) === q+q+q;
      const end = triple ? q+q+q : q;
      let j = i + (triple ? 3 : 1);
      while (j < line.length) {
        if (line[j] === "\\" ) { j += 2; continue; }
        if (line.slice(j, j+end.length) === end) { j += end.length; break; }
        j++;
      }
      out += `<span style="color:${c.str}">${escHtml(pfx + line.slice(i, j))}</span>`;
      i = j; continue;
    }
    if (pfx) { out += escHtml(pfx); continue; }
    // Decorator
    if (line[i] === "@") {
      let j = i+1;
      while (j < line.length && /[\w.]/.test(line[j])) j++;
      out += `<span style="color:#f59e0b">${escHtml(line.slice(i, j))}</span>`;
      i = j; continue;
    }
    // Number
    if (/[0-9]/.test(line[i]) && (i === 0 || !/\w/.test(line[i-1]))) {
      let j = i;
      while (j < line.length && /[0-9._xXbBoOeEjJ]/.test(line[j])) j++;
      out += `<span style="color:${c.num}">${escHtml(line.slice(i, j))}</span>`;
      i = j; continue;
    }
    // Identifier
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /\w/.test(line[j])) j++;
      const word = line.slice(i, j);
      let k = j; while (k < line.length && line[k] === " ") k++;
      const isCall = line[k] === "(";
      if (PY_KEYWORDS.has(word))
        out += `<span style="color:${c.kw};font-weight:600">${escHtml(word)}</span>`;
      else if (PY_BUILTINS.has(word))
        out += `<span style="color:${c.builtin}">${escHtml(word)}</span>`;
      else if (isCall)
        out += `<span style="color:${c.fn}">${escHtml(word)}</span>`;
      else
        out += `<span style="color:${c.plain}">${escHtml(word)}</span>`;
      i = j; continue;
    }
    // Operator
    if ("+-*/%=<>!&|^~".includes(line[i]))
      out += `<span style="color:${c.op}">${escHtml(line[i++])}</span>`;
    else
      out += escHtml(line[i++]);
  }
  return out;
}

function highlightCode(code: string, dark: boolean): string {
  return code.split("\n").map(l => highlightLine(l, dark)).join("\n");
}

// ── Code editor with syntax highlighting ─────────────────────────
const FONT: React.CSSProperties = {
  fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code','Consolas',monospace",
  fontSize: "13px",
  lineHeight: "22px",
};
const PAD = 14;
const GUTTER = 46;

function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dark = useIsDark();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const lines = Math.max((value || "").split("\n").length, 10);
  const highlighted = useMemo(() => highlightCode(value || "", dark), [value, dark]);

  const syncScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const bg    = dark ? "#18181b" : "#f8fafc";
  const gutBg = dark ? "#1e1e24" : "#f1f5f9";
  const gutBorder = dark ? "#3f3f46" : "#e2e8f0";
  const gutColor  = dark ? "#52525b" : "#94a3b8";
  const caret = dark ? "#e2e8f0" : "#1e293b";
  const border = dark ? "#3f3f46" : "#e2e8f0";

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, boxShadow: "0 1px 4px 0 rgba(0,0,0,0.06)" }}>
      {/* Title bar */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", background: gutBg, borderBottom:`1px solid ${gutBorder}` }}>
        <span style={{ width:10,height:10,borderRadius:"50%",background:"#f87171",display:"inline-block" }}/>
        <span style={{ width:10,height:10,borderRadius:"50%",background:"#fbbf24",display:"inline-block" }}/>
        <span style={{ width:10,height:10,borderRadius:"50%",background:"#34d399",display:"inline-block" }}/>
        <span style={{ ...FONT, fontSize:11, color: gutColor, marginLeft:8 }}>solution.py</span>
      </div>
      {/* Editor body */}
      <div style={{ display:"flex", background: bg, minHeight: lines*22 + PAD*2 }}>
        {/* Gutter */}
        <div style={{ width:GUTTER, flexShrink:0, background:gutBg, borderRight:`1px solid ${gutBorder}`, paddingTop:PAD, paddingBottom:PAD, userSelect:"none" }}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} style={{ ...FONT, textAlign:"right", paddingRight:10, color: gutColor }}>{i+1}</div>
          ))}
        </div>
        {/* Overlay area */}
        <div style={{ position:"relative", flex:1, overflow:"hidden" }}>
          <pre
            ref={preRef}
            aria-hidden
            style={{ ...FONT, position:"absolute", top:0, left:0, right:0, bottom:0, margin:0, padding:PAD, overflow:"hidden", whiteSpace:"pre", pointerEvents:"none" }}
            dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const el = e.currentTarget;
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const TAB = "    "; // 4 spaces
                if (start === end) {
                  // Single cursor — insert 4 spaces
                  const next = value.slice(0, start) + TAB + value.slice(end);
                  onChange(next);
                  requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = start + TAB.length;
                  });
                } else {
                  // Multi-line selection — indent/unindent each line
                  const lines = value.split("\n");
                  let charCount = 0;
                  const startLine = lines.findIndex(l => { charCount += l.length + 1; return charCount > start; });
                  charCount = 0;
                  const endLine = lines.findIndex(l => { charCount += l.length + 1; return charCount > end; });
                  const sl = Math.max(0, startLine);
                  const el2 = Math.min(lines.length - 1, endLine < 0 ? lines.length - 1 : endLine);
                  if (e.shiftKey) {
                    for (let i = sl; i <= el2; i++) {
                      if (lines[i].startsWith(TAB)) lines[i] = lines[i].slice(4);
                      else if (lines[i].startsWith(" ")) lines[i] = lines[i].replace(/^ +/, "");
                    }
                  } else {
                    for (let i = sl; i <= el2; i++) lines[i] = TAB + lines[i];
                  }
                  onChange(lines.join("\n"));
                }
              }
              // Auto-close brackets
              if (e.key === "Enter") {
                e.preventDefault();
                const el = e.currentTarget;
                const pos = el.selectionStart;
                const before = value.slice(0, pos);
                const after = value.slice(pos);
                const lastLine = before.split("\n").pop() || "";
                const indent = lastLine.match(/^(\s*)/)?.[1] ?? "";
                const extraIndent = lastLine.trimEnd().endsWith(":") ? "    " : "";
                const next = before + "\n" + indent + extraIndent + after;
                onChange(next);
                const newPos = pos + 1 + indent.length + extraIndent.length;
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = newPos;
                });
              }
            }}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            placeholder="# Напишите код здесь..."
            style={{ ...FONT, position:"relative", width:"100%", minHeight: lines*22 + PAD*2, padding:PAD, margin:0, border:"none", outline:"none", resize:"none", background:"transparent", color:"transparent", caretColor:caret, overflowY:"auto", whiteSpace:"pre", overflowWrap:"normal", display:"block" }}
          />
        </div>
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────

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
          <div key={i} className="text-[var(--text)] whitespace-pre-wrap space-y-3">
            {seg.lines.join("\n").trim().split(/^---$/m).map((part, j, arr) => (
              <span key={j}>
                {part.trim() && <span className="block whitespace-pre-wrap">{part.trim()}</span>}
                {j < arr.length - 1 && (
                  <span className="block my-3 flex items-center gap-3">
                    <span className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                    <span className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
                  </span>
                )}
              </span>
            ))}
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
  checkResults?: Array<{ name: string; passed: boolean; expected?: string; actual?: string; error?: string }> | null;
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
  stepAiComment: string | null;
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
    stepAiComment,
    attemptHistory,
    selectedStepId,
    submitLabel,
    onSubmitStep,
    onSelectStep,
  } = props;

  const filteredAttempts = attemptHistory.filter(
    (a) => a.stepId === selectedStepId,
  );
  const [expandedAttemptId, setExpandedAttemptId] = useStateLocal<number | null>(null);

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
                        ? "Эссе (сочинение)"
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
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40">
                <span className="text-base">🤖</span>
                <p className="text-xs text-purple-700 dark:text-purple-300 leading-snug">
                  Ответ оценит AI по критериям: <span className="font-semibold">содержание, творчество, ясность, глубина анализа</span>
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden focus-within:border-primary/50 transition-colors shadow-sm">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg)]">
                  <span className="text-xs font-medium text-[var(--muted)]">✍️ Ваш ответ</span>
                  <span className="text-xs text-[var(--muted)]">{stepAnswer.length} симв.</span>
                </div>
                <textarea
                  value={stepAnswer}
                  onChange={(e) => setStepAnswer(e.target.value)}
                  placeholder="Начните писать здесь..."
                  className="w-full h-60 bg-transparent text-[var(--text)] p-4 text-sm leading-relaxed outline-none resize-none placeholder:text-[var(--muted)]"
                />
              </div>
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
              {activeStep.taskTypeLabel === "Свободный ответ" ? (
                <textarea
                  value={stepAnswer}
                  onChange={(e) => setStepAnswer(e.target.value)}
                  placeholder="Напишите ваш развёрнутый ответ здесь..."
                  className="w-full h-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-4 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
                />
              ) : (
                <CodeEditor
                  value={stepAnswer}
                  onChange={setStepAnswer}
                />
              )}
            </div>
          )}

          {/* Check results — show all tests */}
          {stepCheckResults && stepCheckResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Проверки</p>
              {stepCheckResults.map((result, idx) => {
                const r = result as typeof result & { expected?: string; actual?: string; error?: string };
                const hasIO = "expected" in r || "actual" in r;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border overflow-hidden ${
                      r.passed
                        ? "border-green-200 dark:border-green-800/40"
                        : "border-red-200 dark:border-red-800/40"
                    }`}
                  >
                    <div className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${
                      r.passed
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                    }`}>
                      {r.passed ? <Check size={13} /> : <X size={13} />}
                      <span>{r.name}</span>
                    </div>
                    {!r.passed && hasIO && (
                      <div className="bg-[var(--surface)]">
                        {r.error ? (
                          <div className="px-3 py-2">
                            <p className="text-[10px] text-[var(--muted)] mb-1 uppercase tracking-wider">Ошибка</p>
                            <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap leading-relaxed">{r.error}</pre>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                            <div className="bg-[var(--surface)] px-3 py-2">
                              <p className="text-[10px] text-[var(--muted)] mb-1 uppercase tracking-wider">Ожидалось</p>
                              <pre className="text-xs text-green-700 dark:text-green-400 font-mono whitespace-pre-wrap">{r.expected || "(пусто)"}</pre>
                            </div>
                            <div className="bg-[var(--surface)] px-3 py-2">
                              <p className="text-[10px] text-[var(--muted)] mb-1 uppercase tracking-wider">Получено</p>
                              <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">{r.actual || "(пусто)"}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Comment */}
          {stepAiComment && (
            <div className="rounded-2xl overflow-hidden border border-violet-200 dark:border-violet-700/40 shadow-sm">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-base leading-none shrink-0">🤖</div>
                <span className="text-xs font-bold text-white tracking-wide uppercase">AI-наставник</span>
                <span className="ml-auto text-[10px] text-white/60 font-medium">Gradus AI</span>
              </div>
              <div className="px-4 py-3.5 bg-violet-50 dark:bg-violet-950/30">
                <p className="text-sm text-violet-900 dark:text-violet-200 leading-relaxed whitespace-pre-wrap">{stepAiComment}</p>
              </div>
            </div>
          )}

          {/* Feedback */}
          {(stepMessage || stepError) && (() => {
            const msg = stepError || stepMessage;
            const isError = !!stepError;
            const isMultiline = msg.includes("\n");
            if (isError && isMultiline) {
              // Terminal-style error block
              return (
                <div className="rounded-xl overflow-hidden border border-red-200 dark:border-red-800/40">
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-800">
                    <X size={13} className="text-white/80 shrink-0" />
                    <span className="text-xs font-bold text-white uppercase tracking-wide">Ошибка выполнения</span>
                  </div>
                  <pre className="px-4 py-3 text-xs font-mono leading-relaxed bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 overflow-x-auto whitespace-pre-wrap">{msg}</pre>
                </div>
              );
            }
            return (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
                isError
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400"
                  : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400"
              }`}>
                {msg}
              </div>
            );
          })()}

          {/* ── SUCCESS BANNER ── */}
          {activeProgress?.status === "completed" && !stepLoading && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-green-300 dark:border-green-700/60 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 px-5 py-4 flex items-center gap-4">
              {/* glow */}
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-green-400/20 rounded-full blur-2xl pointer-events-none" />
              <div className="w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/50 border-2 border-green-300 dark:border-green-700 flex items-center justify-center shrink-0">
                <PartyPopper size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-green-800 dark:text-green-300 text-base leading-snug">
                  Задание выполнено!
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                  Вы уже прошли этот шаг
                  {activeStep.xp > 0 && ` · получено ${activeStep.xp} XP`}
                </p>
              </div>
              {activeStep.xp > 0 && (
                <div className="shrink-0 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full font-bold text-sm border border-amber-200 dark:border-amber-700/40">
                  <Zap size={13} className="fill-current" />
                  +{activeStep.xp} XP
                </div>
              )}
            </div>
          )}

          {/* AI loading banner */}
          {stepLoading && (
            <div className="relative overflow-hidden rounded-xl border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-950/30 px-4 py-3 flex items-center gap-3">
              {/* скользящий прогресс-бар */}
              <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden">
                <div
                  style={{ width: "40%", animation: "ai-shimmer 1.6s ease-in-out infinite" }}
                  className="h-full bg-gradient-to-r from-transparent via-violet-500 to-transparent"
                />
                <style>{`@keyframes ai-shimmer{0%{transform:translateX(-250%)}100%{transform:translateX(650%)}}`}</style>
              </div>
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 relative">
                <span className="text-base leading-none">🤖</span>
                <span className="absolute inset-0 rounded-full border-2 border-violet-400/50 animate-ping" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-violet-900 dark:text-violet-200 leading-snug">
                  ИИ-наставник проверяет ответ
                  <span className="inline-flex gap-0.5 ml-1">
                    <span style={{ animation: "bounce 1s infinite 0ms" }} className="inline-block">.</span>
                    <span style={{ animation: "bounce 1s infinite 150ms" }} className="inline-block">.</span>
                    <span style={{ animation: "bounce 1s infinite 300ms" }} className="inline-block">.</span>
                  </span>
                </p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                  Анализирую решение, пожалуйста подождите
                </p>
              </div>
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
                  </>
                )}
              </button>
              {activeProgress?.status === "completed" && nextStep && (
                <button
                  onClick={() => onSelectStep(nextStep.id, "")}
                  className="btn-secondary px-5 py-2.5 text-sm gap-2"
                >
                  Следующий шаг
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attempt history */}
      {filteredAttempts.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[var(--text)]">История попыток</p>
            <span className="text-xs text-[var(--muted)] font-medium bg-[var(--surface)] px-2 py-0.5 rounded-full border border-[var(--border)]">
              {filteredAttempts.length}
            </span>
          </div>

          <div className="space-y-2">
            {[...filteredAttempts].reverse().map((attempt, idx) => {
              const isOpen = expandedAttemptId === attempt.id;
              const checks = attempt.checkResults ?? [];
              const passedCount = checks.filter(c => c.passed).length;

              return (
                <div
                  key={attempt.id}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    attempt.passed
                      ? "border-green-200 dark:border-green-800/40"
                      : "border-red-200 dark:border-red-800/30"
                  }`}
                >
                  {/* Header */}
                  <button
                    onClick={() => setExpandedAttemptId(isOpen ? null : attempt.id)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${
                      attempt.passed
                        ? "bg-green-50 dark:bg-green-900/15 hover:bg-green-100/60 dark:hover:bg-green-900/25"
                        : "bg-red-50 dark:bg-red-900/10 hover:bg-red-100/60 dark:hover:bg-red-900/20"
                    }`}
                  >
                    {attempt.passed
                      ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      : <X size={16} className="text-red-500 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${attempt.passed ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          Попытка {filteredAttempts.length - idx}
                        </span>
                        {checks.length > 0 && (
                          <span className="text-xs text-[var(--muted)] font-medium">
                            тесты: {passedCount}/{checks.length}
                          </span>
                        )}
                        <span className="text-xs text-[var(--muted)] ml-auto shrink-0">
                          {new Date(attempt.createdAt).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                      {!isOpen && (
                        <p className="text-xs text-[var(--muted)] truncate mt-0.5">{attempt.feedback}</p>
                      )}
                    </div>
                    {isOpen
                      ? <ChevronUp size={14} className="text-[var(--muted)] shrink-0" />
                      : <ChevronDown size={14} className="text-[var(--muted)] shrink-0" />
                    }
                  </button>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 space-y-3 bg-[var(--bg)] border-t border-[var(--border)]">

                      {/* Feedback */}
                      <p className="text-sm text-[var(--text)] leading-relaxed">{attempt.feedback}</p>

                      {/* Code */}
                      {attempt.answer && (
                        <div>
                          <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                            <Code2 size={11} /> Код решения
                          </p>
                          <pre className="text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 overflow-auto max-h-52 whitespace-pre-wrap break-words text-[var(--text)] leading-relaxed">
                            {attempt.answer}
                          </pre>
                        </div>
                      )}

                      {/* Check results */}
                      {checks.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wide">Тесты</p>
                          {checks.map((c, i) => (
                            <div key={i} className={`rounded-xl border overflow-hidden ${c.passed ? "border-green-200 dark:border-green-800/40" : "border-red-200 dark:border-red-800/30"}`}>
                              <div className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${c.passed ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
                                {c.passed ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                                {c.name}
                              </div>
                              {!c.passed && (c.error || c.expected !== undefined) && (
                                <div className="bg-[var(--surface)] px-3 py-2 text-xs font-mono">
                                  {c.error
                                    ? <pre className="text-red-500 dark:text-red-400 whitespace-pre-wrap">{c.error}</pre>
                                    : (
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">Ожидалось</p>
                                          <pre className="text-green-600 dark:text-green-400 whitespace-pre-wrap">{c.expected ?? "(пусто)"}</pre>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">Получено</p>
                                          <pre className="text-red-500 dark:text-red-400 whitespace-pre-wrap">{c.actual ?? "(пусто)"}</pre>
                                        </div>
                                      </div>
                                    )
                                  }
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
