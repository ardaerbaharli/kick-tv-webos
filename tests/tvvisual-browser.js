/* Deterministic design captures. All names, counts and artwork are synthetic. */
(function () {
  function art(index) {
    var canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    var ctx = canvas.getContext('2d'), colors = ['#324e52', '#4c405c', '#5c4535', '#31485e'];
    ctx.fillStyle = colors[index % colors.length]; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (var i = 0; i < 6; i++) ctx.fillRect(i * 135 - 200 + index * 11, 0, 60, 360);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '600 28px sans-serif'; ctx.fillText('Fixture ' + (index + 1), 28, 320);
    return canvas.toDataURL();
  }
  function data() {
    var items = [];
    for (var i = 0; i < 16; i++) items.push({ channel: { slug: 'fixture-' + i, user: { username: ['Alpha', 'Beta', 'Gamma', 'Delta'][i % 4] + (i > 3 ? ' ' + (i + 1) : '') } },
      viewer_count: 1200 + i * 137, language: i % 2 ? 'Turkish' : 'English', thumbnail: art(i),
      session_title: ['An evening of games and good conversation', 'Building a world, one block at a time', 'A very long stream title to verify readable wrapping on TV', 'Live music from the studio'][i % 4],
      categories: [{ name: ['Just Chatting', 'Minecraft', 'IRL', 'Music'][i % 4], slug: 'cat-' + i % 4 }] });
    return items;
  }
  window.setupTvvisualScreenshot = async function (mode) {
    TVNavigation.closeAll(); TVPlayer.hide(); closeSidebar();
    settings.uiText = mode === 'large' ? 'large' : 'normal'; settings.dim = false; applyDim(); UIPolish.apply(); TVApp.geometry();
    serviceGet = function () { return { cancel: function () {} }; }; apiGet = function () {};
    lsSet('kicktv.added', []); lsSet('kicktv.removed', []);
    var items = data();
    items.slice(0, 4).forEach(function (item) {
      var slug = item.channel.slug; addFavorite(slug); state.channels[slug] = { slug: slug, name: item.channel.user.username, title: item.session_title,
        live: true, viewers: item.viewer_count, thumbnail: item.thumbnail, category: item.categories[0].name, channelId: 41, chatroomId: 1 };
    });
    state.current = 'fixture-0'; state.vod = null; settings.chat = false; syncChat();
    var progress = loadVodProgress(); progress.items['fixture-0:demo'] = { position: 1240, duration: 6400, name: 'Alpha', title: 'The previous stream', updated: Date.now() }; writeVodProgress(progress);
    if (mode === 'browse' || mode === 'large') {
      TVApp.show('browse'); browse.raw = items; browse.langs = []; browse.cats = []; browse.discover = false; browse.fetching = false; browse.hasMore = false; browse.error = false;
      renderBrowse(); browse.gridIdx = 1; TVApp.catalogueFocus();
    } else if (mode === 'settings') { TVApp.show('home'); TVPanels.settings(); }
    else if (mode === 'player' || mode === 'chat') {
      TVApp.onPlaybackStart(); document.getElementById('video').style.display = 'block';
      Object.defineProperty(document.getElementById('video'), 'paused', { configurable: true, value: false });
      Object.defineProperty(document.getElementById('video'), 'currentTime', { configurable: true, value: 1297 });
      Object.defineProperty(document.getElementById('video'), 'seekable', { configurable: true, value: { length: 1, start: function () { return 100; }, end: function () { return 1300; } } });
      if (mode === 'chat') {
        settings.chat = true; settings.chatSeparate = true; settings.chatDelay = 0; settings.chatTransparency = 0; syncChat(); ChatWindow.preset('right'); applyChatStyle();
        for (var i = 0; i < 24; i++) addChatMessage({ content: 'A synthetic chat message for layout review ' + (i + 1), sender: { username: 'Viewer ' + (i % 4 + 1) } });
      }
      TVPlayer.show();
    } else TVApp.show('home');
    var mark = document.getElementById('tv-fixture-mark');
    if (!mark) { mark = document.createElement('div'); mark.id = 'tv-fixture-mark'; mark.style.cssText = 'position:fixed;right:64px;top:24px;color:#89959e;font:18px sans-serif;z-index:110'; document.body.appendChild(mark); }
    mark.textContent = 'DESKTOP FIXTURE · SYNTHETIC CONTENT';
    await fixtureWait(200);
  };
  window.runTvvisualTests = async function (assert) {
    await setupTvvisualScreenshot('browse');
    var card = getBrowseGrid().get(1), rect = card.getBoundingClientRect(), main = card.querySelector('.tv-card-main');
    assert(main && document.activeElement === main, 'catalog primary action is a native focused button');
    assert(rect.width === 364 && rect.height === 416, 'Standard catalog uses the planned four-column card geometry');
    assert(rect.left >= 292 && rect.right <= 1856, 'focused catalog content stays inside the safe content area');
    assert(parseFloat(getComputedStyle(card.querySelector('.bsub')).fontSize) >= 24, 'useful catalog metadata is at least 24px');
    assert(card.querySelector('.btitle').offsetHeight === 58, 'stream titles reserve two readable lines');
    assert(document.querySelectorAll('.tv-focused').length === 1, 'catalog has one DOM focus owner');
    await setupTvvisualScreenshot('large');
    assert(BROWSE_COLS === 3 && getBrowseGrid().metrics.cols === 3, 'Large mode keeps virtualization and navigation at three columns');
    assert(getBrowseGrid().get(1).offsetWidth === 493, 'Large cards preserve a readable thumbnail and title width');
    await setupTvvisualScreenshot('settings');
    var sheet = document.querySelector('.tv-sheet-panel').getBoundingClientRect();
    assert(sheet.right <= 1920 - 48 && sheet.bottom <= 1080 - 48, 'settings respects TV safe margins');
    await setupTvvisualScreenshot('home');
    var focused = document.activeElement.getBoundingClientRect();
    assert(focused.left >= 292 && focused.top >= 54, 'Home default focus stays in the safe area');
    assert(document.querySelector('.tv-section h2').textContent === 'Live from your channels', 'Home prioritizes live saved channels');
  };
})();
