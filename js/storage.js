const Storage = {
  KEYS: {
    PROFILES: 'fitness_profiles',
    RECORDS: 'fitness_records',
    CURRENT_USER: 'fitness_current_user'
  },

  init() {
    if (!localStorage.getItem(this.KEYS.PROFILES)) {
      localStorage.setItem(this.KEYS.PROFILES, JSON.stringify({}));
    }
    if (!localStorage.getItem(this.KEYS.RECORDS)) {
      localStorage.setItem(this.KEYS.RECORDS, JSON.stringify([]));
    }
  },

  // Profiles
  getProfiles() {
    return JSON.parse(localStorage.getItem(this.KEYS.PROFILES) || '{}');
  },

  saveProfile(id, profile) {
    const profiles = this.getProfiles();
    profiles[id] = { ...profiles[id], ...profile };
    localStorage.setItem(this.KEYS.PROFILES, JSON.stringify(profiles));
  },

  getProfile(id) {
    return this.getProfiles()[id] || null;
  },

  hasProfiles() {
    return Object.keys(this.getProfiles()).length >= 2;
  },

  // Current user
  setCurrentUser(id) {
    localStorage.setItem(this.KEYS.CURRENT_USER, id);
  },

  getCurrentUser() {
    return localStorage.getItem(this.KEYS.CURRENT_USER);
  },

  // Records
  getRecords() {
    return JSON.parse(localStorage.getItem(this.KEYS.RECORDS) || '[]');
  },

  addRecord(record) {
    const records = this.getRecords();
    records.push({
      id: Date.now(),
      ...record,
      date: record.date || new Date().toISOString()
    });
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
    return records[records.length - 1];
  },

  deleteRecord(id) {
    const records = this.getRecords().filter(r => r.id !== id);
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
  },

  // Filtered records
  getUserRecords(userId) {
    return this.getRecords().filter(r => r.userId === userId);
  },

  getMonthRecords(userId, year, month) {
    return this.getUserRecords(userId).filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  getTodayRecords(userId) {
    const today = new Date().toISOString().slice(0, 10);
    return this.getUserRecords(userId).filter(r => r.date.slice(0, 10) === today);
  },

  getMonthTotalDistance(userId, year, month) {
    return this.getMonthRecords(userId, year, month)
      .reduce((sum, r) => sum + (r.distance || 0), 0);
  },

  getTodayTotalDistance(userId) {
    return this.getTodayRecords(userId)
      .reduce((sum, r) => sum + (r.distance || 0), 0);
  },

  getTodayTotalCalories(userId) {
    return this.getTodayRecords(userId)
      .reduce((sum, r) => sum + (r.calories || 0), 0);
  },

  getTodayTotalDuration(userId) {
    return this.getTodayRecords(userId)
      .reduce((sum, r) => sum + (r.duration || 0), 0);
  },

  // Streak calculation
  getStreak(userId) {
    const records = this.getUserRecords(userId);
    const dates = [...new Set(records.map(r => r.date.slice(0, 10)))].sort().reverse();
    if (dates.length === 0) return 0;

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 0; i < dates.length - 1; i++) {
      const curr = new Date(dates[i]);
      const prev = new Date(dates[i + 1]);
      const diff = (curr - prev) / 86400000;
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  },

  // Reset
  resetAll() {
    localStorage.removeItem(this.KEYS.PROFILES);
    localStorage.removeItem(this.KEYS.RECORDS);
    localStorage.removeItem(this.KEYS.CURRENT_USER);
    this.init();
  }
};

Storage.init();
