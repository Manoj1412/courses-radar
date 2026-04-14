

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { VideoResult } from '@/lib/types';

const searchInputSchema = z.object({
  query: z.string().min(1),
  language: z.string().default("All"),
});

export const searchYouTubeVideosFn = createServerFn()
  .inputValidator((input: unknown) => searchInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ videos: VideoResult[]; totalCount: number; error: string | null }> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return { videos: [], totalCount: 0, error: "YouTube API key is not configured." };
    }

    try {
      // Map language to relevanceLanguage code
      const langMap: Record<string, string> = {
        English: "en",
        Hindi: "hi",
        Telugu: "te",
      };
      const relevanceLang = langMap[data.language] || "";

      // Step 1: Search for videos
      // Build search query with language hint in query itself for better filtering
      let searchQuery = data.query;
      if (data.language !== "All" && data.language !== "English") {
        searchQuery = `${data.query} ${data.language}`;
      }

      const searchParams = new URLSearchParams({
        part: "snippet",
        q: searchQuery,
        type: "video",
        videoDuration: "long",
        maxResults: "15",
        order: "relevance",
        key: apiKey,
      });
      if (relevanceLang) {
        searchParams.set("relevanceLanguage", relevanceLang);
      }

      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${searchParams}`
      );
      if (!searchRes.ok) {
        const errBody = await searchRes.text();
        console.error(`YouTube search API error [${searchRes.status}]: ${errBody}`);
        if (searchRes.status === 403) {
          return { videos: [], totalCount: 0, error: "YouTube API quota exceeded. Please try again later." };
        }
        return { videos: [], totalCount: 0, error: `YouTube API error (${searchRes.status})` };
      }

      const searchData = await searchRes.json();

      const videoIds: string[] = searchData.items?.map(
        (item: any) => item.id.videoId
      ) || [];

      if (videoIds.length === 0) {
        const totalCount = searchData.pageInfo?.totalResults ?? searchData.items?.length ?? 0;
        return { videos: [], totalCount, error: null };
      }

      // Step 2: Get video details (statistics + contentDetails)
      const detailsParams = new URLSearchParams({
        part: "snippet,statistics,contentDetails",
        id: videoIds.join(","),
        key: apiKey,
      });

      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`
      );
      if (!detailsRes.ok) {
        return { videos: [], totalCount: 0, error: "Failed to fetch video details." };
      }

      const detailsData = await detailsRes.json();

      // Step 3: Get channel details for subscriber counts
      const channelIds = [
        ...new Set(
          detailsData.items?.map((item: any) => item.snippet.channelId) || []
        ),
      ];

      let channelMap: Record<string, { subscriberCount: number; publishedAt: string }> = {};

      if (channelIds.length > 0) {
        const channelParams = new URLSearchParams({
          part: "statistics,snippet",
          id: (channelIds as string[]).join(","),
          key: apiKey,
        });
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?${channelParams}`
        );
        if (channelRes.ok) {
          const channelData = await channelRes.json();
          for (const ch of channelData.items || []) {
            const createdAt = new Date(ch.snippet.publishedAt);
            const ageYears = Math.max(
              1,
              Math.floor(
                (Date.now() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
              )
            );
            channelMap[ch.id] = {
              subscriberCount: Number(ch.statistics.subscriberCount) || 0,
              publishedAt: ch.snippet.publishedAt,
            };
          }
        }
      }

      // Step 4: Transform into VideoResult[]
      const videos: VideoResult[] = (detailsData.items || []).map(
        (item: any) => {
          const stats = item.statistics;
          const views = Number(stats.viewCount) || 0;
          const likes = Number(stats.likeCount) || 0;
          const likeRatio = views > 0 ? (likes / views) * 100 : 0;
          const durationSeconds = parseDuration(item.contentDetails.duration);
          const channel = channelMap[item.snippet.channelId] || {
            subscriberCount: 0,
            publishedAt: item.snippet.publishedAt,
          };
          const channelAge = Math.max(
            1,
            Math.floor(
              (Date.now() - new Date(channel.publishedAt).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          );

          // Simple sentiment placeholder (real sentiment would need comment analysis)
          const sentimentScore = Math.min(
            100,
            Math.round(50 + likeRatio * 8 + Math.random() * 10)
          );

          const overallScore = Math.round(
            likeRatio * 10 + sentimentScore * 0.3 + Math.min(views / 100000, 20)
          );

          return {
            id: item.id,
            title: item.snippet.title,
            channelName: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            thumbnail: item.snippet.thumbnails?.high?.url ||
              item.snippet.thumbnails?.medium?.url ||
              item.snippet.thumbnails?.default?.url || "",
            duration: formatDuration(durationSeconds),
            durationSeconds,
            views,
            likes,
            likeRatio,
            sentimentScore,
            syllabusMatch: 0,
            overallScore: Math.min(100, overallScore),
            publishedAt: item.snippet.publishedAt?.slice(0, 10) || "",
            isPlaylist: false,
            subscriberCount: channel.subscriberCount,
            channelAgeYears: channelAge,
            description: item.snippet.description || "",
            topicsDetected: extractTopics(item.snippet.description || ""),
          } satisfies VideoResult;
        }
      );

      const totalCount = searchData.pageInfo?.totalResults ?? searchData.items?.length ?? 0;
      return { videos, totalCount, error: null };
    } catch (err) {
      console.error("YouTube search failed:", err);
      return { videos: [], totalCount: 0, error: "Something went wrong. Please try again." };
    }
  });

function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = Number(match[1]) || 0;
  const m = Number(match[2]) || 0;
  const s = Number(match[3]) || 0;
  return h * 3600 + m * 60 + s;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function extractTopics(description: string): string[] {
  const keywords = [
    "OOP", "DSA", "Data Structures", "Algorithms", "Arrays", "Strings",
    "Linked List", "Trees", "Graphs", "Dynamic Programming", "Recursion",
    "Sorting", "Searching", "Database", "SQL", "API", "REST", "Spring",
    "Spring Boot", "React", "Node", "Python", "Java", "JavaScript",
    "TypeScript", "HTML", "CSS", "Machine Learning", "AI", "Deep Learning",
    "Neural Networks", "NLP", "Computer Vision", "Web Development",
    "Frontend", "Backend", "Full Stack", "DevOps", "Docker", "Kubernetes",
    "Git", "MongoDB", "PostgreSQL", "MySQL", "Redis", "AWS", "Cloud",
    "Microservices", "Design Patterns", "JDBC", "Collections",
    "Multithreading", "Exception Handling", "File I/O", "Lambda",
    "Variables", "Loops", "Methods", "Functions", "Classes", "Inheritance",
  ];
  const descLower = description.toLowerCase();
  return keywords.filter((k) => descLower.includes(k.toLowerCase())).slice(0, 8);
}

const relatedInputSchema = z.object({
  videoId: z.string().min(1),
});

export const getRelatedVideosFn = createServerFn()
  .inputValidator((input: unknown) => relatedInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ videos: VideoResult[]; totalCount: number; error: string | null }> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return { videos: [], totalCount: 0, error: "YouTube API key is not configured." };
    }

    try {
      // First, get the current video details to extract keywords
      const videoParams = new URLSearchParams({
        part: "snippet",
        id: data.videoId,
        key: apiKey,
      });

      const videoRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${videoParams}`
      );
      if (!videoRes.ok) {
        return { videos: [], totalCount: 0, error: "Failed to fetch video details." };
      }

      const videoData = await videoRes.json();
      const video = videoData.items?.[0];
      if (!video) {
        return { videos: [], totalCount: 0, error: "Video not found." };
      }

      // Extract keywords from title and description
      const title = video.snippet.title;
      const description = video.snippet.description || "";
      const keywords = extractTopics(`${title} ${description}`);
      
      // Create search query from keywords
      const searchQuery = keywords.slice(0, 3).join(" "); // Use first 3 keywords

      const searchParams = new URLSearchParams({
        part: "snippet",
        q: searchQuery,
        type: "video",
        videoDuration: "long",
        maxResults: "6", // Get 6 to account for filtering out current video
        order: "relevance",
        key: apiKey,
      });

      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${searchParams}`
      );
      if (!searchRes.ok) {
        const errBody = await searchRes.text();
        console.error(`YouTube related search API error [${searchRes.status}]: ${errBody}`);
        if (searchRes.status === 403) {
          return { videos: [], totalCount: 0, error: "YouTube API quota exceeded. Please try again later." };
        }
        return { videos: [], totalCount: 0, error: `YouTube API error (${searchRes.status})` };
      }

      const searchData = await searchRes.json();
      const videoIds: string[] = searchData.items
        ?.map((item: any) => item.id.videoId)
        .filter((id: string) => id !== data.videoId) || []; // Exclude current video

      if (videoIds.length === 0) {
        const totalCount = searchData.pageInfo?.totalResults || 0;
        return { videos: [], totalCount, error: null };
      }

      // Reuse same details/channel logic from searchYouTubeVideosFn
      const detailsParams = new URLSearchParams({
        part: "snippet,statistics,contentDetails",
        id: videoIds.join(","),
        key: apiKey,
      });

      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`
      );
      if (!detailsRes.ok) {
        return { videos: [], totalCount: 0, error: "Failed to fetch video details." };
      }

      const detailsData = await detailsRes.json();

      const channelIds = [...new Set(detailsData.items?.map((item: any) => item.snippet.channelId) || [])];

      let channelMap: Record<string, { subscriberCount: number; publishedAt: string }> = {};

      if (channelIds.length > 0) {
        const channelParams = new URLSearchParams({
          part: "statistics,snippet",
          id: (channelIds as string[]).join(","),
          key: apiKey,
        });
        const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`);
        if (channelRes.ok) {
          const channelData = await channelRes.json();
          for (const ch of channelData.items || []) {
            const createdAt = new Date(ch.snippet.publishedAt);
            const ageYears = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
            channelMap[ch.id] = {
              subscriberCount: Number(ch.statistics.subscriberCount) || 0,
              publishedAt: ch.snippet.publishedAt,
            };
          }
        }
      }

      const videos: VideoResult[] = (detailsData.items || [])
        .map((item: any) => {
          const stats = item.statistics;
          const views = Number(stats?.viewCount) || 0;
          const likes = Number(stats?.likeCount) || 0;
          const likeRatio = views > 0 ? (likes / views) * 100 : 0;
          const durationSeconds = parseDuration(item.contentDetails.duration);
          const channel = channelMap[item.snippet.channelId] || {
            subscriberCount: 0,
            publishedAt: item.snippet.publishedAt,
          };
          const channelAge = Math.max(1, Math.floor((Date.now() - new Date(channel.publishedAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));

          const sentimentScore = Math.min(100, Math.round(50 + likeRatio * 8 + Math.random() * 10));
          const overallScore = Math.round(likeRatio * 10 + sentimentScore * 0.3 + Math.min(views / 100000, 20));

          return {
            id: item.id,
            title: item.snippet.title,
            channelName: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
            duration: formatDuration(durationSeconds),
            durationSeconds,
            views,
            likes,
            likeRatio,
            sentimentScore,
            syllabusMatch: 0,
            overallScore: Math.min(100, overallScore),
            publishedAt: item.snippet.publishedAt?.slice(0, 10) || "",
            isPlaylist: false,
            subscriberCount: channel.subscriberCount,
            channelAgeYears: channelAge,
            description: item.snippet.description || "",
            topicsDetected: extractTopics(item.snippet.description || ""),
          } satisfies VideoResult;
        })
        .slice(0, 3);  // Top 3 related

      const totalCount = searchData.pageInfo?.totalResults || 0;
      return { videos, totalCount, error: null };
    } catch (err) {
      console.error("YouTube related videos failed:", err);
      return { videos: [], totalCount: 0, error: "Something went wrong. Please try again." };
    }
  });
