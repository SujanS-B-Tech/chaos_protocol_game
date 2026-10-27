const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const tunnelManager = require("./tunnel");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
const PORT = process.env.PORT || 3000;

// Auto-detect cloud deployment environments
function detectPublicUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`.replace(/\/$/, "");
  if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  if (process.env.PROJECT_DOMAIN) return `https://${process.env.PROJECT_DOMAIN}.glitch.me`.replace(/\/$/, "");
  return null;
}

// Determine best host IP for local network connections
function getLocalIp() {
  const detected = detectPublicUrl();
  if (detected) return detected;

  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        // Prefer Wi-Fi or Ethernet
        const isPreferred = /wi-?fi|ethernet|en0|eth0|wlan0/i.test(name);
        candidates.push({ address: net.address, isPreferred });
      }
    }
  }
  if (candidates.length > 0) {
    const preferred = candidates.find(c => c.isPreferred);
    return `http://${(preferred || candidates[0]).address}:${PORT}`;
  }
  return `http://localhost:${PORT}`;
}

function formatUrl(url) {
  if (!url || typeof url !== "string") return null;
  let clean = url.trim().replace(/\/$/, "");
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `https://${clean}`;
  }
  return clean;
}

function resolveBaseUrl(socket, clientOrigin, customUrl) {
  const formattedCustom = formatUrl(customUrl);
  if (formattedCustom) return formattedCustom;

  const detectedCloud = detectPublicUrl();
  if (detectedCloud) return detectedCloud;

  const tunnelStatus = tunnelManager.getTunnelStatus();
  if (tunnelStatus.active && tunnelStatus.url) {
    return tunnelStatus.url;
  }

  const formattedOrigin = formatUrl(clientOrigin);
  if (formattedOrigin && !formattedOrigin.includes("localhost") && !formattedOrigin.includes("127.0.0.1")) {
    return formattedOrigin;
  }

  const headers = socket?.handshake?.headers || {};
  const origin = headers.origin || headers.referer;
  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
    try {
      const u = new URL(origin);
      return `${u.protocol}//${u.host}`;
    } catch (_) {}
  }

  const fwdProto = headers["x-forwarded-proto"] || "http";
  const fwdHost = headers["x-forwarded-host"] || headers.host;
  if (fwdHost && !fwdHost.includes("localhost") && !fwdHost.includes("127.0.0.1")) {
    return `${fwdProto}://${fwdHost}`;
  }

  return SERVER_BASE_URL;
}

let SERVER_BASE_URL = getLocalIp();
console.log(`[Chaos Protocol] Network address for mobile players: ${SERVER_BASE_URL}`);

// Express middleware
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/three", express.static(path.join(__dirname, "node_modules/three")));

app.get("/health", (_req, res) => res.json({ ok: true, timestamp: Date.now() }));

// Helper to determine base URL from incoming HTTP request
function getRequestBaseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return `${proto}://${host}`;
  }
  const tunnel = tunnelManager.getTunnelStatus();
  if (tunnel.active && tunnel.url) return tunnel.url;
  return SERVER_BASE_URL;
}

// Network & QR code info endpoint
app.get("/api/network-info", (req, res) => {
  const effectiveBaseUrl = getRequestBaseUrl(req);
  res.json({
    baseUrl: effectiveBaseUrl,
    localUrl: SERVER_BASE_URL,
    port: PORT,
    tunnel: tunnelManager.getTunnelStatus()
  });
});

// Dynamic Tunnel endpoints for 1-click cross-network access
app.get("/api/tunnel/status", (_req, res) => {
  res.json({
    ...tunnelManager.getTunnelStatus(),
    baseUrl: SERVER_BASE_URL
  });
});

