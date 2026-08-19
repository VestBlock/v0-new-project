from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator


class ExtractionTemplate(StrEnum):
    COMPANY_PROFILE = "company_profile"
    LENDER_CRITERIA = "lender_criteria"
    INVESTOR_CRITERIA = "investor_criteria"
    BUSINESS_PRESENCE = "business_presence"
    LOCAL_INTELLIGENCE = "local_intelligence"
    SEO_RESEARCH = "seo_research"


class ResearchPurpose(StrEnum):
    CRM_RESEARCH = "crm_research"
    CONTENT_RESEARCH = "content_research"
    MARKET_RESEARCH = "market_research"
    OUTREACH_QUALIFICATION = "outreach_qualification"


class ResearchRequest(BaseModel):
    source_url: str = Field(min_length=8, max_length=2048)
    strategy_lane: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9_-]+$")
    extraction_template: ExtractionTemplate
    purpose: ResearchPurpose
    idempotency_key: str = Field(min_length=16, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")
    terms_policy: str = Field(default="approved", pattern=r"^approved$")
    job_id: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,36}$")

    @field_validator("source_url")
    @classmethod
    def disallow_sensitive_url_parameters(cls, value: str) -> str:
        lower = value.lower()
        blocked = ("access_token=", "api_key=", "apikey=", "password=", "session=", "auth_token=")
        if any(part in lower for part in blocked):
            raise ValueError("Source URLs may not contain credentials or session tokens.")
        return value


class ResearchEvidence(BaseModel):
    source_url: str
    source_domain: str
    retrieved_at: datetime
    robots_decision: str
    terms_policy: str
    extraction_method: str
    title: str | None
    headings: list[str]
    text_excerpt: str
    content_risk_signals: list[str]
    evidence_summary: str
    cache_hit: bool = False


class ResearchResponse(BaseModel):
    request_id: str
    evidence: ResearchEvidence
