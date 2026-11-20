/* Remote-first sheets. Every row has one action; nested sheets restore their trigger. */
var TVPanels = (function () {
  'use strict';
  var box, title, note, list, sequence = 0;
  function button(label, run, detail) { return { label: label, run: run, detail: detail || '' }; }
  function render(layer) {
    box.classList.remove('hidden'); title.textContent = layer.title; note.textContent = layer.note || '';
    list.innerHTML = '';
    layer.rows.forEach(function (row, i) {
      var el = document.createElement('button'); el.type = 'button'; el.className = 'tv-menu-row'; el.tabIndex = -1;
      var label = document.createElement('span'); label.textContent = row.label; el.appendChild(label);
      if (row.detail) { var sub = document.createElement('small'); sub.textContent = row.detail; el.appendChild(sub); }
      if (row.value != null) { var value = document.createElement('strong'); value.textContent = row.value; el.appendChild(value); }
      el.disabled = !!row.disabled;
      el.addEventListener('click', function () { layer.index = i; activate(layer); });
      el.addEventListener('mousemove', function () { layer.index = i; focus(layer); });
      list.appendChild(el);
    });
    layer.index = Math.max(0, Math.min(layer.rows.length - 1, layer.index)); focus(layer);
  }
  function focus(layer) { TVFocus.set(list.children[layer.index], true); }
  function activate(layer) {
    var row = layer.rows[layer.index];
    if (row && !row.disabled && row.run) row.run();
  }
  function menu(name, rows, description, index, restore) {
    var layer = { id: 'sheet-' + (++sequence), title: name, rows: rows, note: description, index: index || 0 };
    layer.open = function () { render(layer); };
    layer.close = function () { box.classList.add('hidden'); };
    layer.restore = function () { if (TVNavigation.top() === layer) render(layer); else if (restore) restore(); else TVApp.restoreFocus(); };
    layer.key = function (e) {
      var k = e.keyCode;
      if (k === KEY.BACK) TVNavigation.pop();
      else if (k === KEY.UP || k === KEY.DOWN) {
        layer.index = Math.max(0, Math.min(layer.rows.length - 1, layer.index + (k === KEY.UP ? -1 : 1))); focus(layer);
      } else if (k === KEY.OK) activate(layer);
      else if ((k === KEY.LEFT || k === KEY.RIGHT) && layer.rows[layer.index] && layer.rows[layer.index].adjust) {
        layer.rows[layer.index].adjust(k === KEY.LEFT ? -1 : 1); render(layer);
      }
      return true;
    };
    TVNavigation.push(layer); return layer;
  }
  function done(run) { TVNavigation.pop(); if (run) run(); }
  function legacy(kind) {
    var opens = { quality: openQualityOpt, advancedChat: openChatOpt, backup: openBackup, dim: openDimOpt, blocked: openBlockedCats, updates: openUpdateNotes };
    var closes = { quality: closeQualityOpt, advancedChat: closeChatOpt, backup: closeBackup, dim: closeDimOpt, blocked: closeBlockedCats, updates: closeUpdateNotes };
    var layer = { id: kind, legacy: true, open: opens[kind], close: closes[kind],
      restore: function () { TVApp.restoreFocus(); }, key: function (e) {
        if (e.keyCode === KEY.BACK) { TVNavigation.pop(); return true; }
        var k = e.keyCode;
        if (kind === 'quality') {
          if (k === KEY.UP || k === KEY.DOWN) qualityoptMove(k === KEY.UP ? -1 : 1);
          else if (k === KEY.OK || k === KEY.RIGHT) qualityoptActivate();
          else if (k === KEY.LEFT) TVNavigation.pop();
        } else if (kind === 'advancedChat') {
          if (k === KEY.UP || k === KEY.DOWN) chatoptMove(k === KEY.UP ? -1 : 1);
          else if (k === KEY.OK || k === KEY.RIGHT || k === KEY.LEFT) chatoptActivate(k === KEY.LEFT ? -1 : 1);
        } else if (kind === 'dim') {
          if (k === KEY.UP || k === KEY.DOWN) dimoptMove(k === KEY.UP ? -1 : 1);
          else if (k === KEY.OK || k === KEY.RIGHT || k === KEY.LEFT) dimoptActivate(k === KEY.LEFT ? -1 : 1);
        } else if (kind === 'blocked') {
          if (k === KEY.UP || k === KEY.DOWN) blockedcatsMove(k === KEY.UP ? -1 : 1);
          else if (k === KEY.OK || k === KEY.RIGHT) blockedcatsActivate();
        } else if (kind === 'backup') backupKey(k);
        else if (kind === 'updates') {
          if (k === KEY.UP || k === KEY.DOWN) document.getElementById('update-notes').scrollTop += k === KEY.UP ? -120 : 120;
          else if (k === KEY.OK) TVNavigation.pop();
        }
        return true;
      } };
    TVNavigation.push(layer);
  }
  function more() {
    var slug = state.current || (state.vod && state.vod.slug);
    menu('More', [
      button('Channel details', function () { channel(slug); }),
      button('Past videos', function () { TVNavigation.closeAll(); TVApp.recordings(slug); }),
      button('Chat options', chat),
      button('Quick settings', quick),
      button('Read chat', readChat, 'Scroll messages without moving the picture'),
      button('Home', function () { TVNavigation.closeAll(); TVApp.show('home'); })
    ], 'Keep watching while you choose.');
  }
  function quick() {
    menu('Quick settings', [
      button('Quality', function () { legacy('quality'); }, qualityCurrentLabel()),
      button('Chat layout', chat), button('Sleep timer', sleep),
      button('Night mode', function () { legacy('dim'); }, settings.dim ? 'On' : 'Off'),
      button('All settings', allSettings)
    ]);
  }
  function sleep() {
    menu('Sleep timer', [0, 15, 30, 45, 60, 90, 120, 180].map(function (minutes) {
      return button(minutes ? minutes + ' minutes' : 'Off', function () { setSleepTimer(minutes); done(); },
        minutes === sleepLeftMin() ? 'Selected' : '');
    }), 'Stop playback and darken the screen when the timer ends.');
  }
  function choice(it) {
    menu(it.label, it.values.map(function (v, i) {
      return button(v.label, function () { selectChoice(it, i); done(); TVApp.geometry(); }, settings[it.key] === v.v ? 'Selected' : '');
    }));
  }
  function settingRow(it) {
    var row = button(it.label, function () {
      if (it.kind === 'choice') choice(it);
      else if (it.kind === 'chatopt') chat();
      else if (it.kind === 'dimopt') legacy('dim');
      else if (it.kind === 'blockedcats') legacy('blocked');
      else if (it.kind === 'backup') legacy('backup');
      else if (it.kind === 'toggle') {
        settings[it.key] = !settings[it.key]; saveSettings(); applyToggle(it.key);
        row.value = settings[it.key] ? 'On' : 'Off'; render(TVNavigation.top());
      }
    }, descForSettingItem(it));
    row.value = it.kind === 'toggle' ? (settings[it.key] ? 'On' : 'Off') : it.kind === 'range' ? settingsRangeLabel(it) : '›';
    if (it.kind === 'range') {
      row.run = function () { row.adjust(1); render(TVNavigation.top()); };
      row.adjust = function (dir) {
        var value = settings[it.key] + dir * it.range.step;
        settings[it.key] = Math.max(it.range.min, Math.min(it.range.max, value));
        if (it.key === 'sleepMin') setSleepTimer(settings[it.key]);
        if (it.key === 'saverMin' && !settings.saverMin) wakeSaver();
        saveSettings(); row.value = settingsRangeLabel(it);
      };
      row.detail += '  ← → Adjust';
    }
    return row;
  }
  function allSettings() {
    var groups = [
      ['Playback', ['startup', 'lowlatency', 'autoadvance', 'raidFollow', 'autoSkipWatched']],
      ['Chat', ['chatopt']],
      ['Appearance & accessibility', ['uiText', 'reducedMotion', 'dimopt', 'saverMin']],
      ['Channels & discovery', ['hideOffline', 'hideBots', 'blockedcats']],
      ['Notifications', ['alerts', 'notifySec']],
      ['Data & support', ['backup', 'diagnostics']]
    ];
    menu('Settings', groups.map(function (group) {
      var row = button(group[0], function () {
        var rows = settingsBuild().filter(function (it) { return group[1].indexOf(it.key || it.kind) !== -1; }).map(settingRow);
        if (group[0] === 'Chat') {
          rows = [button('Defaults for new channels', chatDefaults)];
          if (chatStreamerSlug()) rows.push(button('Current channel', chat));
        }
        if (group[0] === 'Data & support') rows.push(button('Version & updates', function () {
          if (updateInfo) legacy('updates');
          else menu('Version & updates', [button('Check for updates', function () { checkForUpdate(); toast('Checking for updates…'); }), button('Back', function () { TVNavigation.pop(); })],
            'Installed version: ' + (appVersion || '1.0.0') + '. Updates are installed from this fork’s GitHub Releases using webOS Dev Manager.');
        }, 'Kick TV · ' + (appVersion || '1.0.0')));
        menu(group[0], rows);
      }); row.value = '›'; return row;
    }), 'Your channels and preferences are saved on this TV.');
  }
  function save(slug) {
    if (isFavorite(slug)) return;
    addFavorite(slug); TVApp.invalidate();
    if (state.tempChannel === slug) state.tempChannel = null;
    if (state.order.indexOf(slug) === -1 && state.channels[slug]) state.order.push(slug);
    apiGet(slug, function (err, raw) {
      if (!err && raw) { state.channels[slug] = normalize(slug, raw); sortOrder(currentFavoritesWithData()); saveChannelCache(); }
    });
    saveChannelCache();
  }
  function remove(slug) {
    var pinned = isPinned(slug);
    removeFavorite(slug); TVApp.invalidate();
    if (state.current === slug) state.tempChannel = slug;
    state.order = state.order.filter(function (s) { return s !== slug; });
    saveChannelCache();
    var row = button('Undo removal', function () {
      save(slug); if (pinned && !isPinned(slug)) togglePin(slug);
      done();
    });
    menu('Channel removed', [row, button('Done', function () { TVNavigation.pop(); TVNavigation.pop(); TVApp.refresh(); })],
      'You can save this channel again at any time. Playback continues.');
  }
  function channel(slug) {
    if (!slug) { toast('Choose a channel first'); return; }
    var c = state.channels[slug] || { name: slug }, layer;
    function rows() {
      var result = [button(c.live ? 'Watch live' : 'Check live stream', function () { TVNavigation.closeAll(); TVApp.watch(slug); }),
        button('Past videos', function () { TVNavigation.closeAll(); TVApp.recordings(slug); })];
      result.push(button(isFavorite(slug) ? 'Remove saved channel' : 'Save channel', function () {
        if (isFavorite(slug)) remove(slug);
        else { save(slug); layer.rows = rows(); render(layer); }
      }));
      if (isFavorite(slug)) result.push(button(isPinned(slug) ? 'Unpin channel' : 'Pin channel', function () {
        togglePin(slug); TVApp.invalidate(); saveChannelCache(); layer.rows = rows(); render(layer);
      }));
      return result;
    }
    layer = menu(c.name || slug, rows(), c.title || 'Live streams, recordings, and saved channel options.');
    apiGet(slug, function (err, raw) {
      if (err || !raw || TVNavigation.top() !== layer) return;
      c = normalize(slug, raw); state.channels[slug] = c;
      layer.title = c.name; layer.note = (c.live ? 'Live · ' : 'Offline · ') + (c.category || '') + (c.title ? ' · ' + c.title : '');
      layer.rows = rows(); render(layer);
    });
  }
  function recording(slug, v, resume) {
    menu(v.session_title || v.entry && v.entry.title || 'Past video', [
      button('Resume', function () { TVNavigation.closeAll(); resume(false); }),
      button('Start over', function () { TVNavigation.closeAll(); resume(true); }),
      button('Remove from Continue watching', function () {
        var data = loadVodProgress(), key = vodProgressKey(slug, v);
        if (data.items[key]) { data.items[key].dismissed = true; writeVodProgress(data); } done(); TVApp.refresh();
      })
    ], 'Your progress is saved on this TV.');
  }
  function filters() {
    var draft = { langs: browse.langs.slice(), discover: browse.discover, blocked: browse.hideBlocked };
    var layer, rows = [];
    BROWSE_LANGS.slice(1).forEach(function (lang) {
      var row = button(lang.label, function () {
        var i = draft.langs.indexOf(lang.value);
        if (i < 0) draft.langs.push(lang.value); else draft.langs.splice(i, 1);
        row.value = draft.langs.indexOf(lang.value) < 0 ? '○' : '✓'; render(layer);
      });
      row.value = draft.langs.indexOf(lang.value) < 0 ? '○' : '✓'; rows.push(row);
    });
    [['Hide saved channels', 'discover'], ['Hide blocked categories', 'blocked']].forEach(function (entry) {
      var row = button(entry[0], function () { draft[entry[1]] = !draft[entry[1]]; row.value = draft[entry[1]] ? 'On' : 'Off'; render(layer); });
      row.value = draft[entry[1]] ? 'On' : 'Off'; rows.push(row);
    });
    rows.push(button('Apply filters', function () {
      browse.langs = draft.langs; browse.discover = draft.discover; browse.hideBlocked = draft.blocked;
      saveBrowseLangPref();
      try { localStorage.setItem('kicktv.browsediscover', draft.discover ? '1' : '0'); localStorage.setItem('kicktv.browsehideblocked', draft.blocked ? '1' : '0'); } catch (e) {}
      refilterBrowse(); done(); TVApp.catalogueFocus();
    }));
    rows.push(button('Clear all filters', function () {
      draft.langs = []; draft.discover = false; draft.blocked = false; browse.cats = [];
      browse.langs = []; browse.discover = false; browse.hideBlocked = false;
      saveBrowseLangPref();
      try { localStorage.setItem('kicktv.browsediscover', '0'); localStorage.setItem('kicktv.browsehideblocked', '0'); } catch (e) {}
      renderPinnedCatChips(); refilterBrowse(); done(); TVApp.catalogueFocus();
    }));
    layer = menu('Filters', rows, 'Choose languages and visibility. Apply to update streams; Back cancels.');
  }
  function category(c) {
    menu(c.name || c.slug, [
      button('Browse streams', function () { TVNavigation.closeAll(); closeCats(); openBrowse(c.slug, c.name); TVApp.catalogueFocus(); }),
      button(isCatPinned(c.slug) ? 'Unpin category' : 'Pin category', function () { toggleCatPin(c.slug, c.name); done(); }),
      button(isCatBlocked(c.slug) ? 'Unblock category' : 'Block category', function () { toggleCatBlock(c.slug, c.name); applyBlockedChange(); done(); })
    ]);
  }
  function defaultsPicker(name, choices) {
    menu(name, choices.map(function (entry) {
      return button(entry[0], function () {
        var next = chatOptionsFrom(chatPreferences.defaults);
        for (var key in entry[1]) if (Object.prototype.hasOwnProperty.call(entry[1], key)) next[key] = entry[1][key];
        next.chat = false; chatPreferences.defaults = next; writeChatPreferences();
        if (!chatStreamerSlug()) useChatOptions(next);
        done();
      });
    }));
  }
  function chatDefaults() {
    menu('Chat defaults', [
      button('Text size', function () { defaultsPicker('Default chat text', [['Standard', { chatSize: 'medium' }], ['Large', { chatSize: 'large' }], ['Extra large', { chatSize: 'xlarge' }]]); }),
      button('Background', function () { defaultsPicker('Default chat background', [['Solid dark', { chatBackground: 'black', chatTransparency: 0 }], ['Dimmed dark', { chatBackground: 'black', chatTransparency: 15 }], ['Light', { chatBackground: 'white', chatTransparency: 0 }]]); }),
      button('Message timing', function () { defaultsPicker('Default message timing', [['Auto · match video', { chatDelay: -1 }], ['No delay', { chatDelay: 0 }], ['5 seconds', { chatDelay: 5 }], ['10 seconds', { chatDelay: 10 }]]); })
    ], 'For new channels. Existing channel preferences stay as you set them. Chat starts off until you enable it.');
  }
  function chat() {
    if (!chatStreamerSlug()) { toast('Play a stream to configure chat'); return; }
    applyStreamerChatPreferences();
    menu('Chat options', [
      button('Layout', function () {
        menu('Chat layout', ['Off', 'Right panel', 'Left panel', 'Overlay'].map(function (label, i) {
          return button(label, function () {
            if (i === 0) { if (settings.chat) toggleChat(); }
            else {
              if (!settings.chat) toggleChat();
              settings.chatSeparate = i === 1 || i === 2;
              settings.chatTransparency = 15;
              ChatWindow.preset(i === 2 ? 'left' : i === 1 ? 'right' : 'overlay');
              saveSettings(); applyChatStyle();
            }
            done();
          });
        }));
      }, settings.chat ? 'On' : 'Off'),
      button('Width', function () {
        menu('Chat width', [['Narrow', 360], ['Standard', 460], ['Wide', 580]].map(function (entry) {
          return button(entry[0], function () { ChatWindow.width(entry[1]); done(); });
        }));
      }),
      button('Text size', function () {
        menu('Chat text size', [['Standard', 'medium'], ['Large', 'large'], ['Extra large', 'xlarge']].map(function (entry) {
          return button(entry[0], function () { settings.chatSize = entry[1]; saveSettings(); applyChatStyle(); done(); });
        }));
      }),
      button('Background', function () {
        menu('Chat background', [['Solid dark', 'black', 0], ['Dimmed dark', 'black', 15], ['Light', 'white', 0]].map(function (entry) {
          return button(entry[0], function () { settings.chatBackground = entry[1]; settings.chatTransparency = entry[2]; saveSettings(); applyChatStyle(); done(); });
        }));
      }),
      button('Read chat', readChat),
      button('Advanced', function () { legacy('advancedChat'); }),
      button('Reset layout', function () { ChatWindow.reset(); toast('Chat layout reset'); })
    ], 'Read-only chat · For this channel');
  }
  function readChat() {
    if (!settings.chat) TVApp.toggleChat();
    if (!settings.chat) return;
    var readAction = 0;
    var layer = { id: 'read-chat', open: function () { box.classList.add('hidden'); TVPlayer.hide(); ChatWindow.remoteReading(true); document.getElementById('tv-chat-reading').classList.remove('hidden'); TVFocus.set(document.getElementById('tv-chat-live')); },
      close: function () { ChatWindow.remoteReading(false); document.getElementById('tv-chat-reading').classList.add('hidden'); },
      restore: function () { TVApp.restoreFocus(); }, key: function (e) {
        if (e.keyCode === KEY.BACK) TVNavigation.pop();
        else if (e.keyCode === KEY.OK) { if (readAction) TVNavigation.pop(); else ChatWindow.jump(); }
        else if (e.keyCode === KEY.LEFT || e.keyCode === KEY.RIGHT) { readAction = e.keyCode === KEY.RIGHT ? 1 : 0; TVFocus.set(document.getElementById(readAction ? 'tv-chat-done' : 'tv-chat-live')); }
        else if (e.keyCode === KEY.UP || e.keyCode === KEY.DOWN) ChatWindow.scroll(e.keyCode === KEY.UP ? -160 : 160);
        return true;
      } };
    TVNavigation.push(layer);
  }
  function exit() { menu('Exit Kick TV?', [button('Stay', function () { done(); }), button('Exit app', exitApp)], 'Your channels and progress will be kept.'); }
  function init() {
    box = document.getElementById('tv-sheet'); title = document.getElementById('tv-sheet-title');
    note = document.getElementById('tv-sheet-note'); list = document.getElementById('tv-sheet-list');
    document.getElementById('tv-sheet-back').addEventListener('click', function () { TVNavigation.pop(); });
    document.getElementById('tv-chat-live').addEventListener('click', function () { ChatWindow.jump(); });
    document.getElementById('tv-chat-done').addEventListener('click', function () { TVNavigation.pop(); });
  }
  return { init: init, menu: menu, button: button, legacy: legacy, more: more, quick: quick, settings: allSettings,
    channel: channel, recording: recording, filters: filters, category: category, chat: chat, remove: remove, exit: exit };
})();
