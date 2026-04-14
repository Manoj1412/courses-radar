import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEmotionDetector } from '@/hooks/useEmotionDetector';
import { getRelatedVideosFn } from '@/lib/youtube.functions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, SwitchCamera, AlertCircle, Video, Webcam, Maximize2, Minimize2 } from 'lucide-react';
import { VideoResult, Emotion } from '@/lib/types';
import { EMOTION_EMOJIS, EMOTION_COLORS } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useServerFn } from '@tanstack/react-start';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  rankedVideos?: VideoResult[];
  onClose: () => void;
  onSwitchVideo?: (newId: string) => void;
}

export function VideoPlayer({ videoId, title, rankedVideos, onClose, onSwitchVideo }: VideoPlayerProps) {
  const emotionDetector = useEmotionDetector();
  const getRelatedVideos = useServerFn(getRelatedVideosFn);
  const [relatedVideos, setRelatedVideos] = useState<VideoResult[]>([]);
  const [showRelated, setShowRelated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEmotionBad, setIsEmotionBad] = useState(false);
  const [badEmotion, setBadEmotion] = useState<Emotion | null>(null);
  const [lowConfidenceAlert, setLowConfidenceAlert] = useState(false);
  const playerWrapperRef = useRef<HTMLDivElement>(null);

  // Auto start emotion detection on mount
  useEffect(() => {
    setIsReady(true);
    if (emotionDetector.modelsLoaded) {
      emotionDetector.startCamera();
    }
  }, [emotionDetector.modelsLoaded]);

  // Check for bad emotions periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const primary = emotionDetector.getPrimaryEmotion();
      if (primary) {
        const isBad = emotionDetector.isBadEmotion(primary.emotion, primary.confidence);
        setIsEmotionBad(isBad);
        if (isBad) {
          setBadEmotion(primary.emotion);
        }
      } else {
        setIsEmotionBad(false);
        setBadEmotion(null);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [emotionDetector]);

  // Monitor low confidence for video switching
  useEffect(() => {
    if (emotionDetector.shouldSuggestSwitch && !lowConfidenceAlert) {
      setLowConfidenceAlert(true);
    }
  }, [emotionDetector.shouldSuggestSwitch, lowConfidenceAlert]);

  const toggleFullscreen = async () => {
    if (!playerWrapperRef.current) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    try {
      await playerWrapperRef.current.requestFullscreen();
    } catch (err) {
      console.error('Failed to enter fullscreen:', err);
    }
  };

  // Detect fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load related videos for switch
  const loadRelatedVideos = useCallback(async () => {
    try {
      const result = await getRelatedVideos({ data: { videoId } });
      if (result.error) {
        console.error('Related videos error:', result.error);
      } else {
        setRelatedVideos(result.videos);
        setShowRelated(true);
      }
    } catch (err) {
      console.error('Failed to load related videos:', err);
    }
  }, [getRelatedVideos, videoId]);

  const handleRepeat = () => {
    // With iframe embed, we can't control playback
    // Just dismiss the emotion alert
    setIsEmotionBad(false);
  };

  const handleSwitch = async () => {
    await loadRelatedVideos();
  };

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

  return (
    <Dialog open={true} onOpenChange={handleClosePlayer}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold line-clamp-1">{title}</DialogTitle>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClosePlayer}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 p-4">
          {/* Player */}
            <div ref={playerWrapperRef} className="flex-1 relative bg-black rounded-lg overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <AnimatePresence>
              {(isEmotionBad && badEmotion) || lowConfidenceAlert ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent flex flex-col justify-end p-6 gap-4 z-50"
                >
                  {lowConfidenceAlert ? (
                    <>
                      <div className="flex items-center gap-3 text-orange-400 bg-black/50 p-4 rounded-lg">
                        <AlertCircle className="h-6 w-6 shrink-0" />
                        <span className="text-lg font-semibold">
                          Confused or bored?
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={() => setLowConfidenceAlert(false)} size="lg" variant="secondary" className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Continue Watching
                        </Button>
                        <Button variant="default" onClick={handleSwitch} size="lg" className="flex items-center gap-2">
                          <SwitchCamera className="h-4 w-4" />
                          Try Another Video
                        </Button>
                      </div>
                    </>
                  ) : isEmotionBad && badEmotion ? (
                    <>
                      <div className="flex items-center gap-3 text-yellow-400 bg-black/50 p-4 rounded-lg">
                        <AlertCircle className="h-6 w-6 shrink-0" />
                        <span className="text-lg font-semibold">
                          You look {badEmotion} {EMOTION_EMOJIS[badEmotion]} - want to try another video?
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={handleRepeat} size="lg" variant="secondary" className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Dismiss
                        </Button>
                        <Button variant="default" onClick={handleSwitch} size="lg" className="flex items-center gap-2">
                          <SwitchCamera className="h-4 w-4" />
                          Show Related Videos
                        </Button>
                      </div>
                    </>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Webcam & Emotion Panel */}
          <div className="lg:w-72 flex flex-col gap-4">
            {/* Emotion Monitor */}
            <div className="glass-card p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                <Webcam className="h-4 w-4" />
                Live Emotion Monitor {emotionDetector.modelsLoaded ? "✅" : "⏳"}
              </div>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-3">
                <video
                  ref={emotionDetector.videoRef}
                  className="w-full h-full object-cover"
                  autoPlay muted playsInline
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
              
              {/* Detection Info */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Status: {emotionDetector.streaming ? "🟢 Live" : "🟡 Starting"}</span>
                  <span>Faces: {emotionDetector.detections.length}</span>
                </div>
                
                {emotionDetector.detections.length > 0 ? (
                  emotionDetector.detections.map((det, i) => (
                    <div key={i} className="bg-secondary/60 rounded p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{det.name}</span>
                        <span className="text-lg">{EMOTION_EMOJIS[det.emotion]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all" 
                            style={{ 
                              width: `${det.confidence * 100}%`,
                              backgroundColor: EMOTION_COLORS[det.emotion]
                            }} 
                          />
                        </div>
                        <span className="w-8 text-right">{Math.round(det.confidence * 100)}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">{det.emotion}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground italic text-center py-2">Searching for face...</div>
                )}
              </div>
            </div>
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
                  <Button variant="ghost" size="icon" onClick={() => setShowRelated(false)}>
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
                            <p className="font-medium line-clamp-2 text-sm">{video.title}</p>
                            <p className="text-xs text-muted-foreground">{video.channelName}</p>
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              <span>👁 {(video.views / 1000000).toFixed(1)}M</span>
                              <span>👍 {(video.likes / 1000).toFixed(0)}K</span>
                            </div>
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
      </DialogContent>
    </Dialog>
  );
}

