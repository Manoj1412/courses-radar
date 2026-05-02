import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

async function callGemini(params: {
  contents: GeminiContent[];
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  responseSchema?: Record<string, unknown>;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const body: Record<string, unknown> = {
    contents: params.contents,
    generationConfig: {
      temperature: params.temperature ?? 0.7,
      ...(params.responseMimeType
        ? { responseMimeType: params.responseMimeType }
        : {}),
      ...(params.responseSchema ? { responseSchema: params.responseSchema } : {}),
    },
  };
  if (params.systemInstruction) {
    body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
  }

  const res = await fetch(GEMINI_URL(GEMINI_MODEL, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API error:", res.status, errText);
    if (res.status === 429) {
      throw new Error(
        "Gemini API quota exceeded. Free-tier limit reached — wait a minute or enable billing on your Google AI key."
      );
    }
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
    "";
  return text.trim();
}

/* ---------- Summarize ---------- */
const summarizeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
});

export const summarizeVideoFn = createServerFn()
  .inputValidator((i: unknown) => summarizeSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const schema = {
        type: "object",
        properties: {
          overview: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          learningOutcomes: { type: "array", items: { type: "string" } },
        },
        required: ["overview", "keyPoints", "learningOutcomes"],
      };
      const prompt = `You are an expert educator. Given the YouTube video title (and optional short description), produce a concise study summary based on the likely topic.

Title: "${data.title}"
${data.description ? `Short description: ${data.description.slice(0, 400)}` : ""}

Respond with:
- overview: 2-3 sentence overview
- keyPoints: 5-7 bullet points of key concepts viewers will learn
- learningOutcomes: 3-4 concrete skills or outcomes`;

      const text = await callGemini({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.4,
      });
      const parsed = JSON.parse(text);
      return { ...parsed, error: null };
    } catch (err: any) {
      console.error("summarizeVideoFn error:", err);
      return {
        overview: "",
        keyPoints: [],
        learningOutcomes: [],
        error: err.message || "Failed to summarize",
      };
    }
  });

/* ---------- Quiz Generation ---------- */
const quizSchema = z.object({
  title: z.string().min(1),
  count: z.number().min(1).max(10).optional().default(5),
});

export const generateQuizFn = createServerFn()
  .inputValidator((i: unknown) => quizSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const schema = {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: {
                  type: "array",
                  items: { type: "string" },
                },
                correctIndex: { type: "integer" },
                explanation: { type: "string" },
              },
              required: ["question", "options", "correctIndex", "explanation"],
            },
          },
        },
        required: ["questions"],
      };
      const prompt = `You are a quiz master. Based on the likely content of a YouTube video titled "${data.title}", generate exactly ${data.count} multiple-choice questions to test the viewer's understanding.

Rules:
- Each question must have exactly 4 options
- correctIndex is 0-3
- Mix difficulty: 2 easy, 2 medium, 1 hard
- Keep questions focused on the title's core topic
- Explanations should be 1-2 sentences

Return valid JSON.`;

      const text = await callGemini({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.6,
      });
      const parsed = JSON.parse(text);
      return { questions: parsed.questions || [], error: null };
    } catch (err: any) {
      console.error("generateQuizFn error:", err);
      return { questions: [], error: err.message || "Failed to generate quiz" };
    }
  });

