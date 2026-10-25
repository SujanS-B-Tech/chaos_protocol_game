# CHAOS PROTOCOL — Multiplayer Browser Game

A cooperative puzzle game for an expo. One laptop runs the game screen/server; other students join using mobile browsers. No app installation or special hardware is needed.

## Requirements
- Node.js 18 or newer: https://nodejs.org/
- Laptop and phones connected to the same Wi-Fi for local expo use.

## Run on your laptop
1. Extract this ZIP.
2. Open the `chaos_protocol_game` folder in VS Code or a terminal.
3. Run:
   ```bash
   npm install
   npm start
   ```
4. On the laptop, open `http://localhost:3000`.
5. Click **Create New Room**.
6. Find the laptop's local IPv4 address:
   - Windows: open Command Prompt and run `ipconfig`; use the IPv4 address under your Wi-Fi adapter (for example, `192.168.1.25`).
7. On each phone connected to the same Wi-Fi, open `http://YOUR-LAPTOP-IP:3000` (replace with the actual address).
8. Enter the room code shown on the laptop and a callsign, then tap **Join Mission**.
9. With at least two players connected, click **Start Mission** on the laptop.

## Gameplay
- The room assigns different roles and private clues.
- Share clues through Team Comms.
- Activate the power nodes in the sequence **Violet → Blue → Amber**.
- The Explorer/Navigator moves the player with the arrow controls.
- Reach the exit after all nodes are activated before the 3-minute timer expires.
- The host can reset and replay the mission.

## Troubleshooting
- If phones cannot connect, confirm all devices use the same Wi-Fi and the Wi-Fi network allows device-to-device connections.
- Allow Node.js through Windows Defender Firewall on private networks if Windows asks.
- Do not use `localhost` on the phone; use the laptop's IPv4 address.
- If your expo Wi-Fi blocks device connections, use a trusted personal hotspot and connect the laptop and phones to it.
- Keep the laptop terminal open while the game is running.

## Project structure
- `server.js` — multiplayer server and game state
- `public/index.html` — responsive laptop display and mobile controller
- `package.json` — Node.js dependencies and run command
