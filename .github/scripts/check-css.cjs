'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const files = fs.readdirSync('app').filter(f => f.endsWith('.css')).map(f => path.join('app', f));
if (!files.length) throw new Error('No app CSS files found');
const result = spawnSync(process.execPath, ['node_modules/doiuse/bin/cli.js', '--browsers', 'chrome 87', ...files], { encoding: 'utf8' });
if (result.error) throw result.error;
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) throw new Error('CSS checker failed: ' + result.status);
// Preserve the existing partial-support policy, but never hide tool failures.
const warnings = result.stdout.split(/\r?\n/).filter(line => line.trim() && !line.includes('partially supported'));
if (warnings.length) {
  console.error(warnings.join('\n'));
  process.exitCode = 1;
}
