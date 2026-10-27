# CHAOS PROTOCOL — ONE GAME, DIFFERENT REALITIES
### An Asymmetric Cooperative 3D Multiplayer Puzzle Game

**CHAOS PROTOCOL** is a real-time multiplayer 3D puzzle installation designed for college expos, hackathons, and interactive showcases. One central laptop renders the cinematic, shared 3D dimension in third-person or tactical isometric perspective, while 3 players connect instantly using their smartphone browsers to receive role-specific interfaces with asymmetric information.

No player has enough information to solve the mission alone. Cooperation, communication, and synchronization are mandatory to escape before dimensional collapse.

---

## 🎮 THE THREE ASYMMETRIC ROLES

Role information is strictly **enforced by the server**. The server filters all outgoing network packets so that clients only receive their authorized telemetry.

| Role | Interface & Device | Intel & Ability | Redacted by Server |
| :--- | :--- | :--- | :--- |
| **🧭 THE NAVIGATOR** | Smartphone (Portrait) | **Tactical Radar & Propulsion Controls**: Views top-down corridor radar, avatar position, waypoint callouts, and controls movement across the maze. | Hidden traps and switch sequence are hidden. |
| **👁️ THE OBSERVER** | Smartphone (Portrait) | **Anomaly Scanner & Hazard Telemetry**: Detects invisible quantum glitches, laser tripwires, and structural collapses. Broadcasts urgent warning alarms to the team. | Complete route map and machinery controls are hidden. |
| **⚡ THE CONTROLLER** | Smartphone (Portrait) | **Quantum Power Grid Console**: Operates tactile reactor switches, deploys light bridges across voids, and unseals Titan Blast Doors. | Route map and hidden traps are hidden. |
| **🖥️ MISSION CONTROL** | Laptop (Main Display) | **Authoritative 3D Game World**: Renders the complete 3D obsidian matrix, cybernetic drone avatar, glowing bridges, hydraulic doors, hazard shockwaves, and spectator HUD. | Full world visibility for spectators. |

---

## 🌟 CORE FEATURES & ARCHITECTURE

- **Real-Time 3D Rendering (Three.js)**:
  - Dark obsidian and graphite modular architecture with metallic brushed floor tiles and glowing circuit seams.
  - Floating cybernetic avatar drone with animated thrusters, emissive cyclops visor, and smooth position interpolation.
  - Dynamic **Energy Bridges** that materialize across void chasms when activated by the Controller.
  - Hydraulic **Titan Blast Doors** that physically slide open with mechanical sound and particle effects.
  - Floating, rotating **Gyro-Ring Power Nodes** that spin and pulse with colored volumetric light rings.
  - Levitating **Hover Platforms** oscillating across bottomless void abysses.
  - Swirling **Quantum Exit Portal** with concentric event horizon rings and upward beacon light.
  - Multiple camera modes: **Tactical Isometric** (expo spectator readability), **Cinematic Orbit**, and **Chase Cam**.
- **Server-Authoritative Real-Time Networking (Socket.IO)**:
  - Authoritative room state, countdown timer, collision detection, switch sequence validation, and stability tracking.
  - Server-enforced role privacy: private filtered packets for Navigator, Observer, and Controller.
- **Frictionless QR Code Joining**:
  - Automatically discovers the laptop's local IPv4 network address (e.g., `10.52.78.245`).
  - Displays a live QR code and 4-letter room code on the laptop screen.
  - Phones scan the QR code to open the mobile controller directly with the room code prefilled.
  - No app installation, no accounts, zero friction.
- **Procedural Web Audio API Synthesizer (`public/js/audio.js`)**:
  - 100% self-contained procedural sound synthesizer (zero external audio file dependencies).
  - Ambient deep sci-fi drone, avatar thruster pulses, wall bump impacts, harmonic switch chimes, shimmering bridge sweeps, hydraulic door slides, glitch shock bursts, klaxon alarms, and victory fanfares.
  - Master mute/unmute control and browser audio policy initialization.
