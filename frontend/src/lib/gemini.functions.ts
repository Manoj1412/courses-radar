import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ---------- Provider routing ---------- *
 * 1) PRIMARY: Emergent Universal LLM key (sk-emergent-...) via the
 *    OpenAI-compatible proxy at https://integrations.emergentagent.com/llm
 *    — works from any host, no Python backend required.
 * 2) FALLBACK: Direct Gemini API using the user's GEMINI_API_KEY
 *    (used only if the Emergent proxy fails or is rate-limited).
 *
 * Both keys live in `frontend/.env`:
 *   EMERGENT_LLM_KEY=sk-emergent-...
 *   GEMINI_API_KEY=AIza...
 * ------------------------------------ */

const EMERGENT_PROXY_URL = "https://integrations.emergentagent.com/llm/chat/completions";
const EMERGENT_MODEL = "gemini/gemini-2.5-flash"; // proxy expects provider/model
const GEMINI_DIRECT_MODEL = "gemini-2.5-flash";
const GEMINI_DIRECT_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

interface CallArgs {
  systemInstruction?: string;
  history?: ChatTurn[];
  userMessage: string;
  temperature?: number;
  expectJson?: boolean;
}

/** Call Emergent proxy (OpenAI-compatible). Throws on non-2xx. */
async function callEmergent(args: CallArgs): Promise<string> {
  const key = process.env.EMERGENT_LLM_KEY;
  if (!key) throw new Error("EMERGENT_LLM_KEY not configured");

  const messages: { role: string; content: string }[] = [];
  if (args.systemInstruction) {
    messages.push({ role: "system", content: args.systemInstruction });
  }
  for (const turn of args.history ?? []) {
    messages.push({
      role: turn.role === "model" ? "assistant" : "user",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: args.userMessage });

  const body: Record<string, unknown> = {
    model: EMERGENT_MODEL,
    messages,
    temperature: args.temperature ?? 0.6,
  };
  if (args.expectJson) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(EMERGENT_PROXY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Emergent proxy ${res.status}: ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Emergent proxy returned empty content");
  return text.trim();
}

/** Call Google Gemini API directly using the user's key. */
async function callGeminiDirect(args: CallArgs): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const turn of args.history ?? []) {
    contents.push({ role: turn.role, parts: [{ text: turn.text }] });
  }
  contents.push({ role: "user", parts: [{ text: args.userMessage }] });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: args.temperature ?? 0.6,
      ...(args.expectJson ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (args.systemInstruction) {
    body.systemInstruction = { parts: [{ text: args.systemInstruction }] };
  }

  const res = await fetch(GEMINI_DIRECT_URL(GEMINI_DIRECT_MODEL, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini direct ${res.status}: ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
  if (!text) throw new Error("Gemini direct returned empty content");
  return text.trim();
}

/** Try Emergent first; on failure fall back to direct Gemini. */
async function callLLM(args: CallArgs): Promise<string> {
  try {
    return await callEmergent(args);
  } catch (primaryErr: any) {
    console.warn(
      "[ai] Emergent proxy failed, falling back to direct Gemini:",
      primaryErr?.message,
    );
    try {
      return await callGeminiDirect(args);
    } catch (fallbackErr: any) {
      // Surface a useful combined error
      throw new Error(
        `Both AI providers failed. Emergent: ${primaryErr?.message}. Gemini: ${fallbackErr?.message}`,
      );
    }
  }
}

/** Strip ```json fences and parse the model's JSON output. */
function parseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON");
  }
}

/* ===================== Summarize ===================== */
const summarizeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
});

