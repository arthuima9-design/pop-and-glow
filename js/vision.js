/**
 * Pop & Glow: Camera Gesture & Motion Tracking Engine
 * Lightweight, 60fps frame-differencing motion detection mapped to a Magic Star Wand.
 * 100% Client-side and privacy-friendly.
 */

class VisionTracker {
  constructor() {
    this.isActive = false;
    this.stream = null;
    this.video = null;

    // Small offscreen analysis canvas for ultra-fast motion differencing
    this.downW = 64;
    this.downH = 48;
    this.analysisCanvas = document.createElement('canvas');
    this.analysisCanvas.width = this.downW;
    this.analysisCanvas.height = this.downH;
    this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true });
    this.prevFrameData = null;

    // Filtered Motion Coordinates
    this.motionX = 0.5; // Normalized (0.0 to 1.0)
    this.motionY = 0.5;
    this.smoothX = 0.5;
    this.smoothY = 0.5;
    this.hasMotion = false;
    this.motionIntensity = 0;
    this.lastMotionTime = 0;

    // Wand cursor trail
    this.wandTrail = [];
  }

  async start(videoElement) {
    if (this.isActive) return true;
    this.video = videoElement;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser.');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }

      this.isActive = true;
      this.prevFrameData = null;
      return true;
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
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
    if (this.video) {
      this.video.srcObject = null;
    }
    this.prevFrameData = null;
    this.hasMotion = false;
  }

  /**
   * Process current frame and update smoothed wand position
   */
  update(screenWidth, screenHeight) {
    if (!this.isActive || !this.video || this.video.readyState < 2) return;

    // Draw downscaled frame
    this.analysisCtx.drawImage(this.video, 0, 0, this.downW, this.downH);
    const frame = this.analysisCtx.getImageData(0, 0, this.downW, this.downH);
    const data = frame.data;

    if (this.prevFrameData) {
      let sumX = 0;
      let sumY = 0;
      let motionPixels = 0;
      const prev = this.prevFrameData.data;
      const threshold = 22; // Sensitive & responsive for toddler hands

      for (let i = 0; i < data.length; i += 4) {
        // Luminance calculation
        const currLum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
        const prevLum = (prev[i] * 299 + prev[i + 1] * 587 + prev[i + 2] * 114) / 1000;
        const diff = Math.abs(currLum - prevLum);

        if (diff > threshold) {
          const pixelIndex = i / 4;
          const px = pixelIndex % this.downW;
          const py = Math.floor(pixelIndex / this.downW);

          sumX += px;
          sumY += py;
          motionPixels++;
        }
      }

      const minMotionThreshold = (this.downW * this.downH) * 0.010; // 1.0% pixels moving
      if (motionPixels > minMotionThreshold) {
        // Mirrored X for natural selfie interaction
        const rawNormX = 1.0 - (sumX / motionPixels) / this.downW;
        const rawNormY = (sumY / motionPixels) / this.downH;

        this.motionX = rawNormX;
        this.motionY = rawNormY;
        this.hasMotion = true;
        this.motionIntensity = Math.min(1.0, motionPixels / (this.downW * this.downH * 0.2));
        this.lastMotionTime = Date.now();
      } else {
        if (Date.now() - this.lastMotionTime > 750) {
          this.hasMotion = false;
        }
      }
    }

    this.prevFrameData = frame;

    // Smooth movement interpolation (low-pass filter)
    const smoothFactor = 0.28;
    this.smoothX += (this.motionX - this.smoothX) * smoothFactor;
    this.smoothY += (this.motionY - this.smoothY) * smoothFactor;

    // Add point to wand sparkle trail
    if (this.hasMotion) {
      const wandX = this.smoothX * screenWidth;
      const wandY = this.smoothY * screenHeight;
      this.wandTrail.push({
        x: wandX,
        y: wandY,
        alpha: 1.0,
        size: Math.random() * 8 + 6,
        color: ['#FACC15', '#FF69B4', '#38BDF8', '#FFFFFF'][Math.floor(Math.random() * 4)]
      });
    }

    // Decay trail
    for (let i = this.wandTrail.length - 1; i >= 0; i--) {
      this.wandTrail[i].alpha -= 0.05;
      if (this.wandTrail[i].alpha <= 0) {
        this.wandTrail.splice(i, 1);
      }
    }
  }

  getPointer(screenWidth, screenHeight) {
    if (!this.isActive || !this.hasMotion) return null;
    return {
      x: this.smoothX * screenWidth,
      y: this.smoothY * screenHeight,
      isMotion: true
    };
  }

  draw(ctx, screenWidth, screenHeight) {
    if (!this.isActive) return;

    ctx.save();

    // 1. Draw Wand Sparkle Trail
    for (const p of this.wandTrail) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw Magic Star Wand Cursor
    const curX = this.smoothX * screenWidth;
    const curY = this.smoothY * screenHeight;

    if (this.hasMotion) {
      // Glow halo
      ctx.save();
      const glowGrad = ctx.createRadialGradient(curX, curY, 5, curX, curY, 55);
      glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      glowGrad.addColorStop(0.4, 'rgba(250, 204, 21, 0.7)');
      glowGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(curX, curY, 55, 0, Math.PI * 2);
      ctx.fill();

      // Star Wand Tip
      if (window.particleSystem) {
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 16;
        window.particleSystem.drawStar(ctx, curX, curY, 5, 26, 12);
      }

      // Sparkle label
      ctx.font = 'bold 14px Kanit, Prompt, sans-serif';
      ctx.fillStyle = '#D97706';
      ctx.textAlign = 'center';
      ctx.fillText('คทาดาววิเศษ ✨', curX, curY + 36);
      ctx.restore();
    } else {
      // Gentle hint when camera is active but waiting for hand motion
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(Date.now() * 0.005) * 0.25;
      if (window.particleSystem) {
        ctx.fillStyle = '#FDE047';
        window.particleSystem.drawStar(ctx, curX, curY, 5, 18, 8);
      }
      ctx.font = 'bold 13px Kanit, Prompt, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText('โบกมือเลย 👋', curX, curY + 28);
      ctx.restore();
    }

    ctx.restore();
  }
}

window.visionTracker = new VisionTracker();
