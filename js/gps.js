const GPS = {
  watchId: null,
  positions: [],
  totalDistance: 0,
  startTime: null,
  isTracking: false,
  isPaused: false,
  altitude: null,       // 현재 고도 (m)
  altitudeGain: 0,      // 누적 상승 고도 (m)
  lastAltitude: null,
  onUpdate: null,       // callback(distance, duration, speed, altitude, altitudeGain)
  _retryCount: 0,
  _retryTimer: null,

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
    this.altitude = null;
    this.altitudeGain = 0;
    this.lastAltitude = null;
    this.onUpdate = callback;
    this._retryCount = 0;

    this._startWatch();
    return true;
  },

  _startWatch() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        this._retryCount = 0;
        this._onPosition(pos);
      },
      err => this._onError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      }
    );
  },

  pause() {
    this.isPaused = true;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    clearTimeout(this._retryTimer);
  },

  resume() {
    if (!this.isTracking) return;
    this.isPaused = false;
    this._startWatch();
  },

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    clearTimeout(this._retryTimer);
    this.isTracking = false;
    this.isPaused = false;

    const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    return {
      distance: Math.round(this.totalDistance * 1000) / 1000,
      duration,
      altitude: this.altitude,
      altitudeGain: Math.round(this.altitudeGain),
      positions: [...this.positions]
    };
  },

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  },

  _onPosition(pos) {
    if (this.isPaused) return;

    const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = pos.coords;

    // 정확도 필터 완화: 50m까지 허용 (기존 30m → 50m)
    // 정확도가 낮을수록 거리 임계값을 높여 노이즈 방지
    if (accuracy > 50) return;

    const distThreshold = accuracy > 30 ? 0.010 : accuracy > 15 ? 0.005 : 0.003;

    // 고도 업데이트
    if (altitude !== null && altitudeAccuracy !== null && altitudeAccuracy < 30) {
      this.altitude = Math.round(altitude);

      if (this.lastAltitude !== null) {
        const altDiff = altitude - this.lastAltitude;
        // 상승분만 누적 (3m 이상 변화만, 노이즈 필터)
        if (altDiff > 3) {
          this.altitudeGain += altDiff;
        }
      }
      this.lastAltitude = altitude;
    }

    // 거리 계산
    const last = this.positions[this.positions.length - 1];
    if (last) {
      const dist = this._haversine(last.lat, last.lng, latitude, longitude);
      if (dist > distThreshold) {
        this.totalDistance += dist;
        this.positions.push({ lat: latitude, lng: longitude, alt: altitude, time: Date.now() });
      }
      // 임계값 미만이면 위치 갱신하지 않음 (작은 이동 누적 보존)
    } else {
      // 첫 번째 위치는 항상 저장
      this.positions.push({ lat: latitude, lng: longitude, alt: altitude, time: Date.now() });
    }

    if (this.onUpdate) {
      const duration = this.getElapsedSeconds();
      // 최근 구간 속도 계산 (마지막 2개 위치 기반)
      let speed = 0;
      if (this.positions.length >= 2) {
        const p1 = this.positions[this.positions.length - 2];
        const p2 = this.positions[this.positions.length - 1];
        const segDist = this._haversine(p1.lat, p1.lng, p2.lat, p2.lng);
        const segTime = (p2.time - p1.time) / 3600000; // hours
        if (segTime > 0) speed = segDist / segTime;
        // 비현실적 속도 필터 (걷기/달리기 최대 ~15km/h)
        if (speed > 15) speed = 0;
      }
      this.onUpdate(this.totalDistance, duration, speed, this.altitude, this.altitudeGain);
    }
  },

  _onError(err) {
    console.warn('GPS error:', err.code, err.message);

    // 타임아웃이나 위치를 못 받으면 watchPosition 재시작
    if (this.isTracking && !this.isPaused && this._retryCount < 5) {
      this._retryCount++;
      clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => {
        if (this.isTracking && !this.isPaused) {
          this._startWatch();
        }
      }, 2000);
    }
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
