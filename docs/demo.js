// Live demo wiring on the website. Calls the same endpoints the userscript does.
// Uses an absolute localhost URL so the page works both on the local backend
// (http://localhost:8000/) and when deployed to GitHub Pages — in either case
// the visitor needs the FastAPI backend running on localhost:8000.

(function () {
  const BACKEND = 'http://localhost:8000';

  const form = document.getElementById('demo-form');
  const input = document.getElementById('demo-input');
  const submit = document.getElementById('demo-submit');
  const output = document.getElementById('demo-output');

  function friendlyError(err) {
    // fetch() to an unreachable host throws a TypeError with browser-specific text.
    if (err && (err.name === 'TypeError' || /fetch/i.test(err.message))) {
      return `Backend unreachable at ${BACKEND}. Start it with \`docker compose up\` from the project root, then retry.`;
    }
    return err && err.message ? err.message : 'Unknown error.';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const post = input.value.trim();
    if (!post) return;

    submit.disabled = true;
    submit.textContent = 'Translating...';
    output.innerHTML = '<p class="demo-loading">Asking the AI to be brutally honest...</p>';

    try {
      const [translateResp, highlightsResp] = await Promise.all([
        fetch(`${BACKEND}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_text: post }),
        }),
        fetch(`${BACKEND}/highlights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_text: post }),
        }),
      ]);

      if (!translateResp.ok) {
        const err = await translateResp.text();
        throw new Error(`translate ${translateResp.status}: ${err}`);
      }
      const translation = await translateResp.json();
      const highlights = highlightsResp.ok
        ? (await highlightsResp.json()).highlights
        : [];

      window.renderMemeCard(output, { original: post, translation, highlights });
    } catch (err) {
      window.renderError(output, friendlyError(err));
    } finally {
      submit.disabled = false;
      submit.textContent = 'Translate';
    }
  });
})();
