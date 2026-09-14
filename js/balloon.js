/**
 * Pop & Glow: Balloon Entity Class
 * Featuring spring/squash physics, cute animated facial expressions,
 * generous hitboxes (1.8x), and organic floating motion.
 */

const COLOR_DEFS = {
  red: { id: 'red', nameTh: 'สีแดง', hex: '#FF4757', lightHex: '#FFA4AB' },
  yellow: { id: 'yellow', nameTh: 'สีเหลือง', hex: '#FFA502', lightHex: '#FFE082' },
  blue: { id: 'blue', nameTh: 'สีฟ้า', hex: '#2E86DE', lightHex: '#90CAF9' },
  green: { id: 'green', nameTh: 'สีเขียว', hex: '#2ED573', lightHex: '#A3E9D2' },
  purple: { id: 'purple', nameTh: 'สีม่วง', hex: '#9B59B6', lightHex: '#D7BDE2' },
  orange: { id: 'orange', nameTh: 'สีส้ม', hex: '#FF7F50', lightHex: '#FFCCBC' }
};

const SHAPE_DEFS = {
  circle: { id: 'circle', nameTh: 'วงกลม' },
  square: { id: 'square', nameTh: 'สี่เหลี่ยม' },
  triangle: { id: 'triangle', nameTh: 'สามเหลี่ยม' },
  star: { id: 'star', nameTh: 'ดาว' }
};

class Balloon {
  constructor(options = {}) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.colorKey = options.colorKey || 'red';
    this.colorData = COLOR_DEFS[this.colorKey] || COLOR_DEFS.red;
    this.shapeKey = options.shapeKey || 'circle';
    this.shapeData = SHAPE_DEFS[this.shapeKey] || SHAPE_DEFS.circle;

    this.x = options.x || 200;
    this.y = options.y || 600;
    this.baseX = this.x;
    this.radius = options.radius || 60; // Toddler large size
    this.hitRadius = this.radius * 1.85; // 1.85x generous touch area

    // Floating motion physics
    this.vy = options.vy || -(Math.random() * 0.7 + 0.9);
    this.swayAmplitude = Math.random() * 25 + 15;
    this.swayFreq = Math.random() * 0.03 + 0.02;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.rotation = 0;
    this.wobbleAngle = 0;

    // Spring & Squash physics
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.scaleVx = 0;
    this.scaleVy = 0;

    // Cute Face & Blinking
    this.showFace = options.showFace !== undefined ? options.showFace : true;
    this.blinkTimer = Math.random() * 120 + 60;
    this.isBlinking = false;
    this.blinkDuration = 0;

    // Hesitation Guide Indicator & Target Marker
    this.isGuiding = false;
    this.isTarget = false;
    this.guidePulse = 0;

    // Drag & Drop
    this.isDragging = false;
    this.dragPointerId = null;

