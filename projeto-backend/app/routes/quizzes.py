from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models.quiz import (
    QuizCreate, QuizUpdate, QuizResponse,
    QuizSubmitRequest, QuizSubmissionResponse, QuizQuestion
)
from app.models.enums import UserRole
from app.utils.security import get_current_user, get_tenant_filter, get_user_roles
from app.utils.audit import log_action

router = APIRouter()


def _strip_correct_answers(quiz: dict) -> dict:
    """Remove correct_answer from all questions (for non-privileged users)."""
    questions = quiz.get("questions", [])
    stripped = []
    for q in questions:
        q_copy = dict(q)
        q_copy.pop("correct_answer", None)
        stripped.append(q_copy)
    quiz = dict(quiz)
    quiz["questions"] = stripped
    return quiz


def _score_quiz(quiz: dict, answers: dict) -> float:
    """
    Score a quiz submission.
    Only questions with a correct_answer are scoreable.
    Returns score as percentage (0-100). Returns 0 if no scoreable questions.
    """
    questions = quiz.get("questions", [])
    scoreable = [q for q in questions if q.get("correct_answer") is not None and q.get("correct_answer") != ""]
    if not scoreable:
        return 0.0
    correct = sum(
        1 for q in scoreable
        if answers.get(q["id"], "").strip().lower() == q["correct_answer"].strip().lower()
    )
    return round((correct / len(scoreable)) * 100, 2)


@router.get("", response_model=List[QuizResponse])
async def list_quizzes(
    formative_stage_id: Optional[str] = Query(None),
    active_only: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    tenant_filter = get_tenant_filter(current_user)
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles
    is_privileged = is_admin or is_formador

    query = {**tenant_filter}

    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id

    # Non-admins default to active_only=True
    if active_only is None:
        effective_active_only = not is_privileged
    else:
        effective_active_only = active_only

    if effective_active_only:
        query["is_active"] = True

    quizzes = await db.quizzes.find(query, {"_id": 0}).to_list(1000)

    result = []
    for quiz in quizzes:
        count = await db.quiz_submissions.count_documents({"quiz_id": quiz["id"]})
        quiz["submission_count"] = count
        result.append(quiz)

    return result


@router.post("", response_model=QuizResponse)
async def create_quiz(
    data: QuizCreate,
    current_user: dict = Depends(get_current_user)
):
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles

    if not is_admin and not is_formador:
        raise HTTPException(status_code=403, detail="Admin or Formador access required")

    tenant_id = current_user.get("tenant_id")
    now = datetime.now(timezone.utc).isoformat()

    quiz_dict = data.model_dump()

    # Generate IDs for questions that don't have one
    questions_with_ids = []
    for q in quiz_dict.get("questions", []):
        if not q.get("id"):
            q["id"] = str(uuid.uuid4())
        questions_with_ids.append(q)
    quiz_dict["questions"] = questions_with_ids

    quiz_dict["id"] = str(uuid.uuid4())
    quiz_dict["tenant_id"] = tenant_id
    quiz_dict["created_by_id"] = current_user["id"]
    quiz_dict["created_by_name"] = current_user["full_name"]
    quiz_dict["created_at"] = now
    quiz_dict["updated_at"] = now
    quiz_dict["submission_count"] = 0

    await db.quizzes.insert_one(quiz_dict)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "quiz", quiz_dict["id"],
        {"title": data.title},
        tenant_id=tenant_id
    )
    return quiz_dict


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: str,
    current_user: dict = Depends(get_current_user)
):
    tenant_filter = get_tenant_filter(current_user)
    query = {"id": quiz_id, **tenant_filter}
    quiz = await db.quizzes.find_one(query, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles
    is_privileged = is_admin or is_formador

    # Count submissions for this quiz
    count = await db.quiz_submissions.count_documents({"quiz_id": quiz_id})
    quiz["submission_count"] = count

    # Strip correct_answers for non-privileged users
    if not is_privileged:
        quiz = _strip_correct_answers(quiz)

    return quiz


@router.put("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: str,
    data: QuizUpdate,
    current_user: dict = Depends(get_current_user)
):
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles

    if not is_admin and not is_formador:
        raise HTTPException(status_code=403, detail="Admin or Formador access required")

    tenant_filter = get_tenant_filter(current_user)
    query = {"id": quiz_id, **tenant_filter}
    existing = await db.quizzes.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Quiz not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}

    # If questions are being updated, ensure all have IDs
    if "questions" in update_dict:
        questions_with_ids = []
        for q in update_dict["questions"]:
            if not q.get("id"):
                q["id"] = str(uuid.uuid4())
            questions_with_ids.append(q)
        update_dict["questions"] = questions_with_ids

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.quizzes.update_one({"id": quiz_id}, {"$set": update_dict})
    await log_action(
        current_user["id"], current_user["full_name"],
        "update", "quiz", quiz_id,
        tenant_id=current_user.get("tenant_id")
    )

    updated = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    count = await db.quiz_submissions.count_documents({"quiz_id": quiz_id})
    updated["submission_count"] = count
    return updated


