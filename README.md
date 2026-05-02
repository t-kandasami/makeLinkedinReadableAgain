# 🐔 LinkedIn Translator: Savage Truth

An AI-powered chicken that pecks at corporate LinkedIn posts and tells you what they actually mean. **Real Life vs LinkedIn.**

Built for the **Singapore Stupid Hackathon 2026** &mdash; May 2nd, SMU Connexion, Jay & Marilyn Ng Greenhouse, Level 4.

---

## What it does

You highlight any cringe LinkedIn post. A floating **🐔 Translate** button appears next to your selection. Click it. A loading window opens with a chicken that follows your cursor and pecks at it (random *cluck!* / *bawk!* bursts included). 1&ndash;3 seconds later, a meme card replaces it:

- **Left side ("LinkedIn"):** the original post, with corporate clichés underlined in dotted red. Hover any underlined phrase for the plain-English meaning.
- **Right side ("Real Life"):** a "Real Life Translation" meme card &mdash; category badge, brutally honest 1&ndash;2 line restatement, alternate readings, 1&ndash;10 spice meter, tags, caption.

Each translation card has a **🔊 Speak button** that reads the line aloud using the browser's built-in text-to-speech &mdash; with **spice-driven voice modulation**. Spice 1 reads gentle and high-pitched; spice 10 reads deep, rushed, and menacing. Same translation, different vibes depending on how brutal the model rated the post.

A **live demo** is also served at `http://localhost:8000/` (and on GitHub Pages once deployed) so judges and other hackers can paste-and-translate without installing the userscript.

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

The popup window opened by the userscript and the live-demo widget on the website both use the **same renderer** (`docs/render.js`). Single source of truth for the meme-card UI &mdash; the local backend serves `/docs` at `/`, and GitHub Pages serves the same `/docs` folder publicly.

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
│   └── test.sh                        ← 5 curl smoke tests
│
├── docs/                              ← served at GET / locally AND by GitHub Pages
│   ├── index.html                     ← showcase + live demo + changelog
│   ├── style.css                      ← shared styling
│   ├── render.js                      ← meme-card renderer (single source)
│   └── demo.js                        ← wires the live demo widget
│
└── userscript/
    └── linkedin-translator.user.js    ← Tampermonkey script
```

---

## Installation guide

### Prerequisites

You'll need:

- A **Chromium-based browser** (Chrome, Edge, Brave) or **Firefox**.
- **Git** &mdash; verify with `git --version`.
- **Docker** + Docker Compose &mdash; [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Mac/Windows; `sudo apt install docker.io docker-compose-plugin` on Debian/Ubuntu. Verify: `docker --version && docker compose version`.
- An **OpenAI account** with API access and a payment method on file. Translations cost roughly **$0.01 each** with `gpt-4o-mini`.
- The **Tampermonkey** browser extension (installed in step 5 below).

### Step 1 &mdash; Clone the repo

```bash
git clone https://github.com/t-kandasami/makeLinkedinReadableAgain.git
cd makeLinkedinReadableAgain
```

### Step 2 &mdash; Get an OpenAI API key

1. Go to https://platform.openai.com/api-keys and sign in (creating an account requires adding a payment method).
2. Click **Create new secret key**.
3. Give it a name like `linkedin-translator-local` and click **Create**.
4. **Copy the `sk-...` value &mdash; OpenAI shows it only once.** Lose it and you have to make a new one.
5. **Recommended:** on the same dashboard, set a low monthly hard cap under **Usage limits** (e.g., $5) so a leak or runaway loop can't drain your account.

### Step 3 &mdash; Add your key to the project

From the repo root:

```bash
cp backend/.env.example backend/.env
```

(On Windows PowerShell: `Copy-Item backend\.env.example backend\.env`.)

Open `backend/.env` in any text editor and replace the placeholder:

```
OPENAI_API_KEY=sk-paste-your-real-key-here
```

`backend/.env` is already in `.gitignore`, so the key never gets committed.

### Step 4 &mdash; Start the backend

From the repo root:

```bash
docker compose up --build
```

The first run takes ~1 minute (pip install). Subsequent runs are seconds. You'll know it's working when the terminal shows:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**Leave this terminal open.** Open another terminal/tab for everything below.

**Verify with the smoke tests:**

```bash
bash backend/test.sh
```

If you see `all tests passed` you're good. If a test fails, check the backend terminal for an error (most often: bad / missing OpenAI key).

**Verify in the browser:** open http://localhost:8000 . You should see the showcase page with the live-demo widget. Paste a LinkedIn-style sentence, click **Translate**, and watch the meme card render. If that works, the backend is fully healthy.

### Step 5 &mdash; Install Tampermonkey

1. Install the extension from https://www.tampermonkey.net/ for your browser.
2. **Chrome / Edge / Brave only:** open `chrome://extensions` (or `edge://extensions`, `brave://extensions`) and toggle **Developer mode** on (top-right corner). This is a Chrome Manifest V3 requirement — Tampermonkey can't inject userscripts without it. Firefox users skip this step.

### Step 6 &mdash; Install the userscript

1. In your file manager, double-click `userscript/linkedin-translator.user.js`. (Alternatively: drag the file into a browser tab, or `xdg-open` it on Linux, `open` on Mac.)
2. Tampermonkey will detect the userscript metadata and show an install screen with the script's name, source, and `@match` rules.
3. Click **Install**.
4. Tampermonkey's dashboard (the extension icon → Dashboard) should now list **LinkedIn Translator: Savage Truth** with a green "enabled" toggle.

