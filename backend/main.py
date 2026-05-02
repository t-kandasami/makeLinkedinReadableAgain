import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI

from prompts import (
    HIGHLIGHTER_SYSTEM_PROMPT,
    TRANSLATOR_SYSTEM_PROMPT,
    build_highlighter_user_prompt,
    build_translator_user_prompt,
)
from schemas import (
    HighlightsRequest,
    HighlightsResponse,
    TranslateRequest,
    TranslateResponse,
)

load_dotenv()

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY or API_KEY == "sk-replace-me":
    raise RuntimeError(
        "OPENAI_API_KEY is not set. Copy backend/.env.example to backend/.env "
        "and put your real key there."
    )

MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

client = AsyncOpenAI(api_key=API_KEY)
app = FastAPI(title="LinkedIn Translator: Savage Truth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.linkedin.com",
        "https://linkedin.com",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


async def call_openai_json(system_prompt: str, user_prompt: str) -> dict:
    try:
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.8,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"openai unreachable: {e}")
    raw = resp.choices[0].message.content or ""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="openai returned malformed json")


@app.get("/healthz")
async def healthz():
    return {"ok": True, "model": MODEL}


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    user_prompt = build_translator_user_prompt(
        req.post_text, req.mode, req.spice, req.audience
    )
    data = await call_openai_json(TRANSLATOR_SYSTEM_PROMPT, user_prompt)
    return TranslateResponse(**data)


@app.post("/highlights", response_model=HighlightsResponse)
async def highlights(req: HighlightsRequest):
    user_prompt = build_highlighter_user_prompt(req.post_text)
    data = await call_openai_json(HIGHLIGHTER_SYSTEM_PROMPT, user_prompt)
    return HighlightsResponse(**data)


# Static site (showcase + live demo + changelog) at /
app.mount("/", StaticFiles(directory="static", html=True), name="static")
