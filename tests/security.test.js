/* Security regressions use dummy sessions and mocked HTTP; no sockets are opened.
 * VM isolation is a unit-test convenience, not the OS sandbox for audit execution. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'services/com.barisahmet.kicktv.service/service.js'), 'utf8');
const TOKEN_A = 'fixtureSessionAlpha1234', TOKEN_B = 'fixtureSessionBravo5678';

function harness(deferListen = false) {
  const handlers = {}, servers = [], timers = [];
  let now = 1000;
  const schedule = (fn, ms) => { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; };
  function Service() { this.register = (name, fn) => { handlers[name] = fn; }; }
  const http = { createServer(handler) {
    const server = new EventEmitter(); server.handler = handler;
    server.setTimeout = ms => { server.idleTimeout = ms; };
    server.address = () => ({ port: 8764 });
    server.listen = () => { server.listens = (server.listens || 0) + 1; if (!deferListen) server.emit('listening'); };
    server.close = () => { server.closed = true; };
    servers.push(server); return server;
  } };
  const modules = { 'webos-service': Service, http,
    https: { Agent: function () {}, get: () => assert.fail('Unexpected outbound request') },
    tls: { createSecureContext: () => ({}) },
    os: { networkInterfaces: () => ({ fixture: [{ address: '192.168.1.2', family: 'IPv4', internal: false }] }) } };
  const context = { require: name => { assert(Object.hasOwn(modules, name), name); return modules[name]; },
    Buffer, Date: { now: () => now }, process: { version: 'fixture', versions: { openssl: 'fixture' }, platform: 'fixture', arch: 'fixture' },
    setTimeout: schedule, setInterval: schedule, clearTimeout: t => { if (t) t.cleared = true; }, clearInterval: t => { if (t) t.cleared = true; } };
  vm.createContext(context); vm.runInContext(source, context);
  function call(method, payload) {
    const replies = []; handlers[method]({ payload, respond: r => replies.push(r) }); return replies;
  }
  function start(token = TOKEN_A) { return call('shareStart', { token, backup: '{"fixture":true}', names: ['<unsafe>'] }); }
  function request(token = TOKEN_A, file = 'restore', options = {}) {
    const req = new EventEmitter(), res = new EventEmitter(), server = context.share.server;
    const socket = new EventEmitter(); socket.remoteAddress = options.remote || '127.0.0.1';
    socket.destroy = () => { if (!socket.destroyed) { socket.destroyed = true; socket.emit('close'); } };
    server.emit('connection', socket); req.socket = socket;
    req.method = options.method || 'POST'; req.url = '/' + token + '/' + file;
    req.headers = Object.assign({ host: '127.0.0.1:8764', 'content-type': 'application/json' }, options.headers);
    req.destroy = () => { req.destroyed = true; req.emit('aborted'); socket.destroy(); };
    res.headers = {}; res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
    res.writeHead = (status, headers) => { res.statusCode = status; Object.assign(res.headers, headers || {}); };
    res.end = body => { res.body = body || ''; res.emit('close'); };
    server.handler(req, res); return { req, res, socket };
  }
  function send(r, body = { kind: 'names', data: ['fixture-channel'] }) { r.req.emit('data', Buffer.from(JSON.stringify(body))); r.req.emit('end'); }
  return { context, servers, timers, call, start, request, send, time: n => { now = n; } };
}

test('revoked pairing cannot deliver a previously accepted upload into a new session', () => {
  const h = harness(); h.start();
  const old = h.request(); old.req.emit('data', Buffer.from('{"kind":"names","data":["old-session"]}'));
  h.start(TOKEN_B); old.req.emit('end');
  assert.equal(old.res.statusCode, 410);
  assert.equal(h.call('sharePoll', { token: TOKEN_B })[0].inbox, null);
});

test('rotating a token discards the old session inbox and closes its sockets', () => {
  const h = harness(); h.start(); const r = h.request(); h.send(r);
  assert(h.context.share.inbox);
  h.start(TOKEN_B);
  assert.equal(r.socket.destroyed, true);
  assert.equal(h.call('sharePoll', { token: TOKEN_B })[0].inbox, null);
  assert.equal(h.request(TOKEN_A, '', { method: 'GET' }).res.statusCode, 404);
});

test('only the active pairing token may extend or stop the sharing session', () => {
  const h = harness(); h.start(); const initial = h.context.share.lastPoll;
  h.time(4000); h.call('sharePoll', { token: 'wrong' });
  assert.equal(h.context.share.lastPoll, initial);
  assert.equal(h.call('shareStop', {})[0].ok, false);
  assert.equal(h.call('shareStop', { token: TOKEN_B })[0].ok, false);
  h.call('sharePoll', { token: TOKEN_A }); assert.equal(h.context.share.lastPoll, 4000);
  const r = h.request(TOKEN_A, '', { method: 'GET' });
  assert.equal(h.call('shareStop', { token: TOKEN_A })[0].ok, true);
  assert.equal(h.context.share.token, ''); assert.equal(h.context.share.server, null);
  assert(r.socket.destroyed);
});

test('startup is serialized and cancellation cannot leave a late listener running', () => {
  const h = harness(true), a = h.start(), b = h.start(TOKEN_B);
  assert.equal(h.servers.length, 1);
  h.call('shareStop', { token: TOKEN_B }); h.servers[0].emit('listening');
  assert.equal(h.context.share.server, null); assert(h.servers[0].closed);
  assert.equal(a.length, 1); assert.equal(b.length, 1);
  assert.equal(a[0].ok, false); assert.equal(b[0].ok, false);
});

test('sharing rejects unexpected hosts, origins, non-LAN clients and non-JSON posts', () => {
  const h = harness(); h.start();
  assert.equal(h.request(TOKEN_A, '', { method: 'GET', headers: { host: 'untrusted.invalid:8764' } }).res.statusCode, 403);
  assert.equal(h.request(TOKEN_A, '', { method: 'GET', remote: '203.0.113.7' }).res.statusCode, 403);
  assert.equal(h.request(TOKEN_A, 'restore', { headers: { origin: 'https://untrusted.invalid' } }).res.statusCode, 403);
  assert.equal(h.request(TOKEN_A, 'restore', { headers: { 'content-type': 'text/plain' } }).res.statusCode, 415);
  const good = h.request(TOKEN_A, 'restore', { headers: { origin: 'http://127.0.0.1:8764' } }); h.send(good);
  assert.equal(good.res.statusCode, 200);
  assert.equal(good.res.headers['referrer-policy'], 'no-referrer');
  assert.equal(good.res.headers['x-frame-options'], 'DENY');
  assert.equal(good.res.headers['x-content-type-options'], 'nosniff');
});

test('uploads have independent size, concurrency and absolute time bounds', () => {
  const h = harness(); h.start();
  assert.equal(h.request(TOKEN_A, 'restore', { headers: { 'content-length': String(3 * 1024 * 1024) } }).res.statusCode, 413);
  const first = h.request(), second = h.request();
  assert.equal(h.request().res.statusCode, 429);
  const deadline = h.timers.find(t => t.ms === 15000 && !t.cleared); deadline.fn();
  assert(first.req.destroyed); assert.equal(h.context.share.server.shareUploads, 1);
  h.send(second); assert.equal(second.res.statusCode, 200);
  assert.equal(h.context.share.server.shareUploads, 0);
  assert.equal(h.context.share.server.maxConnections, 16);
  assert.equal(h.context.share.server.idleTimeout, 10000);
});

test('the sharing capability expires even before its periodic cleanup tick', () => {
  const h = harness(); h.start(); h.time(22000);
  assert.equal(h.request(TOKEN_A, '', { method: 'GET' }).res.statusCode, 404);
});

test('numeric badge formatting cannot return API-supplied HTML', () => {
  const api = fs.readFileSync(path.join(root, 'app/js/api.js'), 'utf8');
  const body = api.match(/function fmtViewers\(n\) \{[\s\S]*?\n\}/)[0];
  const context = {}; vm.createContext(context); vm.runInContext(body, context);
  for (const input of ['<img src=x onerror=alert(1)>', ['<b>'], {}, null, -1, Infinity, NaN]) assert.equal(context.fmtViewers(input), '0');
  assert.equal(context.fmtViewers(999), '999'); assert.equal(context.fmtViewers('1500'), '1.5K');
});

test('phone name lists never coerce untrusted objects and preview work stays bounded', () => {
  const context = { SEED_FAVORITES: [] }; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'app/js/backup.js'), 'utf8'), context);
  assert.equal(context.backupSlugs([{ toString: null }, null, 123]).length, 0);
  const values = Array.from({ length: 6000 }, (_, i) => 'fixture-' + i);
  assert.equal(context.backupSlugs(values).length, 200);
  const favorites = context.backupFavsOf({ 'kicktv.added': JSON.stringify(values), 'kicktv.removed': '["fixture-0"]' });
  assert(favorites.length <= 2000); assert(!favorites.includes('fixture-0'));
});
