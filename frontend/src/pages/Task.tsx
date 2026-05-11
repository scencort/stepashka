import MainLayout from "../layout/MainLayout";
import { useEffect, useState } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeEditor from "../components/ui/CodeEditor";
import {
  Code2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  ThumbsUp,
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Editor */}
          <div className="xl:col-span-2 flex flex-col rounded-[2.5rem] overflow-hidden glass-panel border border-white/60 dark:border-slate-700/60 shadow-lg shadow-slate-200/20 dark:shadow-black/20">
            <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/60 flex items-center justify-between bg-white/40 dark:bg-zinc-900/40">
              <h3 className="text-sm font-bold inline-flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Code2 size={18} className="text-rose-500" /> Ваш код
              </h3>
              <p className="text-xs font-semibold text-slate-400 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800">
                {LANGUAGES.find((l) => l.value === language)?.label || language}
              </p>
            </div>

            <div className="flex-1 min-h-[400px] relative">
              <CodeEditor
                value={code}
                onChange={setCode}
                language={language}
                placeholder="// вставьте код для ревью..."
              />
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-6">
            <Button
              onClick={handleCheck}
              disabled={loading || !code.trim()}
              className="w-full !rounded-[2rem] py-4 text-lg"
            >
              {loading ? "Анализирую..." : "Запустить ревью"}
            </Button>

            {loading && (
              <Card className="flex flex-col items-center justify-center py-10 !rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mb-4">
                  <Sparkles size={24} className="text-rose-500 animate-pulse" />
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-semibold">
                  AI анализирует код...
                </p>
              </Card>
            )}

            {result && (
              <div className="space-y-6">
                {/* Scores */}
                <Card className="space-y-4 !rounded-[2rem] border border-white/60 dark:border-slate-700/60 relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-700" />
                  <div className="flex items-start justify-between relative z-10">
                    <p className="font-bold text-slate-500">Общая оценка</p>
                    <div className="flex flex-col items-end">
                      <p
                        className={`text-4xl font-black tracking-tight leading-none ${scoreColor}`}
                      >
                        {avgScore}%
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 relative z-10 mt-4">
                    {[
                      { label: "Качество", value: result.quality },
                      { label: "Логика", value: result.correctness },
                      { label: "Стиль", value: result.style },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50 items-center justify-center text-center shadow-sm"
                      >
                        <p className="text-xl font-bold">{m.value}%</p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                          {m.label}
                        </p>
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-200/70 dark:bg-zinc-700/70 mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-rose-400 to-red-500"
                            style={{ width: `${m.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Summary */}
                <Card className="!rounded-[2rem] border border-blue-200/50 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-900/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                      <CheckCircle
                        size={16}
                        className="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                    <p className="font-bold text-blue-900 dark:text-blue-200">
                      Резюме
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                    {result.summary}
                  </p>
                </Card>

                {/* Issues */}
                {result.issues && result.issues.length > 0 && (
                  <Card className="space-y-3 !rounded-[2rem] border border-rose-200/50 dark:border-rose-500/20 bg-rose-50/30 dark:bg-rose-900/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                        <AlertTriangle
                          size={16}
                          className="text-rose-600 dark:text-rose-400"
                        />
                      </div>
                      <p className="font-bold text-rose-900 dark:text-rose-200">
                        Проблемы ({result.issues.length})
                      </p>
                    </div>
                    {result.issues.map((issue, i) => (
                      <p
                        key={i}
                        className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-start gap-2"
                      >
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
                        <Lightbulb
                          size={16}
                          className="text-amber-600 dark:text-amber-400"
                        />
                      </div>
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        Улучшения ({result.improvements.length})
                      </p>
                    </div>
                    {result.improvements.map((item, i) => (
                      <p
                        key={i}
                        className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-start gap-2"
                      >
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
                        <ThumbsUp
                          size={16}
                          className="text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                      <p className="font-bold text-emerald-900 dark:text-emerald-200">
                        Что хорошо ({result.goodParts.length})
                      </p>
                    </div>
                    {result.goodParts.map((item, i) => (
                      <p
                        key={i}
                        className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-start gap-2"
                      >
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </Card>
                )}
              </div>
            )}

            {!loading && error && (
              <Card className="!rounded-[2rem]">
                <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              </Card>
            )}

            {!result && !loading && !error && (
              <Card className="!rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  Вставьте код, выберите язык и запустите ревью. AI
                  проанализирует качество, найдёт баги и предложит улучшения.
                </p>
              </Card>
            )}

            {/* History */}
            <Card className="space-y-4 !rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/40 dark:bg-zinc-900/40">
              <h5 className="font-bold text-lg px-1">История ревью</h5>
              {historyLoading && (
                <p className="text-sm font-medium text-slate-500 px-1">
                  Загрузка...
                </p>
              )}
              {!historyLoading && history.length === 0 && (
                <EmptyState
                  title="Пока пусто"
                  description="Отправьте первый код на ревью."
                />
              )}
              {!historyLoading && history.length > 0 && (
                <div className="space-y-3 max-h-80 overflow-auto pr-2">
                  {history.map((item) => {
                    const avg = Math.round(
                      (item.quality + item.correctness + item.style) / 3,
                    );
                    const hcColor =
                      avg >= 80
                        ? "text-emerald-600"
                        : avg >= 50
                          ? "text-amber-600"
                          : "text-red-600";
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white/60 dark:bg-zinc-800/60 p-4 hover:bg-white dark:hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p
                            className={`text-xl font-black ${hcColor} group-hover:scale-105 transition-transform`}
                          >
                            {avg}%
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-900 px-2 py-1 rounded-md">
                            {new Date(item.createdAt).toLocaleString("ru-RU")}
                          </p>
                        </div>
                        <div className="flex gap-3 text-xs font-semibold text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>{" "}
                            Q: {item.quality}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>{" "}
                            C: {item.correctness}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>{" "}
                            S: {item.style}
                          </span>
                        </div>
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
