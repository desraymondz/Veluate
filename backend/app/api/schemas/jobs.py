from datetime import datetime

from pydantic import BaseModel, Field, field_serializer

from app.api.schemas._datetime import serialize_utc_datetime


class JobFileResponse(BaseModel):
    id: str
    file_type: str
    original_filename: str | None
    stored_path: str | None
    source_url: str | None
    mime_type: str | None
    size_bytes: int | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return serialize_utc_datetime(value)


class AgentResultResponse(BaseModel):
    id: str
    agent_name: str
    output: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return serialize_utc_datetime(value)


class JobResponse(BaseModel):
    id: str
    status: str
    teacher_name: str
    audience: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    files: list[JobFileResponse] = Field(default_factory=list)
    agent_results: list[AgentResultResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at")
    def serialize_timestamps(self, value: datetime) -> str:
        return serialize_utc_datetime(value)


class JobCreatedResponse(BaseModel):
    id: str
    status: str
    message: str


class JobRetryRequest(BaseModel):
    agent: str


class JobRetryResponse(BaseModel):
    id: str
    status: str
    message: str
    agents: list[str]


class AskLectureRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class AskLectureResponse(BaseModel):
    question: str
    taught: bool
    summary: str
    quote: str | None
    confidence: str | None
    start_sec: float | None
    end_sec: float | None
    clip_url: str | None
    transcript_excerpt: str | None
