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
}

export type SortOption = "likes" | "popularity" | "positive-comments" | "recent";

export const LANGUAGES = ["All", "English", "Hindi", "Telugu"];
