from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict


class QuizQuestion(BaseModel):
    id: str
    text: str
    type: str = "multiple_choice"  # "multiple_choice" | "true_false" | "text"
    options: Optional[List[str]] = []
    correct_answer: Optional[str] = None


class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    formative_stage_id: Optional[str] = None
    questions: List[QuizQuestion]
    is_active: bool = True
    pass_score: int = 70


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    formative_stage_id: Optional[str] = None
    questions: Optional[List[QuizQuestion]] = None
    is_active: Optional[bool] = None
    pass_score: Optional[int] = None


class QuizResponse(QuizCreate):
    model_config = ConfigDict(extra="ignore")

    id: str
    created_by_id: str
    created_by_name: str
    created_at: str
    updated_at: str
    tenant_id: Optional[str] = None
    submission_count: int = 0


class QuizSubmitRequest(BaseModel):
    answers: Dict[str, str]  # question_id -> answer string


class QuizSubmissionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    quiz_id: str
    quiz_title: str
    user_id: str
    user_name: str
    answers: Dict[str, str]
    score: Optional[float] = None
    passed: Optional[bool] = None
    submitted_at: str
    tenant_id: Optional[str] = None
