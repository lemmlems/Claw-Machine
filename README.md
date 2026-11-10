# The Ton's Claw

The Ton's Claw is a Regency-style guest selection game for a Windows PC. It uses a local SQLite database and runs without a hosted database, Nginx, PM2, or a VPS.

## Project layout

- `backend/` — Express API, authentication, QR generation, SSE updates, winner selection, and Prisma schema/migrations.
- `frontend/` — Vite/React Guest Ledger and Prizes & Roles pages, guest Activation page, and the standalone Promenade Claw.
- Root `package.json` — commands for running and building both workspaces.

## Windows setup (PowerShell)

1. Install Node.js 20 LTS and open PowerShell.
2. Change to the project folder and install dependencies:

   ```powershell
   cd "C:\path\to\Claw Machine"
   npm install
   ```

3. Create the backend environment file and set a private host PIN and a random session secret of at least 32 characters:

   ```powershell
   Copy-Item .\backend\.env.example .\backend\.env
   notepad .\backend\.env
   ```

   The example configures SQLite with `DATABASE_URL="file:./dev.db"`. Prisma stores this database beside `backend\prisma\schema.prisma`, at `backend\prisma\dev.db`.
4. Create or update the SQLite database:

   ```powershell
   npm run prisma:migrate
   ```

5. Start the frontend and backend:

   ```powershell
   npm run dev
   ```

   The frontend listens on `0.0.0.0:8080`; the backend API listens on `0.0.0.0:3001`. The terminal prints the detected Wi-Fi URL, for example:

   ```text
   Phones on the same Wi-Fi can open: http://192.168.1.23:8080
   ```

6. If Windows Firewall prompts you, allow Node.js on **Private networks**. To add a rule manually in an elevated PowerShell window:

   ```powershell
   $node = (Get-Command node).Source
   New-NetFirewallRule -DisplayName "The Ton's Claw" -Direction Inbound -Program $node -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
   ```

7. Open the dashboard at <http://localhost:8080> on the PC and sign in with the host PIN from `backend\.env`. Manage guest roles in the Guest Ledger and add prize inventory on the Prizes & Roles page.
8. Open <http://localhost:8080/claw> on the projector or second screen. Choose **Use arrived guests** to draw from guests who have scanned their QR codes, or use the sample-name mode.
9. For Wi-Fi mode, connect the PC and phones to the same network. Make sure the router does not have "client isolation" enabled and do not use an isolated guest network.
10. For public tunnel mode, install `cloudflared` and run this in another PowerShell window:

   ```powershell
   cloudflared tunnel --url http://localhost:8080
   ```

   Copy the `https://....trycloudflare.com` URL it prints into the dashboard's **Public address** setting and choose **Save address**. QR codes update without changing guest tokens. Choose **Use my Wi-Fi address** to switch back.
11. Keep the PC awake and both terminal windows open during the event. To back up the database, stop the app and copy `backend\prisma\dev.db`:

   ```powershell
   Copy-Item .\backend\prisma\dev.db ".\backend\prisma\dev-backup-$(Get-Date -Format yyyyMMdd-HHmmss).db"
   ```

## Invitations and host access

The dashboard's **Public address** setting starts with the PC's detected Wi-Fi address. QR codes and activation links use that address, never `localhost`. The dashboard shows the active mode and each activation URL beside its QR code. Saving a new address regenerates the codes without changing guest tokens.

The host PIN protects the dashboard and API actions. Guest activation links remain accessible without signing in. If the detected address is localhost or `127.0.0.1`, the dashboard displays a red warning and disables printing and downloading QR codes.

Employees are eligible for minor and major prizes; interns are eligible for minor prizes. Prize quantities are inventory: each winning draw consumes one available item and marks the selected guest as WON. The claw's live draw requires a host session and uses the server to choose an eligible guest and prize.

For frontend-only development, run the Vite server and backend as usual with `npm run dev`, then open `http://localhost:8080/claw`. The frontend routes `/claw` to the standalone HTML and proxies `/api` to port 3001.

## Build and production start

```powershell
npm run build
npm start
```

In production mode, the backend serves the built frontend. Set `PUBLIC_BASE_URL` to the reachable origin if it differs from the PC's detected address.
The standalone machine is served at `/claw` and `/claw.html`; the prize manager is at `/prizes`.

## Updating

From the project directory:

```powershell
git pull
npm install
npm run prisma:migrate
npm run build
```

Restart the app after updating. Do not delete `backend\prisma\dev.db`; it contains the guest list and event history.
