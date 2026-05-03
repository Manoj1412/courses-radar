import React, { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  X,
  Send,
  Sparkles,
  BookOpen,
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  Trophy,
  RefreshCcw,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  summarizeVideoFn,
  generateQuizFn,
  evaluateQuizFn,
  chatWithAIFn,
} from "@/lib/gemini.functions";

interface Props {
  videoId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

interface ChatMsg {
  role: "user" | "model";
  text: string;
}

interface QuizQ {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function AIChatbotPanel({ videoId, title, open, onClose }: Props) {
  const [tab, setTab] = useState<"chat" | "summary" | "quiz">("chat");

  // Server functions (run in TanStack Start backend; no Python needed)
  const chat = useServerFn(chatWithAIFn);
  const summarize = useServerFn(summarizeVideoFn);
  const genQuiz = useServerFn(generateQuizFn);
  const evalQuiz = useServerFn(evaluateQuizFn);

  // Chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Summary
  const [summary, setSummary] = useState<{
    overview: string;
    keyPoints: string[];
    learningOutcomes: string[];
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Quiz
  const [quizQs, setQuizQs] = useState<QuizQ[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<any | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatLoading]);

  const sendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const newHistory = [...chatMsgs, { role: "user" as const, text: msg }];
    setChatMsgs(newHistory);
    setChatLoading(true);
    try {
      const res = await chat({
        data: { title, message: msg, history: chatMsgs },
      });
      if (res.error) {
        setChatMsgs([
          ...newHistory,
          { role: "model", text: `⚠️ ${res.error}` },
        ]);
      } else {
        setChatMsgs([...newHistory, { role: "model", text: res.reply }]);
      }
    } catch (e: any) {
      setChatMsgs([
        ...newHistory,
        { role: "model", text: `⚠️ ${e.message || "Request failed"}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chat, chatInput, chatLoading, chatMsgs, title]);

  const loadSummary = useCallback(async () => {
    if (summary || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await summarize({ data: { title } });
      if (res.error) setSummaryError(res.error);
      else setSummary(res);
    } catch (e: any) {
      setSummaryError(e.message || "Failed");
    } finally {
      setSummaryLoading(false);
    }
  }, [summary, summaryLoading, summarize, title]);

  const loadQuiz = useCallback(async () => {
    setQuizLoading(true);
    setQuizError(null);
    setQuizResult(null);
    setQuizQs([]);
    setQuizAnswers([]);
    try {
      const res = await genQuiz({ data: { title, count: 5 } });
      if (res.error) setQuizError(res.error);
      else {
        setQuizQs(res.questions);
        setQuizAnswers(Array(res.questions.length).fill(-1));
      }
    } catch (e: any) {
      setQuizError(e.message || "Failed");
    } finally {
      setQuizLoading(false);
    }
  }, [genQuiz, title]);

  const submitQuiz = useCallback(async () => {
    if (quizAnswers.some((a) => a < 0)) {
      setQuizError("Please answer all questions before submitting.");
      return;
    }
    setQuizError(null);
    setQuizLoading(true);
    try {
      const res = await evalQuiz({
        data: { title, questions: quizQs, userAnswers: quizAnswers },
      });
      if (res.error) setQuizError(res.error);
      else setQuizResult(res);
    } catch (e: any) {
      setQuizError(e.message || "Failed");
    } finally {
      setQuizLoading(false);
    }
  }, [evalQuiz, quizQs, quizAnswers, title]);

  const retakeQuiz = () => {
    setQuizResult(null);
    setQuizQs([]);
    setQuizAnswers([]);
  };

  // Auto-load when switching tabs
  useEffect(() => {
    if (tab === "summary" && !summary && !summaryLoading) {
      loadSummary();
    }
  }, [tab, summary, summaryLoading, loadSummary]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.2 }}
          className="fixed right-4 top-20 bottom-4 z-[10000] w-[400px] max-w-[95vw] max-h-[calc(100vh-6rem)] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          data-testid="ai-chatbot-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-linear-to-r from-purple-600/10 to-blue-600/10">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-linear-to-br from-purple-500 to-blue-500 p-1.5">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">AI Study Buddy</span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {title}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid grid-cols-3 mx-3 mt-3">
              <TabsTrigger value="chat" className="gap-1 text-xs">
                <MessageSquare className="h-3.5 w-3.5" /> Chat
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-1 text-xs">
                <BookOpen className="h-3.5 w-3.5" /> Summary
              </TabsTrigger>
              <TabsTrigger value="quiz" className="gap-1 text-xs">
                <Brain className="h-3.5 w-3.5" /> Quiz
              </TabsTrigger>
            </TabsList>

            {/* Chat */}
            <TabsContent
              value="chat"
              className="flex-1 flex flex-col min-h-0 m-0 p-0"
            >
              <ScrollArea className="flex-1 px-4 py-3">
                {chatMsgs.length === 0 && !chatLoading && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Ask me anything!</p>
                    <p className="text-xs mt-1">
                      I can clarify doubts about this video's topic.
                    </p>
                    <div className="mt-4 space-y-2">
                      {[
                        "Explain the main concept simply",
                        "Give me a real-world example",
                        "What are common mistakes to avoid?",
                      ].map((p) => (
                        <button
                          key={p}
                          onClick={() => setChatInput(p)}
                          className="block w-full text-left text-xs rounded-md border border-border px-3 py-2 hover:bg-secondary/60 transition"
                        >
                          💡 {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {chatMsgs.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-secondary rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder="Ask a doubt..."
                  disabled={chatLoading}
                  className="text-sm"
                />
                <Button
                  size="icon"
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* Summary */}
            <TabsContent
              value="summary"
              className="flex-1 min-h-0 m-0 p-0 overflow-hidden"
            >
              <ScrollArea className="h-full px-4 py-3">
                {summaryLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm">Generating summary...</p>
                  </div>
                )}
                {summaryError && (
                  <div className="text-destructive text-sm py-4">
                    {summaryError}
                    <Button
                      variant="link"
                      className="px-2"
                      onClick={() => {
                        setSummary(null);
                        loadSummary();
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {summary && (
                  <div className="space-y-4 text-sm">
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" /> Overview
                      </h4>
                      <p className="leading-relaxed">{summary.overview}</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1.5">
                        ✨ Key Points
                      </h4>
                      <ul className="space-y-1.5">
                        {summary.keyPoints.map((p, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary font-bold">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1.5">
                        🎯 Learning Outcomes
                      </h4>
                      <ul className="space-y-1.5">
                        {summary.learningOutcomes.map((p, i) => (
                          <li key={i} className="flex gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSummary(null);
                        loadSummary();
                      }}
                    >
                      <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Regenerate
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Quiz */}
            <TabsContent
              value="quiz"
              className="flex-1 min-h-0 m-0 p-0 overflow-hidden"
            >
              <ScrollArea className="h-full px-4 py-3">
                {quizQs.length === 0 && !quizResult && !quizLoading && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Brain className="h-12 w-12 text-primary mb-3" />
                    <p className="text-sm font-semibold mb-1">
                      Test your knowledge
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                      Take a 5-question AI-generated quiz and get personalized
                      feedback.
                    </p>
                    <Button onClick={loadQuiz}>
                      <Sparkles className="h-4 w-4 mr-1" /> Start Quiz
                    </Button>
                  </div>
                )}
                {quizLoading && !quizQs.length && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm">Generating quiz...</p>
                  </div>
                )}
                {quizError && (
                  <div className="text-destructive text-sm py-2">
                    ⚠️ {quizError}
                  </div>
                )}

                {/* Quiz in progress */}
                {quizQs.length > 0 && !quizResult && (
                  <div className="space-y-4">
                    {quizQs.map((q, qi) => (
                      <div
                        key={qi}
                        className="rounded-lg border p-3 bg-card"
                      >
                        <p className="text-sm font-medium mb-2">
                          {qi + 1}. {q.question}
                        </p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => (
                            <label
                              key={oi}
                              className={`flex items-start gap-2 p-2 rounded-md cursor-pointer border text-sm transition ${
                                quizAnswers[qi] === oi
                                  ? "border-primary bg-primary/10"
                                  : "border-transparent hover:bg-secondary/60"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q${qi}`}
                                checked={quizAnswers[qi] === oi}
                                onChange={() => {
                                  const next = [...quizAnswers];
                                  next[qi] = oi;
                                  setQuizAnswers(next);
                                }}
                                className="mt-1"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button
                      className="w-full"
                      onClick={submitQuiz}
                      disabled={quizLoading}
                    >
                      {quizLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trophy className="h-4 w-4 mr-1" />
                      )}
                      Submit Quiz
                    </Button>
                  </div>
                )}

                {/* Quiz result */}
                {quizResult && (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 bg-linear-to-br from-purple-500/10 to-blue-500/10 text-center">
                      <Trophy className="h-8 w-8 mx-auto text-yellow-500 mb-1" />
                      <div className="text-3xl font-bold">
                        {quizResult.score}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quizResult.correct} / {quizResult.total} correct
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 text-sm bg-secondary/40">
                      <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">
                        Feedback
                      </p>
                      <p className="whitespace-pre-wrap">
                        {quizResult.feedback}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {quizResult.perQuestion.map((p: any, i: number) => (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 text-xs ${
                            p.isCorrect
                              ? "border-green-500/40 bg-green-500/5"
                              : "border-red-500/40 bg-red-500/5"
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-1">
                            {p.isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            )}
                            <p className="font-medium">{p.question}</p>
                          </div>
                          <div className="ml-6 space-y-0.5 text-muted-foreground">
                            <div>
                              Your answer:{" "}
                              <span
                                className={
                                  p.isCorrect
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {p.userAnswer}
                              </span>
                            </div>
                            {!p.isCorrect && (
                              <div>
                                Correct:{" "}
                                <span className="text-green-600">
                                  {p.correctAnswer}
                                </span>
                              </div>
                            )}
                            <div className="text-foreground/80 italic mt-1">
                              💡 {p.explanation}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={retakeQuiz}
                    >
                      <RefreshCcw className="h-4 w-4 mr-1" /> New Quiz
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
