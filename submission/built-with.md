# Built With

Devpost's "Built With" field accepts individual tags — paste these in one at a time:

```
python
fastapi
pydantic
uvicorn
openai
gpt-4o-mini
docker
docker-compose
javascript
html
css
tampermonkey
gm-xmlhttprequest
github-pages
```

---

If you'd rather paste a prose summary somewhere:

**Backend:** Python 3.12 · FastAPI · Pydantic · Uvicorn · OpenAI Python SDK (gpt-4o-mini, JSON-output mode) · Docker · Docker Compose

**Frontend:** Vanilla JavaScript · HTML · CSS · Tampermonkey userscript with `GM_xmlhttpRequest` for CSP-bypassing fetches · static showcase site deployed to GitHub Pages

**Architecture:** Three independent units talking through stable JSON contracts — userscript on linkedin.com, FastAPI backend in Docker on localhost, static site served by both the backend at `/` and GitHub Pages at `/docs`. One shared meme-card renderer (`render.js`) used by both the popup window and the live-demo widget.
