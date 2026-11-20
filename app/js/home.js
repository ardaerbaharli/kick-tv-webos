/* Home, saved channels and Search share content cards, not playback state. */
var TVHome = (function () {
  'use strict';
  function channel(slug) {
    var c = state.channels[slug] || offlineStub(slug), cached = previewCache[slug];
    return { key: slug, slug: slug, label: c.name || slug, title: c.title || (c.live ? 'Live stream' : 'Past videos available on channel'),
      meta: c.live ? 'Live · ' + fmtViewers(c.viewers) + ' viewers' : 'Offline',
      image: c.thumbnail || (cached && cached.url) || c.avatar, avatar: !c.thumbnail && !(cached && cached.url), live: c.live, type: 'channel' };
  }
  function resume(r) {
    return { key: r.key, slug: r.slug, id: r.id, label: r.entry.name || r.slug,
      title: r.entry.title || 'Past video', meta: fmtClock(r.entry.position) + (r.entry.duration ? ' / ' + fmtClock(r.entry.duration) : ''),
      progress: r.entry.duration ? Math.min(100, r.entry.position / r.entry.duration * 100) : 0, type: 'resume' };
  }
  function rows(screen, filter) {
    var saved = getFavorites(), live = saved.filter(function (s) { return state.channels[s] && state.channels[s].live; });
    if (screen === 'channels') {
      var slugs = saved.filter(function (s) {
        var c = state.channels[s];
        return filter === 'pinned' ? isPinned(s) : filter === 'live' ? c && c.live : filter === 'offline' ? !c || !c.live : true;
      });
      return [{ title: filter === 'all' ? 'Saved on this TV' : filter.charAt(0).toUpperCase() + filter.slice(1), items: slugs.map(channel) }];
    }
    var result = [], resumables = listResumableVods(4);
    if (live.length) result.push({ title: 'Live from your channels', items: live.slice(0, 4).map(channel) });
    if (resumables.length) result.push({ title: 'Continue watching', items: resumables.map(resume) });
    if (!result.length && saved.length) result.push({ title: 'Your channels', items: saved.slice(0, 8).map(channel) });
    return result;
  }
  function makeCard(item) {
    var card = document.createElement('div'); card.className = 'tv-card'; card.setAttribute('data-key', item.key);
    card.setAttribute('role', 'group');
    var main = document.createElement('button'); main.type = 'button'; main.className = 'tv-card-main'; main.tabIndex = -1; main.setAttribute('data-key', item.key);
    main.setAttribute('aria-label', item.label + '. ' + item.title + '. ' + item.meta); card.appendChild(main);
    var art = document.createElement('div'); art.className = 'tv-card-art' + (item.avatar ? ' tv-card-avatar' : '');
    art.setAttribute('aria-hidden', 'true');
    var initial = document.createElement('span'); initial.className = 'tv-card-initial'; initial.textContent = item.label.charAt(0); art.appendChild(initial);
    if (item.image) catalogueImage(art, item.image, item.label);
    var badge = document.createElement('span'); badge.className = 'tv-card-badge'; badge.textContent = item.live ? '● Live' : item.type === 'resume' ? 'Resume' : 'Offline'; art.appendChild(badge);
    var body = document.createElement('div'); body.className = 'tv-card-body';
    ['label', 'title', 'meta'].forEach(function (key) { var node = document.createElement(key === 'label' ? 'strong' : 'span'); node.className = 'tv-card-' + key; node.dir = 'auto'; node.setAttribute('aria-hidden', 'true'); node.textContent = item[key] || ''; body.appendChild(node); });
    var options = document.createElement('button'); options.type = 'button'; options.tabIndex = -1; options.className = 'tv-card-options'; options.textContent = 'Options'; options.setAttribute('aria-label', 'Options for ' + item.label); body.appendChild(options);
    if (item.progress != null) { var progress = document.createElement('div'); progress.className = 'tv-card-progress'; var fill = document.createElement('i'); fill.style.width = item.progress + '%'; progress.appendChild(fill); body.appendChild(progress); }
    card.appendChild(art); card.appendChild(body);
    return card;
  }
  return { rows: rows, card: makeCard, channel: channel };
})();
