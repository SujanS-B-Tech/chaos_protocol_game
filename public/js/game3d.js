import * as THREE from '/vendor/three/build/three.module.js';

export class World3D {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animId = null;

    // Entities
    this.avatar = null;
    this.avatarTargetPos = new THREE.Vector3(1, 0.4, 1);
    this.avatarLight = null;
    this.avatarThruster = null;
    this.portal = null;
    this.bridges = new Map(); // id -> THREE.Group
    this.doors = new Map();   // id -> THREE.Group
    this.nodes = new Map();   // id -> THREE.Group
    this.hazards = new Map(); // id -> THREE.Group
    this.movingPlatforms = new Map(); // id -> THREE.Mesh
    this.tiles = [];
    this.dustParticles = null;

    // Camera modes: 'tactical' (default 45 deg isometric), 'chase', 'orbit'
    this.cameraMode = 'tactical';
    this.cameraOffset = new THREE.Vector3(8, 14, 12);
    this.cameraTarget = new THREE.Vector3(1, 0, 1);
    this.orbitAngle = 0;
    this.shakeIntensity = 0;

    // Materials cache for performance
    this.materials = {};

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Scene with dark void fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050811);
    this.scene.fog = new THREE.FogExp2(0x050811, 0.035);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(10, 16, 14);
    this.camera.lookAt(1, 0, 1);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.createMaterials();
    this.createVoidEnvironment();
    this.createAvatar();

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  setupLighting() {
    // Ambient soft fill
    const ambientLight = new THREE.AmbientLight(0x162035, 1.2);
    this.scene.add(ambientLight);

    // Main directional key light
    const dirLight = new THREE.DirectionalLight(0x82b4ff, 2.0);
    dirLight.position.set(15, 25, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -16;
    dirLight.shadow.camera.right = 16;
    dirLight.shadow.camera.top = 16;
    dirLight.shadow.camera.bottom = -16;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Rim / secondary accent light
    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.9);
    rimLight.position.set(-15, 10, -15);
    this.scene.add(rimLight);
  }

  createMaterials() {
    // Procedural metallic dark obsidian floor tile
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#0d1424';
    fctx.fillRect(0, 0, 256, 256);
    // Subtle sci-fi border & seams
    fctx.strokeStyle = '#1a2744';
    fctx.lineWidth = 6;
    fctx.strokeRect(4, 4, 248, 248);
    fctx.strokeStyle = '#0f182e';
    fctx.lineWidth = 2;
    fctx.strokeRect(16, 16, 224, 224);
    // Corner circuit markers
    fctx.fillStyle = '#00f0ff';
    fctx.fillRect(6, 6, 8, 8);
    fctx.fillRect(242, 6, 8, 8);
    fctx.fillRect(6, 242, 8, 8);
    fctx.fillRect(242, 242, 8, 8);

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;

    this.materials.floor = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.35,
      metalness: 0.8,
      color: 0x88a0c8
    });

    // Dark obsidian monolith wall
    this.materials.wall = new THREE.MeshStandardMaterial({
      color: 0x070b15,
      roughness: 0.25,
      metalness: 0.9,
      bumpScale: 0.05
    });

    // Wall top glowing trim
    this.materials.wallTrim = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a3cc,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });

    // Energy Bridge (glowing electric cyan hex lattice)
    this.materials.bridgeInactive = new THREE.MeshStandardMaterial({
      color: 0x050e18,
      transparent: true,
      opacity: 0.15,
      wireframe: true
    });

    this.materials.bridgeActive = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      emissive: 0x00e1ff,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.4
    });

    // Titan Blast Door
    this.materials.door = new THREE.MeshStandardMaterial({
      color: 0x1f2b42,
      roughness: 0.4,
      metalness: 0.85
    });

    this.materials.doorLockedGlow = new THREE.MeshStandardMaterial({
      color: 0xff3b69,
      emissive: 0xff1744,
      emissiveIntensity: 1.2
    });

    this.materials.doorOpenGlow = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.0
    });
  }

  createVoidEnvironment() {
    // Floating quantum dust motes in the abyss
    const count = 350;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 45;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 45;

      const isCyan = Math.random() > 0.4;
      colors[i * 3] = isCyan ? 0.0 : 0.7;
      colors[i * 3 + 1] = isCyan ? 0.8 : 0.3;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMaterial = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.dustParticles = new THREE.Points(geometry, pMaterial);
    this.scene.add(this.dustParticles);

    // Floating distant geometric monoliths in the background
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 28 + Math.random() * 12;
      const geo = new THREE.BoxGeometry(
        1.5 + Math.random() * 2,
        8 + Math.random() * 16,
        1.5 + Math.random() * 2
      );
      const mat = new THREE.MeshStandardMaterial({
        color: 0x070c17,
        roughness: 0.7,
        metalness: 0.6
      });
      const monolith = new THREE.Mesh(geo, mat);
      monolith.position.set(
        Math.cos(angle) * dist,
        (Math.random() - 0.5) * 12 - 4,
        Math.sin(angle) * dist
      );
      monolith.rotation.y = Math.random() * Math.PI;
      monolith.rotation.z = (Math.random() - 0.5) * 0.2;
      this.scene.add(monolith);
    }
  }

  createAvatar() {
    this.avatar = new THREE.Group();

    // Core drone sphere
    const coreGeo = new THREE.SphereGeometry(0.32, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x111c30,
      metalness: 0.95,
      roughness: 0.2
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.castShadow = true;
    this.avatar.add(core);

    // Outer orbiting cybernetic armor ring
    const ringGeo = new THREE.TorusGeometry(0.42, 0.05, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.8,
      roughness: 0.3
    });
    this.avatarRing = new THREE.Mesh(ringGeo, ringMat);
    this.avatarRing.rotation.x = Math.PI / 2.3;
    this.avatar.add(this.avatarRing);

    // Front glowing cyclops visor / sensor eye
    const eyeGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.5
    });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(0, 0.05, 0.26);
    this.avatar.add(eye);

    // Light projected from avatar
    this.avatarLight = new THREE.PointLight(0x00f0ff, 2.5, 5);
    this.avatarLight.position.set(0, 0.2, 0);
    this.avatar.add(this.avatarLight);

    // Thruster exhaust flame
    const flameGeo = new THREE.ConeGeometry(0.12, 0.35, 12);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.8
    });
    this.avatarThruster = new THREE.Mesh(flameGeo, flameMat);
    this.avatarThruster.position.set(0, -0.32, 0);
    this.avatarThruster.rotation.x = Math.PI;
    this.avatar.add(this.avatarThruster);

    this.avatar.position.set(1, 0.45, 1);
    this.scene.add(this.avatar);
  }

  buildLevel(layout, bridges, doors, nodes, hazards, movingPlatforms, exitPos) {
    // Clear old dynamic elements
    this.tiles.forEach(t => this.scene.remove(t));
    this.tiles = [];
    this.bridges.forEach(b => this.scene.remove(b));
    this.bridges.clear();
    this.doors.forEach(d => this.scene.remove(d));
    this.doors.clear();
    this.nodes.forEach(n => this.scene.remove(n));
    this.nodes.clear();
    this.hazards.forEach(h => this.scene.remove(h));
    this.hazards.clear();
    this.movingPlatforms.forEach(p => this.scene.remove(p));
    this.movingPlatforms.clear();

    if (this.portal) {
      this.scene.remove(this.portal);
      this.portal = null;
    }

    const height = layout.length;
    const width = layout[0].length;

    // Build floor tiles & monolith walls
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const type = layout[z][x];

        // 1 = Floor tile
        if (type === 1 || type === 4) {
          const tileGeo = new THREE.BoxGeometry(0.96, 0.2, 0.96);
          const tile = new THREE.Mesh(tileGeo, this.materials.floor);
          tile.position.set(x, -0.1, z);
          tile.receiveShadow = true;
          this.scene.add(tile);
          this.tiles.push(tile);
        }

        // 2 = Monolith wall
        if (type === 2) {
          const wallGroup = new THREE.Group();
          const wallGeo = new THREE.BoxGeometry(0.96, 1.4, 0.96);
          const wallMesh = new THREE.Mesh(wallGeo, this.materials.wall);
          wallMesh.position.set(0, 0.7, 0);
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
          wallGroup.add(wallMesh);

          // Top edge glowing neon strip
          const stripGeo = new THREE.BoxGeometry(0.96, 0.05, 0.05);
          const strip = new THREE.Mesh(stripGeo, this.materials.wallTrim);
          strip.position.set(0, 1.4, 0.46);
          wallGroup.add(strip);

          wallGroup.position.set(x, 0, z);
          this.scene.add(wallGroup);
          this.tiles.push(wallGroup);
        }
      }
    }

    // Build Light Bridges (3)
    bridges.forEach(b => {
      const bGroup = new THREE.Group();
      b.tiles.forEach(t => {
        const bGeo = new THREE.BoxGeometry(0.96, 0.12, 0.96);
        const bMesh = new THREE.Mesh(bGeo, b.active ? this.materials.bridgeActive : this.materials.bridgeInactive);
        bMesh.position.set(t.x, -0.06, t.z);
        bMesh.name = `bridge_tile_${t.x}_${t.z}`;
        bGroup.add(bMesh);

        // Subtle edge rails
        const railGeo = new THREE.BoxGeometry(0.04, 0.35, 0.96);
        const rail1 = new THREE.Mesh(railGeo, this.materials.wallTrim);
        rail1.position.set(t.x - 0.46, 0.15, t.z);
        const rail2 = new THREE.Mesh(railGeo, this.materials.wallTrim);
        rail2.position.set(t.x + 0.46, 0.15, t.z);
        bGroup.add(rail1);
        bGroup.add(rail2);
      });
      this.scene.add(bGroup);
      this.bridges.set(b.id, bGroup);
    });

    // Build Titan Blast Doors (4)
    doors.forEach(d => {
      const doorGroup = new THREE.Group();

      // Left pillar & Right pillar
      const pGeo = new THREE.BoxGeometry(0.15, 1.6, 0.96);
      const p1 = new THREE.Mesh(pGeo, this.materials.wall);
      p1.position.set(-0.42, 0.8, 0);
      const p2 = new THREE.Mesh(pGeo, this.materials.wall);
      p2.position.set(0.42, 0.8, 0);
      doorGroup.add(p1);
      doorGroup.add(p2);

      // Top arch
      const archGeo = new THREE.BoxGeometry(0.96, 0.2, 0.96);
      const arch = new THREE.Mesh(archGeo, this.materials.wall);
      arch.position.set(0, 1.5, 0);
      doorGroup.add(arch);

      // Sliding blast panel
      const panelGeo = new THREE.BoxGeometry(0.7, 1.3, 0.15);
      const panelMesh = new THREE.Mesh(panelGeo, this.materials.door);
      panelMesh.position.set(0, d.open ? 2.0 : 0.65, 0);
      panelMesh.name = "sliding_panel";
      panelMesh.castShadow = true;
      doorGroup.add(panelMesh);

      // Holographic status shield
      const shieldGeo = new THREE.PlaneGeometry(0.65, 1.2);
      const shieldMesh = new THREE.Mesh(shieldGeo, d.open ? this.materials.doorOpenGlow : this.materials.doorLockedGlow);
      shieldMesh.position.set(0, 0.65, 0.1);
      shieldMesh.name = "status_shield";
      doorGroup.add(shieldMesh);

      doorGroup.position.set(d.x, 0, d.z);
      this.scene.add(doorGroup);
      this.doors.set(d.id, doorGroup);
    });

    // Build Power Nodes (Rotating Gyro-Rings)
    nodes.forEach(n => {
      const nodeGroup = new THREE.Group();

      // Pedestal base
      const baseGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.25, 16);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x0a1224, roughness: 0.3, metalness: 0.9 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.1, 0);
      nodeGroup.add(base);

      // Glowing floating core
      const nodeColor = new THREE.Color(n.color);
      const coreGeo = new THREE.OctahedronGeometry(0.24, 0);
      const coreMat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: n.active ? 1.8 : 0.4,
        roughness: 0.2
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(0, 0.6, 0);
      core.name = "node_core";
      nodeGroup.add(core);

      // Spinning outer gyro-ring
      const gyroGeo = new THREE.TorusGeometry(0.35, 0.03, 12, 32);
      const gyroMat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: n.active ? 1.0 : 0.3
      });
      const gyro = new THREE.Mesh(gyroGeo, gyroMat);
      gyro.position.set(0, 0.6, 0);
      gyro.name = "node_ring";
      nodeGroup.add(gyro);

      // Point light
      const pLight = new THREE.PointLight(nodeColor, n.active ? 3.0 : 0.8, 4);
      pLight.position.set(0, 0.7, 0);
      pLight.name = "node_light";
      nodeGroup.add(pLight);

      nodeGroup.position.set(n.x, 0, n.z);
      this.scene.add(nodeGroup);
      this.nodes.set(n.id, nodeGroup);
    });

    // Build Hazards (Glitch Anomaly Rifts)
    hazards.forEach(h => {
      const hGroup = new THREE.Group();
      // Swirling red/amber energy disc
      const discGeo = new THREE.RingGeometry(0.1, 0.42, 24);
      const discMat = new THREE.MeshBasicMaterial({
        color: h.severity === "critical" ? 0xff1744 : 0xff9100,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, 0.02, 0);
      disc.name = "hazard_disc";
      hGroup.add(disc);

      hGroup.position.set(h.x, 0, h.z);
      this.scene.add(hGroup);
      this.hazards.set(h.id, hGroup);
    });

    // Build Moving Platforms
    movingPlatforms.forEach(p => {
      const platGeo = new THREE.BoxGeometry(0.96, 0.18, 0.96);
      const platMat = new THREE.MeshStandardMaterial({
        color: 0x142036,
        roughness: 0.3,
        metalness: 0.85
      });
      const plat = new THREE.Mesh(platGeo, platMat);
      plat.position.set(p.current.x, -0.09, p.current.z);
      plat.castShadow = true;
      plat.receiveShadow = true;

      // Glowing thruster pad beneath
      const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.1, 16);
      const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
      thruster.position.set(0, -0.12, 0);
      plat.add(thruster);

      this.scene.add(plat);
      this.movingPlatforms.set(p.id || 'platform-1', plat);
    });

    // Build Swirling Quantum Exit Portal
    this.createExitPortal(exitPos);
  }

  createExitPortal(pos) {
    this.portal = new THREE.Group();

    // Portal base dais
    const daisGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.22, 24);
    const daisMat = new THREE.MeshStandardMaterial({ color: 0x080f1e, roughness: 0.2, metalness: 0.95 });
    const dais = new THREE.Mesh(daisGeo, daisMat);
    dais.position.set(0, 0.1, 0);
    this.portal.add(dais);

    // Vertical Event Horizon Ring
    const archGeo = new THREE.TorusGeometry(0.55, 0.06, 16, 48);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.2
    });
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(0, 0.8, 0);
    arch.name = "portal_arch";
    this.portal.add(arch);

    // Swirling vortex plane
    const vortexGeo = new THREE.CircleGeometry(0.5, 32);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const vortex = new THREE.Mesh(vortexGeo, vortexMat);
    vortex.position.set(0, 0.8, 0);
    vortex.name = "portal_vortex";
    this.portal.add(vortex);

    // Upward beacon light beam
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.25, 6, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 3, 0);
    this.portal.add(beam);

    const portalLight = new THREE.PointLight(0x00f0ff, 3.5, 8);
    portalLight.position.set(0, 1.2, 0);
    this.portal.add(portalLight);

    this.portal.position.set(pos.x, 0, pos.z);
    this.scene.add(this.portal);
  }

  updateState(state) {
    if (!state) return;

    // Smoothly set avatar target position
    if (state.position) {
      this.avatarTargetPos.set(state.position.x, 0.45, state.position.z);
    }

    // Update Bridges
    if (state.bridges) {
      state.bridges.forEach(b => {
        const bGroup = this.bridges.get(b.id);
        if (bGroup) {
          bGroup.children.forEach(child => {
            if (child.name.startsWith('bridge_tile')) {
              child.material = b.active ? this.materials.bridgeActive : this.materials.bridgeInactive;
            }
          });
        }
      });
    }

    // Update Titan Blast Doors
    if (state.doors) {
      state.doors.forEach(d => {
        const dGroup = this.doors.get(d.id);
        if (dGroup) {
          const panel = dGroup.getObjectByName("sliding_panel");
          const shield = dGroup.getObjectByName("status_shield");
          if (panel) {
            // Animate target
            panel.userData.targetY = d.open ? 2.0 : 0.65;
          }
          if (shield) {
            shield.material = d.open ? this.materials.doorOpenGlow : this.materials.doorLockedGlow;
            shield.visible = !d.open;
          }
        }
      });
    }

    // Update Power Nodes
    if (state.nodes) {
      state.nodes.forEach(n => {
        const nGroup = this.nodes.get(n.id);
        if (nGroup) {
          const core = nGroup.getObjectByName("node_core");
          const ring = nGroup.getObjectByName("node_ring");
          const light = nGroup.getObjectByName("node_light");
          if (core && ring && light) {
            core.material.emissiveIntensity = n.active ? 2.2 : 0.4;
            ring.material.emissiveIntensity = n.active ? 1.5 : 0.3;
            light.intensity = n.active ? 4.0 : 0.8;
          }
        }
      });
    }

    // Update Hazards triggered state
    if (state.hazards) {
      state.hazards.forEach(h => {
        const hGroup = this.hazards.get(h.id);
        if (hGroup) {
          const disc = hGroup.getObjectByName("hazard_disc");
          if (disc) {
            disc.material.color.set(h.triggered ? 0x475569 : (h.severity === "critical" ? 0xff1744 : 0xff9100));
            disc.material.opacity = h.triggered ? 0.2 : 0.6;
          }
        }
      });
    }

    // Update Moving Platforms
    if (state.movingPlatforms) {
      state.movingPlatforms.forEach(p => {
        const plat = this.movingPlatforms.get(p.id || 'platform-1');
        if (plat && p.current) {
          plat.position.x = p.current.x;
          plat.position.z = p.current.z;
        }
      });
    }
  }

  triggerScreenShake(intensity = 0.35) {
    this.shakeIntensity = intensity;
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001;

    // Smoothly interpolate avatar position (Lerp)
    if (this.avatar) {
      this.avatar.position.lerp(this.avatarTargetPos, 0.14);

      // Subtle hover bobbing
      this.avatar.position.y = 0.45 + Math.sin(time * 4) * 0.05;

      // Spin cyber ring
      if (this.avatarRing) {
        this.avatarRing.rotation.z += 0.03;
      }

      // Thruster pulse
      if (this.avatarThruster) {
        const s = 0.8 + Math.sin(time * 16) * 0.2;
        this.avatarThruster.scale.set(s, s, s);
      }
    }

    // Animate door slide
    this.doors.forEach(dGroup => {
      const panel = dGroup.getObjectByName("sliding_panel");
      if (panel && panel.userData.targetY !== undefined) {
        panel.position.y += (panel.userData.targetY - panel.position.y) * 0.08;
      }
    });

    // Animate rotating node gyro-rings
    this.nodes.forEach((nGroup, idx) => {
      const ring = nGroup.getObjectByName("node_ring");
      const core = nGroup.getObjectByName("node_core");
      if (ring) {
        ring.rotation.x = time * 1.5 + idx;
        ring.rotation.y = time * 2.0;
      }
      if (core) {
        core.rotation.y = -time * 1.2;
        core.position.y = 0.6 + Math.sin(time * 3 + idx) * 0.04;
      }
    });

    // Animate exit portal
    if (this.portal) {
      const vortex = this.portal.getObjectByName("portal_vortex");
      const arch = this.portal.getObjectByName("portal_arch");
      if (vortex) {
        vortex.rotation.z += 0.04;
      }
      if (arch) {
        arch.rotation.y = Math.sin(time * 1.5) * 0.15;
      }
    }

    // Animate dust motes drift
    if (this.dustParticles) {
      this.dustParticles.rotation.y = time * 0.02;
    }

    // Camera control logic
    if (this.avatar) {
      if (this.cameraMode === 'tactical') {
        // High isometric tactical spectator view (great for expo crowd readability)
        this.cameraTarget.lerp(this.avatar.position, 0.08);
        const desiredPos = new THREE.Vector3(
          this.cameraTarget.x + 6,
          this.cameraTarget.y + 13,
          this.cameraTarget.z + 9
        );
        this.camera.position.lerp(desiredPos, 0.08);
        this.camera.lookAt(this.cameraTarget.x, 0.3, this.cameraTarget.z);
      } else if (this.cameraMode === 'chase') {
        // Closer dynamic chase camera
        this.cameraTarget.lerp(this.avatar.position, 0.1);
        const desiredPos = new THREE.Vector3(
          this.cameraTarget.x,
          this.cameraTarget.y + 4.5,
          this.cameraTarget.z + 5.5
        );
        this.camera.position.lerp(desiredPos, 0.1);
        this.camera.lookAt(this.cameraTarget.x, 0.6, this.cameraTarget.z);
      } else if (this.cameraMode === 'orbit') {
        // Smooth slow cinematic rotation around center
        this.orbitAngle += 0.005;
        const rad = 14;
        this.camera.position.set(
          this.cameraTarget.x + Math.cos(this.orbitAngle) * rad,
          11,
          this.cameraTarget.z + Math.sin(this.orbitAngle) * rad
        );
        this.camera.lookAt(this.cameraTarget.x, 0.5, this.cameraTarget.z);
      }
    }

    // Apply screen shake decay
    if (this.shakeIntensity > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.88;
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}
