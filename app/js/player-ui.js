/* One transport surface for live and recorded video. Seeking previews until OK. */
var TVPlayer = (function () {
  'use strict';
  var visible = false, index = 0, zone = 'actions', timer = null, ticker = null;
  var connectingTimer = null;
  var pending = null, heldAt = 0, heldKey = 0, lastStep = 0;
  var actions = ['play', 'channels', 'chat', 'quality', 'more'];
  function el(id) { return document.getElementById(id); }
  function available() { return actions.concat(el('tv-go-live').classList.contains('hidden') ? [] : ['live']); }
  function actionNode(id) { return el(id === 'live' ? 'tv-go-live' : 'tv-action-' + id); }
  function active() { return !!(state.current || state.vod); }
  function range() {
    var video = el('video');
    if (state.vod && isFinite(video.duration) && video.duration > 0) return { start: 0, end: video.duration - 0.1 };
    if (state.current) return liveSeekRange(video);
    return null;
  }
  function arm() {
    clearTimeout(timer);
    if (!visible || zone === 'timeline' || pending !== null || el('video').paused || TVNavigation.busy() || state.sidebarOpen) return;
    timer = setTimeout(hide, 5000);
  }
  function render() {
    if (!visible) return;
    var chatBox = el('chat'), dock = chatBox.getAttribute('data-dock');
    var split = settings.chat && settings.chatSeparate && (dock === 'left' || dock === 'right');
    el('tv-player-controls').style.left = split && dock === 'left' ? chatBox.style.width : '0';
    el('tv-player-controls').style.right = split && dock === 'right' ? chatBox.style.width : '0';
    var video = el('video'), c = state.channels[state.current] || {}, v = state.vod;
    el('tv-player-name').textContent = v ? v.name : (c.name || state.current || 'Opening stream');
    el('tv-player-title').textContent = v ? v.title : (c.title || '');
    var behind = false, r = range();
    if (r && !v) behind = r.end - video.currentTime > LIVE_EDGE_SLACK_SEC;
    el('tv-player-state').textContent = video.paused ? 'Paused' : v ? (v.liveRewind ? 'Behind live' : 'Past video') : behind ? 'Behind live' : 'Live';
    el('tv-player-state').classList.toggle('is-live', !v && !video.paused && !behind);
    el('tv-action-play').textContent = video.paused ? '▶  Play' : 'Ⅱ  Pause';
    el('tv-action-chat').textContent = settings.chat ? 'Chat · On' : 'Chat · Off';
    el('tv-action-quality').textContent = 'Quality · ' + qualityCurrentLabel();
    el('tv-player-timeline').classList.toggle('hidden', !r);
    el('tv-go-live').classList.toggle('hidden', !((behind && r) || (v && v.liveRewind)));
    if (r) {
      var value = pending === null ? video.currentTime : pending;
      value = Math.max(r.start, Math.min(r.end, value || 0));
      var slider = el('tv-timeline'); slider.min = r.start; slider.max = r.end; slider.value = value;
      slider.setAttribute('aria-valuetext', fmtClock(value) + ' of ' + fmtClock(r.end));
      slider.style.setProperty('--tv-progress', Math.round((value - r.start) / Math.max(1, r.end - r.start) * 100) + '%');
      el('tv-time-current').textContent = fmtClock(value);
      el('tv-time-end').textContent = state.current ? 'Live' : fmtClock(r.end);
    }
    el('tv-player-help').textContent = zone === 'timeline' ?
      (pending === null ? '← → Preview seek    OK Apply    ↓ Controls    Back Cancel' : 'Seek to ' + fmtClock(pending) + '    OK Apply    Back Cancel') :
      '← → Choose action    ↑ Timeline    OK Select    Back Hide';
  }
  function focus() {
    render();
    TVFocus.set(zone === 'timeline' ? el('tv-timeline') : actionNode(available()[Math.min(index, available().length - 1)]));
  }
  function show(pointer) {
    if (!active() || (window.TVApp && TVApp.page()) || state.sidebarOpen) return;
    if (visible && pointer) { arm(); return; }
    visible = true;
    el('tv-player-controls').classList.remove('hidden');
    if (!ticker) ticker = setInterval(render, 1000);
    render();
    if (!pointer) focus();
    arm();
  }
  function hide() {
    clearTimeout(connectingTimer);
    visible = false; pending = null; zone = 'actions';
    clearTimeout(timer); clearInterval(ticker); ticker = null;
    el('tv-player-controls').classList.add('hidden');
    TVFocus.clear();
  }
  function activate(id) {
    arm();
    if (id === 'play') { var video = el('video'); if (video.paused) playVideo(video); else video.pause(); render(); arm(); }
    else if (id === 'channels') { hide(); openSidebar(); }
    else if (id === 'chat') { TVApp.toggleChat(); render(); }
    else if (id === 'quality') TVPanels.legacy('quality');
    else if (id === 'live') { goLive(); render(); }
    else TVPanels.more();
  }
  function key(e) {
    var k = e.keyCode;
    if (k === KEY.PLAY || k === KEY.PAUSE || k === 179) {
      var video = el('video');
      if (k === KEY.PAUSE || (k === 179 && !video.paused)) video.pause(); else playVideo(video);
      show(); return true;
    }
    if (k === KEY.BACK) {
      if (pending !== null) { pending = null; render(); return true; }
      if (visible) hide(); else TVApp.returnToSource();
      return true;
    }
    if ([KEY.OK, KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.REW, KEY.FF].indexOf(k) === -1) return false;
    if (!visible) { zone = 'actions'; index = 0; show(); return true; }
    if (k === KEY.REW || k === KEY.FF) { zone = 'timeline'; k = k === KEY.REW ? KEY.LEFT : KEY.RIGHT; }
    if (zone === 'timeline') {
      var r = range();
      if (!r) { zone = 'actions'; focus(); return true; }
      if (k === KEY.LEFT || k === KEY.RIGHT) {
        var now = Date.now();
        if (!e.repeat || heldKey !== k) { heldAt = now; heldKey = k; }
        if (e.repeat && now - lastStep < 120) return true;
        lastStep = now;
        var step = now - heldAt > 3000 ? 60 : now - heldAt > 1000 ? 30 : 10;
        pending = Math.max(r.start, Math.min(r.end, (pending === null ? el('video').currentTime : pending) + (k === KEY.LEFT ? -step : step)));
      } else if (k === KEY.OK && pending !== null) {
        PB.userSeekUntil = Date.now() + 8000;
        try { el('video').currentTime = pending; } catch (err) {}
        pending = null;
      } else if (k === KEY.DOWN) { pending = null; zone = 'actions'; }
    } else if (k === KEY.LEFT || k === KEY.RIGHT) index = Math.max(0, Math.min(available().length - 1, index + (k === KEY.LEFT ? -1 : 1)));
    else if (k === KEY.UP && range()) zone = 'timeline';
    else if (k === KEY.OK) { activate(available()[index]); return true; }
    focus(); arm(); return true;
  }
  function init() {
    actions.forEach(function (id, i) {
      el('tv-action-' + id).addEventListener('click', function () { index = i; zone = 'actions'; focus(); activate(id); });
      el('tv-action-' + id).addEventListener('mousemove', function () { index = i; zone = 'actions'; focus(); arm(); });
    });
    el('tv-timeline').addEventListener('input', function () { zone = 'timeline'; pending = Number(this.value); render(); });
    el('tv-timeline').addEventListener('change', function () {
      PB.userSeekUntil = Date.now() + 8000;
      try { el('video').currentTime = Number(this.value); } catch (e) {}
      pending = null; render();
    });
    el('tv-go-live').addEventListener('click', function () { goLive(); render(); });
    el('video').addEventListener('pause', function () { if (PB.active && !TVNavigation.busy()) show(true); });
    el('video').addEventListener('playing', function () { clearTimeout(connectingTimer); });
    el('video').addEventListener('play', function () { render(); arm(); });
  }
  function connecting() {
    clearTimeout(connectingTimer);
    if (!active()) return;
    var owner = state.vod || state.current;
    connectingTimer = setTimeout(function () {
      if ((state.vod || state.current) !== owner || el('video').readyState >= 2 || TVApp.page() || TVNavigation.busy()) return;
      TVPanels.menu('Still connecting', [TVPanels.button('Retry', function () {
        TVNavigation.closeAll(); if (state.vod) attachVod(state.vod.source); else play(state.current);
      }), TVPanels.button('Browse live', function () { TVApp.show('browse'); }), TVPanels.button('Keep waiting', function () { TVNavigation.pop(); })],
      'The stream is taking longer than usual. You can keep waiting or choose something else.');
    }, 8000);
  }
  return { connecting: connecting, init: init, show: show, hide: hide, key: key, render: render, visible: function () { return visible; }, restore: function () { show(); } };
})();
