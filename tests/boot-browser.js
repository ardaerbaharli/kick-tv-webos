/* Uses the real boot IIFE against the isolated fixture transport. */
window.runBootTests = async function (assert) {
  assert(state.ready, 'cold launch accepts input before network results');
  assert(settings.startup === 'home' && TVApp.screen() === 'home', 'fresh boot opens Home');
  assert(document.getElementById('tv-content').className.indexOf('hidden') === -1, 'fresh boot renders the navigation shell');
  assert(document.querySelectorAll('#tv-page-actions button').length === 3, 'first launch offers Browse, Search, and phone entry');
  assert(JSON.parse(fixtureStore['kicktv.settings']).startup === 'home', 'boot persists the startup choice before the first-run marker');
  assert(document.getElementById('dimscreen').style.opacity === '0', 'Home boot initializes dim settings');
  assert(typeof state.lastInput === 'number', 'Home boot initializes screen-protection activity');
  document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KEY.LEFT, bubbles: true }));
  assert(document.activeElement.id === 'tv-nav-home', 'navigation works while offline lookups are unresolved');
};
