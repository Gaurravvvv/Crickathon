/* ========== CricPulse — Prediction Engine + Ball-by-Ball Tracker ========== */

// ===================== BALL-BY-BALL TRACKER =====================
class BallByBallTracker {
  constructor() {
    this.overs = [];        // completed overs: [{overNum, balls:[{result,runs,label}], totalRuns}]
    this.currentOver = [];   // balls in current over
    this.currentOverNum = 1;
    this.totalRuns = 0;
    this.totalWickets = 0;
    this.totalOvers = '0.0';
    this.commentaryLog = []; // [{overs, text, type}]
  }

  /** Add a ball from mock engine */
  addMockBall(ball, score) {
    const entry = {
      result: ball.result,
      runs: ball.result === 'dot' ? 0 : ball.result === 'wicket' ? 0 : ball.result === 'drs' ? 0 : parseInt(ball.result) || 0,
      label: this._ballLabel(ball.result),
      cssClass: this._ballClass(ball.result),
      commentary: ball.commentary
    };
    this.totalRuns = score.runs;
    this.totalWickets = score.wickets;
    this.totalOvers = score.overs;
    this.currentOverNum = parseInt(ball.over) || this.currentOverNum;
    this._pushBall(entry, ball.commentary, ball.result);
  }

  /** Add inferred ball from live score diff */
  addLiveDiff(diff) {
    const entry = {
      result: diff.result,
      runs: diff.runsDiff,
      label: this._ballLabel(diff.result),
      cssClass: this._ballClass(diff.result),
      commentary: diff.commentary
    };
    this.totalRuns = diff.currentScore.runs;
    this.totalWickets = diff.currentScore.wickets;
    this.totalOvers = diff.currentScore.overs;

    // Detect over change from overs string
    const overParts = String(diff.currentScore.overs).split('.');
    const newOverNum = parseInt(overParts[0]) + 1;
    const ballInOver = parseInt(overParts[1]) || 0;

    // If ball is 1 and we have balls in current over, flush to history
    if (ballInOver <= 1 && this.currentOver.length > 0 && newOverNum > this.currentOverNum) {
      this._flushOver();
    }
    this.currentOverNum = newOverNum;
    this._pushBall(entry, diff.commentary, diff.result);
  }

  _pushBall(entry, commentary, result) {
    this.currentOver.push(entry);

    // Log commentary
    this.commentaryLog.unshift({
      overs: this.totalOvers,
      text: commentary,
      type: result === 'wicket' ? 'wicket' : (result === '6' || result === '4') ? 'highlight' : 'normal'
    });
    if (this.commentaryLog.length > 30) this.commentaryLog.pop();

    // If 6 balls in current over, flush
    if (this.currentOver.length >= 6) {
      this._flushOver();
    }

    this.render();
  }

  _flushOver() {
    if (this.currentOver.length === 0) return;
    const overRuns = this.currentOver.reduce((s, b) => s + b.runs, 0);
    this.overs.unshift({
      overNum: this.currentOverNum,
      balls: [...this.currentOver],
      totalRuns: overRuns
    });
    if (this.overs.length > 20) this.overs.pop();
    this.currentOver = [];
  }

  _ballLabel(result) {
    const map = { 'dot':'•', '1':'1', '2':'2', '3':'3', '4':'4', '6':'6', 'wicket':'W', 'drs':'DRS', 'wide':'WD', 'noball':'NB' };
    return map[result] || result;
  }

  _ballClass(result) {
    const map = { 'dot':'dot', '1':'run-1', '2':'run-2', '3':'run-3', '4':'four', '6':'six', 'wicket':'wicket', 'drs':'wicket', 'wide':'wide', 'noball':'noball' };
    return map[result] || 'dot';
  }

