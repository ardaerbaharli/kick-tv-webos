/* Screen history and modal ownership are independent of the playback session. ES5. */
var TVNavigation = (function () {
  'use strict';
  var layers = [], source = null, history = [];
  function push(layer) {
    layers.push(layer);
    TVFocus.clear();
    if (layer.open) layer.open();
  }
  function pop() {
    var layer = layers.pop();
    if (!layer) return false;
    if (layer.close) layer.close();
    TVFocus.clear();
    var top = layers[layers.length - 1];
    if (top && top.restore) top.restore();
    else if (layer.restore) layer.restore();
    return true;
  }
  function closeAll() {
    while (layers.length) { var layer = layers.pop(); if (layer.close) layer.close(); }
    TVFocus.clear();
  }
  return {
    push: push, pop: pop, closeAll: closeAll,
    top: function () { return layers[layers.length - 1] || null; },
    busy: function () { return layers.length > 0; },
    key: function (event) { var top = layers[layers.length - 1]; return !!(top && top.key && top.key(event)); },
    capture: function (context) { source = context; },
    source: function () { return source; },
    visit: function (context) { history.push(context); if (history.length > 20) history.shift(); },
    back: function () { return history.pop() || { screen: 'home' }; },
    reset: function () { closeAll(); source = null; history = []; }
  };
})();
