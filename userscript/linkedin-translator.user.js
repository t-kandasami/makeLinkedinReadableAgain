// ==UserScript==
// @name         LinkedIn Translator: Savage Truth
// @namespace    https://github.com/asish-stupid-hackathon
// @version      0.1.5
// @description  Reveal the hidden emotional truth behind corporate LinkedIn posts. Powered by chickens.
// @author       Stupid Hackathon Singapore 2026
// @match        https://www.linkedin.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

// v0.1.4: linkedin.com's connect-src CSP blocks page-context fetch() to
// localhost. Switched to Tampermonkey's GM_xmlhttpRequest, which runs in the
// extension process and bypasses page CSP. Requires @connect declarations.

(function () {
  'use strict';

  const BACKEND = 'http://localhost:8000';
  const TAG = '[LinkedInTranslator]';
  let floatingBtn = null;
  let busy = false;

  console.log(TAG, 'userscript loaded, backend =', BACKEND);

  // Wrap GM_xmlhttpRequest in a Promise so we can await it like fetch().
  function gmFetch(options) {
    return new Promise((resolve, reject) => {
      const req = {
        method: 'GET',
        responseType: 'json',
        timeout: 30000,
        ...options,
        onload: resolve,
        onerror: (e) => reject(new Error('Network error: backend unreachable on ' + BACKEND)),
        ontimeout: () => reject(new Error('Request timed out (30s)')),
        onabort: () => reject(new Error('Request aborted')),
      };
      // Prefer the modern GM.xmlHttpRequest if available, fall back to the legacy name.
      if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
        GM.xmlHttpRequest(req);
      } else if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest(req);
      } else {
        reject(new Error('Tampermonkey GM_xmlhttpRequest not available — is the @grant header correct?'));
      }
    });
  }

  function ensureButton() {
    if (floatingBtn) return floatingBtn;
    floatingBtn = document.createElement('button');
    floatingBtn.textContent = '🐔 Translate';
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

  // GM responses don't always populate `.response` correctly when the body is
  // empty — fall back to parsing responseText.
  function parseBody(resp) {
    if (resp.response && typeof resp.response === 'object') return resp.response;
    if (typeof resp.responseText === 'string' && resp.responseText.length) {
      try { return JSON.parse(resp.responseText); } catch (_) { /* fallthrough */ }
    }
    return null;
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
    floatingBtn.textContent = '🐔 Clucking...';

    const popup = window.open(`${BACKEND}/loading.html`, 'lt-savage', 'width=960,height=640');
    if (!popup) {
      console.error(TAG, 'popup was blocked by the browser');
      alert('Popup blocked. Allow popups for linkedin.com in your browser, then try again.');
      busy = false;
      floatingBtn.disabled = false;
      floatingBtn.textContent = '🐔 Translate';
      console.groupEnd();
      return;
    }
    console.log('popup opened at', `${BACKEND}/loading.html`);

    try {
      console.log('fetching (via GM_xmlhttpRequest)', `${BACKEND}/translate`, 'and', `${BACKEND}/highlights`);
      const body = JSON.stringify({ post_text: text });
      const [translateResp, highlightsResp] = await Promise.all([
        gmFetch({
          method: 'POST',
          url: `${BACKEND}/translate`,
          headers: { 'Content-Type': 'application/json' },
          data: body,
        }),
        gmFetch({
          method: 'POST',
          url: `${BACKEND}/highlights`,
          headers: { 'Content-Type': 'application/json' },
          data: body,
        }),
      ]);
      console.log('/translate status:', translateResp.status, translateResp.statusText);
      console.log('/highlights status:', highlightsResp.status, highlightsResp.statusText);

      if (translateResp.status < 200 || translateResp.status >= 300) {
        throw new Error(`translate ${translateResp.status}: ${translateResp.responseText || translateResp.statusText}`);
      }

      const translation = parseBody(translateResp);
      if (!translation) {
        throw new Error('translate returned an empty / unparseable body');
      }
      console.log('translation parsed:', translation);

      const highlightsBody = (highlightsResp.status >= 200 && highlightsResp.status < 300)
        ? parseBody(highlightsResp)
        : null;
      const highlights = (highlightsBody && highlightsBody.highlights) || [];
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
        floatingBtn.textContent = '🐔 Translate';
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
