// Chicken cursor follower with pecking animation.
// Used by docs/loading.html and docs/chicken/index.html.
// Call window.startChicken({...}) after the page loads.
//
// The chicken's DOM is auto-injected if not present. CSS for the tracker,
// peck animation, and cluck-burst lives in docs/style.css.

(function (global) {
  function startChicken(opts) {
    opts = opts || {};
    const sounds = opts.sounds || ['cluck!', '*peck*', 'bawk!', 'pock!', 'cluck cluck'];
    const PECK_DISTANCE = opts.peckDistance || 110;
    const FOLLOW_EASE = opts.followEase || 0.10;
    const onPeck = opts.onPeck || function () {};

    let tracker = document.getElementById('chicken-tracker');
    if (!tracker) {
      tracker = document.createElement('div');
      tracker.id = 'chicken-tracker';
      tracker.className = 'chicken-tracker';
      tracker.setAttribute('aria-hidden', 'true');
      tracker.innerHTML =
        '<div class="chicken-face" id="chicken-face">' +
          '<div class="chicken-body">🐔</div>' +
        '</div>';
      document.body.appendChild(tracker);
    }
    const face = document.getElementById('chicken-face');

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let cx = mx, cy = my;
    let dir = 1;
    let lastBurst = 0;
    let peckCount = 0;

    document.addEventListener('mousemove', function (e) {
      mx = e.clientX;
      my = e.clientY;
    });

    function spawnCluck(x, y) {
      const word = sounds[Math.floor(Math.random() * sounds.length)];
      const el = document.createElement('div');
      el.className = 'cluck-burst';
      el.textContent = word;
      el.style.left = x + 'px';
      el.style.top = (y - 8) + 'px';
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 1100);
    }

    function tick() {
      cx += (mx - cx) * FOLLOW_EASE;
      cy += (my - cy) * FOLLOW_EASE;
      const dx = mx - cx;
      const dy = my - cy;
      const dist = Math.hypot(dx, dy);

      if (Math.abs(dx) > 8) dir = dx >= 0 ? 1 : -1;

      tracker.style.transform = 'translate(' + (cx - 28) + 'px, ' + (cy - 48) + 'px)';
      face.style.transform = 'scaleX(' + dir + ')';

      if (dist < PECK_DISTANCE) {
        if (!tracker.classList.contains('peck')) tracker.classList.add('peck');
        const now = performance.now();
        if (now - lastBurst > 600) {
          lastBurst = now;
          spawnCluck(mx, my);
          peckCount++;
          onPeck(peckCount);
        }
      } else {
        tracker.classList.remove('peck');
      }

      requestAnimationFrame(tick);
    }
    tick();
  }

  global.startChicken = startChicken;
})(typeof window !== 'undefined' ? window : globalThis);
