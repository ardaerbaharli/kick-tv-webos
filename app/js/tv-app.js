/* App shell and normalized input ownership. No framework or new playback backend. */
var TVApp = (function () {
  'use strict';
  var screen = '', nav = false, navIndex = 0, row = 0, col = 0, options = false, preferred = 0;
  var pendingRefresh = false, pendingCatalogue = null;
  var rows = [], filter = 'all', content, initialized = false, grid = null, operation = 0, catalogOptions = false, toolbar = false, toolIndex = 0;
  var navigation = ['home', 'browse', 'channels', 'search', 'settings'];
  var labels = ['Home', 'Browse', 'My channels', 'Search', 'Settings'];
  var symbols = ['⌂', '▦', '▤', '⌕', '⚙'];
  function el(id) { return document.getElementById(id); }
  function page() { return !!screen; }
  function context() {
    return { screen: screen || 'home', row: row, col: col, nav: nav, filter: filter,
      browseIndex: browse.gridIdx, browseKey: browse.streams[browse.gridIdx] && catalogueKey(browse.streams[browse.gridIdx]),
      browseCats: browse.cats.slice(), scroll: el('browse-grid').scrollTop, vodSlug: vods.slug, vodIndex: vods.gridIdx };
  }
  function mode() {
    document.body.classList.toggle('tv-page', page());
    el('tv-navigation').classList.toggle('hidden', !page());
    el('tv-return').classList.toggle('hidden', !(state.current || state.vod));
    navigation.forEach(function (id, i) {
      var node = el('tv-nav-' + id); node.classList.toggle('is-selected', screen === id || screen === 'vods' && id === 'channels');
      if (screen === id) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
      node.querySelector('.tv-nav-label').textContent = labels[i];
    });
    el('tv-catalog-tools').classList.toggle('hidden', !(browse.open || cats.open || vods.open));
    el('tv-catalog-summary').textContent = cats.open ? 'Choose a category to see live streams' : vods.open ? 'Pick up where you left off' : browse.langs.length ? browse.langs.join(' · ') : 'All languages';
    el('tv-catalog-categories').textContent = vods.open ? 'Channel details' : cats.open ? 'Live streams' : 'Categories';
    el('tv-catalog-filters').textContent = cats.open ? 'Search categories' : vods.open ? (vods.hideWatched ? 'Show watched' : 'Hide watched') : 'Filters';
  }
  function hideCatalogs() { if (cats.open) closeCats(); if (browse.open) closeBrowse(); if (vods.open) closeVods(); }
  function show(next, saved, noHistory) {
    if (screen && next !== screen && !noHistory) TVNavigation.visit(context());
    window.scrollTo(0, 0);
    operation++; TVNavigation.closeAll(); TVPlayer.hide(); closeSidebar(); hideCatalogs();
    screen = next || 'home'; nav = false; catalogOptions = false; toolbar = false;
    options = false; pendingRefresh = false;
    row = saved && saved.row || 0; col = saved && saved.col || 0; filter = saved && saved.filter || 'all';
    if (navigation.indexOf(screen) >= 0) navIndex = navigation.indexOf(screen);
    el('tv-content').classList.toggle('hidden', screen === 'browse' || screen === 'vods');
    if (screen === 'browse') {
      openBrowse();
      pendingCatalogue = saved || null;
      if (saved) {
        browse.cats = saved.browseCats || []; refilterBrowse();
        browse.gridIdx = catalogueIdentityIndex(browse.streams, catalogueKey, saved.browseKey, saved.browseIndex);
        el('browse-grid').scrollTop = saved.scroll || 0;
      }
      geometry(); catalogueFocus();
    } else if (screen === 'vods') { openVods(saved.vodSlug); vods.gridIdx = saved.vodIndex || 0; geometry(); catalogueFocus(); }
    else { render(); }
    mode();
    if (screen === 'settings') TVPanels.settings();
  }
  function catalogueOpened(kind) {
    if (!initialized) return;
    screen = kind; nav = false; catalogOptions = false; toolbar = false;
    el('tv-content').classList.add('hidden'); TVPlayer.hide(); mode(); geometry();
  }
  function geometry() {
    BROWSE_COLS = settings.uiText === 'large' ? 3 : 4; VOD_COLS = BROWSE_COLS; CATS_COLS = BROWSE_COLS;
    [browseGridView, vodGridView, catsGridView, grid].forEach(function (view) {
      if (view) { view.options.columns = BROWSE_COLS; view.dirty = true; view.lastSpan = null; view.refresh(); }
    });
    document.body.classList.toggle('tv-reduced-motion', !!settings.reducedMotion);
  }
  function render() {
    if (!screen || screen === 'browse' || screen === 'vods') return;
    var previous = currentItem(), key = previous && previous.key, preserveOptions = options;
    if (grid) { grid.destroy(); grid = null; }
    if (window.UIImages) UIImages.release(content);
    content.innerHTML = '';
    el('tv-page-title').textContent = screen === 'channels' ? 'My channels' : screen === 'search' ? 'Find your next stream' : screen === 'settings' ? 'Settings' : 'Good to see you.';
    el('tv-page-description').textContent = screen === 'channels' ? 'Your favorites. Saved on this TV.' : screen === 'search' ? 'Search Kick channels, or add them with your phone.' : screen === 'settings' ? 'Make yourself comfortable.' : state.netDown ? 'You’re offline. Your saved channels are still here.' : 'Your channels, live streams, and unfinished videos.';
    var actions = el('tv-page-actions'); actions.innerHTML = '';
    var header = [];
    function action(label, run) { var b = document.createElement('button'); b.type = 'button'; b.className = 'tv-button'; b.tabIndex = -1; b.textContent = label; b.addEventListener('click', run); actions.appendChild(b); header.push({ node: b, run: run }); }
    if (screen === 'channels') {
      ['all', 'pinned', 'live', 'offline'].forEach(function (value, valueIndex) { action((filter === value ? '✓ ' : '') + value.charAt(0).toUpperCase() + value.slice(1), function () { filter = value; row = 0; col = valueIndex; render(); }); });
      action('Add channel', searchInput);
    } else if (screen === 'search') {
      action('Search channels', searchInput); action('Add with phone', function () { TVPanels.legacy('backup'); });
    } else if (screen === 'settings') action('Open settings', TVPanels.settings);
    else { action('Browse live', function () { show('browse'); }); action('Search channels', function () { show('search'); }); action('Add with phone', function () { TVPanels.legacy('backup'); }); }
    if (state.netDown && screen === 'home') action('Retry connection', function () { fetchFavorites(function () { refresh(); }); });
    rows = [{ title: '', items: header, header: true }];
    if (screen === 'home' || screen === 'channels') {
      var groups = TVHome.rows(screen, filter);
      groups.forEach(function (group) {
        if (!group.items.length) return;
        var section = document.createElement('section'); section.className = 'tv-section';
        var heading = document.createElement('h2'); heading.textContent = group.title; section.appendChild(heading);
        var cards = document.createElement('div'); cards.className = 'tv-card-grid'; section.appendChild(cards); content.appendChild(section);
        rows.push(group); var ri = rows.length - 1;
        if (screen === 'channels') {
          cards.classList.add('tv-saved-grid');
          grid = new VirtualGrid(cards, { columns: BROWSE_COLS, height: 412, onRender: function () { syncCardFocus(); } });
          grid.setItems(group.items, function (item) { return item.key; }, function (item, i) { return wireCard(TVHome.card(item), item, ri, i); });
        } else group.items.forEach(function (item, i) { cards.appendChild(wireCard(TVHome.card(item), item, ri, i)); });
      });
      if (rows.length === 1) {
        var empty = document.createElement('div'); empty.className = 'tv-empty';
        var h = document.createElement('h2'); h.textContent = screen === 'home' ? 'Make it your own.' : 'No channels here yet.';
        var p = document.createElement('p'); p.textContent = screen === 'home' ? 'Browse what’s live, then save channels you want to come back to. No sign-in needed.' : 'Try another filter or search for a channel to save.';
        empty.appendChild(h); empty.appendChild(p); content.appendChild(empty);
      }
    } else if (screen === 'search') renderSearchRecents();
    if (key) rows.some(function (group, ri) { return group.items.some(function (item, ci) { if (item.key === key) { row = ri; col = ci; return true; } return false; }); });
    row = Math.min(rows.length - 1, row); col = Math.min(Math.max(0, rows[row].items.length - 1), col); options = preserveOptions && row > 0;
    mode(); restoreFocus();
  }
  function renderSearchRecents() {
    var items = lsGet(RECENT_KEY).slice(0, 8).map(function (r) { return TVHome.channel(r.slug); });
    if (!items.length) return;
    var section = document.createElement('section'); section.className = 'tv-section'; var h = document.createElement('h2'); h.textContent = 'Recently watched'; section.appendChild(h);
    var cards = document.createElement('div'); cards.className = 'tv-card-grid'; section.appendChild(cards); content.appendChild(section);
    rows.push({ items: items }); items.forEach(function (item, i) { cards.appendChild(wireCard(TVHome.card(item), item, 1, i)); });
  }
  function wireCard(node, item, ri, ci) {
    if (screen !== 'channels') item.node = node;
    node.addEventListener('click', function (e) { row = ri; col = ci; nav = false; if (e.target.closest('.tv-card-options')) openOptions(item); else activate(item); });
    node.addEventListener('mousemove', function (e) { row = ri; col = ci; options = !!e.target.closest('.tv-card-options'); nav = false; restoreFocus(); });
    return node;
  }
  function currentItem() { return rows[row] && rows[row].items[col]; }
  function mainTarget(node) { return node && (node.querySelector('.tv-card-main') || node); }
  function syncCardFocus() {
    if (!grid || nav || row === 0 || TVNavigation.busy()) return;
    var node = grid.get(col); if (node) TVFocus.set(options ? node.querySelector('.tv-card-options') : mainTarget(node));
  }
  function restoreFocus() {
    if (TVNavigation.busy()) return;
    if (pendingRefresh && screen && screen !== 'browse' && screen !== 'vods') { pendingRefresh = false; render(); return; }
    if (nav) { TVFocus.set(el('tv-nav-' + navigation[navIndex])); return; }
    if (browse.open || vods.open || cats.open) { catalogueFocus(); return; }
    if (!screen) { TVPlayer.restore(); return; }
    var item = currentItem();
    if (item) {
      if (grid && row > 0) { grid.focus(col); syncCardFocus(); }
      else TVFocus.set(options && item.node ? item.node.querySelector('.tv-card-options') : mainTarget(item.node), true);
      if (item.node && !grid) {
        var r = item.node.getBoundingClientRect(), area = el('tv-content-scroll').getBoundingClientRect();
        if (r.bottom > area.bottom - 12) el('tv-content-scroll').scrollTop += r.bottom - area.bottom + 12;
        else if (r.top < area.top + 12) el('tv-content-scroll').scrollTop -= area.top - r.top + 12;
      }
    }
  }
  function openOptions(item) {
    if (item.type === 'resume') {
      TVPanels.recording(item.slug, { id: item.id }, function (startOver) { resume(item, startOver); });
    } else TVPanels.channel(item.slug);
  }
  function activate(item) {
    if (!item) return;
    if (item.run) item.run();
    else if (item.type === 'resume') resume(item);
    else if (item.live) watch(item.slug);
    else TVPanels.channel(item.slug);
  }
  function watch(slug) { play(slug); }
  function resume(item, startOver) {
    var owner = ++operation; toast('Opening recording…');
    serviceGet('/api/v2/channels/' + encodeURIComponent(item.slug) + '/videos', function (err, data) {
      if (owner !== operation) return;
      if (err) { TVPanels.menu('Can’t load this recording', [TVPanels.button('Retry', function () { TVNavigation.pop(); resume(item, startOver); }), TVPanels.button('Back', function () { TVNavigation.pop(); })]); return; }
      var list = (Array.isArray(data) ? data : []).filter(playableVod), found = -1;
      for (var i = 0; i < list.length; i++) if (vodStableId(list[i]) === item.id) { found = i; break; }
      if (found < 0) { TVPanels.menu('Recording unavailable', [TVPanels.button('Past videos', function () { TVNavigation.closeAll(); recordings(item.slug); }), TVPanels.button('Back', function () { TVNavigation.pop(); })], 'It may have been removed or restricted.'); return; }
      playVod(list[found], list, found, item.slug, { startOver: !!startOver });
    }, { priority: 0 });
  }
  function onPlaybackStart() {
    if (!initialized) return;
    if (screen) TVNavigation.capture(context());
    operation++; TVNavigation.closeAll(); hideCatalogs(); closeSidebar(); screen = ''; nav = false;
    el('tv-content').classList.add('hidden'); el('tv-catalog-tools').classList.add('hidden'); TVPlayer.hide(); mode();
    if (typeof flushChatRender === 'function') flushChatRender();
  }
  function returnToSource() { var saved = TVNavigation.source() || { screen: 'home' }; show(saved.screen, saved, true); }
  function recordings(slug) { if (!slug) return; show('vods', { vodSlug: slug }, false); }
  function searchInput() {
    var returnTo = context();
    openAdd();
    el('addlabel').textContent = 'Find a channel'; el('addok').textContent = 'Save channel';
    TVNavigation.push({ id: 'search-input', legacy: true,
      close: function () { add.session++; clearTimeout(addSearchTimer); el('addinput').blur(); el('addmodal').className = 'hidden'; setMode('player'); },
      restore: function () { show(returnTo.screen, returnTo, true); },
      key: function (e) {
        if (e.keyCode === KEY.BACK && document.activeElement === el('addinput')) { el('addinput').blur(); add.zone = 'list'; if (add.results.length) { add.focus = 0; applyAddFocus(); } return true; }
        if (e.keyCode === KEY.BACK) { TVNavigation.pop(); return true; }
        if (e.keyCode === KEY.OK && add.zone === 'input') {
          var q = el('addinput').value.trim(); if (q) addChannelBySlug(q); return true;
        }
        return false;
      } });
  }
  function catalogue() { return cats.open ? { obj: cats, view: getCatsGrid(), move: catsMove, apply: applyCatsFocus, kind: 'cats' } : vods.open ? { obj: vods, view: getVodGrid(), move: vodMove, apply: applyVodFocus, kind: 'vods' } : { obj: browse, view: getBrowseGrid(), move: browseMove, apply: applyBrowseFocus, kind: 'browse' }; }
  function catalogueFocus() {
    mode(); catalogueDetails(); if (nav || TVNavigation.busy()) return;
    if (toolbar) { TVFocus.set(el(toolIndex ? 'tv-catalog-filters' : 'tv-catalog-categories')); return; }
    var cat = catalogue(), o = cat.obj; o.zone = 'grid'; cat.apply();
    var card = cat.view.get(o.gridIdx);
    if (!card) { TVFocus.set(el('tv-catalog-filters')); return; }
    if (catalogOptions) {
      var button = card.querySelector('.tv-catalog-options');
      if (!button) { button = document.createElement('button'); button.type = 'button'; button.className = 'tv-catalog-options'; button.textContent = 'Options'; button.tabIndex = -1; card.appendChild(button);
        button.addEventListener('click', function (e) { e.stopPropagation(); catalogueOptions(); }); }
      TVFocus.set(button);
    } else TVFocus.set(mainTarget(card));
  }
  function catalogueRendered(kind, view) {
    var current = cats.open ? 'cats' : vods.open ? 'vods' : browse.open ? 'browse' : '';
    if (current !== kind || TVNavigation.busy() || nav || toolbar) return;
    catalogueDetails();
    if (kind === 'browse' && pendingCatalogue && browse.streams.length) {
      var saved = pendingCatalogue; pendingCatalogue = null;
      browse.gridIdx = catalogueIdentityIndex(browse.streams, catalogueKey, saved.browseKey, saved.browseIndex);
      view.container.scrollTop = saved.scroll || 0;
      view.focus(browse.gridIdx);
    }
    var obj = kind === 'cats' ? cats : kind === 'vods' ? vods : browse;
    var node = view.get(obj.gridIdx);
    if (node) {
      if (!node.querySelector('.tv-card-main') && !node.classList.contains('catalogue-state') && !node.classList.contains('bskel') && !node.classList.contains('cskel')) {
        node.setAttribute('role', 'group'); node.removeAttribute('tabindex');
        var main = document.createElement('button'); main.type = 'button'; main.className = 'tv-card-main'; main.tabIndex = -1;
        main.setAttribute('aria-label', node.textContent.trim()); node.insertBefore(main, node.firstChild);
      }
      if (!node.querySelector('.tv-catalog-options') && !node.classList.contains('catalogue-state') && !node.classList.contains('bskel') && !node.classList.contains('cskel')) {
        var button = document.createElement('button'); button.type = 'button'; button.className = 'tv-catalog-options'; button.textContent = 'Options'; button.tabIndex = -1;
        button.addEventListener('click', function (e) { e.stopPropagation(); obj.gridIdx = Number(node.getAttribute('data-idx')); catalogueOptions(); }); node.appendChild(button);
      }
      TVFocus.set(catalogOptions ? node.querySelector('.tv-catalog-options') || mainTarget(node) : mainTarget(node));
    }
  }
  function catalogueDetails() {
    var cat = catalogue(), item = cat.view.items[cat.obj.gridIdx], text = '';
    if (item) {
      if (item.catalogueTerminal) text = item.message;
      else if (cat.kind === 'browse') text = ((item.channel && item.channel.user && item.channel.user.username) || catalogueKey(item)) + ' · ' + (item.session_title || 'Live stream');
      else if (cat.kind === 'vods') text = item.session_title || 'Past video';
      else text = item.all ? 'Explore every category' : item.name || item.slug || '';
    }
    changedText(el('tv-catalog-detail'), text);
  }
  function catalogueOptions() {
    var cat = catalogue(), o = cat.obj, item = cat.view.items[o.gridIdx];
    if (!item || item.catalogueTerminal || item.skeleton != null) return;
    if (cat.kind === 'browse') {
      var slug = catalogueKey(item), c = state.channels[slug] || {};
      c.slug = slug; c.name = item.channel && item.channel.user && item.channel.user.username || slug;
      c.title = item.session_title || ''; c.live = true; c.viewers = item.viewer_count || 0;
      c.category = item.categories && item.categories[0] && item.categories[0].name || '';
      state.channels[slug] = c; TVPanels.channel(slug);
    }
    else if (cat.kind === 'cats') { var c = displayedCats()[o.gridIdx - 1]; if (c) TVPanels.category(c); }
    else TVPanels.recording(vods.slug, item, function (startOver) { playVod(item, vods.list.slice(), o.gridIdx, vods.slug, { startOver: !!startOver }); });
  }
  function catalogueActivate() {
    var cat = catalogue(), item = cat.view.items[cat.obj.gridIdx];
    if (catalogOptions) { catalogueOptions(); return; }
    if (cat.kind === 'browse') { if (item && !item.catalogueTerminal && item.skeleton == null) watch(catalogueKey(item)); else browseActivate(); }
    else if (cat.kind === 'vods') { if (item && !item.catalogueTerminal && item.source) playVod(item, vods.list.slice(), cat.obj.gridIdx, vods.slug); else vodActivate(); }
    else if (cats.gridIdx === 0) { closeCats(); clearBrowseCats(); catalogueFocus(); }
    else if (item && !item.catalogueTerminal && item.skeleton == null) { var c = displayedCats()[cats.gridIdx - 1]; closeCats(); if (c) openBrowse(c.slug, c.name); catalogueFocus(); }
    else catsActivate();
  }
  function catalogKey(e) {
    var k = e.keyCode, cat = catalogue(), o = cat.obj, cols = BROWSE_COLS;
    if (k === KEY.BACK) { if (cats.open) { closeCats(); catalogueFocus(); } else show('home'); return true; }
    if (document.activeElement === el('cats-search')) { if (k === KEY.BACK || k === KEY.OK) { el('cats-search').blur(); toolbar = true; toolIndex = 1; catalogueFocus(); return true; } return false; }
    if (toolbar) {
      if (k === KEY.DOWN) toolbar = false;
      else if (k === KEY.LEFT && toolIndex === 0) { nav = true; toolbar = false; }
      else if (k === KEY.LEFT || k === KEY.RIGHT) toolIndex = k === KEY.LEFT ? 0 : 1;
      else if (k === KEY.UP) { nav = true; toolbar = false; }
      else if (k === KEY.OK) {
        if (toolIndex) { if (cats.open) { el('cats-search').focus(); return true; } else if (vods.open) toggleVodHideWatched(); else TVPanels.filters(); }
        else if (vods.open) TVPanels.channel(vods.slug);
        else if (cats.open) { closeCats(); toolbar = false; }
        else openCats();
      }
      catalogueFocus(); return true;
    }
    if (k === KEY.OK) { catalogueActivate(); return true; }
    if (k === KEY.UP && o.gridIdx < cols && !catalogOptions) { toolbar = true; catalogueFocus(); return true; }
    if (k === KEY.LEFT && o.gridIdx % cols === 0) { nav = true; restoreFocus(); return true; }
    if (k === KEY.DOWN && !catalogOptions && cat.view.items[o.gridIdx] && !cat.view.items[o.gridIdx].catalogueTerminal) { catalogOptions = true; catalogueFocus(); return true; }
    if (k === KEY.UP && catalogOptions) { catalogOptions = false; catalogueFocus(); return true; }
    if ([KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN].indexOf(k) >= 0) {
      var dx = k === KEY.LEFT ? -1 : k === KEY.RIGHT ? 1 : 0, dy = k === KEY.UP ? -1 : k === KEY.DOWN ? 1 : 0;
      if (dx) preferred = Math.max(0, Math.min(cols - 1, o.gridIdx % cols + dx));
      o.gridIdx = TVFocus.move(o.gridIdx, cat.view.items.length, cols, dx, dy, preferred);
      if (dy) catalogOptions = false;
      cat.apply(); catalogueFocus(); return true;
    }
    return false;
  }
  function key(e) {
    var k = e.keyCode;
    if (backupRestoreBlocked) return false;
    if (saver.on || sleepStateWarning()) return false;
    if (!state.ready) return false;
    if (typeof startupResumePending !== 'undefined') { startupUserTookOver = true; startupResumePending = false; }
    if (e.repeat && k === KEY.OK) return true;
    if (TVNavigation.busy()) return TVNavigation.key(e);
    if (chpop.open || settings.open || state.mode === 'add' || state.mode === 'confirm' || backup.open || qualityopt.open || chatopt.open || dimopt.open || blockedcats.open || updateopen || wtw.open) return false;
    if (vodNext.open || raid.open) return false;
    if (k === KEY.RED) { TVPanels.quick(); return true; }
    if (k === KEY.BLUE) { show('browse'); return true; }
    if (k === KEY.YELLOW) { recordings(state.current || state.vod && state.vod.slug); return true; }
    if (k === KEY.GREEN) { toggleChatForPlayer(); TVPlayer.render(); return true; }
    if (!page() && (isChUp(k) || isChDown(k))) { openSidebar(); moveSide(isChUp(k) ? -1 : 1); return true; }
    if (k === KEY.STOP) { returnToIdle(); show('home'); return true; }
    if (state.sidebarOpen) {
      if (k === KEY.BACK || k === KEY.LEFT) { closeSidebar(); TVPlayer.show(); }
      else if (k === KEY.RIGHT) { var it = state.sideItems[state.sideFocus]; if (it && it.slug) TVPanels.channel(it.slug); }
      else if (k === KEY.UP) moveSide(-1);
      else if (k === KEY.DOWN) moveSide(1);
      else if (k === KEY.OK) { var item = state.sideItems[state.sideFocus]; if (item && item.slug) { closeSidebar(); watch(item.slug); } else activateSide(); }
      else return false;
      return true;
    }
    if (page()) {
      if (nav) {
        if (k === KEY.UP || k === KEY.DOWN) navIndex = Math.max(0, Math.min(navigation.length + ((state.current || state.vod) ? 0 : -1), navIndex + (k === KEY.UP ? -1 : 1)));
        else if (k === KEY.RIGHT) nav = false;
        else if (k === KEY.OK) { if (navIndex === navigation.length) { onPlaybackStart(); TVPlayer.show(); } else show(navigation[navIndex]); return true; }
        else if (k === KEY.BACK) { if (screen === 'home') TVPanels.exit(); else show('home', null, true); return true; }
        else return false;
        if (navIndex === navigation.length && nav) TVFocus.set(el('tv-return')); else restoreFocus(); return true;
      }
      if (browse.open || cats.open || vods.open) return catalogKey(e);
      if (k === KEY.BACK) { if (screen === 'home') TVPanels.exit(); else { var prev = TVNavigation.back(); show(prev.screen, prev, true); } return true; }
      if (k === KEY.OK) { if (options) openOptions(currentItem()); else activate(currentItem()); return true; }
      if ([KEY.UP, KEY.DOWN, KEY.LEFT, KEY.RIGHT].indexOf(k) < 0) return false;
      var count = rows[row].items.length, columns = row === 0 ? count : BROWSE_COLS;
      if (k === KEY.LEFT && col % columns === 0) { nav = true; restoreFocus(); return true; }
      if (k === KEY.DOWN && row > 0 && !options) options = true;
      else if (k === KEY.UP && options) options = false;
      else if (k === KEY.LEFT || k === KEY.RIGHT) { col = TVFocus.move(col, count, columns, k === KEY.LEFT ? -1 : 1, 0); preferred = col % columns; }
      else if (k === KEY.UP && (row === 0 || col < columns)) { row = Math.max(0, row - 1); col = Math.min(preferred, rows[row].items.length - 1); options = false; }
      else if (k === KEY.DOWN && (row === 0 || col + columns >= count)) { row = Math.min(rows.length - 1, row + 1); col = Math.min(preferred, rows[row].items.length - 1); options = false; }
      else { col = TVFocus.move(col, count, columns, 0, k === KEY.UP ? -1 : 1, preferred); options = false; }
      restoreFocus(); return true;
    }
    if (state.current || state.vod) return TVPlayer.key(e);
    if (k === KEY.BACK) TVPanels.exit(); else show('home');
    return true;
  }
  function toggleChatForPlayer() {
    var slug = chatStreamerSlug(), first = !settings.chat && !chatPreferences.profiles[slug];
    toggleChat();
    if (first && settings.chat) { settings.chatSeparate = true; settings.chatTransparency = 15; ChatWindow.preset('right'); saveSettings(); applyChatStyle(); }
  }
  function searchResult(c) {
    if (!c || !c.slug) return;
    if (TVNavigation.top() && TVNavigation.top().id === 'search-input') TVNavigation.pop();
    if (!state.channels[c.slug]) state.channels[c.slug] = { slug: c.slug, name: c.user && c.user.username || c.slug, live: !!(c.isLive || c.is_live), avatar: c.user && c.user.profile_pic };
    TVPanels.channel(c.slug);
  }
  function playbackFailed(message, slug) {
    returnToSource();
    TVPanels.menu(message, [TVPanels.button('Retry', function () { TVNavigation.closeAll(); watch(slug); }),
      TVPanels.button('Browse live', function () { show('browse'); }), TVPanels.button('Back', function () { TVNavigation.pop(); })],
      'Your channels and viewing progress are kept.');
  }
  function sleepStateWarning() { return typeof sleepTimer !== 'undefined' && sleepTimer.warning; }
  function init() {
    if (initialized) return; initialized = true;
    document.body.classList.add('tv-ui'); content = el('tv-page-content'); TVPanels.init(); TVPlayer.init();
    var links = el('tv-nav-links');
    navigation.forEach(function (id, i) {
      var b = document.createElement('button'); b.id = 'tv-nav-' + id; b.type = 'button'; b.className = 'tv-nav-item'; b.tabIndex = -1;
      var icon = document.createElement('span'); icon.className = 'tv-nav-icon'; icon.textContent = symbols[i]; icon.setAttribute('aria-hidden', 'true');
      var text = document.createElement('span'); text.className = 'tv-nav-label'; text.textContent = labels[i]; b.appendChild(icon); b.appendChild(text);
      b.addEventListener('click', function () { show(id); }); b.addEventListener('mousemove', function () { nav = true; navIndex = i; restoreFocus(); }); links.appendChild(b);
    });
    el('tv-return').addEventListener('click', function () { onPlaybackStart(); TVPlayer.show(); });
    el('tv-catalog-filters').addEventListener('click', function () { if (cats.open) el('cats-search').focus(); else if (vods.open) { toggleVodHideWatched(); catalogueFocus(); } else TVPanels.filters(); });
    el('tv-catalog-categories').addEventListener('click', function () { if (vods.open) TVPanels.channel(vods.slug); else if (cats.open) closeCats(); else openCats(); catalogueFocus(); });
    document.addEventListener('keydown', function (e) {
      if (key(e)) { markInput(); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('click', function (e) {
      if (typeof startupResumePending !== 'undefined') { startupUserTookOver = true; startupResumePending = false; }
      var top = TVNavigation.top();
      if (!top && (browse.open || cats.open || vods.open)) {
        var card = e.target.closest('.bcard, .ccard'), cat = catalogue();
        if (card && cat.view.container.contains(card) && card.hasAttribute('data-idx')) {
          cat.obj.gridIdx = Number(card.getAttribute('data-idx')); nav = false; toolbar = false;
          catalogOptions = !!e.target.closest('.tv-catalog-options');
          e.preventDefault(); e.stopImmediatePropagation(); catalogueActivate(); return;
        }
      }
      if (!top) return;
      var allowed = top.legacy ? document.querySelector('#qualityoptmodal:not(.hidden), #chatoptmodal:not(.hidden), #dimoptmodal:not(.hidden), #backupmodal:not(.hidden), #blockedcatsmodal:not(.hidden), #addmodal:not(.hidden), #updatemodal:not(.hidden)') : top.id === 'read-chat' ? el('tv-chat-reading') : boxForSheet();
      if (allowed && !allowed.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('mousemove', function (e) {
      if (TVNavigation.busy() || nav || !(browse.open || cats.open || vods.open)) return;
      var card = e.target.closest('.bcard, .ccard');
      if (!card || !card.hasAttribute('data-idx')) return;
      var cat = catalogue(); cat.obj.gridIdx = Number(card.getAttribute('data-idx'));
      catalogOptions = !!e.target.closest('.tv-catalog-options'); catalogueFocus();
    });
    el('player').addEventListener('mousemove', function (e) { if (!page() && !TVNavigation.busy() && !state.sidebarOpen && !ChatWindow.activePointer(e.target)) TVPlayer.show(true); });
  }
  function boxForSheet() { return el('tv-sheet'); }
  function refresh() { if (screen && screen !== 'browse' && screen !== 'vods' && !TVNavigation.busy()) render(); }
  return { init: init, show: show, page: page, screen: function () { return screen; }, context: context, restoreFocus: restoreFocus,
    invalidate: function () { pendingRefresh = true; }, catalogueRendered: catalogueRendered, onPlaybackStart: onPlaybackStart, catalogueOpened: catalogueOpened, catalogueFocus: catalogueFocus, geometry: geometry,
    toggleChat: toggleChatForPlayer, searchResult: searchResult, playbackFailed: playbackFailed, watch: watch, resume: resume, recordings: recordings, returnToSource: returnToSource, refresh: refresh, key: key };
})();
TVApp.init();
