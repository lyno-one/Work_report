"""Run on the existing Lyno VPS; credentials stay on the server."""
from pathlib import Path
import secrets
import os

destination = Path.home() / 'apps/report/deploy/api.env'
if not destination.exists():
    source = Path.home() / 'apps/crm/apps/web/.env.production'
    values = {}
    for line in source.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('\"').strip("'")
    url = values['NEXT_PUBLIC_SUPABASE_URL']
    anon = values['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    if not url or not anon:
        raise RuntimeError('CRM Supabase configuration is missing')
    os.umask(0o077)
    destination.write_text(
        'JWT_SECRET=' + secrets.token_hex(48) + '\n'
        'CRM_API_URL=https://api.lyno.com.vn/api\n'
        'CRM_SUPABASE_URL=' + url + '\n'
        'CRM_SUPABASE_ANON_KEY=' + anon + '\n'
    )
    destination.chmod(0o600)
print('Production environment is ready; credentials were not printed.')
