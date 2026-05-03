/* ========== CricPulse — Main App Controller ========== */

// ---- State ----
window.currentUser = { name: 'You', team: null };

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  createParticles();
  setupLogin();
  setupNavigation();
});

// ---- Particles (login screen) ----
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 4 + 's';
    p.style.animationDuration = (3 + Math.random() * 3) + 's';
    container.appendChild(p);
  }
}

// ===================== LOGIN =====================
function setupLogin() {
  const btnGoogle = document.getElementById('btn-google');
  const teamSelectWrap = document.getElementById('team-select-wrap');
  const teamGrid = document.getElementById('team-grid');

  // Initialize Firebase Auth — auto-login if session persists
  window.cricAuth.init((user) => {
    // User is already logged in (page refresh)
    window.currentUser = user;
    updateUserAvatar(user);

    // Check if team was previously selected
    const savedTeam = localStorage.getItem('cricpulse_team');
    if (savedTeam) {
      enterApp(savedTeam);
    } else {
      btnGoogle.style.display = 'none';
      teamSelectWrap.style.display = 'block';
      renderTeamGrid();
    }
  });

  btnGoogle.addEventListener('click', async () => {
    // Real Google Auth
    btnGoogle.innerHTML = '<span class="material-icons-round" style="animation: spin 1s linear infinite;">refresh</span> Signing in...';
    try {
      const user = await window.cricAuth.signInWithGoogle();
      window.currentUser = {
        uid: user.uid,
        name: user.displayName || 'Cricket Fan',
        email: user.email,
        photo: user.photoURL || null
      };
      updateUserAvatar(window.currentUser);
      btnGoogle.style.display = 'none';
      teamSelectWrap.style.display = 'block';
      renderTeamGrid();
    } catch (err) {
      console.error('Auth error:', err);
      btnGoogle.innerHTML = `
        <svg class="google-svg" viewBox="0 0 24 24" width="22" height="22">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>Sign in with Google</span>`;
      showCommentary('⚠️ Sign-in failed. Try again!');
    }
  });

  function renderTeamGrid() {
    const teams = Object.values(TEAM_THEMES);
    teamGrid.innerHTML = teams.map(t => `
      <div class="team-card" data-abbr="${t.abbr}">
        <div class="team-card-abbr" style="color: ${t.primary}">${t.abbr}</div>
        <div class="team-card-name">${t.name}</div>
      </div>
    `).join('');

    teamGrid.querySelectorAll('.team-card').forEach(card => {
      card.addEventListener('click', () => {
        teamGrid.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const teamAbbr = card.dataset.abbr;
        applyTeamTheme(teamAbbr);
        localStorage.setItem('cricpulse_team', teamAbbr);
        setTimeout(() => enterApp(teamAbbr), 500);
      });
    });
  }
}

