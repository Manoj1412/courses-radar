import { useEffect, useRef, useState, useCallback } from "react";
import type { Emotion, FaceDetection } from "../lib/types";
import { EMOTION_COLORS, EMOTION_EMOJIS } from "../lib/constants";

// Only load face-api on the client side
let faceapi: any = null;
let DETECTOR_OPTIONS: any = null;

const initializeFaceApi = async () => {
  if (typeof window === 'undefined') return false;
  if (faceapi) return true;

  try {
    // Dynamic import to avoid server-side loading
    const module = await import("@vladmandic/face-api");
    faceapi = module.default || module;
    DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
      inputSize: 160, 
      scoreThreshold: 0.35 
    });
    return true;
  } catch (err) {
    console.error("Failed to load face-api:", err);
    return false;
  }
};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/";

export function useEmotionDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detections, setDetections] = useState<FaceDetection[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldSuggestSwitch, setShouldSuggestSwitch] = useState(false);
  const animFrameRef = useRef<number>(0);
  const detectingRef = useRef(false);
  const lastDetectTimeRef = useRef(0);
  const lowConfidenceStartRef = useRef<number | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const loaded = await initializeFaceApi();
      if (!loaded) {
        setError("Failed to initialize emotion detection");
        return;
      }

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    } catch (err) {
      console.error("Failed to load face-api models", err);
      setError("Failed to load emotion detection models");
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof window === 'undefined') {
      setError("Camera not available on server");
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error("Video play error:", err));
        setStreaming(true);
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setError("Camera access denied. Enable camera permissions.");
      setStreaming(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current!.srcObject = null;
    }
    setStreaming(false);
    setDetections([]);
    setShouldSuggestSwitch(false);
    lowConfidenceStartRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !streaming || !faceapi) {
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const now = performance.now();
    if (detectingRef.current || now - lastDetectTimeRef.current < 150) {
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    detectingRef.current = true;
    lastDetectTimeRef.current = now;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState < 2) {
      detectingRef.current = false;
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    try {
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      faceapi.matchDimensions(canvas, displaySize);

      const results = await faceapi
        .detectAllFaces(video, DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withFaceExpressions();

      const resized = faceapi.resizeResults(results, displaySize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const newDetections: FaceDetection[] = [];
      resized.forEach((det: any) => {
        const box = det.detection.box;
        const expressions = det.expressions as Record<Emotion, number>;
        const sorted = Object.entries(expressions).sort(([,a], [,b]) => b - a);
        const topEmotion = sorted[0][0] as Emotion;
        const topConf = sorted[0][1];

        const name = "You";

        newDetections.push({ name, emotion: topEmotion, confidence: topConf });

        // Monitor confidence for video switching suggestion
        const confidencePercent = topConf * 100;
        if (confidencePercent < 80) {
          if (lowConfidenceStartRef.current === null) {
            lowConfidenceStartRef.current = now;
          } else if (now - lowConfidenceStartRef.current >= 1300) { // 1.3 seconds
            setShouldSuggestSwitch(true);
          }
        } else {
          lowConfidenceStartRef.current = null;
          setShouldSuggestSwitch(false);
        }

        // Draw box
        const color = EMOTION_COLORS[topEmotion] || EMOTION_COLORS.neutral;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw label
        const label = `${EMOTION_EMOJIS[topEmotion] || ""} ${topEmotion.toUpperCase()} (${Math.round(topConf * 100)}%)`;
        ctx.font = "13px sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(box.x, box.y - 26, textWidth + 16, 26);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, box.x + 8, box.y - 8);
      });

      setDetections(newDetections);
    } catch (err) {
      console.error("Detection error:", err);
    }

    detectingRef.current = false;
    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, [modelsLoaded, streaming]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    if (streaming && modelsLoaded) {
      animFrameRef.current = requestAnimationFrame(detectLoop);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [streaming, modelsLoaded, detectLoop]);

  const getPrimaryEmotion = useCallback(() => {
    if (detections.length === 0) return null;
    return detections[0];
  }, [detections]);

  const isBadEmotion = useCallback((emotion: Emotion, confidence: number): boolean => {
    return (emotion === 'fearful' || emotion === 'sad' || emotion === 'disgusted' || emotion === 'angry') && 
           confidence > 0.6;
  }, []);

  return {
    videoRef,
    canvasRef,
    modelsLoaded,
    detections,
    streaming,
    error,
    shouldSuggestSwitch,
    startCamera,
    stopCamera,
    getPrimaryEmotion,
    isBadEmotion,
  };
}

