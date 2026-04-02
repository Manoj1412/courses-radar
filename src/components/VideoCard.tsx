import { Bookmark, BookmarkCheck, Eye, ThumbsUp, MessageSquare, Clock, Users, ListVideo } from "lucide-react";
import { motion } from "framer-motion";
import type { VideoResult } from "@/lib/types";
import { formatViews, getScoreColor } from "@/lib/ranking";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface VideoCardProps {
  video: VideoResult;
  rank: number;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  showSyllabusMatch: boolean;
}

export function VideoCard({ video, rank, isBookmarked, onToggleBookmark, showSyllabusMatch }: VideoCardProps) {
  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.05, duration: 0.3 }}
        className="card-glow rounded-xl overflow-hidden bg-card"
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Rank badge */}
          <div className="absolute top-2 left-2 rank-badge">#{rank}</div>
          {/* Duration */}
          <div className="absolute bottom-2 right-2 bg-background/90 text-foreground text-xs font-mono px-2 py-0.5 rounded">
            {video.duration}
          </div>
          {/* Playlist badge */}
          {video.isPlaylist && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-xs px-2 py-0.5 rounded">
              <ListVideo className="h-3 w-3" />
              Series
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-card-foreground">
            {video.title}
          </h3>

          {/* Channel */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{video.channelName}</span>
            <span className="text-border">•</span>
            <span>{formatViews(video.subscriberCount)} subs</span>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-1.5">
            <Tooltip>
              <TooltipTrigger>
                <span className="stat-chip">
                  <Eye className="h-3 w-3" />
                  {formatViews(video.views)}
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-popover border-border text-popover-foreground">
                {video.views.toLocaleString()} views
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <span className={`stat-chip ${video.likeRatio >= 4 ? "!bg-score-high/20 !text-score-high" : ""}`}>
                  <ThumbsUp className="h-3 w-3" />
                  {video.likeRatio.toFixed(1)}%
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-popover border-border text-popover-foreground">
                Like ratio: {video.likeRatio.toFixed(2)}% of viewers liked
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <span className={`stat-chip ${video.sentimentScore >= 80 ? "!bg-score-high/20 !text-score-high" : ""}`}>
                  <MessageSquare className="h-3 w-3" />
                  {video.sentimentScore}%
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-popover border-border text-popover-foreground">
                Comment sentiment: {video.sentimentScore}% positive
              </TooltipContent>
            </Tooltip>

            <span className="stat-chip">
              <Clock className="h-3 w-3" />
              {video.publishedAt.slice(0, 4)}
            </span>
          </div>

          {/* Syllabus match */}
          {showSyllabusMatch && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${video.syllabusMatch}%` }}
                />
              </div>
              <span className={`text-xs font-bold ${getScoreColor(video.syllabusMatch)}`}>
                {video.syllabusMatch}% match
              </span>
            </div>
          )}

          {/* Topics */}
          {video.topicsDetected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {video.topicsDetected.slice(0, 4).map((topic) => (
                <Badge
                  key={topic}
                  variant="secondary"
                  className="text-[0.65rem] bg-secondary text-secondary-foreground border-0"
                >
                  {topic}
                </Badge>
              ))}
              {video.topicsDetected.length > 4 && (
                <Badge variant="secondary" className="text-[0.65rem] bg-secondary text-secondary-foreground border-0">
                  +{video.topicsDetected.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* Footer: Score + Bookmark */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Score</span>
              <span className={`score-badge ${video.overallScore >= 80 ? "" : video.overallScore >= 60 ? "!bg-score-medium" : "!bg-score-low"}`}>
                {video.overallScore}
              </span>
            </div>
            <button
              onClick={() => onToggleBookmark(video.id)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-5 w-5 text-primary" />
              ) : (
                <Bookmark className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
