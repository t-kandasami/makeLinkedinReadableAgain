// Live demo wiring on the website. Calls the same endpoints the userscript does.

(function () {
  const form = document.getElementById('demo-form');
  const input = document.getElementById('demo-input');
  const submit = document.getElementById('demo-submit');
  const output = document.getElementById('demo-output');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const post = input.value.trim();
    if (!post) return;

    submit.disabled = true;
    submit.textContent = 'Translating...';
    output.innerHTML = '<p class="demo-loading">Asking the AI to be brutally honest...</p>';

    try {
      const [translateResp, highlightsResp] = await Promise.all([
        fetch('/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_text: post }),
        }),
        fetch('/highlights', {
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
      window.renderError(output, err.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Translate';
    }
  });
})();
