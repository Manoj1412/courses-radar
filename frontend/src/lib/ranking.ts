import type { VideoResult, SortOption } from "./types";

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function recencyScore(publishedAt: string): number {
  const daysSince = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - daysSince / 1095);
}

export function sortVideos(videos: VideoResult[], sortBy: SortOption): VideoResult[] {
  if (videos.length === 0) return [];

  return [...videos].sort((a, b) => {
    switch (sortBy) {
      case "likes":
        return b.likeRatio - a.likeRatio;
      case "popularity":
        return b.views - a.views;
      case "positive-comments":
        return b.sentimentScore - a.sentimentScore;
      case "recent":
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      default:
        return 0;
    }
  });
}

export function filterVideos(
  videos: VideoResult[],
  filters: { duration: string }
): VideoResult[] {
  return videos.filter((v) => {
    if (filters.duration === "short" && v.durationSeconds > 5 * 3600) return false;
    if (filters.duration === "medium" && (v.durationSeconds < 5 * 3600 || v.durationSeconds > 15 * 3600)) return false;
    if (filters.duration === "long" && v.durationSeconds < 15 * 3600) return false;
    return true;
  });
}

export function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

export function getScoreColor(score: number): string {
  if (score >= 75) return "text-score-high";
  if (score >= 50) return "text-score-medium";
  return "text-score-low";
}

export function getScoreBg(score: number): string {
  if (score >= 75) return "bg-score-high";
  if (score >= 50) return "bg-score-medium";
  return "bg-score-low";
}
