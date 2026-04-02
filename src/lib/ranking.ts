import type { VideoResult, Weights } from "./types";

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function recencyScore(publishedAt: string): number {
  const daysSince = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - daysSince / 1095); // 3-year decay
}

export function rankVideos(videos: VideoResult[], weights: Weights): VideoResult[] {
  if (videos.length === 0) return [];

  const maxViews = Math.max(...videos.map((v) => v.views));
  const minViews = Math.min(...videos.map((v) => v.views));

  return videos
    .map((video) => {
      const likeScore = normalize(video.likeRatio, 0, 8);
      const sentScore = normalize(video.sentimentScore, 0, 100);
      const viewScore = normalize(video.views, minViews, maxViews);
      const recScore = recencyScore(video.publishedAt);

      const total = weights.likeRatio + weights.sentiment + weights.views + weights.recency;
      const overallScore = Math.round(
        ((likeScore * weights.likeRatio +
          sentScore * weights.sentiment +
          viewScore * weights.views +
          recScore * weights.recency) /
          total) *
          100
      );

      return { ...video, overallScore };
    })
    .sort((a, b) => b.overallScore - a.overallScore);
}

export function filterVideos(
  videos: VideoResult[],
  filters: { duration: string; minLikeRatio: number }
): VideoResult[] {
  return videos.filter((v) => {
    if (filters.duration === "short" && v.durationSeconds > 5 * 3600) return false;
    if (filters.duration === "medium" && (v.durationSeconds < 5 * 3600 || v.durationSeconds > 15 * 3600)) return false;
    if (filters.duration === "long" && v.durationSeconds < 15 * 3600) return false;
    if (v.likeRatio < filters.minLikeRatio) return false;
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
