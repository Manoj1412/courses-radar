export interface VideoResult {
  id: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnail: string;
  duration: string;
  durationSeconds: number;
  views: number;
  likes: number;
  likeRatio: number;
  sentimentScore: number;
  syllabusMatch: number;
  overallScore: number;
  publishedAt: string;
  isPlaylist: boolean;
  subscriberCount: number;
  channelAgeYears: number;
  description: string;
  topicsDetected: string[];
}

export interface SearchResult {
  videos: VideoResult[];
  totalCount: number;
  error: string | null;
}

export interface Filters {
  duration: "all" | "short" | "medium" | "long";
}

export type SortOption = "likes" | "popularity" | "positive-comments" | "recent";

export const LANGUAGES = ["All", "English", "Hindi", "Telugu"];

export type Emotion = "happy" | "sad" | "angry" | "surprised" | "fearful" | "disgusted" | "neutral";

export interface FaceDetection {
  name: string;
  emotion: Emotion;
  confidence: number;
}

export interface QuizAttempt {
  id: string;
  videoId: string;
  videoTitle: string;
  timestamp: number;
  userAnswers: number[];
  score: number;
  totalQuestions: number;
  feedback: string;
  emotionData?: {
    avgConfidence: number;
    primaryEmotions: Emotion[];
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Types from gemini.functions.ts
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