export const summarizeVideoFn = createServerFn()
  .inputValidator((i: unknown) => summarizeSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const desc = (data.description || "").slice(0, 400);
      const prompt = `Given the YouTube video title (and optional short description), produce a concise study summary based on the likely topic.

Title: "${data.title}"
${desc ? `Short description: ${desc}` : ""}

Respond with VALID JSON ONLY (no prose, no markdown fences) matching this shape:
{
  "overview": "2-3 sentence overview",
  "keyPoints": ["5 to 7 bullet points of key concepts"],
  "learningOutcomes": ["3 to 4 concrete skills or outcomes"]
}`;
      const text = await callLLM({
        systemInstruction:
          "You are an expert educator. Output only valid JSON.",
        userMessage: prompt,
        temperature: 0.4,
        expectJson: true,
      });
      const parsed = parseJson(text);
      return {
        overview: parsed.overview ?? "",
        keyPoints: parsed.keyPoints ?? [],
        learningOutcomes: parsed.learningOutcomes ?? [],
        error: null as string | null,
      };
    } catch (err: any) {
      console.error("summarizeVideoFn error:", err);
      return {
        overview: "",
        keyPoints: [] as string[],
        learningOutcomes: [] as string[],
        error: err?.message || "Failed to summarize",
      };
    }
  });

/* ===================== Quiz generation ===================== */
const quizSchema = z.object({
  title: z.string().min(1),
  count: z.number().min(1).max(10).optional().default(5),
});

export const generateQuizFn = createServerFn()
  .inputValidator((i: unknown) => quizSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const prompt = `Based on the likely content of a YouTube video titled "${data.title}", generate exactly ${data.count} multiple-choice questions to test understanding.

Rules:
- Each question has exactly 4 options
- correctIndex is 0-3
- Mix difficulty: 2 easy, 2 medium, 1 hard
- Keep questions focused on the title's core topic
- Explanations should be 1-2 sentences

Output VALID JSON ONLY (no fences, no prose) with this shape:
{
  "questions": [
    { "question": "...", "options": ["a","b","c","d"], "correctIndex": 0, "explanation": "..." }
  ]
}`;
      const text = await callLLM({
        systemInstruction: "You are a quiz master. Output only valid JSON.",
        userMessage: prompt,
        temperature: 0.6,
        expectJson: true,
      });
      const parsed = parseJson(text);
      return {
        questions: parsed.questions ?? [],
        error: null as string | null,
      };
    } catch (err: any) {
      console.error("generateQuizFn error:", err);
      return {
        questions: [] as Array<{
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
        }>,
        error: err?.message || "Failed to generate quiz",
      };
    }
  });

/* ===================== Quiz evaluation ===================== */
const evalSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number(),
      explanation: z.string(),
    }),
  ),
  userAnswers: z.array(z.number()),
});

export const evaluateQuizFn = createServerFn()
  .inputValidator((i: unknown) => evalSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      let correct = 0;
      const perQuestion = data.questions.map((q, i) => {
        const userIdx = data.userAnswers[i];
        const isCorrect = userIdx === q.correctIndex;
        if (isCorrect) correct += 1;
        return {
          question: q.question,
          userAnswer:
            userIdx >= 0 && userIdx < q.options.length
              ? q.options[userIdx]
              : "No answer",
          correctAnswer: q.options[q.correctIndex],
          isCorrect,
          explanation: q.explanation,
        };
      });
      const total = data.questions.length || 1;
      const score = Math.round((correct / total) * 100);

      const resultsBlock = perQuestion
        .map(
          (p, i) =>
            `${i + 1}. ${p.isCorrect ? "CORRECT" : "WRONG"} ${p.question}\n   User: ${p.userAnswer}\n   Correct: ${p.correctAnswer}`,
        )
        .join("\n");
      const prompt = `The user just took a ${total}-question quiz on the video titled "${data.title}" and scored ${score}% (${correct}/${total} correct).

Results:
${resultsBlock}

Give 3-4 sentences of personalized, encouraging feedback. Point out strong areas, suggest what to revise, and end with a motivating note. Plain text only.`;

      const feedback = await callLLM({
        systemInstruction: "You are a warm, supportive tutor.",
        userMessage: prompt,
        temperature: 0.6,
      });

      return {
        score,
        correct,
        total,
        perQuestion,
        feedback,
        error: null as string | null,
      };
    } catch (err: any) {
      console.error("evaluateQuizFn error:", err);
      return {
        score: 0,
        correct: 0,
        total: 0,
        perQuestion: [] as Array<{
          question: string;
          userAnswer: string;
          correctAnswer: string;
          isCorrect: boolean;
          explanation: string;
        }>,
        feedback: "",
        error: err?.message || "Failed to evaluate quiz",
      };
    }
  });

