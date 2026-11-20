"""Publish verified assets through a draft; retries never replace published files."""
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

repo = os.environ['GITHUB_REPOSITORY']
tag = os.environ['RELEASE_TAG']
sha = os.environ['GITHUB_SHA']
token = os.environ['GH_TOKEN']
if not re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', tag):
    raise ValueError('Expected a plain vX.Y.Z tag')
base = 'https://api.github.com/repos/' + repo


def request(url, method='GET', data=None, content_type='application/json'):
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': content_type}
    # Only API/upload hosts receive the token. Asset bytes are downloaded separately.
    if urllib.parse.urlparse(url).hostname not in ('api.github.com', 'uploads.github.com'):
        raise ValueError('Unexpected API host')
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as response:
        body = response.read()
        return json.loads(body) if body else None


def digest(data):
    return hashlib.sha256(data).hexdigest()


out = Path('dist')
manifest_path = out / 'org.webosbrew.manifest.json'
manifest = json.loads(manifest_path.read_text())
expected_ipk = 'com.ardaerbaharli.kicktv_' + tag[1:] + '_all.ipk'
assert manifest['id'] == 'com.ardaerbaharli.kicktv' and manifest['version'] == tag[1:]
assert manifest['ipkUrl'] == expected_ipk
ipk = out / expected_ipk
assert digest(ipk.read_bytes()) == manifest['ipkHash']['sha256'], 'Package hash mismatch'
files = {p.name: p for p in (ipk, manifest_path)}
assert {p.name for p in out.iterdir()} == set(files), 'Unexpected release files'

try:
    release = request(base + '/releases/tags/' + tag)
except urllib.error.HTTPError as error:
    if error.code != 404:
        raise
    release = request(base + '/releases', 'POST', json.dumps({
        'tag_name': tag, 'target_commitish': sha, 'name': 'Kick TV ' + tag, 'draft': True,
        'body': 'Download the .ipk and sideload it with webOS Dev Manager. See the README for installation steps.'
    }).encode())

assert release['tag_name'] == tag
if release['draft']:
    assert release['target_commitish'] == sha, 'Draft belongs to another source revision'
assets = request(base + '/releases/' + str(release['id']) + '/assets?per_page=100')
assert len(assets) < 100, 'Unexpected asset count'
by_name = {a['name']: a for a in assets}
assert set(by_name) <= set(files), 'Unexpected existing assets; review the release manually'
if not release['draft']:
    assert set(by_name) == set(files), 'Published release is incomplete; refusing to modify it'

for name, path in files.items():
    asset = by_name.get(name)
    if release['draft']:
        # An interrupted upload may leave a starter or incomplete asset. Only drafts may be repaired.
        if asset:
            request(base + '/releases/assets/' + str(asset['id']), 'DELETE')
        url = release['upload_url'].split('{')[0] + '?name=' + urllib.parse.quote(name)
        asset = request(url, 'POST', path.read_bytes(), 'application/octet-stream')
    assert asset['state'] == 'uploaded' and asset['size'] == path.stat().st_size
    if release['draft']:
        # GitHub now provides a SHA-256 digest for uploaded release assets.
        assert asset.get('digest') == 'sha256:' + digest(path.read_bytes()), 'Uploaded asset digest mismatch'
    else:
        # A published retry succeeds only when both immutable files match this build.
        assert asset.get('digest') == 'sha256:' + digest(path.read_bytes()), 'Published asset differs; use a new tag'

if release['draft']:
    request(base + '/releases/' + str(release['id']), 'PATCH', b'{"draft":false}')
print('Verified published release:', release['html_url'])
