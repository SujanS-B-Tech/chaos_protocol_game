const io = require("socket.io-client");

const SERVER_URL = "http://localhost:3000";

async function runIntegrationTest() {
  console.log("=== STARTING CHAOS PROTOCOL MULTIPLAYER INTEGRATION TEST ===");

  // 1. Connect Host
  const hostSocket = io(SERVER_URL);
  let roomCode = null;

  await new Promise((resolve, reject) => {
    hostSocket.on("connect", () => {
      console.log("✔ Host connected to server");
      hostSocket.emit("room:create", { hostName: "Mission Control", levelId: 1 });
    });

    hostSocket.on("room:created", data => {
      roomCode = data.code;
      console.log(`✔ Room created successfully. Code: ${roomCode}`);
      console.log(`✔ QR Join URL: ${data.joinUrl}`);
      resolve();
    });

    setTimeout(() => reject(new Error("Host room creation timed out")), 5000);
  });

  // 2. Connect Navigator
  const navSocket = io(SERVER_URL);
  let navIntel = null;

  await new Promise((resolve, reject) => {
    navSocket.on("connect", () => {
      navSocket.emit("room:join", { code: roomCode, name: "Alpha-Lead", requestedRole: "navigator" });
    });

    navSocket.on("room:joined", data => {
      console.log(`✔ Navigator joined: ${data.name} as ${data.role}`);
      if (data.role !== "navigator") reject(new Error("Wrong role assigned to Navigator"));
    });

    navSocket.on("room:update", state => {
      if (state.myRole === "navigator") {
        navIntel = state;
        resolve();
      }
    });

    setTimeout(() => reject(new Error("Navigator join timed out")), 5000);
  });

  // 3. Connect Observer
  const obsSocket = io(SERVER_URL);
  let obsIntel = null;

  await new Promise((resolve, reject) => {
    obsSocket.on("connect", () => {
      obsSocket.emit("room:join", { code: roomCode, name: "Sensors-Echo", requestedRole: "observer" });
    });

    obsSocket.on("room:joined", data => {
      console.log(`✔ Observer joined: ${data.name} as ${data.role}`);
      if (data.role !== "observer") reject(new Error("Wrong role assigned to Observer"));
    });

    obsSocket.on("room:update", state => {
      if (state.myRole === "observer") {
        obsIntel = state;
        resolve();
      }
    });

    setTimeout(() => reject(new Error("Observer join timed out")), 5000);
  });

  // 4. Connect Controller
  const ctlSocket = io(SERVER_URL);
  let ctlIntel = null;

  await new Promise((resolve, reject) => {
    ctlSocket.on("connect", () => {
      ctlSocket.emit("room:join", { code: roomCode, name: "Grid-Tango", requestedRole: "controller" });
    });

    ctlSocket.on("room:joined", data => {
      console.log(`✔ Controller joined: ${data.name} as ${data.role}`);
      if (data.role !== "controller") reject(new Error("Wrong role assigned to Controller"));
    });

    ctlSocket.on("room:update", state => {
      if (state.myRole === "controller") {
        ctlIntel = state;
        resolve();
      }
    });

    setTimeout(() => reject(new Error("Controller join timed out")), 5000);
  });

  // 5. Verify Server-Enforced Role Privacy
  console.log("\n--- VERIFYING SERVER-ENFORCED ROLE PRIVACY ---");
  if (navIntel.hazards !== undefined) {
    throw new Error("SECURITY FAULT: Hidden hazards leaked to Navigator!");
  } else {
    console.log("✔ Navigator PRIVACY VERIFIED: Hidden hazards are safely redacted by server.");
  }

  if (obsIntel.mapLayout !== undefined) {
    throw new Error("SECURITY FAULT: Full map layout leaked to Observer!");
  } else {
    console.log("✔ Observer PRIVACY VERIFIED: Full map layout is safely redacted by server.");
  }

  if (ctlIntel.mapLayout !== undefined) {
    throw new Error("SECURITY FAULT: Full map layout leaked to Controller!");
  } else {
    console.log("✔ Controller PRIVACY VERIFIED: Route map is safely redacted by server.");
  }

  // 6. Start Mission
  console.log("\n--- LAUNCHING MISSION ---");
  await new Promise(resolve => {
    hostSocket.emit("game:start");
    hostSocket.on("room:update", state => {
      if (state.status === "intro" || state.status === "playing") {
        console.log(`✔ Mission status changed to: ${state.status}`);
        resolve();
      }
    });
  });

  // Wait for intro transition (2.5s) to playing state
  console.log("Waiting for dimensional link stabilization...");
  await new Promise(resolve => {
    const handler = state => {
      if (state.status === "playing") {
        console.log("✔ Mission is actively PLAYING!");
        hostSocket.off("room:update", handler);
        resolve();
      }
    };
    hostSocket.on("room:update", handler);
  });

  // 7. Observer broadcasts hazard alert
  console.log("\n--- TESTING TACTICAL ALERTS ---");
  obsSocket.emit("observer:alert", { message: "HALT! ANOMALY AT SECTOR (2,4)" });

  // 8. Controller activates nodes in correct sequence (Violet 2 -> Cyan 0 -> Amber 1)
  console.log("\n--- TESTING QUANTUM POWER NODES ---");
  
  // Step 1: Violet (2)
  ctlSocket.emit("node:activate", { nodeId: 2 });
  await new Promise(r => setTimeout(r, 400));

  // Step 2: Cyan (0)
  ctlSocket.emit("node:activate", { nodeId: 0 });
  await new Promise(r => setTimeout(r, 400));

  // Step 3: Amber (1)
  ctlSocket.emit("node:activate", { nodeId: 1 });
  await new Promise(r => setTimeout(r, 500));

  // Verify all 3 nodes, bridge and titan gate
  let lastHostState = null;
  await new Promise(resolve => {
    hostSocket.on("room:update", state => {
      lastHostState = state;
      const allActive = (state.nodes || []).every(n => n.active);
      const bridgeActive = (state.bridges || []).some(b => b.active);
      const doorOpen = (state.doors || []).some(d => d.open);
      if (allActive && bridgeActive && doorOpen) {
        console.log("✔ All 3 Quantum Power Nodes successfully activated in sequence!");
        console.log("✔ Energy Bridge successfully deployed across void!");
        console.log("✔ Titan Blast Gate unsealed!");
        resolve();
      }
    });
  });

  // 9. Navigator moves avatar through the level to Exit Portal
  console.log("\n--- TESTING NAVIGATOR MOVEMENT ---");
  // Route from (1,1) to exit (10, 10):
  // (1,1) -> down to (1,5) -> across bridge to (5,5) -> down/east through Titan Gate at (9,9) -> (10,10)
  const moves = [
    // Down to (1,5)
    { dx: 0, dz: 1 }, { dx: 0, dz: 1 }, { dx: 0, dz: 1 }, { dx: 0, dz: 1 },
    // Right across bridge (3,5) and (4,5) to (5,5)
    { dx: 1, dz: 0 }, { dx: 1, dz: 0 }, { dx: 1, dz: 0 }, { dx: 1, dz: 0 },
    // Down to (5,7)
    { dx: 0, dz: 1 }, { dx: 0, dz: 1 },
    // Right to (8,7)
    { dx: 1, dz: 0 }, { dx: 1, dz: 0 }, { dx: 1, dz: 0 },
    // Down to (8,8)
    { dx: 0, dz: 1 },
    // Right to (9,8)
    { dx: 1, dz: 0 },
    // Down to (9,9) through the unsealed Titan Gate!
    { dx: 0, dz: 1 },
    // Down to (9,10)
    { dx: 0, dz: 1 },
    // Right to (10,10) EXIT PORTAL!
    { dx: 1, dz: 0 }
  ];

  for (const m of moves) {
    navSocket.emit("player:move", m);
    await new Promise(r => setTimeout(r, 120));
  }

  // 10. Verify Victory Condition
  await new Promise((resolve, reject) => {
    const victoryHandler = state => {
      if (state.status === "won") {
        console.log("\n========================================================");
        console.log("🎉 MISSION VICTORY VERIFIED!");
        console.log(`Final Team Score: ${state.score}`);
        console.log(`Remaining Stability: ${state.stability}%`);
        console.log(`Time Left: ${state.timeLeft}s`);
        console.log("========================================================");
        hostSocket.off("room:update", victoryHandler);
        resolve();
      }
    };
    hostSocket.on("room:update", victoryHandler);
    setTimeout(() => {
      if (lastHostState && lastHostState.status !== "won") {
        reject(new Error(`Mission did not reach 'won' status. Current position: (${lastHostState.position.x}, ${lastHostState.position.z}), status: ${lastHostState.status}`));
      } else {
        resolve();
      }
    }, 6000);
  });

  // Clean disconnect
  hostSocket.disconnect();
  navSocket.disconnect();
  obsSocket.disconnect();
  ctlSocket.disconnect();
  console.log("\n✔ ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!");
  process.exit(0);
}

runIntegrationTest().catch(err => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