@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: str,
    current_user: dict = Depends(get_current_user)
):
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles

    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_filter = get_tenant_filter(current_user)
    query = {"id": quiz_id, **tenant_filter}
    existing = await db.quizzes.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Delete quiz and all its submissions
    await db.quizzes.delete_one({"id": quiz_id})
    await db.quiz_submissions.delete_many({"quiz_id": quiz_id})

    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "quiz", quiz_id,
        tenant_id=current_user.get("tenant_id")
    )
    return {"message": "Quiz and all submissions deleted successfully"}


@router.post("/{quiz_id}/submit", response_model=QuizSubmissionResponse)
async def submit_quiz(
    quiz_id: str,
    data: QuizSubmitRequest,
    current_user: dict = Depends(get_current_user)
):
    tenant_filter = get_tenant_filter(current_user)
    query = {"id": quiz_id, **tenant_filter}
    quiz = await db.quizzes.find_one(query, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if not quiz.get("is_active", True):
        raise HTTPException(status_code=400, detail="This quiz is not active")

    # Check if user already submitted
    existing_submission = await db.quiz_submissions.find_one({
        "quiz_id": quiz_id,
        "user_id": current_user["id"]
    })
    if existing_submission:
        raise HTTPException(status_code=409, detail="You have already submitted this quiz")

    # Calculate score
    score = _score_quiz(quiz, data.answers)
    passed = score >= quiz.get("pass_score", 70)

    tenant_id = current_user.get("tenant_id")
    now = datetime.now(timezone.utc).isoformat()

    submission = {
        "id": str(uuid.uuid4()),
        "quiz_id": quiz_id,
        "quiz_title": quiz["title"],
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "answers": data.answers,
        "score": score,
        "passed": passed,
        "submitted_at": now,
        "tenant_id": tenant_id
    }

    await db.quiz_submissions.insert_one(submission)
    return submission


@router.get("/{quiz_id}/my-result", response_model=QuizSubmissionResponse)
async def get_my_result(
    quiz_id: str,
    current_user: dict = Depends(get_current_user)
):
    submission = await db.quiz_submissions.find_one(
        {"quiz_id": quiz_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="No submission found for this quiz")
    return submission


@router.get("/{quiz_id}/results", response_model=List[QuizSubmissionResponse])
async def get_quiz_results(
    quiz_id: str,
    current_user: dict = Depends(get_current_user)
):
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles

    if not is_admin and not is_formador:
        raise HTTPException(status_code=403, detail="Admin or Formador access required")

    tenant_filter = get_tenant_filter(current_user)
    quiz_query = {"id": quiz_id, **tenant_filter}
    quiz = await db.quizzes.find_one(quiz_query, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    submissions = await db.quiz_submissions.find(
        {"quiz_id": quiz_id},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(1000)

    return submissions
