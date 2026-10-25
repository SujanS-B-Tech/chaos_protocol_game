(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const customServer = urlParams.get('server') || localStorage.getItem('chaos_server_url');
  const serverUrl = customServer || window.location.origin;

  // Unified Network Client (Supports Socket.IO and WebRTC PeerJS fallback for Vercel)
  class NetworkClient {
    constructor() {
      this.handlers = new Map();
      this.socket = null;
      this.peer = null;
      this.peerConn = null;
      this.isPeer = false;
      this.connected = false;
      this.pendingQueue = [];
    }

    on(event, fn) {
      if (!this.handlers.has(event)) {
        this.handlers.set(event, []);
      }
      this.handlers.get(event).push(fn);
    }

    emit(event, data = {}) {
      if (this.socket && !this.isPeer && this.connected) {
        this.socket.emit(event, data);
        return;
      }
      if (this.peerConn && this.peerConn.open) {
        this.peerConn.send({ type: event, ...data });
        return;
      }
      this.pendingQueue.push({ event, data });
    }

    trigger(event, data) {
      const fns = this.handlers.get(event) || [];
      fns.forEach(fn => {
        try { fn(data); } catch (e) { console.error("[Network] Handler error:", e); }
      });
    }

    connect(url, targetRoomCode) {
      const isVercel = window.location.hostname.includes('vercel.app');

      // If on Vercel without a custom backend server, skip Socket.IO and connect via WebRTC PeerJS directly
      if (isVercel && !customServer) {
        console.log("[Mobile] Vercel environment detected — connecting via WebRTC PeerJS.");
        this.connectPeer(targetRoomCode);
        return;
      }

      if (typeof io !== 'undefined') {
        try {
          this.socket = io(url, { timeout: 3500, reconnectionAttempts: 2 });

          this.socket.on('connect', () => {
            console.log("[Mobile] Connected via Socket.IO:", this.socket.id);
            this.connected = true;
            this.flushQueue();
          });

          this.socket.on('connect_error', () => {
            console.warn("[Mobile] Socket.IO server unavailable — falling back to WebRTC PeerJS...");
            this.connectPeer(targetRoomCode);
          });

          ['room:joined', 'room:update', 'notice', 'game:sound', 'game:event'].forEach(evt => {
            this.socket.on(evt, data => this.trigger(evt, data));
          });
          return;
        } catch (_) {}
      }

      this.connectPeer(targetRoomCode);
    }

    connectPeer(targetRoomCode) {
      if (this.isPeer && this.peerConn && this.peerConn.open) return;
      this.isPeer = true;

      const code = (targetRoomCode || paramRoom || (el.joinCodeInput ? el.joinCodeInput.value : "")).toUpperCase().trim();
      if (!code) {
        console.warn("[Mobile] No room code available to connect peer.");
        return;
      }

      if (typeof Peer === 'undefined') {
        console.error("[Mobile] PeerJS library not loaded!");
        return;
      }

      const hostPeerId = `chaos-room-${code.toLowerCase()}`;
      console.log(`[Mobile] Connecting to WebRTC Host: ${hostPeerId}`);

      try {
        if (!this.peer) {
          this.peer = new Peer(null, {
            debug: 1,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
              ]
            }
          });

          this.peer.on('open', id => {
            console.log("[Mobile] Client Peer ready:", id);
            this.openDataChannel(hostPeerId);
          });

          this.peer.on('error', err => {
            console.warn("[Mobile] Peer client error:", err);
          });
        } else if (this.peer.open) {
          this.openDataChannel(hostPeerId);
        }
      } catch (e) {
        console.error("[Mobile] Failed to initialize Peer client", e);
      }
    }

    openDataChannel(hostPeerId) {
      if (this.peerConn) {
        try { this.peerConn.close(); } catch (_) {}
      }

      this.peerConn = this.peer.connect(hostPeerId, { reliable: true });

      this.peerConn.on('open', () => {
        console.log("[Mobile] WebRTC DataChannel connected to Host!");
        this.connected = true;
        if (el.headerRoleBadge) {
          el.headerRoleBadge.textContent = "CONNECTED (P2P)";
          el.headerRoleBadge.style.color = "var(--green)";
        }
        this.flushQueue();
      });

      this.peerConn.on('data', data => {
        if (data && data.type) {
          if (data.type === 'room:update') {
            this.trigger('room:update', data.state);
          } else if (data.type === 'room:joined') {
            this.trigger('room:joined', data);
          } else if (data.type === 'notice') {
            this.trigger('notice', data);
          } else if (data.type === 'game:sound') {
            this.trigger('game:sound', data);
          } else if (data.type === 'game:event') {
            this.trigger('game:event', data);
          }
        }
      });

      this.peerConn.on('close', () => {
        console.warn("[Mobile] DataChannel closed");
        this.connected = false;
      });

      this.peerConn.on('error', err => {
        console.warn("[Mobile] DataChannel error:", err);
      });
    }

    flushQueue() {
      while (this.pendingQueue.length > 0) {
        const item = this.pendingQueue.shift();
        this.emit(item.event, item.data);
      }
    }
  }

  const socket = new NetworkClient();

  let roomCode = null;
  let myRole = null;
  let myPlayerId = null;
  let lastState = null;

  // DOM Elements
  const el = {
    joinScreen: document.getElementById('joinScreen'),
    lobbyWaitScreen: document.getElementById('lobbyWaitScreen'),
    gameplayScreen: document.getElementById('gameplayScreen'),
    joinCodeInput: document.getElementById('joinCodeInput'),
    playerNameInput: document.getElementById('playerNameInput'),
    joinBtn: document.getElementById('joinBtn'),
    roleSelectContainer: document.getElementById('roleSelectContainer'),
    headerRoleBadge: document.getElementById('headerRoleBadge'),
    headerRoomCode: document.getElementById('headerRoomCode'),
    timerDisplay: document.getElementById('timerDisplay'),
    stabilityVal: document.getElementById('stabilityVal'),
    roleContainer: document.getElementById('roleContainer'),
    commsFeed: document.getElementById('commsFeed'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    waitMessage: document.getElementById('waitMessage')
  };

  // Pre-fill room code from URL query parameter if present
  const paramRoom = urlParams.get('room');
  if (paramRoom && el.joinCodeInput) {
    el.joinCodeInput.value = paramRoom.toUpperCase().trim();
  }

  // Connect network client
  socket.connect(serverUrl, paramRoom);

  // Haptic feedback utility
  function triggerHaptic(ms = 25) {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(ms);
    }
  }

  // Join Mission
  el.joinBtn.addEventListener('click', () => {
    const code = el.joinCodeInput.value.trim().toUpperCase();
    const name = el.playerNameInput.value.trim() || 'Agent';
    const selectedRoleBtn = document.querySelector('.role-choice-btn.selected');
    const requestedRole = selectedRoleBtn ? selectedRoleBtn.dataset.role : null;

    if (!code || code.length !== 4) {
      alert("Please enter a valid 4-character Room Code.");
      return;
    }

    triggerHaptic(30);
    if (!socket.connected && socket.isPeer) {
      socket.connectPeer(code);
    }
    socket.emit('room:join', { code, name, requestedRole });
  });

  // Role button selector in join screen
  document.querySelectorAll('.role-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      triggerHaptic(15);
    });
  });

  // Successful join
  socket.on('room:joined', data => {
    roomCode = data.code;
    myRole = data.role;
    myPlayerId = data.playerId;

    el.joinScreen.classList.add('hide');
    el.lobbyWaitScreen.classList.remove('hide');
    el.headerRoomCode.textContent = roomCode;

    updateRoleBadge(data.roleInfo);
    if (el.waitMessage) {
      el.waitMessage.textContent = `Assigned as ${data.roleInfo.name}. Waiting for host to launch mission...`;
    }
  });

  socket.on('notice', data => {
    alert(data.text);
  });

  // Server state updates
  socket.on('room:update', state => {
    lastState = state;

    if (state.status === 'lobby') {
      el.lobbyWaitScreen.classList.remove('hide');
      el.gameplayScreen.classList.add('hide');
    } else if (state.status === 'intro' || state.status === 'playing') {
      el.lobbyWaitScreen.classList.add('hide');
      el.gameplayScreen.classList.remove('hide');
    }

    // Update Header
    el.headerRoomCode.textContent = state.code;
    const mins = Math.floor(state.timeLeft / 60);
    const secs = state.timeLeft % 60;
    el.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (state.timeLeft <= 30) {
      el.timerDisplay.classList.add('urgent');
    } else {
      el.timerDisplay.classList.remove('urgent');
    }

    if (el.stabilityVal) {
      el.stabilityVal.textContent = `${state.stability}%`;
    }

    // Render Role-Specific Interface
    renderRoleInterface(state);

    // Update Comms Feed
    if (state.messages && el.commsFeed) {
      el.commsFeed.innerHTML = state.messages.slice(-5).map(m => {
        return `<div class="comm-entry ${m.kind}">${escapeHtml(m.text)}</div>`;
      }).join('');
      el.commsFeed.scrollTop = el.commsFeed.scrollHeight;
    }

    if (state.status === 'won') {
      triggerHaptic([100, 50, 100, 50, 200]);
    } else if (state.status === 'failed') {
      triggerHaptic([200, 100, 200]);
    }
  });

  function updateRoleBadge(roleInfo) {
    if (!roleInfo || !el.headerRoleBadge) return;
    el.headerRoleBadge.textContent = `${roleInfo.icon} ${roleInfo.name.toUpperCase()}`;
    el.headerRoleBadge.style.color = roleInfo.color;
    el.headerRoleBadge.style.borderColor = roleInfo.color;
  }

  // ==========================================
  // RENDER ROLE-SPECIFIC VIEWS
  // ==========================================

  function renderRoleInterface(state) {
    if (!el.roleContainer) return;

    if (state.myRole === 'navigator') {
      renderNavigatorView(state);
    } else if (state.myRole === 'observer') {
      renderObserverView(state);
    } else if (state.myRole === 'controller') {
      renderControllerView(state);
    }
  }

  // 1. NAVIGATOR VIEW
  function renderNavigatorView(state) {
    let radarHtml = '';
    const layout = state.mapLayout || [];
    const height = layout.length;
    const width = layout[0] ? layout[0].length : 12;

    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const type = layout[z][x];
        let tileClass = 'floor';
        let content = '';

        if (type === 2) tileClass = 'wall';
        else if (type === 3) {
          const b = (state.bridges || []).find(br => br.tiles && br.tiles.some(t => t.x === x && t.z === z));
          tileClass = (b && b.active) ? 'bridge active' : 'bridge';
          content = '≍';
        } else if (type === 4) {
          const d = (state.doors || []).find(dr => dr.x === x && dr.z === z);
          tileClass = (d && d.open) ? 'door open' : 'door';
          content = '▥';
        }

        if (state.exit && state.exit.x === x && state.exit.z === z) {
          tileClass = 'exit';
          content = 'EXIT';
        }

        if (state.position && state.position.x === x && state.position.z === z) {
          tileClass += ' avatar-blip';
          content = '▲';
        }

        radarHtml += `<div class="radar-tile ${tileClass}">${content}</div>`;
      }
    }

    el.roleContainer.innerHTML = `
      <div class="m-card">
        <div class="m-card-title">
          <span>🧭 TACTICAL ORBITAL RADAR</span>
          <span style="color:var(--cyan)">SECTOR ${state.position ? state.position.x + '-' + state.position.z : '0-0'}</span>
        </div>
        <div class="radar-map-container">
          ${radarHtml}
        </div>
        <p style="font-size:12px;color:var(--cyan);margin-top:8px;line-height:1.4">
          <b>ROUTE DIRECTIVE:</b> ${escapeHtml(state.routeClue || 'Guide the avatar along open corridors.')}
        </p>
      </div>

      <div class="m-card">
        <div class="m-card-title">
          <span>AVATAR PROPULSION CONTROLS</span>
          <span style="font-size:11px;color:var(--green)">ONLINE</span>
        </div>
        <div class="dpad-container">
          <div class="dpad-blank"></div>
          <button class="dpad-btn" id="dpadUp">▲</button>
          <div class="dpad-blank"></div>
          <button class="dpad-btn" id="dpadLeft">◀</button>
          <button class="dpad-btn" id="dpadDown">▼</button>
          <button class="dpad-btn" id="dpadRight">▶</button>
          <div class="dpad-blank"></div>
          <div class="dpad-blank"></div>
          <div class="dpad-blank"></div>
        </div>
      </div>

      <div class="m-card">
        <div class="m-card-title">TACTICAL WAYPOINT CALLOUTS</div>
        <div class="tactical-pings-grid">
          <button class="ping-btn" data-ping="Advance North">⬆ ADVANCE NORTH</button>
          <button class="ping-btn" data-ping="Turn East">➡ TURN EAST</button>
          <button class="ping-btn" data-ping="Hold Position">✋ HOLD POSITION</button>
          <button class="ping-btn" data-ping="Path Clear">🛡️ PATH CLEAR</button>
        </div>
      </div>
    `;

    // Attach D-Pad listeners
    const bindMove = (btnId, dx, dz) => {
      const b = document.getElementById(btnId);
      if (b) {
        b.onclick = () => {
          triggerHaptic(20);
          socket.emit('player:move', { dx, dz });
        };
      }
    };
    bindMove('dpadUp', 0, -1);
    bindMove('dpadDown', 0, 1);
    bindMove('dpadLeft', -1, 0);
    bindMove('dpadRight', 1, 0);

    // Attach Ping listeners
    document.querySelectorAll('[data-ping]').forEach(btn => {
      btn.onclick = () => {
        triggerHaptic(25);
        socket.emit('navigator:ping', { message: btn.dataset.ping });
      };
    });
  }

  // 2. OBSERVER VIEW
  function renderObserverView(state) {
    const hazards = state.hazards || [];
    const curPos = state.position || { x: 1, z: 1 };

    const hazardListHtml = hazards.map(h => {
      const dist = Math.hypot(h.x - curPos.x, h.z - curPos.z).toFixed(1);
      const isNear = dist < 2.5;
      const severityColor = h.severity === 'critical' ? 'var(--rose)' : 'var(--amber)';
      return `
        <div class="hazard-marker-item ${h.severity === 'critical' ? 'critical' : 'warn'}" style="${isNear ? 'border: 2px solid ' + severityColor + ';' : ''}">
          <div>
            <div style="font-weight:700;font-size:14px;color:${severityColor}">
              ${h.triggered ? '💥 TRIGGERED: ' : '⚠️ '}${escapeHtml(h.label)}
            </div>
            <div style="font-size:12px;color:#94a3b8">
              Coordinates: (${h.x}, ${h.z}) · Severity: ${h.severity.toUpperCase()}
            </div>
          </div>
          <div style="text-align:right">
            <span class="pill ${isNear ? 'bad' : 'warn'}">${dist}m AWAY</span>
          </div>
        </div>
      `;
    }).join('');

    el.roleContainer.innerHTML = `
      <div class="m-card">
        <div class="m-card-title">
          <span>👁️ QUANTUM ANOMALY SENSOR</span>
          <span style="color:var(--amber)">LIVE TELEMETRY</span>
        </div>
        <p style="font-size:13px;color:#cbd5e1;margin-bottom:12px;line-height:1.4">
          <b>SENSOR SCAN:</b> ${escapeHtml(state.hazardSummary || 'Scanning dimensional fractures...')}
        </p>
        <div style="margin-top:10px">
          ${hazardListHtml || '<div style="color:#64748b;font-size:13px">No hazards detected in current sector.</div>'}
        </div>
      </div>

      <div class="m-card">
        <div class="m-card-title">EMERGENCY BROADCAST ALERTS</div>
        <div class="alert-broadcast-group">
          <button class="broadcast-btn urgent" data-alert="HALT! LETHAL HAZARD AHEAD">
            🚨 HALT! LETHAL HAZARD AHEAD
          </button>
          <button class="broadcast-btn warn" data-alert="CAUTION: UNSTABLE MATRIX IN SECTOR">
            ⚠️ CAUTION: UNSTABLE MATRIX IN SECTOR
          </button>
          <button class="broadcast-btn safe" data-alert="SECTOR SCANNED: SAFE TO PROCEED">
            🛡️ SECTOR SCANNED: SAFE TO PROCEED
          </button>
        </div>
      </div>
    `;

    // Attach Alert Broadcast listeners
    document.querySelectorAll('[data-alert]').forEach(btn => {
      btn.onclick = () => {
        triggerHaptic(40);
        socket.emit('observer:alert', { message: btn.dataset.alert });
      };
    });
  }

  // 3. CONTROLLER VIEW
  function renderControllerView(state) {
    const nodes = state.nodes || [];
    const nodesHtml = nodes.map(n => {
      let colorClass = 'cyan';
      if (n.color.includes('c084fc')) colorClass = 'violet';
      else if (n.color.includes('ffca68')) colorClass = 'amber';

      return `
        <div class="node-switch-card ${colorClass} ${n.active ? 'active' : ''}" data-node-id="${n.id}">
          <div>
            <div style="font-family:var(--font-display);font-size:16px;font-weight:800;color:${n.color}">
              ${escapeHtml(n.name)}
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">
              ${n.active ? '⚡ STABILIZED & ONLINE' : '○ DISENGAGED (TAP TO ENGAGE)'}
            </div>
          </div>
          <div class="switch-toggle-disc">
            ${n.active ? '✓' : '⚡'}
          </div>
        </div>
      `;
    }).join('');

    const bridges = state.bridges || [];
    const bridgeActive = bridges.some(b => b.active);
    const doors = state.doors || [];
    const doorOpen = doors.some(d => d.open);

    el.roleContainer.innerHTML = `
      <div class="m-card">
        <div class="m-card-title">
          <span>⚡ QUANTUM POWER MATRIX</span>
          <span style="color:var(--violet)">BREAKER GRID</span>
        </div>
        <p style="font-size:13px;color:#cbd5e1;margin-bottom:12px;line-height:1.4">
          <b>CIRCUIT DIRECTIVE:</b> ${escapeHtml(state.wiringClue || 'Activate nodes in harmonic sequence.')}
        </p>
        <div class="nodes-matrix">
          ${nodesHtml}
        </div>
      </div>

      <div class="m-card">
        <div class="m-card-title">MACHINERY TELEMETRY</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-card);border-radius:8px">
            <span style="font-size:13px;font-weight:700">LIGHT BRIDGE EMITTER:</span>
            <span class="pill ${bridgeActive ? 'active good' : ''}">${bridgeActive ? 'ONLINE (ACTIVE)' : 'OFFLINE (UNPOWERED)'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-card);border-radius:8px">
            <span style="font-size:13px;font-weight:700">TITAN BLAST DOOR:</span>
            <span class="pill ${doorOpen ? 'active good' : 'bad'}">${doorOpen ? 'UNSEALED' : 'LOCKED'}</span>
          </div>
        </div>
      </div>
    `;

    // Attach Node Switch activation listeners
    document.querySelectorAll('[data-node-id]').forEach(card => {
      card.onclick = () => {
        triggerHaptic(30);
        const nodeId = Number(card.dataset.nodeId);
        socket.emit('node:activate', { nodeId });
      };
    });
  }

  // Team Comms Form
  if (el.chatForm) {
    el.chatForm.onsubmit = e => {
      e.preventDefault();
      const text = el.chatInput.value.trim();
      if (text) {
        socket.emit('chat:send', { text });
        el.chatInput.value = '';
        triggerHaptic(15);
      }
    };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
