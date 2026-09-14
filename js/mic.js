/**
 * Pop & Glow: Microphone Voice & Blow Detector
 * Detects toddler volume spikes, cheering, or blowing into the mic.
 */

class MicController {
  constructor() {
    this.isActive = false;
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.threshold = 38; // Sensitivity threshold (0 - 100)
    this.cooldown = 0;
    this.onTrigger = null;
    this.currentLevel = 0;
  }

  async start() {
    if (this.isActive) return true;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone API not supported in this browser.');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(this.stream);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.isActive = true;
      return true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      this.stop();
      return false;
    }
  }

  stop() {
    this.isActive = false;
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.currentLevel = 0;
  }

  setSensitivity(val) {
    // val from 1 (least sensitive) to 100 (most sensitive)
    this.threshold = 90 - (val * 0.7);
  }

  update() {
    if (!this.isActive || !this.analyser) {
      this.currentLevel = 0;
      return;
    }

    if (this.cooldown > 0) {
      this.cooldown--;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const avg = sum / this.dataArray.length;
    this.currentLevel = avg;

    // Check if exceeded threshold and not on cooldown
    if (avg > this.threshold && this.cooldown <= 0) {
      this.cooldown = 24; // ~400ms cooldown
      if (typeof this.onTrigger === 'function') {
        this.onTrigger(avg);
      }
    }
  }
}

window.micController = new MicController();
