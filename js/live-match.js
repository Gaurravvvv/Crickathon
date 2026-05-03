/* ========== CricPulse — Live Match Integration v2 ========== */
/* Feeds real-time API data into Polls, Predictions, and AI Chat */

class LiveMatchProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.cricapi.com/v1';
    this.pollInterval = 30000;
    this.timer = null;
    this.selectedMatchId = null;
    this.previousParsed = null;
    this.currentParsed = null;
    this.listeners = {};
    this.isRunning = false;
    this.matchList = [];
    this.scorecardData = null;   // detailed batting/bowling
    this.scorecardText = '';     // formatted for AI context
    this.scorecardTimer = null;
  }

  async fetchCurrentMatches() {
    try {
      const url = `${this.baseUrl}/currentMatches?apikey=${this.apiKey}&offset=0`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (data.status !== 'success') throw new Error(data.info || 'API error');
      this.matchList = (data.data || []).filter(m => m.matchStarted && !m.matchEnded);
      this.emit('matchListUpdated', this.matchList);
      return this.matchList;
    } catch (err) {
      console.error('Live fetch failed:', err);
      this.emit('error', { type: 'fetch', message: err.message });
      return [];
    }
  }

  async fetchScorecard(matchId) {
    try {
      const url = `${this.baseUrl}/match_scorecard?apikey=${this.apiKey}&id=${matchId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Scorecard API ${res.status}`);
      const data = await res.json();
      if (data.status !== 'success' || !data.data) throw new Error(data.info || 'No scorecard');

      this.scorecardData = data.data;
      this.scorecardText = this._formatScorecard(data.data);
      this.emit('scorecardUpdated', this.scorecardText);
      return this.scorecardText;
    } catch (err) {
      console.warn('Scorecard fetch failed (may need paid plan):', err.message);
      this.scorecardText = '';
      return '';
    }
  }

  _formatScorecard(sc) {
    let text = '';
    // Process each innings scorecard
    const innings = sc.scorecard || sc.innings || [];
    innings.forEach((inn, idx) => {
      const innLabel = inn.inning || `Innings ${idx + 1}`;
      text += `\n${innLabel}:\n`;

      // Batting
      if (inn.batting && inn.batting.length > 0) {
        text += 'Batting: ';
        text += inn.batting.map(b => {
          const howOut = b['dismissal-text'] || b.dismissal || b.howOut || 'not out';
          return `${b.batsman?.name || b.batsman || '?'} ${b.r || 0}(${b.b || 0}b) [${howOut}]`;
        }).join(', ');
        text += '\n';
      }

      // Bowling
      if (inn.bowling && inn.bowling.length > 0) {
        text += 'Bowling: ';
        text += inn.bowling.map(b => {
          return `${b.bowler?.name || b.bowler || '?'} ${b.o || 0}ov ${b.w || 0}wkt/${b.r || 0}runs`;
        }).join(', ');
        text += '\n';
      }
    });
    return text.trim();
  }

  selectMatch(matchId) {
    this.selectedMatchId = matchId;
    this.previousParsed = null;
    this.currentParsed = null;

    // Fetch scorecard immediately + every 60s
    this.fetchScorecard(matchId);
    if (this.scorecardTimer) clearInterval(this.scorecardTimer);
    this.scorecardTimer = setInterval(() => this.fetchScorecard(matchId), 60000);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._poll();
    this.timer = setInterval(() => this._poll(), this.pollInterval);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  async _poll() {
    const matches = await this.fetchCurrentMatches();
    if (!this.selectedMatchId) return;
    const match = matches.find(m => m.id === this.selectedMatchId);
    if (match) this._processUpdate(match);
  }

  _processUpdate(match) {
    this.previousParsed = this.currentParsed;
    this.currentParsed = this._parse(match);

    // Always emit full update
    this.emit('matchUpdate', this.currentParsed);

    // Detect what changed since last poll
    if (this.previousParsed) {
      const diff = this._detectScoreDiff(this.previousParsed, this.currentParsed);
      if (diff.changed) {
        this.emit('scoreDiff', diff);
      }
    }
  }

  /** Compare two parsed snapshots and infer what happened */
  _detectScoreDiff(prev, curr) {
    // Determine active innings
    const pInn = prev.score.innings2.runs > 0 ? prev.score.innings2 : prev.score.innings1;
    const cInn = curr.score.innings2.runs > 0 ? curr.score.innings2 : curr.score.innings1;

    const runsDiff = cInn.runs - pInn.runs;
    const wicketsDiff = cInn.wickets - pInn.wickets;
    const oversDiff = parseFloat(cInn.overs) - parseFloat(pInn.overs);

    if (runsDiff === 0 && wicketsDiff === 0 && oversDiff === 0) {
      return { changed: false };
    }

    // Infer result type
    let result = 'dot';
    let commentary = '';
    if (wicketsDiff > 0) {
      result = 'wicket';
      commentary = `WICKET! ${wicketsDiff} wicket(s) fell. Score now ${cInn.runs}/${cInn.wickets}`;
    } else if (runsDiff >= 6) {
      result = '6';
      commentary = `SIX! ${runsDiff} runs scored — could include a maximum! ${cInn.runs}/${cInn.wickets}`;
    } else if (runsDiff >= 4) {
      result = '4';
      commentary = `FOUR! ${runsDiff} runs added. ${cInn.runs}/${cInn.wickets}`;
    } else if (runsDiff === 3) {
      result = '3';
      commentary = `Three runs scored. ${cInn.runs}/${cInn.wickets}`;
    } else if (runsDiff === 2) {
      result = '2';
      commentary = `Two runs taken. ${cInn.runs}/${cInn.wickets}`;
    } else if (runsDiff === 1) {
      result = '1';
      commentary = `Single run. ${cInn.runs}/${cInn.wickets}`;
    } else {
      commentary = `Dot ball or no change. ${cInn.runs}/${cInn.wickets}`;
    }

    return {
      changed: true,
      result,
      runsDiff,
      wicketsDiff,
      commentary,
      currentScore: { runs: cInn.runs, wickets: cInn.wickets, overs: cInn.overs },
      status: curr.status
    };
  }

  _parse(match) {
    const scores = match.score || [];
    const t1 = match.teamInfo?.[0] || { name: match.teams?.[0] || 'Team 1', shortname: 'T1' };
    const t2 = match.teamInfo?.[1] || { name: match.teams?.[1] || 'Team 2', shortname: 'T2' };
    const i1 = scores[0] || {}, i2 = scores[1] || {};
    return {
      id: match.id,
      name: match.name || `${t1.name} vs ${t2.name}`,
      status: match.status || '',
      venue: match.venue || '',
      matchType: match.matchType || 'T20',
      team1: { name: t1.name || match.teams?.[0] || 'Team 1', abbr: t1.shortname || this._abbr(t1.name || match.teams?.[0]), img: t1.img || '' },
      team2: { name: t2.name || match.teams?.[1] || 'Team 2', abbr: t2.shortname || this._abbr(t2.name || match.teams?.[1]), img: t2.img || '' },
      score: {
        innings1: { team: i1.inning || t1.name, runs: i1.r || 0, wickets: i1.w || 0, overs: i1.o || '0.0' },
        innings2: { team: i2.inning || t2.name, runs: i2.r || 0, wickets: i2.w || 0, overs: i2.o || '0.0' }
      },
      raw: match
    };
  }

  _abbr(name) {
    if (!name) return '???';
    const map = { 'Kolkata Knight Riders':'KKR','Sunrisers Hyderabad':'SRH','Chennai Super Kings':'CSK','Mumbai Indians':'MI','Royal Challengers':'RCB','Royal Challengers Bengaluru':'RCB','Delhi Capitals':'DC','Rajasthan Royals':'RR','Punjab Kings':'PBKS','Lucknow Super Giants':'LSG','Gujarat Titans':'GT' };
    for (const [k, v] of Object.entries(map)) { if (name.includes(k)) return v; }
    return name.substring(0, 3).toUpperCase();
  }

  on(e, cb) { if (!this.listeners[e]) this.listeners[e] = []; this.listeners[e].push(cb); }
  emit(e, d) { (this.listeners[e] || []).forEach(cb => cb(d)); }
}

