/**
 * Pop & Glow: Sorting Monster Box (น้องกล่องวิเศษจอมหม่ำ)
 * For Level 3: Match & Sort
 */

// Canvas roundRect Polyfill for older iPads & Android tablets
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!Array.isArray(radii)) radii = [radii || 0];
    const r = radii[0] || 0;
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

class SortingBox {
  constructor(options = {}) {
    this.id = options.id || 'box_1';
    this.colorKey = options.colorKey || 'blue';
    this.colorData = window.COLOR_DEFS[this.colorKey] || window.COLOR_DEFS.blue;
    this.shapeKey = options.shapeKey || 'circle';
    this.shapeData = window.SHAPE_DEFS[this.shapeKey] || window.SHAPE_DEFS.circle;

    this.x = options.x || 150;
    this.y = options.y || 650;
    this.width = options.width || 150;
    this.height = options.height || 130;
    this.catchRadius = this.width * 0.9;

    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.scaleVx = 0;
    this.scaleVy = 0;

    this.mouthOpenAmount = 0; // 0 (closed) to 1.0 (wide open)
    this.targetMouthOpen = 0;

    this.shakeAngle = 0;
    this.shakeTimer = 0;

    this.eyesLookX = 0;
    this.eyesLookY = -1; // Default looking upward

    this.eatingTimer = 0;
    this.isEating = false;

    // Load cute 3D creature box image asset
    this.image = new Image();
    this.imageLoaded = false;
    this.image.onload = () => { this.imageLoaded = true; };
    if (this.colorKey === 'blue') {
      this.image.src = 'assets/box_blue.jpg';
    } else if (this.colorKey === 'yellow') {
      this.image.src = 'assets/box_yellow.jpg';
    }
  }

  setPosition(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width || this.width;
    this.height = height || this.height;
    this.catchRadius = this.width * 0.95;
  }

  isMatching(balloon) {
    return balloon.shapeKey === this.shapeKey || balloon.colorKey === this.colorKey;
  }

  containsBalloon(balloon) {
    const dx = balloon.x - this.x;
    const dy = balloon.y - (this.y - this.height * 0.2);
    return (dx * dx + dy * dy) <= (this.catchRadius * this.catchRadius);
  }

  /**
   * Balloon entered the box correctly!
   */
  eat(balloon) {
    this.isEating = true;
    this.eatingTimer = 35;
    // Chomp squash
    this.scaleX = 1.35;
    this.scaleY = 0.65;
    this.scaleVx = 0.05;
    this.scaleVy = -0.05;

    if (window.soundCtrl) {
      window.soundCtrl.playChomp();
    }
    if (window.particleSystem) {
      window.particleSystem.spawnPopExplosion(this.x, this.y - this.height * 0.3, this.colorData.hex, 'star', 22);
    }
  }

  /**
   * Wrong balloon dropped: Gentle bounce back with head shake (No negative penalty)
   */
  reject(balloon) {
    this.shakeTimer = 25;
    this.scaleX = 1.15;
    this.scaleY = 0.85;

    // Softly bounce balloon back up
    balloon.boostUp(6.0);
    balloon.squish();

    if (window.soundCtrl) {
      window.soundCtrl.playBoing();
      window.soundCtrl.speakThai('ฮึบ~ ขอลองใหม่อีกทีนะจ๊ะ');
    }
    if (window.particleSystem) {
      window.particleSystem.addRipple(this.x, this.y - this.height * 0.5, '#E2E8F0', 90, 4);
    }
  }

  update(time, activeBalloons = []) {
    // Spring physics for eating/bounce
    const k = 0.25;
    const damping = 0.76;
    const fxX = (1.0 - this.scaleX) * k;
    this.scaleVx = (this.scaleVx + fxX) * damping;
    this.scaleX += this.scaleVx;

    const fxY = (1.0 - this.scaleY) * k;
    this.scaleVy = (this.scaleVy + fxY) * damping;
    this.scaleY += this.scaleVy;

    // Head shake on soft rejection
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      this.shakeAngle = Math.sin(this.shakeTimer * 0.8) * 0.12;
    } else {
      this.shakeAngle = 0;
    }

    // Check distance to closest balloon to open mouth in anticipation
    let nearestDist = 9999;
    let nearestBalloon = null;
    for (const b of activeBalloons) {
      const dist = Math.hypot(b.x - this.x, b.y - this.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBalloon = b;
      }
    }

