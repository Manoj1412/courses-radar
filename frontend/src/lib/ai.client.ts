/**
 * Thin client wrapper that talks to the FastAPI backend at
 * `${REACT_APP_BACKEND_URL}/api/ai/*`. The backend uses the Emergent Universal
 * LLM Key so the user no longer needs a personal Gemini key.
 *
 * These functions mimic the public shape of the old TanStack server functions
 * so existing call sites (AIChatbotPanel, UnderstandingFeedback) need only
 * minimal changes.
 */

const API_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_BACKEND_URL) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_BACKEND_URL) ||
  "";

function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE}${path}`;
  return path; // same-origin fallback
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.detail || j.error || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    if (res.status === 429) {
      throw new Error(
        detail ||
          "AI service is temporarily rate-limited. Please try again in a moment.",
      );
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/* ---------- Summarize ---------- */
export interface SummarizeResult {
  overview: string;
  keyPoints: string[];
  learningOutcomes: string[];
  error: string | null;
}

export async function summarizeVideo(input: {
  title: string;
  description?: string;
}): Promise<SummarizeResult> {
  try {
    const res = await post<SummarizeResult>("/api/ai/summarize", {
      title: input.title,
      description: input.description ?? "",
    });
    return {
      overview: res.overview ?? "",
      keyPoints: res.keyPoints ?? [],
      learningOutcomes: res.learningOutcomes ?? [],
      error: res.error ?? null,
    };
  } catch (err: any) {
    return {
      overview: "",
      keyPoints: [],
      learningOutcomes: [],
      error: err?.message || "Failed to summarize",
    };
  }
}

/* ---------- Quiz generation ---------- */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizResult {
  questions: QuizQuestion[];
  error: string | null;
}

export async function generateQuiz(input: {
  title: string;
  count?: number;
}): Promise<QuizResult> {
  try {
    const res = await post<QuizResult>("/api/ai/quiz", {
      title: input.title,
      count: input.count ?? 5,
    });
    return { questions: res.questions ?? [], error: res.error ?? null };
  } catch (err: any) {
    return { questions: [], error: err?.message || "Failed to generate quiz" };
  }
}

/* ---------- Quiz evaluation ---------- */
export interface PerQuestion {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizEvalResult {
  score: number;
  correct: number;
  total: number;
  perQuestion: PerQuestion[];
  feedback: string;
  error: string | null;
}

export async function evaluateQuiz(input: {
  title: string;
  questions: QuizQuestion[];
  userAnswers: number[];
}): Promise<QuizEvalResult> {
  try {
    const res = await post<QuizEvalResult>("/api/ai/quiz-eval", input);
    return {
      score: res.score ?? 0,
      correct: res.correct ?? 0,
      total: res.total ?? 0,
      perQuestion: res.perQuestion ?? [],
      feedback: res.feedback ?? "",
      error: res.error ?? null,
    };
  } catch (err: any) {
    return {
      score: 0,
      correct: 0,
      total: 0,
      perQuestion: [],
      feedback: "",
      error: err?.message || "Failed to evaluate quiz",
    };
  }
}

/* ---------- Chat ---------- */
export interface ChatMsg {
  role: "user" | "model";
  text: string;
}

export interface ChatResult {
  reply: string;
  error: string | null;
}

export async function chatWithAI(input: {
  title: string;
  message: string;
  history?: ChatMsg[];
}): Promise<ChatResult> {
  try {
    const res = await post<ChatResult>("/api/ai/chat", {
      title: input.title,
      message: input.message,
      history: input.history ?? [],
    });
    return { reply: res.reply ?? "", error: res.error ?? null };
  } catch (err: any) {
    return { reply: "", error: err?.message || "Failed to get AI response" };
  }
}

/* ---------- Understanding feedback ---------- */
export interface FeedbackResult {
  verdict: string;
  summary: string;
  strengths: string[];
  suggestions: string[];
  score: number;
  percentages: Record<string, number>;
  totalSeconds: number;
  awayCount: number;
  error: string | null;
}

export async function understandingFeedback(input: {
  title: string;
  totalSeconds: number;
  emotionCounts: Record<string, number>;
  awayCount?: number;
  avgConfidence?: number;
}): Promise<FeedbackResult> {
  try {
    const res = await post<FeedbackResult>("/api/ai/feedback", {
      title: input.title,
      totalSeconds: input.totalSeconds,
      emotionCounts: input.emotionCounts,
      awayCount: input.awayCount ?? 0,
      avgConfidence: input.avgConfidence ?? 0,
    });
    return {
      verdict: res.verdict ?? "",
      summary: res.summary ?? "",
      strengths: res.strengths ?? [],
      suggestions: res.suggestions ?? [],
      score: res.score ?? 0,
      percentages: res.percentages ?? {},
      totalSeconds: res.totalSeconds ?? 0,
      awayCount: res.awayCount ?? 0,
      error: res.error ?? null,
    };
  } catch (err: any) {
    return {
      verdict: "",
      summary: "",
      strengths: [],
      suggestions: [],
      score: 0,
      percentages: {},
      totalSeconds: 0,
      awayCount: 0,
      error: err?.message || "Failed to generate feedback",
    };
  }
}
