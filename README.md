# The Ton's Claw

The Ton's Claw is a Regency-style guest selection game that runs on a Windows PC. It uses a local SQLite database and serves the dashboard and guest invitation pages from the PC; no VPS, hosted database, Nginx, or PM2 is required.

## Requirements

- Windows 10 or 11
- Node.js 20 LTS
- A modern browser

## Windows setup (PowerShell)

1. Install Node.js 20 LTS from the official Node.js download page, then open a new PowerShell window.
2. Change to the project folder:

   ```powershell
   cd "C:\path\to\Claw Machine"
   ```

3. Install dependencies:

   ```powershell
   npm install
   ```

4. Create the local environment file (if it does not already exist):

   ```powershell
   Copy-Item .env.example .env
   ```

5. Create or update the SQLite database:

   ```powershell
   npx prisma migrate dev
   ```

6. Start the dashboard and API:

   ```powershell
   npm run dev
   ```

   Keep this terminal window open throughout the event. The server prints the detected Wi-Fi URL, for example:

   ```text
   Phones on the same Wi-Fi can open: http://192.168.1.23:3000
   ```

7. Open the dashboard at <http://localhost:3000>. Use the same address on a projector or second screen for the claw display.
8. If Windows Firewall prompts you, allow Node.js on **Private networks** only. To add the rule manually in an elevated PowerShell window:

   ```powershell
   $node = (Get-Command node).Source
   New-NetFirewallRule -DisplayName "The Ton's Claw" -Direction Inbound -Program $node -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
   ```

## Wi-Fi invitations

- The PC and guests' phones must be connected to the same Wi-Fi network.
- Some routers isolate devices on a guest network or enable "client isolation"; disable that setting or use a shared private network.
- The dashboard's **Public address** setting starts with the PC's detected Wi-Fi address. QR codes use that address, not `localhost`.
- If no LAN address can be detected, the app falls back to localhost and displays a warning. QR printing and downloading stay disabled until a reachable address is set.

## Public tunnel (optional)

To let guests join from outside the local Wi-Fi:

1. Install `cloudflared` on the PC using Cloudflare's official installation instructions.
2. In a separate PowerShell window, start a temporary tunnel:

   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```

3. Copy the `https://....trycloudflare.com` URL printed by `cloudflared`.
4. Paste it into the dashboard's **Public address** field and choose **Save address**. All invitation QR codes are regenerated with the new host name; each guest's activation token stays the same.
5. Choose **Use my Wi-Fi address** to return to same-network invitations.

Keep both terminal windows open while using the tunnel. A temporary tunnel URL can change when restarted, so update the dashboard address if it does.

## Database and backups

Prisma stores the SQLite database at `prisma\dev.db` with the provided `DATABASE_URL="file:./dev.db"` setting. To make a backup, stop the app with Ctrl+C and copy the file:

```powershell
Copy-Item .\prisma\dev.db ".\prisma\dev-backup-$(Get-Date -Format yyyyMMdd-HHmmss).db"
```

Restore by stopping the app and copying the chosen backup to `prisma\dev.db`.

## Updating

From the project directory:

```powershell
git pull
npm install
npx prisma migrate dev
npm run build
```

Restart `npm run dev` after updating. Do not delete `prisma\dev.db` when updating; it contains the guest list and event history.

## Hosting an event

1. Start the app and open <http://localhost:3000>.
2. Add guests in the ledger. Give each guest their invitation QR code or link.
3. Guests scan their invitations to become **Arrived**; only arrived guests enter the draw.
4. Keep the claw screen open on the projector and select the Diamond when the ball is ready.