// =====================================================================
// LiveMatchUI — wires provider into Ticker, Polls, Predictions, Chat
// =====================================================================
class LiveMatchUI {
  constructor() {
    this.provider = null;
    this.isLive = false;
    this.matchData = null;
    this.pickerShown = false; // only show picker once
  }

  init(apiKey) {
    this.provider = new LiveMatchProvider(apiKey);
    this.provider.on('matchListUpdated', m => {
      if (!this.isLive && !this.pickerShown) this._showMatchPicker(m);
    });
    this.provider.on('matchUpdate', p => this._onMatchUpdate(p));
    this.provider.on('scoreDiff', d => this._onScoreDiff(d));
    this.provider.on('error', e => { console.warn('Live error:', e); showCommentary(`⚠️ ${e.message}`); });
    this.provider.fetchCurrentMatches();
  }

  startTracking(matchId) {
    this.isLive = true;
    this.pickerShown = true;
    this.provider.selectMatch(matchId);
    this.provider.start();
    if (window.matchEngine) window.matchEngine.pause();
    this._showLiveIndicator();
    this._createFloatingScoreBox();
  }

  stopTracking() {
    this.isLive = false;
    if (this.provider) this.provider.stop();
    this._hideLiveIndicator();
    if (window.matchEngine) window.matchEngine.resume();
  }