### Step 7 &mdash; Use it on LinkedIn

1. Visit https://www.linkedin.com (login optional &mdash; the script works on any public post).
2. Find a post. Humblebrags, "thrilled to announce," and conference-energy posts give the best translations.
3. **Highlight some text** with your cursor.
4. A red **🐔 Translate** button appears just below the selection.
5. Click it.
6. A loading window opens with a chicken that follows your cursor and pecks at it. Move your mouse around &mdash; the chicken will give chase. 1&ndash;3 seconds later the result replaces it:
   - **Left (LinkedIn):** the original post, with cliché phrases underlined. Hover any underline for the plain-English meaning.
   - **Right (Real Life):** category badge, the brutally honest translation, spice meter, tags, alternate readings, caption.
7. Click the **🔊 Speak** button on the translation card to hear it read aloud. The voice's pitch and speed change with the spice level &mdash; spice 1 sounds sympathetic, spice 10 sounds demonic.

That's it. Highlight more text, click Translate, get more translations. Each one costs about a US cent.

---

## Using the live demo (without the userscript)

If you don't want to install Tampermonkey, or you want to translate a post that's not on LinkedIn, use the live demo widget:

1. Make sure the backend is running (`docker compose up`).
2. Open http://localhost:8000 (or, once deployed, `https://<owner>.github.io/<repo>/`).
3. Paste any text into the textarea.
4. Click **Translate**.
5. The same meme card renders directly on the page.

---

## Running without Docker (faster dev loop)

If you have Python 3.12+ installed and want to avoid Docker rebuilds while editing the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Same `backend/.env` is read automatically. Same `http://localhost:8000` URL. Code changes hot-reload instantly.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose up` says "Cannot connect to the Docker daemon" | Docker Desktop isn't running, or on Linux your user isn't in the `docker` group (`sudo usermod -aG docker $USER`, then log out and back in). |
| Backend crashes with `OPENAI_API_KEY is not set` | Step 3 was skipped or `.env` still has `sk-replace-me`. |
| Backend boots but `/translate` returns **502** with `openai unreachable` | Wrong key, expired key, no payment method, or rate-limited. Check the backend terminal for the exact OpenAI error. |
| Userscript installed but no Translate button appears on linkedin.com | Tampermonkey toggle is off, OR Chrome's `Developer mode` is off (step 5), OR you're not on a `linkedin.com/*` URL, OR your selection is too short (under 2 characters). |
| Popup window shows "Backend unreachable" | `docker compose up` died or isn't running. Check the terminal where you started it. |
| Live demo widget shows "Backend unreachable at http://localhost:8000" | Same fix &mdash; backend isn't running. The live demo always calls `localhost:8000` even when loaded from GitHub Pages. |
| Translation appears but no clichés are underlined | The highlighter call returned an empty array (rare). The translation itself is still valid. |
| `bash backend/test.sh` says CORS preflight failed | The backend is running an older version. Rebuild: `docker compose up --build`. |

---

## Deploying the showcase to GitHub Pages

The static site lives in [`/docs`](docs/) so GitHub Pages can serve it directly.

1. Push to GitHub (`git push -u origin main`).
2. On GitHub, go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**. Branch: `main`, folder: `/docs`.
4. Save. After ~1 minute the page appears at `https://<owner>.github.io/<repo>/`.

**The live-demo widget on GitHub Pages calls `http://localhost:8000` directly.** That means the visitor must have the FastAPI backend running locally for it to work — there is no shared deployed backend. The CORS allowlist in `backend/main.py` already includes `https://t-kandasami.github.io`, so the cross-origin call works as long as `docker compose up` is running on the visitor's machine.

If you fork the repo to a different GitHub account, add your own `https://<your-user>.github.io` to the `allow_origins` list in [backend/main.py](backend/main.py).

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
2. Open `http://localhost:8000/` &mdash; judges see the chicken-themed showcase page.
3. Scroll to the live demo &mdash; paste a real LinkedIn humblebrag, click **🐔 Translate**, meme card renders inline.
4. Click the **🔊 Speak** button. Demonic voice reads a savage humblebrag aloud. Try a low-spice translation next so they hear how the voice changes.
5. Open a new tab to linkedin.com &mdash; highlight any cringe post, click the floating **🐔 Translate** button. Loading window opens with **chicken following the cursor and pecking it**. Move the mouse around so judges notice. Result replaces it.
6. If the userscript breaks live, the website demo still works. Belt + suspenders.

---

## Updating the project

The website ([`docs/index.html`](docs/index.html)) and this README must be updated whenever code changes. The changelog list at the bottom of the website is the living history &mdash; add an entry there for every meaningful change.

---

## Hackathon checklist

- [ ] `.env` has a real OpenAI key
- [ ] `docker compose up` boots cleanly
- [ ] `bash backend/test.sh` passes
- [ ] Tampermonkey userscript v0.1.5 installed in demo browser (chicken Translate button visible)
- [ ] Loading screen tested &mdash; chicken follows cursor, pecks at it
- [ ] 🔊 Speak button tested on a low-spice and a high-spice translation (verify the voice difference)
- [ ] LinkedIn tab open with a juicy humblebrag pre-loaded
- [ ] Showcase page open in another tab as fallback
- [ ] DevPost submission has the GitHub link

---

## Credits

- Hackers: this team
- Hosts: Ahnaf Khan, Shrujan Beesetty, Asish Moturu, Kai
- Model: OpenAI `gpt-4o-mini`
- Stack: FastAPI &middot; Pydantic &middot; Docker &middot; Tampermonkey
