"use client";

import { useEffect, useState } from "react";

type QuizQuestion = {
  id: string;
  type: "mcq" | "short_answer";
  prompt: string;
  options: string | null;
  correctAnswer: string;
  explanation: string;
};

type Quiz = {
  id: string;
  title: string;
  source: "document" | "summary" | "custom";
  difficulty: string | null;
  createdAt: string;
  questions: QuizQuestion[];
};

type QuizListItem = {
  id: string;
  title: string;
  source: string;
  difficulty: string | null;
  createdAt: string;
  _count: { questions: number };
  attempts: { score: number; total: number }[];
};

type AnswerRecord = {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  feedback?: string;
};

const QUESTION_COUNTS = [5, 10, 20, 30, 50];
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];

export function QuizPanel({ documentId }: { documentId: string }) {
  const [mode, setMode] = useState<"setup" | "taking" | "review">("setup");
  const [history, setHistory] = useState<QuizListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [source, setSource] = useState<"document" | "summary" | "custom">("document");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("mixed");
  const [types, setTypes] = useState<string[]>(["mcq"]);
  const [customQuestionsText, setCustomQuestionsText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [shortAnswerInput, setShortAnswerInput] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [grading, setGrading] = useState(false);
  const [finalScore, setFinalScore] = useState<{ score: number; total: number } | null>(null);

  const loadHistory = () => {
    setHistoryLoading(true);
    fetch(`/api/documents/${documentId}/quizzes`)
      .then((r) => r.json())
      .then((data) => setHistory(data.quizzes ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const toggleType = (t: string) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const startQuiz = (q: Quiz) => {
    setQuiz(q);
    setIndex(0);
    setAnswers([]);
    setSelectedOption(null);
    setShortAnswerInput("");
    setFeedback(null);
    setFinalScore(null);
    setMode("taking");
  };

  const generate = async () => {
    setError(null);
    if (source === "custom" && !customQuestionsText.trim()) {
      setError("Paste the question paper text first.");
      return;
    }
    if (types.length === 0) {
      setError("Pick at least one question type.");
      return;
    }
    setGenerating(true);
    const res = await fetch(`/api/documents/${documentId}/quizzes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        questionCount,
        difficulty,
        types,
        customQuestionsText: source === "custom" ? customQuestionsText : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) {
      setError(data.error || "Failed to generate quiz.");
      return;
    }
    startQuiz(data.quiz);
    loadHistory();
  };

  const loadPastQuiz = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/quizzes/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to load quiz.");
      return;
    }
    startQuiz(data.quiz);
  };

  const currentQuestion = quiz?.questions[index];
  const currentOptions: string[] = currentQuestion?.options
    ? JSON.parse(currentQuestion.options)
    : [];

  const submitMcq = () => {
    if (!currentQuestion || selectedOption == null) return;
    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    setAnswers((prev) => [
      ...prev,
      { questionId: currentQuestion.id, userAnswer: selectedOption, isCorrect },
    ]);
    setFeedback({ correct: isCorrect, text: currentQuestion.explanation });
  };

  const submitShortAnswer = async () => {
    if (!currentQuestion || !shortAnswerInput.trim()) return;
    setGrading(true);
    const res = await fetch(`/api/quizzes/${quiz!.id}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: currentQuestion.id, userAnswer: shortAnswerInput }),
    });
    const data = await res.json().catch(() => ({}));
    setGrading(false);
    if (!res.ok) {
      setError(data.error || "Failed to grade answer.");
      return;
    }
    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        userAnswer: shortAnswerInput,
        isCorrect: data.correct,
        feedback: data.feedback,
      },
    ]);
    setFeedback({ correct: data.correct, text: data.feedback });
  };

  const nextQuestion = async () => {
    if (!quiz) return;
    if (index + 1 < quiz.questions.length) {
      setIndex((i) => i + 1);
      setSelectedOption(null);
      setShortAnswerInput("");
      setFeedback(null);
      return;
    }

    const res = await fetch(`/api/quizzes/${quiz.id}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setFinalScore({ score: data.attempt.score, total: data.attempt.total });
    } else {
      setFinalScore({
        score: answers.filter((a) => a.isCorrect).length,
        total: quiz.questions.length,
      });
    }
    setMode("review");
    loadHistory();
  };

  if (mode === "taking" && quiz && currentQuestion) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between text-xs opacity-60">
          <span>
            Question {index + 1} / {quiz.questions.length}
          </span>
          <button onClick={() => setMode("setup")} className="hover:underline">
            Exit
          </button>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="font-medium">{currentQuestion.prompt}</p>

          {currentQuestion.type === "mcq" ? (
            <div className="mt-3 flex flex-col gap-2">
              {currentOptions.map((opt) => {
                const isSelected = selectedOption === opt;
                const showCorrectness = feedback != null;
                const isRight = opt === currentQuestion.correctAnswer;
                return (
                  <button
                    key={opt}
                    disabled={feedback != null}
                    onClick={() => setSelectedOption(opt)}
                    className={`rounded-xl border px-4 py-2 text-left text-sm transition ${
                      showCorrectness && isRight
                        ? "border-emerald-500 bg-emerald-500/10"
                        : showCorrectness && isSelected && !isRight
                          ? "border-red-500 bg-red-500/10"
                          : isSelected
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              disabled={feedback != null}
              value={shortAnswerInput}
              onChange={(e) => setShortAnswerInput(e.target.value)}
              placeholder="Type your answer…"
              rows={3}
              className="mt-3 w-full rounded-xl border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {feedback && (
          <div
            className={`rounded-2xl p-4 text-sm ${
              feedback.correct
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            <p className="font-medium">{feedback.correct ? "Correct" : "Not quite"}</p>
            <p className="mt-1 opacity-90">{feedback.text}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-auto flex justify-end gap-2">
          {feedback == null ? (
            currentQuestion.type === "mcq" ? (
              <button
                onClick={submitMcq}
                disabled={selectedOption == null}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                Submit
              </button>
            ) : (
              <button
                onClick={submitShortAnswer}
                disabled={grading || !shortAnswerInput.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {grading ? "Grading…" : "Submit"}
              </button>
            )
          ) : (
            <button
              onClick={nextQuestion}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              {index + 1 < quiz.questions.length ? "Next" : "Finish"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (mode === "review" && quiz && finalScore) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto">
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm opacity-60">Score</p>
          <p className="text-3xl font-semibold">
            {finalScore.score} / {finalScore.total}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {quiz.questions.map((q, i) => {
            const a = answers[i];
            return (
              <div key={q.id} className="glass rounded-xl p-3 text-sm">
                <p className="font-medium">{q.prompt}</p>
                <p className="mt-1 opacity-70">
                  Your answer: {a?.userAnswer || "—"}{" "}
                  <span className={a?.isCorrect ? "text-emerald-600" : "text-red-500"}>
                    ({a?.isCorrect ? "correct" : "incorrect"})
                  </span>
                </p>
                {!a?.isCorrect && (
                  <p className="mt-1 opacity-60">Correct answer: {q.correctAnswer}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-auto flex gap-2">
          <button
            onClick={() => startQuiz(quiz)}
            className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
          >
            Retake
          </button>
          <button
            onClick={() => setMode("setup")}
            className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            New quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-1">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">
          Generate from
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(["document", "summary", "custom"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                source === s
                  ? "bg-indigo-600 text-white"
                  : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {s === "document" ? "Full document" : s === "summary" ? "Summary" : "Pasted question paper"}
            </button>
          ))}
        </div>
      </div>

      {source === "custom" ? (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">
            Paste question paper
          </p>
          <textarea
            value={customQuestionsText}
            onChange={(e) => setCustomQuestionsText(e.target.value)}
            rows={6}
            placeholder="Paste the questions here — we'll match answers using this document."
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">
              Number of questions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    questionCount === n
                      ? "bg-indigo-600 text-white"
                      : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-16 rounded-full border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs outline-none"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">
              Difficulty
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                    difficulty === d
                      ? "bg-indigo-600 text-white"
                      : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">
          Question types
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: "mcq", label: "Multiple choice" },
            { value: "short_answer", label: "Short answer" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => toggleType(t.value)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                types.includes(t.value)
                  ? "bg-indigo-600 text-white"
                  : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className="rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {generating ? "Generating…" : "Generate quiz"}
      </button>

      {error && <p className="whitespace-pre-wrap text-sm text-red-500">{error}</p>}

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">
          Past quizzes
        </p>
        {historyLoading ? (
          <p className="text-sm opacity-50">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm opacity-50">No quizzes yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((q) => (
              <button
                key={q.id}
                onClick={() => loadPastQuiz(q.id)}
                className="glass flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="truncate">{q.title}</span>
                <span className="shrink-0 text-xs opacity-60">
                  {q._count.questions} q
                  {q.attempts[0] ? ` · ${q.attempts[0].score}/${q.attempts[0].total}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