    if (nearestBalloon && nearestDist < 260) {
      this.targetMouthOpen = Math.min(1.0, (260 - nearestDist) / 180 + 0.3);
      // Track balloon with eyes
      const angle = Math.atan2(nearestBalloon.y - this.y, nearestBalloon.x - this.x);
      this.eyesLookX = Math.cos(angle) * 5;
      this.eyesLookY = Math.sin(angle) * 5;
    } else {
      this.targetMouthOpen = 0.1;
      this.eyesLookX = 0;
      this.eyesLookY = -3;
    }

    if (this.eatingTimer > 0) {
      this.eatingTimer--;
      this.targetMouthOpen = 0.0; // Clamped shut while chewing
      if (this.eatingTimer === 0) {
        this.isEating = false;
      }
    }

    // Smooth mouth open interpolation
    this.mouthOpenAmount += (this.targetMouthOpen - this.mouthOpenAmount) * 0.2;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.shakeAngle);
    ctx.scale(this.scaleX, this.scaleY);

    const w = this.width;
    const h = this.height;
    const r = 24;

    // 1. Box Drop Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.52, w * 0.55, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.imageLoaded) {
      // 2. Draw 3D Monster Toy Box Image
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, [r, r, 16, 16]);
      ctx.clip();
      ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
      ctx.restore();

      // Clean white rounded card border
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, [r, r, 16, 16]);
      ctx.stroke();
      ctx.restore();

      // Animated mouth opening when balloon approaches ("อ้ามมม!")
      if (this.mouthOpenAmount > 0.2) {
        ctx.save();
        const mouthY = -h * 0.08;
        const mouthW = w * 0.42;
        const mouthH = 12 + this.mouthOpenAmount * 34;

        ctx.fillStyle = '#991B1B';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(0, mouthY, mouthW * 0.5, mouthH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FDA4AF';
        ctx.beginPath();
        ctx.arc(0, mouthY + mouthH * 0.25, mouthW * 0.22, 0, Math.PI);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // 2. Box Body (Rounded Card Fallback)
      ctx.save();
      ctx.fillStyle = this.colorData.hex;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;

      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, [r, r, 16, 16]);
      ctx.fill();
      ctx.stroke();

      // 3. Cute Monster Belly Shape Emblem
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(0, h * 0.22, 28, 0, Math.PI * 2);
      ctx.fill();

      // Shape icon on belly
      ctx.fillStyle = '#FFFFFF';
      if (this.shapeKey === 'circle') {
        ctx.beginPath();
        ctx.arc(0, h * 0.22, 16, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.shapeKey === 'square') {
        ctx.fillRect(-14, h * 0.22 - 14, 28, 28);
      } else if (this.shapeKey === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(0, h * 0.22 - 16);
        ctx.lineTo(16, h * 0.22 + 14);
        ctx.lineTo(-16, h * 0.22 + 14);
        ctx.closePath();
        ctx.fill();
      } else if (this.shapeKey === 'star') {
        window.particleSystem.drawStar(ctx, 0, h * 0.22, 5, 18, 9);
      }

      // 4. Animated Eyes
      const eyeSpacing = w * 0.26;
      const eyeY = -h * 0.3;
      const eyeRadius = 18;

      [-eyeSpacing, eyeSpacing].forEach(eyeX => {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(eyeX + this.eyesLookX, eyeY + this.eyesLookY, eyeRadius * 0.48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(eyeX + this.eyesLookX - 3, eyeY + this.eyesLookY - 3, eyeRadius * 0.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Rosy Cheeks
      ctx.fillStyle = 'rgba(255, 107, 129, 0.45)';
      ctx.beginPath();
      ctx.arc(-eyeSpacing - 12, eyeY + 18, 12, 0, Math.PI * 2);
      ctx.arc(eyeSpacing + 12, eyeY + 18, 12, 0, Math.PI * 2);
      ctx.fill();

      // 6. Animated Mouth ("อ้ามมม!")
      const mouthY = -h * 0.05;
      const mouthW = w * 0.45;
      const mouthH = 10 + this.mouthOpenAmount * 42;

      ctx.fillStyle = '#991B1B';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.ellipse(0, mouthY, mouthW * 0.5, mouthH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (this.mouthOpenAmount > 0.25) {
        ctx.fillStyle = '#FDA4AF';
        ctx.beginPath();
        ctx.arc(0, mouthY + mouthH * 0.25, mouthW * 0.25, 0, Math.PI);
        ctx.fill();
      }
    }

    ctx.restore();

    // 7. Shape & Color Label Badge beneath box
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = this.colorData.hex;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-w * 0.45, h * 0.55, w * 0.9, 32, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 16px Kanit, Prompt, sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.shapeData.nameTh} ${this.colorData.nameTh}`, 0, h * 0.55 + 16);
    ctx.restore();

    ctx.restore();
  }
}

window.SortingBox = SortingBox;
