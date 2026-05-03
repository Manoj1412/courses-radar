"""AI endpoints powered by Emergent LLM key via emergentintegrations.

Provides: /api/ai/summarize, /api/ai/quiz, /api/ai/quiz-eval, /api/ai/chat,
/api/ai/feedback. All endpoints use Gemini 2.5 Flash (default), which is
free-tier friendly under the Emergent Universal Key.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])

GEMINI_MODEL = "gemini-2.5-flash"


async def _chat(system: str, prompt: str, *, temperature: float = 0.6) -> str:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    chat = (
        LlmChat(
            api_key=api_key,
            session_id=f"courseradar-{uuid.uuid4()}",
            system_message=system,
        )
        .with_model("gemini", GEMINI_MODEL)
    )
    try:
        reply = await chat.send_message(UserMessage(text=prompt))
        return (reply or "").strip()
    except Exception as exc:
        logger.exception("LLM call failed: %s", exc)
        msg = str(exc).lower()
        if "429" in msg or "quota" in msg or "rate" in msg:
            raise HTTPException(
                status_code=429,
                detail="AI service is temporarily rate-limited. Please retry in a moment.",
            ) from exc
        raise HTTPException(status_code=502, detail=f"AI call failed: {exc}") from exc


def _parse_json(text: str) -> Dict[str, Any]:
    """Parse LLM JSON output. Strips ```json fences if present."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"```\s*$", "", cleaned)
    # Fallback: find first { ... last }
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