    // Long graceful ribbon string (not short)
    this.stringLength = this.radius * 2.4;
    this.stringPhase = Math.random() * 10;
  }

  /**
   * Generous Hitbox collision check
   */
  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return (dx * dx + dy * dy) <= (this.hitRadius * this.hitRadius);
  }

  /**
   * Squish & Bounce (called on wrong touch for soft positive sensory feedback)
   */
  squish() {
    this.scaleX = 1.45;
    this.scaleY = 0.65;
    this.scaleVx = -0.05;
    this.scaleVy = 0.05;
  }

  /**
   * Give an upward boost (e.g. from mic blow or gesture wave)
   */
  boostUp(amount = 4.5) {
    this.vy = -amount;
    this.scaleX = 0.85;
    this.scaleY = 1.25;
  }

  /**
   * Glide smoothly toward a target point (used for tap assist in Level 3)
   */
  glideTo(targetX, targetY, onComplete = null) {
    this.isGliding = true;
    this.targetGlideX = targetX;
    this.targetGlideY = targetY;
    this.onGlideComplete = onComplete;
  }

  update(time, screenWidth, screenHeight) {
    // Spring physics update for squash/stretch
    const k = 0.22;
    const damping = 0.78;

    const fxX = (1.0 - this.scaleX) * k;
    this.scaleVx = (this.scaleVx + fxX) * damping;
    this.scaleX += this.scaleVx;

    const fxY = (1.0 - this.scaleY) * k;
    this.scaleVy = (this.scaleVy + fxY) * damping;
    this.scaleY += this.scaleVy;

    // Blinking animation
    this.blinkTimer--;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkDuration = 9; // ~150ms blink
      this.blinkTimer = Math.random() * 180 + 120;
    }
    if (this.isBlinking) {
      this.blinkDuration--;
      if (this.blinkDuration <= 0) {
        this.isBlinking = false;
      }
    }

    // Hesitation guide pulse & aura
    if (this.isGuiding || this.isTarget) {
      this.guidePulse += 0.06;
    }
    this.wobbleAngle = 0; // Perfectly stable, no shaking

    // Handle auto-gliding towards matching box
    if (this.isGliding) {
      this.x += (this.targetGlideX - this.x) * 0.14;
      this.y += (this.targetGlideY - this.y) * 0.14;
      this.rotation = Math.sin(time * 0.02) * 0.15;
      if (Math.hypot(this.targetGlideX - this.x, this.targetGlideY - this.y) < 18) {
        this.isGliding = false;
        if (typeof this.onGlideComplete === 'function') {
          this.onGlideComplete();
        }
      }
      return;
    }

    // Motion physics
    if (!this.isDragging) {
      this.y += this.vy;
      this.x = this.baseX + Math.sin(time * this.swayFreq + this.swayPhase) * this.swayAmplitude;

      // Gradually restore upward velocity if boosted
      if (this.vy < -2.0) {
        this.vy += 0.08;
      }

      // If floated out of top screen, wrap around bottom
      if (this.vy < 0 && this.y < -this.radius * 2) {
        this.y = screenHeight + this.radius * 1.5;
        this.baseX = Math.random() * (screenWidth - this.radius * 2.5) + this.radius * 1.25;
      } else if (this.vy > 0 && this.y > screenHeight * 0.55) {
        // In Level 3 downward drift, gently turn around or bob
        this.vy = -0.5;
      } else if (this.vy < 0 && this.y < screenHeight * 0.15 && this.driftDown) {
        this.vy = 0.5;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation); // Clean stable angle (no shaking)
    ctx.scale(this.scaleX, this.scaleY);

    // 1. Draw Target or Hesitation Guiding Aura (เด็กเห็นได้ชัดเจนโดยไม่ต้องอ่าน)
    if (this.isGuiding || this.isTarget) {
      ctx.save();
      const ringScale = 1.05 + (Math.sin(this.guidePulse) + 1) * 0.15;
      const ringAlpha = 0.75 - (ringScale - 1.0) * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.5 * ringScale, 0, Math.PI * 2);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 6;
      ctx.globalAlpha = Math.max(0.2, ringAlpha);
      ctx.stroke();

      // Soft sparkling inner halo
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.22, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Trailing String with wavy curve
    this.drawString(ctx);

    // 3. Draw Balloon Knot
    this.drawKnot(ctx);

    // 4. Draw Balloon Main Body based on shape
    this.drawBody(ctx);

    // 5. Draw Glossy 3D Highlight
    this.drawGloss(ctx);

    // 6. Draw Cute Character Face (Eyes, Blush, Smile)
    if (this.showFace) {
      this.drawFace(ctx);
    }

    ctx.restore();
  }

  drawBody(ctx) {
    ctx.save();
    ctx.fillStyle = this.colorData.hex;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 3;

    // Drop shadow under balloon for lovely depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;

    switch (this.shapeKey) {
      case 'square':
        this.drawRoundedSquare(ctx, -this.radius, -this.radius, this.radius * 2, this.radius * 0.35);
        break;

      case 'triangle':
        this.drawRoundedTriangle(ctx, this.radius * 1.15);
        break;

      case 'star':
        this.drawStarShape(ctx, 0, 0, 5, this.radius * 1.25, this.radius * 0.6);
        break;

      case 'circle':
      default:
        // Classic egg/oval balloon shape
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 0.95, this.radius * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  drawRoundedSquare(ctx, x, y, size, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size - radius);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawRoundedTriangle(ctx, size) {
    const h = size * (Math.sqrt(3) / 2);
    const topY = -h * 0.65;
    const botY = h * 0.55;
    const halfW = size * 0.65;

    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(halfW, botY);
    ctx.lineTo(-halfW, botY);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = this.colorData.hex;
    ctx.stroke();
    ctx.fill();
  }

  drawStarShape(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = this.colorData.hex;
    ctx.stroke();
    ctx.fill();
  }

  drawGloss(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    // Top-left shiny reflection
    ctx.ellipse(-this.radius * 0.35, -this.radius * 0.45, this.radius * 0.22, this.radius * 0.12, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Tiny dot reflection
    ctx.beginPath();
    ctx.arc(-this.radius * 0.48, -this.radius * 0.25, this.radius * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
    ctx.restore();
  }

  drawKnot(ctx) {
    ctx.save();
    ctx.fillStyle = this.colorData.hex;
    const knotY = this.radius * 1.1;
    ctx.beginPath();
    ctx.moveTo(-8, knotY);
    ctx.lineTo(8, knotY);
    ctx.lineTo(0, knotY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawString(ctx) {
    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const startY = this.radius * 1.1 + 8;

    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.bezierCurveTo(
      -12, startY + this.stringLength * 0.35,
      14, startY + this.stringLength * 0.7,
      0, startY + this.stringLength
    );
    ctx.stroke();
    ctx.restore();
  }

  drawFace(ctx) {
    ctx.save();
    const eyeSpacing = this.radius * 0.32;
    const eyeY = -this.radius * 0.05;
    const eyeRadius = this.radius * 0.13;

    // 1. Rosy Pink Cheeks
    ctx.fillStyle = 'rgba(255, 107, 129, 0.45)';
    ctx.beginPath();
    ctx.arc(-eyeSpacing - 12, eyeY + 16, this.radius * 0.14, 0, Math.PI * 2);
    ctx.arc(eyeSpacing + 12, eyeY + 16, this.radius * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // 2. Big Expressive Eyes
    if (this.isBlinking) {
      // Blinking happy closed curved eyes
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, eyeRadius, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(eyeSpacing, eyeY, eyeRadius, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      // Big open kawaii eyes
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.arc(eyeSpacing, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      // White eye sparkle highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-eyeSpacing - eyeRadius * 0.3, eyeY - eyeRadius * 0.3, eyeRadius * 0.42, 0, Math.PI * 2);
      ctx.arc(eyeSpacing - eyeRadius * 0.3, eyeY - eyeRadius * 0.3, eyeRadius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Cute Cheerful Smile
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, eyeY + 12, this.radius * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
}

window.Balloon = Balloon;
window.COLOR_DEFS = COLOR_DEFS;
window.SHAPE_DEFS = SHAPE_DEFS;
