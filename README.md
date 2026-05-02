# LinkedIn Translator: Savage Truth

An AI-powered LinkedIn translator that reveals the hidden emotional truth behind corporate posts. **Real life vs LinkedIn.**

Built for the **Singapore Stupid Hackathon 2026** &mdash; May 2nd, SMU Connexion, Jay & Marilyn Ng Greenhouse, Level 4.

---

## What it does

You highlight any cringe LinkedIn post. A floating **Translate** button appears next to your selection. Click it. A new window pops open showing:

- **Left side:** the original post, with corporate clichés underlined. Hover any underlined phrase for the plain-English meaning.
- **Right side:** a "Real Life Translation" meme card &mdash; category, blunt restatement, alternate readings, spice meter, tags, caption.

A **live demo** is also served at `http://localhost:8000/` once the backend is running, so judges (or you) can play with it without installing the userscript.

---

## Architecture

```
┌──────────────────────────────────────────┐
│  Browser tab on linkedin.com             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Tampermonkey userscript            │  │
│  │  · watches for text selection      │  │
│  │  · shows floating "Translate" btn  │  │
│  │  · on click: fetch both endpoints  │  │
│  │  · opens popup, writes HTML in     │  │
│  └─────────────┬──────────────────────┘  │
│                │ fetch (CORS)            │
└────────────────┼─────────────────────────┘
                 ▼
       http://localhost:8000
┌─────────────────────────────────────────┐
│  FastAPI backend (Docker container)     │
│   POST /translate  → SavageTruth JSON   │
│   POST /highlights → cliché map JSON    │
│   GET  /            → showcase site     │
│   reads OPENAI_API_KEY from env         │
└─────────────┬───────────────────────────┘
              │ openai-python SDK, JSON mode
              ▼
        OpenAI gpt-4o-mini
```

Three independent units, one job each:

- **Tampermonkey userscript** &mdash; trigger + render. Knows nothing about OpenAI.
- **FastAPI backend** &mdash; OpenAI proxy + key vault. Knows nothing about HTML.
- **Static website** (served by the backend at `/`) &mdash; showcase + live demo + changelog.

The popup window opened by the userscript and the live-demo widget on the website both use the **same renderer** (`backend/static/render.js`). Single source of truth for the meme-card UI.

---

## Repo layout

```
smustuff/
├── README.md                          ← this file
├── .gitignore
├── docker-compose.yml                 ← `docker compose up --build`
│
├── backend/
│   ├── main.py                        ← FastAPI: /translate, /highlights, /healthz, mounts /
│   ├── prompts.py                     ← system + user prompts (verbatim)
│   ├── schemas.py                     ← Pydantic request/response models
│   ├── requirements.txt
│   ├── Dockerfile                     ← python:3.12-slim → uvicorn
│   ├── .dockerignore
│   ├── .env.example                   ← OPENAI_API_KEY=sk-...
│   ├── test.sh                        ← 5 curl smoke tests
│   └── static/                        ← served at GET /
│       ├── index.html                 ← showcase + live demo + changelog
│       ├── style.css                  ← shared styling
│       ├── render.js                  ← meme-card renderer (single source)
│       └── demo.js                    ← wires the live demo widget
│
└── userscript/
    └── linkedin-translator.user.js    ← Tampermonkey script
```

---

## Running locally

### 1. Install Docker

[Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux). Verify with `docker --version` and `docker compose version`.

### 2. Set your OpenAI key

```bash
cd backend
cp .env.example .env
# edit .env: OPENAI_API_KEY=sk-your-real-key
cd ..
```

### 3. Start the backend

From the project root:

```bash
docker compose up --build
```

Backend boots at `http://localhost:8000`. Open that URL &mdash; you should see the showcase page.

The volume mount in `docker-compose.yml` plus uvicorn's `--reload` means edits to `backend/` reload instantly without rebuilding the image.

### 4. (Without Docker) Run uvicorn directly

If you want a faster dev loop and have Python 3.12+ installed:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 5. Install the userscript

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open `userscript/linkedin-translator.user.js` in your browser. Tampermonkey will detect the metadata header and offer to install.
3. Visit linkedin.com. Highlight any post. Click the floating **Translate** button.

---

## API

### `POST /translate`

Request:
```json
{ "post_text": "...", "mode": "SavageTruth", "spice": 7, "audience": "general internet" }
```
(Last three fields are optional and default to those values.)

Response:
```json
{
  "category": "Humblebrag",
  "real_life_translation": "I got promoted and want everyone to clap.",
  "tags": ["Humblebrag", "Promotion", "FakeHumility"],
  "spice_level": 7,
  "confidence": 84,
  "alt_translations": ["Watch me pretend this is humility.", "New title, same energy."],
  "caption": "When 'humbled' means 'someone please congratulate me'",
  "disclaimer": "Translation may not reflect actual feelings."
}
```

### `POST /highlights`

Request:
```json
{ "post_text": "..." }
```

Response:
```json
{
  "highlights": [
    {"phrase": "Thrilled to announce", "meaning": "I want you to clap"},
    {"phrase": "humbled", "meaning": "not actually humble"}
  ]
}
```

### `GET /healthz`

Returns `{"ok": true, "model": "gpt-4o-mini"}`. Use it to verify the container booted.

### `GET /`

Serves `static/index.html` and friends. The showcase + live demo + changelog page.

---

## Smoke tests

```bash
bash backend/test.sh
```

Five checks: healthz, translate happy path, highlights happy path, validation rejects empty input, CORS preflight from `linkedin.com` origin. Re-run before demoing.

---

## Demo path (16:30 showcase)

1. `docker compose up` &mdash; verify it's running.
2. Open `http://localhost:8000/` &mdash; judges see the showcase page.
3. Scroll to the live demo &mdash; paste a real LinkedIn humblebrag, click Translate, meme card renders inline.
4. Open a new tab to linkedin.com &mdash; highlight any cringe post, click the floating Translate button, popup opens with the same card.
5. If the userscript breaks live, the website demo still works. Belt + suspenders.

---

## Updating the project

The website (`backend/static/index.html`) and this README must be updated whenever code changes. The changelog list at the bottom of the website is the living history &mdash; add an entry there for every meaningful change.

---

## Hackathon checklist

- [ ] `.env` has a real OpenAI key
- [ ] `docker compose up` boots cleanly
- [ ] `bash backend/test.sh` passes
- [ ] Tampermonkey userscript installed in demo browser
- [ ] LinkedIn tab open with a juicy humblebrag pre-loaded
- [ ] Showcase page open in another tab as fallback
- [ ] DevPost submission has the GitHub link

---

## Credits

- Hackers: this team
- Hosts: Ahnaf Khan, Shrujan Beesetty, Asish Moturu, Kai
- Model: OpenAI `gpt-4o-mini`
- Stack: FastAPI &middot; Pydantic &middot; Docker &middot; Tampermonkey