- **Three Playable Missions**:
  1. *Mission 1: The Fractured Gate* (Sector 7-Alpha Orbital Breach)
  2. *Mission 2: Neon Labyrinth* (Sub-Level 4 Matrix Grid)
  3. *Mission 3: Void Core* (Singularity Chamber)
- **Solo / Expo Demo Mode**:
  - Toggle available on the host lobby screen enabling WASD / Arrow key movement on the laptop and quick test buttons, allowing organizers or evaluators to test and showcase the full game loop even without phones handy.

---

## 🚀 QUICK START GUIDE

### 1. Requirements
- Node.js 18 or newer (`node -v`)
- npm 9 or newer (`npm -v`)
- Modern web browser (Chrome, Edge, Safari, Firefox)

### 2. Installation
Clone or extract the repository:
```bash
cd chaos_protocol_game
npm install
```

### 3. Launching Locally

**On Windows:**
Simply double-click `start.bat` (or run `.\start.bat` in terminal). It will automatically verify Node.js, install any missing dependencies, start the server, and open `http://localhost:3000` in your browser.

**Via CLI / Cross-Platform:**
```bash
npm start
```
The server will output:
```text
====================================================
 CHAOS PROTOCOL SERVER ONLINE
 Host screen:  http://localhost:3000
 Mobile join:  http://YOUR-LAPTOP-IP:3000/join
====================================================
```

### 4. Running at a College Expo or Hackathon
1. **On the Laptop**: Open `http://localhost:3000`. The 3D world loads and the Lobby displays a large QR code and 4-letter Room Code.
2. **Connect Phones**: Have up to 3 teammates scan the QR code with their smartphone cameras (or open `http://YOUR-LAPTOP-IP:3000/join?room=CODE` on the same Wi-Fi).
3. **Assign Roles**: Each phone selects or confirms their role (**Navigator**, **Observer**, or **Controller**).
4. **Launch Mission**: Click **▶ START MISSION** on the laptop.
5. **Spectators**: Can watch the shared 3D screen, monitor live dimension stability, and listen to the team coordinate!

### 5. Connecting Phones on Another Network (Mobile 4G/5G or Different Wi-Fi)
If players' phones are on mobile data (4G/5G) or a different network, a private local IP (e.g. `192.168.x.x`) cannot be reached. Chaos Protocol now provides **fully automated online support**:

- **Method 1: One-Click Inside Browser (Zero Setup)**:
  1. Start the server normally (`npm start` or double-click `start.bat`).
  2. In the lobby screen on your laptop, click **⚡ GO ONLINE (ALLOW PHONES ON 4G/5G)** directly under the QR code.
  3. The server instantly generates a secure public HTTPS tunnel link and updates the QR code within seconds.
  4. Any phone on 4G, 5G, or any outside Wi-Fi network can scan and join immediately!

- **Method 2: Start Directly in Online Mode via Terminal / CLI**:
  ```bash
  npm run start:online
  ```
  *(or `node server.js --online` or double-click `start.bat` and press `1`)*.
  The server boots directly with an automated public HTTPS tunnel and generates an online QR code from the start.

- **Method 3: Deploy to Free Cloud Host (Render / Railway / Fly.io / Vercel)**:
  - If deploying to **Render / Railway / Fly.io**: The server automatically detects cloud environment variables (`RENDER_EXTERNAL_URL`, `RAILWAY_PUBLIC_DOMAIN`, `FLY_APP_NAME`) and configures the QR code with your public HTTPS domain.
  - If deploying to **Vercel / Netlify**: The frontend automatically connects phones to the host using WebRTC with built-in Google STUN and OpenRelay TURN servers, allowing peer-to-peer data channels to traverse cellular 4G/5G NAT firewalls seamlessly without requiring a persistent backend server!

---

## 🧪 AUTOMATED TESTING & VERIFICATION

