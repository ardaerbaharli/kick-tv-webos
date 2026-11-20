'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../.github/scripts/check-css.cjs'), 'utf8');
function check(result) {
  const process = { execPath: '/fixture/node', stderr: { write() {} } };
  vm.runInNewContext(source, {
    require(name) {
      if (name === 'node:fs') return { readdirSync: () => ['app.css'] };
      if (name === 'node:path') return path;
      if (name === 'node:child_process') return { spawnSync: () => result };
      throw new Error(name);
    },
    process, console: { error() {} }
  });
  return process.exitCode || 0;
}
test('CSS checker fails closed on execution errors and nonzero exit', () => {
  assert.throws(() => check({ error: new Error('spawn failed') }), /spawn failed/);
  assert.throws(() => check({ status: 1, stdout: '', stderr: 'parse error' }), /checker failed/);
});
test('CSS checker rejects unsupported CSS while preserving partial-support policy', () => {
  assert.equal(check({ status: 0, stdout: 'unsupported feature\n', stderr: '' }), 1);
  assert.equal(check({ status: 0, stdout: 'feature partially supported\n', stderr: '' }), 0);
  assert.equal(check({ status: 0, stdout: '', stderr: '' }), 0);
});
