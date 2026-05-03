import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  Lightbulb,
  Eye,
  Timer,
  EyeOff,
} from "lucide-react";
import { understandingFeedback } from "@/lib/aiApi";
import { EMOTION_EMOJIS, EMOTION_COLORS } from "@/lib/constants";
import type { Emotion } from "@/lib/types";

interface EmotionStats {
  emotionCounts: Record<string, number>;
  totalSeconds: number;
  awayCount: number;
  avgConfidence: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  stats: EmotionStats;
}

export function UnderstandingFeedback({ open, onClose, title, stats }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    if (data) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await understandingFeedback({
          title,
          emotionCounts: stats.emotionCounts,
          totalSeconds: stats.totalSeconds,
          awayCount: stats.awayCount,
          avgConfidence: stats.avgConfidence,
        });
        if (cancelled) return;
        if (res.error) setError(res.error);
        else setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, title, stats, data]);

  const percentages: Record<string, number> = data?.percentages || {};
  const sortedEmotions = Object.entries(percentages).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Your Understanding Report
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">Analyzing your expressions...</p>
          </div>
        )}

        {error && (
          <div className="py-4 text-destructive text-sm">
            ⚠️ {error}
            <Button
              variant="link"
              onClick={() => {
                setData(null);
                setError(null);
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* Verdict + Score */}
            <div className="rounded-xl border p-5 bg-linear-to-br from-purple-500/10 via-blue-500/10 to-green-500/10 text-center">
              <div className="text-5xl font-bold mb-1">
                {data.score}
                <span className="text-xl text-muted-foreground">/100</span>
              </div>
              <div className="text-sm text-muted-foreground mb-2">
                Engagement Score
              </div>
              <div className="text-base font-semibold text-primary">
                {data.verdict}
              </div>
            </div>

            {/* Session stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3 flex items-center gap-2">
                <Timer className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-xs text-muted-foreground">
                    Watch time
                  </div>
                  <div className="text-sm font-semibold">
                    {formatTime(data.totalSeconds)}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border p-3 flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="text-xs text-muted-foreground">
                    Breaks taken
                  </div>
                  <div className="text-sm font-semibold">
                    {data.awayCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border p-4 text-sm">
              <div className="flex items-center gap-1.5 text-xs uppercase font-semibold text-muted-foreground mb-1.5">
                <Eye className="h-3.5 w-3.5" /> What we noticed
              </div>
              <p className="leading-relaxed">{data.summary}</p>
            </div>

            {/* Emotion distribution */}
            {sortedEmotions.length > 0 && (
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">
                  Emotion Distribution
                </div>
                <div className="space-y-2">
                  {sortedEmotions.slice(0, 5).map(([emotion, pct]) => (
                    <div key={emotion} className="text-xs">
                      <div className="flex justify-between mb-0.5">
                        <span className="capitalize flex items-center gap-1">
                          {EMOTION_EMOJIS[emotion as Emotion] || "•"} {emotion}
                        </span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              EMOTION_COLORS[emotion as Emotion] || "#888",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {data.strengths?.length > 0 && (
              <div className="rounded-lg border p-4 bg-green-500/5">
                <div className="flex items-center gap-1.5 text-xs uppercase font-semibold text-green-700 dark:text-green-400 mb-2">
                  <TrendingUp className="h-3.5 w-3.5" /> Strengths
                </div>
                <ul className="text-sm space-y-1">
                  {data.strengths.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-green-500">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {data.suggestions?.length > 0 && (
              <div className="rounded-lg border p-4 bg-blue-500/5">
                <div className="flex items-center gap-1.5 text-xs uppercase font-semibold text-blue-700 dark:text-blue-400 mb-2">
                  <Lightbulb className="h-3.5 w-3.5" /> Suggestions
                </div>
                <ul className="text-sm space-y-1">
                  {data.suggestions.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-blue-500">→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button className="w-full" onClick={onClose}>
              Got it!
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
