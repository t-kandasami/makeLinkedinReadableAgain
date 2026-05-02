import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from starlette.middleware.base import BaseHTTPMiddleware

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
        "https://t-kandasami.github.io",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class PrivateNetworkAccessMiddleware(BaseHTTPMiddleware):
    """Chrome's Private Network Access (CORS-RFC1918): a public-origin page
    fetching a private/local address must receive
    `Access-Control-Allow-Private-Network: true` on the preflight response,
    or the browser silently blocks the request. FastAPI's CORSMiddleware
    doesn't set this header, so the userscript on linkedin.com → localhost
    fails with `TypeError: Failed to fetch` until we add it ourselves.
    """

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.headers.get("access-control-request-private-network", "").lower() == "true":
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response


app.add_middleware(PrivateNetworkAccessMiddleware)


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
# Sourced from /docs at the repo root so GitHub Pages and the local backend
# serve identical content. Override STATIC_DIR to point elsewhere.
STATIC_DIR = os.environ.get("STATIC_DIR", "../docs")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