A comprehensive end-to-end integration test is included that spins up 4 headless Socket.IO clients (Host, Navigator, Observer, Controller) and validates:
- Room creation and QR code generation.
- Role assignments and server privacy redaction.
- Mission start sequence and timer countdown.
- Tactical warning broadcasts.
- Power switch sequence calibration (Violet -> Cyan -> Amber).
- Light bridge materialization.
- Titan Gate unlocking.
- Navigator pathfinding and avatar collision checks.
- Victory condition and score calculation.

Run the test suite:
```bash
npm test
```
Result:
```text
✔ Host connected to server
✔ Room created successfully.
✔ Navigator joined as navigator
✔ Observer joined as observer
✔ Controller joined as controller
✔ Navigator PRIVACY VERIFIED: Hidden hazards are safely redacted by server.
✔ Observer PRIVACY VERIFIED: Full map layout is safely redacted by server.
✔ Controller PRIVACY VERIFIED: Route map is safely redacted by server.
✔ All 3 Quantum Power Nodes successfully activated in sequence!
✔ Energy Bridge successfully deployed across void!
✔ Titan Blast Gate unsealed!
✔ ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!
```

---

## 🌐 PRODUCTION DEPLOYMENT

### Environment Variables
Configure the following environment variables if deploying to cloud hosting:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Listening HTTP port (defaults to 3000) | `3000` |
| `PUBLIC_URL` | Deployed public domain URL used for phone QR codes | `https://chaos-protocol.up.railway.app` |

### Deploying to Railway / Render / Fly.io (Persistent WebSocket Hosts)
Because Chaos Protocol relies on persistent WebSocket connections for real-time multiplayer, use a platform supporting persistent Node.js services:

1. **Deploy to Render / Railway**:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Set Environment Variable: `PUBLIC_URL = https://your-app-name.onrender.com`
2. The server will automatically embed the public URL into the QR code!

---

## 📂 PROJECT STRUCTURE

```text
chaos_protocol_game/
├── package.json              # Scripts and dependencies (express, socket.io, three, qrcode)
├── server.js                 # Authoritative game server, role privacy engine & state machine
├── test/
│   └── multiplayer_test.js   # End-to-end multi-client integration test suite
├── public/
│   ├── index.html            # Main laptop host and spectator 3D gameplay screen
│   ├── mobile.html           # Dedicated smartphone portal for Navigator, Observer, Controller
│   ├── css/
│   │   ├── main.css          # Sci-fi design system, Orbitron/Rajdhani tokens, HUD & modals
│   │   └── mobile.css        # Mobile-first touch layout, tactile D-Pad, radar visualizers
│   └── js/
│       ├── audio.js          # Procedural Web Audio API sound synthesizer
│       ├── game3d.js         # Three.js 3D world engine (obsidian maze, avatar, bridges, gates)
│       ├── host.js           # Host client logic, socket bindings, test mode, spectator HUD
│       └── mobile.js         # Smartphone client logic for the 3 distinct roles & haptics
└── README.md                 # Complete documentation and setup guide
```

---

## 🏆 RULES & WALKTHROUGH FOR MISSION 01

1. **Start Hub**: Avatar spawns at Sector (1, 1).
2. **Hazard Warning**: The Observer's scanner detects lethal quantum glitches at (2, 4) and (5, 8). The Observer must broadcast an alarm to prevent the Navigator from stepping onto those coordinates.
3. **Power Calibration**: The team must deduce the correct sequence from their private clues:
   - Violet (Node 2) at Sector (4, 10)
   - Cyan (Node 0) at Sector (1, 8)
   - Amber (Node 1) at Sector (8, 2)
4. **Deploy Light Bridge**: Engaging the Beta Conduit powers the Energy Bridge at coordinates (3, 5) and (4, 5).
5. **Unseal Titan Gate**: Energizing all 3 nodes unseals the Titan Blast Gate at (9, 9).
6. **Quantum Escape**: The Navigator guides the avatar across the bridge and through the Titan Gate into the Quantum Exit Portal at (10, 10).