function updateUserAvatar(user) {
  const avatarBtn = document.getElementById('user-avatar');
  if (!avatarBtn) return;
  if (user.photo) {
    avatarBtn.innerHTML = `<img src="${user.photo}" alt="${user.name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  } else {
    avatarBtn.innerHTML = `<span class="material-icons-round">person</span>`;
  }
  avatarBtn.title = user.name || 'User';
  
  setupUserMenu();
}

function setupUserMenu() {
  const profileWrap = document.querySelector('.user-profile-wrap');
  const avatarBtn = document.getElementById('user-avatar');
  const btnSignOut = document.getElementById('btn-sign-out');

  if (!profileWrap || !avatarBtn || !btnSignOut) return;

  // Toggle dropdown
  avatarBtn.onclick = (e) => {
    e.stopPropagation();
    profileWrap.classList.toggle('active');
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!profileWrap.contains(e.target)) {
      profileWrap.classList.remove('active');
    }
  });
}

// Global Sign Out function
window.doSignOut = async () => {
  console.log("Signing out globally...");
  try {
    if (window.cricAuth) {
      await window.cricAuth.signOut();
    }
    localStorage.removeItem('cricpulse_team');
    // Hard redirect back to login
    window.location.replace(window.location.pathname);
  } catch(err) {
    console.error("Sign out error", err);
  }
};

async function enterApp(teamAbbr) {
  window.currentUser.team = teamAbbr;

  // Apply theme
  const theme = applyTeamTheme(teamAbbr);

  // Switch screens
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  // Initialize all modules
  await initializeApp(teamAbbr);
}

async function initializeApp(teamAbbr) {
  // 1. Load match data & start engine
  await window.matchEngine.loadMatch('data/mock-match.json');

  // Update initial score display
  const score = window.matchEngine.getScore();
  updateScoreTicker(score);

  // Listen for score updates
  window.matchEngine.on('scoreUpdate', updateScoreTicker);
  window.matchEngine.on('ballResult', ({ ball }) => {
    showCommentary(ball.commentary);
  });

  // 2. Initialize Polls (global so live-match can replace polls)
  window.pollsDashboard = new PollsDashboard('polls-feed');
  await window.pollsDashboard.loadPolls('data/polls.json');

  // 3. Initialize Predictions
  const predictions = new PredictionEngine();
  predictions.init();

  // 4. Initialize Chatbot (global so live-match can feed context)
  window.chatbotInstance = new CricketChatbot();
  window.chatbotInstance.setTeam(teamAbbr);
  window.chatbotInstance.init();

  // Check for Gemini API key in URL params (for easy testing)
  const params = new URLSearchParams(window.location.search);
  const apiKey = params.get('gemini_key');
  if (apiKey) window.chatbotInstance.setApiKey(apiKey);

  // 5. Initialize Skribbl
  const skribbl = new SkribblGame();
  await skribbl.loadData('data/skribbl-data.json');
  skribbl.init();

  // 6. Check for live match mode
  const cricApiKey = params.get('cric_key') || 'b444b3ea-28fb-4cdb-9dea-eca49df8f3e1';
  if (cricApiKey) {
    // Live mode — use real match data
    window.liveMatchUI = new LiveMatchUI();
    window.liveMatchUI.init(cricApiKey);
    showCommentary('🔴 Live match mode! Select a match to track.');
  } else {
    // Mock mode — start simulation
    setTimeout(() => {
      window.matchEngine.setSpeed(20000); // 20 seconds per ball
      window.matchEngine.start();
    }, 3000);
  }

  // 7. Setup admin panel shortcut
  setupAdminShortcut();
}

// ===================== SCORE TICKER =====================
function updateScoreTicker(score) {
  const matchInfo = window.matchEngine.getMatchInfo();
  if (matchInfo) {
    document.getElementById('ticker-team1').textContent = matchInfo.team1.abbr;
    document.getElementById('ticker-team2').textContent = matchInfo.team2.abbr;
    document.getElementById('ticker-score1').textContent = '186/4'; // CSK's completed innings
  }
  document.getElementById('ticker-score2').textContent = `${score.runs}/${score.wickets}`;
  document.getElementById('ticker-overs').textContent = `${score.overs} ov`;
}

// ===================== COMMENTARY TOAST =====================
function showCommentary(text) {
  // Create toast
  const existing = document.querySelector('.commentary-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'commentary-toast';
  toast.textContent = text;
  document.body.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// ===================== NAVIGATION =====================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });
}

// ===================== ADMIN SHORTCUT =====================
function setupAdminShortcut() {
  // Press Ctrl+Shift+A to toggle admin panel
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      toggleAdminPanel();
    }
  });
}

function toggleAdminPanel() {
  let panel = document.getElementById('admin-panel');
  if (panel) {
    panel.remove();
    return;
  }

  panel = document.createElement('div');
  panel.id = 'admin-panel';
  panel.className = 'admin-panel';
  panel.innerHTML = `
    <div class="admin-header">
      <h3>🔧 Admin Panel</h3>
      <button class="admin-close" onclick="document.getElementById('admin-panel').remove()">✕</button>
    </div>
    <div class="admin-controls">
      <button class="admin-btn" onclick="window.matchEngine.nextBall()">⏭️ Next Ball</button>
      <button class="admin-btn" onclick="window.matchEngine.pause()">⏸️ Pause</button>
      <button class="admin-btn" onclick="window.matchEngine.resume()">▶️ Resume</button>
      <button class="admin-btn" onclick="window.matchEngine.reset()">🔄 Reset</button>
      <hr style="border-color: var(--border);">
      <label style="color: var(--text-dim); font-size: 0.8rem;">Speed:</label>
      <button class="admin-btn" onclick="window.matchEngine.setSpeed(5000)">⚡ 5s</button>
      <button class="admin-btn" onclick="window.matchEngine.setSpeed(10000)">🏃 10s</button>
      <button class="admin-btn" onclick="window.matchEngine.setSpeed(20000)">🚶 20s</button>
      <hr style="border-color: var(--border);">
      <label style="color: var(--text-dim); font-size: 0.8rem;">Force Result:</label>
      <button class="admin-btn" onclick="window.matchEngine.forceResult('6')">6️⃣ Six</button>
      <button class="admin-btn" onclick="window.matchEngine.forceResult('4')">4️⃣ Four</button>
      <button class="admin-btn" onclick="window.matchEngine.forceResult('wicket')">🔴 Wicket</button>
      <hr style="border-color: var(--border);">
      <label style="color: var(--text-dim); font-size: 0.8rem;">Sound:</label>
      <button class="admin-btn" onclick="alert('Sound: ' + (window.soundFX.toggle() ? 'ON' : 'OFF'))">🔊 Toggle</button>
      <hr style="border-color: var(--border);">
      <label style="color: var(--text-dim); font-size: 0.8rem;">Live Match:</label>
      <button class="admin-btn" id="admin-live-toggle" onclick="promptLiveMatch()">🔴 Connect Live</button>
      <button class="admin-btn" onclick="if(window.liveMatchUI){window.liveMatchUI.stopTracking();showCommentary('Switched to mock mode.')}">📴 Use Mock</button>
    </div>
  `;
  document.body.appendChild(panel);
}

// ===================== LIVE MATCH =====================
function promptLiveMatch() {
  const key = prompt(
    '🔴 Enter your CricAPI key to connect to live matches:\n\n' +
    'Get a FREE key at: https://cricketdata.org/member.aspx\n\n' +
    '(100 requests/day on free tier)'
  );
  if (!key || !key.trim()) return;

  // Initialize live match
  window.liveMatchUI = new LiveMatchUI();
  window.liveMatchUI.init(key.trim());

  // Pause mock engine
  window.matchEngine.pause();
  showCommentary('🔴 Connecting to live match data...');
}
