from datetime import datetime

from pydantic import BaseModel, Field


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


class AgentResultResponse(BaseModel):
    id: str
    agent_name: str
    output: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


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


class JobCreatedResponse(BaseModel):
    id: str
    status: str
    message: str
