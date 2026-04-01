/* ===== Storage Module - Firebase Firestore + localStorage cache ===== */
const Storage = {
  // Local cache
  _profiles: {},
  _records: [],
  _ready: false,

  // Firestore refs
  get profilesRef() { return db.collection('profiles'); },
  get recordsRef() { return db.collection('records'); },

  // ===== Initialize: load all data from Firestore into local cache =====
  async init() {
    try {
      // Race Firestore load against a 5s timeout
      const firestoreLoad = async () => {
        const profileSnap = await this.profilesRef.get();
        this._profiles = {};
        profileSnap.forEach(doc => {
          this._profiles[doc.id] = doc.data();
        });

        const recordSnap = await this.recordsRef.orderBy('date', 'desc').get();
        this._records = [];
        recordSnap.forEach(doc => {
          this._records.push({ id: doc.id, ...doc.data() });
        });

        this._saveLocalCache();
      };

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore timeout')), 5000)
      );

      await Promise.race([firestoreLoad(), timeout]);
      this._ready = true;
    } catch (err) {
      console.warn('Firestore load failed, using local cache:', err.message);
      this._loadLocalCache();
      this._ready = true;
    }
  },

  _saveLocalCache() {
    localStorage.setItem('fitness_profiles', JSON.stringify(this._profiles));
    localStorage.setItem('fitness_records', JSON.stringify(this._records));
  },

  _loadLocalCache() {
    this._profiles = JSON.parse(localStorage.getItem('fitness_profiles') || '{}');
    this._records = JSON.parse(localStorage.getItem('fitness_records') || '[]');
  },

  // ===== Profiles =====
  getProfiles() {
    return this._profiles;
  },

  async saveProfile(id, profile) {
    this._profiles[id] = { ...this._profiles[id], ...profile };
    this._saveLocalCache();
    try {
      await this.profilesRef.doc(id).set(this._profiles[id], { merge: true });
    } catch (err) {
      console.warn('Firestore saveProfile failed:', err);
    }
  },

  getProfile(id) {
    return this._profiles[id] || null;
  },

  hasProfiles() {
    return Object.keys(this._profiles).length >= 2;
  },

  // ===== Current user (local only) =====
  setCurrentUser(id) {
    localStorage.setItem('fitness_current_user', id);
  },

  getCurrentUser() {
    return localStorage.getItem('fitness_current_user');
  },

  // ===== Records =====
  getRecords() {
    return this._records;
  },

  async addRecord(record) {
    const newRecord = {
      ...record,
      date: record.date || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await this.recordsRef.add(newRecord);
      newRecord.id = docRef.id;
    } catch (err) {
      console.warn('Firestore addRecord failed:', err);
      newRecord.id = 'local_' + Date.now();
    }

    this._records.push(newRecord);
    this._saveLocalCache();
    return newRecord;
  },

  async deleteRecord(id) {
    this._records = this._records.filter(r => r.id !== id);
    this._saveLocalCache();
    try {
      await this.recordsRef.doc(id).delete();
    } catch (err) {
      console.warn('Firestore deleteRecord failed:', err);
    }
  },

  // ===== Filtered records (sync - reads from cache) =====
  getUserRecords(userId) {
    return this._records.filter(r => r.userId === userId);
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

  getTodayTotalAltitudeGain(userId) {
    return this.getTodayRecords(userId)
      .reduce((sum, r) => sum + (r.altitudeGain || 0), 0);
  },

  // ===== Streak =====
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

  // ===== Reset =====
  async resetAll() {
    // Delete all records from Firestore
    try {
      const batch = db.batch();
      const recordSnap = await this.recordsRef.get();
      recordSnap.forEach(doc => batch.delete(doc.ref));
      const profileSnap = await this.profilesRef.get();
      profileSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Firestore resetAll failed:', err);
    }

    this._profiles = {};
    this._records = [];
    localStorage.removeItem('fitness_profiles');
    localStorage.removeItem('fitness_records');
    localStorage.removeItem('fitness_current_user');
  },

  // ===== Sync: refresh from Firestore =====
  async refresh() {
    await this.init();
  }
};