# ---------------- Summarize ----------------
class SummarizeIn(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""


class SummarizeOut(BaseModel):
    overview: str = ""
    keyPoints: List[str] = []
    learningOutcomes: List[str] = []
    error: Optional[str] = None


@router.post("/summarize", response_model=SummarizeOut)
async def summarize_video(payload: SummarizeIn) -> SummarizeOut:
    try:
        desc = (payload.description or "")[:400]
        prompt = (
            f'Given the YouTube video title (and optional short description), produce a concise study '
            f'summary based on the likely topic.\n\nTitle: "{payload.title}"\n'
            f'{("Short description: " + desc) if desc else ""}\n\n'
            "Respond with VALID JSON ONLY (no prose, no markdown fences) matching this shape:\n"
            '{\n'
            '  "overview": "2-3 sentence overview",\n'
            '  "keyPoints": ["5 to 7 bullet points of key concepts"],\n'
            '  "learningOutcomes": ["3 to 4 concrete skills or outcomes"]\n'
            '}'
        )
        text = await _chat(
            system="You are an expert educator. Output only valid JSON.",
            prompt=prompt,
            temperature=0.4,
        )
        data = _parse_json(text)
        return SummarizeOut(
            overview=data.get("overview", ""),
            keyPoints=data.get("keyPoints", []),
            learningOutcomes=data.get("learningOutcomes", []),
            error=None,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("summarize failed")
        return SummarizeOut(error=f"Failed to summarize: {exc}")


# ---------------- Quiz generation ----------------
class QuizIn(BaseModel):
    title: str = Field(..., min_length=1)
    count: int = Field(5, ge=1, le=10)


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correctIndex: int
    explanation: str


class QuizOut(BaseModel):
    questions: List[QuizQuestion] = []
    error: Optional[str] = None


@router.post("/quiz", response_model=QuizOut)
async def generate_quiz(payload: QuizIn) -> QuizOut:
    try:
        prompt = (
            f'Based on the likely content of a YouTube video titled "{payload.title}", '
            f"generate exactly {payload.count} multiple-choice questions to test understanding.\n\n"
            "Rules:\n- Each question has exactly 4 options\n- correctIndex is 0-3\n"
            "- Mix difficulty: 2 easy, 2 medium, 1 hard\n- Keep questions focused on the title's core topic\n"
            "- Explanations should be 1-2 sentences\n\n"
            "Output VALID JSON ONLY (no fences, no prose) with this shape:\n"
            '{\n  "questions": [\n'
            '    { "question": "...", "options": ["a","b","c","d"], "correctIndex": 0, "explanation": "..." }\n'
            '  ]\n}'
        )
        text = await _chat(
            system="You are a quiz master. Output only valid JSON.",
            prompt=prompt,
            temperature=0.6,
        )
        data = _parse_json(text)
        questions = [QuizQuestion(**q) for q in data.get("questions", [])]
        return QuizOut(questions=questions, error=None)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("quiz generation failed")
        return QuizOut(error=f"Failed to generate quiz: {exc}")


# ---------------- Quiz evaluation ----------------
class QuizEvalIn(BaseModel):
    title: str
    questions: List[QuizQuestion]
    userAnswers: List[int]


class PerQuestion(BaseModel):
    question: str
    userAnswer: str
    correctAnswer: str
    isCorrect: bool
    explanation: str


class QuizEvalOut(BaseModel):
    score: int = 0
    correct: int = 0
    total: int = 0
    perQuestion: List[PerQuestion] = []
    feedback: str = ""
    error: Optional[str] = None


@router.post("/quiz-eval", response_model=QuizEvalOut)
async def evaluate_quiz(payload: QuizEvalIn) -> QuizEvalOut:
    try:
        correct = 0
        per: List[PerQuestion] = []
        for i, q in enumerate(payload.questions):
            user_idx = payload.userAnswers[i] if i < len(payload.userAnswers) else -1
            is_correct = user_idx == q.correctIndex
            if is_correct:
                correct += 1
            per.append(
                PerQuestion(
                    question=q.question,
                    userAnswer=q.options[user_idx] if 0 <= user_idx < len(q.options) else "No answer",
                    correctAnswer=q.options[q.correctIndex],
                    isCorrect=is_correct,
                    explanation=q.explanation,
                )
            )
        total = len(payload.questions) or 1
        score = round((correct / total) * 100)

        results_block = "\n".join(
            f"{i + 1}. {'CORRECT' if p.isCorrect else 'WRONG'} {p.question}\n"
            f"   User: {p.userAnswer}\n   Correct: {p.correctAnswer}"
            for i, p in enumerate(per)
        )
        prompt = (
            f'The user just took a {total}-question quiz on the video titled "{payload.title}" '
            f"and scored {score}% ({correct}/{total} correct).\n\nResults:\n{results_block}\n\n"
            "Give 3-4 sentences of personalized, encouraging feedback. Point out strong areas, "
            "suggest what to revise, and end with a motivating note. Plain text only."
        )
        feedback = await _chat(
            system="You are a warm, supportive tutor.",
            prompt=prompt,
            temperature=0.6,
        )
        return QuizEvalOut(
            score=score,
            correct=correct,
            total=total,
            perQuestion=per,
            feedback=feedback,
            error=None,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("quiz eval failed")
        return QuizEvalOut(error=f"Failed to evaluate quiz: {exc}")


# ---------------- Chat ----------------
class ChatMsg(BaseModel):
    role: str  # "user" | "model"
    text: str


class ChatIn(BaseModel):
    title: str
    message: str = Field(..., min_length=1)
    history: List[ChatMsg] = []


class ChatOut(BaseModel):
    reply: str = ""
    error: Optional[str] = None


@router.post("/chat", response_model=ChatOut)
async def chat_with_ai(payload: ChatIn) -> ChatOut:
    try:
        system = (
            f'You are an AI tutor helping a student who is watching a YouTube video titled: "{payload.title}". '
            "Answer their doubts clearly and concisely (3-5 sentences unless more depth is asked). "
            "Focus on the topic of the video. Use simple examples. If the question is unrelated, gently redirect. "
            "Do not use markdown headings; plain text with bullet points or numbered lists is fine."
        )
        # Include last few history turns inline for context
        history_block = ""
        if payload.history:
            turns = payload.history[-8:]
            history_block = "\n\nConversation so far:\n" + "\n".join(
                f"{'User' if m.role == 'user' else 'Tutor'}: {m.text}" for m in turns
            )
        prompt = f"Student question: {payload.message}{history_block}"
        reply = await _chat(system=system, prompt=prompt, temperature=0.7)
        return ChatOut(reply=reply, error=None)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("chat failed")
        return ChatOut(error=f"Failed to get AI response: {exc}")


# ---------------- Understanding feedback ----------------
class FeedbackIn(BaseModel):
    title: str
    totalSeconds: float = 0
    emotionCounts: Dict[str, int] = {}
    awayCount: int = 0
    avgConfidence: float = 0


class FeedbackOut(BaseModel):
    verdict: str = ""
    summary: str = ""
    strengths: List[str] = []
    suggestions: List[str] = []
    score: int = 0
    percentages: Dict[str, int] = {}
    totalSeconds: int = 0
    awayCount: int = 0
    error: Optional[str] = None


@router.post("/feedback", response_model=FeedbackOut)
async def understanding_feedback(payload: FeedbackIn) -> FeedbackOut:
    try:
        total_samples = sum(payload.emotionCounts.values()) or 1
        percentages = {
            k: round((v / total_samples) * 100) for k, v in payload.emotionCounts.items()
        }

        positive = (
            percentages.get("happy", 0)
            + percentages.get("surprised", 0) * 0.7
            + percentages.get("neutral", 0) * 0.5
        )
        negative = (
            percentages.get("sad", 0)
            + percentages.get("angry", 0)
            + percentages.get("fearful", 0)
            + percentages.get("disgusted", 0)
        )
        score = max(0, min(100, round(positive - negative * 0.5 + 20)))

        distribution = "\n".join(
            f"  - {k}: {v}%" for k, v in percentages.items()
        ) or "  - (no samples)"
        prompt = (
            f'A student just finished watching a YouTube video titled "{payload.title}".\n'
            "Their facial expressions were tracked throughout the session.\n\n"
            "Engagement stats:\n"
            f"- Total watch time: {round(payload.totalSeconds)} seconds\n"
            f"- Times stepped away from camera: {payload.awayCount}\n"
            f"- Expression distribution (percent of samples):\n{distribution}\n"
            f"- Average detection confidence: {round(payload.avgConfidence * 100)}%\n"
            f"- Computed engagement score: {score}/100\n\n"
            "Based on this, infer how well the student likely understood the video and produce "
            "VALID JSON ONLY (no fences, no prose) with this shape:\n"
            '{\n'
            '  "verdict": "short label (e.g., Great engagement!, Mostly engaged, Somewhat distracted, Looked confused)",\n'
            '  "summary": "2-3 sentences describing their session (address as \\"you\\")",\n'
            '  "strengths": ["2-3 positive bullets"],\n'
            '  "suggestions": ["2-3 practical next-step bullets"]\n'
            '}\n\nBe warm, concise, and specific.'
        )
        text = await _chat(
            system="You are an empathetic learning coach. Output only valid JSON.",
            prompt=prompt,
            temperature=0.6,
        )
        data = _parse_json(text)
        return FeedbackOut(
            verdict=data.get("verdict", ""),
            summary=data.get("summary", ""),
            strengths=data.get("strengths", []),
            suggestions=data.get("suggestions", []),
            score=score,
            percentages=percentages,
            totalSeconds=round(payload.totalSeconds),
            awayCount=payload.awayCount,
            error=None,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("feedback failed")
        return FeedbackOut(error=f"Failed to generate feedback: {exc}")
