/* ===== App Controller ===== */
const APP_VERSION = '1.4.1';

const App = {
  currentPage: 'home',
  walkTimerInterval: null,

  async init() {
    // Show loading while Firestore loads
    document.getElementById('app').innerHTML = `
      <div class="setup-screen">
        <div class="setup-logo">🚶‍♂️</div>
        <div class="setup-title">함께 걷기</div>
        <p class="setup-subtitle" style="margin-top:16px;">데이터 불러오는 중...</p>
      </div>
    `;

    await Storage.init();

    if (!Storage.hasProfiles()) {
      this.showSetup();
    } else {
      if (!Storage.getCurrentUser()) Storage.setCurrentUser('dad');
      this.showNav();
      this.navigate('home');
    }

    // Nav click handlers
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        this.navigate(page);
      });
    });
  },

  showNav() {
    document.getElementById('bottom-nav').classList.remove('hidden');
  },

  hideNav() {
    document.getElementById('bottom-nav').classList.add('hidden');
  },

  navigate(page) {
    this.currentPage = page;
    Charts.destroyAll();
    // 산책 중이 아닐 때만 타이머 정리 (산책 중이면 백그라운드에서 GPS 유지)
    if (!GPS.isTracking) {
      clearInterval(this.walkTimerInterval);
    }
    clearInterval(this._recordsRefreshInterval);

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });

    const app = document.getElementById('app');
    switch (page) {
      case 'home': app.innerHTML = this.renderHome(); this.initHome(); break;
      case 'walk': app.innerHTML = this.renderWalk(); this.initWalk(); break;
      case 'records': app.innerHTML = this.renderRecords(); this.initRecords(); break;
      case 'settings': app.innerHTML = this.renderSettings(); this.initSettings(); break;
    }

    app.querySelector('.page-enter')?.offsetHeight; // force reflow for animation
  },

  _recordsRefreshInterval: null,

  /* ===== SETUP SCREEN ===== */
  showSetup() {
    this.hideNav();
    document.getElementById('app').innerHTML = `
      <div class="setup-screen page-enter">
        <div class="setup-logo">🚶‍♂️</div>
        <div class="setup-title">함께 걷기</div>
        <p class="setup-subtitle">아버지와 아들, 함께 목표를 달성해요!</p>

        <div id="setup-step1">
          <h3 style="margin-bottom:16px; color:var(--text-dim);">👨 아버지 프로필</h3>
          <div class="form-group">
            <label class="form-label">이름</label>
            <input class="form-input" id="dad-name" placeholder="아버지 이름" value="아빠">
          </div>
          <div class="form-group">
            <label class="form-label">체중 (kg)</label>
            <input class="form-input" id="dad-weight" type="number" placeholder="75" value="75">
          </div>
          <div class="form-group">
            <label class="form-label">월간 목표 (km)</label>
            <input class="form-input" id="dad-goal" type="number" placeholder="30" value="30">
          </div>

          <h3 style="margin: 28px 0 16px; color:var(--text-dim);">👦 아들 프로필</h3>
          <div class="form-group">
            <label class="form-label">이름</label>
            <input class="form-input" id="son-name" placeholder="아들 이름" value="">
          </div>
          <div class="form-group">
            <label class="form-label">체중 (kg)</label>
            <input class="form-input" id="son-weight" type="number" placeholder="50" value="50">
          </div>
          <div class="form-group">
            <label class="form-label">월간 목표 (km)</label>
            <input class="form-input" id="son-goal" type="number" placeholder="20" value="20">
          </div>

          <button class="btn btn-primary btn-large mt-32" id="setup-done">
            <span class="material-icons-round">check_circle</span>
            시작하기
          </button>
        </div>
      </div>
    `;

    document.getElementById('setup-done').addEventListener('click', async () => {
      const dadName = document.getElementById('dad-name').value.trim() || '아빠';
      const sonName = document.getElementById('son-name').value.trim() || '아들';

      await Storage.saveProfile('dad', {
        name: dadName,
        emoji: '👨',
        weight: parseFloat(document.getElementById('dad-weight').value) || 75,
        goalKm: parseFloat(document.getElementById('dad-goal').value) || 30
      });

      await Storage.saveProfile('son', {
        name: sonName,
        emoji: '👦',
        weight: parseFloat(document.getElementById('son-weight').value) || 50,
        goalKm: parseFloat(document.getElementById('son-goal').value) || 20
      });

      Storage.setCurrentUser('dad');
      this.showNav();
      this.navigate('home');
    });
  },

  /* ===== HOME DASHBOARD ===== */
  renderHome() {
    const uid = Storage.getCurrentUser();
    const profile = Storage.getProfile(uid);
    const other = uid === 'dad' ? 'son' : 'dad';
    const otherProfile = Storage.getProfile(other);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const todayDist = Storage.getTodayTotalDistance(uid);
    const todayCal = Storage.getTodayTotalCalories(uid);
    const todayDur = Storage.getTodayTotalDuration(uid);
    const todayAlt = Storage.getTodayTotalAltitudeGain(uid);
    const monthDist = Storage.getMonthTotalDistance(uid, year, month);
    const monthDistOther = Storage.getMonthTotalDistance(other, year, month);
    const streak = Storage.getStreak(uid);
    const pct = profile.goalKm > 0 ? Math.min(100, Math.round((monthDist / profile.goalKm) * 100)) : 0;
    const motivation = this.getMotivation(pct);

    // VS bar proportions
    const maxDist = Math.max(monthDist, monthDistOther, 1);
    const dadPct = uid === 'dad' ? (monthDist / maxDist * 100) : (monthDistOther / maxDist * 100);
    const sonPct = uid === 'son' ? (monthDist / maxDist * 100) : (monthDistOther / maxDist * 100);

    return `
      <div class="page-enter">
        <!-- User Switch -->
        <div class="user-switch">
          <button class="user-switch-btn ${uid === 'dad' ? 'active' : ''}" data-uid="dad">
            ${Storage.getProfile('dad')?.emoji || '👨'} ${Storage.getProfile('dad')?.name || '아빠'}
          </button>
          <button class="user-switch-btn ${uid === 'son' ? 'active' : ''}" data-uid="son">
            ${Storage.getProfile('son')?.emoji || '👦'} ${Storage.getProfile('son')?.name || '아들'}
          </button>
        </div>

        <!-- Progress Ring -->
        <div class="card card-glass">
          <div class="progress-ring-container">
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="78" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>
              <circle cx="90" cy="90" r="78" fill="none"
                stroke="url(#grad)" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${2 * Math.PI * 78}"
                stroke-dashoffset="${2 * Math.PI * 78 * (1 - pct / 100)}"
                transform="rotate(-90 90 90)"
                style="transition: stroke-dashoffset 1s ease-out"/>
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${pct >= 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'}"/>
                  <stop offset="100%" style="stop-color:${pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'}"/>
                </linearGradient>
              </defs>
            </svg>
            <div class="progress-ring-inner">
              <div class="progress-percent">${pct}%</div>
              <div class="progress-label">월간 목표 달성</div>
            </div>
          </div>
          <div class="text-center" style="margin-top:8px;">
            <span style="font-size:14px; color:var(--text-dim);">
              ${monthDist.toFixed(1)} / ${profile.goalKm} km
            </span>
          </div>
        </div>

        <!-- Motivation -->
        <div class="motivation-msg">${motivation}</div>

        <!-- Streak -->
        ${streak > 0 ? `
          <div class="text-center" style="margin-bottom:14px;">
            <span class="streak-badge">
              <span class="streak-fire">🔥</span> ${streak}일 연속 운동 중!
            </span>
          </div>
        ` : ''}

        <!-- Today Stats -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-icon">📏</span>
            <div class="stat-value">${todayDist.toFixed(1)}<span class="stat-unit">km</span></div>
            <div class="stat-label">오늘 거리</div>
          </div>
          <div class="stat-card">
            <span class="stat-icon">🔥</span>
            <div class="stat-value">${todayCal}<span class="stat-unit">kcal</span></div>
            <div class="stat-label">칼로리</div>
          </div>
          <div class="stat-card">
            <span class="stat-icon">⏱️</span>
            <div class="stat-value">${this.formatDurationShort(todayDur)}</div>
            <div class="stat-label">운동 시간</div>
          </div>
        </div>
        ${todayAlt > 0 ? `
        <div class="stats-row">
          <div class="stat-card" style="flex:1;">
            <span class="stat-icon">⛰️</span>
            <div class="stat-value">${Math.round(todayAlt)}<span class="stat-unit">m</span></div>
            <div class="stat-label">오늘 상승 고도</div>
          </div>
        </div>
        ` : ''}

        <!-- VS Card -->
        <div class="vs-card">
          <div class="vs-header">⚔️ 이번 달 대결</div>
          <div class="vs-row">
            <div class="vs-user">
              <span class="vs-emoji">${Storage.getProfile('dad')?.emoji}</span>
              <div class="vs-name">${Storage.getProfile('dad')?.name}</div>
              <div class="vs-distance">${(uid === 'dad' ? monthDist : monthDistOther).toFixed(1)}<span class="stat-unit">km</span></div>
            </div>
            <div class="vs-separator">VS</div>
            <div class="vs-user">
              <span class="vs-emoji">${Storage.getProfile('son')?.emoji}</span>
              <div class="vs-name">${Storage.getProfile('son')?.name}</div>
              <div class="vs-distance">${(uid === 'son' ? monthDist : monthDistOther).toFixed(1)}<span class="stat-unit">km</span></div>
            </div>
          </div>
          <div class="vs-bar-track">
            <div class="vs-bar-fill dad" style="width:${dadPct}%"></div>
            <div class="vs-bar-fill son" style="width:${sonPct}%"></div>
          </div>
        </div>

        <!-- Start Walk Button -->
        ${GPS.isTracking ? `
        <button class="btn btn-start" id="home-start-walk" style="background: linear-gradient(135deg, var(--accent), #d97706); box-shadow: 0 4px 16px rgba(245,158,11,0.4); animation: pulse 2s infinite;">
          <span class="material-icons-round">directions_walk</span>
          산책 진행 중 - 돌아가기
        </button>
        ` : `
        <button class="btn btn-start pulse" id="home-start-walk">
          <span class="material-icons-round">directions_walk</span>
          산책 시작하기
        </button>
        `}
      </div>
    `;
  },

  async initHome() {
    // Refresh data from Firestore on each visit
    await Storage.refresh();

    // 다른 페이지로 이동했으면 re-render 하지 않음
    if (this.currentPage !== 'home') return;

    // Re-render with fresh data
    const app = document.getElementById('app');
    app.innerHTML = this.renderHome();

    // User switch
    document.querySelectorAll('.user-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Storage.setCurrentUser(btn.dataset.uid);
        this.navigate('home');
      });
    });

    // Start walk
    document.getElementById('home-start-walk')?.addEventListener('click', () => {
      this.navigate('walk');
    });

    // Check if goal just reached - trigger confetti
    const uid = Storage.getCurrentUser();
    const profile = Storage.getProfile(uid);
    const now = new Date();
    const monthDist = Storage.getMonthTotalDistance(uid, now.getFullYear(), now.getMonth());
    if (monthDist >= profile.goalKm && profile.goalKm > 0) {
      setTimeout(() => this.confetti(), 500);
    }
  },

  getMotivation(pct) {
    if (pct >= 100) return '🎉 <strong>목표 달성!</strong> 정말 대단해요!';
    if (pct >= 80) return '💪 거의 다 왔어요! <strong>조금만 더 힘내세요!</strong>';
    if (pct >= 60) return '🏃 좋은 페이스! <strong>목표의 절반을 넘었어요!</strong>';
    if (pct >= 40) return '👍 잘 하고 있어요! <strong>꾸준히 가볼까요?</strong>';
    if (pct >= 20) return '🌱 좋은 시작이에요! <strong>계속 걸어봐요!</strong>';
    return '👟 오늘도 한 걸음부터! <strong>시작이 반이에요!</strong>';
  },

  /* ===== WALK SCREEN ===== */
  renderWalk() {
    return `
      <div class="walk-screen page-enter" id="walk-container">
        <div id="walk-idle">
          <span class="walk-idle-icon">🚶</span>
          <p class="walk-ready-msg">산책을 시작해볼까요?</p>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:24px;">
            GPS로 자동으로 거리를 측정합니다
          </p>
          <button class="btn btn-start pulse" id="walk-start-btn">
            <span class="material-icons-round">play_arrow</span>
            산책 시작
          </button>
        </div>

        <div id="walk-tracking" class="hidden">
          <div class="walk-timer" id="walk-timer">00:00</div>
          <div class="walk-distance">
            <span id="walk-dist">0.000</span>
            <span class="walk-distance-unit">km</span>
          </div>
          <div class="walk-stats">
            <div class="walk-stat-item">
              <div class="walk-stat-value" id="walk-cal">0</div>
              <div class="walk-stat-label">칼로리(kcal)</div>
            </div>
            <div class="walk-stat-item">
              <div class="walk-stat-value" id="walk-speed">0.0</div>
              <div class="walk-stat-label">속도(km/h)</div>
            </div>
          </div>
          <div class="walk-stats">
            <div class="walk-stat-item">
              <div class="walk-stat-value" id="walk-alt">--</div>
              <div class="walk-stat-label">고도(m)</div>
            </div>
            <div class="walk-stat-item">
              <div class="walk-stat-value" id="walk-alt-gain">0</div>
              <div class="walk-stat-label">상승고도(m)</div>
            </div>
          </div>
          <div class="walk-controls">
            <button class="btn btn-pause" id="walk-pause-btn">
              <span class="material-icons-round">pause</span>
              일시정지
            </button>
            <button class="btn btn-stop" id="walk-stop-btn">
              <span class="material-icons-round">stop</span>
              종료
            </button>
          </div>
        </div>

        <div id="walk-result" class="hidden">
          <div style="font-size:64px; text-align:center; margin:30px 0 16px;">🎉</div>
          <h2 class="text-center" style="margin-bottom:24px;">산책 완료!</h2>
          <div class="stats-row">
            <div class="stat-card">
              <span class="stat-icon">📏</span>
              <div class="stat-value" id="result-dist">0</div>
              <div class="stat-label">거리(km)</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">🔥</span>
              <div class="stat-value" id="result-cal">0</div>
              <div class="stat-label">칼로리</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">⏱️</span>
              <div class="stat-value" id="result-time">0</div>
              <div class="stat-label">시간</div>
            </div>
          </div>
          <div class="stats-row" id="result-alt-row" style="display:none;">
            <div class="stat-card" style="flex:1;">
              <span class="stat-icon">⛰️</span>
              <div class="stat-value" id="result-alt-gain">0<span class="stat-unit">m</span></div>
              <div class="stat-label">상승 고도</div>
            </div>
          </div>
          <button class="btn btn-primary btn-large mt-20" id="walk-done-btn">
            <span class="material-icons-round">home</span>
            홈으로 돌아가기
          </button>
        </div>
      </div>
    `;
  },

  initWalk() {
    const uid = Storage.getCurrentUser();
    const profile = Storage.getProfile(uid);

    // GPS가 이미 추적 중이면 tracking UI 복원
    if (GPS.isTracking) {
      document.getElementById('walk-idle').classList.add('hidden');
      document.getElementById('walk-tracking').classList.remove('hidden');

      // 현재 값으로 UI 업데이트
      document.getElementById('walk-dist').textContent = GPS.totalDistance.toFixed(3);
      document.getElementById('walk-cal').textContent = Calories.calculate(profile.weight, GPS.totalDistance);
      document.getElementById('walk-timer').textContent = this.formatTime(GPS.getElapsedSeconds());

      // 일시정지 상태 반영
      if (GPS.isPaused) {
        const btn = document.getElementById('walk-pause-btn');
        btn.innerHTML = '<span class="material-icons-round">play_arrow</span> 계속하기';
        btn.className = 'btn btn-primary';
      }

      // 고도 복원
      if (GPS.altitude !== null) {
        document.getElementById('walk-alt').textContent = GPS.altitude;
      }
      document.getElementById('walk-alt-gain').textContent = Math.round(GPS.altitudeGain);

      // GPS 콜백을 새 DOM에 연결
      GPS.onUpdate = (distance, duration, speed, altitude, altGain) => {
        document.getElementById('walk-dist').textContent = distance.toFixed(3);
        document.getElementById('walk-cal').textContent = Calories.calculate(profile.weight, distance);
        document.getElementById('walk-speed').textContent = speed.toFixed(1);
        if (altitude !== null) document.getElementById('walk-alt').textContent = altitude;
        document.getElementById('walk-alt-gain').textContent = Math.round(altGain);
      };

      // 타이머 재시작
      clearInterval(this.walkTimerInterval);
      this.walkTimerInterval = setInterval(() => {
        const sec = GPS.getElapsedSeconds();
        document.getElementById('walk-timer').textContent = this.formatTime(sec);
      }, 1000);
    }

    document.getElementById('walk-start-btn')?.addEventListener('click', () => {
      const started = GPS.start((distance, duration, speed, altitude, altGain) => {
        document.getElementById('walk-dist').textContent = distance.toFixed(3);
        document.getElementById('walk-cal').textContent = Calories.calculate(profile.weight, distance);
        document.getElementById('walk-speed').textContent = speed.toFixed(1);
        if (altitude !== null) document.getElementById('walk-alt').textContent = altitude;
        document.getElementById('walk-alt-gain').textContent = Math.round(altGain);
      });

      if (started) {
        document.getElementById('walk-idle').classList.add('hidden');
        document.getElementById('walk-tracking').classList.remove('hidden');

        this.walkTimerInterval = setInterval(() => {
          const sec = GPS.getElapsedSeconds();
          document.getElementById('walk-timer').textContent = this.formatTime(sec);
        }, 1000);
      }
    });

    document.getElementById('walk-pause-btn')?.addEventListener('click', () => {
      const btn = document.getElementById('walk-pause-btn');
      if (GPS.isPaused) {
        GPS.resume();
        btn.innerHTML = '<span class="material-icons-round">pause</span> 일시정지';
        btn.className = 'btn btn-pause';
      } else {
        GPS.pause();
        btn.innerHTML = '<span class="material-icons-round">play_arrow</span> 계속하기';
        btn.className = 'btn btn-primary';
      }
    });

    document.getElementById('walk-stop-btn')?.addEventListener('click', async () => {
      clearInterval(this.walkTimerInterval);
      const result = GPS.stop();
      const cal = Calories.calculate(profile.weight, result.distance);

      // Save record to Firestore
      await Storage.addRecord({
        userId: uid,
        distance: result.distance,
        duration: result.duration,
        calories: cal,
        altitudeGain: result.altitudeGain,
        positions: result.positions.length
      });

      // Show result
      document.getElementById('walk-tracking').classList.add('hidden');
      document.getElementById('walk-result').classList.remove('hidden');
      document.getElementById('result-dist').textContent = result.distance.toFixed(2);
      document.getElementById('result-cal').textContent = cal;
      document.getElementById('result-time').textContent = this.formatDurationShort(result.duration);

      // 상승 고도 표시 (데이터가 있을 때만)
      if (result.altitudeGain > 0) {
        document.getElementById('result-alt-row').style.display = '';
        document.getElementById('result-alt-gain').textContent = result.altitudeGain;
      }

      this.confetti();
    });

    document.getElementById('walk-done-btn')?.addEventListener('click', () => {
      this.navigate('home');
    });
  },

  /* ===== RECORDS SCREEN ===== */
  renderRecords() {
    const uid = Storage.getCurrentUser();
    const profile = Storage.getProfile(uid);
    const now = new Date();

    return `
      <div class="page-enter">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <h1 class="page-title" style="margin-bottom:0;">📊 기록</h1>
          <button class="btn btn-ghost" id="records-refresh" style="padding:8px 12px; font-size:13px;">
            <span class="material-icons-round" style="font-size:18px;">refresh</span> 새로고침
          </button>
        </div>

        <!-- User Switch -->
        <div class="user-switch">
          <button class="user-switch-btn ${uid === 'dad' ? 'active' : ''}" data-uid="dad">
            ${Storage.getProfile('dad')?.emoji} ${Storage.getProfile('dad')?.name}
          </button>
          <button class="user-switch-btn ${uid === 'son' ? 'active' : ''}" data-uid="son">
            ${Storage.getProfile('son')?.emoji} ${Storage.getProfile('son')?.name}
          </button>
        </div>

        <!-- Month Nav -->
        <div class="month-nav">
          <button class="month-nav-btn" id="prev-month">
            <span class="material-icons-round">chevron_left</span>
          </button>
          <div class="month-label" id="month-label">${now.getFullYear()}년 ${now.getMonth() + 1}월</div>
          <button class="month-nav-btn" id="next-month">
            <span class="material-icons-round">chevron_right</span>
          </button>
        </div>

        <!-- Calendar -->
        <div class="calendar" id="calendar-grid"></div>

        <!-- Weekly Bar Chart -->
        <div class="chart-container">
          <div class="chart-title">📊 주간 목표 vs 실제</div>
          <canvas id="weekly-chart"></canvas>
        </div>

        <!-- Cumulative Line Chart -->
        <div class="chart-container">
          <div class="chart-title">📈 월간 누적 거리</div>
          <canvas id="cumulative-chart"></canvas>
        </div>

        <!-- Comparison Chart -->
        <div class="chart-container">
          <div class="chart-title">⚔️ 아버지 vs 아들 비교</div>
          <canvas id="compare-chart"></canvas>
        </div>
      </div>
    `;
  },

  _recordsYear: null,
  _recordsMonth: null,

  initRecords() {
    const now = new Date();
    this._recordsYear = now.getFullYear();
    this._recordsMonth = now.getMonth();

    this._renderRecordsData();

    // Refresh button
    document.getElementById('records-refresh')?.addEventListener('click', async () => {
      const btn = document.getElementById('records-refresh');
      btn.disabled = true;
      btn.innerHTML = '<span class="material-icons-round" style="font-size:18px; animation: spin 1s linear infinite;">refresh</span> 갱신 중...';
      await Storage.refresh();
      this._renderRecordsData();
      btn.disabled = false;
      btn.innerHTML = '<span class="material-icons-round" style="font-size:18px;">refresh</span> 새로고침';
    });

    // Auto refresh every 30 seconds
    this._recordsRefreshInterval = setInterval(async () => {
      if (this.currentPage !== 'records') return;
      await Storage.refresh();
      this._renderRecordsData();
    }, 30000);

    // User switch
    document.querySelectorAll('.user-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Storage.setCurrentUser(btn.dataset.uid);
        this.navigate('records');
      });
    });

    // Month nav
    document.getElementById('prev-month')?.addEventListener('click', () => {
      this._recordsMonth--;
      if (this._recordsMonth < 0) { this._recordsMonth = 11; this._recordsYear--; }
      this._renderRecordsData();
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
      this._recordsMonth++;
      if (this._recordsMonth > 11) { this._recordsMonth = 0; this._recordsYear++; }
      this._renderRecordsData();
    });
  },

  _renderRecordsData() {
    const uid = Storage.getCurrentUser();
    const profile = Storage.getProfile(uid);
    const year = this._recordsYear;
    const month = this._recordsMonth;

    document.getElementById('month-label').textContent = `${year}년 ${month + 1}월`;

    // Calendar
    const records = Storage.getMonthRecords(uid, year, month);
    const recordDays = new Set(records.map(r => new Date(r.date).getDate()));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    const headers = ['일', '월', '화', '수', '목', '금', '토'];
    let calHTML = headers.map(h => `<div class="calendar-day-header">${h}</div>`).join('');

    for (let i = 0; i < firstDay; i++) {
      calHTML += '<div class="calendar-day empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const hasRec = recordDays.has(d);
      const isToday = isCurrentMonth && d === today.getDate();
      calHTML += `<div class="calendar-day${hasRec ? ' has-record' : ''}${isToday ? ' today' : ''}">${d}</div>`;
    }

    document.getElementById('calendar-grid').innerHTML = calHTML;

    // Charts
    Charts.destroyAll();
    Charts.renderWeeklyBar('weekly-chart', records, profile.goalKm);
    Charts.renderCumulativeLine('cumulative-chart', records, profile.goalKm, daysInMonth);

    // Comparison data
    const dadRecords = Storage.getMonthRecords('dad', year, month);
    const sonRecords = Storage.getMonthRecords('son', year, month);
    const dadProfile = Storage.getProfile('dad');
    const sonProfile = Storage.getProfile('son');

    Charts.renderCompare('compare-chart', {
      name: dadProfile.name,
      distance: Math.round(dadRecords.reduce((s, r) => s + (r.distance || 0), 0) * 10) / 10,
      calories: dadRecords.reduce((s, r) => s + (r.calories || 0), 0),
      days: new Set(dadRecords.map(r => r.date.slice(0, 10))).size
    }, {
      name: sonProfile.name,
      distance: Math.round(sonRecords.reduce((s, r) => s + (r.distance || 0), 0) * 10) / 10,
      calories: sonRecords.reduce((s, r) => s + (r.calories || 0), 0),
      days: new Set(sonRecords.map(r => r.date.slice(0, 10))).size
    });
  },

  /* ===== SETTINGS SCREEN ===== */
  renderSettings() {
    const dadProfile = Storage.getProfile('dad');
    const sonProfile = Storage.getProfile('son');

    return `
      <div class="page-enter">
        <h1 class="page-title">⚙️ 설정</h1>

        <div class="section-title">프로필</div>
        <div class="settings-list">
          <div class="settings-item" id="edit-dad">
            <div class="settings-item-left">
              <div class="settings-icon purple"><span class="material-icons-round">person</span></div>
              <div>
                <div class="settings-item-label">${dadProfile?.emoji} ${dadProfile?.name}</div>
                <div class="settings-item-value">${dadProfile?.weight}kg · 목표 ${dadProfile?.goalKm}km/월</div>
              </div>
            </div>
            <span class="material-icons-round" style="color:var(--text-muted)">chevron_right</span>
          </div>
          <div class="settings-item" id="edit-son">
            <div class="settings-item-left">
              <div class="settings-icon amber"><span class="material-icons-round">person</span></div>
              <div>
                <div class="settings-item-label">${sonProfile?.emoji} ${sonProfile?.name}</div>
                <div class="settings-item-value">${sonProfile?.weight}kg · 목표 ${sonProfile?.goalKm}km/월</div>
              </div>
            </div>
            <span class="material-icons-round" style="color:var(--text-muted)">chevron_right</span>
          </div>
        </div>

        <div class="section-title" style="margin-top:28px;">데이터</div>
        <div class="settings-list">
          <div class="settings-item" id="add-sample">
            <div class="settings-item-left">
              <div class="settings-icon green"><span class="material-icons-round">science</span></div>
              <div>
                <div class="settings-item-label">샘플 데이터 추가</div>
                <div class="settings-item-value">테스트용 데이터를 추가합니다</div>
              </div>
            </div>
          </div>
          <div class="settings-item" id="reset-data">
            <div class="settings-item-left">
              <div class="settings-icon red"><span class="material-icons-round">delete_forever</span></div>
              <div>
                <div class="settings-item-label">데이터 초기화</div>
                <div class="settings-item-value">모든 기록과 프로필을 삭제합니다</div>
              </div>
            </div>
          </div>
        </div>

        <div style="text-align:center; margin-top:32px; padding-bottom:20px;">
          <span style="font-size:12px; color:var(--text-muted);">함께 걷기 v${APP_VERSION}</span>
        </div>
      </div>
    `;
  },

  initSettings() {
    document.getElementById('edit-dad')?.addEventListener('click', () => this.showEditModal('dad'));
    document.getElementById('edit-son')?.addEventListener('click', () => this.showEditModal('son'));

    document.getElementById('add-sample')?.addEventListener('click', async () => {
      await this.addSampleData();
      this.navigate('home');
    });

    document.getElementById('reset-data')?.addEventListener('click', async () => {
      if (confirm('정말 모든 데이터를 삭제하시겠습니까?')) {
        await Storage.resetAll();
        this.hideNav();
        this.showSetup();
      }
    });
  },

  showEditModal(userId) {
    const profile = Storage.getProfile(userId);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">${profile.emoji} ${profile.name} 수정</div>
        <div class="form-group">
          <label class="form-label">이름</label>
          <input class="form-input" id="modal-name" value="${profile.name}">
        </div>
        <div class="form-group">
          <label class="form-label">체중 (kg)</label>
          <input class="form-input" id="modal-weight" type="number" value="${profile.weight}">
        </div>
        <div class="form-group">
          <label class="form-label">월간 목표 (km)</label>
          <input class="form-input" id="modal-goal" type="number" value="${profile.goalKm}">
        </div>
        <div style="display:flex; gap:10px; margin-top:24px;">
          <button class="btn btn-ghost" id="modal-cancel" style="flex:1;">취소</button>
          <button class="btn btn-primary" id="modal-save" style="flex:1;">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById('modal-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-save').addEventListener('click', async () => {
      await Storage.saveProfile(userId, {
        name: document.getElementById('modal-name').value.trim() || profile.name,
        weight: parseFloat(document.getElementById('modal-weight').value) || profile.weight,
        goalKm: parseFloat(document.getElementById('modal-goal').value) || profile.goalKm
      });
      overlay.remove();
      this.navigate('settings');
    });
  },

  /* ===== SAMPLE DATA ===== */
  async addSampleData() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const dadProfile = Storage.getProfile('dad');
    const sonProfile = Storage.getProfile('son');

    const promises = [];

    for (let d = 1; d <= Math.min(now.getDate(), 28); d++) {
      // Dad: walks ~70% of days
      if (Math.random() < 0.7) {
        const dist = 1 + Math.random() * 3; // 1-4 km
        const date = new Date(year, month, d, 8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
        promises.push(Storage.addRecord({
          userId: 'dad',
          distance: Math.round(dist * 1000) / 1000,
          duration: Math.round(dist / 4.5 * 3600),
          calories: Calories.calculate(dadProfile.weight, dist),
          date: date.toISOString()
        }));
      }

      // Son: walks ~60% of days
      if (Math.random() < 0.6) {
        const dist = 0.5 + Math.random() * 2.5; // 0.5-3 km
        const date = new Date(year, month, d, 15 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
        promises.push(Storage.addRecord({
          userId: 'son',
          distance: Math.round(dist * 1000) / 1000,
          duration: Math.round(dist / 4 * 3600),
          calories: Calories.calculate(sonProfile.weight, dist),
          date: date.toISOString()
        }));
      }
    }

    await Promise.all(promises);
  },

  /* ===== CONFETTI ===== */
  confetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#8b5cf6'];
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2
    }));

    let frame = 0;
    const maxFrames = 120;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.05;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      frame++;
      if (frame < maxFrames) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    draw();
  },

  /* ===== UTILITIES ===== */
  formatTime(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  formatDurationShort(totalSec) {
    if (totalSec < 60) return `${totalSec}초`;
    const m = Math.floor(totalSec / 60);
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    return `${h}시간${m % 60}분`;
  }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
