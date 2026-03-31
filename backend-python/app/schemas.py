from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field
from typing import Literal


# ---- Auth ----

class RegisterBody(BaseModel):
    fullName: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=180)
    password: str = Field(min_length=8, max_length=120)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=8, max_length=120)


class TwoFactorVerifyBody(BaseModel):
    challengeId: str = Field(min_length=8, max_length=200)
    code: str = Field(pattern=r"^\d{6}$")


class RefreshBody(BaseModel):
    refreshToken: str = Field(min_length=1)


class LogoutBody(BaseModel):
    refreshToken: str = ""


# ---- Account ----

class ProfilePatchBody(BaseModel):
    fullName: str | None = Field(None, min_length=2, max_length=120)
    email: EmailStr | None = Field(None, max_length=180)
    phone: str | None = Field(None, max_length=40)
    bio: str | None = Field(None, max_length=280)
    timezone: str | None = Field(None, max_length=80)
    language: Literal["ru", "en"] | None = None
    emailNotifications: bool | None = None
    marketingNotifications: bool | None = None
    avatarUrl: str | None = Field(None, max_length=2_000_000)


class ChangePasswordBody(BaseModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=8, max_length=120)
    confirmPassword: str = Field(min_length=8, max_length=120)


class ConfirmEmailBody(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class TwoFactorConfirmBody(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class TwoFactorDisableBody(BaseModel):
    password: str = Field(min_length=1)


# ---- Courses / Teacher ----

class CourseBody(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    slug: str = Field(min_length=3, max_length=180, pattern=r"^[a-z0-9-]+$")
    description: str = Field(min_length=20, max_length=5000)
    level: Literal["Beginner", "Intermediate", "Advanced"]
    category: str = Field(min_length=2, max_length=80)
    priceCents: int = Field(ge=0, le=10_000_000)
    accessType: Literal["open", "invite_only", "moderated"] = "open"
    coverUrl: str = Field(default="", max_length=2_000_000)


class EnrollmentRequestBody(BaseModel):
    message: str = Field(default="", max_length=500)


class EnrollmentRequestDecisionBody(BaseModel):
    status: Literal["approved", "rejected"]
    teacherComment: str = Field(default="", max_length=500)


class CourseModuleBody(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    moduleOrder: int = Field(ge=1)


class LessonBody(BaseModel):
    moduleId: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=180)
    lessonOrder: int = Field(ge=1)
    lessonType: Literal["text", "video", "interactive"] = "text"
    contentText: str = Field(default="", max_length=50_000)


class StepBody(BaseModel):
    lessonId: int | None = None
    title: str = Field(min_length=2, max_length=300)
    stepOrder: int = Field(ge=1)
    stepType: Literal["theory", "quiz", "code", "text_input", "matching", "sorting", "fill_blanks"]
    content: dict = Field(default_factory=dict)
    xp: int = Field(default=10, ge=0, le=1000)


class RoleBody(BaseModel):
    role: Literal["student", "teacher", "admin"]


class AssignmentBody(BaseModel):
    lessonId: int = Field(gt=0)
    assignmentType: Literal["code", "essay", "quiz"]
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=10, max_length=5000)
    tests: list | None = None
    rubric: dict | None = None
    maxScore: int = Field(default=100, ge=1, le=1000)


class SubmitBody(BaseModel):
    answerText: str = ""
    codeText: str = ""


# ---- AI ----

class AiChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AiChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    context: list[AiChatMessage] | None = Field(None, max_length=12)


class AiCodeReviewBody(BaseModel):
    sourceCode: str = Field(min_length=1, max_length=20000)
    language: str = Field(default="auto")


class WeeklyGoalBody(BaseModel):
    goal: int = Field(ge=3, le=50)


class AiInsightsBody(BaseModel):
    period: str = Field(default="week")
    values: list[int] = Field(default_factory=list)
    averageScore: str = Field(default="0%")
    solvedTasks: int = Field(default=0)
    completedCourses: int = Field(default=0)


class AiDailyPlanBody(BaseModel):
    continueStep: dict | None = None
    weeklyCompleted: int = Field(default=0)
    weeklyGoal: int = Field(default=10)
    activeCourses: int = Field(default=0)
    streakDays: int = Field(default=0)


class AiFaqBody(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class TicketCreateBody(BaseModel):
    subject: str = Field(default="", max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class TicketReplyBody(BaseModel):
    reply: str = Field(min_length=1, max_length=5000)
    status: str = Field(default="in_progress")
