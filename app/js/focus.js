/* Remote focus is shared with DOM focus; stable keys survive virtualized renders. */
var TVFocus = (function () {
  'use strict';
  var current = null;
  function clear() {
    if (current) { current.classList.remove('tv-focused'); current.tabIndex = -1; }
    current = null;
  }
  function set(node, scroll) {
    if (!node || !document.documentElement.contains(node)) { clear(); return; }
    if (current === node && document.activeElement === node) return;
    if (current !== node) clear();
    current = node; node.classList.add('tv-focused'); node.tabIndex = 0;
    if (!/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(node.tagName) && !node.hasAttribute('role')) node.setAttribute('role', 'button');
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
    if (scroll && node.parentNode) {
      var box = node.parentNode, r = node.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.bottom > b.bottom - 8) box.scrollTop += r.bottom - b.bottom + 8;
      else if (r.top < b.top + 8) box.scrollTop -= b.top - r.top + 8;
    }
  }
  function move(index, count, columns, dx, dy, preferred) {
    if (!count) return 0;
    var row = Math.floor(index / columns), col = index % columns;
    if (dx) return Math.max(row * columns, Math.min(count - 1, row * columns + columns - 1, index + dx));
    var nextRow = Math.max(0, Math.min(Math.ceil(count / columns) - 1, row + dy));
    return Math.min(count - 1, nextRow * columns + (preferred == null ? col : preferred));
  }
  return { set: set, clear: clear, move: move, current: function () { return current; } };
})();
