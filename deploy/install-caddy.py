"""Add report routing to the existing shared Caddy source on the VPS."""
from pathlib import Path
import shutil
import subprocess
from datetime import datetime

source = Path.home() / 'apps/crm/deploy/Caddyfile'
block = (Path(__file__).parent / 'Caddyfile').read_text()
current = source.read_text()
stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
candidate = Path('/tmp/lyno-report-Caddyfile')
if 'report.lyno.com.vn {' in current:
    raise RuntimeError('Report routing already exists; inspect before changing it')
candidate.write_text(current.rstrip() + '\n\n' + block)
subprocess.run(['sudo', 'caddy', 'validate', '--config', str(candidate), '--adapter', 'caddyfile'], check=True)
backup = Path.home() / 'apps/report/deploy/backups'
backup.mkdir(exist_ok=True)
shutil.copy2(source, backup / ('Caddyfile-source-' + stamp))
subprocess.run(['sudo', 'cp', '/etc/caddy/Caddyfile', str(backup / ('Caddyfile-live-' + stamp))], check=True)
shutil.copy2(candidate, source)
subprocess.run(['sudo', 'cp', str(candidate), '/etc/caddy/Caddyfile'], check=True)
subprocess.run(['sudo', 'systemctl', 'reload', 'caddy'], check=True)
print('Caddy routing installed; previous configurations backed up.')
