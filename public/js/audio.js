// Procedural Web Audio API sound synthesizer for Chaos Protocol
// Zero external audio files required — runs 100% reliably in any modern browser

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.ambientGain = null;
    this.ambientOsc = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      this.startAmbientDrone();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.muted;
  }

  startAmbientDrone() {
    if (!this.ctx || this.ambientOsc) return;
    try {
      this.ambientOsc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      this.ambientGain = this.ctx.createGain();

      this.ambientOsc.type = "sawtooth";
      this.ambientOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 bass drone

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(55.4, this.ctx.currentTime); // Subtle binaural beat

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.ambientOsc.connect(filter);
      osc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      this.ambientOsc.start();
      osc2.start();
    } catch (e) {
      console.warn("Ambient drone failed", e);
    }
  }

  play(soundName) {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    switch (soundName) {
      case "click":
      case "ui": {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.04);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.04);
        break;
      }

      case "step": {
        // Soft cybernetic footstep / thruster pulse
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(260, t);

        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      }

      case "bump": {
        // Monolith wall bump
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.12);
        break;
      }

      case "node_success": {
        // High harmonic chime
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t + i * 0.06);
          g.gain.setValueAtTime(0, t);
          g.gain.setValueAtTime(0.25, t + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.35);
          osc.connect(g);
          g.connect(this.masterGain);
          osc.start(t + i * 0.06);
          osc.stop(t + i * 0.06 + 0.35);
        });
        break;
      }

      case "bridge_online": {
        // Energy bridge shimmering sweep
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.6);

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.exponentialRampToValueAtTime(1600, t + 0.6);
        filter.Q.value = 4;

        g.gain.setValueAtTime(0.01, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.7);
        break;
      }

      case "door_open": {
        // Hydraulic mechanical door slide
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.linearRampToValueAtTime(45, t + 0.5);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.5);
        break;
      }

      case "surge_error": {
        // Power overload buzz
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(95, t);
        osc.frequency.setValueAtTime(75, t + 0.1);
        osc.frequency.setValueAtTime(55, t + 0.2);
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.35);
        break;
      }

      case "glitch_shock": {
        // Static glitch noise burst + bass drop
        const bufferSize = this.ctx.sampleRate * 0.18;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(800, t);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.45, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

        noise.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.18);
        break;
      }

      case "warning_ping": {
        // Observer radar alert
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1174, t + 0.08);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.22);
        break;
      }

      case "nav_ping": {
        // Navigator directional chirp
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(659.25, t);
        osc.frequency.setValueAtTime(880, t + 0.07);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      }

      case "denied": {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.setValueAtTime(110, t + 0.1);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.2);
        break;
      }

      case "victory": {
        // Harmonic victory fanfare
        const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t + idx * 0.1);
          g.gain.setValueAtTime(0, t);
          g.gain.setValueAtTime(0.3, t + idx * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.8);
          osc.connect(g);
          g.connect(this.masterGain);
          osc.start(t + idx * 0.1);
          osc.stop(t + idx * 0.1 + 0.8);
        });
        break;
      }
    }
  }
}

// Global audio singleton
window.sound = new SoundEngine();
