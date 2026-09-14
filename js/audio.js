/**
 * Pop & Glow: Audio & Speech Synthesizer
 * 100% Procedural Web Audio API & Web Speech API (Zero External Files Required)
 */

class SoundController {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.isMuted = false;
    this.bgmEnabled = true;
    this.speechEnabled = true;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.speechSynthesis = window.speechSynthesis || null;
    this.thaiVoice = null;

    this.initVoices();
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.85;
        this.masterGain.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.2;
        this.bgmGain.connect(this.masterGain);

        if (this.bgmEnabled) {
          this.startBGM();
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  initVoices() {
    if (!this.speechSynthesis) return;

    const selectVoice = () => {
      const voices = this.speechSynthesis.getVoices();
      // Search for Thai voice
      this.thaiVoice = voices.find(v => v.lang.includes('th') || v.lang.includes('TH')) || null;
    };

    selectVoice();
    if (this.speechSynthesis.onvoiceschanged !== undefined) {
      this.speechSynthesis.onvoiceschanged = selectVoice;
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.85, this.ctx.currentTime);
    }
    if (muted && this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
  }

  setBgmEnabled(enabled) {
    this.bgmEnabled = enabled;
    if (enabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
  }

  setSpeechEnabled(enabled) {
    this.speechEnabled = enabled;
    if (!enabled && this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
  }

  // ==========================================
  // Synthesized Sound Effects (SFX)
  // ==========================================

  /**
   * Balloon Pop Sound: Fast pitch drop sine burst + noise click
   */
  playPop(pitchFactor = 1.0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = 620 * pitchFactor;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(70 * pitchFactor, now + 0.08);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.09);

    // Quick snap noise burst
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.02);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      noise.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);
    } catch (e) {
      // Noise buffer fallback
    }
  }

  /**
   * Jelly Squish / Boing Sound: Springy pitch modulation (Gentle wrong touch)
   */
  playBoing() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.07);
    osc.frequency.linearRampToValueAtTime(320, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.3);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.33);
  }

  /**
   * Glockenspiel Bell Chime: Dual harmonic sine wave
   */
  playChime(freq = 523.25) { // Default C5
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [1, 2.76].forEach((multiplier, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * multiplier, now);

      const amp = index === 0 ? 0.6 : 0.25;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  /**
   * Sparkle Cascade: Pentatonic chord twinkle
   */
  playSparkle() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
    notes.forEach((freq, i) => {
      setTimeout(() => this.playChime(freq), i * 55);
    });
  }

  /**
   * Celebration Fanfare: Joyful brass & chimes arpeggio
   */
  playFanfare() {
    if (this.isMuted) return;
    this.initContext();
    const chords = [
      { freq: 523.25, time: 0 },   // C5
      { freq: 659.25, time: 100 }, // E5
      { freq: 783.99, time: 200 }, // G5
      { freq: 1046.5, time: 350 }, // C6
      { freq: 1318.5, time: 500 }, // E6
      { freq: 1567.98, time: 650 } // G6
    ];

    chords.forEach(c => {
      setTimeout(() => this.playChime(c.freq), c.time);
    });
  }

  /**
   * Box Chomp / Eat Sound: Playful cute gulp
   */
  playChomp() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    setTimeout(() => {
      this.playChime(880);
    }, 100);
  }

  /**
   * Whoosh / Wind Sound for Mic Blow & Motion Gesture
   */
  playWhoosh() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.45);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.46);
  }

  // ==========================================
  // Ambient Gentle Background Music (BGM)
  // ==========================================
  startBGM() {
    this.stopBGM();
    if (!this.bgmEnabled) return;

    // Soothing toddler pentatonic lullaby sequence
    const notes = [
      261.63, 329.63, 392.00, 523.25, // C4, E4, G4, C5
      392.00, 329.63, 440.00, 392.00, // G4, E4, A4, G4
      349.23, 392.00, 440.00, 523.25, // F4, G4, A4, C5
      392.00, 329.63, 293.66, 261.63  // G4, E4, D4, C4
    ];

    this.bgmTimer = setInterval(() => {
      if (this.isMuted || !this.bgmEnabled || !this.ctx) return;
      const freq = notes[this.bgmStep % notes.length];
      this.playSoftBgmTone(freq);
      this.bgmStep++;
    }, 900);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  playSoftBgmTone(freq) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(now);
    osc.stop(now + 0.72);
  }

  // ==========================================
  // Thai Speech Synthesis (Web Speech API)
  // ==========================================
  speakThai(text, cancelPrevious = true) {
    if (!this.speechEnabled || this.isMuted || !this.speechSynthesis) return;

    if (cancelPrevious) {
      this.speechSynthesis.cancel();
    }

    // Try finding Thai voice again in case it was loaded late
    if (!this.thaiVoice) {
      this.initVoices();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.thaiVoice) {
      utterance.voice = this.thaiVoice;
      utterance.lang = this.thaiVoice.lang;
    } else {
      utterance.lang = 'th-TH';
    }

    // Toddler-friendly warm and gentle voice tuning
    utterance.rate = 0.88;   // Slightly slower and clearer
    utterance.pitch = 1.15;  // Cheerful and friendly
    utterance.volume = 1.0;

    try {
      this.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

// Global audio controller instance
window.soundCtrl = new SoundController();
