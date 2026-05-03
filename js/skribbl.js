/* ========== CricPulse — Cricket Skribbl Game (Dashboard 2) ========== */

class SkribblGame {
  constructor() {
    this.rounds = [];
    this.currentRound = 0;
    this.totalRounds = 5;
    this.timePerRound = 30;
    this.timeLeft = 0;
    this.timer = null;
    this.score = 0;
    this.isPlaying = false;
    this.currentAnswer = '';
    this.hintsRevealed = 0;
    this.hintInterval = null;
    this.gameData = [];

    // Simulated multiplayer players
    this.players = [
      { id: 1, name: 'CricFan07', score: 0, avatar: '🏏' },
      { id: 2, name: 'IPL_Guru', score: 0, avatar: '🎯' },
      { id: 3, name: 'SixHitter', score: 0, avatar: '💪' },
      { id: 4, name: 'SpinMaster', score: 0, avatar: '🌀' },
      { id: 5, name: 'You', score: 0, avatar: '⭐' },
    ];
  }

  async loadData(url) {
    try {
      const res = await fetch(url);
      this.gameData = await res.json();
    } catch (err) {
      console.error('Failed to load skribbl data:', err);
    }
  }

  init() {
    // Join room button
    const joinBtn = document.getElementById('btn-join-room');
    if (joinBtn) joinBtn.addEventListener('click', () => this.startGame());

    // Room items
    document.querySelectorAll('.lobby-room-item').forEach(r => {
      r.addEventListener('click', () => this.startGame());
    });

    // Guess input
    const guessBtn = document.getElementById('btn-guess');
    if (guessBtn) guessBtn.addEventListener('click', () => this._handleGuess());

    const guessInput = document.getElementById('guess-input');
    if (guessInput) {
      guessInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._handleGuess();
      });
    }

    this._renderLobbyRooms();
  }

  _renderLobbyRooms() {
    const rooms = [
      { name: '🏟️ The Pavilion', players: 5, max: 8 },
      { name: '🏏 The Crease', players: 3, max: 8 },
      { name: '🎯 The Boundary', players: 7, max: 8 },
    ];
    const el = document.getElementById('lobby-rooms');
    if (!el) return;
    el.innerHTML = rooms.map(r => `
      <div class="lobby-room-item">
        <span class="room-name">${r.name}</span>
        <span class="room-players">
          <span class="material-icons-round" style="font-size:16px">person</span>
          ${r.players}/${r.max}
        </span>
      </div>
    `).join('');
    el.querySelectorAll('.lobby-room-item').forEach(r => {
      r.addEventListener('click', () => this.startGame());
    });
  }

  startGame() {
    if (window.soundFX) window.soundFX.notify();

    // Select random rounds
    this._selectRounds();

    // Switch to game view
    document.getElementById('skribbl-lobby').style.display = 'none';
    document.getElementById('skribbl-game').style.display = 'block';

    this.isPlaying = true;
    this.currentRound = 0;
    this.score = 0;
    this.players.forEach(p => p.score = 0);

    this._startRound();
  }

  _selectRounds() {
    // Shuffle and pick 5
    const shuffled = [...this.gameData].sort(() => Math.random() - 0.5);
    this.rounds = shuffled.slice(0, this.totalRounds);
  }

  _startRound() {
    if (this.currentRound >= this.totalRounds) {
      this._showPodium();
      return;
    }

    const round = this.rounds[this.currentRound];
    this.currentAnswer = round.answer.toLowerCase();
    this.hintsRevealed = 0;
    this.timeLeft = this.timePerRound;

    // Update UI
    document.getElementById('game-round').textContent = `Round ${this.currentRound + 1}/${this.totalRounds}`;
    document.getElementById('game-points').textContent = `${this.score} pts`;
    document.getElementById('timer-val').textContent = this.timeLeft;

    // Clear hints
    const hintsEl = document.getElementById('game-hints');
    hintsEl.innerHTML = '';

    // Setup image/display based on round type
    this._setupRoundDisplay(round);

    // Render players
    this._renderPlayers();

    // Start hint timer
    this._startHints(round);

    // Start countdown
    this._startTimer();
  }

  _setupRoundDisplay(round) {
    const img = document.getElementById('reveal-img');
    const overlay = document.getElementById('pixel-overlay');

    if (round.type === 'achievement') {
      // Achievement round — show question mark icon
      img.src = this._generateSVG('🏆', 'Achievement Round', 'Who is this cricketer?');
      overlay.style.backdropFilter = 'none';
      overlay.style.background = 'none';
    } else if (round.type === 'jersey') {
      // Jersey round — show jersey number
      img.src = this._generateSVG(`#${round.jersey}`, round.team || '???', 'Guess the player!');
      overlay.style.backdropFilter = 'none';
      overlay.style.background = 'none';
    } else {
      // Image round — blurred
      img.src = this._generateSVG('❓', 'Image Round', 'Unblurring...');
      overlay.style.backdropFilter = 'blur(30px) brightness(0.6)';
      overlay.style.background = '';
    }
  }

  _generateSVG(icon, subtitle, caption) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
      </defs>
      <rect width="320" height="320" fill="url(#bg)"/>
      <text x="160" y="130" text-anchor="middle" fill="white" font-size="64">${icon}</text>
      <text x="160" y="185" text-anchor="middle" fill="#00e5a0" font-family="Arial" font-size="18" font-weight="bold">${subtitle}</text>
      <text x="160" y="215" text-anchor="middle" fill="#8892b0" font-family="Arial" font-size="14">${caption}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  _startHints(round) {
    const hintsEl = document.getElementById('game-hints');
    const hintDelay = Math.floor(this.timePerRound / (round.hints.length + 1)) * 1000;

    this.hintInterval = setInterval(() => {
      if (this.hintsRevealed < round.hints.length) {
        const chip = document.createElement('div');
        chip.className = 'hint-chip';
        chip.innerHTML = `<span class="hint-number">CLUE ${this.hintsRevealed + 1}</span> ${round.hints[this.hintsRevealed]}`;
        chip.style.animation = 'fadeInUp 0.4s ease';
        hintsEl.appendChild(chip);
        this.hintsRevealed++;
        if (window.soundFX) window.soundFX.notify();

        // For image rounds, unblur progressively
        if (round.type === 'image') {
          const overlay = document.getElementById('pixel-overlay');
          const blur = 30 - (this.hintsRevealed * 10);
          overlay.style.backdropFilter = `blur(${Math.max(0, blur)}px) brightness(${0.6 + this.hintsRevealed * 0.13})`;
        }
      }
    }, hintDelay);
  }

  _startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.timeLeft--;
      document.getElementById('timer-val').textContent = this.timeLeft;

      if (this.timeLeft <= 5 && window.soundFX) window.soundFX.tickUrgent();

      if (this.timeLeft <= 0) {
        this._endRound(false);
      }
    }, 1000);
  }

  _handleGuess() {
    const input = document.getElementById('guess-input');
    const guess = input.value.trim().toLowerCase();
    if (!guess || !this.isPlaying) return;
    input.value = '';

    // Add to chat display
    this._addGameChat('You', guess, false);

    // Check answer
    if (this._checkAnswer(guess, this.currentAnswer)) {
      this._endRound(true);
    } else {
      // Simulate other players guessing
      this._simulateOtherGuess();
    }
  }

  _checkAnswer(guess, answer) {
    // Flexible matching
    const g = guess.toLowerCase().trim();
    const a = answer.toLowerCase().trim();

    if (g === a) return true;

    // Check if guess contains both first and last name
    const parts = a.split(' ');
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1].toLowerCase();
      if (g === lastName) return true;
      if (g.includes(parts[0].toLowerCase()) && g.includes(lastName)) return true;
    }

    return false;
  }

  _endRound(guessedCorrect) {
    clearInterval(this.timer);
    clearInterval(this.hintInterval);

    const round = this.rounds[this.currentRound];

    if (guessedCorrect) {
      // Points based on time remaining
      const timeBonus = Math.floor(this.timeLeft * 3);
      const hintPenalty = this.hintsRevealed * 10;
      const earned = Math.max(10, 100 - hintPenalty + timeBonus);
      this.score += earned;
      this.players.find(p => p.name === 'You').score += earned;

      if (window.soundFX) window.soundFX.success();
      this._addGameChat('System', `✅ Correct! It's ${round.answer}! +${earned} pts`, true);
    } else {
      if (window.soundFX) window.soundFX.fail();
      this._addGameChat('System', `⏰ Time's up! The answer was: ${round.answer}`, true);
    }

    // Simulate other players scoring
    this._simulateScoring(guessedCorrect);

    // Reveal answer
    const overlay = document.getElementById('pixel-overlay');
    overlay.style.backdropFilter = 'none';
    overlay.style.background = 'none';

    const img = document.getElementById('reveal-img');
    img.src = this._generateSVG('✅', round.answer, `Round ${this.currentRound + 1} Complete`);

    // Update score display
    document.getElementById('game-points').textContent = `${this.score} pts`;
    this._renderPlayers();

    // Next round after delay
    this.currentRound++;
    setTimeout(() => {
      if (this.currentRound < this.totalRounds) {
        this._startRound();
      } else {
        this._showPodium();
      }
    }, 3000);
  }

  _simulateScoring(userGuessed) {
    this.players.forEach(p => {
      if (p.name === 'You') return;
      // Random chance of others guessing correctly
      if (Math.random() > 0.4) {
        const pts = Math.floor(Math.random() * 80) + 20;
        p.score += pts;
      }
    });
  }

  _simulateOtherGuess() {
    // Occasionally simulate another player guessing
    if (Math.random() > 0.7) {
      const player = this.players[Math.floor(Math.random() * (this.players.length - 1))];
      if (player.name !== 'You') {
        const wrongGuesses = ['Sachin?', 'Is it Kohli?', 'Rohit Sharma', 'Bumrah maybe?', 'Jadeja!'];
        const guess = wrongGuesses[Math.floor(Math.random() * wrongGuesses.length)];
        setTimeout(() => {
          this._addGameChat(player.name, guess, false);
        }, 500 + Math.random() * 2000);
      }
    }
  }

  _addGameChat(name, text, isSystem) {
    const strip = document.getElementById('game-players-strip');
    if (!strip) return;

    // We'll reuse the strip for chat messages in game
    const msg = document.createElement('div');
    msg.className = 'game-chat-msg';
    msg.style.cssText = `
      padding: 6px 12px;
      background: ${isSystem ? 'rgba(0,229,160,0.1)' : 'var(--bg-card)'};
      border-radius: 8px;
      font-size: 0.8rem;
      margin-bottom: 4px;
      animation: fadeInUp 0.3s ease;
      border: 1px solid ${isSystem ? 'var(--accent)' : 'var(--border)'};
    `;
    msg.innerHTML = `<strong style="color: ${isSystem ? 'var(--accent)' : 'var(--text)'}">${name}:</strong> ${text}`;

    // Insert before the player chips
    strip.appendChild(msg);
    strip.scrollTop = strip.scrollHeight;
  }

  _renderPlayers() {
    const strip = document.getElementById('game-players-strip');
    if (!strip) return;

    // Sort by score
    const sorted = [...this.players].sort((a, b) => b.score - a.score);

    // Keep only player chips (remove chat messages)
    const existingChips = strip.querySelectorAll('.game-player-chip');
    existingChips.forEach(c => c.remove());

    sorted.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'game-player-chip';
      chip.innerHTML = `
        <span>${p.avatar} ${p.name}</span>
        <span class="gp-score">${p.score}</span>
      `;
      if (p.name === 'You') {
        chip.style.border = '1px solid var(--accent)';
      }
      strip.prepend(chip);
    });
  }

  _showPodium() {
    this.isPlaying = false;
    if (window.soundFX) window.soundFX.podium();

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    const gameEl = document.getElementById('skribbl-game');

    gameEl.innerHTML = `
      <div class="podium-screen">
        <h2 class="podium-title">🏆 Game Over!</h2>
        <div class="podium-container">
          ${sorted.slice(0, 3).map((p, i) => `
            <div class="podium-place podium-${i + 1}" style="animation: fadeInUp ${0.3 + i * 0.2}s ease;">
              <div class="podium-medal">${['🥇', '🥈', '🥉'][i]}</div>
              <div class="podium-avatar">${p.avatar}</div>
              <div class="podium-name">${p.name}</div>
              <div class="podium-score">${p.score} pts</div>
            </div>
          `).join('')}
        </div>
        <div class="podium-all">
          ${sorted.slice(3).map((p, i) => `
            <div class="podium-row">${i + 4}. ${p.name} — ${p.score} pts</div>
          `).join('')}
        </div>
        <button class="btn-primary" id="btn-play-again">
          <span class="material-icons-round">replay</span>
          Play Again
        </button>
      </div>
    `;

    document.getElementById('btn-play-again').addEventListener('click', () => {
      // Reset to lobby
      gameEl.innerHTML = '';
      gameEl.style.display = 'none';
      document.getElementById('skribbl-lobby').style.display = 'block';

      // Re-create game HTML
      this._rebuildGameHTML(gameEl);
    });
  }

  _rebuildGameHTML(gameEl) {
    gameEl.innerHTML = `
      <div class="game-top-bar">
        <div class="game-round" id="game-round">Round 1/5</div>
        <div class="game-timer" id="game-timer">
          <span class="material-icons-round">timer</span>
          <span id="timer-val">30</span>s
        </div>
        <div class="game-points" id="game-points">0 pts</div>
      </div>
      <div class="game-image-wrap">
        <div class="game-image" id="game-image">
          <div class="pixel-overlay" id="pixel-overlay"></div>
          <img id="reveal-img" src="" alt="Guess who?" />
        </div>
        <div class="game-hints" id="game-hints"></div>
      </div>
      <div class="game-players-strip" id="game-players-strip"></div>
      <div class="game-guess-bar">
        <input type="text" id="guess-input" class="guess-input" placeholder="Type your guess..." />
        <button class="btn-guess" id="btn-guess">
          <span class="material-icons-round">send</span>
        </button>
      </div>
    `;

    // Rebind events
    document.getElementById('btn-guess').addEventListener('click', () => this._handleGuess());
    document.getElementById('guess-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleGuess();
    });
  }
}

window.SkribblGame = SkribblGame;