  render() {
    // Score summary
    const summary = document.getElementById('bbb-score-summary');
    if (summary) summary.textContent = `${this.totalRuns}/${this.totalWickets} (${this.totalOvers} ov)`;

    // Current over label
    const label = document.getElementById('bbb-over-label');
    if (label) label.textContent = `Over ${this.currentOverNum}`;

    // Current over balls
    const strip = document.getElementById('bbb-balls-strip');
    if (strip) {
      strip.innerHTML = this.currentOver.length === 0
        ? '<span style="color:var(--text-muted);font-size:0.8rem;">Waiting for next delivery...</span>'
        : this.currentOver.map(b => `<div class="bbb-ball ${b.cssClass}">${b.label}</div>`).join('');
    }

    // Over history
    const history = document.getElementById('bbb-over-history');
    if (history) {
      history.innerHTML = this.overs.map(o => `
        <div class="bbb-over-row">
          <div class="bbb-over-num">Ov ${o.overNum}</div>
          <div class="bbb-over-balls">
            ${o.balls.map(b => `<div class="bbb-ball ${b.cssClass}">${b.label}</div>`).join('')}
          </div>
          <div class="bbb-over-runs">${o.totalRuns} runs</div>
        </div>
      `).join('');
    }

    // Commentary log
    const log = document.getElementById('bbb-commentary-log');
    if (log) {
      log.innerHTML = this.commentaryLog.slice(0, 10).map(c => {
        const cls = c.type === 'wicket' ? 'wicket-log' : c.type === 'highlight' ? 'highlight' : '';
        return `<div class="bbb-log-entry ${cls}"><span class="bbb-log-over">${c.overs}</span>${c.text}</div>`;
      }).join('');
    }
  }
}

// ===================== PREDICTION ENGINE =====================
class PredictionEngine {
  constructor() {
    this.selectedPrediction = null;
    this.isLocked = false;
    this.points = 0;
    this.correctPredictions = 0;
    this.totalPredictions = 0;
    this.leaderboard = [
      { name: 'CricMaster99', score: 1250, correct: 18 },
      { name: 'IPL_Fanatic', score: 1180, correct: 16 },
      { name: 'BallPredictor', score: 1050, correct: 15 },
      { name: 'SixerKing', score: 980, correct: 14 },
      { name: 'WicketWiz', score: 920, correct: 12 },
    ];
    this.pointsMap = { 'dot':10, '1':10, '2':15, '3':20, '4':25, '6':30, 'wicket':40, 'drs':50 };
    this.liveCountdown = null;
    this.isLiveMode = false;
    this.bbbTracker = new BallByBallTracker();
  }

  init() {
    this._bindButtons();
    this._renderLeaderboard();
    this._connectMatchEngine();
    this._setupLiveHandler();
  }

