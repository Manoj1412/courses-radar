import React, { useEffect, useRef, useState, useCallback } from "react";
import { useEmotionDetector } from "@/hooks/useEmotionDetector";
import { getRelatedVideosFn } from "@/lib/youtube.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  X,
  SwitchCamera,
  AlertCircle,
  Video,
  Webcam,
  Maximize2,
  Minimize2,
  Bot,
  Sparkles,
  PauseCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { VideoResult, Emotion } from "@/lib/types";
import { EMOTION_EMOJIS, EMOTION_COLORS } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { AIChatbotPanel } from "@/components/AIChatbotPanel";
import { UnderstandingFeedback } from "@/components/UnderstandingFeedback";

interface VideoPlayerProps {
  videoId: string;
  title: string;
  rankedVideos?: VideoResult[];
  onClose: () => void;
  onSwitchVideo?: (newId: string) => void;
}

// YouTube IFrame API loader (singleton)
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("SSR"));
  if ((window as any).YT && (window as any).YT.Player) {
    return Promise.resolve((window as any).YT);
  }
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve((window as any).YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

const NO_FACE_PAUSE_MS = 2500; // auto-pause after 2.5s no face

export function VideoPlayer({
  videoId,
  title,
  onClose,
  onSwitchVideo,
}: VideoPlayerProps) {
  const emotionDetector = useEmotionDetector();
  const getRelatedVideos = useServerFn(getRelatedVideosFn);
  const [relatedVideos, setRelatedVideos] = useState<VideoResult[]>([]);
  const [showRelated, setShowRelated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEmotionBad, setIsEmotionBad] = useState(false);
  const [badEmotion, setBadEmotion] = useState<Emotion | null>(null);
  const [lowConfidenceAlert, setLowConfidenceAlert] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Auto-pause state
  const [autoPaused, setAutoPaused] = useState(false);
  const [showPauseToast, setShowPauseToast] = useState(false);
  const pauseToastTimerRef = useRef<number | null>(null);

  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const isPlayingRef = useRef(false);
  const noFaceSinceRef = useRef<number | null>(null);

  // Aggregation refs (not state to avoid re-renders)
  const emotionCountsRef = useRef<Record<string, number>>({});
  const awayCountRef = useRef(0);
  const playedStartRef = useRef<number | null>(null);
  const playedTotalRef = useRef(0); // seconds
  const confidenceSumRef = useRef(0);
  const confidenceSamplesRef = useRef(0);

  // Final stats snapshot
  const [finalStats, setFinalStats] = useState<{
    emotionCounts: Record<string, number>;
    totalSeconds: number;
    awayCount: number;
    avgConfidence: number;
  } | null>(null);

  /* ---- Start camera on mount ---- */
  useEffect(() => {
    if (emotionDetector.modelsLoaded) {
      emotionDetector.startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotionDetector.modelsLoaded]);

  /* ---- Create YT player ---- */
  useEffect(() => {
    let destroyed = false;
    (async () => {
      try {
        const YT = await loadYouTubeAPI();
        if (destroyed || !playerContainerRef.current) return;
        playerRef.current = new YT.Player(playerContainerRef.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              try {
                playerRef.current?.playVideo?.();
              } catch {}
            },
            onStateChange: (e: any) => {
              // 1 = playing, 2 = paused, 0 = ended
              if (e.data === 1) {
                isPlayingRef.current = true;
                playedStartRef.current = Date.now();
              } else {
                if (isPlayingRef.current && playedStartRef.current) {
                  playedTotalRef.current +=
                    (Date.now() - playedStartRef.current) / 1000;
                  playedStartRef.current = null;
                }
                isPlayingRef.current = false;
              }
              if (e.data === 0) {
                // Ended -> show feedback automatically
                captureFinalStats();
                setShowFeedback(true);
              }
            },
          },
        });
      } catch (err) {
        console.error("Failed to load YouTube API:", err);
      }
    })();
    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  /* ---- Bad emotion + shouldSuggestSwitch monitoring ---- */
  useEffect(() => {
    const id = setInterval(() => {
      const primary = emotionDetector.getPrimaryEmotion();
      if (primary) {
        const bad = emotionDetector.isBadEmotion(
          primary.emotion,
          primary.confidence
        );
        setIsEmotionBad(bad);
        if (bad) setBadEmotion(primary.emotion);
      } else {
        setIsEmotionBad(false);
        setBadEmotion(null);
      }
    }, 500);
    return () => clearInterval(id);
  }, [emotionDetector]);

  useEffect(() => {
    if (emotionDetector.shouldSuggestSwitch && !lowConfidenceAlert) {
      setLowConfidenceAlert(true);
    }
  }, [emotionDetector.shouldSuggestSwitch, lowConfidenceAlert]);

  /* ---- Emotion aggregation + presence (auto-pause/resume) ---- */
  useEffect(() => {
    const id = setInterval(() => {
      const detections = emotionDetector.detections;
      const streaming = emotionDetector.streaming;
      const now = Date.now();

      if (!streaming) return;

      if (detections.length === 0) {
        // No face
        if (noFaceSinceRef.current === null) {
          noFaceSinceRef.current = now;
        } else if (
          isPlayingRef.current &&
          !autoPaused &&
          now - noFaceSinceRef.current >= NO_FACE_PAUSE_MS
        ) {
          // Auto-pause
          try {
            playerRef.current?.pauseVideo?.();
          } catch {}
          setAutoPaused(true);
          awayCountRef.current += 1;
          setShowPauseToast(true);
          if (pauseToastTimerRef.current)
            clearTimeout(pauseToastTimerRef.current);
        }
      } else {
        // Face present
        if (autoPaused) {
          // Auto-resume
          try {
            playerRef.current?.playVideo?.();
          } catch {}
          setAutoPaused(false);
          setShowPauseToast(false);
        } else if (showPauseToast) {
          // clear toast after resume is confirmed by playing state
          setShowPauseToast(false);
        }
        noFaceSinceRef.current = null;

        // Aggregate emotion samples ONLY while playing
        if (isPlayingRef.current) {
          const primary = detections[0];
          emotionCountsRef.current[primary.emotion] =
            (emotionCountsRef.current[primary.emotion] || 0) + 1;
          confidenceSumRef.current += primary.confidence;
          confidenceSamplesRef.current += 1;
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [
    emotionDetector.detections,
    emotionDetector.streaming,
    autoPaused,
    showPauseToast,
  ]);

  const captureFinalStats = useCallback(() => {
    // If still playing, flush the running time
    if (isPlayingRef.current && playedStartRef.current) {
      playedTotalRef.current += (Date.now() - playedStartRef.current) / 1000;
      playedStartRef.current = Date.now();
    }
    const avg =
      confidenceSamplesRef.current > 0
        ? confidenceSumRef.current / confidenceSamplesRef.current
        : 0;
    setFinalStats({
      emotionCounts: { ...emotionCountsRef.current },
      totalSeconds: playedTotalRef.current,
      awayCount: awayCountRef.current,
      avgConfidence: avg,
    });
  }, []);

  /* ---- Fullscreen ---- */
  const toggleFullscreen = async () => {
    if (!playerWrapperRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    try {
      await playerWrapperRef.current.requestFullscreen();
    } catch (err) {
      console.error("Failed to enter fullscreen:", err);
    }
  };

  useEffect(() => {
    const handle = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

  /* ---- Related videos ---- */
  const loadRelatedVideos = useCallback(async () => {
    try {
      const result = await getRelatedVideos({ data: { videoId } });
      if (result.error) {
        console.error("Related videos error:", result.error);
      } else {
        setRelatedVideos(result.videos);
        setShowRelated(true);
      }
    } catch (err) {
      console.error("Failed to load related videos:", err);
    }
  }, [getRelatedVideos, videoId]);

  const handleSelectRelated = (newId: string) => {
    onSwitchVideo?.(newId);
    setShowRelated(false);
    setIsEmotionBad(false);
    setLowConfidenceAlert(false);
  };

  const handleClosePlayer = () => {
    emotionDetector.stopCamera();
    onClose();
  };

  const handleShowFeedback = () => {
    captureFinalStats();
    setShowFeedback(true);
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) handleClosePlayer(); }}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] p-0 flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold line-clamp-1">
              {title}
            </DialogTitle>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowFeedback}
                className="hidden sm:flex items-center gap-1"
                title="Get understanding feedback"
              >
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="hidden md:inline">Feedback</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setChatOpen((o) => !o)}
                className="relative"
                title="AI Study Buddy"
              >
                <Bot className="h-5 w-5 text-purple-600" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                </span>
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClosePlayer}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 p-4">
          {/* Player */}
          <div
            ref={playerWrapperRef}
            className="flex-1 relative bg-black rounded-lg overflow-hidden aspect-video lg:aspect-auto min-h-[300px]"
          >
            <div
              ref={playerContainerRef}
              className="absolute inset-0 w-full h-full"
            />

            {/* Auto-pause overlay */}
            <AnimatePresence>
              {autoPaused && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 z-40 backdrop-blur-xs"
                >
                  <div className="rounded-full bg-orange-500/20 p-4">
                    <EyeOff className="h-10 w-10 text-orange-400" />
                  </div>
                  <p className="text-white text-lg font-semibold">
                    Video paused
                  </p>
                  <p className="text-white/70 text-sm">
                    We lost sight of you. Come back to resume!
                  </p>
                  <Button
                    onClick={() => {
                      try {
                        playerRef.current?.playVideo?.();
                      } catch {}
                      setAutoPaused(false);
                    }}
                    variant="secondary"
                    size="sm"
                    className="mt-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Resume anyway
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Auto-resume toast */}
            <AnimatePresence>
              {showPauseToast && !autoPaused && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-500/90 text-white text-xs px-3 py-1.5 rounded-full z-40 flex items-center gap-1 shadow-lg"
                >
                  <Eye className="h-3 w-3" />
                  Welcome back — resuming
                </motion.div>
              )}
            </AnimatePresence>

            {/* Existing bad-emotion + low-confidence alerts */}
            <AnimatePresence>
              {!autoPaused && ((isEmotionBad && badEmotion) || lowConfidenceAlert) ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent flex flex-col justify-end p-6 gap-4 z-30 pointer-events-none"
                >
                  {lowConfidenceAlert ? (
                    <div className="pointer-events-auto">
                      <div className="flex items-center gap-3 text-orange-400 bg-black/50 p-4 rounded-lg mb-3">
                        <AlertCircle className="h-6 w-6 shrink-0" />
                        <span className="text-lg font-semibold">
                          Confused or bored?
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => setLowConfidenceAlert(false)}
                          size="lg"
                          variant="secondary"
                        >
                          Continue
                        </Button>
                        <Button
                          variant="default"
                          onClick={loadRelatedVideos}
                          size="lg"
                          className="flex items-center gap-2"
                        >
                          <SwitchCamera className="h-4 w-4" />
                          Try Another
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setChatOpen(true)}
                          size="lg"
                          className="flex items-center gap-2"
                        >
                          <Bot className="h-4 w-4" />
                          Ask AI
                        </Button>
                      </div>
                    </div>
                  ) : isEmotionBad && badEmotion ? (
                    <div className="pointer-events-auto">
                      <div className="flex items-center gap-3 text-yellow-400 bg-black/50 p-4 rounded-lg mb-3">
                        <AlertCircle className="h-6 w-6 shrink-0" />
                        <span className="text-lg font-semibold">
                          You look {badEmotion} {EMOTION_EMOJIS[badEmotion]}{" "}
                          - want to try another video?
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => setIsEmotionBad(false)}
                          size="lg"
                          variant="secondary"
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="default"
                          onClick={loadRelatedVideos}
                          size="lg"
                          className="flex items-center gap-2"
                        >
                          <SwitchCamera className="h-4 w-4" />
                          Related Videos
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Webcam & Emotion Panel */}
          <div className="lg:w-72 flex flex-col gap-4">
            <div className="glass-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                <Webcam className="h-4 w-4" />
                Live Emotion Monitor{" "}
                {emotionDetector.modelsLoaded ? "✅" : "⏳"}
              </div>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-3">
                <video
                  ref={emotionDetector.videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas
                  ref={emotionDetector.canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
                {emotionDetector.error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-destructive text-xs p-2 text-center">
                    {emotionDetector.error}
                  </div>
                )}
                {!emotionDetector.streaming && !emotionDetector.error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-muted-foreground text-xs">
                    Starting camera...
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Status:{" "}
                    {emotionDetector.streaming ? "🟢 Live" : "🟡 Starting"}
                  </span>
                  <span>Faces: {emotionDetector.detections.length}</span>
                </div>
                {emotionDetector.detections.length > 0 ? (
                  emotionDetector.detections.map((det, i) => (
                    <div
                      key={i}
                      className="bg-secondary/60 rounded p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{det.name}</span>
                        <span className="text-lg">
                          {EMOTION_EMOJIS[det.emotion]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${det.confidence * 100}%`,
                              backgroundColor: EMOTION_COLORS[det.emotion],
                            }}
                          />
                        </div>
                        <span className="w-8 text-right">
                          {Math.round(det.confidence * 100)}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {det.emotion}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground italic text-center py-2">
                    {autoPaused
                      ? "No face — video paused"
                      : "Searching for face..."}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile feedback button */}
            <Button
              variant="outline"
              onClick={handleShowFeedback}
              className="sm:hidden flex items-center gap-1"
            >
              <Sparkles className="h-4 w-4 text-purple-500" />
              Get Feedback
            </Button>
          </div>
        </div>

        {/* Related Videos Modal */}
        <AnimatePresence>
          {showRelated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-card rounded-lg p-6 max-h-96 overflow-y-auto max-w-2xl w-full mx-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Related Videos</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowRelated(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {relatedVideos.length > 0 ? (
                    relatedVideos.map((video) => (
                      <button
                        key={video.id}
                        onClick={() => handleSelectRelated(video.id)}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-secondary/80 transition-colors"
                      >
                        <div className="flex gap-3">
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-24 h-16 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium line-clamp-2 text-sm">
                              {video.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {video.channelName}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No related videos found
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Chatbot Panel */}
        <AIChatbotPanel
          videoId={videoId}
          title={title}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />

        {/* Understanding Feedback */}
        {showFeedback && finalStats && (
          <UnderstandingFeedback
            open={showFeedback}
            title={title}
            stats={finalStats}
            onClose={() => setShowFeedback(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
