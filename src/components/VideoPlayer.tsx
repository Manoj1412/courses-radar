import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
// import * as faceapi from '@vladmandic/face-api';
// import * as tf from '@tensorflow/tfjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, RefreshCw, SwitchCamera, AlertCircle, Video, Webcam } from 'lucide-react';
import { VideoResult } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  rankedVideos?: VideoResult[];
  onClose: () => void;
  onSwitchVideo?: (newId: string) => void;
}

export function VideoPlayer({ videoId, title, rankedVideos, onClose, onSwitchVideo }: VideoPlayerProps) {
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEmotionBad, setIsEmotionBad] = useState(false);
  const [emotion, setEmotion] = useState('');
  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [hasCam, setHasCam] = useState(false);
  const detectInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    initModels();
    return () => {
      if (detectInterval.current) clearInterval(detectInterval.current);
    };
  }, []);

  const initModels = async () => {
    // Face-api disabled - TODO: CDN + public/models
    setModelsLoaded(true);
  };

  const initCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setHasCam(true);
        startDetection();
      }
    } catch (err) {
      console.error('Camera access denied', err);
    }
  };

  const startDetection = () => {
    // Face-api detection disabled
    console.log('Detection disabled');
  };

  const handleRepeat = () => {
    if (playerRef.current) {
      const player = playerRef.current.getInternalPlayer() as any;
      player.seekTo(Math.max(0, currentTime - 60));
    }
    setIsEmotionBad(false);
  };

  const handleSwitch = () => {
    if (onSwitchVideo && rankedVideos) {
      // Suggest next video (simple: first non-current)
      const nextId = rankedVideos.find(v => v.id !== videoId)?.id;
      if (nextId) onSwitchVideo(nextId);
    }
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold line-clamp-1">{title}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Player */}
          <div className="flex-1 relative bg-black">
            <ReactPlayer
              ref={playerRef}
              url={`https://www.youtube.com/watch?v=${videoId}`}
              width="100%"
              height="100%"
              controls={true}
              playing={isReady}
              onReady={() => setIsReady(true)}
              onProgress={(state) => setCurrentTime(state.playedSeconds || 0)}
              config={{
                youtube: {
                  playerVars: { origin: window.location.origin as string },
                },
              }}
            />
            <AnimatePresence>
              {isEmotionBad && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-8 gap-4"
                >
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-lg font-bold">You seem confused or bored ({emotion})</span>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleRepeat} className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Repeat last minute
                    </Button>
                    <Button variant="outline" onClick={handleSwitch} className="flex items-center gap-2">
                      <SwitchCamera className="h-4 w-4" />
                      Switch video
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Webcam */}
          <div className="lg:w-80 p-4 border-l bg-muted/50 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Webcam className="h-4 w-4" />
              Emotion Monitor (AI)
            </div>
            {!hasCam ? (
              <Button onClick={initCam} className="w-full">
                Enable Camera
              </Button>
            ) : (
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            )}
            <div className="space-y-1 text-xs">
              <div>Status: Disabled (AI coming soon)</div>
              <div>Emotion: N/A</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

