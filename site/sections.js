/* Asterism site: sections below the hero.
   Each section has one motion idea. Everything lands in its end state under reduced motion,
   and every section is complete without JavaScript. DOM is built with createElement only. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function $(id) { return document.getElementById(id); }
  function onView(el, fn, opts) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
    }, opts || { threshold: 0.3 });
    io.observe(el);
  }

  /* ---------- fixed bar: shown once the hero has gone; marks the section in view ---------- */
  var bar = $('bar'), stage = $('stage');
  if (bar && stage && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var hidden = !entries[0].isIntersecting;
      bar.classList.toggle('show', hidden);
      bar.toggleAttribute('inert', !hidden);
    }, { rootMargin: '-120px 0px 0px 0px' }).observe(stage);
    bar.setAttribute('inert', '');
    var links = Array.prototype.slice.call(bar.querySelectorAll('nav a'));
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('on', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var t = document.querySelector(a.getAttribute('href')); if (t) sio.observe(t); });
  }

  /* ---------- section headings lift in once ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.sec-head h2, .sec-lede'), function (el, i) {
    if (reduce.matches) return;
    el.classList.add('reveal');
    if (el.classList.contains('sec-lede')) el.style.transitionDelay = '120ms';
    onView(el, function (t) { t.classList.add('in'); }, { threshold: 0.4 });
  });

  /* ---------- platform keys ---------- */
  if (!IS_MAC) {
    Array.prototype.forEach.call(document.querySelectorAll('.caps kbd'), function (k) {
      k.textContent = { '⌘': 'Ctrl', '⇧': 'Shift', '⌥': 'Alt' }[k.textContent] || k.textContent;
    });
  }

  /* ---------- 01: live demo ---------- */
  var demo = $('demo'), src = $('demoSrc'), out = $('demoOut'), body = $('demoBody');
  var btnEdit = $('demoEdit'), btnRead = $('demoRead'), count = $('demoCount');
  var ALLOWED = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, STRONG: 1, EM: 1, DEL: 1, CODE: 1, PRE: 1, UL: 1, OL: 1, LI: 1,
    BLOCKQUOTE: 1, A: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1, HR: 1, BR: 1, INPUT: 1 };
  /* Marked's HTML is parsed into an inert document, then only whitelisted nodes are rebuilt. */
  function clean(node, into) {
    Array.prototype.forEach.call(node.childNodes, function (n) {
      if (n.nodeType === 3) { into.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName;
      if (!ALLOWED[tag]) { clean(n, into); return; }
      if (tag === 'INPUT' && n.getAttribute('type') !== 'checkbox') return;
      var e = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        var href = n.getAttribute('href') || '';
        if (/^(https?:|#)/i.test(href)) { e.href = href; e.rel = 'noopener noreferrer'; if (href.charAt(0) !== '#') e.target = '_blank'; }
      }
      if (tag === 'INPUT') { e.type = 'checkbox'; e.disabled = true; e.checked = n.hasAttribute('checked'); }
      if ((tag === 'TH' || tag === 'TD') && /^(left|center|right)$/.test(n.getAttribute('align') || '')) e.style.textAlign = n.getAttribute('align');
      clean(n, e);
      into.appendChild(e);
    });
  }
  var prevBlocks = [];
  function render(animate) {
    if (!window.marked || !out) return;
    var html = '';
    try { html = window.marked.parse(src.value, { gfm: true, breaks: false }); } catch (e) { html = ''; }
    var parsed = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    var frag = document.createDocumentFragment();
    clean(parsed.body, frag);
    var kids = Array.prototype.slice.call(frag.children);
    var next = kids.map(function (k) { return k.tagName; });
    if (animate && !reduce.matches) {
      kids.forEach(function (k, i) { if (i >= prevBlocks.length || prevBlocks[i] !== next[i]) k.classList.add('fresh'); });
    }
    prevBlocks = next;
    out.replaceChildren(frag);
    var words = (src.value.replace(/[#>*_`|\-\[\]()]/g, ' ').match(/[^\s]+/g) || []).length;
    if (count) count.textContent = words + (words === 1 ? ' word' : ' words');
  }
  var SAMPLE = src ? src.value : '';
  var typingTimer = 0, startTimer = 0, typing = false, handedOver = false;
  /* Any interaction hands the demo over for good: a pending start is cancelled and the sample completes once. */
  function stopTyping(finish) {
    if (handedOver) return;
    handedOver = true;
    clearTimeout(startTimer); clearTimeout(typingTimer);
    var wasTyping = typing;
    typing = false; demo.classList.remove('typing');
    if (finish && (wasTyping || !src.value)) { src.value = SAMPLE; render(true); }
  }
  function typeSample() {
    if (handedOver) return;
    if (reduce.matches || !src) { handedOver = true; render(false); return; }
    typing = true; demo.classList.add('typing');
    var i = src.value.length;
    (function step() {
      if (!typing) return;
      if (i >= SAMPLE.length) { typing = false; handedOver = true; demo.classList.remove('typing'); return; }
      var c = SAMPLE.charAt(i++);
      src.value += c;
      src.scrollTop = src.scrollHeight;
      render(true);
      typingTimer = setTimeout(step, c === '\n' ? 150 : 18 + Math.random() * 26);
    })();
  }
  if (demo && src && out) {
    if (!reduce.matches) { src.value = ''; render(false); }
    src.addEventListener('input', function () { render(true); });
    ['pointerdown', 'keydown', 'focusin'].forEach(function (t) { demo.addEventListener(t, function () { stopTyping(true); }); });
    onView(demo, function () { demo.classList.add('in'); if (!handedOver) startTimer = setTimeout(typeSample, reduce.matches ? 0 : 650); }, { threshold: 0.35 });
    var setView = function (reading) {
      body.classList.toggle('reading', reading);
      btnEdit.parentElement.classList.toggle('reading', reading);
      btnEdit.classList.toggle('on', !reading); btnRead.classList.toggle('on', reading);
      btnEdit.setAttribute('aria-pressed', String(!reading)); btnRead.setAttribute('aria-pressed', String(reading));
      src.tabIndex = reading ? -1 : 0;
    };
    btnEdit.addEventListener('click', function () { setView(false); });
    btnRead.addEventListener('click', function () { setView(true); });
  }

  /* ---------- 02: keycaps press for the real shortcut, and as each row crosses the middle ---------- */
  var rows = Array.prototype.slice.call(document.querySelectorAll('.verbs li'));
  function press(li) {
    li.classList.remove('press'); void li.offsetWidth; li.classList.add('press');
    setTimeout(function () { li.classList.remove('press'); }, 180);
  }
  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var mod = IS_MAC ? e.metaKey : e.ctrlKey;
    if (!mod || e.target === src) return;
    var k = (e.key || '').toLowerCase();
    var combo = 'mod+' + (e.shiftKey ? 'shift+' : '') + (e.altKey ? 'alt+' : '') + (e.code && /^Key/.test(e.code) ? e.code.slice(3).toLowerCase() : k);
    rows.forEach(function (li) {
      if (li.getAttribute('data-keys') !== combo) return;
      press(li);
      if (combo === 'mod+s') e.preventDefault(); /* a "save page" dialog helps nobody here */
    });
  });
  if (!reduce.matches && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) press(e.target); });
    }, { rootMargin: '-49% 0px -49% 0px' });
    rows.forEach(function (li) { cio.observe(li); });
  }

  /* ---------- 03: re-set the page in a theme, revealed from the click point ---------- */
  var swatches = Array.prototype.slice.call(document.querySelectorAll('.sw'));
  var reset = $('themeReset');
  var point = null;
  function applyTheme(name) {
    if (name) root.setAttribute('data-theme', name); else root.removeAttribute('data-theme');
    swatches.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme') === name)); });
    if (reset) reset.hidden = !name;
  }
  function switchTheme(name) {
    if (reduce.matches || typeof document.startViewTransition !== 'function' || !point) { applyTheme(name); return; }
    var x = point.x, y = point.y;
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var t = document.startViewTransition(function () { applyTheme(name); });
    t.ready.then(function () {
      root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 680, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(function () {});
  }
  swatches.forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { point = { x: e.clientX, y: e.clientY }; });
    b.addEventListener('click', function (e) {
      if (!e.detail) { var r = b.getBoundingClientRect(); point = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      var name = b.getAttribute('data-theme');
      switchTheme(root.getAttribute('data-theme') === name ? null : name);
    });
  });
  if (reset) reset.addEventListener('click', function () {
    var r = reset.getBoundingClientRect(); point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    switchTheme(null);
  });

  /* ---------- 04: the policy line types itself ---------- */
  var csp = $('cspLine');
  if (csp) onView(csp.parentNode, function () { csp.classList.add('in'); }, { threshold: 0.5 });

  /* ---------- close: scroll sets the mark again, the night front crosses the page ---------- */
  var close = $('close'), night = $('closeNight'), stars = $('closeStars');
  if (close && night && stars) {
    var raf = 0, active = false;
    var clipFor = function (T, W, H) {
      var k = 2 * T, pts = [[0, 0], [W, 0], [W, H], [0, H]], res = [];
      /* the front rises from the bottom-right corner, like a page turning over */
      var f = function (q) { return (W - q[0]) / W + (H - q[1]) / H - k; };
      for (var i = 0; i < 4; i++) {
        var a = pts[i], b = pts[(i + 1) % 4], fa = f(a), fb = f(b);
        if (fa <= 0) res.push(a);
        if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { var u = fa / (fa - fb); res.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
      }
      if (res.length < 3) return 'polygon(0 0,0 0,0 0)';
      return 'polygon(' + res.map(function (q) { return Math.round(q[0]) + 'px ' + Math.round(q[1]) + 'px'; }).join(',') + ')';
    };
    var paint = function () {
      raf = 0;
      var r = close.getBoundingClientRect(), vh = innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.6 - r.top) / (vh * 0.6 + 40)));
      var e = p * p * (3 - 2 * p);
      stars.style.setProperty('--e', e.toFixed(4));
      night.style.clipPath = p >= 1 ? 'none' : clipFor(-0.04 + e * 1.08, r.width, r.height);
    };
    var onScroll = function () { if (active && !raf) raf = requestAnimationFrame(paint); };
    if (reduce.matches) { stars.style.setProperty('--e', '1'); night.style.clipPath = 'none'; }
    else {
      stars.style.setProperty('--e', '0');
      new IntersectionObserver(function (en) { active = en[0].isIntersecting; if (active) onScroll(); }).observe(close);
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onScroll);
    }
  }
})();