/* ===================== Chat ===================== */
const chatSchema = z.object({
  title: z.string(),
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export const chatWithAIFn = createServerFn()
  .inputValidator((i: unknown) => chatSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const system = `You are an AI tutor helping a student who is watching a YouTube video titled: "${data.title}".
Answer their doubts clearly and concisely (3-5 sentences unless more depth is asked).
Focus on the topic of the video. Use simple examples. If the question is unrelated, gently redirect.
Do not use markdown headings; plain text with bullet points or numbered lists is fine.`;

      const reply = await callLLM({
        systemInstruction: system,
        history: data.history,
        userMessage: data.message,
        temperature: 0.7,
      });
      return { reply, error: null as string | null };
    } catch (err: any) {
      console.error("chatWithAIFn error:", err);
      return { reply: "", error: err?.message || "Failed to get AI response" };
    }
  });

/* ===================== Understanding feedback ===================== */
const feedbackSchema = z.object({
  title: z.string(),
  totalSeconds: z.number().min(0),
  emotionCounts: z.record(z.string(), z.number()),
  awayCount: z.number().min(0).optional().default(0),
  avgConfidence: z.number().optional().default(0),
});

export const understandingFeedbackFn = createServerFn()
  .inputValidator((i: unknown) => feedbackSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const totalSamples =
        Object.values(data.emotionCounts).reduce((a, b) => a + b, 0) || 1;
      const percentages: Record<string, number> = {};
      for (const [k, v] of Object.entries(data.emotionCounts)) {
        percentages[k] = Math.round((v / totalSamples) * 100);
      }
      const positive =
        (percentages["happy"] || 0) +
        (percentages["surprised"] || 0) * 0.7 +
        (percentages["neutral"] || 0) * 0.5;
      const negative =
        (percentages["sad"] || 0) +
        (percentages["angry"] || 0) +
        (percentages["fearful"] || 0) +
        (percentages["disgusted"] || 0);
      const score = Math.max(
        0,
        Math.min(100, Math.round(positive - negative * 0.5 + 20)),
      );

      const distribution =
        Object.entries(percentages)
          .map(([k, v]) => `  - ${k}: ${v}%`)
          .join("\n") || "  - (no samples)";
      const prompt = `A student just finished watching a YouTube video titled "${data.title}".
Their facial expressions were tracked throughout the session.

Engagement stats:
- Total watch time: ${Math.round(data.totalSeconds)} seconds
- Times stepped away from camera: ${data.awayCount}
- Expression distribution (percent of samples):
${distribution}
- Average detection confidence: ${Math.round(data.avgConfidence * 100)}%
- Computed engagement score: ${score}/100

Based on this, infer how well the student likely understood the video and produce VALID JSON ONLY (no fences, no prose) with this shape:
{
  "verdict": "short label (e.g., Great engagement!, Mostly engaged, Somewhat distracted, Looked confused)",
  "summary": "2-3 sentences describing their session (address as \\"you\\")",
  "strengths": ["2-3 positive bullets"],
  "suggestions": ["2-3 practical next-step bullets"]
}

Be warm, concise, and specific.`;

      const text = await callLLM({
        systemInstruction:
          "You are an empathetic learning coach. Output only valid JSON.",
        userMessage: prompt,
        temperature: 0.6,
        expectJson: true,
      });
      const parsed = parseJson(text);
      return {
        verdict: parsed.verdict ?? "",
        summary: parsed.summary ?? "",
        strengths: parsed.strengths ?? [],
        suggestions: parsed.suggestions ?? [],
        score,
        percentages,
        totalSeconds: Math.round(data.totalSeconds),
        awayCount: data.awayCount,
        error: null as string | null,
      };
    } catch (err: any) {
      console.error("understandingFeedbackFn error:", err);
      return {
        verdict: "",
        summary: "",
        strengths: [] as string[],
        suggestions: [] as string[],
        score: 0,
        percentages: {} as Record<string, number>,
        totalSeconds: 0,
        awayCount: 0,
        error: err?.message || "Failed to generate feedback",
      };
    }
  });
