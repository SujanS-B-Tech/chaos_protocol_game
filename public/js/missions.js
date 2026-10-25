// Client & Host mission definitions for Chaos Protocol

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
    ]
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
    ]
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
    ]
  }
};
