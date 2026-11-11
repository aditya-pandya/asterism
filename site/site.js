(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  // Theme showroom
  var section = document.getElementById('themes');
  var caption = document.getElementById('stage-caption');
  var notes = {
    paper: ['Paper.', 'Warm white, high contrast, the closest thing to print.'],
    sage: ['Sage.', 'A soft green-grey page that is gentler over long reads.'],
    midnight: ['Midnight.', 'Dark surface, light text, for low light.']
  };
  var picks = Array.prototype.slice.call(section.querySelectorAll('.pick'));
  var imgs = Array.prototype.slice.call(section.querySelectorAll('.stage-img'));
  function choose(name) {
    section.setAttribute('data-theme', name);
    picks.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.theme === name)); });
    imgs.forEach(function (i) { i.classList.toggle('is-on', i.dataset['for'] === name); });
    caption.innerHTML = '';
    var s = document.createElement('strong');
    s.textContent = notes[name][0];
    caption.appendChild(s);
    caption.appendChild(document.createTextNode(' ' + notes[name][1]));
  }
  picks.forEach(function (b, i) {
    b.addEventListener('click', function () { choose(b.dataset.theme); });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = picks[(i + d + picks.length) % picks.length];
      n.focus();
      choose(n.dataset.theme);
    });
  });

  // Source <-> reading sample
  var doc = document.getElementById('doc');
  var segs = Array.prototype.slice.call(document.querySelectorAll('.seg button'));
  function mode(m) {
    var read = m === 'read';
    doc.classList.toggle('is-read', read);
    segs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
    Array.prototype.forEach.call(doc.querySelectorAll('.m'), function (el) {
      if (read) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
    });
  }
  segs.forEach(function (b) { b.addEventListener('click', function () { mode(b.dataset.mode); }); });
})();