/* ---------- Quiz Evaluation ---------- */
const evalSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number(),
      explanation: z.string(),
    })
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
          userAnswer: userIdx >= 0 ? q.options[userIdx] : "No answer",
          correctAnswer: q.options[q.correctIndex],
          isCorrect,
          explanation: q.explanation,
        };
      });
      const score = Math.round((correct / data.questions.length) * 100);

      const prompt = `The user just took a ${data.questions.length}-question quiz on the video titled "${data.title}" and scored ${score}% (${correct}/${data.questions.length} correct).

Results:
${perQuestion
  .map(
    (p, i) =>
      `${i + 1}. ${p.isCorrect ? "✓" : "✗"} ${p.question}\n   User: ${p.userAnswer}\n   Correct: ${p.correctAnswer}`
  )
  .join("\n")}

Give 3-4 sentences of personalized, encouraging feedback. Point out strong areas, suggest what to revise, and end with a motivating note. Plain text only.`;

      const feedback = await callGemini({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        temperature: 0.6,
      });

      return {
        score,
        correct,
        total: data.questions.length,
        perQuestion,
        feedback,
        error: null,
      };
    } catch (err: any) {
      console.error("evaluateQuizFn error:", err);
      return {
        score: 0,
        correct: 0,
        total: 0,
        perQuestion: [],
        feedback: "",
        error: err.message || "Failed to evaluate quiz",
      };
    }
  });

/* ---------- Chat (doubt clarification) ---------- */
const chatSchema = z.object({
  title: z.string(),
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string(),
      })
    )
    .optional()
    .default([]),
});

export const chatWithAIFn = createServerFn()
  .inputValidator((i: unknown) => chatSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const contents: GeminiContent[] = data.history.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      contents.push({ role: "user", parts: [{ text: data.message }] });

      const systemInstruction = `You are an AI tutor helping a student who is watching a YouTube video titled: "${data.title}".
Answer their doubts clearly and concisely (3-5 sentences unless more depth is asked).
Focus on the topic of the video. Use simple examples. If the question is unrelated, gently redirect.
Do not use markdown headings; plain text with bullet points or numbered lists is fine.`;

      const reply = await callGemini({
        contents,
        systemInstruction,
        temperature: 0.7,
      });
      return { reply, error: null };
    } catch (err: any) {
      console.error("chatWithAIFn error:", err);
      return {
        reply: "",
        error: err.message || "Failed to get AI response",
      };
    }
  });

/* ---------- Understanding Feedback ---------- */
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
      const total =
        Object.values(data.emotionCounts).reduce((a, b) => a + b, 0) || 1;
      const percentages: Record<string, number> = {};
      for (const [k, v] of Object.entries(data.emotionCounts)) {
        percentages[k] = Math.round((v / total) * 100);
      }

      // Simple heuristic score
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
        Math.min(100, Math.round(positive - negative * 0.5 + 20))
      );

      const schema = {
        type: "object",
        properties: {
          verdict: { type: "string" },
          summary: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
        },
        required: ["verdict", "summary", "strengths", "suggestions"],
      };

      const prompt = `A student just finished watching a YouTube video titled "${data.title}".
Their facial expressions were tracked throughout the session.

Engagement stats:
- Total watch time: ${Math.round(data.totalSeconds)} seconds
- Times stepped away from camera: ${data.awayCount}
- Expression distribution (percent of samples):
${Object.entries(percentages)
  .map(([k, v]) => `  • ${k}: ${v}%`)
  .join("\n")}
- Average detection confidence: ${Math.round(data.avgConfidence * 100)}%
- Computed engagement score: ${score}/100

Based on this, infer how well the student likely understood the video and produce:
- verdict: one short label (e.g., "Great engagement!", "Mostly engaged", "Somewhat distracted", "Looked confused")
- summary: 2-3 sentences describing their session (use "you" address)
- strengths: 2-3 positive bullets
- suggestions: 2-3 practical next-step bullets (revise, rewatch segments, try quiz, etc.)

Be warm, concise, and specific.`;

      const text = await callGemini({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.6,
      });
      const parsed = JSON.parse(text);
      return {
        ...parsed,
        score,
        percentages,
        totalSeconds: Math.round(data.totalSeconds),
        awayCount: data.awayCount,
        error: null,
      };
    } catch (err: any) {
      console.error("understandingFeedbackFn error:", err);
      return {
        verdict: "",
        summary: "",
        strengths: [],
        suggestions: [],
        score: 0,
        percentages: {},
        totalSeconds: 0,
        awayCount: 0,
        error: err.message || "Failed to generate feedback",
      };
    }
  });
