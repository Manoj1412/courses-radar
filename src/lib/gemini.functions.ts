import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface SummaryResponse {
  title: string;
  summary: string;
  keyPoints: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
}

export interface FeedbackResponse {
  feedback: string;
  score: number;
  incorrectAnswers: number[];
}

const summaryInputSchema = z.object({
  videoTitle: z.string(),
  videoDescription: z.string(),
});

const quizInputSchema = z.object({
  videoTitle: z.string(),
  videoDescription: z.string(),
  numQuestions: z.number().default(5),
});

const feedbackInputSchema = z.object({
  videoTitle: z.string(),
  userAnswers: z.array(z.number()),
  correctAnswers: z.array(z.number()),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctAnswer: z.number(),
      explanation: z.string(),
    })
  ),
});

const recommendationInputSchema = z.object({
  videoTitle: z.string(),
  quizScore: z.number(),
  totalQuestions: z.number(),
});

/**
 * Server function to generate video summary using Gemini API
 */
export const generateVideoSummaryFn = createServerFn()
  .inputValidator((input: unknown) => summaryInputSchema.parse(input))
  .handler(async ({ data }): Promise<SummaryResponse> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key not configured");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
You are an educational content expert. Analyze the following video details and provide a comprehensive summary with key learning points.

Video Title: ${data.videoTitle}
Video Description: ${data.videoDescription}

Please provide:
1. A brief 2-3 sentence summary of the main topic
2. Exactly 5 key learning points as bullet points

Format your response as JSON with this structure:
{
  "title": "the video topic",
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"]
}

Respond ONLY with valid JSON, no other text.
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid response format");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || data.videoTitle,
        summary: parsed.summary || "Unable to generate summary",
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      };
    } catch (error) {
      console.error("Error generating video summary:", error);
      return {
        title: data.videoTitle,
        summary: "Unable to generate summary at this time",
        keyPoints: [],
      };
    }
  });

/**
 * Server function to generate quiz questions
 */
export const generateQuizQuestionsFn = createServerFn()
  .inputValidator((input: unknown) => quizInputSchema.parse(input))
  .handler(async ({ data }): Promise<QuizResponse> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key not configured");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
You are an expert quiz creator for educational content. Create ${data.numQuestions} multiple-choice questions to test understanding of the following video.

Video Title: ${data.videoTitle}
Video Description: ${data.videoDescription}

Create ${data.numQuestions} questions with:
- Clear, specific questions testing key concepts
- 4 options per question
- One correct answer (index 0-3)
- A brief explanation for the correct answer

Format as JSON array:
[
  {
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "Why this is correct..."
  }
]

Important: Respond ONLY with the JSON array, no other text.
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse the JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Invalid response format");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const questions: QuizQuestion[] = Array.isArray(parsed)
        ? parsed.map((q: any) => ({
            question: q.question || "",
            options: q.options || [],
            correctAnswer: q.correctAnswer ?? 0,
            explanation: q.explanation || "",
          }))
        : [];

      return { questions };
    } catch (error) {
      console.error("Error generating quiz questions:", error);
      return { questions: [] };
    }
  });

/**
 * Server function to generate quiz feedback
 */
export const generateQuizFeedbackFn = createServerFn()
  .inputValidator((input: unknown) => feedbackInputSchema.parse(input))
  .handler(async ({ data }): Promise<FeedbackResponse> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key not configured");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const correctCount = data.userAnswers.filter(
        (ans, i) => ans === data.correctAnswers[i]
      ).length;
      const score = Math.round((correctCount / data.userAnswers.length) * 100);
      const incorrectAnswers = data.userAnswers
        .map((ans, i) => (ans !== data.correctAnswers[i] ? i : -1))
        .filter((i) => i !== -1);

      const prompt = `
You are an educational tutor. Provide constructive feedback for a student who scored ${score}% on a quiz about "${data.videoTitle}".

They got ${correctCount} out of ${data.userAnswers.length} questions correct.
Incorrect question numbers: ${incorrectAnswers.length > 0 ? incorrectAnswers.join(", ") : "None"}

Provide:
1. Positive encouragement about their score
2. Specific areas they should review
3. Actionable tips for improvement

Keep response concise (3-4 sentences max).
`;

      const result = await model.generateContent(prompt);
      const feedback = result.response.text();

      return {
        feedback,
        score,
        incorrectAnswers,
      };
    } catch (error) {
      console.error("Error generating quiz feedback:", error);
      return {
        feedback: "Great effort! Review the material and try again.",
        score: 0,
        incorrectAnswers: [],
      };
    }
  });

/**
 * Server function to generate study recommendations
 */
export const generateStudyRecommendationFn = createServerFn()
  .inputValidator((input: unknown) => recommendationInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ recommendation: string }> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key not configured");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const percentage = Math.round((data.quizScore / data.totalQuestions) * 100);

      const prompt = `
You are an educational advisor. Based on a quiz score of ${percentage}% on "${data.videoTitle}", recommend the next steps.

If score >= 80: Suggest related advanced topics
If score 60-79: Suggest reviewing key concepts
If score < 60: Suggest rewatching the video or finding supplementary resources

Keep response to 2 sentences max.
`;

      const result = await model.generateContent(prompt);
      const recommendation = result.response.text();

      return { recommendation };
    } catch (error) {
      console.error("Error generating recommendation:", error);
      return {
        recommendation: "Continue practicing with more videos on this topic.",
      };
    }
  });

// Legacy exports for backward compatibility with direct function calls
export async function generateVideoSummary(
  videoTitle: string,
  videoDescription: string
): Promise<SummaryResponse> {
  const result = await generateVideoSummaryFn({
    videoTitle,
    videoDescription,
  });
  return result;
}

export async function generateQuizQuestions(
  videoTitle: string,
  videoDescription: string,
  numQuestions: number = 5
): Promise<QuizResponse> {
  const result = await generateQuizQuestionsFn({
    videoTitle,
    videoDescription,
    numQuestions,
  });
  return result;
}

export async function generateQuizFeedback(
  videoTitle: string,
  userAnswers: number[],
  correctAnswers: number[],
  questions: QuizQuestion[]
): Promise<FeedbackResponse> {
  const result = await generateQuizFeedbackFn({
    videoTitle,
    userAnswers,
    correctAnswers,
    questions,
  });
  return result;
}

export async function generateStudyRecommendation(
  videoTitle: string,
  quizScore: number,
  totalQuestions: number
): Promise<{ recommendation: string }> {
  const result = await generateStudyRecommendationFn({
    videoTitle,
    quizScore,
    totalQuestions,
  });
  return result;
}
