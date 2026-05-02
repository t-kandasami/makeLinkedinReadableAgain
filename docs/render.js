// Shared meme-card renderer.
// Loaded by both the website's live demo and the userscript's popup window.
// Exposes window.renderMemeCard(rootEl, data) and window.renderError(rootEl, msg).

(function (global) {
  var TAG = '[render.js]';
  console.log(TAG, 'loaded');

  // Prime the voice list — Chrome populates it asynchronously, so a first call
  // here means it's usually ready by the time the user clicks Speak.
  if ('speechSynthesis' in global) {
    try { global.speechSynthesis.getVoices(); } catch (_) {}
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        }
        else node.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  // Inline SVG so it works without external assets and inherits currentColor.
  var SPEAKER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

  // Spice-driven voice modulation:
  //   spice 1  → pitch 1.40, rate 0.85  (gentle, sympathetic)
  //   spice 5  → pitch 1.00, rate 1.00  (neutral narrator)
  //   spice 10 → pitch 0.40, rate 1.30  (deep, rushed, menacing)
  function speakTranslation(t, callbacks) {
    callbacks = callbacks || {};
    if (!('speechSynthesis' in global)) {
      alert('Your browser does not support text-to-speech.');
      return false;
    }
    const text = (t.real_life_translation || '').trim();
    if (!text) return false;
    const spice = Math.max(1, Math.min(10, t.spice_level || 5));

    global.speechSynthesis.cancel(); // stop anything in progress
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 1.4 - (spice - 1) * (1.0 / 9);
    u.rate  = 0.85 + (spice - 1) * (0.45 / 9);
    u.volume = 1;

    const voices = global.speechSynthesis.getVoices();
    if (voices.length) {
      const wanted = spice >= 7
        ? ['Microsoft David', 'Daniel', 'Google UK English Male', 'Alex']
        : ['Samantha', 'Karen', 'Google US English', 'Google UK English Female'];
      const match = voices.find(v => wanted.some(n => v.name.includes(n)));
      if (match) u.voice = match;
    }

    u.onstart = callbacks.onStart || null;
    u.onend = callbacks.onEnd || null;
    u.onerror = callbacks.onEnd || null;

    console.log(TAG, 'speaking', { spice, pitch: u.pitch.toFixed(2), rate: u.rate.toFixed(2), voice: u.voice && u.voice.name });
    global.speechSynthesis.speak(u);
    return true;
  }

  function buildSpeakButton(t) {
    if (!('speechSynthesis' in global)) return null; // hide on unsupported browsers
    const btn = el('button', {
      type: 'button',
      class: 'speak-btn',
      title: 'Read the translation aloud',
      'aria-label': 'Speak translation',
      html: SPEAKER_SVG + '<span>Speak</span>',
    });
    let speaking = false;
    btn.addEventListener('click', () => {
      if (speaking) {
        global.speechSynthesis.cancel();
        return;
      }
      speakTranslation(t, {
        onStart: () => { speaking = true; btn.classList.add('speaking'); },
        onEnd:   () => { speaking = false; btn.classList.remove('speaking'); },
      });
    });
    return btn;
  }

  // Wrap each highlight phrase (case-insensitive, longest-first) in a tooltip span.
  function renderOriginal(text, highlights) {
    const wrap = el('p', { class: 'original-text' });
    if (!highlights || !highlights.length) {
      wrap.textContent = text;
      return wrap;
    }
    const sorted = [...highlights].sort((a, b) => b.phrase.length - a.phrase.length);
    let segments = [{ text, highlighted: false }];
    for (const { phrase, meaning } of sorted) {
      if (!phrase) continue;
      const next = [];
      for (const seg of segments) {
        if (seg.highlighted) { next.push(seg); continue; }
        const idx = seg.text.toLowerCase().indexOf(phrase.toLowerCase());
        if (idx === -1) { next.push(seg); continue; }
        if (idx > 0) next.push({ text: seg.text.slice(0, idx), highlighted: false });
        next.push({
          text: seg.text.slice(idx, idx + phrase.length),
          highlighted: true,
          meaning,
        });
        const tail = seg.text.slice(idx + phrase.length);
        if (tail) next.push({ text: tail, highlighted: false });
      }
      segments = next;
    }
    for (const seg of segments) {
      if (seg.highlighted) {
        wrap.appendChild(el('span', { class: 'cliche', title: seg.meaning }, seg.text));
      } else {
        wrap.appendChild(document.createTextNode(seg.text));
      }
    }
    return wrap;
  }

  function spiceMeter(level) {
    const wrap = el('div', { class: 'spice-meter', title: `Spice ${level}/10` });
    for (let i = 1; i <= 10; i++) {
      wrap.appendChild(el('span', { class: 'spice-tick' + (i <= level ? ' on' : '') }));
    }
    wrap.appendChild(el('span', { class: 'spice-label' }, `${level}/10`));
    return wrap;
  }

  function renderTranslation(t) {
    const card = el('div', { class: 'translation-card' });
    card.appendChild(el('div', { class: 'card-header' },
      el('span', { class: 'category-badge' }, t.category || 'Other'),
      spiceMeter(t.spice_level ?? 5)
    ));
    card.appendChild(el('p', { class: 'translation-main' }, t.real_life_translation || ''));
    const speakBtn = buildSpeakButton(t);
    if (speakBtn) card.appendChild(speakBtn);
    if (t.tags && t.tags.length) {
      const tagsEl = el('div', { class: 'tags' });
      for (const tag of t.tags) tagsEl.appendChild(el('span', { class: 'tag' }, tag));
      card.appendChild(tagsEl);
    }
    if (t.alt_translations && t.alt_translations.length) {
      const alts = el('div', { class: 'alts' }, el('h4', null, 'Other readings'));
      for (const a of t.alt_translations) alts.appendChild(el('p', { class: 'alt' }, a));
      card.appendChild(alts);
    }
    const footer = el('div', { class: 'card-footer' });
    if (t.caption) footer.appendChild(el('p', { class: 'caption' }, t.caption));
    const disclaimerText = (t.disclaimer || '') +
      (t.confidence != null ? ` · confidence ${t.confidence}%` : '');
    if (disclaimerText.trim()) {
      footer.appendChild(el('p', { class: 'disclaimer' }, disclaimerText));
    }
    card.appendChild(footer);
    return card;
  }

  function renderMemeCard(root, data) {
    console.log(TAG, 'renderMemeCard called', { rootTag: root && root.tagName, data });
    root.innerHTML = '';
    const card = el('div', { class: 'meme-card' },
      el('div', { class: 'meme-col left' },
        el('h3', { class: 'col-label' }, 'LinkedIn'),
        renderOriginal(data.original || '', data.highlights || [])
      ),
      el('div', { class: 'meme-col right' },
        el('h3', { class: 'col-label' }, 'Real Life'),
        renderTranslation(data.translation || {})
      )
    );
    root.appendChild(card);
  }

  function renderError(root, msg) {
    root.innerHTML = '';
    const box = el('div', { class: 'error' });
    box.appendChild(el('strong', null, 'Translation failed.'));
    box.appendChild(el('br'));
    box.appendChild(document.createTextNode(msg || 'Unknown error.'));
    root.appendChild(box);
  }

  global.renderMemeCard = renderMemeCard;
  global.renderError = renderError;
})(typeof window !== 'undefined' ? window : globalThis);
