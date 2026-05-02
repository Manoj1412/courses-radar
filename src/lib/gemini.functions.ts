import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

/**
 * Generate a summary and key points for a video based on its title and description
 */
export async function generateVideoSummary(
  videoTitle: string,
  videoDescription: string
): Promise<SummaryResponse> {
  try {
    const prompt = `
You are an educational content expert. Analyze the following video details and provide a comprehensive summary with key learning points.

Video Title: ${videoTitle}
Video Description: ${videoDescription}

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
      title: parsed.title || videoTitle,
      summary: parsed.summary || "Unable to generate summary",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch (error) {
    console.error("Error generating video summary:", error);
    return {
      title: videoTitle,
      summary: "Unable to generate summary at this time",
      keyPoints: [],
    };
  }
}

/**
 * Generate quiz questions for a video
 */
export async function generateQuizQuestions(
  videoTitle: string,
  videoDescription: string,
  numQuestions: number = 5
): Promise<QuizResponse> {
  try {
    const prompt = `
You are an expert quiz creator for educational content. Create ${numQuestions} multiple-choice questions to test understanding of the following video.

Video Title: ${videoTitle}
Video Description: ${videoDescription}

Create ${numQuestions} questions with:
- Clear, specific questions testing key concepts
- 4 options per question (A, B, C, D)
- One correct answer
- A brief explanation for the correct answer

Format as JSON array:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this is correct..."
  }
]

Important:
- correctAnswer is 0-indexed (0=first option, 1=second, etc.)
- Make questions progressively harder
- Focus on main concepts from the video
- Ensure options are plausible but distinct

Respond ONLY with the JSON array, no other text.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }
    
    const questions = JSON.parse(jsonMatch[0]);
    return {
      questions: questions.map((q: any) => ({
        question: q.question || "",
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
        explanation: q.explanation || "No explanation provided",
      })),
    };
  } catch (error) {
    console.error("Error generating quiz questions:", error);
    return {
      questions: [],
    };
  }
}

/**
 * Generate feedback based on quiz performance
 */
export async function generateQuizFeedback(
  videoTitle: string,
  userAnswers: number[],
  correctAnswers: number[],
  questions: QuizQuestion[]
): Promise<FeedbackResponse> {
  try {
    const incorrectIndexes = userAnswers
      .map((answer, index) => (answer !== correctAnswers[index] ? index : -1))
      .filter((i) => i !== -1);

    const score = ((userAnswers.length - incorrectIndexes.length) / userAnswers.length) * 100;

    const wrongQuestions = incorrectIndexes
      .map((i) => `Q${i + 1}: ${questions[i].question}`)
      .join("\n");

    const prompt = `
The user answered a quiz about "${videoTitle}" with ${Math.round(score)}% accuracy.

${incorrectIndexes.length > 0 ? `They got these questions wrong:\n${wrongQuestions}` : "They answered all questions correctly!"}

Based on their performance, provide encouraging and constructive feedback that:
1. Acknowledges their effort
2. Highlights their strengths
3. Suggests areas to focus on for improvement
4. Is motivational and helpful

Keep it to 2-3 sentences maximum.
`;

    const result = await model.generateContent(prompt);
    const feedback = result.response.text();

    return {
      feedback: feedback,
      score: Math.round(score),
      incorrectAnswers: incorrectIndexes,
    };
  } catch (error) {
    console.error("Error generating feedback:", error);
    return {
      feedback: "Great effort! Keep practicing to improve further.",
      score: 0,
      incorrectAnswers: [],
    };
  }
}

/**
 * Generate a personalized study recommendation based on quiz history
 */
export async function generateStudyRecommendation(
  videoTitle: string,
  averageScore: number,
  weakTopics: string[]
): Promise<string> {
  try {
    const prompt = `
A student is learning about "${videoTitle}" with an average quiz score of ${averageScore}%.
Their weak areas are: ${weakTopics.join(", ")}

Generate a short, encouraging study recommendation (2-3 sentences) that:
1. Acknowledges their current level
2. Suggests specific ways to improve
3. Is motivational

Keep it concise and actionable.
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating study recommendation:", error);
    return "Keep practicing regularly to improve your understanding!";
  }
}
