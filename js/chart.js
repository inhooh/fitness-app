const Charts = {
  instances: {},

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  destroyAll() {
    Object.keys(this.instances).forEach(id => this.destroy(id));
  },

  // Weekly bar chart: goal vs actual per week
  renderWeeklyBar(canvasId, records, goalKm) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Group records by week of month (1-5)
    const weeks = [0, 0, 0, 0, 0];
    records.forEach(r => {
      const day = new Date(r.date).getDate();
      const week = Math.min(Math.floor((day - 1) / 7), 4);
      weeks[week] += r.distance || 0;
    });

    const weeklyGoal = goalKm / 4;
    const labels = ['1주', '2주', '3주', '4주', '5주'];

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '목표',
            data: labels.map(() => Math.round(weeklyGoal * 10) / 10),
            backgroundColor: 'rgba(99,102,241,0.2)',
            borderColor: 'rgba(99,102,241,0.5)',
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: '실제',
            data: weeks.map(w => Math.round(w * 10) / 10),
            backgroundColor: 'rgba(34,197,94,0.6)',
            borderColor: 'rgba(34,197,94,0.8)',
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 12 }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#64748b', font: { size: 11 } },
            beginAtZero: true
          }
        }
      }
    });
  },

  // Monthly cumulative line chart
  renderCumulativeLine(canvasId, records, goalKm, daysInMonth) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const today = new Date().getDate();

    // Build daily cumulative
    const dailyDist = new Array(daysInMonth).fill(0);
    records.forEach(r => {
      const day = new Date(r.date).getDate() - 1;
      if (day >= 0 && day < daysInMonth) dailyDist[day] += r.distance || 0;
    });

    const cumulative = [];
    let sum = 0;
    for (let i = 0; i < daysInMonth; i++) {
      sum += dailyDist[i];
      // 오늘 이후는 null로 처리 (선이 오늘까지만 그려짐)
      cumulative.push(i < today ? Math.round(sum * 100) / 100 : null);
    }

    // Goal line: 오늘까지만 표시
    const goalLine = Array.from({ length: daysInMonth }, (_, i) =>
      i < today ? Math.round((goalKm / daysInMonth) * (i + 1) * 100) / 100 : null
    );

    // Y축 최대값: 현재 누적 vs 오늘까지의 목표 페이스 중 큰 값 기준
    const currentCumMax = sum;
    const currentGoalPace = (goalKm / daysInMonth) * today;
    const yMax = Math.ceil(Math.max(currentCumMax, currentGoalPace) * 1.2);

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '목표 페이스',
            data: goalLine,
            borderColor: 'rgba(99,102,241,0.4)',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            spanGaps: false
          },
          {
            label: '실제 누적',
            data: cumulative,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.1)',
            borderWidth: 2.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 12 }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              maxTicksLimit: 10
            }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#64748b', font: { size: 11 } },
            beginAtZero: true,
            max: yMax > 0 ? yMax : undefined
          }
        }
      }
    });
  },

  // VS comparison bar chart
  renderCompare(canvasId, dadData, sonData) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['거리(km)', '칼로리(kcal)', '운동일수'],
        datasets: [
          {
            label: dadData.name,
            data: [dadData.distance, dadData.calories, dadData.days],
            backgroundColor: 'rgba(99,102,241,0.6)',
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: sonData.name,
            data: [sonData.distance, sonData.calories, sonData.days],
            backgroundColor: 'rgba(245,158,11,0.6)',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 12 }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#64748b', font: { size: 11 } },
            beginAtZero: true
          }
        }
      }
    });
  }
};
