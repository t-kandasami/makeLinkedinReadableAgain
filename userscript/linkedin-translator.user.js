// ==UserScript==
// @name         LinkedIn Translator: Savage Truth
// @namespace    https://github.com/asish-stupid-hackathon
// @version      0.1.3
// @description  Reveal the hidden emotional truth behind corporate LinkedIn posts.
// @author       Stupid Hackathon Singapore 2026
// @match        https://www.linkedin.com/*
// @grant        none
// ==/UserScript==

// v0.1.3: open the popup at the BACKEND's loading.html URL, then navigate
// to popup.html#<json-data>. The popup's origin is localhost:8000, which has
// no CSP, so style.css + render.js + inline scripts all run normally.
// (v0.1.2 used blob: URLs but those still inherit linkedin.com's CSP.)

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

  function navigatePopup(popup, payload) {
    if (!popup || popup.closed) {
      console.warn(TAG, 'popup unavailable for navigation');
      return;
    }
    const hash = encodeURIComponent(JSON.stringify(payload));
    popup.location.href = `${BACKEND}/popup.html#${hash}`;
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

    // Open the popup at the backend's loading page. Popup's origin is
    // localhost:8000, so linkedin.com's CSP doesn't apply.
    const popup = window.open(`${BACKEND}/loading.html`, 'lt-savage', 'width=960,height=640');
    if (!popup) {
      console.error(TAG, 'popup was blocked by the browser');
      alert('Popup blocked. Allow popups for linkedin.com in your browser, then try again.');
      busy = false;
      floatingBtn.disabled = false;
      floatingBtn.textContent = 'Translate';
      console.groupEnd();
      return;
    }
    console.log('popup opened at', `${BACKEND}/loading.html`);

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

      navigatePopup(popup, { original: text, translation, highlights });
      console.log('popup navigated to result page');
    } catch (err) {
      console.error(TAG, 'error during translation:', err);
      navigatePopup(popup, { error: err.message });
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

  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('mousedown', (e) => {
    if (floatingBtn && e.target === floatingBtn) return;
    if (!getSelectionText()) hideButton();
  });
})();
