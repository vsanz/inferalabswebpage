/* INFERA Labs 2026 — hero forecast animation and demo tabs.
   Progressive enhancement: without it the page is complete (static hero panel,
   first demo tab open). Navigation, reveal and the contact form are in site.js. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- demo tabs --------------------------------------------------- */
  var tabs = document.querySelectorAll('[role="tab"]');
  Array.prototype.forEach.call(tabs, function (tab) {
    tab.addEventListener('click', function () {
      var list = tab.closest('[role="tablist"]');
      Array.prototype.forEach.call(list.querySelectorAll('[role="tab"]'), function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    });
    tab.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var all = Array.prototype.slice.call(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
      var i = all.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
      var next = all[(i + all.length) % all.length];
      next.focus(); next.click();
    });
  });

  /* ---- hero: a forecast with its uncertainty band ------------------ */
  /* Illustrative signal, not real data: an observed series up to "now",
     a forecast beyond it whose band widens with the horizon, and an alert
     when the upper edge of the band crosses the threshold. */
  var cv = document.getElementById('forecast');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var probEl = document.getElementById('fc-prob');
  var leadEl = document.getElementById('fc-lead');
  var stateEl = document.getElementById('fc-state');
  var labels = {
    obs: cv.getAttribute('data-l-obs') || 'observed',
    fc: cv.getAttribute('data-l-fc') || 'forecast',
    now: cv.getAttribute('data-l-now') || 'now',
    thr: cv.getAttribute('data-l-thr') || 'alert threshold',
    ok: cv.getAttribute('data-l-ok') || 'normal',
    alert: cv.getAttribute('data-l-alert') || 'early warning'
  };
  var W = 0, H = 0, dpr = 1;
  function size() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function signal(t) { // smooth, slowly varying, with a recurring peak
    return 0.42 + 0.13 * Math.sin(t * 0.9) + 0.07 * Math.sin(t * 2.3 + 1.3) + 0.04 * Math.sin(t * 5.1 + 0.4)
      + 0.22 * Math.exp(-Math.pow(((t % 12.6) - 9.5) / 1.1, 2));
  }
  var THR = 0.74;
  function draw(phase) {
    ctx.clearRect(0, 0, W, H);
    var padL = 14, padR = 14, padT = 26, padB = 26;
    var nowX = padL + (W - padL - padR) * 0.56;
    var span = 9;                       // time units across the panel
    var X = function (u) { return padL + (u / span) * (W - padL - padR); };
    var Y = function (v) { return padT + (1 - v) * (H - padT - padB); };
    var uNow = (nowX - padL) / (W - padL - padR) * span;

    // grid
    ctx.strokeStyle = 'rgba(167,182,201,0.10)'; ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) { var gy = padT + g * (H - padT - padB) / 4; ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke(); }

    // threshold
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(242,179,61,0.85)';
    ctx.beginPath(); ctx.moveTo(padL, Y(THR)); ctx.lineTo(W - padR, Y(THR)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(242,179,61,0.95)'; ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right'; ctx.fillText(labels.thr, W - padR, Y(THR) - 7);

    // uncertainty band (forecast)
    var steps = 60, first = true, alertAt = null, pmax = 0;
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var u = uNow + (span - uNow) * i / steps, h = (u - uNow);
      var m = signal(u + phase), w = 0.03 + 0.055 * h;
      var x = X(u), y = Y(m + w);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      if (alertAt === null && m + w > THR) alertAt = u;
      var p = Math.max(0, Math.min(1, (m + w - THR) / (2 * w)));
      pmax = Math.max(pmax, p);
    }
    for (var j = steps; j >= 0; j--) {
      var u2 = uNow + (span - uNow) * j / steps, h2 = (u2 - uNow);
      ctx.lineTo(X(u2), Y(signal(u2 + phase) - (0.03 + 0.055 * h2)));
    }
    ctx.closePath();
    var grad = ctx.createLinearGradient(nowX, 0, W, 0);
    grad.addColorStop(0, 'rgba(60,196,189,0.32)'); grad.addColorStop(1, 'rgba(60,196,189,0.08)');
    ctx.fillStyle = grad; ctx.fill();

    // forecast median
    ctx.beginPath();
    for (var k = 0; k <= steps; k++) {
      var u3 = uNow + (span - uNow) * k / steps;
      var y3 = Y(signal(u3 + phase));
      if (k === 0) ctx.moveTo(X(u3), y3); else ctx.lineTo(X(u3), y3);
    }
    ctx.strokeStyle = '#3cc4bd'; ctx.lineWidth = 2; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);

    // observed history
    ctx.beginPath();
    for (var n = 0; n <= 90; n++) {
      var u4 = uNow * n / 90, noise = 0.012 * Math.sin((u4 + phase) * 23.0) + 0.008 * Math.sin((u4 + phase) * 41.0);
      var y4 = Y(signal(u4 + phase) + noise);
      if (n === 0) ctx.moveTo(X(u4), y4); else ctx.lineTo(X(u4), y4);
    }
    ctx.strokeStyle = '#e8eef6'; ctx.lineWidth = 2; ctx.stroke();

    // now marker
    ctx.strokeStyle = 'rgba(232,238,246,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(nowX, padT - 8); ctx.lineTo(nowX, H - padB + 6); ctx.stroke();
    ctx.fillStyle = '#e8eef6'; ctx.beginPath(); ctx.arc(nowX, Y(signal(uNow + phase)), 4, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(167,182,201,0.9)'; ctx.textAlign = 'center';
    ctx.fillText(labels.now, nowX, H - 8);
    ctx.textAlign = 'left'; ctx.fillText(labels.obs, padL, H - 8);
    ctx.textAlign = 'right'; ctx.fillText(labels.fc, W - padR, H - 8);

    // alert marker
    if (alertAt !== null) {
      var ax = X(alertAt), ay = Y(THR);
      ctx.fillStyle = 'rgba(242,179,61,0.18)'; ctx.beginPath(); ctx.arc(ax, ay, 12, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#f2b33d'; ctx.beginPath(); ctx.arc(ax, ay, 4.5, 0, 6.283); ctx.fill();
    }
    if (probEl) {
      probEl.textContent = Math.round(pmax * 100) + ' %';
      probEl.classList.toggle('warn', pmax > 0.3);
    }
    if (leadEl) leadEl.textContent = alertAt === null ? '—' : '+' + Math.round((alertAt - uNow) * 8) + ' h';
    if (stateEl) {
      stateEl.textContent = alertAt === null ? labels.ok : labels.alert;
      stateEl.classList.toggle('warn', alertAt !== null);
    }
  }

  var phase = 2.0, last = 0, running = true;
  function frame(ts) {
    if (!running) return;
    if (!last) last = ts;
    phase += Math.min(0.05, (ts - last) / 1000) * 0.35;
    last = ts;
    draw(phase);
    requestAnimationFrame(frame);
  }
  size();
  draw(phase);
  window.addEventListener('resize', function () { size(); draw(phase); });
  if (!reduce) {
    // pause when the hero is off screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var was = running; running = e.isIntersecting;
          if (running && !was) { last = 0; requestAnimationFrame(frame); }
        });
      }).observe(cv);
    }
    requestAnimationFrame(frame);
  }
})();
