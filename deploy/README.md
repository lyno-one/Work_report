# report.lyno.com.vn

Uses the existing OCI VPS (150.230.154.52), Docker Compose and system Caddy,
following the Thiên Khuê S deployment. Source directory: `/home/opc/apps/report`.

DNS: A record `report` pointing to `150.230.154.52`, DNS only until HTTPS is ready.

On the VPS, provision the environment once with `python3 deploy/provision-env.py`.
It reads only the public Supabase URL and anon key from the production CRM web
configuration and generates a separate JWT secret. Credentials are never committed.

Deploy updates from the repository root:

```sh
cd deploy
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3510/api/auth/config
curl -I http://127.0.0.1:3500
```

Install Caddy routing once with `python3 deploy/install-caddy.py`. It validates
the combined configuration, backs up the current files and updates both the
live Caddyfile and the CRM deployment source used by subsequent CRM deploys.
The shared CRM Caddyfile already has uncommitted site configuration on the VPS;
sync those additions into the CRM repository before its next git pull.

SQLite lives in the `lyno-report_report_data` Docker volume. Keep this volume
when updating containers. Production login uses CRM accounts.
