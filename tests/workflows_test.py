"""Exercise release retries against a fake GitHub API; no network or credentials."""
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

PUBLISHER = Path(__file__).resolve().parents[1] / '.github/scripts/publish-release.py'
TAG = 'v1.2.3'
IPK = 'com.ardaerbaharli.kicktv_1.2.3_all.ipk'


class Publishing(unittest.TestCase):
    def exercise(self, draft=None, assets=None, forbidden=False, corrupt=False):
        calls = []
        with tempfile.TemporaryDirectory() as scratch:
            out = Path(scratch) / 'dist'
            out.mkdir()
            (out / IPK).write_bytes(b'fixture package')
            manifest = {'id': 'com.ardaerbaharli.kicktv', 'version': '1.2.3', 'ipkUrl': IPK,
                        'ipkHash': {'sha256': hashlib.sha256(b'fixture package').hexdigest()}}
            (out / 'org.webosbrew.manifest.json').write_text(json.dumps(manifest))
            expected = {p.name: p.read_bytes() for p in out.iterdir()}
            release = {'id': 7, 'tag_name': TAG, 'target_commitish': 'fixture-sha',
                       'draft': draft, 'upload_url': 'https://uploads.github.com/repos/fixture/app/releases/7/assets{?name}',
                       'html_url': 'https://github.com/fixture/app/releases/tag/' + TAG}

            def asset(name, data):
                return {'id': name, 'name': name, 'state': 'uploaded', 'size': len(data),
                        'digest': 'sha256:' + hashlib.sha256(data).hexdigest()}

            existing = assets if assets is not None else [asset(n, b) for n, b in expected.items()]
            if corrupt:
                existing[0]['digest'] = 'sha256:wrong'

            def fake(req, timeout):
                calls.append((req.method, req.full_url))
                if '/releases/tags/' in req.full_url:
                    if draft is None or forbidden:
                        raise HTTPError(req.full_url, 403 if forbidden else 404, 'fixture', {}, None)
                    result = release
                elif req.method == 'POST' and req.full_url.endswith('/releases'):
                    result = dict(release, draft=True)
                elif req.method == 'GET' and '/assets?' in req.full_url:
                    result = [] if draft is None else existing
                elif req.method == 'DELETE':
                    return io.BytesIO(b'')
                elif req.method == 'POST' and 'uploads.github.com' in req.full_url:
                    from urllib.parse import parse_qs, urlparse
                    name = parse_qs(urlparse(req.full_url).query)['name'][0]
                    result = asset(name, req.data)
                elif req.method == 'PATCH':
                    result = dict(release, draft=False)
                else:
                    raise AssertionError((req.method, req.full_url))
                return io.BytesIO(json.dumps(result).encode())

            previous = os.getcwd()
            try:
                os.chdir(scratch)
                with patch.dict(os.environ, {'GITHUB_REPOSITORY': 'fixture/app', 'RELEASE_TAG': TAG,
                                            'GITHUB_SHA': 'fixture-sha', 'GH_TOKEN': 'dummy'}, clear=True), \
                        patch('urllib.request.urlopen', side_effect=fake):
                    runpy.run_path(str(PUBLISHER), run_name='__main__')
            finally:
                os.chdir(previous)
        return calls

    def test_new_release_publishes_only_after_uploads(self):
        calls = self.exercise()
        self.assertEqual(calls[-1][0], 'PATCH')
        self.assertEqual(sum('uploads.github.com' in url for _, url in calls), 2)

    def test_draft_retry_replaces_interrupted_assets(self):
        calls = self.exercise(draft=True, assets=[{'id': 1, 'name': IPK, 'state': 'starter'}])
        self.assertTrue(any(method == 'DELETE' for method, _ in calls))
        self.assertEqual(calls[-1][0], 'PATCH')

    def test_published_retry_is_read_only(self):
        self.assertTrue(all(method == 'GET' for method, _ in self.exercise(draft=False)))

    def test_different_published_bytes_are_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'differs'):
            self.exercise(draft=False, corrupt=True)

    def test_incomplete_published_release_is_not_repaired(self):
        with self.assertRaisesRegex(AssertionError, 'incomplete'):
            self.exercise(draft=False, assets=[])

    def test_permission_error_is_not_treated_as_missing_release(self):
        with self.assertRaises(HTTPError) as raised:
            self.exercise(forbidden=True)
        self.assertEqual(raised.exception.code, 403)
