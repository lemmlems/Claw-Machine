# The Ton's Claw — IT Setup & Operations Manual

The Ton's Claw is a Regency-themed raffle and claw-machine web application built to run locally on Windows or Linux using Node.js and SQLite (no external database server, Nginx, PM2, or VPS required).

## Ubuntu / Linux Quick Start

These instructions are for Ubuntu and other Linux distributions with Bash. In WSL, use the Ubuntu terminal and Linux-installed Node.js/npm for every command; do not install dependencies with Windows npm and then run the app with Linux Node.js.

### 1. Install Node.js 20

Install Node.js 20 LTS and npm. On Ubuntu, one option is `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node --version
npm --version
```

`node --version` should report `v20.x`. If the project is on your Windows drive in WSL, you can enter it with:

```bash
cd "/mnt/c/Users/<Windows-username>/Desktop/Claw Machine"
```

For best performance in WSL, keep the project under your Linux home directory (for example, `~/projects/Claw-Machine`) rather than `/mnt/c`.

### 2. Install dependencies and configure the backend

From the project root:

```bash
npm install --include=optional
cp backend/.env.example backend/.env
openssl rand -hex 32
nano backend/.env
```

Set `HOST_PIN` to a private host PIN and replace `SESSION_SECRET` with the random value printed by `openssl`. The secret must be at least 32 characters. Keep `DATABASE_URL="file:./dev.db"` and `PORT=3001`; `PUBLIC_BASE_URL` can be left blank for local Wi-Fi address detection.

### 3. Generate Prisma Client, initialize the database, and run

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The migration command applies any database migrations that have not yet been applied (and creates the local SQLite database on a fresh setup). After both servers start, open **http://localhost:8080**. The backend API runs at **http://localhost:3001**. Stop the app with **Ctrl+C**.

For production mode:

```bash
npm run build
npm start
```

Then open **http://localhost:3001**.

### Phones and other devices

On native Linux, allow inbound TCP port `8080` through the host firewall for development, or port `3001` for production, and use the Linux machine's Wi-Fi IP address. For example, with UFW:

```bash
sudo ufw allow 8080/tcp
```

