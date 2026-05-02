// Shared meme-card renderer.
// Loaded by both the website's live demo and the userscript's popup window.
// Exposes window.renderMemeCard(rootEl, data) and window.renderError(rootEl, msg).

(function (global) {
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
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
