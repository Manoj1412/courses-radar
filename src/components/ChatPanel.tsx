import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  MessageCircle, 
  BookOpen, 
  HelpCircle, 
  History, 
  ChevronDown,
  Check,
  X,
  Volume2,
  Loader,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  generateVideoSummaryFn,
  generateQuizQuestionsFn,
  generateQuizFeedbackFn,
  generateStudyRecommendationFn,
} from '@/lib/gemini.functions';
import { useServerFn } from '@tanstack/react-start';
import { useQuizTracking } from '@/hooks/useQuizTracking';
import type { QuizQuestion, QuizAttempt } from '@/lib/types';

interface ChatPanelProps {
  videoId: string;
  videoTitle: string;
  videoDescription: string;
  emotionData?: {
    avgConfidence: number;
    primaryEmotions: string[];
  };
}

export function ChatPanel({
  videoId,
  videoTitle,
  videoDescription,
  emotionData,
}: ChatPanelProps) {
  // Server functions
  const generateSummary = useServerFn(generateVideoSummaryFn);
  const generateQuiz = useServerFn(generateQuizQuestionsFn);
  const generateFeedback = useServerFn(generateQuizFeedbackFn);

  // State
  const [activeTab, setActiveTab] = useState('summary');
  const [summary, setSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<any | null>(null);
  const [showQuizReview, setShowQuizReview] = useState(false);

  const { getVideoStats, getVideoAttempts, saveAttempt } = useQuizTracking();
  const [videoStats, setVideoStats] = useState<any>(null);
  const [videoHistory, setVideoHistory] = useState<QuizAttempt[]>([]);

  // Load summary on mount
  useEffect(() => {
    loadSummary();
  }, [videoId]);

  // Load video statistics
  useEffect(() => {
    const stats = getVideoStats(videoId);
    setVideoStats(stats);
    
    const attempts = getVideoAttempts(videoId);
    setVideoHistory(attempts);
  }, [videoId, getVideoStats, getVideoAttempts]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const result = await generateSummary({ data: { videoTitle, videoDescription } });
      setSummary(result);
    } catch (error) {
      console.error('Error loading summary:', error);
      setSummary({
        title: videoTitle,
        summary: 'Failed to generate summary',
        keyPoints: [],
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const startQuiz = async () => {
    setLoadingQuiz(true);
    setUserAnswers([]);
    setCurrentQuestion(0);
    setQuizComplete(false);
    setQuizFeedback(null);

    try {
      const result = await generateQuiz({ data: { videoTitle, videoDescription, numQuestions: 5 } });
      setQuizQuestions(result.questions || []);
    } catch (error) {
      console.error('Error loading quiz:', error);
      setQuizQuestions([]);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleAnswerSelect = (optionIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = optionIndex;
    setUserAnswers(newAnswers);

    // Auto move to next question after selection
    if (currentQuestion < quizQuestions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
      }, 500);
    }
  };

  const submitQuiz = async () => {
    try {
      const feedback = await generateFeedback({ 
        data: { 
          videoTitle,
          userAnswers,
          correctAnswers: quizQuestions.map((q) => q.correctAnswer),
          questions: quizQuestions,
        }
      });

      setQuizFeedback(feedback);
      setQuizComplete(true);

      // Save attempt
      const attempt: QuizAttempt = {
        id: `${videoId}-${Date.now()}`,
        videoId,
        videoTitle,
        timestamp: Date.now(),
        userAnswers,
        score: feedback.score,
        totalQuestions: quizQuestions.length,
        feedback: feedback.feedback,
        emotionData: emotionData
          ? {
              avgConfidence: emotionData.avgConfidence,
              primaryEmotions: emotionData.primaryEmotions as any,
            }
          : undefined,
      };

      saveAttempt(attempt);

      // Refresh statistics
      const stats = getVideoStats(videoId);
      setVideoStats(stats);
    } catch (error) {
      console.error('Error submitting quiz:', error);
    }
  };

  const retakeQuiz = () => {
    setQuizQuestions([]);
    setUserAnswers([]);
    setCurrentQuestion(0);
    setQuizComplete(false);
    setQuizFeedback(null);
    startQuiz();
  };

  return (
    <div className="w-full h-full flex flex-col bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">AI Learning Assistant</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Get summaries, quizzes, and track your progress
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b border-border px-4 py-0 h-12 bg-transparent">
          <TabsTrigger
            value="summary"
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Summary</span>
          </TabsTrigger>
          <TabsTrigger
            value="quiz"
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Quiz</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {loadingSummary ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : summary ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="font-semibold text-sm mb-2">Topic Overview</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {summary.summary}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-3">Key Learning Points</h3>
                  <ul className="space-y-2">
                    {summary.keyPoints && summary.keyPoints.length > 0 ? (
                      summary.keyPoints.map((point: string, i: number) => (
                        <li key={i} className="flex gap-3 text-xs">
                          <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                          <span className="text-muted-foreground">{point}</span>
                        </li>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No key points available
                      </p>
                    )}
                  </ul>
                </div>

                <Button
                  onClick={() => setActiveTab('quiz')}
                  className="w-full mt-4"
                  size="sm"
                >
                  Test Your Knowledge
                </Button>
              </motion.div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Failed to load summary
              </div>
            )}
          </div>
        </TabsContent>

        {/* Quiz Tab */}
        <TabsContent value="quiz" className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {!quizQuestions.length && !loadingQuiz && !quizComplete ? (
              <div className="space-y-4 py-8 text-center">
                <HelpCircle className="h-12 w-12 mx-auto text-primary/50" />
                <div>
                  <h3 className="font-semibold mb-2">Ready to Test Yourself?</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Take a quick 5-question quiz to test your understanding
                  </p>
                </div>
                <Button onClick={startQuiz} size="lg" className="w-full">
                  Start Quiz
                </Button>
              </div>
            ) : loadingQuiz ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Generating questions...</p>
                </div>
              </div>
            ) : quizComplete && quizFeedback ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 py-4"
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <span className="text-3xl font-bold text-primary">
                      {quizFeedback.score}%
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1">Quiz Complete!</h3>
                  <p className="text-sm text-muted-foreground">
                    {quizFeedback.score >= 80
                      ? 'Excellent work! 🎉'
                      : quizFeedback.score >= 60
                      ? 'Good effort! Keep practicing. 💪'
                      : 'Keep learning! You&apos;ll improve. 📚'}
                  </p>
                </div>

                <Card className="bg-secondary/50 border-0">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">
                      {quizFeedback.feedback}
                    </p>
                  </CardContent>
                </Card>

                {quizFeedback.incorrectAnswers && quizFeedback.incorrectAnswers.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowQuizReview(!showQuizReview)}
                      className="flex items-center gap-2 text-sm font-medium text-primary hover:underline w-full justify-between p-2 rounded hover:bg-secondary/50"
                    >
                      <span>Review Incorrect Answers</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          showQuizReview ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {showQuizReview && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-3 bg-destructive/5 p-3 rounded-lg"
                        >
                          {quizFeedback.incorrectAnswers.map((i: number) => {
                            const q = quizQuestions[i];
                            const userAnswer = userAnswers[i];
                            const correctAnswer = q.correctAnswer;

                            return (
                              <div key={i} className="space-y-2 text-xs">
                                <div>
                                  <p className="font-medium mb-1">Q{i + 1}: {q.question}</p>
                                  <div className="space-y-1">
                                    <p className="text-destructive">
                                      Your answer: {q.options[userAnswer]}
                                    </p>
                                    <p className="text-green-600">
                                      Correct: {q.options[correctAnswer]}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-muted-foreground italic">
                                  {q.explanation}
                                </p>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('history')}
                    className="flex-1"
                    size="sm"
                  >
                    View History
                  </Button>
                  <Button onClick={retakeQuiz} className="flex-1" size="sm">
                    Retake Quiz
                  </Button>
                </div>
              </motion.div>
            ) : quizQuestions.length > 0 && !quizComplete ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={currentQuestion}
                className="space-y-4 py-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Question {currentQuestion + 1}/{quizQuestions.length}
                    </p>
                    <div className="flex gap-1">
                      {quizQuestions.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            i <= currentQuestion
                              ? 'bg-primary'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm mb-4">
                    {quizQuestions[currentQuestion].question}
                  </h3>

                  <div className="space-y-2">
                    {quizQuestions[currentQuestion].options.map((option: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleAnswerSelect(i)}
                        disabled={userAnswers[currentQuestion] !== undefined}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          userAnswers[currentQuestion] === i
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        } disabled:opacity-60`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              userAnswers[currentQuestion] === i
                                ? 'border-primary bg-primary'
                                : 'border-border'
                            }`}
                          >
                            {userAnswers[currentQuestion] === i && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                          <span className="text-sm">{option}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                    size="sm"
                    className="flex-1"
                  >
                    Back
                  </Button>
                  {currentQuestion === quizQuestions.length - 1 && userAnswers[currentQuestion] !== undefined ? (
                    <Button
                      onClick={submitQuiz}
                      size="sm"
                      className="flex-1"
                    >
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setCurrentQuestion(Math.min(quizQuestions.length - 1, currentQuestion + 1))}
                      disabled={currentQuestion === quizQuestions.length - 1}
                      size="sm"
                      className="flex-1"
                    >
                      Next
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : null}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {videoStats && videoStats.totalAttempts > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Average Score</p>
                      <p className="text-2xl font-bold text-primary">
                        {videoStats.averageScore}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/5 border-green-500/20">
                    <CardContent className="pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Best Score</p>
                      <p className="text-2xl font-bold text-green-600">
                        {videoStats.highestScore}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Improvement Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {videoStats.improvementTrend > 0 ? (
                        <>
                          <span className="text-green-600 text-sm font-bold">
                            +{videoStats.improvementTrend}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            improvement from first attempt
                          </span>
                        </>
                      ) : videoStats.improvementTrend < 0 ? (
                        <>
                          <span className="text-red-600 text-sm font-bold">
                            {videoStats.improvementTrend}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            needs focus
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          First attempt - room to improve!
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Attempts List */}
                <div>
                  <h3 className="font-semibold text-sm mb-3">Recent Attempts</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {videoHistory.slice(0, 10).map((attempt, i) => (
                      <Card key={attempt.id} className="cursor-default hover:bg-secondary/50">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium">
                                Attempt {videoHistory.length - i}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(attempt.timestamp).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-primary">
                                {attempt.score}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {attempt.totalQuestions} questions
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="py-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="font-semibold text-sm mb-1">No Quiz Attempts Yet</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Start taking quizzes to track your progress
                </p>
                <Button
                  onClick={() => setActiveTab('quiz')}
                  size="sm"
                  variant="outline"
                >
                  Take First Quiz
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