  _bindButtons() {
    document.querySelectorAll('.predict-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isLocked) return;
        document.querySelectorAll('.predict-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedPrediction = btn.dataset.prediction;
        if (window.soundFX) window.soundFX.tick();
      });
    });
  }

  /** Live mode: handler for score diffs from LiveMatchUI */
  _setupLiveHandler() {
    // Called when score actually changes (from LiveMatchUI._onScoreDiff)
    window.livePredictionHandler = (diff) => {
      this.isLiveMode = true;
      this._lockPredictions();

      // Feed ball-by-ball tracker
      this.bbbTracker.addLiveDiff(diff);

      // Check prediction
      this._checkLivePrediction(diff);

      // Restart countdown for next prediction window after showing result
      setTimeout(() => this._startLiveCountdown(), 3000);
    };

    // Called every 30s with full match data (even when score hasn't changed)
    window.liveMatchUpdateHandler = (parsed) => {
      if (!this.isLiveMode) {
        this.isLiveMode = true;
        // First time entering live mode — start the prediction cycle
        this._startLiveCountdown();
      }
      // Update the score display in prediction card
      this._updateLiveScoreDisplay(parsed);
    };
  }

  /** Show live score in the prediction card header */
  _updateLiveScoreDisplay(parsed) {
    const bn = document.getElementById('ball-number');
    const bi = document.getElementById('bowler-info');
    const i1 = parsed.score.innings1, i2 = parsed.score.innings2;
    const activeInn = i2.runs > 0 ? i2 : i1;

    if (bn) bn.textContent = `🔴 LIVE — ${activeInn.runs}/${activeInn.wickets} (${activeInn.overs} ov)`;
    if (bi) bi.innerHTML = `<span class="material-icons-round">sports</span> ${parsed.team1.abbr} vs ${parsed.team2.abbr} — ${parsed.status}`;
  }

  _startLiveCountdown() {
    this._unlockPredictions();
    let seconds = 30;
    const fg = document.getElementById('countdown-fg');
    const text = document.getElementById('countdown-text');
    if (!fg || !text) return;

    const circumference = 2 * Math.PI * 45;
    fg.style.strokeDasharray = circumference;
    fg.style.stroke = 'var(--accent)';
    text.style.color = 'var(--accent)';
    text.textContent = seconds;
    fg.style.strokeDashoffset = 0;

    if (this.liveCountdown) clearInterval(this.liveCountdown);
    this.liveCountdown = setInterval(() => {
      seconds--;
      text.textContent = seconds;
      fg.style.strokeDashoffset = circumference * (1 - seconds / 30);
      if (seconds <= 5) { fg.style.stroke = '#ff6b6b'; text.style.color = '#ff6b6b'; }
      if (seconds <= 3) this._lockPredictions();
      if (seconds <= 0) {
        clearInterval(this.liveCountdown);
        // If no score change arrived, show "waiting" and restart
        const resultEl = document.getElementById('predict-result');
        if (resultEl) {
          resultEl.style.display = 'block';
          resultEl.innerHTML = `<div class="result-reveal" style="border-color: var(--text-muted);"><div class="result-emoji">⏳</div><div class="result-text">Waiting for next ball from live feed...</div><div class="result-sub">Predictions will reopen shortly</div></div>`;
        }
        // Restart countdown after brief pause
        setTimeout(() => this._startLiveCountdown(), 5000);
      }
    }, 1000);
  }

  _checkLivePrediction(diff) {
    this.totalPredictions++;
    const result = diff.result;
    const resultEl = document.getElementById('predict-result');
    if (!resultEl) return;

    const emojiMap = { 'dot':'⚫','1':'1️⃣','2':'2️⃣','3':'3️⃣','4':'4️⃣','6':'6️⃣','wicket':'🔴' };
    const correct = this.selectedPrediction === result;

    if (correct) {
      const earned = this.pointsMap[result] || 10;
      this.points += earned;
      this.correctPredictions++;
      if (window.soundFX) window.soundFX.success();
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="result-reveal" style="border-color: var(--accent);"><div class="result-emoji">${emojiMap[result]||'✅'}</div><div class="result-text">${diff.commentary}</div><div class="result-sub">🎉 Correct! +${earned} pts (Total: ${this.points})</div></div>`;
    } else if (!this.selectedPrediction) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="result-reveal" style="border-color: var(--text-muted);"><div class="result-emoji">${emojiMap[result]||'🏏'}</div><div class="result-text">${diff.commentary}</div><div class="result-sub">⏰ No prediction made — select before time runs out!</div></div>`;
    } else {
      if (window.soundFX) window.soundFX.fail();
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="result-reveal" style="border-color: #ff6b6b;"><div class="result-emoji">${emojiMap[result]||'❌'}</div><div class="result-text">${diff.commentary}</div><div class="result-sub">❌ Wrong! You predicted ${this.selectedPrediction}, it was ${result}</div></div>`;
    }
    this._updateLeaderboard();
  }

  // ========== MOCK ENGINE CONNECTION ==========
  _connectMatchEngine() {
    const engine = window.matchEngine;
    if (!engine) return;

    engine.on('upcomingBall', (ball) => { this._updateBallInfo(ball); this._unlockPredictions(); });

    engine.on('ballResult', ({ ball, score }) => {
      this._lockPredictions();
      this._checkPrediction(ball);
      this._updateScoreDisplay(score);
      // Feed ball-by-ball tracker from mock engine
      this.bbbTracker.addMockBall(ball, score);
    });

    engine.on('countdownStart', (s) => this._startCountdown(s));
    engine.on('countdown', (s) => this._updateCountdown(s));
    engine.on('matchLoaded', (d) => { if (d.balls?.length > 0) this._updateBallInfo(d.balls[0]); });
  }

  _updateBallInfo(ball) {
    const bn = document.getElementById('ball-number');
    const bi = document.getElementById('bowler-info');
    if (bn) bn.textContent = `Ball ${ball.ball} of Over ${ball.over}`;
    if (bi) bi.innerHTML = `<span class="material-icons-round">sports</span> ${ball.bowler} → ${ball.batsman}`;
  }

  _startCountdown(totalSeconds) {
    const fg = document.getElementById('countdown-fg'), text = document.getElementById('countdown-text');
    if (!fg || !text) return;
    fg.style.strokeDasharray = 2 * Math.PI * 45;
    fg.style.stroke = 'var(--accent)'; text.style.color = 'var(--accent)';
    text.textContent = totalSeconds; fg.style.strokeDashoffset = 0;
  }

  _updateCountdown(seconds) {
    const fg = document.getElementById('countdown-fg'), text = document.getElementById('countdown-text');
    if (!fg || !text) return;
    const total = Math.ceil(window.matchEngine.intervalMs / 1000);
    const circ = 2 * Math.PI * 45;
    text.textContent = seconds;
    fg.style.strokeDashoffset = circ * (1 - seconds / total);
    if (seconds <= 5) { fg.style.stroke = '#ff6b6b'; text.style.color = '#ff6b6b'; }
    if (seconds <= 3) this._lockPredictions();
  }

  _lockPredictions() {
    this.isLocked = true;
    document.querySelectorAll('.predict-btn').forEach(b => { b.style.opacity = '0.5'; b.style.pointerEvents = 'none'; });
  }

  _unlockPredictions() {
    this.isLocked = false;
    this.selectedPrediction = null;
    document.querySelectorAll('.predict-btn').forEach(b => { b.classList.remove('selected'); b.style.opacity = '1'; b.style.pointerEvents = 'auto'; });
    const r = document.getElementById('predict-result'); if (r) r.style.display = 'none';
  }

  _checkPrediction(ball) {
    if (this.isLiveMode) return;
    this.totalPredictions++;
    const result = ball.result, resultEl = document.getElementById('predict-result');
    if (!resultEl) return;
    const emojiMap = {'dot':'⚫','1':'1️⃣','2':'2️⃣','3':'3️⃣','4':'4️⃣','6':'6️⃣','wicket':'🔴','drs':'🔍'};
    const correct = this.selectedPrediction === result || (this.selectedPrediction === 'wicket' && result === 'drs' && ball.drsResult === 'out');
    if (correct) {
      const earned = this.pointsMap[result] || 10;
      this.points += earned; this.correctPredictions++;
      if (window.soundFX) window.soundFX.success();
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="result-reveal" style="border-color: var(--accent);"><div class="result-emoji">${emojiMap[result]||'✅'}</div><div class="result-text">${ball.commentary}</div><div class="result-sub">🎉 Correct! +${earned} pts (Total: ${this.points})</div></div>`;
    } else {
      if (window.soundFX) window.soundFX.fail();
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="result-reveal" style="border-color: #ff6b6b;"><div class="result-emoji">${emojiMap[result]||'❌'}</div><div class="result-text">${ball.commentary}</div><div class="result-sub">${this.selectedPrediction ? '❌ Wrong!' : '⏰ No prediction!'}</div></div>`;
    }
    if (result === '6' && window.soundFX) window.soundFX.bigSix();
    else if (result === '4' && window.soundFX) window.soundFX.cheer();
    else if ((result === 'wicket' || result === 'drs') && window.soundFX) window.soundFX.wicket();
    this._updateLeaderboard();
  }

  _updateScoreDisplay(score) {
    const el = document.getElementById('ticker-score2');
    if (el) el.textContent = `${score.runs}/${score.wickets}`;
    const ov = document.getElementById('ticker-overs');
    if (ov) ov.textContent = `${score.overs} ov`;
  }

  _updateLeaderboard() {
    const u = this.leaderboard.find(p => p.name === 'You');
    if (u) { u.score = this.points; u.correct = this.correctPredictions; }
    else this.leaderboard.push({ name: 'You', score: this.points, correct: this.correctPredictions });
    this.leaderboard.sort((a, b) => b.score - a.score);
    this._renderLeaderboard();
  }

  _renderLeaderboard() {
    const list = document.getElementById('predict-lb-list');
    if (!list) return;
    list.innerHTML = this.leaderboard.map((p, i) => {
      const rc = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
      const isU = p.name === 'You';
      return `<div class="lb-item" style="${isU?'border:1px solid var(--accent);background:rgba(0,229,160,0.05);':''}"><div class="lb-rank ${rc}">${medal}</div><div class="lb-name">${p.name}${isU?' ⭐':''}</div><div class="lb-score">${p.score.toLocaleString()} pts</div></div>`;
    }).join('');
  }
}

window.BallByBallTracker = BallByBallTracker;
window.PredictionEngine = PredictionEngine;
