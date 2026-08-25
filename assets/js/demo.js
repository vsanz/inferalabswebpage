/* INFERA demo player.
 * Renders any trace conforming to spec/trace.schema.json. Contains no
 * regulatory logic: everything it shows comes from the trace file.
 */
(function () {
  'use strict';

  var LABELS = {
    es: { parse:'Interpretación', retrieve:'Fuentes consultadas', answer:'Respuesta',
          refusal:'No puedo responder a esto', confidence:'Confianza',
          question:'Consulta', used:'usada', unused:'no usada',
          couldDo:'Lo que sí puedo hacer', escalate:'Derivar a',
          validated:'Validado por', notValidated:'sin validar', asOf:'datos a',
          placeholder:'Demostración del método. Contenido regulatorio pendiente de generar. No constituye asesoramiento.',
          unvalidated:'Demostración del método. Cada afirmación se cita literalmente contra su fuente oficial, pero ningún técnico agrónomo lo ha validado todavía. No constituye asesoramiento.' },
    en: { parse:'Interpretation', retrieve:'Sources consulted', answer:'Answer',
          refusal:'I can’t answer this', confidence:'Confidence',
          question:'Query', used:'used', unused:'not used',
          couldDo:'What I can do instead', escalate:'Escalate to',
          validated:'Validated by', notValidated:'not validated', asOf:'data as of',
          placeholder:'Method demonstration. Regulatory content not yet generated. This is not advice.',
          unvalidated:'Method demonstration. Every claim is quoted verbatim against its official source, but no agronomist has validated it yet. This is not advice.' }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function t(v, lang) { return v && typeof v === 'object' ? (v[lang] || v.es || v.en || '') : (v || ''); }

  function Player(root, traces) {
    var self = this;
    this.root = root;
    this.traces = traces;
    this.lang = (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
    this.index = this.indexFromHash();
    this.render();
    window.addEventListener('hashchange', function () {
      var i = self.indexFromHash();
      if (i !== self.index) { self.index = i; self.render(); }
    });
  }

  /* Each scenario is linkable as #<id>, so the refusal can be shared directly
     rather than being buried behind the answered ones. */
  Player.prototype.indexFromHash = function () {
    var id = (window.location.hash || '').replace(/^#/, '');
    var i = this.traces.findIndex(function (x) { return x.id === id; });
    return i >= 0 ? i : 0;
  };

  Player.prototype.L = function (k) { return LABELS[this.lang][k]; };

  Player.prototype.render = function () {
    var self = this, L = this.L.bind(this);
    this.root.innerHTML = '';
    this.root.classList.add('idemo');

    var tr = this.traces[this.index];

    /* status banner — never hidden while content is unvalidated */
    if (tr.status !== 'validated') {
      var bar = el('div', 'idemo-bar');
      bar.appendChild(el('b', null, tr.status === 'placeholder' ? '●' : '○'));
      bar.appendChild(el('span', null,
        L(tr.status === 'placeholder' ? 'placeholder' : 'unvalidated')));
      var sp = el('span', 'spacer');
      bar.appendChild(sp);
      bar.appendChild(this.langToggle());
      this.root.appendChild(bar);
    }

    /* profile chips */
    var prof = el('div', 'idemo-profile');
    Object.keys(tr.profile).forEach(function (k) {
      prof.appendChild(el('span', 'idemo-chip', k.replace(/_/g, ' ') + ': ' + tr.profile[k]));
    });
    this.root.appendChild(prof);

    /* scenario tabs */
    var tabs = el('div', 'idemo-tabs');
    tabs.setAttribute('role', 'tablist');
    this.traces.forEach(function (x, i) {
      var b = el('button', 'idemo-tab' + (x.kind === 'refusal' ? ' is-refusal' : ''));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === self.index));
      b.appendChild(el('span', 'n', String(i + 1).padStart(2, '0')));
      b.appendChild(document.createTextNode(t(x.title, self.lang)));
      b.addEventListener('click', function () {
        self.index = i;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '#' + x.id);
        }
        self.render();
      });
      tabs.appendChild(b);
    });
    this.root.appendChild(tabs);

    /* question */
    var q = el('div', 'idemo-q');
    q.appendChild(el('span', 'lbl', L('question')));
    q.appendChild(document.createTextNode(t(tr.question, this.lang)));
    this.root.appendChild(q);

    /* steps */
    var steps = el('div', 'idemo-steps');
    tr.steps.forEach(function (s) { steps.appendChild(self.step(s, tr)); });
    this.root.appendChild(steps);

    /* provenance footer */
    var foot = el('div', 'idemo-foot');
    (tr.source_versions || []).forEach(function (v) {
      foot.appendChild(el('span', null, v.name + (v.version ? ' v' + v.version : '') + ' · ' + L('asOf') + ' ' + v.as_of));
    });
    var val = el('span', tr.validated_by ? null : 'empty');
    val.textContent = L('validated') + ': ' + (tr.validated_by || '— ' + L('notValidated'));
    foot.appendChild(val);
    this.root.appendChild(foot);

    this.reveal(steps);
  };

  Player.prototype.langToggle = function () {
    var self = this, w = el('span', 'idemo-lang');
    ['es', 'en'].forEach(function (code) {
      var b = el('button', null, code.toUpperCase());
      b.setAttribute('aria-pressed', String(self.lang === code));
      b.addEventListener('click', function () { self.lang = code; self.render(); });
      w.appendChild(b);
    });
    return w;
  };

  Player.prototype.step = function (s, tr) {
    var self = this, lang = this.lang, L = this.L.bind(this);
    var box = el('div', 'idemo-step' + (s.type === 'refusal' ? ' refusal' : ''));

    var h = el('h4');
    h.appendChild(el('span', 'dot'));
    h.appendChild(document.createTextNode(L(s.type) || s.type));
    box.appendChild(h);

    if (s.type === 'parse') {
      box.appendChild(el('p', null, t(s.summary, lang)));

    } else if (s.type === 'retrieve') {
      var list = el('div', 'idemo-src');
      (s.sources || []).forEach(function (src) {
        var row = el('div', 'idemo-srcrow' + (src.used ? '' : ' unused'));
        row.appendChild(el('span', 'idemo-badge', src.authority + ' · ' + (src.used ? L('used') : L('unused'))));
        var body = el('div');
        body.appendChild(el('strong', null, t(src.title, lang)));
        body.appendChild(el('span', 'ref', src.ref + ' · ' + src.as_of));
        body.appendChild(el('div', 'snip', '“' + t(src.snippet, lang) + '”'));
        row.appendChild(body);
        list.appendChild(row);
      });
      box.appendChild(list);

    } else if (s.type === 'answer') {
      (s.blocks || []).forEach(function (b) {
        var wrap = el('div', 'idemo-block');
        var p = el('p');
        p.appendChild(document.createTextNode(t(b.text, lang)));
        (b.citations || []).forEach(function (c, ci) {
          var btn = el('button', 'idemo-cite', c.locator);
          var open = false;
          var cite = el('div', 'idemo-citebox');
          cite.hidden = true;
          var who = el('span', 'who');
          var src = ((tr.steps.find(function (x) { return x.type === 'retrieve'; }) || {}).sources || [])
                      .find(function (x) { return x.id === c.source_id; });
          who.textContent = (src ? t(src.title, lang) + ' · ' + src.ref : c.source_id) + ' · ' + c.locator;
          cite.appendChild(who);
          cite.appendChild(document.createTextNode('“' + t(c.cited_text, lang) + '”'));
          btn.addEventListener('click', function () { open = !open; cite.hidden = !open; });
          p.appendChild(btn);
          wrap.appendChild(cite);
        });
        wrap.insertBefore(p, wrap.firstChild);
        box.appendChild(wrap);
      });

    } else if (s.type === 'refusal') {
      box.appendChild(el('p', null, t(s.reason, lang)));
      if (s.why_not_answerable && s.why_not_answerable.length) {
        var ul = el('ul', 'idemo-why');
        s.why_not_answerable.forEach(function (r) { ul.appendChild(el('li', null, t(r, lang))); });
        box.appendChild(ul);
      }
      if (s.what_it_could_do) {
        var c2 = el('div', 'idemo-could');
        c2.appendChild(el('strong', null, L('couldDo') + ': '));
        c2.appendChild(document.createTextNode(t(s.what_it_could_do, lang)));
        box.appendChild(c2);
      }

    } else if (s.type === 'confidence') {
      var row2 = el('div', 'idemo-conf');
      row2.appendChild(el('span', 'idemo-level ' + s.level, s.level));
      row2.appendChild(el('span', null, t(s.reason, lang)));
      box.appendChild(row2);
    }

    return box;
  };

  /* staged reveal — instant under prefers-reduced-motion */
  Player.prototype.reveal = function (container) {
    var kids = container.children;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (var i = 0; i < kids.length; i++) {
      (function (n, idx) {
        if (reduce) { n.classList.add('is-in'); return; }
        setTimeout(function () { n.classList.add('is-in'); }, 120 * idx);
      })(kids[i], i);
    }
  };

  window.InferaDemo = {
    mount: function (selector, order) {
      var root = document.querySelector(selector);
      if (!root) return Promise.resolve(null);
      return Promise.all(order.map(function (id) {
        return fetch('/assets/demo/' + id + '.json').then(function (r) { return r.json(); });
      })).then(function (traces) {
        var player = new Player(root, traces);
        /* Mounting injects a tall block ABOVE any later section, so a hash the
           browser already jumped to on load now points at the wrong place --
           landing on Fundadores instead of Contacto. Re-scroll once mounted,
           unless the hash addresses a scenario (which the player handles). */
        var h = (window.location.hash || '').replace(/^#/, '');
        if (h && !traces.some(function (t) { return t.id === h; })) {
          var target = document.getElementById(h);
          if (target) target.scrollIntoView({ block: 'start' });
        }
        return player;
      });
    }
  };
})();