app.post("/api/tunnel/start", async (_req, res) => {
  try {
    const status = await tunnelManager.startTunnel(PORT);
    if (status && status.url) {
      SERVER_BASE_URL = status.url;
      console.log(`[Chaos Protocol] Online 4G tunnel activated: ${status.url}`);

      // Broadcast new online join URL to all open rooms
      for (const [code, room] of rooms.entries()) {
        room.baseUrl = status.url;
        const joinUrl = `${status.url}/join?room=${code}`;
        io.to(room.hostSocketId).emit("room:created", {
          code,
          joinUrl,
          baseUrl: status.url,
          levelId: room.levelId,
          mission: room.mission,
          hostToken: room.hostToken
        });
        addMessage(room, `🌐 Online 4G tunnel active: ${status.url}`, "good");
        broadcastRoom(room);
      }
    }
    res.json({ ok: true, ...status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/tunnel/stop", async (_req, res) => {
  try {
    await tunnelManager.stopTunnel();
    SERVER_BASE_URL = getLocalIp();
    for (const [code, room] of rooms.entries()) {
      room.baseUrl = SERVER_BASE_URL;
      const joinUrl = `${SERVER_BASE_URL}/join?room=${code}`;
      io.to(room.hostSocketId).emit("room:created", {
        code,
        joinUrl,
        baseUrl: SERVER_BASE_URL,
        levelId: room.levelId,
        mission: room.mission,
        hostToken: room.hostToken
      });
      addMessage(room, `Switched back to Local IP: ${SERVER_BASE_URL}`, "info");
      broadcastRoom(room);
    }
    res.json({ ok: true, baseUrl: SERVER_BASE_URL });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Dynamic QR code generation endpoint
app.get("/api/qr", async (req, res) => {
  const effectiveBaseUrl = getRequestBaseUrl(req);
  const targetUrl = req.query.url || `${effectiveBaseUrl}/join`;
  try {
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      margin: 1,
      width: 320,
      color: {
        dark: "#00f0ff",
        light: "#0b1220"
      }
    });
    res.json({ dataUrl, url: targetUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

// Mobile join route
app.get("/join", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mobile.html"));
});

// ==========================================
// GAME DEFINITIONS & MISSIONS
// ==========================================

const ROLE_INFO = {
  navigator: {
    id: "navigator",
    name: "Navigator",
    title: "Pathfinder & Tactician",
    badge: "NAV-01",
    color: "#00f0ff",
    accent: "rgba(0, 240, 255, 0.2)",
    icon: "🧭",
    description: "You possess the orbital radar. Guide the avatar along safe corridors and navigate toward the exit portal."
  },
  observer: {
    id: "observer",
    name: "Observer",
    title: "Hazard & Sensor Specialist",
    badge: "OBS-02",
    color: "#ffca68",
    accent: "rgba(255, 202, 104, 0.2)",
    icon: "👁️",
    description: "You detect hidden quantum glitches, laser tripwires, and structural collapses. Alert the team before they trigger a trap."
  },
  controller: {
    id: "controller",
    name: "Controller",
    title: "Quantum Systems Engineer",
    badge: "CTL-03",
    color: "#c084fc",
    accent: "rgba(192, 132, 252, 0.2)",
    icon: "⚡",
    description: "You operate the quantum power nodes, deploy energy bridges, and unlock blast doors. Coordinate the activation sequence."
  }
};

const MISSIONS = {
  1: {
    id: 1,
    name: "THE FRACTURED GATE",
    subtitle: "Sector 7-Alpha Orbital Breach",
    description: "Restore power to the breached orbital conduit, deploy the energy bridge across the void, and breach the Titan Gate before dimensional collapse.",
    timeLimit: 180,
    mapSize: { width: 12, height: 12 },
    start: { x: 1, z: 1 },
    exit: { x: 10, z: 10 },
    // 0 = Void, 1 = Solid Floor, 2 = Wall monolith, 3 = Energy Bridge (toggleable), 4 = Titan Gate (toggleable)
    layout: [
      [2,2,2,2,2,2,2,2,2,2,2,2],
      [2,1,1,1,2,1,1,1,1,1,1,2],
      [2,1,2,1,2,1,2,2,1,2,1,2],
      [2,1,2,1,1,1,2,0,0,2,1,2],
      [2,1,2,2,2,1,2,0,0,2,1,2],
      [2,1,1,3,3,1,1,1,1,1,1,2],
      [2,2,1,2,2,1,2,2,2,2,1,2],
      [2,1,1,1,2,1,1,1,1,2,1,2],
      [2,1,2,1,1,1,2,1,1,1,1,2],
      [2,1,2,2,2,1,2,2,2,4,2,2],
      [2,1,1,1,1,1,1,1,1,1,1,2],
      [2,2,2,2,2,2,2,2,2,2,2,2]
    ],
    // Bridges that must be powered on
    bridges: [
      { id: "bridge-1", tiles: [{ x: 3, z: 5 }, { x: 4, z: 5 }], active: false, requiredNode: 1 }
    ],
    // Doors that open
    doors: [
      { id: "door-1", x: 9, z: 9, open: false, requiresAllNodes: true }
    ],
    // Moving platforms
    movingPlatforms: [
      { id: "platform-1", start: { x: 7, z: 3 }, end: { x: 8, z: 4 }, speed: 0.03, current: { x: 7, z: 3 } }
    ],
    // Power nodes / switches (id, name, color, position, sequenceOrder: 0 = first, 1 = second, 2 = third)
    nodes: [
      { id: 0, name: "ALPHA RELAY", color: "#00f0ff", x: 1, z: 8, active: false, label: "Cyan Node" },
      { id: 1, name: "BETA CONDUIT", color: "#ffca68", x: 8, z: 2, active: false, label: "Amber Node" },
      { id: 2, name: "QUANTUM RELAY", color: "#c084fc", x: 4, z: 10, active: false, label: "Violet Node" }
    ],
    // Target sequence: Violet (2) -> Cyan (0) -> Amber (1)
    correctSequence: [2, 0, 1],
    // Hidden hazards (only visible to Observer!)
    hazards: [
      { id: "h1", x: 2, z: 4, type: "quantum_glitch", label: "Quantum Glitch", severity: "high", triggered: false },
      { id: "h2", x: 5, z: 8, type: "unstable_core", label: "Unstable Subfloor", severity: "critical", triggered: false },
      { id: "h3", x: 8, z: 7, type: "laser_sensor", label: "Laser Tripwire", severity: "medium", triggered: false },
      { id: "h4", x: 10, z: 3, type: "quantum_glitch", label: "Phase Rift", severity: "high", triggered: false },
      { id: "h5", x: 7, z: 10, type: "unstable_core", label: "Void Sinkhole", severity: "critical", triggered: false }
    ],
    // Secret intel distributed to roles
    clues: {
      navigator: {
        route: "PRIMARY VECTOR: Move South into the main corridor. Bridge at (3,5)-(4,5) requires Beta Conduit power. Exit portal lies at Sector 10-10 behind the Titan Gate.",
        waypoints: [
          { x: 1, z: 1, note: "Start Hub" },
          { x: 1, z: 5, note: "Bridge Approach" },
          { x: 5, z: 5, note: "East Crossing" },
          { x: 10, z: 10, note: "Quantum Exit" }
        ]
      },
      observer: {
        hazardSummary: "5 ANOMALIES DETECTED. Critical rifts at (2,4), (5,8), and (7,10). Laser sensor at (8,7). Warn the navigator before entering these coordinates!",
        anomalyHints: "Node sequence signature: The highest energy harmonic (Violet) must be engaged first to stabilize the conduit."
      },
      controller: {
        wiring: "POWER GRID: Activating Node 1 (Beta) powers the Light Bridge. Node 2 (Violet) primes the grid. All 3 nodes must be fully engaged to unseal the Titan Gate.",
        clue: "SEQUENCE FREQUENCY: Violet -> Cyan -> Amber. Premature activation will trip the surge breaker."
      }
    }
  },
  2: {
    id: 2,
    name: "NEON LABYRINTH",
    subtitle: "Sub-Level 4 Matrix Grid",
    description: "Navigate a denser high-voltage grid with alternating phase barriers and moving platforms.",
    timeLimit: 160,
    mapSize: { width: 12, height: 12 },
    start: { x: 1, z: 1 },
    exit: { x: 10, z: 1 },
    layout: [
      [2,2,2,2,2,2,2,2,2,2,2,2],
      [2,1,1,1,2,1,1,1,1,1,1,2],
      [2,1,2,1,2,1,2,2,2,2,1,2],
      [2,1,2,1,1,1,1,1,1,2,1,2],
      [2,1,2,2,2,2,2,1,2,2,1,2],
      [2,1,1,1,1,1,2,1,1,1,1,2],
      [2,2,2,1,2,1,2,1,2,2,2,2],
      [2,1,1,1,2,1,1,1,1,1,1,2],
      [2,1,2,2,2,1,2,2,2,1,2,2],
      [2,1,1,1,1,1,1,3,3,1,1,2],
      [2,2,2,2,2,2,2,2,4,2,1,2],
      [2,2,2,2,2,2,2,2,2,2,2,2]
    ],
    bridges: [
      { id: "bridge-2", tiles: [{ x: 7, z: 9 }, { x: 8, z: 9 }], active: false, requiredNode: 0 }
    ],
    doors: [
      { id: "door-2", x: 8, z: 10, open: false, requiresAllNodes: true }
    ],
    movingPlatforms: [
      { id: "platform-2", start: { x: 5, z: 7 }, end: { x: 7, z: 7 }, speed: 0.04, current: { x: 5, z: 7 } }
    ],
    nodes: [
      { id: 0, name: "CYAN CONDUIT", color: "#00f0ff", x: 10, z: 5, active: false, label: "Cyan Node" },
      { id: 1, name: "AMBER RELAY", color: "#ffca68", x: 1, z: 7, active: false, label: "Amber Node" },
      { id: 2, name: "VIOLET CORE", color: "#c084fc", x: 6, z: 3, active: false, label: "Violet Node" }
    ],
    correctSequence: [1, 2, 0], // Amber -> Violet -> Cyan
    hazards: [
      { id: "h21", x: 3, z: 3, type: "laser_sensor", label: "Laser Sensor", severity: "high", triggered: false },
      { id: "h22", x: 6, z: 5, type: "quantum_glitch", label: "Voltage Leak", severity: "critical", triggered: false },
      { id: "h23", x: 9, z: 7, type: "unstable_core", label: "Flux Void", severity: "high", triggered: false }
    ],
    clues: {
      navigator: { route: "ROUTE INTEL: Travel South through western corridor, cross lower junction East to Sector 10-1.", waypoints: [] },
      observer: { hazardSummary: "HIGH VOLTAGE HAZARDS: Watch coordinates (3,3) and (6,5) closely.", anomalyHints: "Amber harmonic triggers first." },
      controller: { wiring: "AMBER node must trigger first, then Violet, then Cyan.", clue: "ORDER: Amber -> Violet -> Cyan." }
    }
  },
  3: {
    id: 3,
    name: "VOID CORE",
    subtitle: "Singularity Chamber",
    description: "Survive the collapsing reactor core with shifting quantum platforms and minimal margin for error.",
    timeLimit: 140,
    mapSize: { width: 12, height: 12 },
    start: { x: 1, z: 1 },
    exit: { x: 6, z: 6 },
    layout: [
      [2,2,2,2,2,2,2,2,2,2,2,2],
      [2,1,1,1,1,2,2,1,1,1,1,2],
      [2,1,2,2,1,1,1,1,2,2,1,2],
      [2,1,2,0,0,3,3,0,0,2,1,2],
      [2,1,1,0,2,2,2,2,0,1,1,2],
      [2,2,1,3,2,1,1,2,3,1,2,2],
      [2,2,1,3,2,1,1,2,3,1,2,2],
      [2,1,1,0,2,2,2,2,0,1,1,2],
      [2,1,2,0,0,3,3,0,0,2,1,2],
      [2,1,2,2,1,1,1,1,2,2,1,2],
      [2,1,1,1,1,2,2,1,1,1,1,2],
      [2,2,2,2,2,2,2,2,2,2,2,2]
    ],
    bridges: [
      { id: "bridge-3a", tiles: [{ x: 5, z: 3 }, { x: 6, z: 3 }], active: false, requiredNode: 0 },
      { id: "bridge-3b", tiles: [{ x: 3, z: 5 }, { x: 3, z: 6 }], active: false, requiredNode: 1 },
      { id: "bridge-3c", tiles: [{ x: 8, z: 5 }, { x: 8, z: 6 }], active: false, requiredNode: 2 }
    ],
    doors: [],
    movingPlatforms: [],
    nodes: [
      { id: 0, name: "CYAN PLEXUS", color: "#00f0ff", x: 1, z: 10, active: false, label: "Cyan Node" },
      { id: 1, name: "AMBER SYNAPSE", color: "#ffca68", x: 10, z: 1, active: false, label: "Amber Node" },
      { id: 2, name: "VIOLET VORTEX", color: "#c084fc", x: 10, z: 10, active: false, label: "Violet Node" }
    ],
    correctSequence: [0, 1, 2],
    hazards: [
      { id: "h31", x: 4, z: 2, type: "quantum_glitch", label: "Quantum Collapse", severity: "critical", triggered: false },
      { id: "h32", x: 7, z: 9, type: "unstable_core", label: "Gravitational Singularity", severity: "critical", triggered: false }
    ],
    clues: {
      navigator: { route: "REACH THE CORE: The exit singularity is at (6,6). All bridges must be aligned.", waypoints: [] },
      observer: { hazardSummary: "EXTREME TEMPORAL DISTORTION: Avoid outer perimeter anomalies at (4,2) and (7,9).", anomalyHints: "Cyan initiates the sequence." },
      controller: { wiring: "All 3 nodes deploy separate bridge spans leading to the core.", clue: "ORDER: Cyan -> Amber -> Violet." }
    }
  }
};

// In-memory room store
const rooms = new Map();

function createRoom(code, levelId = 1) {
  const missionDef = MISSIONS[levelId] || MISSIONS[1];
  return {
    code,
    levelId,
    mission: missionDef,
    status: "lobby", // lobby | intro | playing | won | failed | paused
    players: {},
    hostSocketId: null,
    hostToken: crypto.randomBytes(16).toString("hex"),
    position: { ...missionDef.start },
    avatarFacing: "south",
    stability: 100, // 0 - 100%
    nodes: missionDef.nodes.map(n => ({ ...n, active: false })),
    sequenceProgress: 0,
    bridges: missionDef.bridges.map(b => ({ ...b, active: false })),
    doors: missionDef.doors.map(d => ({ ...d, open: false })),
    hazards: missionDef.hazards.map(h => ({ ...h, triggered: false })),
    movingPlatforms: missionDef.movingPlatforms.map(p => ({ ...p })),
    timeLeft: missionDef.timeLimit,
    startTime: null,
    score: 0,
    messages: [
      { text: `Mission initialized: ${missionDef.name}. Awaiting team connection.`, kind: "info", at: Date.now() }
    ],
    interval: null,
    createdAt: Date.now()
  };
}

// Generate unique short 4-letter room code
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  let attempts = 0;
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (rooms.has(code) && attempts < 100);
  return code;
}

// Clean player list for lobby
function getPublicPlayers(room) {
  return Object.values(room.players).map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    ready: p.ready,
    connected: p.connected,
    roleInfo: ROLE_INFO[p.role] || null
  }));
}

// Check role availability or pick best available role
function pickAvailableRole(room) {
  const roles = ["navigator", "observer", "controller"];
  const assigned = Object.values(room.players).map(p => p.role);
  for (const role of roles) {
    if (!assigned.includes(role)) return role;
  }
  return roles[assigned.length % roles.length];
}

// Add system or player message to feed
function addMessage(room, text, kind = "info", sender = "SYSTEM") {
  room.messages.push({ text, kind, sender, at: Date.now() });
  if (room.messages.length > 30) room.messages.shift();
}

// Calculate team score based on time remaining, stability, and speed
function calculateScore(room) {
  const timeBonus = room.timeLeft * 20;
  const stabilityBonus = Math.floor(room.stability * 15);
  const baseScore = 2000;
  return Math.max(500, baseScore + timeBonus + stabilityBonus);
}

// ==========================================
// SERVER-ENFORCED ROLE PAYLOADS
// ==========================================

function getRolePayload(room, role, playerId) {
  const common = {
    code: room.code,
    levelId: room.levelId,
    missionName: room.mission.name,
    status: room.status,
    timeLeft: room.timeLeft,
    stability: room.stability,
    players: getPublicPlayers(room),
    messages: room.messages.slice(-10),
    myRole: role,
    roleInfo: ROLE_INFO[role] || null
  };

  // Host / Spectator view receives full 3D world state
  if (role === "host") {
    return {
      ...common,
      position: room.position,
      facing: room.avatarFacing,
      nodes: room.nodes,
      bridges: room.bridges,
      doors: room.doors,
      hazards: room.hazards,
      movingPlatforms: room.movingPlatforms,
      score: room.score,
      mapLayout: room.mission.layout,
      start: room.mission.start,
      exit: room.mission.exit
    };
  }

  // NAVIGATOR (Mobile)
  // Receives: Map layout, avatar position, exit portal, route clues, tactical waypoints.
  // REDACTED: Hidden traps / hazards, switch circuits, puzzle answer.
  if (role === "navigator") {
    return {
      ...common,
      position: room.position,
      facing: room.avatarFacing,
      exit: room.mission.exit,
      start: room.mission.start,
      mapLayout: room.mission.layout, // wall / floor / bridge layout
      bridges: room.bridges.map(b => ({ id: b.id, active: b.active, tiles: b.tiles })),
      doors: room.doors.map(d => ({ id: d.id, open: d.open, x: d.x, z: d.z })),
      routeClue: room.mission.clues.navigator.route,
      waypoints: room.mission.clues.navigator.waypoints,
      canMove: room.status === "playing"
    };
  }

  // OBSERVER (Mobile)
  // Receives: Hidden hazard telemetry, danger heatmaps, anomaly scans, warning broadcast controls.
  // REDACTED: Full maze layout, switch toggles, optimal path.
  if (role === "observer") {
    return {
      ...common,
      position: room.position,
      hazards: room.hazards, // Full hazard telemetry!
      hazardSummary: room.mission.clues.observer.hazardSummary,
      anomalyHints: room.mission.clues.observer.anomalyHints,
      canScan: room.status === "playing"
    };
  }

  // CONTROLLER (Mobile)
  // Receives: Power node switches, reactor toggles, bridge deployers, door overrides, wiring clues.
  // REDACTED: Route to exit, hidden hazards.
  if (role === "controller") {
    return {
      ...common,
      nodes: room.nodes.map(n => ({
        id: n.id,
        name: n.name,
        color: n.color,
        active: n.active,
        label: n.label
      })),
      bridges: room.bridges.map(b => ({ id: b.id, active: b.active })),
      doors: room.doors.map(d => ({ id: d.id, open: d.open })),
      wiringClue: room.mission.clues.controller.wiring,
      canControl: room.status === "playing"
    };
  }

  return common;
}

// Broadcast updates to all players in the room with enforced privacy
function broadcastRoom(room) {
  // Update Host
  if (room.hostSocketId) {
    io.to(room.hostSocketId).emit("room:update", getRolePayload(room, "host", room.hostSocketId));
  }

  // Update each connected player
  for (const socketId of Object.keys(room.players)) {
    const player = room.players[socketId];
    if (socketId !== room.hostSocketId) {
      io.to(socketId).emit("room:update", getRolePayload(room, player.role, socketId));
    }
  }
}

// ==========================================
// GAME TICK & MOVEMENT LOGIC
// ==========================================

function startGame(room) {
  room.status = "intro";
  room.position = { ...room.mission.start };
  room.avatarFacing = "south";
  room.stability = 100;
  room.timeLeft = room.mission.timeLimit;
  room.sequenceProgress = 0;
  room.nodes.forEach(n => { n.active = false; });
  room.bridges.forEach(b => { b.active = false; });
  room.doors.forEach(d => { d.open = false; });
  room.hazards.forEach(h => { h.triggered = false; });
  room.score = 0;

  addMessage(room, "MISSION SEQUENCE INITIALIZED. Synchronizing neural links...", "good");
  broadcastRoom(room);

  // Short 2.5s cinematic intro then start active play
  setTimeout(() => {
    if (room.status !== "intro") return;
    room.status = "playing";
    room.startTime = Date.now();
    addMessage(room, "DIMENSIONAL STABILIZERS ENGAGED. Communicate and advance!", "good");

    resumeGameTimer(room);

    broadcastRoom(room);
  }, 2500);
}

function resumeGameTimer(room) {
    if (room.interval || room.status !== "playing") return;
    room.interval = setInterval(() => {
      if (room.status !== "playing") return;

      room.timeLeft -= 1;

      // Update moving platforms
      updateMovingPlatforms(room);

      if (room.timeLeft <= 0) {
        room.timeLeft = 0;
        room.status = "failed";
        addMessage(room, "DIMENSIONAL COLLAPSE: Mission time expired. Team lost to the void.", "bad");
        if (room.interval || room.status !== "playing") return;
        room.interval = null;
      }

      broadcastRoom(room);
    }, 1000);

}

function updateMovingPlatforms(room) {
  const time = (Date.now() - (room.startTime || Date.now())) / 1000;
  room.movingPlatforms.forEach(p => {
    const t = (Math.sin(time * 1.5) + 1) / 2; // 0 to 1 smooth oscillation
    p.current = {
      x: p.start.x + (p.end.x - p.start.x) * t,
      z: p.start.z + (p.end.z - p.start.z) * t
    };
  });
}

function stopGameTimer(room) {
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = null;
  }
}

// ==========================================
// SOCKET.IO EVENT HANDLERS
// ==========================================

io.on("connection", socket => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Create room (Host laptop)
  socket.on("room:create", ({ hostName, levelId, clientOrigin, publicUrl } = {}) => {
    const code = generateRoomCode();
    const room = createRoom(code, Number(levelId) || 1);
    rooms.set(code, room);

    room.hostSocketId = socket.id;
    socket.data.room = code;
    socket.data.isHost = true;
    socket.join(code);

    const baseUrl = resolveBaseUrl(socket, clientOrigin, publicUrl);
    room.baseUrl = baseUrl;
    const joinUrl = `${baseUrl}/join?room=${code}`;

    socket.emit("room:created", {
      code,
      joinUrl,
      baseUrl,
      levelId: room.levelId,
      mission: room.mission,
      hostToken: room.hostToken
    });

    addMessage(room, `Lobby opened by Host (${hostName || "Mission Control"}). Base URL: ${baseUrl}`, "info");
    broadcastRoom(room);
  });

  // Host dynamically updates public / tunnel URL
  socket.on("room:setPublicUrl", ({ url } = {}) => {
    const code = socket.data.room;
    const room = rooms.get(code);
    if (!room || socket.id !== room.hostSocketId) return;

    const baseUrl = resolveBaseUrl(socket, null, url);
    room.baseUrl = baseUrl;
    const joinUrl = `${baseUrl}/join?room=${code}`;

    socket.emit("room:created", {
      code,
      joinUrl,
      baseUrl,
      levelId: room.levelId,
      mission: room.mission,
      hostToken: room.hostToken
    });

    addMessage(room, `Public join address updated: ${baseUrl}`, "good");
    broadcastRoom(room);
  });

  // Mobile player joining room
  socket.on("room:join", ({ code, name, requestedRole } = {}) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return socket.emit("notice", { type: "error", text: "Invalid Room Code. Check the code on the main screen." });
    }

    // Role assignment
    let role = requestedRole;
    const validRoles = ["navigator", "observer", "controller"];
    if (!validRoles.includes(role)) {
      role = pickAvailableRole(room);
    } else {
      // Check if role is already taken by someone else connected
      const existing = Object.values(room.players).find(p => p.role === role && p.connected && p.id !== socket.id);
      if (existing) {
        role = pickAvailableRole(room);
      }
    }

    const cleanName = (name || "Agent").trim().slice(0, 16) || "Agent";

    room.players[socket.id] = {
      id: socket.id,
      name: cleanName,
      role,
      ready: true,
      connected: true,
      playerToken: crypto.randomBytes(16).toString("hex")
    };

    socket.data.room = code;
    socket.data.isHost = false;
    socket.join(code);

    socket.emit("room:joined", {
      code,
      playerId: socket.id,
      name: cleanName,
      role,
      roleInfo: ROLE_INFO[role],
      playerToken: room.players[socket.id].playerToken
    });

    addMessage(room, `${cleanName} joined as ${ROLE_INFO[role].name}.`, "good");
    broadcastRoom(room);
  });

  // Player rejoins with a saved session token (Wi-Fi drop, screen lock, page reload)
  socket.on("room:rejoin", ({ code, playerToken } = {}) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room || !playerToken) {
      return socket.emit("session:expired", { text: "Session not found. Please join the room again." });
    }

    const entry = Object.entries(room.players).find(([, p]) => p.playerToken && p.playerToken === playerToken);
    if (!entry) {
      return socket.emit("session:expired", { text: "Session not found. Please join the room again." });
    }

    const [oldSocketId, player] = entry;
    if (oldSocketId !== socket.id) {
      delete room.players[oldSocketId];
      player.id = socket.id;
      room.players[socket.id] = player;
    }
    player.connected = true;
    resumeGameTimer(room);

    socket.data.room = code;
    socket.data.isHost = false;
    socket.join(code);

    socket.emit("room:joined", {
      code,
      playerId: socket.id,
      name: player.name,
      role: player.role,
      roleInfo: ROLE_INFO[player.role],
      playerToken: player.playerToken,
      rejoined: true
    });

    addMessage(room, `${player.name} reconnected as ${ROLE_INFO[player.role].name}.`, "good");
    broadcastRoom(room);
  });

  // Host reattaches to its existing room after a reconnect (instead of creating a new room)
  socket.on("room:rehost", ({ code, hostToken } = {}) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room || !hostToken || room.hostToken !== hostToken) {
      return socket.emit("room:rehostFailed");
    }

    room.hostSocketId = socket.id;
    resumeGameTimer(room);
    socket.data.room = code;
    socket.data.isHost = true;
    socket.join(code);

    socket.emit("room:created", {
      code,
      joinUrl: `${room.baseUrl}/join?room=${code}`,
      baseUrl: room.baseUrl,
      levelId: room.levelId,
      mission: room.mission,
      hostToken: room.hostToken,
      rehosted: true
    });

    addMessage(room, "Host screen reconnected.", "info");
    broadcastRoom(room);
  });

  // Switch role in lobby
  socket.on("player:selectRole", ({ role } = {}) => {
    const code = socket.data.room;
    const room = rooms.get(code);
    if (!room || room.status !== "lobby") return;

    if (!["navigator", "observer", "controller"].includes(role)) return;

    const player = room.players[socket.id];
    if (!player) return;

    // Check if taken
    const existing = Object.values(room.players).find(p => p.role === role && p.id !== socket.id && p.connected);
    if (existing) {
      return socket.emit("notice", { type: "error", text: `Role ${ROLE_INFO[role].name} is already assigned to ${existing.name}.` });
    }

    player.role = role;
    addMessage(room, `${player.name} switched to ${ROLE_INFO[role].name}.`, "info");
    broadcastRoom(room);
  });

  // Host-only guard for mission control events
  function requireHost(room) {
    if (room && socket.id === room.hostSocketId) return true;
    socket.emit("notice", { type: "error", text: "Only the host can control the mission." });
    return false;
  }

  // Host starts game
  socket.on("game:start", () => {
    const room = rooms.get(socket.data.room);
    if (!room || !requireHost(room)) return;

    // Allow start if at least 1 player connected or in solo/test mode
    startGame(room);
  });

  // Host changes mission level
  socket.on("game:setLevel", ({ levelId } = {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status === "playing" || !requireHost(room)) return;

    const id = Number(levelId);
    if (MISSIONS[id]) {
      room.levelId = id;
      room.mission = MISSIONS[id];
      room.position = { ...room.mission.start };
      room.nodes = room.mission.nodes.map(n => ({ ...n, active: false }));
      room.bridges = room.mission.bridges.map(b => ({ ...b, active: false }));
      room.doors = room.mission.doors.map(d => ({ ...d, open: false }));
      room.hazards = room.mission.hazards.map(h => ({ ...h, triggered: false }));
      addMessage(room, `Mission changed to: ${room.mission.name}`, "info");
      broadcastRoom(room);
    }
  });

  // Pause / resume game
  socket.on("game:togglePause", () => {
    const room = rooms.get(socket.data.room);
    if (!room || !requireHost(room)) return;

    if (room.status === "playing") {
      room.status = "paused";
      addMessage(room, "MISSION PAUSED.", "info");
    } else if (room.status === "paused") {
      room.status = "playing";
      resumeGameTimer(room);
      addMessage(room, "MISSION RESUMED.", "good");
    }
    broadcastRoom(room);
  });

  // Reset mission
  socket.on("game:reset", () => {
    const room = rooms.get(socket.data.room);
    if (!room || !requireHost(room)) return;

    stopGameTimer(room);
    room.status = "lobby";
    room.position = { ...room.mission.start };
    room.avatarFacing = "south";
    room.stability = 100;
    room.timeLeft = room.mission.timeLimit;
    room.sequenceProgress = 0;
    room.nodes.forEach(n => { n.active = false; });
    room.bridges.forEach(b => { b.active = false; });
    room.doors.forEach(d => { d.open = false; });
    room.hazards.forEach(h => { h.triggered = false; });
    room.score = 0;

    addMessage(room, "Mission reset to lobby. Review intel and prepare.", "info");
    broadcastRoom(room);
  });

  // Player movement (Authorized for Navigator or Host/Test)
  socket.on("player:move", ({ dx, dz } = {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "playing") return;

    const player = room.players[socket.id];
    const isHost = socket.id === room.hostSocketId;

    if (!isHost && (!player || player.role !== "navigator")) {
      return socket.emit("notice", { type: "error", text: "Only the Navigator controls avatar movement." });
    }

    dx = Math.max(-1, Math.min(1, Number(dx) || 0));
    dz = Math.max(-1, Math.min(1, Number(dz) || 0));
    if (Math.abs(dx) + Math.abs(dz) !== 1) return;

    // Determine facing direction
    if (dx > 0) room.avatarFacing = "east";
    else if (dx < 0) room.avatarFacing = "west";
    else if (dz > 0) room.avatarFacing = "south";
    else if (dz < 0) room.avatarFacing = "north";

    const nx = room.position.x + dx;
    const nz = room.position.z + dz;

    // Check bounds
    if (nx < 0 || nx >= room.mission.mapSize.width || nz < 0 || nz >= room.mission.mapSize.height) {
      return;
    }

    const tile = room.mission.layout[nz][nx];

    // Check Wall (2)
    if (tile === 2) {
      addMessage(room, "OBSTACLE: Monolith barrier blocks navigation.", "bad");
      io.to(room.code).emit("game:sound", { sound: "bump" });
      broadcastRoom(room);
      return;
    }

    // Check Titan Gate / Door (4)
    if (tile === 4) {
      const door = room.doors.find(d => d.x === nx && d.z === nz);
      if (door && !door.open) {
        addMessage(room, "TITAN GATE LOCKED: All 3 quantum nodes must be online.", "bad");
        io.to(room.code).emit("game:sound", { sound: "denied" });
        broadcastRoom(room);
        return;
      }
    }

    // Check Bridge (3)
    if (tile === 3) {
      const bridge = room.bridges.find(b => b.tiles.some(t => t.x === nx && t.z === nz));
      if (bridge && !bridge.active) {
        addMessage(room, "VOID HAZARD: Light bridge unpowered! Controller must activate Beta Conduit.", "bad");
        io.to(room.code).emit("game:sound", { sound: "void_warning" });
        broadcastRoom(room);
        return;
      }
    }

    // Check Void (0)
    if (tile === 0) {
      // Check if moving platform is at this spot
      const onPlatform = room.movingPlatforms.some(p => {
        const dist = Math.hypot(p.current.x - nx, p.current.z - nz);
        return dist < 0.75;
      });
      if (!onPlatform) {
        addMessage(room, "HAZARD: Deep void abyss. Awaiting hover platform.", "bad");
        io.to(room.code).emit("game:sound", { sound: "void_warning" });
        broadcastRoom(room);
        return;
      }
    }

    // Valid move!
    room.position = { x: nx, z: nz };
    io.to(room.code).emit("game:sound", { sound: "step" });

    // Check if stepped on a hidden hazard!
    const hitHazard = room.hazards.find(h => h.x === nx && h.z === nz && !h.triggered);
    if (hitHazard) {
      hitHazard.triggered = true;
      const penalty = hitHazard.severity === "critical" ? 30 : 15;
      room.stability = Math.max(0, room.stability - penalty);

      addMessage(room, `🚨 CRITICAL BREACH: Avatar triggered ${hitHazard.label}! -${penalty}% Stability!`, "bad");
      io.to(room.code).emit("game:event", {
        type: "hazard_triggered",
        hazard: hitHazard,
        stability: room.stability
      });
      io.to(room.code).emit("game:sound", { sound: "glitch_shock" });

      if (room.stability <= 0) {
        room.status = "failed";
        stopGameTimer(room);
        addMessage(room, "DIMENSIONAL OVERLOAD: Dimensional matrix collapsed.", "bad");
      }
    }

    // Check if stepped on a power node
    const steppedNode = room.nodes.find(n => n.x === nx && n.z === nz && !n.active);
    if (steppedNode) {
      addMessage(room, `Avatar reached ${steppedNode.label} terminal. Awaiting Controller activation.`, "info");
    }

    // Check Victory (Exit portal reached)
    if (nx === room.mission.exit.x && nz === room.mission.exit.z) {
      const allNodesOnline = room.nodes.every(n => n.active);
      const allDoorsOpen = room.doors.every(d => d.open);

      if (allNodesOnline && allDoorsOpen) {
        room.status = "won";
        stopGameTimer(room);
        room.score = calculateScore(room);
        addMessage(room, `🎉 REALITY RESTORED! Team completed ${room.mission.name} with score ${room.score}!`, "good");
        io.to(room.code).emit("game:event", {
          type: "mission_won",
          score: room.score,
          timeLeft: room.timeLeft,
          stability: room.stability
        });
        io.to(room.code).emit("game:sound", { sound: "victory" });
      } else {
        addMessage(room, "EXIT INERT: Power nodes or Titan Gate are not yet online.", "bad");
        io.to(room.code).emit("game:sound", { sound: "denied" });
      }
    }

    broadcastRoom(room);
  });

  // Controller activates a Power Node
  socket.on("node:activate", ({ nodeId } = {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "playing") return;

    const player = room.players[socket.id];
    const isHost = socket.id === room.hostSocketId;

    if (!isHost && (!player || player.role !== "controller")) {
      return socket.emit("notice", { type: "error", text: "Only the Controller can activate Quantum Power Nodes." });
    }

    nodeId = Number(nodeId);
    const targetNode = room.nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    if (targetNode.active) {
      return socket.emit("notice", { type: "info", text: `${targetNode.label} is already stabilized.` });
    }

    const expectedNodeId = room.mission.correctSequence[room.sequenceProgress];

    if (nodeId === expectedNodeId) {
      // Correct node in sequence!
      targetNode.active = true;
      room.sequenceProgress += 1;

      addMessage(room, `⚡ ${targetNode.label} ONLINE! Harmonic calibration ${room.sequenceProgress}/3.`, "good");
      io.to(room.code).emit("game:sound", { sound: "node_success" });

      // Check if this node activates a bridge
      room.bridges.forEach(b => {
        if (b.requiredNode === nodeId) {
          b.active = true;
          addMessage(room, `🌉 LIGHT BRIDGE MATERIALIZED across the void!`, "good");
          io.to(room.code).emit("game:sound", { sound: "bridge_online" });
        }
      });

      // Check if all nodes online -> Open Titan Gate
      if (room.sequenceProgress >= room.mission.correctSequence.length) {
        room.doors.forEach(d => {
          if (d.requiresAllNodes) {
            d.open = true;
            addMessage(room, `🔓 TITAN GATE UNSEALED! Exit portal energized!`, "good");
            io.to(room.code).emit("game:sound", { sound: "door_open" });
          }
        });
      }
    } else {
      // WRONG SEQUENCE! Surge overload!
      room.sequenceProgress = 0;
      room.nodes.forEach(n => { n.active = false; });
      room.bridges.forEach(b => { b.active = false; });
      room.doors.forEach(d => { d.open = false; });
      room.stability = Math.max(0, room.stability - 10);

      addMessage(room, `💥 SURGE FAULT: Incorrect node sequence! Breakers tripped. Sequence reset! -10% Stability.`, "bad");
      io.to(room.code).emit("game:event", {
        type: "sequence_error",
        text: "SURGE OVERLOAD: Breakers reset"
      });
      io.to(room.code).emit("game:sound", { sound: "surge_error" });

      if (room.stability <= 0) {
        room.status = "failed";
        stopGameTimer(room);
        addMessage(room, "DIMENSIONAL OVERLOAD: Matrix destroyed by power surges.", "bad");
      }
    }

    broadcastRoom(room);
  });

  // Observer sends a tactical warning ping
  socket.on("observer:alert", ({ alertType, message } = {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "playing") return;

    const player = room.players[socket.id];
    const isHost = socket.id === room.hostSocketId;
    if (!isHost && (!player || player.role !== "observer")) return;

    const label = message || "HAZARD DETECTED AHEAD!";
    addMessage(room, `⚠️ OBSERVER ALERT: ${label}`, "bad", player ? player.name : "OBSERVER");

    io.to(room.code).emit("game:event", {
      type: "observer_warning",
      alertType,
      message: label
    });
    io.to(room.code).emit("game:sound", { sound: "warning_ping" });

    broadcastRoom(room);
  });

  // Navigator sends a tactical waypoint ping
  socket.on("navigator:ping", ({ direction, message } = {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "playing") return;

    const player = room.players[socket.id];
    const isHost = socket.id === room.hostSocketId;
    if (!isHost && (!player || player.role !== "navigator")) return;

    const label = message || `NAVIGATOR: Advance ${direction ? direction.toUpperCase() : "Forward"}`;
    addMessage(room, `🧭 ${label}`, "good", player ? player.name : "NAVIGATOR");

    io.to(room.code).emit("game:event", {
      type: "navigator_ping",
      direction,
      message: label
    });
    io.to(room.code).emit("game:sound", { sound: "nav_ping" });

    broadcastRoom(room);
  });

  // Team chat message
  socket.on("chat:send", ({ text } = {}) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;

    const player = room.players[socket.id];
    const isHost = socket.id === room.hostSocketId;
    const msg = String(text || "").trim().slice(0, 120);
    if (!msg) return;

    const senderName = isHost ? "Mission Control" : (player ? player.name : "Agent");
    const role = isHost ? "host" : (player ? player.role : "unknown");

    addMessage(room, `${senderName}: ${msg}`, "chat", senderName);
    io.to(room.code).emit("game:sound", { sound: "chat" });
    broadcastRoom(room);
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    const code = socket.data.room;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    if (socket.id === room.hostSocketId) {
      console.log(`[Host] Host disconnected from room ${code}`);
      room.hostSocketId = null;
      addMessage(room, "Host screen disconnected.", "bad");
    }

    const player = room.players[socket.id];
    if (player) {
      player.connected = false;
      addMessage(room, `${player.name} (${ROLE_INFO[player.role]?.name || "Player"}) disconnected.`, "bad");
    }

    // If completely empty, clean up after 15 minutes
    const anyConnected = Object.values(room.players).some(p => p.connected) || room.hostSocketId;
    if (!anyConnected) {
      stopGameTimer(room);
      setTimeout(() => {
        const check = rooms.get(code);
        if (check && !Object.values(check.players).some(p => p.connected) && !check.hostSocketId) {
          console.log(`[Clean] Removing idle room ${code}`);
          rooms.delete(code);
        }
      }, 15 * 60 * 1000);
    } else {
      broadcastRoom(room);
    }
  });
});

