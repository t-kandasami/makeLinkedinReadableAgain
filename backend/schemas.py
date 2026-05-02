from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    post_text: str = Field(..., min_length=1, max_length=5000)
    mode: str = "SavageTruth"
    spice: int = Field(default=7, ge=1, le=10)
    audience: str = "general internet"


class TranslateResponse(BaseModel):
    category: str
    real_life_translation: str
    tags: list[str] = []
    spice_level: int = 7
    confidence: int = 50
    alt_translations: list[str] = []
    caption: str = ""
    disclaimer: str = ""


class HighlightsRequest(BaseModel):
    post_text: str = Field(..., min_length=1, max_length=5000)


class Highlight(BaseModel):
    phrase: str
    meaning: str


class HighlightsResponse(BaseModel):
    highlights: list[Highlight] = []
