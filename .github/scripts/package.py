"""Prepare and inspect the exact IPK, without extracting archive members to disk."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile

APP_ID = 'com.ardaerbaharli.kicktv'
SERVICE_ID = APP_ID + '.service'


def read_json(archive, suffix):
    members = [m for m in archive.getmembers() if m.name.lstrip('./') == suffix]
    if len(members) != 1 or not members[0].isfile():
        raise ValueError('Missing or duplicate archive metadata: ' + suffix)
    return json.load(archive.extractfile(members[0]))


def verify_ipk(ipk, version):
    data = subprocess.check_output(['ar', 'p', str(ipk), 'data.tar.gz'])
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        app_root = 'usr/palm/applications/' + APP_ID + '/'
        service_root = 'usr/palm/services/' + SERVICE_ID + '/'
        app = read_json(archive, app_root + 'appinfo.json')
        service = read_json(archive, service_root + 'services.json')
        package = read_json(archive, service_root + 'package.json')
        assert app['id'] == APP_ID and app['version'] == version, 'Wrong app identity/version'
        assert service['id'] == SERVICE_ID, 'Wrong service identity'
        assert [s['name'] for s in service['services']] == [SERVICE_ID], 'Wrong service registration'
        assert package['name'] == SERVICE_ID and package['version'] == version, 'Wrong service package'
        names = {m.name.lstrip('./') for m in archive.getmembers() if m.isfile()}
        for expected in (app_root + 'index.html', service_root + 'service.js'):
            assert expected in names, 'Missing entry point: ' + expected
        assert not any('com.barisahmet.kicktv' in n for n in names), 'Legacy install path'
    control_data = subprocess.check_output(['ar', 'p', str(ipk), 'control.tar.gz'])
    with tarfile.open(fileobj=io.BytesIO(control_data), mode='r:gz') as archive:
        member = next(m for m in archive.getmembers() if m.name.lstrip('./') == 'control')
        control = archive.extractfile(member).read().decode()
        fields = dict(line.split(': ', 1) for line in control.splitlines() if ': ' in line)
        assert fields['Package'] == APP_ID and fields['Version'] == version, 'Wrong IPK control metadata'


def main():
    app_path = Path('app/appinfo.json')
    app = json.loads(app_path.read_text())
    tag = os.environ.get('RELEASE_TAG', '')
    version = app['version']
    if tag:
        if not re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', tag):
            raise ValueError('Release tag must be vX.Y.Z without leading zeros')
        version = tag[1:]
    app['version'] = version
    app_path.write_text(json.dumps(app, indent=2) + '\n')
    service_path = Path('services') / SERVICE_ID / 'package.json'
    service = json.loads(service_path.read_text())
    service['version'] = version
    service_path.write_text(json.dumps(service, indent=2) + '\n')
    out = Path('dist')
    out.mkdir(exist_ok=True)
    subprocess.run(['node_modules/.bin/ares-package', './app', './services/' + SERVICE_ID, '-o', str(out)], check=True)
    ipk = out / (APP_ID + '_' + version + '_all.ipk')
    assert list(out.glob('*.ipk')) == [ipk], 'Unexpected IPK files'
    verify_ipk(ipk, version)
    repo = os.environ['GITHUB_REPOSITORY']
    sha = os.environ['GITHUB_SHA']
    manifest = dict(id=APP_ID, version=version, type='web', title='Kick TV',
                    appDescription='Watch Kick livestreams on your LG webOS TV. Unofficial.',
                    iconUri=f'https://raw.githubusercontent.com/{repo}/{sha}/app/largeIcon.png',
                    sourceUrl=f'https://github.com/{repo}', rootRequired=False,
                    ipkUrl=ipk.name, ipkHash={'sha256': hashlib.sha256(ipk.read_bytes()).hexdigest()})
    (out / 'org.webosbrew.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('Verified package and manifest:', ipk)


if __name__ == '__main__':
    main()
