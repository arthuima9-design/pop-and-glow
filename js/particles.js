/**
 * Pop & Glow: Particle Effects Engine
 * 60fps soft particle bursts, stars, confetti, rings, and ripples
 */

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.ripples = [];
  }

  reset() {
    this.particles = [];
    this.ripples = [];
  }

  /**
   * Spawn Confetti & Star Burst at (x, y) with a given color
   */
  spawnPopExplosion(x, y, color, shape = 'star', count = 28) {
    const palette = [color, '#FFD700', '#FF69B4', '#00E5FF', '#76FF03', '#FFFFFF'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 8 + 3;
      const chosenColor = Math.random() < 0.6 ? color : palette[Math.floor(Math.random() * palette.length)];

      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // Slight upward boost
        size: Math.random() * 12 + 8,
        color: chosenColor,
        alpha: 1.0,
        decay: Math.random() * 0.015 + 0.015,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        type: i % 3 === 0 ? 'star' : (i % 3 === 1 ? 'confetti' : shape),
        flipSpeed: Math.random() * 0.2 + 0.1,
        flipAngle: Math.random() * Math.PI
      });
    }

    // Add 2 soft expanding rings
    this.addRipple(x, y, color, 80, 4);
    this.addRipple(x, y, '#FFFFFF', 50, 3);
  }

  /**
   * Spawn floating score banner (+10 ⭐) rising upwards
   */
  spawnScoreFloat(x, y, text = '+10 ⭐', color = '#F59E0B') {
    this.particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -2.6,
      size: 30,
      color: color,
      alpha: 1.0,
      decay: 0.016,
      rotation: 0,
      rotationSpeed: 0,
      type: 'text',
      text: text,
      flipSpeed: 0,
      flipAngle: 0
    });
  }

  /**
   * Add an expanding ripple ring (for touches or mic blow)
   */
  addRipple(x, y, color = '#38BDF8', maxRadius = 100, lineWidth = 4) {
    this.ripples.push({
      x: x,
      y: y,
      radius: 5,
      maxRadius: maxRadius,
      speed: (maxRadius / 25),
      color: color,
      alpha: 0.8,
      lineWidth: lineWidth
    });
  }

  /**
   * Spawn wind gust ripples for mic blow
   */
  spawnWindGust(width, height) {
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * width;
      const y = height - Math.random() * 120;
      this.addRipple(x, y, '#BAE6FD', 140 + Math.random() * 80, 5);
    }
  }

  update() {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // Soft gravity
      p.vx *= 0.98; // Air drag
      p.rotation += p.rotationSpeed;
      p.flipAngle += p.flipSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed;
      r.alpha = Math.max(0, 1 - (r.radius / r.maxRadius));

      if (r.radius >= r.maxRadius || r.alpha <= 0) {
        this.ripples.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();

    // Draw ripples first
    for (const r of this.ripples) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = r.lineWidth;
      ctx.stroke();
      ctx.restore();
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      if (p.type === 'text') {
        ctx.font = '900 32px "Kanit", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 0);
      } else if (p.type === 'star') {
        this.drawStar(ctx, 0, 0, 5, p.size, p.size * 0.45);
      } else if (p.type === 'triangle') {
        this.drawTriangle(ctx, 0, 0, p.size);
      } else if (p.type === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.type === 'confetti') {
        // 3D flipping ribbon
        const scaleY = Math.cos(p.flipAngle);
        ctx.scale(1, scaleY);
        ctx.fillRect(-p.size * 0.7, -p.size * 0.35, p.size * 1.4, p.size * 0.7);
      } else {
        // Circle / soft bubble
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
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
    ctx.fill();
  }

  drawTriangle(ctx, cx, cy, size) {
    const h = size * (Math.sqrt(3) / 2);
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx - size / 2, cy + h / 2);
    ctx.lineTo(cx + size / 2, cy + h / 2);
    ctx.closePath();
    ctx.fill();
  }
}

window.particleSystem = new ParticleSystem();
