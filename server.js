const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

const rooms = new Map();
const ROLE_INFO = {
  navigator: { name: "Navigator", emoji: "🧭", color: "#63d7ff", description: "You can see the exit route. Guide your team with clear directions." },
  observer: { name: "Observer", emoji: "👁️", color: "#ffca68", description: "You can detect hidden hazards near the explorer. Warn them before they move." },
  controller: { name: "Controller", emoji: "⚡", color: "#c4a0ff", description: "You can activate the three power nodes. Find the correct node order with your team." },
  explorer: { name: "Explorer", emoji: "🧑‍🚀", color: "#80f0b1", description: "You move through the maze. Listen to your team and reach the exit." },
  analyst: { name: "Analyst", emoji: "🧩", color: "#ff91bb", description: "You get the code clue. Share it with the Controller." }
};
const BASE_MAP = [
  ["#","#","#","#","#","#","#","#","#","#","#"],
  ["#","S",".","#",".",".",".","#",".",".","#"],
  ["#",".",".","#",".","#",".","#",".","#","#"],
  ["#",".","#","#",".","#",".",".",".",".","#"],
  ["#",".",".",".",".","#","#","#",".","#","#"],
  ["#","#","#",".",".",".","#",".",".",".","#"],
  ["#",".",".",".","#","#",".","#","#",".","#"],
  ["#",".","#",".",".",".",".",".",".",".","#"],
  ["#",".","#","#","#",".","#","#","#",".","#"],
  ["#",".",".",".",".",".",".",".","E",".","#"],
  ["#","#","#","#","#","#","#","#","#","#","#"]
];
function makeRoom(code) {
  return {
    code, players: {}, status: "lobby", map: BASE_MAP.map(r => [...r]),
    position: { x: 1, y: 1 }, nodes: [false,false,false], nodeOrder: [2,0,1],
    startAt: null, timeLeft: 180, interval: null, messages: [],
    mission: "Reconnect the three power nodes, avoid glitches, and guide the Explorer to the exit."
  };
}
function publicPlayers(room) {
  return Object.values(room.players).map(p => ({
    id:p.id, name:p.name, role:p.role, ready:p.ready, connected:true
  }));
}
function emitRoom(room) {
  io.to(room.code).emit("room:update", {
    code: room.code, players: publicPlayers(room), status: room.status,
    position: room.position, nodes: room.nodes, timeLeft: room.timeLeft,
    mission: room.mission, messages: room.messages.slice(-8)
  });
}
function roleFor(room) {
  const used = Object.values(room.players).map(p => p.role);
  const roles = Object.keys(ROLE_INFO);
  return roles.find(r => !used.includes(r)) || roles[Object.values(room.players).length % roles.length];
}
function sendPrivate(room) {
  Object.values(room.players).forEach(p => {
    const role = ROLE_INFO[p.role];
    let privateData = { role: p.role, roleInfo: role };
    if (p.role === "navigator") privateData.route = "From start, head DOWN, DOWN, RIGHT, RIGHT, DOWN, then follow the open corridor toward the exit. Check the main screen for your live position.";
    if (p.role === "observer") privateData.hazard = "GLITCH WARNING: The corridor at row 6, column 5 is unstable. Tell the Explorer to avoid it.";
    if (p.role === "controller") privateData.nodeClue = "POWER ORDER: activate the violet node (3), then the blue node (1), then the amber node (2).";
    if (p.role === "analyst") privateData.codeClue = "ANALYST CLUE: The safe sequence is VIOLET → BLUE → AMBER. Share this with the Controller.";
    if (p.role === "explorer") privateData.moveHint = "Use the arrow buttons to move one tile at a time. Walls block movement.";
    io.to(p.id).emit("player:private", privateData);
  });
}
function addMessage(room, text, kind="info") {
  room.messages.push({ text, kind, at: Date.now() });
  room.messages = room.messages.slice(-20);
}
function startGame(room) {
  room.status = "playing";
  room.position = { x:1, y:1 };
  room.nodes = [false,false,false];
  room.timeLeft = 180;
  addMessage(room, "MISSION STARTED. Share your clues and work as one team.", "good");
  if (room.interval) clearInterval(room.interval);
  room.interval = setInterval(() => {
    if (room.status !== "playing") return;
    room.timeLeft -= 1;
    if (room.timeLeft <= 0) {
      room.timeLeft = 0; room.status = "failed";
      addMessage(room, "TIME EXPIRED. Reset the mission and try a new strategy.", "bad");
      clearInterval(room.interval); room.interval = null;
    }
    emitRoom(room);
  }, 1000);
  sendPrivate(room);
  emitRoom(room);
}
function stopTimer(room) { if (room.interval) clearInterval(room.interval); room.interval = null; }
io.on("connection", socket => {
  socket.on("room:create", ({name}={}) => {
    let code;
    do { code = Math.random().toString(36).slice(2,6).toUpperCase(); } while (rooms.has(code));
    const room = makeRoom(code);
    rooms.set(code, room);
    room.players[socket.id] = { id:socket.id, name:(name||"Host").slice(0,18), role:"navigator", ready:true };
    socket.join(code); socket.data.room = code;
    socket.emit("room:joined", { code, host:true, playerId:socket.id });
    emitRoom(room); sendPrivate(room);
  });
  socket.on("room:join", ({code,name}={}) => {
    code = String(code||"").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit("notice", {type:"error", text:"Room not found. Check the code on the main screen."});
    if (room.status === "playing") return socket.emit("notice", {type:"error", text:"This mission is already running. Join after the host resets it."});
    if (Object.keys(room.players).length >= 8) return socket.emit("notice", {type:"error", text:"This room is full (8 players maximum)."});
    const role = roleFor(room);
    room.players[socket.id] = { id:socket.id, name:(name||"Player").slice(0,18), role, ready:true };
    socket.join(code); socket.data.room = code;
    socket.emit("room:joined", { code, host:false, playerId:socket.id });
    addMessage(room, `${room.players[socket.id].name} joined as ${ROLE_INFO[role].name}.`, "info");
    emitRoom(room); sendPrivate(room);
  });
  socket.on("game:start", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    if (Object.keys(room.players).length < 2) return socket.emit("notice", {type:"error", text:"Invite at least one teammate before starting."});
    startGame(room);
  });
  socket.on("game:reset", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    stopTimer(room); room.status = "lobby"; room.position={x:1,y:1}; room.nodes=[false,false,false]; room.timeLeft=180;
    addMessage(room, "Mission reset. Reassign roles and get ready!", "info");
    emitRoom(room); sendPrivate(room);
  });
  socket.on("player:move", ({dx,dy}={}) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "playing") return;
    const p = room.players[socket.id];
    if (!p || !["explorer","navigator"].includes(p.role)) return socket.emit("notice", {type:"error", text:"Only the Explorer or Navigator can move the player."});
    dx = Math.max(-1,Math.min(1,Number(dx)||0)); dy = Math.max(-1,Math.min(1,Number(dy)||0));
    if (Math.abs(dx)+Math.abs(dy)!==1) return;
    const nx=room.position.x+dx, ny=room.position.y+dy;
    if (!room.map[ny] || room.map[ny][nx] === "#") {
      addMessage(room, "Blocked! A wall is in the way.", "bad");
      emitRoom(room); return;
    }
    room.position={x:nx,y:ny};
    if (nx===8 && ny===9) {
      if (room.nodes.every(Boolean)) {
        room.status="won"; stopTimer(room);
        addMessage(room, "REALITY RESTORED! Your team escaped the dimension!", "good");
      } else addMessage(room, "Exit locked. Activate all three power nodes first.", "bad");
    }
    emitRoom(room);
  });
  socket.on("node:activate", ({node}={}) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "playing") return;
    const p=room.players[socket.id];
    if (!p || !["controller","analyst","navigator"].includes(p.role)) return socket.emit("notice", {type:"error",text:"Your role cannot activate power nodes. Share the clue with the Controller."});
    node=Number(node);
    const order = [2,0,1];
    const next=room.nodes.filter(Boolean).length;
    if (node !== order[next]) {
      room.nodes=[false,false,false];
      addMessage(room, "WRONG NODE! The power sequence reset. Ask the Analyst for the clue.", "bad");
    } else {
      room.nodes[node]=true;
      const labels=["BLUE","AMBER","VIOLET"];
      addMessage(room, `${["BLUE","AMBER","VIOLET"][node]} node activated.`, "good");
      if (room.nodes.every(Boolean)) addMessage(room, "ALL POWER NODES ONLINE. The exit is now unlocked!", "good");
    }
    emitRoom(room);
  });
  socket.on("chat:send", ({text}={}) => {
    const room=rooms.get(socket.data.room);
    if (!room) return;
    const p=room.players[socket.id];
    const msg=String(text||"").trim().slice(0,100);
    if (!p || !msg) return;
    addMessage(room, `${p.name}: ${msg}`, "chat");
    emitRoom(room);
  });
  socket.on("disconnect", () => {
    const code=socket.data.room, room=rooms.get(code);
    if (!room) return;
    const p=room.players[socket.id];
    if (p) addMessage(room, `${p.name} disconnected.`, "bad");
    delete room.players[socket.id];
    if (!Object.keys(room.players).length) { stopTimer(room); rooms.delete(code); }
    else emitRoom(room);
  });
});
server.listen(PORT, "0.0.0.0", () => console.log(`Chaos Protocol running on http://localhost:${PORT}`));
