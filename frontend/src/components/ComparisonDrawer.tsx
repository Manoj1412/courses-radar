import { X, ExternalLink, ThumbsUp, Eye, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { VideoResult } from "@/lib/types";
import { formatViews, getScoreColor } from "@/lib/ranking";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ComparisonDrawerProps {
  videos: VideoResult[];
  isOpen: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}

export function ComparisonDrawer({ videos, isOpen, onClose, onRemove }: ComparisonDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && videos.length > 0 && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 glass-panel rounded-t-2xl max-h-[50vh] overflow-auto"
        >
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-foreground">
                Compare ({videos.length}/3)
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div key={video.id} className="bg-card rounded-xl p-4 space-y-3 border border-border">
                  <div className="flex gap-3">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-24 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-card-foreground line-clamp-2">{video.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{video.channelName}</p>
                    </div>
                    <button
                      onClick={() => onRemove(video.id)}
                      className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <Separator className="bg-border" />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      <span>{formatViews(video.views)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ThumbsUp className="h-3 w-3" />
                      <span>{video.likeRatio.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      <span>{video.sentimentScore}%</span>
                    </div>
                    <div>
                      <span className={`font-bold ${getScoreColor(video.overallScore)}`}>
                        Score: {video.overallScore}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Watch on YouTube
                  </a>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