  // ---- Called every 30s with full match data ----
  _onMatchUpdate(parsed) {
    this.matchData = parsed;
    this._updateTicker(parsed);
    this._feedChatbotContext(parsed);
    this._updateFloatingScore(parsed);

    // Feed prediction engine with live score (starts countdown on first call)
    if (window.liveMatchUpdateHandler) {
      window.liveMatchUpdateHandler(parsed);
    }
  }

  // ---- Called when score actually changed ----
  _onScoreDiff(diff) {
    // 1. Commentary toast
    showCommentary(`🔴 ${diff.commentary}`);

    // 2. Feed prediction engine
    if (window.livePredictionHandler) {
      window.livePredictionHandler(diff);
    }

    // 3. Feed chatbot with event
    if (window.chatbotInstance) {
      const cs = diff.currentScore;
      window.chatbotInstance.matchContext =
        `LIVE: ${this.matchData.team1.abbr} vs ${this.matchData.team2.abbr} — ` +
        `${cs.runs}/${cs.wickets} (${cs.overs} ov). ` +
        `Last update: ${diff.commentary}. Status: ${diff.status}`;

      // Auto-message on big events
      if (diff.result === '6') {
        window.chatbotInstance._addMessage(`🔴🎉 SIXXX! ${diff.commentary} What a hit! 🚀`, 'bot');
      } else if (diff.result === 'wicket') {
        window.chatbotInstance._addMessage(`🔴🔥 WICKET! ${diff.commentary} The crowd goes wild! ⚡`, 'bot');
      }
    }

    // 4. Sound effects
    if (diff.result === '6' && window.soundFX) window.soundFX.bigSix();
    else if (diff.result === '4' && window.soundFX) window.soundFX.cheer();
    else if (diff.result === 'wicket' && window.soundFX) window.soundFX.wicket();
  }

  // ---- Ticker ----
  _updateTicker(p) {
    const el = (id) => document.getElementById(id);
    if (el('ticker-team1')) el('ticker-team1').textContent = p.team1.abbr;
    if (el('ticker-team2')) el('ticker-team2').textContent = p.team2.abbr;
    if (el('ticker-score1')) el('ticker-score1').textContent = `${p.score.innings1.runs}/${p.score.innings1.wickets}`;
    if (el('ticker-score2')) el('ticker-score2').textContent = p.score.innings2.runs ? `${p.score.innings2.runs}/${p.score.innings2.wickets}` : '—';
    const ov = p.score.innings2.overs || p.score.innings1.overs;
    if (el('ticker-overs')) el('ticker-overs').textContent = `${ov} ov`;
  }

  // ---- Prediction UI context ----
  _updatePredictionUI(p) {
    const bn = document.getElementById('ball-number');
    const bi = document.getElementById('bowler-info');
    const activeInn = p.score.innings2.runs > 0 ? p.score.innings2 : p.score.innings1;
    if (bn) bn.textContent = `🔴 LIVE — ${activeInn.runs}/${activeInn.wickets} (${activeInn.overs} ov)`;
    if (bi) bi.innerHTML = `<span class="material-icons-round">sports</span> ${p.team1.abbr} vs ${p.team2.abbr} — ${p.status}`;
  }

