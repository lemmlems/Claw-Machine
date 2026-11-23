# Deploying to EC2

This guide uses Ubuntu, Node.js 20, SQLite, and nginx on one EC2 instance. The app listens on `0.0.0.0:3001`; nginx handles public HTTP/HTTPS and forwards requests to it. Do not expose port `3001` to the internet.

## 1. Prepare the instance and DNS

1. Launch an Ubuntu EC2 instance and assign an Elastic IP, or use an Application Load Balancer.
2. Create a DNS `A` record for your domain pointing to the Elastic IP (or an ALB alias/CNAME as appropriate).
3. Configure the security group:
   - Allow SSH (`22`) only from your administrator IP.
   - Allow HTTP (`80`) and HTTPS (`443`) from the intended public audience.
   - Do not allow public inbound access to the app port (`3001`). If using an ALB, allow that port only from the ALB security group.
4. Install Node.js 20, npm, nginx, and Git on the instance.

## 2. Build the application

Copy or clone the project to `/opt/tons-claw` and run:

```bash
cd /opt/tons-claw
npm ci
npm run prisma:generate
npm run build
```

Create a persistent, service-owned SQLite data directory:

```bash
sudo useradd --system --home /opt/tons-claw --shell /usr/sbin/nologin tons-claw
sudo install -d -o tons-claw -g tons-claw -m 0750 /var/lib/tons-claw
```

If retaining data from an existing server, stop the old app, back up its SQLite database, and copy it to `/var/lib/tons-claw/production.db` before running migrations. Set ownership to `tons-claw`; do not overwrite the only backup.

## 3. Set production environment variables

Create `/etc/tons-claw/tons-claw.env` based on [`backend/.env.production.example`](./backend/.env.production.example). Set:

- `PUBLIC_BASE_URL` to the public HTTPS origin, with no trailing slash or path.
- `HOST_PIN` to a new private host PIN.
- `SESSION_SECRET` to a unique random value of at least 32 characters (for example, `openssl rand -hex 32`).
- `DATABASE_URL` to `file:/var/lib/tons-claw/production.db`.

Do not commit the production environment file or reuse secrets from a development setup. Restrict its permissions:

```bash
sudo chown root:tons-claw /etc/tons-claw/tons-claw.env
sudo chmod 0640 /etc/tons-claw/tons-claw.env
```

Apply database migrations:

```bash
cd /opt/tons-claw
sudo -u tons-claw env DATABASE_URL="file:/var/lib/tons-claw/production.db" npm run prisma:deploy
```

## 4. Run as a systemd service

Create `/etc/systemd/system/tons-claw.service`:

```ini
[Unit]
Description=The Ton's Claw
After=network.target

[Service]
Type=simple
User=tons-claw
Group=tons-claw
WorkingDirectory=/opt/tons-claw
EnvironmentFile=/etc/tons-claw/tons-claw.env
ExecStart=/usr/bin/node /opt/tons-claw/backend/dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ensure the service user can read the application files and the Node.js executable is at `/usr/bin/node` (adjust `ExecStart` if it is elsewhere). Then start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tons-claw
sudo systemctl status tons-claw
```

The load balancer health-check path is `/api/health`.

## 5. Configure nginx and HTTPS

Configure nginx to proxy the domain to `http://127.0.0.1:3001`. Forward `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`; disable proxy buffering for the `/api/events/stream` Server-Sent Events endpoint. For example:

```nginx
server {
    listen 80;
    server_name your-domain.example;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

Enable the nginx site and validate/reload nginx. Obtain and configure a TLS certificate with Let's Encrypt/Certbot. If using an ALB instead of nginx for public traffic, terminate TLS at the ALB, forward to the app port, and restrict EC2 inbound access to the ALB security group.

## 6. Verify

Check `https://your-domain.example/api/health`, then sign in and verify the **Public address** setting uses the public HTTPS origin. If you copied an existing database, update its saved public address from any previous host so invitation QR codes point to the new domain.

## Manual actions

- Create the DNS record and choose an Elastic IP or ALB.
- Set EC2 and (if used) ALB security-group rules as above.
- Install/configure TLS with Let's Encrypt/Certbot, or use ACM on an ALB.
- Set production `HOST_PIN`, `SESSION_SECRET`, `PUBLIC_BASE_URL`, and `DATABASE_URL` on the instance.
- Transfer the existing SQLite database if event data must be retained.
