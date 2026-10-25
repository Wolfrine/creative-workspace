"""Validate and inspect the exact portable private plugin archive; no credentials."""
from pathlib import Path
import hashlib
import json
import re
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local/python-deps'))
import jsonschema
import yaml

source = ROOT / 'plugin/noveliaa'
output = ROOT / '.local/plugin-package'
output.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in source.rglob('*') if p.is_file())
assert all(not p.is_symlink() for p in source.rglob('*'))
assert all(p.suffix in ('.json', '.md', '.yaml', '.svg') for p in files)
for filename in ('plugin.json', 'mcp.json'):
    value = json.loads((source / filename).read_text(encoding='utf-8'))
    schema_url = value['$schema']
    assert schema_url == 'https://agent-plugins.org/schemas/1.0.0/' + ('plugin' if filename == 'plugin.json' else 'mcp') + '.schema.json'
    with urllib.request.urlopen(schema_url, timeout=30) as response:
        schema = json.load(response)
    if filename == 'mcp.json':
        # The published portable schema currently excludes extension namespaces,
        # while current OpenAI plugin packaging explicitly requires OAuth there.
        # Validate portable transport fields unchanged, then OpenAI semantics below.
        portable = {**value, 'mcpServers': {k: {f: v for f, v in server.items() if f != 'extensions'} for k, server in value['mcpServers'].items()}}
        jsonschema.Draft202012Validator(schema).validate(portable)
    else:
        jsonschema.Draft202012Validator(schema).validate(value)
manifest = json.loads((source / 'plugin.json').read_text(encoding='utf-8'))
assert manifest['name'] == source.name
assert re.fullmatch(r'\d+\.\d+\.\d+', manifest['version'])
interface = manifest['extensions']['com.openai']['interface']
assert 0 < len(interface['shortDescription']) <= 30
assert interface['category'] == 'Productivity'
assert (source / interface['logo']).is_file()
mcp = json.loads((source / 'mcp.json').read_text(encoding='utf-8'))
assert set(mcp['mcpServers']) == {'noveliaa'}
server = mcp['mcpServers']['noveliaa']
assert server['url'] == 'https://noveliaa.web.app/mcp'
assert server['extensions']['com.openai']['auth']['client'] == {'mode': 'dcr'}
auth = server['extensions']['com.openai']['auth']
assert auth['type'] == 'oauth' and auth['baseScopes'] == ['noveliaa:read']
assert auth['defaultScopes'] == ['noveliaa:read', 'noveliaa:propose']
skills = []
for path in source.glob('skills/*/SKILL.md'):
    raw = path.read_text(encoding='utf-8')
    assert raw.startswith('---\n')
    data = yaml.safe_load(raw.split('---', 2)[1])
    assert data['name'] == path.parent.name and data['description'].strip()
    assert data['name'] not in skills
    skills.append(data['name'])
assert len(skills) == 3
for path in files:
    raw = path.read_text(encoding='utf-8')
    assert 'PRIVATE KEY' not in raw and 'private_key' not in raw and 'access_token' not in raw
archive = output / ('noveliaa-' + manifest['version'] + '.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for path in files:
        package.write(path, 'noveliaa/' + path.relative_to(source).as_posix())
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert len(package.namelist()) == len(files)
    assert package.read('noveliaa/plugin.json') == (source / 'plugin.json').read_bytes()
    for path in files:
        assert package.read('noveliaa/' + path.relative_to(source).as_posix()) == path.read_bytes()
report = {'archive': str(archive), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
          'skills': sorted(skills), 'server': server['url'],
          'files': [{'path': p.relative_to(source).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
          'validation': 'Agent Plugins 1.0 manifest and portable MCP transport JSON schemas; OpenAI OAuth extension semantic checks; YAML skill triggers; packaged byte equality and ZIP integrity passed',
          'schemaLimit': 'Published canonical MCP schema omits extensions; OpenAI OAuth extensions are validated separately against current plugin packaging requirements.'}
(output / 'validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
