// ==UserScript==
// @name         LinkedIn Translator: Savage Truth
// @namespace    https://github.com/asish-stupid-hackathon
// @version      0.1.0
// @description  Reveal the hidden emotional truth behind corporate LinkedIn posts.
// @author       Stupid Hackathon Singapore 2026
// @match        https://www.linkedin.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BACKEND = 'http://localhost:8000';
  let floatingBtn = null;
  let busy = false;

  function ensureButton() {
    if (floatingBtn) return floatingBtn;
    floatingBtn = document.createElement('button');
    floatingBtn.textContent = 'Translate';
    floatingBtn.id = 'lt-savage-btn';
    Object.assign(floatingBtn.style, {
      position: 'absolute',
      zIndex: '999999',
      background: '#d11149',
      color: 'white',
      border: 'none',
      borderRadius: '999px',
      padding: '6px 14px',
      fontWeight: '600',
      fontSize: '13px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      display: 'none',
      lineHeight: '1.3',
    });
    floatingBtn.addEventListener('mousedown', (e) => e.preventDefault());
    floatingBtn.addEventListener('click', onTranslateClick);
    document.body.appendChild(floatingBtn);
    return floatingBtn;
  }

  function getSelectionText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const text = sel.toString().trim();
    return text.length >= 2 ? text : null;
  }

  function positionButton() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { hideButton(); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { hideButton(); return; }
    const btn = ensureButton();
    btn.style.display = 'block';
    btn.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    btn.style.left = (window.scrollX + Math.max(rect.right - 90, rect.left)) + 'px';
  }

  function hideButton() {
    if (floatingBtn) floatingBtn.style.display = 'none';
  }

  function onSelectionChange() {
    if (busy) return;
    if (getSelectionText()) positionButton();
    else hideButton();
  }

  async function onTranslateClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const text = getSelectionText();
    if (!text) return;

    busy = true;
    floatingBtn.disabled = true;
    floatingBtn.textContent = 'Translating...';

    // Open the popup synchronously inside the click handler so popup blockers don't fire.
    const popup = window.open('about:blank', 'lt-savage', 'width=960,height=640');

    try {
      const [translateResp, highlightsResp] = await Promise.all([
        fetch(`${BACKEND}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_text: text }),
        }),
        fetch(`${BACKEND}/highlights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_text: text }),
        }),
      ]);

      if (!translateResp.ok) {
        throw new Error(`translate ${translateResp.status}: ${await translateResp.text()}`);
      }
      const translation = await translateResp.json();
      const highlights = highlightsResp.ok
        ? (await highlightsResp.json()).highlights
        : [];

      writePopupHTML(popup, { original: text, translation, highlights });
    } catch (err) {
      writePopupError(popup, err.message);
    } finally {
      busy = false;
      if (floatingBtn) {
        floatingBtn.disabled = false;
        floatingBtn.textContent = 'Translate';
      }
      hideButton();
    }
  }

  function writePopupHTML(popup, data) {
    if (!popup) return;
    const json = JSON.stringify(data);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LinkedIn Translator &mdash; Savage Truth</title>
  <link rel="stylesheet" href="${BACKEND}/style.css">
</head>
<body class="popup-body">
  <div id="root"></div>
  <script src="${BACKEND}/render.js"><\/script>
  <script>
    var __DATA__ = ${json};
    window.renderMemeCard(document.getElementById('root'), __DATA__);
  <\/script>
</body>
</html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  function writePopupError(popup, msg) {
    if (!popup) return;
    const safe = String(msg).replace(/</g, '&lt;');
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Error</title>
<link rel="stylesheet" href="${BACKEND}/style.css"></head>
<body class="popup-body">
  <div class="error">
    <strong>Translation failed.</strong><br>
    ${safe}<br><br>
    <em>Is the backend running on ${BACKEND}? Try <code>docker compose up</code> from the project root.</em>
  </div>
</body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('mousedown', (e) => {
    if (floatingBtn && e.target === floatingBtn) return;
    if (!getSelectionText()) hideButton();
  });
})();