For guests outside the local network, use Cloudflare Tunnel as described in [Public Internet Access via Cloudflare Tunnel](#mode-2-public-internet-access-via-cloudflare-tunnel-recommended-for-events), targeting port `8080` in development or `3001` in production.

In WSL, opening `localhost` on the same PC should work, but phones may not be able to reach the WSL app directly. Use a tunnel or configure WSL/Windows networking and firewall rules for phone access.

### Linux / WSL troubleshooting

- **`Cannot find module @rollup/rollup-linux-x64-gnu`**: dependencies were installed for another operating system or the Linux optional package is missing. Stop the app, remove only `node_modules`, then reinstall from the Linux terminal:
  ```bash
  rm -rf node_modules
  npm install --include=optional
  ```
  Do not delete `package-lock.json`.
- **`@prisma/client did not initialize yet`**: stop the app and generate the Linux Prisma Client, then restart:
  ```bash
  npm run prisma:generate
  npm run dev
  ```
  Run `npm run prisma:migrate` only for a fresh database or when applying new migrations; migrating is not required just to generate Prisma Client.

---

## 1. System Architecture & Ports

| Component | Folder | Dev Port | Production Port | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | `backend/` | `3001` | `3001` | Express API, PIN auth, QR code generation, SSE live updates, SQLite (Prisma) |
| **Frontend App** | `frontend/` | `8080` | Served by backend on `3001` | React Host Dashboard (**Guest Ledger**), mobile **Lady Whistledown** check-in page, and **The Promenade Claw** (`/claw`) |
| **Database** | `backend/prisma/dev.db` | — | — | Local SQLite database storing events, guests, roles, and draw history |

---

## 2. Prerequisites (First-Time PC Setup)

1. **Node.js 20 LTS** (includes `npm`)
2. **Git for Windows** (if pulling updates from GitHub)
3. *(Optional for Public Tunnel Mode)* **Cloudflare Tunnel (`cloudflared`)** — needed when phones scanning QR codes are on mobile data or a separate Wi-Fi network from the host PC:
   ```powershell
   winget install --id Cloudflare.cloudflared -e
   ```

> **Windows PowerShell Note:** If PowerShell blocks `npm` with an execution policy error (`running scripts is disabled on this system`), use `npm.cmd` instead of `npm` (for example, `npm.cmd install`, `npm.cmd run dev`, `npm.cmd run build`).

---

## 3. Initial Installation & Configuration

Open **PowerShell** in the project root folder (`"...\Claw Machine"`) and run:

### Step 1: Install dependencies
```powershell
npm.cmd install
```

### Step 2: Configure backend environment variables
Copy the template file and edit it:
```powershell
Copy-Item .\backend\.env.example .\backend\.env
notepad .\backend\.env
```

Required settings in `backend\.env`:
```env
DATABASE_URL="file:./dev.db"
PORT=3001
PUBLIC_BASE_URL=
HOST_PIN=your-host-pin-here
SESSION_SECRET=replace-with-a-random-string-of-at-least-32-characters
```
- **`HOST_PIN`**: PIN required for hosts to sign into the Guest Ledger and control The Promenade Claw.
- **`SESSION_SECRET`**: Must be **at least 32 characters** long (the backend will refuse to start if shorter).
- **`PUBLIC_BASE_URL`**: Leave blank for automatic local Wi-Fi IP detection, or set to a fixed origin if desired (no trailing slash or path).

### Step 3: Initialize Prisma & SQLite database
```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```
This creates `backend\prisma\dev.db` and applies all schema migrations.

---

## 4. Booting Up the System

### Option A: Development / Event Mode (Recommended with Cloudflare Tunnel)
Starts both the backend API (`:3001`) and the Vite frontend server (`:8080`):
```powershell
npm.cmd run dev
```
Wait until you see output similar to:
```text
The Ton's Claw API is running on http://localhost:3001
Phones on the same Wi-Fi can open: http://192.168.x.x:8080
```

### Option B: Production Mode (Single Process)
Builds both workspaces and serves the frontend directly from the backend on port `3001`:
```powershell
npm.cmd run build
npm.cmd start
```
In production mode, open `http://localhost:3001` (and point any tunnel or firewall rule to port **`3001`** instead of `8080`).

---

## 5. Network & QR Code Access Setup

Guests scan QR codes from the **Guest Ledger** to mark themselves as arrived on their phones. Choose one of the two network modes below:

### Mode 1: Same Local Wi-Fi (No Internet Required)
1. Ensure the host PC and all guest phones are on the **exact same Wi-Fi network** (router "Client Isolation" / AP isolation must be **disabled**).
2. Allow Node.js through **Windows Defender Firewall** on Private networks (run in an elevated Administrator PowerShell if prompted or blocked):
   ```powershell
   $node = (Get-Command node).Source
   New-NetFirewallRule -DisplayName "The Ton's Claw" -Direction Inbound -Program $node -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
   ```
   *(If running in Production Mode via `npm.cmd start`, also allow port `3001`.)*
3. In the **Guest Ledger**, verify **Public address** shows your PC's Wi-Fi IP (`http://192.168.x.x:8080`). If not, click **Use my Wi-Fi address**.

### Mode 2: Public Internet Access via Cloudflare Tunnel (Recommended for Events)
Use this when guests are on cellular data (`4G/5G`) or guest Wi-Fi:
1. Keep the app running in Terminal 1 (`npm.cmd run dev` on port `8080`, or `npm.cmd start` on port `3001`).
2. Open a **second PowerShell window** and start the tunnel targeting the active web port:
   - If running `npm.cmd run dev`:
     ```powershell
     cloudflared tunnel --url http://localhost:8080
     ```
   - If running `npm.cmd start` (production):
     ```powershell
     cloudflared tunnel --url http://localhost:3001
     ```
3. Copy the printed HTTPS tunnel URL (for example, `https://example-words.trycloudflare.com`).
4. On the host dashboard (`http://localhost:8080`), paste that URL into **Public address → Invitation address** and click **Save address**.
5. Existing QR codes regenerate automatically to point to the public URL without invalidating guest tokens.

> **Important:** Do not close either PowerShell window and disable PC sleep/hibernation during the event. If `cloudflared` restarts and prints a new `trycloudflare.com` URL, paste the new URL into **Save address** and reprint/reshow any pending QR codes.

---

## 6. Event Day Host & Operator Guide

### A. Guest Ledger (`http://localhost:8080`)
1. Sign in using `HOST_PIN` from `backend\.env`. Toggle **☾ Dark / ☀ Light** in the header as preferred.
2. **Add Guests**:
   - Enter the guest's name under **New guest**.
   - Select their role using the checklist: **Employee** (eligible for both Minor & Major prizes) or **Intern / Guest** (eligible for Minor prizes only).
   - Click **Add to the Ball**.
3. **Guest Check-In (Phone UI)**:
   - Newly added guests appear under **Awaiting Invitation** with their personal QR code.
   - When a guest scans the QR code on their phone, they receive a personalized **Lady Whistledown** confirmation message ("Dearest Gentle Reader") and automatically move to the **Arrived** column via real-time SSE.
   - Guests remain visible in **Arrived** (tagged `Ready` or `Chosen`) even after winning a draw.

### B. The Promenade Claw (`http://localhost:8080/claw`)
Open on the main projector or display screen:
1. **Live Arrivals**: Automatically connects to arrived guests when signed in as host.
2. **Minor Prizes / Major Prizes**:
   - **Minor Prizes**: Includes all arrived **Employees** and **Interns / Guests**, restoring any previously drawn names back into the pool.
   - **Major Prizes**: Restores arrived employees, then disintegrates and removes all **Intern / Guest** balls from the pool so only **Employees** remain eligible.
3. **Shuffle**: Tumbles and scatters the baubles across the vitrine.
4. **Select the Diamond**: Triggers the automated claw pickup animation, drops the bauble into the Royal Chute, and plays the full-screen capsule reveal cutscene.

---

## 7. Database Backup, Reset & Maintenance

### Backup the SQLite database
Stop the servers (`Ctrl+C`), then run:
```powershell
Copy-Item .\backend\prisma\dev.db ".\backend\prisma\dev-backup-$(Get-Date -Format yyyyMMdd-HHmmss).db"
```

### Reset all event data for a brand-new event
Stop the servers (`Ctrl+C`), delete or back up `backend\prisma\dev.db`, and re-run migrations:
```powershell
Remove-Item .\backend\prisma\dev.db -ErrorAction SilentlyContinue
npm.cmd run prisma:migrate
```

### Pulling Updates from Git
```powershell
git pull
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run build
```

---

## 8. Troubleshooting Quick Reference

| Issue | Likely Cause | Fix |
| :--- | :--- | :--- |
| `npm` blocked by PowerShell execution policy | Restricted `.ps1` script policy | Run `npm.cmd` instead of `npm` (e.g. `npm.cmd run dev`) |
| `SESSION_SECRET must contain at least 32 characters` | Missing or short `SESSION_SECRET` | Check `backend\.env` and ensure `SESSION_SECRET` has 32+ characters |
| Red local-address warning / Print disabled | App detected `127.0.0.1` or `localhost` | Connect to Wi-Fi and click **Use my Wi-Fi address**, or paste a `cloudflared` URL |
| Phones can't open the Wi-Fi QR link | Windows Firewall or AP client isolation | Allow `node.exe` / port `8080` in Windows Firewall, or use Cloudflare Tunnel mode |
| Phone shows `ERR_NAME_NOT_RESOLVED` for a `trycloudflare.com` link | The quick tunnel is no longer running, or its temporary URL changed | Restart `cloudflared tunnel --url http://localhost:8080` (or `3001` in production), then save the newly printed URL under **Public address**. Keep the tunnel terminal open. For same-Wi-Fi access, click **Use my Wi-Fi address** instead. |
| Cloudflare tunnel shows Apache 404 or connection error | Tunnel aimed at wrong port or port 80 | Stop tunnel (`Ctrl+C`) and run `cloudflared tunnel --url http://localhost:8080` (for `dev`) or `3001` (for `start`) |
| `401` or "session expired" on `/claw` | Host not signed in on browser | Sign in at `http://localhost:8080` first, then open `/claw` |