  // ---- Chat context ----
  _feedChatbotContext(p) {
    if (!window.chatbotInstance) return;
    const i1 = p.score.innings1, i2 = p.score.innings2;
    const scorecardInfo = this.provider.scorecardText || '';
    let ctx =
      `LIVE IPL Match: ${p.team1.name} (${i1.runs}/${i1.wickets}, ${i1.overs} ov) vs ` +
      `${p.team2.name} (${i2.runs}/${i2.wickets}, ${i2.overs} ov). ` +
      `Status: ${p.status}. Venue: ${p.venue}`;

    if (scorecardInfo) {
      ctx += `\n\nDETAILED SCORECARD (use this to answer player-specific questions):\n${scorecardInfo}`;
    }

    window.chatbotInstance.matchContext = ctx;
  }

  // ---- Live indicator ----
  _showLiveIndicator() {
    if (document.getElementById('live-indicator')) return;
    const el = document.createElement('div');
    el.id = 'live-indicator';
    el.className = 'live-indicator';
    el.innerHTML = `<span class="live-dot"></span><span>LIVE</span>`;
    document.getElementById('score-ticker')?.prepend(el);
  }
  _hideLiveIndicator() { document.getElementById('live-indicator')?.remove(); }

  // ---- Floating score box (top-right) ----
  _createFloatingScoreBox() {
    if (document.getElementById('live-score-box')) return;
    const box = document.createElement('div');
    box.id = 'live-score-box';
    box.className = 'live-score-box';
    box.innerHTML = `
      <div class="lsb-dot"></div>
      <div class="lsb-teams" id="lsb-teams">— vs —</div>
      <div class="lsb-score" id="lsb-score">0/0 (0.0)</div>
      <div class="lsb-status" id="lsb-status"></div>
    `;
    document.body.appendChild(box);
  }

  _updateFloatingScore(p) {
    const teams = document.getElementById('lsb-teams');
    const score = document.getElementById('lsb-score');
    const status = document.getElementById('lsb-status');
    if (!teams) return;
    teams.textContent = `${p.team1.abbr} vs ${p.team2.abbr}`;
    const active = p.score.innings2.runs > 0 ? p.score.innings2 : p.score.innings1;
    score.textContent = `${active.runs}/${active.wickets} (${active.overs} ov)`;
    status.textContent = p.status;
  }

