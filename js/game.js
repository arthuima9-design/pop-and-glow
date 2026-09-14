/**
 * Pop & Glow: Main Game Engine & State Machine
 * Toddler Development Game (2 Years Old)
 * Cross-platform: iPad, Mobile, Desktop
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.screenHalo = document.getElementById('screenHalo');
    this.promptText = document.getElementById('promptText');
    this.levelBadge = document.getElementById('levelBadge');
    this.progressDots = document.getElementById('progressDots');
    this.btnReplayVoice = document.getElementById('btnReplayVoice');
    this.parentalGateBtn = document.getElementById('parentalGateBtn');
    this.parentalGateMeter = document.getElementById('parentalGateMeter');
    this.parentalModal = document.getElementById('parentalModal');
    this.celebrationModal = document.getElementById('celebrationOverlay');
    this.webcamContainer = document.getElementById('webcamContainer');
    this.webcamVideo = document.getElementById('webcamVideo');
    this.micVisualizer = document.getElementById('micVisualizer');

    // Canvas dimensions & scale
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Game States
    this.LEVELS = {
      COLOR_POP: 1,    // ด่าน 1: ตะลุยแดนสีสัน
      SHAPE_SHIFTER: 2,// ด่าน 2: ลูกโป่งแปลงร่าง
      MATCH_SORT: 3,   // ด่าน 3: จับคู่ลงกล่องวิเศษ
      FREE_PLAY: 4     // โหมดเล่นอิสระ
    };

    this.currentLevel = this.LEVELS.COLOR_POP;
    this.levelProgress = 0;
    this.targetProgress = (window.saveManager && window.saveManager.getTargetPops)
      ? window.saveManager.getTargetPops()
      : 5; // กำหนดเองได้ผ่านเมนูผู้ปกครอง

    // Target Criteria
    this.targetColor = 'red';
    this.targetShape = 'circle';

    // Entities
    this.balloons = [];
    this.boxes = [];
    this.activeTouches = new Map(); // pointerId -> { x, y }

    // Visual Target Preview Canvas for toddlers who cannot read
    this.previewCanvas = document.getElementById('previewCanvas');
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;

    // Interactive Demo Guide Hand for non-readers
    this.guideHand = {
      x: this.width * 0.5,
      y: 120,
      alpha: 0,
      tapScale: 1.0,
      dragProgress: 0,
      lastTapTime: 0
    };
    this.lastAudioPromptTime = Date.now();

    // Timers & Guidance
    this.lastInteractTime = Date.now();
    this.idleHesitationTime = 2200; // 2.2s hesitation assist
    this.isGuiding = false;
    this.hasUserInteracted = false; // ปลดล็อคเสียงภารกิจเมื่อผู้เล่นเริ่มแตะหน้าจอ
    this.spawnTimer = 0;
    this.lastTime = 0;

    // Parental Gate Hold
    this.gateHoldStartTime = 0;
    this.gateHoldDuration = 3000; // 3 seconds
    this.gateHoldActive = false;
    this.gateHoldTimer = null;

    // Camera gesture throttle
    this.lastWandHitTime = 0;

    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 200));

    this.setupInputs();
    this.setupParentalGate();
    this.setupHUDControls();
    this.setupSettingsUI();
    this.setupProfileUI();
    this.setupLevelSelectorUI();
    this.updateProfileHUD();

    // Start in Level 1
    this.startLevel(this.LEVELS.COLOR_POP);

    // Game loop
    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvas() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(this.dpr, this.dpr);

    // Update Level 3 Boxes positions on resize
    if (this.currentLevel === this.LEVELS.MATCH_SORT && this.boxes.length === 2) {
      this.layoutBoxes();
    }
  }

  layoutBoxes() {
    const isPortrait = this.height > this.width;
    const boxW = Math.min(180, Math.max(130, this.width * 0.28));
    const boxH = boxW * 0.85;
    const boxY = this.height - boxH * 0.65;

    if (isPortrait) {
      // Side by side in portrait
      this.boxes[0].setPosition(this.width * 0.28, boxY, boxW, boxH);
      this.boxes[1].setPosition(this.width * 0.72, boxY, boxW, boxH);
    } else {
      // Wide spacing in landscape
      this.boxes[0].setPosition(this.width * 0.22, boxY, boxW, boxH);
      this.boxes[1].setPosition(this.width * 0.78, boxY, boxW, boxH);
    }
  }

  // ==========================================
  // Level Management
  // ==========================================
  startLevel(levelNum) {
    this.currentLevel = levelNum;
    this.levelProgress = 0;
    this.targetProgress = (window.saveManager && window.saveManager.getTargetPops)
      ? window.saveManager.getTargetPops()
      : 5;
    this.balloons = [];
    this.boxes = [];
    this.lastInteractTime = Date.now();
    this.isGuiding = false;

    this.hideCelebration();
    this.updateProgressHUD();

    // Toggle Free Play Floating Dock Bar
    const freePlayBar = document.getElementById('freePlayLevelBar');
    if (freePlayBar) {
      if (this.currentLevel === this.LEVELS.FREE_PLAY) {
        freePlayBar.classList.remove('hidden');
      } else {
        freePlayBar.classList.add('hidden');
      }
    }

    if (this.currentLevel === this.LEVELS.COLOR_POP) {
      if (this.levelBadge) this.levelBadge.textContent = '🎨 ด่าน 1: สีสัน ▾';
      this.pickNewTargetColor();
      this.spawnInitialBalloons(5);
    } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
      if (this.levelBadge) this.levelBadge.textContent = '🔺 ด่าน 2: รูปทรง ▾';
      this.pickNewTargetShape();
      this.spawnInitialBalloons(5);
    } else if (this.currentLevel === this.LEVELS.MATCH_SORT) {
      if (this.levelBadge) this.levelBadge.textContent = '🎁 ด่าน 3: แยกหมวด ▾';
      this.initSortingLevel();
    } else if (this.currentLevel === this.LEVELS.FREE_PLAY) {
      if (this.levelBadge) this.levelBadge.textContent = '🎈 ลานเล่นอิสระ ▾';
      this.setPrompt('จิ้มลูกโป่งเล่นได้เลยจ้า! ✨', '#FF4757');
      this.spawnInitialBalloons(7);
      if (window.soundCtrl) {
        window.soundCtrl.speakThai('ภารกิจตอนนี้: ลานเล่นอิสระ จิ้มลูกโป่งลูกไหนก็ได้เลยจ้า');
      }
    }
  }

  updateProgressHUD() {
    if (!this.progressDots) return;
    this.progressDots.innerHTML = '';
    if (this.currentLevel === this.LEVELS.FREE_PLAY) {
      this.progressDots.innerHTML = '<span class="text-xl">🎈🎈🎈</span>';
      return;
    }

    if (this.targetProgress <= 6) {
      for (let i = 0; i < this.targetProgress; i++) {
        const dot = document.createElement('div');
        dot.className = `w-4 h-4 rounded-full transition-all duration-300 ${
          i < this.levelProgress ? 'bg-amber-400 scale-125 shadow-md' : 'bg-slate-300'
        }`;
        this.progressDots.appendChild(dot);
      }
    } else {
      // Sleek progress bar + text for larger targets (e.g. 10, 15, 20)
      const percent = Math.min(100, Math.round((this.levelProgress / this.targetProgress) * 100));
      this.progressDots.innerHTML = `
        <div class="flex items-center gap-2 px-1">
          <div class="w-16 sm:w-20 h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
            <div class="h-full bg-amber-400 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
          </div>
          <span class="text-xs font-black text-slate-700 whitespace-nowrap">${this.levelProgress}/${this.targetProgress} 🎈</span>
        </div>
      `;
    }
  }

  setPrompt(text, haloColor = null) {
    if (this.promptText) {
      this.promptText.textContent = text;
    }
    if (this.screenHalo) {
      if (haloColor) {
        this.screenHalo.style.boxShadow = `inset 0 0 60px ${haloColor}80`;
        this.screenHalo.classList.add('halo-pulse');
      } else {
        this.screenHalo.style.boxShadow = 'none';
        this.screenHalo.classList.remove('halo-pulse');
      }
    }
    this.drawTargetPreview();
  }

  /**
   * Draw the visual target representation in the HUD preview card (no reading required)
   */
  drawTargetPreview() {
    if (!this.previewCtx || !this.previewCanvas) return;
    const ctx = this.previewCtx;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    if (this.currentLevel === this.LEVELS.COLOR_POP) {
      const colorData = window.COLOR_DEFS[this.targetColor] || window.COLOR_DEFS.red;
      ctx.save();
      ctx.fillStyle = colorData.hex;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, 17, 21, 0, 0, Math.PI * 2);
      ctx.fill();

      // Knot
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy + 19);
      ctx.lineTo(cx + 3, cy + 19);
      ctx.lineTo(cx, cy + 23);
      ctx.closePath();
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(cx - 5, cy - 8, 5, 3, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
      ctx.save();
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = 2;

      if (this.targetShape === 'circle') {
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (this.targetShape === 'square') {
        ctx.beginPath();
        ctx.roundRect(cx - 16, cy - 16, 32, 32, 6);
        ctx.fill();
        ctx.stroke();
      } else if (this.targetShape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 18);
        ctx.lineTo(cx + 18, cy + 14);
        ctx.lineTo(cx - 18, cy + 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.targetShape === 'star') {
        if (window.particleSystem) {
          window.particleSystem.drawStar(ctx, cx, cy, 5, 20, 10);
        }
      }

      // Cute mini eyes & smile
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Blush
      ctx.fillStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.beginPath();
      ctx.arc(cx - 9, cy + 3, 3, 0, Math.PI * 2);
      ctx.arc(cx + 9, cy + 3, 3, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 4, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.restore();
    } else if (this.currentLevel === this.LEVELS.MATCH_SORT) {
      ctx.save();
      // Mini balloon
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(cx - 12, cy - 4, 11, 0, Math.PI * 2);
      ctx.fill();

      // Mini arrow pointing to box
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('➔', cx + 3, cy);

      // Mini box
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(cx + 14, cy - 8, 14, 16);
      ctx.restore();
    } else {
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎈', cx, cy);
    }
  }

  // ---------------- Level 1: Color Pop ----------------
  pickNewTargetColor() {
    const colors = ['red', 'yellow', 'blue', 'green'];
    this.targetColor = colors[Math.floor(Math.random() * colors.length)];
    const colorInfo = window.COLOR_DEFS[this.targetColor];

    const promptStr = `จิ้ม${colorInfo.nameTh}!`;
    this.setPrompt(promptStr, colorInfo.hex);

    if (window.soundCtrl) {
      window.soundCtrl.speakThai(`ภารกิจตอนนี้: จิ้มลูกโป่ง${colorInfo.nameTh}นะจ๊ะ`);
    }

    this.ensureTargetInPlay();
  }

  // ---------------- Level 2: Shape Shifters ----------------
  pickNewTargetShape() {
    const shapes = ['circle', 'square', 'triangle', 'star'];
    this.targetShape = shapes[Math.floor(Math.random() * shapes.length)];
    const shapeInfo = window.SHAPE_DEFS[this.targetShape];

    const promptStr = `แตะ${shapeInfo.nameTh} ยิ้มแฉ่ง! ✨`;
    this.setPrompt(promptStr, '#FACC15');

    if (window.soundCtrl) {
      window.soundCtrl.speakThai(`ภารกิจตอนนี้: แตะลูกโป่งรูป${shapeInfo.nameTh} ยิ้มแฉ่งจ้า`);
    }

    this.ensureTargetInPlay();
  }

  // ---------------- Level 3: Match & Sort ----------------
  initSortingLevel() {
    this.boxes = [
      new window.SortingBox({
        id: 'box_blue_circle',
        colorKey: 'blue',
        shapeKey: 'circle'
      }),
      new window.SortingBox({
        id: 'box_yellow_square',
        colorKey: 'yellow',
        shapeKey: 'square'
      })
    ];
    this.layoutBoxes();

    this.setPrompt('ลากหรือแตะลูกโป่งลงกล่องที่ตรงกันนะจ๊ะ! 🎁', '#38BDF8');
    if (window.soundCtrl) {
      window.soundCtrl.speakThai('ภารกิจตอนนี้: ลากหรือแตะลูกโป่งลงกล่องวิเศษนะจ๊ะ');
    }

    this.spawnSortingBalloons(4);
    this.ensureTargetInPlay();
  }

  ensureTargetInPlay() {
    let hasTarget = false;
    for (const b of this.balloons) {
      if (this.currentLevel === this.LEVELS.COLOR_POP) {
        b.isTarget = (b.colorKey === this.targetColor);
        if (b.isTarget) hasTarget = true;
      } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
        b.isTarget = (b.shapeKey === this.targetShape);
        if (b.isTarget) hasTarget = true;
      } else if (this.currentLevel === this.LEVELS.MATCH_SORT) {
        b.isTarget = this.boxes.some(box => box.isMatching(b));
        if (b.isTarget) hasTarget = true;
      } else {
        b.isTarget = false;
      }
    }

    if (!hasTarget) {
      const b = this.spawnBalloon({
        colorKey: this.currentLevel === this.LEVELS.COLOR_POP ? this.targetColor : undefined,
        shapeKey: this.currentLevel === this.LEVELS.SHAPE_SHIFTER ? this.targetShape : undefined
      });
      b.isTarget = true;
    }
  }

  // ==========================================
  // Spawning Logic
  // ==========================================
  spawnInitialBalloons(count) {
    for (let i = 0; i < count; i++) {
      const y = this.height - (i * (this.height / count)) + (Math.random() * 50);
      this.spawnBalloon({ y: y });
    }
  }

  spawnSortingBalloons(count) {
    for (let i = 0; i < count; i++) {
      const isFirstBox = Math.random() < 0.5;
      const targetBox = isFirstBox ? this.boxes[0] : this.boxes[1];
      this.spawnBalloon({
        colorKey: targetBox.colorKey,
        shapeKey: targetBox.shapeKey,
        y: (this.height * 0.4) - (i * 90),
        vy: -(Math.random() * 0.4 + 0.5) // Float slower in sort level
      });
    }
  }

  spawnBalloon(customProps = {}) {
    const isSmallScreen = Math.min(this.width, this.height) < 600;
    const baseRadius = isSmallScreen ? 50 : 64;

    const colors = ['red', 'yellow', 'blue', 'green', 'purple', 'orange'];
    const shapes = ['circle', 'square', 'triangle', 'star'];

    const chosenColor = customProps.colorKey || colors[Math.floor(Math.random() * colors.length)];
    const chosenShape = customProps.shapeKey || (this.currentLevel === this.LEVELS.COLOR_POP ? 'circle' : shapes[Math.floor(Math.random() * shapes.length)]);

    const b = new window.Balloon({
      x: customProps.x || Math.random() * (this.width - baseRadius * 3) + baseRadius * 1.5,
      y: customProps.y || (this.height + baseRadius * 1.5),
      radius: baseRadius,
      colorKey: chosenColor,
      shapeKey: chosenShape,
      showFace: this.currentLevel !== this.LEVELS.COLOR_POP || Math.random() > 0.3,
      vy: customProps.vy || -(Math.random() * 0.6 + 0.8)
    });

    this.balloons.push(b);
    return b;
  }

  // ==========================================
  // Input Handling (Pointer Multi-Touch & Mouse)
  // ==========================================
  setupInputs() {
    const handlePointerDown = (e) => {
      e.preventDefault();
      // Unlock Web Audio context immediately
      if (window.soundCtrl) {
        window.soundCtrl.initContext();
      }

      // First user tap unlocks browser speech and speaks current mission
      if (!this.hasUserInteracted) {
        this.hasUserInteracted = true;
        setTimeout(() => this.replayPrompt(), 150);
      }

      this.lastInteractTime = Date.now();
      this.isGuiding = false;
      if (this.guideHand) {
        this.guideHand.alpha = 0;
      }

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.activeTouches.set(e.pointerId, { x, y });

      // Add touch ripple
      if (window.particleSystem) {
        window.particleSystem.addRipple(x, y, '#FFFFFF', 65, 3);
      }

      // Check hit on balloons (generous 1.85x hitbox)
      for (let i = this.balloons.length - 1; i >= 0; i--) {
        const b = this.balloons[i];
        if (b.containsPoint(x, y)) {
          if (this.currentLevel === this.LEVELS.MATCH_SORT) {
            // Initiate drag or assist tap
            b.isDragging = true;
            b.dragPointerId = e.pointerId;
            b.dragStartX = x;
            b.dragStartY = y;
            b.dragOffsetX = b.x - x;
            b.dragOffsetY = b.y - y;
            if (window.soundCtrl) window.soundCtrl.playPop(1.4);
          } else {
            this.handleBalloonPop(b, i);
          }
          break;
        }
      }
    };

    const handlePointerMove = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.activeTouches.has(e.pointerId)) {
        this.activeTouches.set(e.pointerId, { x, y });
      }

      // Drag balloon in Level 3
      if (this.currentLevel === this.LEVELS.MATCH_SORT) {
        for (const b of this.balloons) {
          if (b.isDragging && b.dragPointerId === e.pointerId) {
            b.x = x + b.dragOffsetX;
            b.y = y + b.dragOffsetY;
          }
        }
      }
    };

    const handlePointerUp = (e) => {
      e.preventDefault();
      this.activeTouches.delete(e.pointerId);

      // Handle drop or tap in Level 3
      if (this.currentLevel === this.LEVELS.MATCH_SORT) {
        const rect = this.canvas.getBoundingClientRect();
        const upX = e.clientX - rect.left;
        const upY = e.clientY - rect.top;

        for (const b of this.balloons) {
          if (b.isDragging && b.dragPointerId === e.pointerId) {
            b.isDragging = false;
            b.dragPointerId = null;

            const distMoved = Math.hypot(upX - (b.dragStartX || upX), upY - (b.dragStartY || upY));
            if (distMoved < 22) {
              // Toddler tapped! Auto-glide into matching box
              const matchBox = this.boxes.find(box => box.isMatching(b)) || this.boxes[0];
              if (window.soundCtrl) window.soundCtrl.playSparkle();
              b.glideTo(matchBox.x, matchBox.y - matchBox.height * 0.2, () => {
                this.checkBalloonSort(b);
              });
            } else {
              this.checkBalloonSort(b);
            }
            break;
          }
        }
      }
    };

    this.canvas.addEventListener('pointerdown', handlePointerDown);
    this.canvas.addEventListener('pointermove', handlePointerMove);
    this.canvas.addEventListener('pointerup', handlePointerUp);
    this.canvas.addEventListener('pointercancel', handlePointerUp);

    // Replay speech prompt button & entire banner
    if (this.btnReplayVoice) {
      this.btnReplayVoice.addEventListener('click', (e) => {
        e.stopPropagation();
        this.replayPrompt();
        if (window.soundCtrl) window.soundCtrl.playSparkle();
      });
    }

    const promptBanner = document.getElementById('promptBanner');
    if (promptBanner) {
      promptBanner.addEventListener('click', () => {
        this.replayPrompt();
        if (window.soundCtrl) window.soundCtrl.playSparkle();
      });
    }
  }

  replayPrompt(cancelPrevious = true) {
    if (!window.soundCtrl) return;
    window.soundCtrl.initContext();

    let missionText = '';
    if (this.currentLevel === this.LEVELS.COLOR_POP) {
      const colorInfo = window.COLOR_DEFS[this.targetColor];
      missionText = `ภารกิจตอนนี้: จิ้มลูกโป่ง${colorInfo.nameTh}นะจ๊ะ`;
    } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
      const shapeInfo = window.SHAPE_DEFS[this.targetShape];
      missionText = `ภารกิจตอนนี้: แตะลูกโป่งรูป${shapeInfo.nameTh} ยิ้มแฉ่งจ้า`;
    } else if (this.currentLevel === this.LEVELS.MATCH_SORT) {
      missionText = 'ภารกิจตอนนี้: ลากหรือแตะลูกโป่งลงกล่องวิเศษนะจ๊ะ';
    } else if (this.currentLevel === this.LEVELS.FREE_PLAY) {
      missionText = 'ภารกิจตอนนี้: ลานเล่นอิสระ จิ้มลูกโป่งลูกไหนก็ได้เลยจ้า';
    }

    if (missionText) {
      window.soundCtrl.speakThai(missionText, cancelPrevious);
    }
  }

  // ==========================================
  // Balloon Hit & Feedback Logic (Zero Negative)
  // ==========================================
  handleBalloonPop(balloon, index) {
    let isCorrect = false;

    if (this.currentLevel === this.LEVELS.COLOR_POP) {
      isCorrect = (balloon.colorKey === this.targetColor);
    } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
      isCorrect = (balloon.shapeKey === this.targetShape);
    } else if (this.currentLevel === this.LEVELS.FREE_PLAY) {
      isCorrect = true;
    }

    if (isCorrect) {
      // 1. Instant POP Audio & Confetti (No device shaking/vibration)
      if (window.soundCtrl) {
        window.soundCtrl.playPop();
        window.soundCtrl.playChime(659.25); // E5
      }

      if (window.particleSystem) {
        window.particleSystem.spawnPopExplosion(
          balloon.x,
          balloon.y,
          balloon.colorData.hex,
          balloon.shapeKey,
          30
        );
      }

      // Remove balloon safely
      const idx = this.balloons.indexOf(balloon);
      if (idx !== -1) {
        this.balloons.splice(idx, 1);
      }

      // Praise Voice
      if (this.currentLevel === this.LEVELS.COLOR_POP) {
        const colorInfo = window.COLOR_DEFS[this.targetColor];
        if (window.soundCtrl) {
          window.soundCtrl.speakThai(`${colorInfo.nameTh} เก่งมาก!`);
        }
      } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
        const shapeInfo = window.SHAPE_DEFS[this.targetShape];
        if (window.soundCtrl) {
          window.soundCtrl.speakThai(`${shapeInfo.nameTh} เก่งมากจ้า!`);
        }
      }

      // Increment progress & save stars (ปรับแต่งคะแนนได้ตามใจชอบ พร้อมเอฟเฟกต์ตัวเลขลอย)
      this.levelProgress++;
      this.updateProgressHUD();
      const starsEarned = (window.saveManager && window.saveManager.getStarsPerPop) 
        ? window.saveManager.getStarsPerPop() 
        : 10;
      if (window.saveManager) {
        window.saveManager.addStars(starsEarned);
        this.updateProfileHUD();
      }

      // แสดงตัวเลขคะแนนลอยขึ้นมา เช่น +10 ⭐
      if (window.particleSystem && window.particleSystem.spawnScoreFloat) {
        window.particleSystem.spawnScoreFloat(balloon.x, balloon.y - 25, `+${starsEarned} ⭐`, '#F59E0B');
      }

      // Check level advance
      if (this.levelProgress >= this.targetProgress) {
        this.handleLevelWin();
      } else {
        // Change target
        if (this.currentLevel === this.LEVELS.COLOR_POP) {
          setTimeout(() => this.pickNewTargetColor(), 900);
        } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
          setTimeout(() => this.pickNewTargetShape(), 900);
        }
      }
    } else {
      // ZERO NEGATIVE FEEDBACK: Soft Jelly Squish & Gentle Identification
      balloon.squish();
      if (window.soundCtrl) {
        window.soundCtrl.playBoing();
        if (this.currentLevel === this.LEVELS.COLOR_POP) {
          window.soundCtrl.speakThai(`นี่${balloon.colorData.nameTh}นะจ๊ะ`);
        } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
          window.soundCtrl.speakThai(`นี่${balloon.shapeData.nameTh}จ้า`);
        }
      }
    }
  }

  // Level 3 Sorting Check
  checkBalloonSort(balloon) {
    let droppedInBox = null;
    for (const box of this.boxes) {
      if (box.containsBalloon(balloon)) {
        droppedInBox = box;
        break;
      }
    }

    if (droppedInBox) {
      if (droppedInBox.isMatching(balloon)) {
        // Correct Sort! Box eats balloon
        droppedInBox.eat(balloon);
        const idx = this.balloons.indexOf(balloon);
        if (idx !== -1) {
          this.balloons.splice(idx, 1);
        }

        if (window.soundCtrl) {
          window.soundCtrl.speakThai('หม่ำๆ อร่อยจัง! เก่งมาก!');
        }

        this.levelProgress++;
        this.updateProgressHUD();
        const baseStars = (window.saveManager && window.saveManager.getStarsPerPop) 
          ? window.saveManager.getStarsPerPop() 
          : 10;
        const sortStars = baseStars * 2;
        if (window.saveManager) {
          window.saveManager.addStars(sortStars);
          this.updateProfileHUD();
        }

        // แสดงคะแนนลอยตัวหน้ากล่องวิเศษ
        if (window.particleSystem && window.particleSystem.spawnScoreFloat) {
          window.particleSystem.spawnScoreFloat(droppedInBox.x, droppedInBox.y - droppedInBox.height * 0.4, `+${sortStars} ⭐`, '#F59E0B');
        }

        if (this.levelProgress >= this.targetProgress) {
          this.handleLevelWin();
        } else {
          // Spawn replacement
          setTimeout(() => this.spawnSortingBalloons(1), 600);
        }
      } else {
        // Gentle bounce back (No negative buzzer)
        droppedInBox.reject(balloon);
      }
    }
  }

  // Level Win & Celebration
  handleLevelWin() {
    if (window.saveManager) {
      window.saveManager.unlockLevel(this.currentLevel + 1);
      window.saveManager.addTrophy('ผ่านด่าน ' + this.currentLevel);
      this.updateProfileHUD();
    }

    if (window.soundCtrl) {
      window.soundCtrl.playFanfare();
      window.soundCtrl.playSparkle();
    }

    if (window.particleSystem) {
      // Fireworks fountain
      for (let k = 0; k < 6; k++) {
        setTimeout(() => {
          const x = Math.random() * (this.width - 200) + 100;
          const y = Math.random() * (this.height * 0.4) + 100;
          window.particleSystem.spawnPopExplosion(x, y, '#FACC15', 'star', 35);
        }, k * 200);
      }
    }

    // Show celebration overlay
    setTimeout(() => {
      this.showCelebration();
    }, 500);
  }

  showCelebration() {
    if (!this.celebrationModal) return;
    const title = document.getElementById('celebrationTitle');
    const msg = document.getElementById('celebrationMsg');
    const btnNext = document.getElementById('btnCelebrationNext');

    if (this.currentLevel === this.LEVELS.COLOR_POP) {
      title.textContent = '🎉 ผ่านด่านที่ 1 แล้ว! 🎉';
      msg.textContent = 'หนูรู้จักสีสัน เก่งที่สุดเลย!';
      btnNext.textContent = 'ไปด่าน 2 กันเถอะ! ⭐';
      btnNext.onclick = () => this.startLevel(this.LEVELS.SHAPE_SHIFTER);
    } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
      title.textContent = '🌟 ผ่านด่านที่ 2 แล้ว! 🌟';
      msg.textContent = 'รู้จักรูปทรงแสนน่ารัก ยอดเยี่ยมมาก!';
      btnNext.textContent = 'ไปด่าน 3 กล่องวิเศษ! 🎁';
      btnNext.onclick = () => this.startLevel(this.LEVELS.MATCH_SORT);
    } else if (this.currentLevel === this.LEVELS.MATCH_SORT) {
      title.textContent = '🏆 สุดยอดนักแยกหมวดหมู่! 🏆';
      msg.textContent = 'รับถ้วยรางวัลทองคำไปเลยจ้า!';
      btnNext.textContent = 'เล่นโหมดอิสระไม่จำกัด 🎈';
      btnNext.onclick = () => this.startLevel(this.LEVELS.FREE_PLAY);
    }

    this.celebrationModal.classList.add('show');
    if (window.soundCtrl) {
      window.soundCtrl.speakThai('ยอดเยี่ยมที่สุดเลย! หนูเก่งมากๆ เลยนะ!');
    }
  }

  hideCelebration() {
    if (this.celebrationModal) {
      this.celebrationModal.classList.remove('show');
    }
  }

  // ==========================================
  // Parental Gate (3-Second Continuous Hold)
  // ==========================================
  setupParentalGate() {
    if (!this.parentalGateBtn || !this.parentalGateMeter) return;

    const circumference = 2 * Math.PI * 30; // r=30
    this.parentalGateMeter.style.strokeDasharray = `${circumference}`;
    this.parentalGateMeter.style.strokeDashoffset = `${circumference}`;

    const startHold = (e) => {
      e.preventDefault();
      this.gateHoldActive = true;
      this.gateHoldStartTime = Date.now();
      this.parentalGateBtn.classList.add('holding');

      const updateMeter = () => {
        if (!this.gateHoldActive) return;
        const elapsed = Date.now() - this.gateHoldStartTime;
        const progress = Math.min(1.0, elapsed / this.gateHoldDuration);
        const offset = circumference * (1.0 - progress);
        this.parentalGateMeter.style.strokeDashoffset = `${offset}`;

        if (progress >= 1.0) {
          // Success! Unlock parental menu
          this.gateHoldActive = false;
          this.parentalGateBtn.classList.remove('holding');
          this.parentalGateMeter.style.strokeDashoffset = `${circumference}`;
          if (window.soundCtrl) window.soundCtrl.playChime(783.99);
          this.openParentalModal();
          return;
        }

        this.gateHoldTimer = requestAnimationFrame(updateMeter);
      };

      this.gateHoldTimer = requestAnimationFrame(updateMeter);
    };

    const cancelHold = (e) => {
      this.gateHoldActive = false;
      this.parentalGateBtn.classList.remove('holding');
      this.parentalGateMeter.style.strokeDashoffset = `${circumference}`;
      if (this.gateHoldTimer) {
        cancelAnimationFrame(this.gateHoldTimer);
      }
    };

    this.parentalGateBtn.addEventListener('pointerdown', startHold);
    this.parentalGateBtn.addEventListener('pointerup', cancelHold);
    this.parentalGateBtn.addEventListener('pointerleave', cancelHold);
    this.parentalGateBtn.addEventListener('pointercancel', cancelHold);
  }

  openParentalModal() {
    if (this.parentalModal) {
      this.parentalModal.classList.add('open');
    }
  }

  closeParentalModal() {
    if (this.parentalModal) {
      this.parentalModal.classList.remove('open');
    }
  }

  // ==========================================
  // Settings & HUD Controls
  // ==========================================
  setupHUDControls() {
    const btnCameraToggle = document.getElementById('btnCameraToggle');
    const btnMicToggle = document.getElementById('btnMicToggle');

    if (btnCameraToggle) {
      btnCameraToggle.addEventListener('click', async () => {
        if (window.visionTracker.isActive) {
          window.visionTracker.stop();
          if (this.webcamContainer) this.webcamContainer.style.display = 'none';
          btnCameraToggle.classList.remove('border-emerald-400', 'bg-emerald-50');
        } else {
          if (this.webcamContainer) this.webcamContainer.style.display = 'block';
          const ok = await window.visionTracker.start(this.webcamVideo);
          if (ok) {
            btnCameraToggle.classList.add('border-emerald-400', 'bg-emerald-50');
            if (window.soundCtrl) window.soundCtrl.speakThai('เปิดกล้องตรวจจับการโบกมือแล้วจ้า');
          } else {
            if (this.webcamContainer) this.webcamContainer.style.display = 'none';
          }
        }
      });
    }

    if (btnMicToggle) {
      btnMicToggle.addEventListener('click', async () => {
        if (window.micController.isActive) {
          window.micController.stop();
          if (this.micVisualizer) this.micVisualizer.classList.remove('active');
          btnMicToggle.classList.remove('border-sky-400', 'bg-sky-50');
        } else {
          const ok = await window.micController.start();
          if (ok) {
            if (this.micVisualizer) this.micVisualizer.classList.add('active');
            btnMicToggle.classList.add('border-sky-400', 'bg-sky-50');
            if (window.soundCtrl) window.soundCtrl.speakThai('เปิดไมค์ตรวจจับเสียงเป่าแล้วจ้า');
          }
        }
      });

      // Mic trigger event: blows or shouts lift all balloons!
      window.micController.onTrigger = (level) => {
        if (window.soundCtrl) window.soundCtrl.playWhoosh();
        if (window.particleSystem) window.particleSystem.spawnWindGust(this.width, this.height);

        // Boost balloons upwards
        for (const b of this.balloons) {
          b.boostUp(Math.random() * 3.5 + 4.5);
        }
      };
    }
  }

  setupSettingsUI() {
    const btnCloseModal = document.getElementById('btnCloseParentalModal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => this.closeParentalModal());
    }

    // Level Select in Parental Modal
    document.querySelectorAll('[data-set-level]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lvl = parseInt(e.currentTarget.getAttribute('data-set-level'), 10);
        this.startLevel(lvl);
        this.closeParentalModal();
      });
    });

    // Audio switches
    const toggleSfx = document.getElementById('toggleSfx');
    const toggleBgm = document.getElementById('toggleBgm');
    const toggleVoice = document.getElementById('toggleVoice');

    if (toggleSfx) {
      toggleSfx.addEventListener('change', (e) => {
        if (window.soundCtrl) window.soundCtrl.setMuted(!e.target.checked);
      });
    }
    if (toggleBgm) {
      toggleBgm.addEventListener('change', (e) => {
        if (window.soundCtrl) window.soundCtrl.setBgmEnabled(e.target.checked);
      });
    }
    if (toggleVoice) {
      toggleVoice.addEventListener('change', (e) => {
        if (window.soundCtrl) window.soundCtrl.setSpeechEnabled(e.target.checked);
      });
    }

    // Mic sensitivity slider
    const micSens = document.getElementById('micSensitivity');
    if (micSens) {
      micSens.addEventListener('input', (e) => {
        if (window.micController) window.micController.setSensitivity(parseInt(e.target.value, 10));
      });
    }

    // Stars per pop customization (กำหนดคะแนนดาวต่อลูกโป่ง)
    const currentRateBadge = document.getElementById('currentScoreRateBadge');
    const inputCustomScore = document.getElementById('inputCustomScore');
    const btnSaveCustomScore = document.getElementById('btnSaveCustomScore');
    const presetBtns = document.querySelectorAll('[data-score-preset]');

    const updateScoreUI = (scoreVal) => {
      if (currentRateBadge) currentRateBadge.textContent = `+${scoreVal} ⭐ / ลูก`;
      if (inputCustomScore) inputCustomScore.value = scoreVal;
      presetBtns.forEach(btn => {
        const pVal = parseInt(btn.getAttribute('data-score-preset'), 10);
        if (pVal === scoreVal) {
          btn.className = 'score-preset-btn py-1.5 bg-amber-400 text-white font-extrabold rounded-xl text-xs shadow active:scale-95 transition-all ring-2 ring-amber-300';
        } else {
          btn.className = 'score-preset-btn py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-100 active:scale-95 transition-all';
        }
      });
    };

    if (window.saveManager) {
      updateScoreUI(window.saveManager.getStarsPerPop());
    }

    presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.getAttribute('data-score-preset'), 10);
        if (window.saveManager) {
          window.saveManager.setStarsPerPop(val);
          updateScoreUI(val);
          if (window.soundCtrl) window.soundCtrl.playSparkle();
        }
      });
    });

    if (btnSaveCustomScore && inputCustomScore) {
      btnSaveCustomScore.addEventListener('click', () => {
        const val = parseInt(inputCustomScore.value, 10);
        if (window.saveManager && !isNaN(val) && val > 0) {
          const finalVal = window.saveManager.setStarsPerPop(val);
          updateScoreUI(finalVal);
          if (window.soundCtrl) window.soundCtrl.playSparkle();
          alert(`ตั้งค่าคะแนนเรียบร้อยแล้ว: +${finalVal} ⭐ ต่อ 1 ลูกโป่ง`);
        }
      });
    }

    // Target pops to win customization (จำนวนลูกโป่งเพื่อชนะผ่านด่าน)
    const currentTargetPopsBadge = document.getElementById('currentTargetPopsBadge');
    const inputCustomTargetPops = document.getElementById('inputCustomTargetPops');
    const btnSaveCustomTargetPops = document.getElementById('btnSaveCustomTargetPops');
    const targetPresetBtns = document.querySelectorAll('[data-target-preset]');

    const updateTargetPopsUI = (targetVal) => {
      if (currentTargetPopsBadge) currentTargetPopsBadge.textContent = `${targetVal} ลูก / ด่าน`;
      if (inputCustomTargetPops) inputCustomTargetPops.value = targetVal;
      targetPresetBtns.forEach(btn => {
        const pVal = parseInt(btn.getAttribute('data-target-preset'), 10);
        if (pVal === targetVal) {
          btn.className = 'target-preset-btn py-1.5 bg-sky-500 text-white font-extrabold rounded-xl text-xs shadow active:scale-95 transition-all ring-2 ring-sky-300';
        } else {
          btn.className = 'target-preset-btn py-1.5 bg-white border border-sky-300 rounded-xl text-xs font-bold text-sky-800 hover:bg-sky-100 active:scale-95 transition-all';
        }
      });
      this.targetProgress = targetVal;
      this.updateProgressHUD();
    };

    if (window.saveManager) {
      updateTargetPopsUI(window.saveManager.getTargetPops());
    }

    targetPresetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.getAttribute('data-target-preset'), 10);
        if (window.saveManager) {
          window.saveManager.setTargetPops(val);
          updateTargetPopsUI(val);
          if (window.soundCtrl) window.soundCtrl.playSparkle();
        }
      });
    });

    if (btnSaveCustomTargetPops && inputCustomTargetPops) {
      btnSaveCustomTargetPops.addEventListener('click', () => {
        const val = parseInt(inputCustomTargetPops.value, 10);
        if (window.saveManager && !isNaN(val) && val > 0) {
          const finalVal = window.saveManager.setTargetPops(val);
          updateTargetPopsUI(finalVal);
          if (window.soundCtrl) window.soundCtrl.playSparkle();
          alert(`ตั้งค่าเป้าหมายเรียบร้อยแล้ว: จิ้ม ${finalVal} ลูกเพื่อผ่านด่าน 🎯`);
        }
      });
    }
  }

  // ==========================================
  // Level Selector Modal & Free Play Dock
  // ==========================================
  setupLevelSelectorUI() {
    const btnLevelSelector = document.getElementById('btnLevelSelector');
    const levelModal = document.getElementById('levelModal');
    const btnCloseLevelModal = document.getElementById('btnCloseLevelModal');
    const btnCelebrationChooseLevel = document.getElementById('btnCelebrationChooseLevel');

    const openLevelModal = () => {
      if (levelModal) levelModal.classList.add('open');
    };
    const closeLevelModal = () => {
      if (levelModal) levelModal.classList.remove('open');
    };

    if (btnLevelSelector) {
      btnLevelSelector.addEventListener('click', () => openLevelModal());
    }
    if (btnCloseLevelModal) {
      btnCloseLevelModal.addEventListener('click', () => closeLevelModal());
    }
    if (btnCelebrationChooseLevel) {
      btnCelebrationChooseLevel.addEventListener('click', () => {
        this.hideCelebration();
        openLevelModal();
      });
    }

    // Modal Level Select buttons
    document.querySelectorAll('[data-select-level]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lvl = parseInt(e.currentTarget.getAttribute('data-select-level'), 10);
        this.startLevel(lvl);
        closeLevelModal();
        if (window.soundCtrl) window.soundCtrl.playSparkle();
      });
    });

    // Free Play dock quick buttons
    document.querySelectorAll('[data-quick-level]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lvl = parseInt(e.currentTarget.getAttribute('data-quick-level'), 10);
        this.startLevel(lvl);
        if (window.soundCtrl) window.soundCtrl.playSparkle();
      });
    });
  }

  // ==========================================
  // Player Profile & Save Management ("เซฟใครเซฟมัน")
  // ==========================================
  updateProfileHUD() {
    if (!window.saveManager) return;
    const p = window.saveManager.activeProfile;
    if (!p) return;

    const elAvatar = document.getElementById('playerAvatar');
    const elName = document.getElementById('playerName');
    const elStars = document.getElementById('playerStars');
    const elStarsBadge = document.getElementById('activeProfileStarsBadge');

    if (elAvatar) elAvatar.textContent = p.avatar || '⭐';
    if (elName) elName.textContent = p.name || 'น้องคนเก่ง';
    if (elStars) elStars.textContent = `⭐ ${p.stars || 0}`;
    if (elStarsBadge) elStarsBadge.textContent = `⭐ ${p.stars || 0} ดวง`;

    // Populate profile select dropdown in Parental Modal
    const select = document.getElementById('profileSelect');
    if (select) {
      select.innerHTML = '';
      window.saveManager.getAllProfiles().forEach(profile => {
        const opt = document.createElement('option');
        opt.value = profile.id;
        opt.textContent = `${profile.avatar} ${profile.name} (⭐ ${profile.stars || 0})`;
        if (profile.id === p.id) opt.selected = true;
        select.appendChild(opt);
      });
    }
  }

  setupProfileUI() {
    const pill = document.getElementById('playerProfilePill');
    if (pill) {
      pill.addEventListener('click', () => {
        this.openParentalModal();
      });
    }

    const select = document.getElementById('profileSelect');
    if (select) {
      select.addEventListener('change', (e) => {
        const targetId = e.target.value;
        const p = window.saveManager.profiles[targetId];
        if (p && p.pin) {
          const pin = prompt(`กรุณาใส่รหัส PIN 4 หลักของ ${p.name}:`);
          if (pin === null) {
            this.updateProfileHUD();
            return;
          }
          const res = window.saveManager.switchProfile(targetId, pin);
          if (!res.success) {
            alert(res.reason);
            this.updateProfileHUD();
            return;
          }
        } else {
          window.saveManager.switchProfile(targetId);
        }
        this.updateProfileHUD();
        if (window.soundCtrl) window.soundCtrl.playSparkle();
      });
    }

    const btnNewProfile = document.getElementById('btnNewProfile');
    if (btnNewProfile) {
      btnNewProfile.addEventListener('click', () => {
        const name = prompt('กรุณากรอกชื่อน้อง (เช่น น้องมีนา, น้องภูผา):');
        if (!name) return;
        const pin = prompt('ตั้งรหัส PIN 4 หลัก (หรือกดตกลงเพื่อไม่ใช้รหัส):') || '';
        const avatars = ['⭐', '🦁', '🐰', '🐻', '🐱', '🐶', '🦄', '🚀'];
        const avatar = avatars[Math.floor(Math.random() * avatars.length)];
        window.saveManager.createProfile(name, avatar, pin);
        this.updateProfileHUD();
        if (window.soundCtrl) window.soundCtrl.playFanfare();
      });
    }

    const btnCopy = document.getElementById('btnCopySaveCode');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const code = window.saveManager.exportSaveCode();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            alert('คัดลอกรหัสเซฟเรียบร้อยแล้ว!\nสามารถนำรหัสนี้ไปใส่ในเครื่องอื่นเพื่อเล่นต่อได้เลยครับ 📲');
          }).catch(() => {
            prompt('รหัสเซฟของคุณ (คัดลอกข้อความนี้):', code);
          });
        } else {
          prompt('รหัสเซฟของคุณ (คัดลอกข้อความนี้):', code);
        }
      });
    }

    const btnImport = document.getElementById('btnImportSaveCode');
    if (btnImport) {
      btnImport.addEventListener('click', () => {
        const code = prompt('วางรหัสเซฟที่ได้จากอีกเครื่องที่นี่:');
        if (!code) return;
        const res = window.saveManager.importSaveCode(code);
        if (res.success) {
          alert(`กู้คืนโปรไฟล์ของ "${res.profile.name}" สำเร็จ! (⭐ ${res.profile.stars} ดวง)`);
          this.updateProfileHUD();
          if (window.soundCtrl) window.soundCtrl.playFanfare();
        } else {
          alert(res.reason);
        }
      });
    }
  }

  // ==========================================
  // Main Game Loop (60 FPS)
  // ==========================================
  loop(time) {
    const dt = time - (this.lastTime || time);
    this.lastTime = time;

    this.update(time);
    this.draw(time);

    requestAnimationFrame((t) => this.loop(t));
  }

  update(time) {
    // 1. Check Idle Hesitation Assist
    if (Date.now() - this.lastInteractTime > this.idleHesitationTime) {
      this.isGuiding = true;
    }

    // 2. Camera Motion Tracking update
    if (window.visionTracker.isActive) {
      window.visionTracker.update(this.width, this.height);
      const wand = window.visionTracker.getPointer(this.width, this.height);
      if (wand && Date.now() - this.lastWandHitTime > 350) {
        for (let i = this.balloons.length - 1; i >= 0; i--) {
          const b = this.balloons[i];
          if (b.containsPoint(wand.x, wand.y)) {
            this.lastWandHitTime = Date.now();
            this.handleBalloonPop(b, i);
            break;
          }
        }
      }
    }

    // 3. Microphone Volume Update
    if (window.micController.isActive) {
      window.micController.update();
      const bars = document.querySelectorAll('.mic-bar');
      const lvl = window.micController.currentLevel;
      bars.forEach((bar, idx) => {
        const h = Math.min(32, Math.max(10, (lvl / 80) * (20 + idx * 8)));
        bar.style.height = `${h}px`;
      });
    }

    // 4. Update Particle System
    if (window.particleSystem) {
      window.particleSystem.update();
    }

    // 5. Update Balloons
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER && this.isGuiding && b.shapeKey === this.targetShape) {
        b.isGuiding = true;
      } else {
        b.isGuiding = false;
      }
      b.update(time, this.width, this.height);
    }

    // 6. Update Sorting Boxes (Level 3)
    if (this.currentLevel === this.LEVELS.MATCH_SORT) {
      for (const box of this.boxes) {
        box.update(time, this.balloons);
      }
    }

    // 7. Auto spawn balloons if count is low
    this.spawnTimer++;
    const maxBalloons = this.currentLevel === this.LEVELS.MATCH_SORT ? 4 : 6;
    if (this.balloons.length < maxBalloons && this.spawnTimer > 120) {
      this.spawnTimer = 0;
      if (this.currentLevel === this.LEVELS.MATCH_SORT) {
        this.spawnSortingBalloons(1);
      } else {
        this.spawnBalloon();
        this.ensureTargetInPlay();
      }
    }

    // 8. Update Interactive Demo Guide Hand (เด็กไม่ต้องอ่านหนังสือออก)
    this.updateGuideHand(time);
  }

  updateGuideHand(time) {
    const idleTime = Date.now() - this.lastInteractTime;

    // Fade in if idle > 2.0s
    if (idleTime > 2000) {
      this.guideHand.alpha = Math.min(1.0, this.guideHand.alpha + 0.04);
    } else {
      this.guideHand.alpha = Math.max(0, this.guideHand.alpha - 0.1);
      return;
    }

    // Friendly audio repetition if idle > 5.5s
    if (idleTime > 5500 && (Date.now() - this.lastAudioPromptTime > 6500)) {
      this.lastAudioPromptTime = Date.now();
      if (window.soundCtrl) {
        window.soundCtrl.playChime(659.25);
        if (this.currentLevel === this.LEVELS.COLOR_POP) {
          const colorInfo = window.COLOR_DEFS[this.targetColor];
          window.soundCtrl.speakThai(`ภารกิจตอนนี้: จิ้มลูกโป่ง${colorInfo.nameTh}ตรงนี้เลยจ้า`);
        } else if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER) {
          const shapeInfo = window.SHAPE_DEFS[this.targetShape];
          window.soundCtrl.speakThai(`ภารกิจตอนนี้: แตะรูป${shapeInfo.nameTh}ตรงนี้เลยจ้าคนเก่ง`);
        } else if (this.currentLevel === this.LEVELS.MATCH_SORT) {
          window.soundCtrl.speakThai('ภารกิจตอนนี้: พาลูกโป่งลงกล่องวิเศษกันนะจ๊ะ');
        }
      }
    }

    // Find target balloon
    let targetBalloon = null;
    for (const b of this.balloons) {
      if (this.currentLevel === this.LEVELS.COLOR_POP && b.colorKey === this.targetColor) {
        targetBalloon = b;
        break;
      }
      if (this.currentLevel === this.LEVELS.SHAPE_SHIFTER && b.shapeKey === this.targetShape) {
        targetBalloon = b;
        break;
      }
      if (this.currentLevel === this.LEVELS.MATCH_SORT && this.boxes.some(box => box.isMatching(b))) {
        targetBalloon = b;
        break;
      }
    }

    if (!targetBalloon) return;

    if (this.currentLevel === this.LEVELS.MATCH_SORT) {
      // In Level 3: Guide hand shows dragging from balloon into matching box!
      const targetBox = this.boxes.find(box => box.isMatching(targetBalloon)) || this.boxes[0];
      this.guideHand.dragProgress = (this.guideHand.dragProgress + 0.012) % 1.0;
      const t = this.guideHand.dragProgress;

      const startX = targetBalloon.x;
      const startY = targetBalloon.y;
      const endX = targetBox.x;
      const endY = targetBox.y - targetBox.height * 0.25;

      this.guideHand.x = startX + (endX - startX) * t;
      this.guideHand.y = startY + (endY - startY) * t;
      this.guideHand.tapScale = 1.0;

      if (t > 0.95 && window.particleSystem && Math.random() < 0.2) {
        window.particleSystem.addRipple(endX, endY, '#FACC15', 40, 2);
      }
    } else {
      // In Level 1 & 2: Guide hand glides to target balloon and taps!
      const targetX = targetBalloon.x;
      const targetY = targetBalloon.y + 15;

      this.guideHand.x += (targetX - this.guideHand.x) * 0.12;
      this.guideHand.y += (targetY - this.guideHand.y) * 0.12;

      const dist = Math.hypot(targetX - this.guideHand.x, targetY - this.guideHand.y);
      if (dist < 40) {
        // Tapping animation
        const tapCycle = Math.sin(time * 0.007);
        this.guideHand.tapScale = 1.0 - Math.max(0, tapCycle) * 0.22;

        if (tapCycle > 0.95 && (Date.now() - this.guideHand.lastTapTime > 600)) {
          this.guideHand.lastTapTime = Date.now();
          if (window.particleSystem) {
            window.particleSystem.addRipple(targetBalloon.x, targetBalloon.y, '#FACC15', 60, 3);
          }
        }
      } else {
        this.guideHand.tapScale = 1.0;
      }
    }
  }

  draw(time) {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Sorting Boxes in Level 3
    if (this.currentLevel === this.LEVELS.MATCH_SORT) {
      for (const box of this.boxes) {
        box.draw(this.ctx);
      }
    }

    // 2. Draw Balloons
    for (const b of this.balloons) {
      b.draw(this.ctx);
    }

    // 3. Draw Particle Effects
    if (window.particleSystem) {
      window.particleSystem.draw(this.ctx);
    }

    // 4. Draw Camera Wand Cursor
    if (window.visionTracker.isActive) {
      window.visionTracker.draw(this.ctx, this.width, this.height);
    }

    // 5. Draw Interactive Demo Guide Hand (เด็กเห็นปุ๊บรู้ปั๊บ)
    this.drawGuideHand(this.ctx, time);
  }

  drawGuideHand(ctx, time) {
    if (this.guideHand.alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = this.guideHand.alpha;
    ctx.translate(this.guideHand.x, this.guideHand.y);
    ctx.scale(this.guideHand.tapScale, this.guideHand.tapScale);

    // Glowing halo around hand
    ctx.save();
    const haloGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 35);
    haloGrad.addColorStop(0, 'rgba(250, 204, 21, 0.6)');
    haloGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cartoon Pointer Hand with pointing index finger
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    // Index finger pointing up-left
    ctx.moveTo(0, -32);
    ctx.lineTo(8, -32);
    ctx.quadraticCurveTo(14, -32, 14, -20);
    ctx.lineTo(14, -6);
    // Knuckles / other curled fingers
    ctx.lineTo(24, -2);
    ctx.quadraticCurveTo(28, 4, 24, 10);
    ctx.lineTo(22, 18);
    // Wrist
    ctx.lineTo(16, 26);
    ctx.lineTo(-4, 26);
    ctx.lineTo(-6, 16);
    // Thumb curved in
    ctx.quadraticCurveTo(-14, 8, -12, 0);
    ctx.quadraticCurveTo(-10, -8, -2, -6);
    ctx.lineTo(-2, -22);
    ctx.quadraticCurveTo(-2, -32, 0, -32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cute blue cuff band
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.roundRect(-7, 22, 26, 8, 4);
    ctx.fill();
    ctx.stroke();

    // "แตะตรงนี้" mini cute bubble badge
    ctx.fillStyle = '#FEF08A';
    ctx.strokeStyle = '#CA8A04';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(16, -38, 70, 24, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 12px Kanit, Prompt, sans-serif';
    ctx.fillStyle = '#854D0E';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('แตะตรงนี้ ✨', 51, -26);

    ctx.restore();
  }
}

// Launch game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
