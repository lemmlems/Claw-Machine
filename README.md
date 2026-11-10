# The Ton's Claw

The Ton's Claw is a Regency-style guest selection game for private events. The application runs on a Linux VPS with PostgreSQL; guests open their individual activation links from the public HTTPS address configured in the backend environment.

## Requirements

- Ubuntu 22.04 or 24.04 VPS with a public IPv4 address
- A domain name with an A record pointing to the VPS
- PuTTY and a modern browser on your computer
- SSH access with a user that can run `sudo`

## Connect to the VPS

In PuTTY, enter the VPS IP address and connect over SSH. Sign in with your VPS user and switch to its home directory. The following commands assume Ubuntu or Debian and a non-root user with `sudo` access.

## Install the software

Install Git, Nginx, PostgreSQL, and Certbot, then add Node.js 20 and PM2:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install --global pm2
node --version
npm --version
```

## Create the PostgreSQL database

Create a dedicated database user and database. Replace the sample password with a strong unique password:

```bash
sudo -u postgres psql
```

In the PostgreSQL prompt:

```sql
CREATE USER nameclaw WITH PASSWORD 'REPLACE_WITH_A_STRONG_PASSWORD';
CREATE DATABASE nameclaw OWNER nameclaw;
\q
```

## Install the application

Clone the repository into your home directory (use your repository URL):

```bash
cd ~
git clone YOUR_REPOSITORY_URL the-tons-claw
cd ~/the-tons-claw
npm ci
```

Copy and edit the backend environment file:

```bash
cp .env.example .env
nano .env
```

Set the public HTTPS origin and PostgreSQL connection string in `.env`. For example:

```dotenv
PORT=3000
PUBLIC_BASE_URL=https://claw.yourdomain.com
DATABASE_URL="postgresql://nameclaw:REPLACE_WITH_A_STRONG_PASSWORD@localhost:5432/nameclaw"
HOST_PIN_PEPPER=REPLACE_WITH_A_LONG_RANDOM_SECRET
```

Point the domain's DNS A record to the VPS before continuing. `PUBLIC_BASE_URL` is the only source used to build guest QR codes and activation links; keep it set to the HTTPS origin, with no trailing path.

Run the production database migration, generate the Prisma client, and build the app:

```bash
npx prisma generate
npx prisma migrate deploy
npm run build
```

Start the backend with PM2 and configure it to restart after a reboot:

```bash
pm2 start npm --name tons-claw -- start
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` to enable PM2's system service.

## Configure Nginx

Create an Nginx site for your domain:

```bash
sudo nano /etc/nginx/sites-available/tons-claw
```

Use this configuration, replacing `claw.yourdomain.com` with your domain:

```nginx
server {
    listen 80;
    server_name claw.yourdomain.com;

    location /api/events/stream {
        proxy_pass http://127.0.0.1:3000/api/events/stream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
        add_header X-Accel-Buffering no;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/tons-claw /etc/nginx/sites-enabled/tons-claw
sudo nginx -t
sudo systemctl reload nginx
```

## Enable HTTPS

Issue and install a Let's Encrypt certificate after DNS points to the VPS and HTTP works:

```bash
sudo certbot --nginx -d claw.yourdomain.com
sudo certbot renew --dry-run
```

Open `https://claw.yourdomain.com` to use the host dashboard. Add guests and provide each guest with the displayed QR code or activation URL. Scanning activates that guest for the draw.

## Updating

From the application directory:

```bash
cd ~/the-tons-claw
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart tons-claw --update-env
```

Back up the database before applying updates that change the schema.

## PostgreSQL backups

Create a backup directory and export a compressed PostgreSQL dump. Configure PostgreSQL credentials for the account running this command, or enter the password when prompted:

```bash
mkdir -p ~/backups
pg_dump -Fc -h 127.0.0.1 -U nameclaw nameclaw > "$HOME/backups/nameclaw-$(date +%Y%m%d-%H%M%S).dump"
```

Store copies off the VPS. To restore a dump, stop the app and restore into the `nameclaw` database:

```bash
pm2 stop tons-claw
pg_restore --clean --if-exists --no-owner -h 127.0.0.1 -U nameclaw -d nameclaw /path/to/backup.dump
pm2 start tons-claw
```

## Troubleshooting

- Check application output with `pm2 logs tons-claw` and state with `pm2 status`.
- Check Nginx with `sudo nginx -t` and `sudo journalctl -u nginx`.
- Check PostgreSQL with `sudo systemctl status postgresql` and verify the `DATABASE_URL` in `.env`.
- Confirm the domain resolves to the VPS and `PUBLIC_BASE_URL` exactly matches the HTTPS origin if guest links do not open.
- If the dashboard stops updating live, verify the `/api/events/stream` Nginx location has buffering disabled and a long read timeout.
- If Prisma reports pending migrations, run `npx prisma migrate deploy` from the application directory.

## Prisma Studio over an SSH tunnel

In PuTTY, open **Connection > SSH > Tunnels**. Add a local source port `5555` and destination `127.0.0.1:5555`, select **Local**, then click **Add** before connecting. In an SSH shell on the VPS, start Prisma Studio from the project directory:

```bash
cd ~/the-tons-claw
npx prisma studio --hostname 127.0.0.1 --port 5555
```

Open <http://localhost:5555> on your computer while the SSH tunnel and Studio process are running. Stop Studio when finished.

