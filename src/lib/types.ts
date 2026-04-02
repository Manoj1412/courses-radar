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

export interface Filters {
  duration: "all" | "short" | "medium" | "long";
  minLikeRatio: number;
}

export interface Weights {
  likeRatio: number;
  sentiment: number;
  views: number;
  recency: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  likeRatio: 0.35,
  sentiment: 0.25,
  views: 0.15,
  recency: 0.25,
};

export const LANGUAGES = [
  "All",
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Bengali",
  "Marathi",
  "Kannada",
  "Malayalam",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
];
