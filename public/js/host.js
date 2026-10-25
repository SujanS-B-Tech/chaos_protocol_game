import { World3D } from './game3d.js';
import { MISSIONS } from './missions.js';

(() => {
  let world = null;
  let roomCode = Math.random().toString(36).slice(2, 6).toUpperCase();
  let currentLevelId = 1;
  let lastState = null;
  let isMuted = false;
  let isStandalone = false;
  let standaloneTimer = null;
  let standaloneState = null;

  // DOM elements
  const el = {
    canvasContainer: document.getElementById('canvas3d'),
    lobbyOverlay: document.getElementById('lobbyOverlay'),
    resultsOverlay: document.getElementById('resultsOverlay'),
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    roomCodeHeader: document.getElementById('roomCodeHeader'),
    joinUrlDisplay: document.getElementById('joinUrlDisplay'),
    qrImage: document.getElementById('qrImage'),
    roleSlots: document.getElementById('roleSlots'),
    startBtn: document.getElementById('startBtn'),
    missionSelect: document.getElementById('missionSelect'),
    levelNameDisplay: document.getElementById('levelNameDisplay'),
    levelSubtitleDisplay: document.getElementById('levelSubtitleDisplay'),
    timerVal: document.getElementById('timerVal'),
    stabilityVal: document.getElementById('stabilityVal'),
    stabilityBar: document.getElementById('stabilityBar'),
    nodeStatusVal: document.getElementById('nodeStatusVal'),
    commsList: document.getElementById('commsList'),
    screenAlert: document.getElementById('screenAlert'),
    muteBtn: document.getElementById('muteBtn'),
    camModeBtn: document.getElementById('camModeBtn'),
    resetBtn: document.getElementById('resetBtn'),
    testControls: document.getElementById('testControls'),
    resultTitle: document.getElementById('resultTitle'),
    resultScore: document.getElementById('resultScore'),
    resultTime: document.getElementById('resultTime'),
    resultStability: document.getElementById('resultStability'),
    resultBtn: document.getElementById('resultBtn'),
    objBridge: document.getElementById('objBridge'),
    objNodes: document.getElementById('objNodes'),
    objGate: document.getElementById('objGate'),
    objEscape: document.getElementById('objEscape'),
    soloPlayBtn: document.getElementById('soloPlayBtn'),
    controlsHint: document.getElementById('controlsHint'),
    serverStatusBadge: document.getElementById('serverStatusBadge'),
    serverConfigBtn: document.getElementById('serverConfigBtn')
  };

  // 1. IMMEDIATE SETUP: Initialize 3D Engine & Local Level
  try {
    world = new World3D(el.canvasContainer);
    buildCurrentLevel(MISSIONS[currentLevelId]);
  } catch (err) {
    console.error("Failed to initialize 3D World:", err);
  }

  // Pre-populate UI so it NEVER looks empty or broken
  el.roomCodeDisplay.textContent = roomCode;
  el.roomCodeHeader.textContent = roomCode;
  const initialJoinUrl = `${window.location.origin}/join?room=${roomCode}`;
  el.joinUrlDisplay.textContent = initialJoinUrl;

  // Render QR Code immediately via high-speed CDN with SVG fallback
  setQRCode(initialJoinUrl);

  // Render initial role slots immediately
  renderPlayerSlots([]);

  // Audio unlock on first interaction
  window.addEventListener('click', () => {
    if (window.sound) window.sound.init();
  }, { once: true });

  // 2. SOCKET.IO MULTIPLAYER SETUP
  let socket = null;
  const urlParams = new URLSearchParams(window.location.search);
  const customServer = urlParams.get('server') || localStorage.getItem('chaos_server_url');

  // Determine if we should connect socket
  const isVercelHost = window.location.hostname.includes('vercel.app');
  const targetServerUrl = customServer || (!isVercelHost ? window.location.origin : null);

  if (targetServerUrl && typeof io !== 'undefined') {
    connectSocket(targetServerUrl);
  } else {
    // Running in standalone / Vercel mode
    setStandaloneMode(true);
  }

  function connectSocket(serverUrl) {
    try {
      updateServerStatus("CONNECTING TO SERVER...", "warn");
      socket = io(serverUrl, { timeout: 6000, reconnectionAttempts: 4 });

      socket.on('connect', () => {
        console.log("[Host] Connected to server:", socket.id);
        updateServerStatus("● LIVE MULTIPLAYER CONNECTED", "good");
        isStandalone = false;
        socket.emit('room:create', { hostName: "Mission Control", levelId: currentLevelId });
      });

      socket.on('connect_error', (err) => {
        console.warn("[Host] Socket connection failed:", err.message);
        updateServerStatus("● STANDALONE 3D MODE (VERCEL)", "warn");
        setStandaloneMode(true);
      });

      socket.on('room:created', async data => {
        roomCode = data.code;
        currentLevelId = data.levelId;
        el.roomCodeDisplay.textContent = roomCode;
        el.roomCodeHeader.textContent = roomCode;
        el.joinUrlDisplay.textContent = data.joinUrl;

        setQRCode(data.joinUrl);

        if (world && data.mission) {
          buildCurrentLevel(data.mission);
        }
      });

      socket.on('room:update', state => {
        lastState = state;
        applyState(state);
      });

      socket.on('game:sound', ({ sound }) => {
        if (window.sound) window.sound.play(sound);
      });

      socket.on('game:event', evt => {
        handleGameEvent(evt);
      });
    } catch (e) {
      console.warn("Failed to initialize Socket.IO client", e);
      setStandaloneMode(true);
    }
  }

  function setStandaloneMode(active) {
    isStandalone = active;
    if (active) {
      updateServerStatus(isVercelHost ? "● STANDALONE 3D MODE (VERCEL)" : "● LOCAL 3D MODE", "warn");
      el.startBtn.disabled = false;
      el.startBtn.textContent = "▶ START MISSION (SOLO / DEMO)";
    }
  }

  function updateServerStatus(text, type) {
    if (el.serverStatusBadge) {
      el.serverStatusBadge.textContent = text;
      el.serverStatusBadge.className = `pill ${type}`;
    }
  }

  function setQRCode(url) {
    // Primary: free fast QR API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&color=00f0ff&bgcolor=0b1220&data=${encodeURIComponent(url)}`;
    el.qrImage.src = qrUrl;

    // Fallback if image fails to load
    el.qrImage.onerror = () => {
      // Inline SVG QR code icon fallback
      el.qrImage.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 24 24' fill='none' stroke='%2300f0ff' stroke-width='1.5'><rect x='3' y='3' width='7' height='7'/><rect x='14' y='3' width='7' height='7'/><rect x='3' y='14' width='7' height='7'/><rect x='14' y='14' width='7' height='7'/></svg>";
    };

    // If local server provides /api/qr, fetch data URL in background
    if (!isStandalone) {
      fetch(`/api/qr?url=${encodeURIComponent(url)}`)
        .then(r => r.json())
        .then(d => { if (d && d.dataUrl) el.qrImage.src = d.dataUrl; })
        .catch(() => {});
    }
  }

  function buildCurrentLevel(missionDef) {
    if (!world || !missionDef) return;
    world.buildLevel(
      missionDef.layout,
      missionDef.bridges,
      missionDef.doors,
      missionDef.nodes,
      missionDef.hazards,
      missionDef.movingPlatforms,
      missionDef.exit
    );
  }

  // 3. STANDALONE 3D GAME STATE ENGINE (Works 100% on Vercel without a backend!)
  function initStandaloneGame() {
    const mission = MISSIONS[currentLevelId];
    standaloneState = {
      code: roomCode,
      status: "playing",
      levelId: currentLevelId,
      position: { ...mission.start },
      facing: "south",
      stability: 100,
      timeLeft: mission.timeLimit,
      nodes: mission.nodes.map(n => ({ ...n, active: false })),
      bridges: mission.bridges.map(b => ({ ...b, active: false })),
      doors: mission.doors.map(d => ({ ...d, open: false })),
      hazards: mission.hazards.map(h => ({ ...h, triggered: false })),
      movingPlatforms: mission.movingPlatforms.map(p => ({ ...p })),
      sequenceProgress: 0,
      score: 0,
      messages: [
        { text: `Mission ${mission.name} initialized. Explore and restore power!`, kind: "good" }
      ]
    };

    lastState = standaloneState;
    applyState(standaloneState);

    if (standaloneTimer) clearInterval(standaloneTimer);
    standaloneTimer = setInterval(() => {
      if (!standaloneState || standaloneState.status !== "playing") return;
      standaloneState.timeLeft -= 1;
      if (standaloneState.timeLeft <= 0) {
        standaloneState.timeLeft = 0;
        standaloneState.status = "failed";
        clearInterval(standaloneTimer);
        showResults(false, standaloneState);
      }
      applyState(standaloneState);
    }, 1000);
  }

  function moveStandaloneAvatar(dx, dz) {
    if (!standaloneState || standaloneState.status !== "playing") return;
    const mission = MISSIONS[currentLevelId];
    const nx = standaloneState.position.x + dx;
    const nz = standaloneState.position.z + dz;

    // Bounds check
    if (nx < 0 || nx >= mission.mapSize.width || nz < 0 || nz >= mission.mapSize.height) return;

    const tile = mission.layout[nz][nx];

    // Wall collision
    if (tile === 2) {
      if (window.sound) window.sound.play("bump");
      return;
    }

    // Door collision
    if (tile === 4) {
      const door = standaloneState.doors.find(d => d.x === nx && d.z === nz);
      if (door && !door.open) {
        if (window.sound) window.sound.play("denied");
        showScreenAlert("TITAN GATE LOCKED: Synchronize all 3 Quantum Nodes first!", 2500);
        return;
      }
    }

    // Bridge collision
    if (tile === 3) {
      const bridge = standaloneState.bridges.find(b => b.tiles.some(t => t.x === nx && t.z === nz));
      if (bridge && !bridge.active) {
        if (window.sound) window.sound.play("denied");
        showScreenAlert("LIGHT BRIDGE OFFLINE: Activate Beta Conduit (Amber) first!", 2500);
        return;
      }
    }

    // Void collision
    if (tile === 0) {
      if (window.sound) window.sound.play("denied");
      return;
    }

    // Valid move!
    standaloneState.position = { x: nx, z: nz };
    if (window.sound) window.sound.play("step");

    // Check hazards
    const hitHazard = standaloneState.hazards.find(h => h.x === nx && h.z === nz && !h.triggered);
    if (hitHazard) {
      hitHazard.triggered = true;
      standaloneState.stability = Math.max(0, standaloneState.stability - 20);
      if (world) world.triggerScreenShake(0.5);
      if (window.sound) window.sound.play("glitch_shock");
      showScreenAlert(`🚨 CRITICAL HAZARD: ${hitHazard.label}! -20% Stability!`, 3000);
      if (standaloneState.stability <= 0) {
        standaloneState.status = "failed";
        clearInterval(standaloneTimer);
        showResults(false, standaloneState);
      }
    }

    // Check victory
    if (nx === mission.exit.x && nz === mission.exit.z) {
      const allNodesOnline = standaloneState.nodes.every(n => n.active);
      const allDoorsOpen = standaloneState.doors.every(d => d.open);
      if (allNodesOnline && allDoorsOpen) {
        standaloneState.status = "won";
        clearInterval(standaloneTimer);
        standaloneState.score = 2500 + standaloneState.timeLeft * 20 + standaloneState.stability * 10;
        if (window.sound) window.sound.play("victory");
        showResults(true, standaloneState);
      } else {
        if (window.sound) window.sound.play("denied");
        showScreenAlert("EXIT INERT: Restore all nodes and Titan Gate first!", 2500);
      }
    }

    applyState(standaloneState);
  }

  function activateStandaloneNode(nodeId) {
    if (!standaloneState || standaloneState.status !== "playing") return;
    const mission = MISSIONS[currentLevelId];
    const node = standaloneState.nodes.find(n => n.id === nodeId);
    if (!node || node.active) return;

    const expectedNode = mission.correctSequence[standaloneState.sequenceProgress];

    if (nodeId === expectedNode) {
      node.active = true;
      standaloneState.sequenceProgress += 1;
      if (window.sound) window.sound.play("node_success");
      showScreenAlert(`⚡ ${node.label} STABILIZED! (${standaloneState.sequenceProgress}/3)`, 2500);

      // Deploy Bridge
      standaloneState.bridges.forEach(b => {
        if (b.requiredNode === nodeId) {
          b.active = true;
          if (window.sound) window.sound.play("bridge_online");
          showScreenAlert("🌉 LIGHT BRIDGE MATERIALIZED ACROSS VOID!", 3000);
        }
      });

      // Unseal Titan Gate
      if (standaloneState.sequenceProgress >= mission.correctSequence.length) {
        standaloneState.doors.forEach(d => {
          if (d.requiresAllNodes) {
            d.open = true;
            if (window.sound) window.sound.play("door_open");
            showScreenAlert("🔓 TITAN GATE UNSEALED! Exit Portal energized!", 3500);
          }
        });
      }
    } else {
      // Wrong sequence
      standaloneState.sequenceProgress = 0;
      standaloneState.nodes.forEach(n => { n.active = false; });
      standaloneState.bridges.forEach(b => { b.active = false; });
      standaloneState.doors.forEach(d => { d.open = false; });
      standaloneState.stability = Math.max(0, standaloneState.stability - 10);
      if (world) world.triggerScreenShake(0.35);
      if (window.sound) window.sound.play("surge_error");
      showScreenAlert("💥 SURGE ERROR: Wrong node sequence! Breakers reset. -10% Stability", 3500);
    }

    applyState(standaloneState);
  }

  // 4. UI & TELEMETRY UPDATES
  function applyState(state) {
    if (!state) return;

    if (state.status === 'lobby') {
      el.lobbyOverlay.classList.remove('hide');
      el.resultsOverlay.classList.add('hide');
      if (el.controlsHint) el.controlsHint.classList.add('hide');
    } else {
      el.lobbyOverlay.classList.add('hide');
      if (el.controlsHint && state.status === 'playing') el.controlsHint.classList.remove('hide');
    }

    const mins = Math.floor(state.timeLeft / 60);
    const secs = state.timeLeft % 60;
    el.timerVal.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (state.timeLeft <= 30 && state.status === 'playing') {
      el.timerVal.classList.add('urgent');
    } else {
      el.timerVal.classList.remove('urgent');
    }

    el.stabilityVal.textContent = `${state.stability}%`;
    el.stabilityBar.style.width = `${state.stability}%`;

    const activeNodes = (state.nodes || []).filter(n => n.active).length;
    el.nodeStatusVal.textContent = `${activeNodes} / 3`;

    // Objectives check
    const bridgeActive = (state.bridges || []).some(b => b.active);
    const gateOpen = (state.doors || []).some(d => d.open);

    if (el.objBridge) el.objBridge.classList.toggle('done', bridgeActive);
    if (el.objNodes) el.objNodes.classList.toggle('done', activeNodes === 3);
    if (el.objGate) el.objGate.classList.toggle('done', gateOpen);

    // Update 3D World
    if (world) {
      world.updateState(state);
    }

    // Update Comms Feed
    if (state.messages) {
      el.commsList.innerHTML = state.messages.map(m => {
        return `<div class="comm-entry ${m.kind || ''}">${escapeHtml(m.text)}</div>`;
      }).join('');
      el.commsList.scrollTop = el.commsList.scrollHeight;
    }

    if (state.status === 'won') {
      showResults(true, state);
    } else if (state.status === 'failed') {
      showResults(false, state);
    }
  }

  // 5. EVENT LISTENERS & USER CONTROLS
  if (el.soloPlayBtn) {
    el.soloPlayBtn.addEventListener('click', () => {
      if (window.sound) window.sound.play('ui');
      if (socket && !isStandalone) {
        socket.emit('game:start');
      } else {
        initStandaloneGame();
      }
      showScreenAlert("3D LEVEL ACTIVE — Move with WASD / Arrows, Press E near a node to activate!", 4000);
    });
  }

  el.startBtn.addEventListener('click', () => {
    if (window.sound) window.sound.play('ui');
    if (socket && !isStandalone) {
      socket.emit('game:start');
    } else {
      initStandaloneGame();
    }
  });

  el.resetBtn.addEventListener('click', () => {
    if (window.sound) window.sound.play('ui');
    if (socket && !isStandalone) {
      socket.emit('game:reset');
    } else {
      if (standaloneTimer) clearInterval(standaloneTimer);
      el.lobbyOverlay.classList.remove('hide');
      el.resultsOverlay.classList.add('hide');
      buildCurrentLevel(MISSIONS[currentLevelId]);
    }
  });

  el.resultBtn.addEventListener('click', () => {
    if (window.sound) window.sound.play('ui');
    el.resultsOverlay.classList.add('hide');
    if (socket && !isStandalone) {
      socket.emit('game:reset');
    } else {
      el.lobbyOverlay.classList.remove('hide');
      buildCurrentLevel(MISSIONS[currentLevelId]);
    }
  });

  // Level selector
  if (el.missionSelect) {
    el.missionSelect.addEventListener('change', e => {
      currentLevelId = Number(e.target.value);
      buildCurrentLevel(MISSIONS[currentLevelId]);
      if (socket && !isStandalone) {
        socket.emit('game:setLevel', { levelId: currentLevelId });
      }
    });
  }

  // Camera Mode Toggle
  const cameraModes = ['tactical', 'chase', 'orbit'];
  let currentCamIdx = 0;
  el.camModeBtn.addEventListener('click', () => {
    currentCamIdx = (currentCamIdx + 1) % cameraModes.length;
    const mode = cameraModes[currentCamIdx];
    if (world) world.setCameraMode(mode);
    el.camModeBtn.textContent = `CAM: ${mode.toUpperCase()}`;
    if (window.sound) window.sound.play('ui');
  });

  // Audio Mute Toggle
  el.muteBtn.addEventListener('click', () => {
    if (window.sound) {
      isMuted = window.sound.toggleMute();
      el.muteBtn.textContent = isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO';
      el.muteBtn.style.color = isMuted ? '#f43f5e' : '#f1f5f9';
    }
  });

  // Keyboard navigation & interaction
  window.addEventListener('keydown', e => {
    if (!lastState || lastState.status !== 'playing') return;

    let dx = 0, dz = 0;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dz = -1;
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dz = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;

    if (dx !== 0 || dz !== 0) {
      if (socket && !isStandalone) {
        socket.emit('player:move', { dx, dz });
      } else {
        moveStandaloneAvatar(dx, dz);
      }
      return;
    }

    // Node interaction via E or Space
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
      if (lastState && lastState.nodes && lastState.position) {
        const targetNode = lastState.nodes.find(n => 
          Math.abs(n.x - lastState.position.x) + Math.abs(n.z - lastState.position.z) <= 1 && !n.active
        );
        if (targetNode) {
          if (socket && !isStandalone) {
            socket.emit('node:activate', { nodeId: targetNode.id });
          } else {
            activateStandaloneNode(targetNode.id);
          }
        }
      }
    } else if (e.key === 'c' || e.key === 'C') {
      currentCamIdx = (currentCamIdx + 1) % cameraModes.length;
      const mode = cameraModes[currentCamIdx];
      if (world) world.setCameraMode(mode);
      el.camModeBtn.textContent = `CAM: ${mode.toUpperCase()}`;
    } else if (e.key === 'm' || e.key === 'M') {
      if (window.sound) {
        isMuted = window.sound.toggleMute();
        el.muteBtn.textContent = isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO';
        el.muteBtn.style.color = isMuted ? '#f43f5e' : '#f1f5f9';
      }
    }
  });

  // Quick test node buttons
  document.querySelectorAll('[data-test-node]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nodeId = Number(btn.dataset.testNode);
      if (socket && !isStandalone) {
        socket.emit('node:activate', { nodeId });
      } else {
        activateStandaloneNode(nodeId);
      }
    });
  });

  // Server URL Configuration modal
  if (el.serverConfigBtn) {
    el.serverConfigBtn.addEventListener('click', () => {
      const current = localStorage.getItem('chaos_server_url') || "";
      const input = prompt("Enter persistent multiplayer server URL (e.g., https://chaos-protocol.onrender.com):", current);
      if (input !== null) {
        if (input.trim()) {
          localStorage.setItem('chaos_server_url', input.trim().replace(/\/$/, ""));
          window.location.reload();
        } else {
          localStorage.removeItem('chaos_server_url');
          window.location.reload();
        }
      }
    });
  }

  function renderPlayerSlots(players) {
    const roles = [
      { id: "navigator", name: "Navigator", icon: "🧭", color: "#00f0ff", desc: "Pathfinder & Waypoint Guidance" },
      { id: "observer", name: "Observer", icon: "👁️", color: "#ffca68", desc: "Hazard Sensor Telemetry" },
      { id: "controller", name: "Controller", icon: "⚡", color: "#c084fc", desc: "Quantum Grid & Bridge Controls" }
    ];

    el.roleSlots.innerHTML = roles.map(r => {
      const assigned = players.find(p => p.role === r.id && p.connected);
      const isConnected = !!assigned;
      return `
        <div class="role-slot-card ${isConnected ? 'connected' : ''}">
          <div class="role-slot-left">
            <div class="role-badge-icon" style="color: ${r.color}; border-color: ${isConnected ? r.color : 'var(--border-line)'}">
              ${r.icon}
            </div>
            <div>
              <div class="role-slot-name" style="color: ${r.color}">${r.name}</div>
              <div class="role-slot-desc">${r.desc}</div>
            </div>
          </div>
          <div>
            ${isConnected
              ? `<span class="pill good">● READY: ${escapeHtml(assigned.name)}</span>`
              : `<span class="pill">WAITING FOR PHONE...</span>`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  function showScreenAlert(text, duration = 3000) {
    el.screenAlert.textContent = text;
    el.screenAlert.classList.remove('hide');
    clearTimeout(showScreenAlert._t);
    showScreenAlert._t = setTimeout(() => {
      el.screenAlert.classList.add('hide');
    }, duration);
  }

  function showResults(won, state) {
    el.resultsOverlay.classList.remove('hide');
    if (won) {
      el.resultTitle.textContent = "DIMENSION ESCAPED — VICTORY!";
      el.resultTitle.style.color = "var(--green)";
      el.resultScore.textContent = `FINAL SCORE: ${state.score || 2500}`;
      el.resultTime.textContent = `TIME REMAINING: ${state.timeLeft}s`;
      el.resultStability.textContent = `DIMENSION STABILITY: ${state.stability}%`;
    } else {
      el.resultTitle.textContent = "DIMENSIONAL OVERLOAD — MISSION FAILED";
      el.resultTitle.style.color = "var(--rose)";
      el.resultScore.textContent = "SCORE: 0";
      el.resultTime.textContent = `TIME EXPIRED OR COLLAPSED`;
      el.resultStability.textContent = `STABILITY: ${state.stability}%`;
    }
  }

  function handleGameEvent(evt) {
    if (evt.type === 'hazard_triggered') {
      if (world) world.triggerScreenShake(0.5);
      showScreenAlert(`🚨 CRITICAL HAZARD: ${evt.hazard.label}! -Stability!`, 3000);
    } else if (evt.type === 'sequence_error') {
      if (world) world.triggerScreenShake(0.3);
      showScreenAlert(`💥 SURGE ERROR: Incorrect node sequence! Breakers reset!`, 3500);
    } else if (evt.type === 'observer_warning') {
      showScreenAlert(`⚠️ OBSERVER WARNING: ${evt.message}`, 4000);
    } else if (evt.type === 'navigator_ping') {
      showScreenAlert(`🧭 NAVIGATOR: ${evt.message}`, 2500);
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
