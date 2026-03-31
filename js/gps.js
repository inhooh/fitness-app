const GPS = {
  watchId: null,
  positions: [],
  totalDistance: 0,
  startTime: null,
  isTracking: false,
  isPaused: false,
  onUpdate: null, // callback(distance, duration, speed)

  start(callback) {
    if (!navigator.geolocation) {
      console.warn('GPS를 지원하지 않는 브라우저입니다.');
      return false;
    }

    this.positions = [];
    this.totalDistance = 0;
    this.startTime = Date.now();
    this.isTracking = true;
    this.isPaused = false;
    this.onUpdate = callback;

    this.watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
    return true;
  },

  pause() {
    this.isPaused = true;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  },

  resume() {
    if (!this.isTracking) return;
    this.isPaused = false;
    this.watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  },

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.isPaused = false;

    const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    return {
      distance: Math.round(this.totalDistance * 1000) / 1000, // km, 3 decimals
      duration, // seconds
      positions: [...this.positions]
    };
  },

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  },

  _onPosition(pos) {
    if (this.isPaused) return;

    const { latitude, longitude, accuracy } = pos.coords;

    // Skip inaccurate readings (> 30m)
    if (accuracy > 30) return;

    const last = this.positions[this.positions.length - 1];
    if (last) {
      const dist = this._haversine(last.lat, last.lng, latitude, longitude);
      // Ignore tiny movements (GPS noise < 3m)
      if (dist > 0.003) {
        this.totalDistance += dist;
      }
    }

    this.positions.push({ lat: latitude, lng: longitude, time: Date.now() });

    if (this.onUpdate) {
      const duration = this.getElapsedSeconds();
      const speed = duration > 0 ? (this.totalDistance / (duration / 3600)) : 0;
      this.onUpdate(this.totalDistance, duration, speed);
    }
  },

  _onError(err) {
    console.warn('GPS error:', err.message);
  },

  // Haversine formula - returns distance in km
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
};
