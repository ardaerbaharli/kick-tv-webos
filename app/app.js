'use strict';
/*
  The app is split into plain classic scripts under js/, loaded in order by
  index.html (core, api, playback, ... input) and sharing one global scope.
  This file loads last and boots it. Keep code that runs at load time from
  calling a function defined in a later file: declarations only hoist within
  their own file.
*/

/* Startup */
document.addEventListener('visibilitychange', function () {
  if (backupRestoreBlocked) return;
  if (document.hidden) {
    if (backup.open) closeBackup();
    cancelVodNext();
    saveVodProgress(true); saveLiveMark(true); pauseNotify();
    // Nobody is reading chat while another app is in front; parsing a busy room
    // for hours is wasted CPU. The setting is untouched, so it reconnects on return.
    if (chat.want || chatReplay.on) disconnectChat();
    // Another app owns the screen. Polling on regardless costs a Luna round trip for
    // every channel every ninety seconds for nobody; the visible branch below already
    // refetches on the way back, so nothing goes stale.
    stopPlayerPoll();
    return;
  }
  if (state.ready) startPlayerPoll();
  flushChatRender();
  if (state.current || state.vod) syncChat();    // reconnect what the background dropped
  fetchFavorites(function () {
    if (state.sidebarOpen) renderSidebar();
    if (state.ready && !state.current && !state.vod) {
      if (state.netDown) showNothing();
      else retryLastVodAfterReconnect();
    }
  });
  if (PB.active && state.current) { PB.recoverCount = 0; recoverPlayback(state.current); } // a deliberate check, not a failure
  pumpNotify();
});
window.addEventListener('pagehide', function () {
  saveVodProgress(true); saveLiveMark(true);
  if (backup.open) closeBackup();
});
// Handle the network coming back or dropping out.
window.addEventListener('online', function () {
  if (backupRestoreBlocked) return;
  fetchFavorites(function () {
    if (state.sidebarOpen) renderSidebar();
    if (state.ready && !state.current && !state.vod) {
      if (state.netDown) showNothing();
      else retryLastVodAfterReconnect();
    }
  });
  if (PB.active && state.current) { PB.recoverCount = 0; recoverPlayback(state.current); }
  else if (state.netDown) scheduleDownRetry();
});
window.addEventListener('offline', function () {
  setNetDown(true);
  if (state.sidebarOpen) renderSidebar();
});
// The startup live chain is explicit rather than relying on sidebar sort order:
// last successful live stream, first live pin, then the first other live stream.
function startupLiveTarget() {
  var last = loadLast();
  var c, slug;
  if (last && state.order.indexOf(last) !== -1) {
    c = state.channels[last];
    if (c && c.live && c.playbackUrl) return last;
  }
  for (var i = 0; i < state.order.length; i++) {
    slug = state.order[i]; c = state.channels[slug];
    if (c && c.live && c.playbackUrl && !isChannelBlocked(c) && isPinned(slug)) return slug;
  }
  for (var j = 0; j < state.order.length; j++) {
    slug = state.order[j]; c = state.channels[slug];
    if (c && c.live && c.playbackUrl && !isChannelBlocked(c)) return slug;
  }
  return null;
}
// A saved VOD contains only a channel slug and stable recording id. Resolve it
// through Kick on every launch so deleted/gated recordings fall through and
// expiring HLS URLs are never restored from localStorage.
function resumeLastVodAtStartup(done) {
  var marker = loadLastVod();
  if (!marker) { done(false, false); return; }
  // If none of the favorite lookups could reach Kick, the VOD lookup cannot
  // succeed either. Keep the marker and show the offline screen immediately.
  if (state.netDown) { done(false, true); return; }
  document.getElementById('idle-load').className = '';
  serviceGet('/api/v2/channels/' + encodeURIComponent(marker.slug) + '/videos', function (err, data) {
    document.getElementById('idle-load').className = 'hidden';
    var currentMarker = loadLastVod();
    if (!currentMarker || currentMarker.slug !== marker.slug || currentMarker.id !== marker.id) {
      done(false, false);
      return;
    }
    // This matters for a reconnect retry, when input is already enabled. A
    // user-selected stream must always beat a late VOD-list response.
    if (state.ready && (state.current || state.vod || startupRecoveryUiBusy())) {
      done(false, true);
      return;
    }
    if (err) {
      if (err === 404 || err === '404') clearLastVod();
      done(false, !(err === 404 || err === '404'));
      return;
    }
    if (!Array.isArray(data)) { done(false, true); return; }
    var list = data.filter(playableVod);
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (vodStableId(list[i]) === marker.id) { index = i; break; }
    }
    if (index < 0) {
      clearLastVod();
      done(false, false);
      return;
    }
    if (!state.channels[marker.slug]) {
      state.channels[marker.slug] = offlineStub(marker.slug);
      state.channels[marker.slug].name = marker.name || marker.slug;
    }
    vods.slug = marker.slug;
    vods.list = list;
    vods.gridIdx = index;
    state.vodReturn = startupLiveTarget();
    playVod(list[index], list.slice(), index, marker.slug);
    done(true, false);
  });
}
function startupRecoveryUiBusy() {
  if (!document.hidden && !saver.on && startupResumePending && !startupUserTookOver && window.TVApp && TVApp.screen() === 'home' && !TVNavigation.busy()) return false;
  return document.hidden || state.mode !== 'player' || state.sidebarOpen || saver.on || anyPanelOpen();
}
function retryLastVodAfterReconnect() {
  if (!state.ready || state.current || state.vod || state.netDown || state.vodRecoveryInFlight) return;
  if (!loadLastVod()) { showNothing(); return; }
  if (startupRecoveryUiBusy()) {
    clearTimeout(state.vodRecoveryRetryTimer);
    state.vodRecoveryRetryTimer = setTimeout(retryLastVodAfterReconnect, 1000);
    return;
  }
  state.vodRecoveryInFlight = true;
  resumeLastVodAtStartup(function (resumed, retryable) {
    state.vodRecoveryInFlight = false;
    if (resumed || state.current || state.vod) return;
    if (retryable && startupRecoveryUiBusy()) {
      clearTimeout(state.vodRecoveryRetryTimer);
      state.vodRecoveryRetryTimer = setTimeout(retryLastVodAfterReconnect, 1000);
      return;
    }
    var target = startupLiveTarget();
    if (target) play(target, retryable); else showNothing();
  });
}
function finishStartupWithoutVod(preserveLastVod) {
  // The last watched channel may be one you don't follow (opened from Browse).
  // It is not in the favorites data, so look it up directly and give it the
  // same "last watched wins" priority a followed channel gets.
  var last = loadLast();
  if (last && state.order.indexOf(last) === -1 && !state.netDown) {
    apiGet(last, function (err, raw) {
      // Something else started, or the viewer took over after the boot deadline.
      if (state.current || state.vod || (state.ready && bootChoiceSuperseded())) return;
      if (!err && raw) {
        var c = normalize(last, raw);
        state.channels[last] = c;
        if (c.live && c.playbackUrl) { play(last, preserveLastVod); return; }
      }
      finishStartupFallback(preserveLastVod);        // offline or gone: the usual chain
    });
    return;
  }
  finishStartupFallback(preserveLastVod);
}
function finishStartupFallback(preserveLastVod) {
  var target = startupLiveTarget();
  var wanted = loadLast();
  if (target && target === wanted) { play(target, preserveLastVod); return; }
  if (window.TVApp) { TVApp.show('home', null, true); return; }
  // Nothing to play. On a fresh, empty setup, open the live browser so there
  // is something to pick from right away; otherwise show the idle screen.
  if (!getFavorites().length && !state.netDown) {
    showState('empty');
    openBrowse();
  } else {
    showNothing();
    if (state.netDown) scheduleDownRetry();
  }
}
// Try to get video on screen from a single ~50ms request — the saved VOD
// marker or the last watched channel — instead of waiting ~2s for the full
// favorites refresh. Calls done(false) to fall back to the favorites-based
// startup decision.
function quickStart(done) {
  var marker = loadLastVod();
  if (marker) {
    resumeLastVodAtStartup(function (resumed) { done(!!resumed); });
    return;
  }
  var last = loadLast();
  if (!last) { done(false); return; }
  // Relaunched within the last link's lifetime: start on it without a lookup.
  var cached = state.channels[last], url = recallPlayback(last);
  if (url && cached && cached.live) {
    cached.playbackUrl = url;
    play(last);
    done(true);
    return;
  }
  apiGet(last, function (err, raw) {
    // A slow lookup can land long after the boot deadline handed over control.
    if (state.current || state.vod || (state.ready && bootChoiceSuperseded())) { done(true); return; }
    if (!err && raw) {
      var c = normalize(last, raw);
      state.channels[last] = c;
      if (c.live && c.playbackUrl) { play(last, false, raw); done(true); return; }   // no refetch
    }
    done(false);
  });
}
// The favorites fetch bounds each request but not the whole pass, and the splash
// ignores every key, so a congested Luna bus could otherwise hold the app for
// minutes. Boot therefore has its own deadline: once it expires we accept input
// and show the idle screen from cached data, and the fetch keeps filling in behind.
var BOOT_DEADLINE_MS = 8000;
var bootDeadlineTimer = null;
var backupRestoreNotice = '';
var backupRestoreBlocked = false;
// Becomes interactive exactly once, whichever path gets here first.
function markBootReady() {
  if (state.ready) return false;
  clearTimeout(bootDeadlineTimer);
  bootDeadlineTimer = null;
  state.ready = true;
  if (backupRestoreNotice) { toast(backupRestoreNotice); backupRestoreNotice = ''; }
  startPlayerPoll();
  prepareSidebarSoon();
  setTimeout(function () { warmPreviews(false); }, 3000);   // after playback has its start
  return true;
}
// True once the viewer (or the deadline's idle screen) owns what is on screen, so
// a late startup decision must not yank them somewhere else.
function bootChoiceSuperseded() {
  if (!document.hidden && !saver.on && startupResumePending && !startupUserTookOver && window.TVApp && TVApp.screen() === 'home' && !TVNavigation.busy()) return false;
  return !!(state.current || state.vod || state.sidebarOpen || state.mode !== 'player' || anyPanelOpen());
}
var startupResumePending = false, startupUserTookOver = false;
(function boot() {
  var restored = BackupRestore.recover();
  if (!restored.ok) {
    backupRestoreBlocked = true;
    showState('lost');
    document.getElementById('idle-msg').textContent = 'Could not restore your backup. Restart the app to retry.';
    return;
  }
  if (restored.status === 'restored') backupRestoreNotice = 'Backup restored.';
  else if (restored.status === 'rolledback') backupRestoreNotice = 'Restore failed. Your previous data was kept.';
  setMode('player'); loadQualityPref(); loadSettings();
  ChatWindow.init();
  if (window.UIPolish) UIPolish.init();
  getFirstRun(); loadChannelCache();
  applyDim(); applyChatStyle(); syncDiagnostics(); loadAppVersion();
  setTimeout(checkForUpdate, 3000);
  state.lastInput = Date.now(); setInterval(checkSaver, 1000);
  // The cached shell is interactive before any network response. An explicit
  // resume preference can start video only until the viewer takes over.
  markBootReady(); TVApp.show('home', null, true);
  startupResumePending = settings.startup === 'resume';
  if (startupResumePending) quickStart(function (started) {
    var explain = !started && !startupUserTookOver;
    startupResumePending = false;
    if (explain) toast('Last stream unavailable. Choose something to watch.');
  });
  fetchFavorites(function () { TVApp.refresh(); });
})();
