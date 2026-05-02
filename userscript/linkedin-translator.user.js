// ==UserScript==
// @name         LinkedIn Translator: Savage Truth
// @namespace    https://github.com/asish-stupid-hackathon
// @version      0.1.1
// @description  Reveal the hidden emotional truth behind corporate LinkedIn posts.
// @author       Stupid Hackathon Singapore 2026
// @match        https://www.linkedin.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BACKEND = 'http://localhost:8000';
  const TAG = '[LinkedInTranslator]';
  let floatingBtn = null;
  let busy = false;

  console.log(TAG, 'userscript loaded, backend =', BACKEND);

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
    if (!text) {
      console.warn(TAG, 'click with no selection');
      return;
    }

    console.group(TAG, 'translate clicked');
    console.log('selected text length:', text.length);
    console.log('selected text:', text);
    busy = true;
    floatingBtn.disabled = true;
    floatingBtn.textContent = 'Translating...';

    // Open the popup synchronously inside the click handler so popup blockers don't fire.
    const popup = window.open('about:blank', 'lt-savage', 'width=960,height=640');
    if (!popup) {
      console.error(TAG, 'popup was blocked by the browser');
      alert('Popup blocked. Allow popups for linkedin.com in your browser, then try again.');
      busy = false;
      floatingBtn.disabled = false;
      floatingBtn.textContent = 'Translate';
      console.groupEnd();
      return;
    }
    console.log('popup opened');

    // Immediate placeholder so a blank popup means document.write itself failed.
    writeLoadingHTML(popup, text);
    console.log('loading placeholder written into popup');

    try {
      console.log('fetching', `${BACKEND}/translate`, 'and', `${BACKEND}/highlights`);
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
      console.log('/translate status:', translateResp.status, translateResp.statusText);
      console.log('/highlights status:', highlightsResp.status, highlightsResp.statusText);

      if (!translateResp.ok) {
        const body = await translateResp.text();
        throw new Error(`translate ${translateResp.status}: ${body}`);
      }
      const translation = await translateResp.json();
      console.log('translation parsed:', translation);
      const highlights = highlightsResp.ok
        ? (await highlightsResp.json()).highlights
        : [];
      console.log('highlights count:', highlights.length, highlights);

      writePopupHTML(popup, { original: text, translation, highlights });
      console.log('popup HTML written, render.js URL:', `${BACKEND}/render.js`);
    } catch (err) {
      console.error(TAG, 'error during translation:', err);
      writePopupError(popup, err.message);
    } finally {
      busy = false;
      if (floatingBtn) {
        floatingBtn.disabled = false;
        floatingBtn.textContent = 'Translate';
      }
      hideButton();
      console.groupEnd();
    }
  }

  function writeLoadingHTML(popup, text) {
    if (!popup || popup.closed) return;
    const safe = String(text).slice(0, 400).replace(/</g, '&lt;');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Translating&hellip;</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; padding: 32px; color: #333; background: #f3f2ef; }
    h2 { margin-top: 0; }
    .hint { color: #666; font-size: 13px; margin-top: 24px; }
    pre { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; white-space: pre-wrap; max-height: 200px; overflow: auto; }
  </style>
</head>
<body>
  <h2>Translating&hellip;</h2>
  <p>Asking the AI to be brutally honest. This usually takes 1&ndash;3 seconds.</p>
  <details><summary>Selected text (${text.length} chars)</summary><pre>${safe}</pre></details>
  <p class="hint">If this page never updates, open the linkedin.com tab's DevTools (F12) &rarr; Console, and look for <code>${TAG}</code> log lines. They'll tell you which step failed.</p>
</body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  function writePopupHTML(popup, data) {
    if (!popup || popup.closed) {
      console.warn(TAG, 'popup closed before HTML could be written');
      return;
    }
    // Inline JSON: replace `<` so a stray `</script>` in the data can't terminate our script tag.
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LinkedIn Translator &mdash; Savage Truth</title>
  <link rel="stylesheet" href="${BACKEND}/style.css" onerror="
    document.getElementById('lt-status').textContent='style.css failed to load from ${BACKEND}/style.css — check that the backend is running and serving it.';
    document.getElementById('lt-status').style.color='#d11149';
  ">
  <style>
    /* Minimal fallback so the page isn't pure white if style.css fails. */
    body { font-family: system-ui, sans-serif; padding: 24px; background: #f3f2ef; color: #1d2226; }
    #lt-status { font-size: 13px; color: #56687a; margin-bottom: 12px; }
    #lt-debug { margin-top: 24px; font-size: 12px; color: #56687a; }
    #lt-debug pre { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; white-space: pre-wrap; max-height: 320px; overflow: auto; }
  </style>
</head>
<body class="popup-body">
  <div id="lt-status">Loading renderer&hellip;</div>
  <div id="root"></div>
  <details id="lt-debug">
    <summary>Debug data (raw API responses)</summary>
    <pre id="lt-debug-data"></pre>
  </details>
  <script src="${BACKEND}/render.js" onerror="
    document.getElementById('lt-status').textContent='render.js failed to load from ${BACKEND}/render.js — check that the backend is running and serving it.';
    document.getElementById('lt-status').style.color='#d11149';
    console.error('[LinkedInTranslator popup] render.js failed to load');
  "><\/script>
  <script>
    (function () {
      var TAG = '[LinkedInTranslator popup]';
      var data = ${json};
      console.log(TAG, 'inline init, data:', data);
      try {
        document.getElementById('lt-debug-data').textContent = JSON.stringify(data, null, 2);
        if (typeof window.renderMemeCard !== 'function') {
          throw new Error('window.renderMemeCard is not a function — render.js did not load or did not register the function');
        }
        window.renderMemeCard(document.getElementById('root'), data);
        document.getElementById('lt-status').textContent = '';
        console.log(TAG, 'render complete');
      } catch (e) {
        var status = document.getElementById('lt-status');
        status.textContent = 'Render error: ' + e.message;
        status.style.color = '#d11149';
        console.error(TAG, 'render error:', e);
      }
    })();
  <\/script>
</body>
</html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  function writePopupError(popup, msg) {
    if (!popup || popup.closed) return;
    const safe = String(msg).replace(/</g, '&lt;');
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Error</title>
<link rel="stylesheet" href="${BACKEND}/style.css">
<style>body{font-family:system-ui,sans-serif;padding:24px;background:#f3f2ef}</style>
</head>
<body class="popup-body">
  <div class="error" style="padding:16px;background:#ffe8ef;border:1px solid #d11149;border-radius:10px;color:#d11149">
    <strong>Translation failed.</strong><br>
    ${safe}<br><br>
    <em>Is the backend running on ${BACKEND}? Try <code>docker compose up</code> from the project root.</em>
  </div>
  <p style="margin-top:16px;color:#666;font-size:13px">Open the linkedin.com tab's DevTools (F12) &rarr; Console for the full <code>${TAG}</code> trace.</p>
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
