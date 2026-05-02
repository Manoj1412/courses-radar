import { useEffect, useState, useCallback } from "react";
import type { QuizAttempt, Emotion } from "@/lib/types";

const STORAGE_KEY = "quiz_attempts";
const MAX_ATTEMPTS_PER_VIDEO = 50;

export function useQuizTracking() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Load attempts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setAttempts(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load quiz attempts:", error);
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save attempts to localStorage
  const saveAttempt = useCallback(
    (attempt: QuizAttempt) => {
      setAttempts((prev) => {
        const updated = [attempt, ...prev];
        
        // Keep only latest attempts per video
        const videoAttempts = updated.reduce(
          (acc, att) => {
            const videoKey = att.videoId;
            if (!acc[videoKey]) {
              acc[videoKey] = [];
            }
            if (acc[videoKey].length < MAX_ATTEMPTS_PER_VIDEO) {
              acc[videoKey].push(att);
            }
            return acc;
          },
          {} as Record<string, QuizAttempt[]>
        );

        const filtered = Object.values(videoAttempts).flat();
        
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        } catch (error) {
          console.error("Failed to save quiz attempts:", error);
        }

        return filtered;
      });
    },
    []
  );

  // Get attempts for a specific video
  const getVideoAttempts = useCallback(
    (videoId: string): QuizAttempt[] => {
      return attempts.filter((a) => a.videoId === videoId);
    },
    [attempts]
  );

  // Get statistics for a specific video
  const getVideoStats = useCallback(
    (videoId: string) => {
      const videoAttempts = getVideoAttempts(videoId);
      
      if (videoAttempts.length === 0) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          highestScore: 0,
          lastAttempt: null,
          improvementTrend: 0,
        };
      }

      const scores = videoAttempts.map((a) => a.score);
      const averageScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );
      const highestScore = Math.max(...scores);
      const lastAttempt = videoAttempts[0];

      // Calculate improvement trend
      const improvementTrend =
        videoAttempts.length >= 2
          ? ((scores[0] - scores[scores.length - 1]) / scores[scores.length - 1]) * 100
          : 0;

      return {
        totalAttempts: videoAttempts.length,
        averageScore,
        highestScore,
        lastAttempt,
        improvementTrend: Math.round(improvementTrend),
      };
    },
    [getVideoAttempts]
  );

  // Get overall statistics across all videos
  const getOverallStats = useCallback(() => {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        totalVideos: 0,
        overallAverageScore: 0,
        bestPerformingVideo: null,
      };
    }

    const videoIds = new Set(attempts.map((a) => a.videoId));
    const scores = attempts.map((a) => a.score);
    const overallAverageScore = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );

    // Find best performing video
    const videoScores = Array.from(videoIds).map((videoId) => {
      const videoAttempts = attempts.filter((a) => a.videoId === videoId);
      const avgScore =
        videoAttempts.reduce((sum, a) => sum + a.score, 0) / videoAttempts.length;
      return { videoId, avgScore, title: videoAttempts[0]?.videoTitle };
    });

    const bestPerformingVideo = videoScores.length > 0
      ? videoScores.reduce((best, curr) => (curr.avgScore > best.avgScore ? curr : best))
      : null;

    return {
      totalAttempts: attempts.length,
      totalVideos: videoIds.size,
      overallAverageScore,
      bestPerformingVideo,
    };
  }, [attempts]);

  // Clear all attempts (for testing/reset)
  const clearAllAttempts = useCallback(() => {
    setAttempts([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear attempts:", error);
    }
  }, []);

  // Clear attempts for a specific video
  const clearVideoAttempts = useCallback((videoId: string) => {
    setAttempts((prev) => {
      const updated = prev.filter((a) => a.videoId !== videoId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to clear video attempts:", error);
      }
      return updated;
    });
  }, []);

  // Get emotion summary from attempts
  const getEmotionSummary = useCallback((videoId: string) => {
    const videoAttempts = getVideoAttempts(videoId);
    
    if (videoAttempts.length === 0) {
      return {
        avgConfidence: 0,
        commonEmotions: [] as Emotion[],
      };
    }

    const emotionCounts: Record<string, number> = {};
    let totalConfidence = 0;
    let confidenceCount = 0;

    videoAttempts.forEach((attempt) => {
      if (attempt.emotionData) {
        totalConfidence += attempt.emotionData.avgConfidence;
        confidenceCount++;
        attempt.emotionData.primaryEmotions.forEach((emotion) => {
          emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        });
      }
    });

    const commonEmotions = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emotion]) => emotion as Emotion);

    return {
      avgConfidence:
        confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0,
      commonEmotions,
    };
  }, [getVideoAttempts]);

  return {
    attempts,
    loading,
    saveAttempt,
    getVideoAttempts,
    getVideoStats,
    getOverallStats,
    clearAllAttempts,
    clearVideoAttempts,
    getEmotionSummary,
  };
}
