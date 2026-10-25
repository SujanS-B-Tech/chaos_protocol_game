// Client & Host mission definitions for Chaos Protocol

export const ROLE_INFO = {
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

export const MISSIONS = {
  1: {
    id: 1,
    name: "THE FRACTURED GATE",
    subtitle: "Sector 7-Alpha Orbital Breach",
    description: "Restore power to the breached orbital conduit, deploy the energy bridge across the void, and breach the Titan Gate before dimensional collapse.",
    timeLimit: 180,
    mapSize: { width: 12, height: 12 },
    start: { x: 1, z: 1 },
    exit: { x: 10, z: 10 },
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
    bridges: [
      { id: "bridge-1", tiles: [{ x: 3, z: 5 }, { x: 4, z: 5 }], active: false, requiredNode: 1 }
    ],
    doors: [
      { id: "door-1", x: 9, z: 9, open: false, requiresAllNodes: true }
    ],
    movingPlatforms: [
      { id: "platform-1", start: { x: 7, z: 3 }, end: { x: 8, z: 4 }, speed: 0.03, current: { x: 7, z: 3 } }
    ],
    nodes: [
      { id: 0, name: "ALPHA RELAY", color: "#00f0ff", x: 1, z: 8, active: false, label: "Cyan Node" },
      { id: 1, name: "BETA CONDUIT", color: "#ffca68", x: 8, z: 2, active: false, label: "Amber Node" },
      { id: 2, name: "QUANTUM RELAY", color: "#c084fc", x: 4, z: 10, active: false, label: "Violet Node" }
    ],
    correctSequence: [2, 0, 1],
    hazards: [
      { id: "h1", x: 2, z: 4, type: "quantum_glitch", label: "Quantum Glitch", severity: "high", triggered: false },
      { id: "h2", x: 5, z: 8, type: "unstable_core", label: "Unstable Subfloor", severity: "critical", triggered: false },
      { id: "h3", x: 8, z: 7, type: "laser_sensor", label: "Laser Tripwire", severity: "medium", triggered: false },
      { id: "h4", x: 10, z: 3, type: "quantum_glitch", label: "Phase Rift", severity: "high", triggered: false },
      { id: "h5", x: 7, z: 10, type: "unstable_core", label: "Void Sinkhole", severity: "critical", triggered: false }
    ],
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
    correctSequence: [1, 2, 0],
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
