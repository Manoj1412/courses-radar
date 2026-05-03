"""Pytest suite for CourseRadar AI endpoints (Gemini 2.5 Flash via Emergent LLM key)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://face-engage-edu.preview.emergentagent.com").rstrip("/")
TIMEOUT = 90


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Health ----------
class TestHealth:
    def test_root_api(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("message") == "Hello World"


# ---------- /api/ai/summarize ----------
class TestSummarize:
    def test_summarize_success(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/ai/summarize",
            json={"title": "Introduction to Python Programming", "description": "Python basics for beginners"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("error") in (None, ""), f"Unexpected error: {data.get('error')}"
        assert isinstance(data.get("overview"), str) and len(data["overview"]) > 10
        assert isinstance(data.get("keyPoints"), list) and len(data["keyPoints"]) >= 3
        assert isinstance(data.get("learningOutcomes"), list) and len(data["learningOutcomes"]) >= 2

    def test_summarize_missing_title_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/summarize", json={"description": "foo"}, timeout=TIMEOUT)
        assert r.status_code == 422

    def test_summarize_empty_title_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/summarize", json={"title": ""}, timeout=TIMEOUT)
        assert r.status_code == 422


# ---------- /api/ai/quiz ----------
@pytest.fixture(scope="module")
def quiz_payload():
    return {"title": "Introduction to Python Programming", "count": 5}


@pytest.fixture(scope="module")
def generated_quiz(api_client, quiz_payload):
    r = api_client.post(f"{BASE_URL}/api/ai/quiz", json=quiz_payload, timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.skip(f"Quiz generation failed: {r.status_code} {r.text}")
    data = r.json()
    if data.get("error"):
        pytest.skip(f"Quiz had error: {data['error']}")
    return data


class TestQuiz:
    def test_quiz_structure(self, generated_quiz):
        questions = generated_quiz.get("questions", [])
        assert len(questions) == 5
        for q in questions:
            assert isinstance(q.get("question"), str) and len(q["question"]) > 0
            assert isinstance(q.get("options"), list) and len(q["options"]) == 4
            assert isinstance(q.get("correctIndex"), int) and 0 <= q["correctIndex"] <= 3
            assert isinstance(q.get("explanation"), str)

    def test_quiz_invalid_count_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/quiz", json={"title": "Python", "count": 99}, timeout=TIMEOUT)
        assert r.status_code == 422

    def test_quiz_missing_title_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/quiz", json={"count": 5}, timeout=TIMEOUT)
        assert r.status_code == 422


# ---------- /api/ai/quiz-eval ----------
class TestQuizEval:
    def test_quiz_eval_all_correct(self, api_client, generated_quiz):
        questions = generated_quiz["questions"]
        user_answers = [q["correctIndex"] for q in questions]
        r = api_client.post(
            f"{BASE_URL}/api/ai/quiz-eval",
            json={"title": "Introduction to Python Programming", "questions": questions, "userAnswers": user_answers},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("error") in (None, "")
        assert data["total"] == len(questions)
        assert data["correct"] == len(questions)
        assert data["score"] == 100
        assert isinstance(data["feedback"], str) and len(data["feedback"]) > 20
        assert len(data["perQuestion"]) == len(questions)
        assert all(p["isCorrect"] for p in data["perQuestion"])

    def test_quiz_eval_partial(self, api_client, generated_quiz):
        questions = generated_quiz["questions"]
        # first correct, rest wrong (pick (correctIndex+1)%4)
        user_answers = [questions[0]["correctIndex"]] + [
            (q["correctIndex"] + 1) % 4 for q in questions[1:]
        ]
        r = api_client.post(
            f"{BASE_URL}/api/ai/quiz-eval",
            json={"title": "Introduction to Python Programming", "questions": questions, "userAnswers": user_answers},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["correct"] == 1
        assert data["score"] == round((1 / len(questions)) * 100)

    def test_quiz_eval_missing_fields_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/quiz-eval", json={"title": "Python"}, timeout=TIMEOUT)
        assert r.status_code == 422


# ---------- /api/ai/chat ----------
class TestChat:
    def test_chat_basic_reply(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/ai/chat",
            json={"title": "Introduction to Python Programming", "message": "What is a variable?", "history": []},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("error") in (None, "")
        assert isinstance(data.get("reply"), str) and len(data["reply"]) > 20

    def test_chat_with_history(self, api_client):
        history = [
            {"role": "user", "text": "What is a list in Python?"},
            {"role": "model", "text": "A list is an ordered, mutable collection of items."},
        ]
        r = api_client.post(
            f"{BASE_URL}/api/ai/chat",
            json={
                "title": "Introduction to Python Programming",
                "message": "Can you give an example?",
                "history": history,
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data.get("reply", "")) > 10

    def test_chat_empty_message_422(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/ai/chat",
            json={"title": "Python", "message": "", "history": []},
            timeout=TIMEOUT,
        )
        assert r.status_code == 422


# ---------- /api/ai/feedback ----------
class TestFeedback:
    def test_feedback_success(self, api_client):
        payload = {
            "title": "Introduction to Python Programming",
            "totalSeconds": 300,
            "emotionCounts": {"happy": 20, "neutral": 50, "surprised": 5, "sad": 2, "angry": 0, "fearful": 0, "disgusted": 0},
            "awayCount": 1,
            "avgConfidence": 0.85,
        }
        r = api_client.post(f"{BASE_URL}/api/ai/feedback", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("error") in (None, "")
        assert isinstance(data.get("verdict"), str) and len(data["verdict"]) > 0
        assert isinstance(data.get("summary"), str) and len(data["summary"]) > 10
        assert isinstance(data.get("strengths"), list) and len(data["strengths"]) >= 1
        assert isinstance(data.get("suggestions"), list) and len(data["suggestions"]) >= 1
        assert isinstance(data.get("score"), int) and 0 <= data["score"] <= 100
        assert isinstance(data.get("percentages"), dict)
        # Verify percent computation
        total = sum(payload["emotionCounts"].values())
        expected_happy_pct = round((payload["emotionCounts"]["happy"] / total) * 100)
        assert data["percentages"].get("happy") == expected_happy_pct
        assert data["totalSeconds"] == 300
        assert data["awayCount"] == 1

    def test_feedback_missing_title_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/feedback", json={"totalSeconds": 100}, timeout=TIMEOUT)
        assert r.status_code == 422
