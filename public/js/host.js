import { World3D } from './game3d.js';

(() => {
  const socket = io();
  let world = null;
  let roomCode = null;
  let currentLevelId = 1;
  let lastState = null;
  let isMuted = false;
  let testModeEnabled = false;

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
    testModeToggle: document.getElementById('testModeToggle'),
    testControls: document.getElementById('testControls'),
    resultTitle: document.getElementById('resultTitle'),
    resultScore: document.getElementById('resultScore'),
    resultTime: document.getElementById('resultTime'),
    resultStability: document.getElementById('resultStability'),
    resultBtn: document.getElementById('resultBtn'),
    objBridge: document.getElementById('objBridge'),
    objNodes: document.getElementById('objNodes'),
    objGate: document.getElementById('objGate'),
    soloPlayBtn: document.getElementById('soloPlayBtn'),
    controlsHint: document.getElementById('controlsHint')
  };

  // Initialize 3D Engine
  try {
    world = new World3D(el.canvasContainer);
  } catch (err) {
    console.error("Failed to initialize 3D World:", err);
  }

  // Audio unlock on first interaction
  window.addEventListener('click', () => {
    if (window.sound) window.sound.init();
  }, { once: true });

  // Connect & Create Room
  socket.on('connect', () => {
    console.log("[Host] Connected to server:", socket.id);
    socket.emit('room:create', { hostName: "Mission Control", levelId: currentLevelId });
  });

  socket.on('room:created', async data => {
    roomCode = data.code;
    currentLevelId = data.levelId;
    el.roomCodeDisplay.textContent = roomCode;
    el.roomCodeHeader.textContent = roomCode;
    el.joinUrlDisplay.textContent = data.joinUrl;

    // Fetch QR Code
    try {
      const qrRes = await fetch(`/api/qr?url=${encodeURIComponent(data.joinUrl)}`);
      const qrData = await qrRes.json();
      if (qrData.dataUrl) {
        el.qrImage.src = qrData.dataUrl;
      }
    } catch (e) {
      console.warn("Failed to load QR code image", e);
    }

    // Initialize 3D Level layout
    if (world && data.mission) {
      world.buildLevel(
        data.mission.layout,
        data.mission.bridges,
        data.mission.doors,
        data.mission.nodes,
        data.mission.hazards,
        data.mission.movingPlatforms,
        data.mission.exit
      );
    }
  });

  // Level selector change
  if (el.missionSelect) {
    el.missionSelect.addEventListener('change', e => {
      currentLevelId = Number(e.target.value);
      socket.emit('game:setLevel', { levelId: currentLevelId });
    });
  }

  // Start game button
  el.startBtn.addEventListener('click', () => {
    if (window.sound) window.sound.play('ui');
    socket.emit('game:start');
  });

  // Reset button
  el.resetBtn.addEventListener('click', () => {
    if (window.sound) window.sound.play('ui');
    socket.emit('game:reset');
  });

  el.resultBtn.addEventListener('click', () => {
    if (window.sound) window.sound.play('ui');
    el.resultsOverlay.classList.add('hide');
    socket.emit('game:reset');
  });

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

  // Direct Solo 3D Level Play button
  if (el.soloPlayBtn) {
    el.soloPlayBtn.addEventListener('click', () => {
      testModeEnabled = true;
      if (window.sound) window.sound.play('ui');
      socket.emit('game:start');
      showScreenAlert("3D LEVEL ACTIVE — Move with WASD / Arrows, Press E near a node to activate!", 4000);
    });
  }

  // Keyboard navigation & interaction for 3D gameplay
  window.addEventListener('keydown', e => {
    if (!lastState || lastState.status !== 'playing') return;

    let dx = 0, dz = 0;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dz = -1;
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dz = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;

    if (dx !== 0 || dz !== 0) {
      socket.emit('player:move', { dx, dz });
      return;
    }

    // Activate node with E or Space when adjacent or standing on it
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
      if (lastState && lastState.nodes && lastState.position) {
        const targetNode = lastState.nodes.find(n => 
          Math.abs(n.x - lastState.position.x) + Math.abs(n.z - lastState.position.z) <= 1 && !n.active
        );
        if (targetNode) {
          socket.emit('node:activate', { nodeId: targetNode.id });
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

  document.querySelectorAll('[data-test-node]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nodeId = Number(btn.dataset.testNode);
      socket.emit('node:activate', { nodeId });
    });
  });

  // Server state updates
  socket.on('room:update', state => {
    lastState = state;

    // Update screen state
    if (state.status === 'lobby') {
      el.lobbyOverlay.classList.remove('hide');
      el.resultsOverlay.classList.add('hide');
      if (el.controlsHint) el.controlsHint.classList.add('hide');
    } else {
      el.lobbyOverlay.classList.add('hide');
      if (el.controlsHint && state.status === 'playing') el.controlsHint.classList.remove('hide');
    }

    // Telemetry updates
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
      // If layout just received or changed
      if (state.mapLayout && (!world.tiles || world.tiles.length === 0)) {
        world.buildLevel(
          state.mapLayout,
          state.bridges || [],
          state.doors || [],
          state.nodes || [],
          state.hazards || [],
          state.movingPlatforms || [],
          state.exit || { x: 10, z: 10 }
        );
      }
      world.updateState(state);
    }

    // Update Lobby Player Cards
    renderPlayerSlots(state.players || []);

    // Update Comms Feed
    if (state.messages) {
      el.commsList.innerHTML = state.messages.map(m => {
        return `<div class="comm-entry ${m.kind}">${escapeHtml(m.text)}</div>`;
      }).join('');
      el.commsList.scrollTop = el.commsList.scrollHeight;
    }

    // Results screen trigger
    if (state.status === 'won') {
      showResults(true, state);
    } else if (state.status === 'failed') {
      showResults(false, state);
    }
  });

  // Sound triggers from server
  socket.on('game:sound', ({ sound }) => {
    if (window.sound) window.sound.play(sound);
  });

  // Game events (hazard shockwave, etc)
  socket.on('game:event', evt => {
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
  });

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

    // Enable Start button if players connected or if test mode
    const connectedCount = players.filter(p => p.connected).length;
    el.startBtn.disabled = connectedCount === 0 && !testModeEnabled;
    if (connectedCount === 0 && !testModeEnabled) {
      el.startBtn.textContent = "WAITING FOR PLAYERS (OR ENABLE TEST MODE)";
    } else {
      el.startBtn.textContent = `▶ START MISSION (${connectedCount} READY)`;
    }
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
      el.resultScore.textContent = `FINAL SCORE: ${state.score || 2400}`;
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

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
