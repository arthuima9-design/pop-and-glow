/**
 * Pop & Glow: Player Profile & Save System (ระบบเซฟใครเซฟมัน)
 * รองรับหลายโปรไฟล์, PIN รหัสผ่าน 4 หลัก, และโค้ดย้ายเซฟข้ามเครื่อง
 */

class SaveManager {
  constructor() {
    this.storageKey = 'pop_glow_profiles_v1';
    this.activeProfileKey = 'pop_glow_active_id_v1';
    this.profiles = {};
    this.activeProfile = null;

    this.init();
  }

  init() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.profiles = JSON.parse(saved);
      }
    } catch (e) {
      this.profiles = {};
    }

    // If no profiles exist yet, create default profile
    if (Object.keys(this.profiles).length === 0) {
      const defaultId = 'profile_default';
      this.profiles[defaultId] = {
        id: defaultId,
        name: 'น้องคนเก่ง',
        avatar: '⭐',
        pin: '',
        stars: 0,
        maxLevelUnlocked: 1,
        trophies: [],
        createdAt: Date.now()
      };
      this.saveToStorage();
    }

    // Restore active profile
    let activeId = localStorage.getItem(this.activeProfileKey);
    if (!activeId || !this.profiles[activeId]) {
      activeId = Object.keys(this.profiles)[0];
    }
    this.activeProfile = this.profiles[activeId];
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
      if (this.activeProfile) {
        localStorage.setItem(this.activeProfileKey, this.activeProfile.id);
      }
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  /**
   * Create a new child profile with optional 4-digit PIN
   */
  createProfile(name, avatar = '⭐️', pin = '') {
    const id = 'kid_' + Math.random().toString(36).substring(2, 8);
    const newProfile = {
      id: id,
      name: name.trim() || 'น้องคนเก่ง',
      avatar: avatar,
      pin: pin.trim(),
      stars: 0,
      maxLevelUnlocked: 1,
      trophies: [],
      createdAt: Date.now()
    };

    this.profiles[id] = newProfile;
    this.activeProfile = newProfile;
    this.saveToStorage();
    return newProfile;
  }

  /**
   * Switch active profile (verifies PIN if protected)
   */
  switchProfile(profileId, enteredPin = '') {
    const p = this.profiles[profileId];
    if (!p) return { success: false, reason: 'ไม่พบโปรไฟล์นี้' };

    if (p.pin && p.pin !== enteredPin) {
      return { success: false, reason: 'รหัส PIN ไม่ถูกต้อง' };
    }

    this.activeProfile = p;
    this.saveToStorage();
    return { success: true, profile: p };
  }

  /**
   * Add stars when a balloon is popped
   */
  addStars(count = 1) {
    if (!this.activeProfile) return;
    this.activeProfile.stars = (this.activeProfile.stars || 0) + count;
    this.saveToStorage();
  }

  /**
   * Unlock a higher level
   */
  unlockLevel(levelNum) {
    if (!this.activeProfile) return;
    if (levelNum > (this.activeProfile.maxLevelUnlocked || 1)) {
      this.activeProfile.maxLevelUnlocked = levelNum;
      this.saveToStorage();
    }
  }

  /**
   * Add a trophy
   */
  addTrophy(trophyName) {
    if (!this.activeProfile) return;
    if (!this.activeProfile.trophies) this.activeProfile.trophies = [];
    if (!this.activeProfile.trophies.includes(trophyName)) {
      this.activeProfile.trophies.push(trophyName);
      this.saveToStorage();
    }
  }

  /**
   * Export Save Code (รหัสย้ายเซฟข้ามเครื่อง เช่น ส่งทางไลน์หรือใส่ใน iPad)
   */
  exportSaveCode() {
    if (!this.activeProfile) return '';
    try {
      const payload = {
        name: this.activeProfile.name,
        avatar: this.activeProfile.avatar,
        pin: this.activeProfile.pin,
        stars: this.activeProfile.stars,
        maxLevelUnlocked: this.activeProfile.maxLevelUnlocked,
        trophies: this.activeProfile.trophies || []
      };
      // Base64 encode save string
      const jsonStr = JSON.stringify(payload);
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      return 'PG-' + b64;
    } catch (e) {
      return '';
    }
  }

  /**
   * Import Save Code from another device
   */
  importSaveCode(saveCode) {
    try {
      let code = saveCode.trim();
      if (code.startsWith('PG-')) {
        code = code.substring(3);
      }
      const jsonStr = decodeURIComponent(escape(atob(code)));
      const data = JSON.parse(jsonStr);

      if (!data.name) throw new Error('Invalid code');

      const id = 'imported_' + Math.random().toString(36).substring(2, 8);
      const importedProfile = {
        id: id,
        name: data.name,
        avatar: data.avatar || '⭐️',
        pin: data.pin || '',
        stars: data.stars || 0,
        maxLevelUnlocked: data.maxLevelUnlocked || 1,
        trophies: data.trophies || [],
        createdAt: Date.now()
      };

      this.profiles[id] = importedProfile;
      this.activeProfile = importedProfile;
      this.saveToStorage();
      return { success: true, profile: importedProfile };
    } catch (e) {
      return { success: false, reason: 'รหัสเซฟไม่ถูกต้อง โปรดตรวจสอบอีกครั้ง' };
    }
  }

  getAllProfiles() {
    return Object.values(this.profiles);
  }
}

window.saveManager = new SaveManager();