  // ---- Match picker ----
  _showMatchPicker(matches) {
    if (matches.length === 0) { showCommentary('No live matches right now. Using mock data.'); return; }
    let picker = document.getElementById('live-match-picker');
    if (picker) picker.remove();
    picker = document.createElement('div');
    picker.id = 'live-match-picker';
    picker.className = 'match-picker-overlay';
    picker.innerHTML = `
      <div class="match-picker-content">
        <div class="match-picker-header">
          <h3>🔴 Live Matches</h3>
          <button class="match-picker-close" id="match-picker-close">✕</button>
        </div>
        <p class="match-picker-desc">Select a match to track in real-time:</p>
        <div class="match-picker-list">
          ${matches.map(m => {
            const p = this.provider._parse(m);
            return `<div class="match-picker-card" data-match-id="${m.id}">
              <div class="match-picker-teams"><span class="mpc-team">${p.team1.abbr}</span><span class="mpc-vs">vs</span><span class="mpc-team">${p.team2.abbr}</span></div>
              <div class="match-picker-score">${p.score.innings1.runs}/${p.score.innings1.wickets} (${p.score.innings1.overs})${p.score.innings2.runs ? ` | ${p.score.innings2.runs}/${p.score.innings2.wickets} (${p.score.innings2.overs})` : ''}</div>
              <div class="match-picker-status">${p.status}</div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn-secondary" id="btn-use-mock">Use Mock Match Instead</button>
      </div>`;
    document.body.appendChild(picker);

    picker.querySelectorAll('.match-picker-card').forEach(card => {
      card.addEventListener('click', () => {
        const matchId = card.dataset.matchId;
        // Find match data and generate polls
        const match = matches.find(m => m.id === matchId);
        const parsed = this.provider._parse(match);
        this.startTracking(matchId);
        this._generateLivePolls(parsed);
        picker.remove();
        showCommentary(`🔴 LIVE — Tracking ${parsed.team1.abbr} vs ${parsed.team2.abbr}!`);
      });
    });
    document.getElementById('match-picker-close').addEventListener('click', () => picker.remove());
    document.getElementById('btn-use-mock').addEventListener('click', () => { picker.remove(); showCommentary('Using mock match.'); });
  }

  // ---- Generate match-specific polls ----
  _generateLivePolls(parsed) {
    const t1 = parsed.team1.name, t2 = parsed.team2.name;
    const a1 = parsed.team1.abbr, a2 = parsed.team2.abbr;
    const livePolls = [
      { id: 100, tag: 'match', question: `🏏 Who will win: ${t1} vs ${t2}?`, options: [`${a1} 💪`, `${a2} 🔥`, 'Super Over! 🎯'], votes: [Math.floor(Math.random()*500)+100, Math.floor(Math.random()*500)+100, Math.floor(Math.random()*100)+10], comments: [{name:'CricFan', text:`${a1} all the way!`}] },
      { id: 101, tag: 'match', question: `Will ${a1} score more than 180 today?`, options: ['Definitely Yes! 🔥', 'No way 😤', 'Exactly 180 🎯'], votes: [Math.floor(Math.random()*300)+50, Math.floor(Math.random()*300)+50, Math.floor(Math.random()*50)+5], comments: [] },
      { id: 102, tag: 'match', question: `Who will be Player of the Match?`, options: [`${a1} Batsman 🏏`, `${a2} Bowler 🎳`, `${a1} All-rounder ⚡`, `${a2} Batsman 💥`], votes: [Math.floor(Math.random()*200)+20, Math.floor(Math.random()*200)+20, Math.floor(Math.random()*200)+20, Math.floor(Math.random()*200)+20], comments: [{name:'IPL_Guru', text:'All-rounder for sure!'}] },
      { id: 103, tag: 'match', question: `How many sixes in ${a1} vs ${a2} today?`, options: ['Less than 10', '10-15 🔥', '15-20 💥', '20+ 🚀'], votes: [Math.floor(Math.random()*150)+20, Math.floor(Math.random()*200)+40, Math.floor(Math.random()*150)+30, Math.floor(Math.random()*100)+10], comments: [] },
      { id: 104, tag: 'match', question: `Will there be a DRS review in the next 5 overs?`, options: ['Yes, definitely! 🔍', 'No reviews needed', 'Multiple reviews! 😱'], votes: [Math.floor(Math.random()*250)+50, Math.floor(Math.random()*200)+30, Math.floor(Math.random()*100)+10], comments: [] },
      { id: 105, tag: 'match', question: `What will ${a2}'s powerplay score be?`, options: ['Under 40 🛡️', '40-55 ⚡', '55-70 🔥', '70+ 💣'], votes: [Math.floor(Math.random()*150)+20, Math.floor(Math.random()*200)+40, Math.floor(Math.random()*150)+30, Math.floor(Math.random()*80)+10], comments: [{name:'BatStats', text:'Powerplay king territory!'}] },
      { id: 106, tag: 'fun', question: `Which team has better jerseys?`, options: [`${a1} 😍`, `${a2} 🤩`, 'Both are 🔥'], votes: [Math.floor(Math.random()*300)+50, Math.floor(Math.random()*300)+50, Math.floor(Math.random()*100)+20], comments: [] },
      { id: 107, tag: 'fun', question: `Rate this match excitement so far!`, options: ['🥱 Boring', '😐 Average', '🔥 Exciting!', '🤯 INSANE!'], votes: [Math.floor(Math.random()*50)+5, Math.floor(Math.random()*100)+20, Math.floor(Math.random()*200)+50, Math.floor(Math.random()*150)+30], comments: [] },
    ];

    // Replace polls in the dashboard
    if (window.pollsDashboard) {
      window.pollsDashboard.polls = livePolls;
      window.pollsDashboard.votedPolls = new Set();
      window.pollsDashboard.render();
    }
  }
}

window.LiveMatchProvider = LiveMatchProvider;
window.LiveMatchUI = LiveMatchUI;
