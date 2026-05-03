/* ========== CricPulse — Match Simulation Engine ========== */

/**
 * MatchEngine: Runs the mock match from JSON data,
 * auto-advancing balls on a timer and emitting events.
 */
class MatchEngine {
  constructor() {
    this.matchData = null;
    this.balls = [];
    this.currentBallIndex = -1;
    this.score = { runs: 0, wickets: 0, overs: '0.0' };
    this.isRunning = false;
    this.isPaused = false;
    this.intervalMs = 20000; // 20 seconds per ball
    this.timer = null;
    this.listeners = {};
    this.countdownTimer = null;
    this.secondsLeft = 0;
  }

  async loadMatch(url) {
    try {
      const res = await fetch(url);
      this.matchData = await res.json();
      this.balls = this.matchData.balls;
      this.score = { ...this.matchData.initialScore };
      this.emit('matchLoaded', this.matchData);
      this.emit('scoreUpdate', this.score);
      return this.matchData;
    } catch (err) {
      console.error('Failed to load match data:', err);
      return null;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.emit('matchStarted');
    this._scheduleBall();
  }

  pause() {
    this.isPaused = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.emit('matchPaused');
  }

  resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.emit('matchResumed');
    this._scheduleBall();
  }

  setSpeed(ms) {
    this.intervalMs = ms;
    if (this.isRunning && !this.isPaused) {
      if (this.timer) clearTimeout(this.timer);
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this._scheduleBall();
    }
  }

  nextBall() {
    if (this.timer) clearTimeout(this.timer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this._advanceBall();
  }

  forceResult(result) {
    // Override the next ball result for demo
    const nextIdx = this.currentBallIndex + 1;
    if (nextIdx < this.balls.length) {
      this.balls[nextIdx] = { ...this.balls[nextIdx], result, runs: result === 'wicket' ? 0 : parseInt(result) || 0 };
    }
  }

  reset() {
    if (this.timer) clearTimeout(this.timer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.currentBallIndex = -1;
    this.isRunning = false;
    this.isPaused = false;
    if (this.matchData) {
      this.score = { ...this.matchData.initialScore };
      this.emit('scoreUpdate', this.score);
    }
    this.emit('matchReset');
  }

  // ---- Internal ----
  _scheduleBall() {
    this.secondsLeft = Math.ceil(this.intervalMs / 1000);
    this.emit('countdownStart', this.secondsLeft);

    this.countdownTimer = setInterval(() => {
      this.secondsLeft--;
      this.emit('countdown', this.secondsLeft);
      if (this.secondsLeft <= 0) {
        clearInterval(this.countdownTimer);
      }
    }, 1000);

    this.timer = setTimeout(() => {
      this._advanceBall();
    }, this.intervalMs);
  }

  _advanceBall() {
    this.currentBallIndex++;
    if (this.currentBallIndex >= this.balls.length) {
      this.isRunning = false;
      this.emit('matchEnded', this.score);
      return;
    }

    const ball = this.balls[this.currentBallIndex];

    // Update score
    this.score.runs += ball.runs;
    if (ball.result === 'wicket' || ball.result === 'drs') {
      if (ball.result === 'drs' && ball.drsResult === 'out') {
        this.score.wickets++;
      } else if (ball.result === 'wicket') {
        this.score.wickets++;
      }
    }

    // Update overs
    const overNum = ball.over;
    const ballNum = ball.ball;
    this.score.overs = `${overNum - 1}.${ballNum}`;
    if (ballNum === 6) {
      this.score.overs = `${overNum}.0`;
    }

    // Recalculate rates
    const totalOvers = parseFloat(this.score.overs.replace('.', ''));
    const actualOvers = Math.floor(totalOvers / 10) + (totalOvers % 10) / 6;
    this.score.runRate = actualOvers > 0 ? (this.score.runs / actualOvers).toFixed(2) : 0;
    if (this.score.target) {
      const remaining = this.score.target - this.score.runs;
      const oversLeft = 20 - actualOvers;
      this.score.requiredRate = oversLeft > 0 ? (remaining / oversLeft).toFixed(2) : 999;
    }

    // Emit events
    this.emit('ballResult', { ball, score: { ...this.score }, index: this.currentBallIndex });

    if (ball.result === '4') this.emit('boundary', ball);
    if (ball.result === '6') this.emit('six', ball);
    if (ball.result === 'wicket') this.emit('wicket', ball);
    if (ball.result === 'drs') this.emit('drs', ball);
    if (ball.result === 'dot') this.emit('dot', ball);

    this.emit('scoreUpdate', { ...this.score });

    // Emit upcoming ball info for prediction
    const nextBall = this.balls[this.currentBallIndex + 1];
    if (nextBall) {
      this.emit('upcomingBall', nextBall);
    }

    // Schedule next ball
    if (this.isRunning && !this.isPaused && this.currentBallIndex < this.balls.length - 1) {
      this._scheduleBall();
    }
  }

  // ---- Event system ----
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }

  getCurrentBall() {
    return this.balls[this.currentBallIndex] || null;
  }

  getNextBall() {
    return this.balls[this.currentBallIndex + 1] || null;
  }

  getScore() {
    return { ...this.score };
  }

  getMatchInfo() {
    return this.matchData?.matchInfo || null;
  }
}

// Global instance
window.matchEngine = new MatchEngine();
