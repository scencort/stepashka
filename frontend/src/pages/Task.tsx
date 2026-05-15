// страница AI Code Review — редактор кода + AI-анализ качества, ошибок и улучшений
// поддерживает 15 языков программирования (auto = GPT сам определяет язык)
//
// КАК РАБОТАЕТ РЕВЬЮ:
//   пользователь вставляет код → выбирает язык → нажимает "Запустить ревью"
//     → handleCheck() → setLoading(true), setResult(null) — сбрасываем старый результат
//       → POST /ai/review/check { sourceCode: code, language }
//         → бэк отправляет в GPT → возвращает { quality, correctness, style, summary, issues[], improvements[], goodParts[] }
//           → setResult(data) → карточки с оценками появляются под редактором (левая колонка)
//           → await loadHistory() — обновляем историю в правой колонке сразу после ревью
//
// КАК СЧИТАЕТСЯ ОЦЕНКА:
//   avgScore = Math.round((quality + correctness + style) / 3) — среднее трёх метрик
//   scoreColor: >=80 → зелёный (emerald), >=50 → жёлтый (amber), <50 → красный
//   тот же расчёт повторяется внутри карточек истории (переменная avg)
//
// ИСТОРИЯ РЕВЬЮ (правая колонка):
//   GET /ai/review/history при монтировании → массив прошлых ревью → список с аккордеоном
//   expandedId: number | null — какая запись раскрыта; клик → isOpen ? null : item.id
//   handleClearHistory() → DELETE /ai/review/history → setHistory([]) — очищает весь список
//
// МАКЕТ: grid xl:grid-cols-3
//   левая колонка (xl:col-span-2): редактор + результаты + ошибка
//   правая колонка: кнопка запуска + история прошлых ревью
import MainLayout from "../layout/MainLayout";
import { useEffect, useState } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeEditor from "../components/ui/CodeEditor";
import {
  Code2,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { api } from "../lib/api";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../hooks/useToast";

const LANGUAGES = [
  { value: "auto", label: "Авто-определение" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML/CSS" },
];

type CheckResult = {
  quality: number;
  correctness: number;
  style: number;
  summary: string;
  issues?: string[];
  improvements?: string[];
  goodParts?: string[];
  language?: string;
  sourceCode?: string;
};

export default function Task() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<
    Array<CheckResult & { id: number; createdAt: string }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const toast = useToast();

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data =
        await api.get<Array<CheckResult & { id: number; createdAt: string }>>(
          "/ai/review/history",
        );
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const handleCheck = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const data = await api.post<CheckResult>("/ai/review/check", {
        sourceCode: code,
        language,
      });
      setResult(data);
      toast.success("Ревью завершено");
      await loadHistory();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Проверка не удалась";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await api.delete("/ai/review/history");
      setHistory([]);
      toast.success("История очищена");
    } catch {
      toast.error("Не удалось очистить историю");
    } finally {
      setClearing(false);
    }
  };

  const avgScore = result
    ? Math.round((result.quality + result.correctness + result.style) / 3)
    : 0;
  const scoreColor =
    avgScore >= 80
      ? "text-emerald-600"
      : avgScore >= 50
        ? "text-amber-600"
        : "text-red-600";

  return (
    <MainLayout>
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2">
          <div>
            <h2 className="text-2xl md:text-4xl font-extrabold mb-2 tracking-tight">
              AI Code Review
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Получите мгновенную обратную связь по вашему коду
            </p>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input-field px-4 py-3 text-sm w-full md:w-auto appearance-none font-medium cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-start">

          {/* ── Left column: editor + results + run button ── */}
          <div className="xl:col-span-2 flex flex-col gap-6">

            {/* Code editor card */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="text-sm font-bold inline-flex items-center gap-2 text-[var(--text)]">
                  <Code2 size={16} className="text-primary" /> Ваш код
                </h3>
                <p className="text-xs font-semibold text-[var(--muted)] px-3 py-1 rounded-full bg-[var(--surface)]">
                  {LANGUAGES.find((l) => l.value === language)?.label || language}
                </p>
              </div>
              <CodeEditor
                value={code}
                onChange={setCode}
                language={language}
                placeholder="# вставьте код для ревью..."
              />
            </div>


            {/* Error */}
            {!loading && error && (
              <Card className="!rounded-[2rem]">
                <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
              </Card>
            )}

            {/* Results */}
            {result && !loading && (
              <div className="space-y-5">
                {/* Scores */}
                <Card className="space-y-4 !rounded-[2rem] border border-white/60 dark:border-slate-700/60 relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-start justify-between relative z-10">
                    <p className="font-bold text-slate-500">Общая оценка</p>
                    <p className={`text-4xl font-black tracking-tight leading-none ${scoreColor}`}>{avgScore}%</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 relative z-10 mt-4">
                    {[
                      { label: "Качество", value: result.quality },
                      { label: "Логика", value: result.correctness },
                      { label: "Стиль", value: result.style },
                    ].map((m) => (
                      <div key={m.label} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50 items-center justify-center text-center shadow-sm">
                        <p className="text-xl font-bold">{m.value}%</p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{m.label}</p>
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-200/70 dark:bg-zinc-700/70 mt-1">
                          <div className="h-full bg-gradient-to-r from-rose-400 to-red-500" style={{ width: `${m.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Summary */}
                <Card className="!rounded-[2rem] border border-blue-200/50 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-900/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                      <CheckCircle size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="font-bold text-blue-900 dark:text-blue-200">Резюме</p>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{result.summary}</p>
                </Card>

                {/* Issues */}
                {result.issues && result.issues.length > 0 && (
                  <Card className="space-y-3 !rounded-[2rem] border border-rose-200/50 dark:border-rose-500/20 bg-rose-50/30 dark:bg-rose-900/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                        <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                      </div>
                      <p className="font-bold text-rose-900 dark:text-rose-200">Проблемы ({result.issues.length})</p>
                    </div>
                    {result.issues.map((issue, i) => (
                      <p key={i} className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span>{issue}</span>
                      </p>
                    ))}
                  </Card>
                )}

                {/* Improvements */}
                {result.improvements && result.improvements.length > 0 && (
                  <Card className="space-y-3 !rounded-[2rem] border border-amber-200/50 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-900/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                        <Lightbulb size={16} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <p className="font-bold text-amber-900 dark:text-amber-200">Улучшения ({result.improvements.length})</p>
                    </div>
                    {result.improvements.map((item, i) => (
                      <p key={i} className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </Card>
                )}

                {/* Good parts */}
                {result.goodParts && result.goodParts.length > 0 && (
                  <Card className="space-y-3 !rounded-[2rem] border border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-900/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                        <ThumbsUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="font-bold text-emerald-900 dark:text-emerald-200">Что хорошо ({result.goodParts.length})</p>
                    </div>
                    {result.goodParts.map((item, i) => (
                      <p key={i} className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </Card>
                )}
              </div>
            )}

            {/* Placeholder hint */}
            {!result && !loading && !error && (
              <Card className="!rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  Вставьте код, выберите язык и нажмите «Запустить ревью». AI проанализирует качество, найдёт баги и предложит улучшения.
                </p>
              </Card>
            )}

            {/* Run review button — below code and results */}
            <Button
              onClick={handleCheck}
              disabled={loading || !code.trim()}
              className="w-full !rounded-[2rem] py-4 text-lg"
            >
              Запустить ревью
            </Button>
          </div>

          {/* ── Right column: history ── */}
          <div className="space-y-4">
            <Card className="space-y-4 !rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40">
              {/* History header with clear button */}
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-lg px-1">История ревью</h5>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    disabled={clearing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:pointer-events-none"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    <Trash2 size={12} />
                    Очистить
                  </button>
                )}
              </div>

              {historyLoading && (
                <p className="text-sm font-medium text-slate-500 px-1">Загрузка...</p>
              )}

              {!historyLoading && history.length === 0 && (
                <EmptyState title="Пока пусто" description="Отправьте первый код на ревью." />
              )}

              {!historyLoading && history.length > 0 && (
                <div className="space-y-3 max-h-[700px] overflow-auto pr-1">
                  {history.map((item) => {
                    const avg = Math.round(
                      (item.quality + item.correctness + item.style) / 3,
                    );
                    const hcColor =
                      avg >= 80
                        ? "text-emerald-500"
                        : avg >= 50
                          ? "text-amber-500"
                          : "text-red-500";
                    const isOpen = expandedId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white/60 dark:bg-zinc-800/60 overflow-hidden shadow-sm transition-all"
                      >
                        <button
                          onClick={() => setExpandedId(isOpen ? null : item.id)}
                          className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <p className={`text-2xl font-black ${hcColor}`}>{avg}%</p>
                              <div className="flex gap-2 text-[11px] font-semibold text-slate-400">
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                                  {item.quality}
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                  {item.correctness}
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                                  {item.style}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-900 px-2 py-1 rounded-md">
                                {new Date(item.createdAt).toLocaleString("ru-RU")}
                              </p>
                              {isOpen ? (
                                <ChevronUp size={14} className="text-slate-400 shrink-0" />
                              ) : (
                                <ChevronDown size={14} className="text-slate-400 shrink-0" />
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 text-left">
                            {item.summary}
                          </p>
                        </button>

                        {isOpen && (
                          <div className="border-t border-slate-100 dark:border-zinc-700 px-4 pb-4 pt-3 space-y-4">
                            {item.sourceCode && (
                              <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                  <Code2 size={12} /> Код
                                </p>
                                <pre className="text-xs font-mono bg-slate-50 dark:bg-zinc-900 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-zinc-800">
                                  {item.sourceCode}
                                </pre>
                              </div>
                            )}

                            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                              <p className="font-bold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1.5"><CheckCircle size={12} /> Резюме</p>
                              {item.summary}
                            </div>

                            {item.issues && item.issues.length > 0 && (
                              <div className="bg-rose-50/50 dark:bg-rose-900/10 rounded-xl p-3 border border-rose-100 dark:border-rose-800/30 space-y-1.5">
                                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertTriangle size={12} /> Проблемы</p>
                                {item.issues.map((issue, i) => (
                                  <p key={i} className="text-xs text-slate-600 dark:text-slate-300 flex gap-1.5">
                                    <span className="text-rose-400 shrink-0">•</span>{issue}
                                  </p>
                                ))}
                              </div>
                            )}

                            {item.improvements && item.improvements.length > 0 && (
                              <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30 space-y-1.5">
                                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Lightbulb size={12} /> Улучшения</p>
                                {item.improvements.map((imp, i) => (
                                  <p key={i} className="text-xs text-slate-600 dark:text-slate-300 flex gap-1.5">
                                    <span className="text-amber-400 shrink-0">•</span>{imp}
                                  </p>
                                ))}
                              </div>
                            )}

                            {item.goodParts && item.goodParts.length > 0 && (
                              <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30 space-y-1.5">
                                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><ThumbsUp size={12} /> Что хорошо</p>
                                {item.goodParts.map((g, i) => (
                                  <p key={i} className="text-xs text-slate-600 dark:text-slate-300 flex gap-1.5">
                                    <span className="text-emerald-400 shrink-0">•</span>{g}
                                  </p>
                                ))}
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