server.listen(PORT, "0.0.0.0", async () => {
  const shouldAutoTunnel =
    process.argv.includes("--online") ||
    process.argv.includes("--tunnel") ||
    process.env.ONLINE === "true" ||
    process.env.TUNNEL === "true";

  if (shouldAutoTunnel) {
    try {
      console.log(`[Chaos Protocol] Starting automated public online tunnel...`);
      const status = await tunnelManager.startTunnel(PORT);
      if (status && status.url) {
        SERVER_BASE_URL = status.url;
        console.log(`====================================================`);
        console.log(` 🌐 CHAOS PROTOCOL ONLINE TUNNEL IS ACTIVE!`);
        console.log(` Host screen:  http://localhost:${PORT}`);
        console.log(` Online Join:  ${SERVER_BASE_URL}/join`);
        console.log(` Public IP:    ${status.ip || "Ready"}`);
        console.log(` Phones on ANY network (4G/5G, Wi-Fi) can now connect!`);
        console.log(`====================================================`);
        return;
      }
    } catch (e) {
      console.warn(`[Chaos Protocol] Automated tunnel failed: ${e.message}. Using local network IP.`);
    }
  }

  console.log(`====================================================`);
  console.log(` CHAOS PROTOCOL SERVER ONLINE`);
  console.log(` Host screen:  http://localhost:${PORT}`);
  console.log(` Mobile join:  ${SERVER_BASE_URL}/join`);
  console.log(` (To allow phones on 4G/different network, start with --online or click ⚡ GO ONLINE in the browser)`);
  console.log(`====================================================`);
});
