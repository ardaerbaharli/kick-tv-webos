/* Live timeline and Go live, against synthetic fixtures only. */
window.runLivebarTests = async function (assert) {
  function kickTime(ms) { return new Date(ms).toISOString().replace('T', ' ').slice(0, 19); }
  function key(code) { document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: code, bubbles: true })); }
  var saved = { serviceGet: serviceGet, playVod: playVod, exitVod: exitVod, attachVod: attachVod };
  var requests = [], played = null, exited = 0, attached = null;
  try {
    var startedMs = Date.now() - 3600 * 1000;
    state.channels.alpha.startedAt = kickTime(startedMs);
    serviceGet = function (path, cb) { requests.push({ path: path, cb: cb }); return function () {}; };
    playVod = function (v, queue, index, slug, opts) { played = { v: v, slug: slug, opts: opts }; };

    key(13);
    assert(TVPlayer.visible(), 'OK reveals the shared player controls');
    showLiveBar(true);
    var p = livePositions();
    assert(p && Math.abs(p.edge - 3600) < 5, 'the timeline spans from the stream start to now');
    assert(document.getElementById('livebar-live').className === 'hidden' && document.getElementById('livebar-end').className === '',
      'at the live edge the right end shows the running time, no Go live');
    var trackWidth = document.getElementById('livebar-track').getBoundingClientRect().width;

    liveSeekBy(-30);
    assert(liveSeek.base !== null && liveSeek.delta === -30, 'Left collects a 30s step back');
    assert(document.getElementById('seekpop').className === '', 'the pending jump is announced');
    assert(document.getElementById('livebar-origin').getAttribute('visibility') === 'visible', 'the bar marks where the seek started');
    assert(document.getElementById('livebar-live').className === '' && document.getElementById('livebar-end').className === 'hidden',
      'a pending step back offers Go live in the same slot');
    assert(Math.abs(document.getElementById('livebar-track').getBoundingClientRect().width - trackWidth) < 1,
      'the track keeps its length when Go live appears');
    liveSeekBy(30); liveSeekBy(30);
    assert(liveSeek.delta <= 0.5, 'Right cannot bank seconds past the live edge');
    liveSeekBy(-30); liveSeekBy(-30);
    await fixtureWait(SEEK_APPLY_MS + 120);
    var videos = requests.filter(function (r) { return r.path.indexOf('/videos') !== -1; });
    assert(videos.length === 1, 'a rewind past the live buffer looks up the stream recording');
    videos[0].cb(null, [
      { is_live: false, created_at: kickTime(startedMs - 86400000), source: 'https://fixture.invalid/old.m3u8', duration: 1000 },
      { is_live: true, created_at: state.channels.alpha.startedAt, source: 'https://fixture.invalid/rec.m3u8', duration: 0, video: { uuid: 'rec' } }
    ]);
    assert(played && played.v.source.indexOf('rec.m3u8') !== -1, 'the running stream\'s own recording is opened, not an old one');
    assert(played.opts.liveRewind && Math.abs(played.opts.resumeAt - (3600 - 60)) < 5, 'it opens at the chosen moment');
    assert(state.vodReturn === 'alpha', 'Go live will return to the same channel');

    // The playlist clock corrects the created_at estimate.
    var fakeHls = {};
    state.hls = fakeHls;
    state.vod = { liveRewind: true, slug: 'alpha', key: 'alpha:rec', wallTarget: startedMs + 1000 * 1000, resumeApplied: false, resumeAt: 0 };
    liveRewindLevelLoaded(fakeHls, { details: { totalduration: 3500, fragments: [{ programDateTime: startedMs - 6000 }] } });
    assert(Math.abs(state.vod.resumeAt - 1006) < 0.01 && state.vod.wallTarget === 0, 'segment timestamps pin the exact position once');
    assert(state.vod.recEndMs === startedMs - 6000 + 3500 * 1000, 'the loaded copy knows where it ends');

    var writes = fixtureWrites[VOD_PROGRESS_KEY] || 0;
    state.vod.progressReady = true; state.vod.resumeApplied = true;
    saveVodProgress(true);
    assert((fixtureWrites[VOD_PROGRESS_KEY] || 0) === writes, 'a rewound live stream keeps no resume progress');
    assert(vodBtnCount() === 4, 'the transport row gains Go live while rewound');
    showVodBar();
    assert(document.getElementById('vodgolive').className !== 'hidden' && document.getElementById('vodbar-dur').className === 'hidden',
      'Go live replaces the duration at the right end of the seek bar');
    hideVodBar();

    exitVod = function () { exited++; };
    attachVod = function (src) { attached = src; };
    state.vod.source = 'https://fixture.invalid/rec.m3u8';
    state.vod.recEndMs = Date.now() - 10 * 60000;
    liveRewindEnded();
    assert(attached && exited === 0, 'reaching the end of a stale copy reloads the grown recording');
    liveRewindEnded();
    assert(exited === 1, 'a copy that did not grow means we caught up: go live');
    state.vod.recEndMs = Date.now() - 5000; delete state.vod.endReloadDur;
    liveRewindEnded();
    assert(exited === 2, 'ending near the live edge goes live');
    state.vod = null; state.hls = null; hideVodPlay();

    // Preserve the underlying live-recording engine checks; the shared player
    // now uses preview/commit against the actual seekable media window.
    resetLiveSeek(); liveSeekBy(-60);
    assert(liveSeek.base !== null && liveSeek.delta === -60, 'explicit rewind helper accumulates a minute');
    liveSeekBy(60);
    assert(liveSeek.delta === 0, 'forward cancels a pending rewind');
    resetLiveSeek(); hideLiveBar(); TVPlayer.hide();
    key(KEY.OK); key(KEY.RIGHT); key(KEY.OK);
    assert(state.sidebarOpen, 'Channels opens through an explicit player action');
    assert(parseFloat(getComputedStyle(document.getElementById('video')).height) === 1080, 'Channels does not resize the hardware video plane');
    key(KEY.BACK);
    assert(!state.sidebarOpen && TVPlayer.visible(), 'Back from Channels restores player controls');
  } finally {
    serviceGet = saved.serviceGet; playVod = saved.playVod; exitVod = saved.exitVod; attachVod = saved.attachVod;
  }
};
