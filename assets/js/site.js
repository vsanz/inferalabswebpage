/* INFERA Labs — progressive enhancement only. The page is fully usable without it. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- mobile navigation ------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false); toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1180) setOpen(false);
    });
  }

  /* ---- header shadow once scrolled --------------------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- reveal on scroll -------------------------------------------- */
  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return void initRest();
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = Number(el.getAttribute('data-delay') || 0);
        setTimeout(function () { el.classList.add('is-in'); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  initRest();

  function initRest() {
    /* ---- active section in nav ------------------------------------- */
    var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav a[href^="#"]'));
    var sections = links.map(function (a) {
      return document.querySelector(a.getAttribute('href'));
    }).filter(Boolean);
    if (sections.length && 'IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      sections.forEach(function (s) { spy.observe(s); });
    }

    /* ---- contact form ---------------------------------------------- */
    /* Set data-endpoint on the <form> to a Formspree (or similar) URL to post
       directly. Until then the form composes a pre-filled email instead, so it
       works today and upgrades with a one-line change. */
    var form = document.getElementById('contact-form');
    if (!form) return;

    /* Sector deep links (?sector=key#contact) preselect the dropdown, so every
       enquiry arrives already attributed to the sector it came from. */
    try {
      var key = new URLSearchParams(window.location.search).get('sector');
      if (key) {
        var opt = form.querySelector('option[data-key="' + key.replace(/"/g, '') + '"]');
        if (opt) opt.selected = true;
      }
    } catch (e) { /* older browsers: dropdown just keeps its default */ }
    var status = form.querySelector('.form-status');
    var say = function (msg, kind) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'form-status is-visible ' + kind;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.querySelector('.hp input') && form.querySelector('.hp input').value) return; // bot
      var data = new FormData(form);
      var endpoint = form.getAttribute('data-endpoint');
      var t = form.dataset;

      if (endpoint) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; }
        fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
          .then(function (r) {
            if (!r.ok) throw new Error('bad status');
            form.reset(); say(t.msgOk, 'ok');
          })
          .catch(function () { say(t.msgErr, 'err'); })
          .finally(function () { if (btn) btn.disabled = false; });
        return;
      }

      var lines = [];
      ['name', 'organisation', 'sector', 'message'].forEach(function (k) {
        var v = (data.get(k) || '').toString().trim();
        var label = form.querySelector('[name="' + k + '"]');
        var text = label && label.dataset.label ? label.dataset.label : k;
        if (v) lines.push(text + ': ' + v);
      });
      var reply = (data.get('email') || '').toString().trim();
      if (reply) lines.push(t.labelEmail + ': ' + reply);
      window.location.href = 'mailto:' + form.dataset.mailto +
        '?subject=' + encodeURIComponent(t.msgSubject) +
        '&body=' + encodeURIComponent(lines.join('\n'));
      say(t.msgMail, 'ok');
    });
  }
})();
