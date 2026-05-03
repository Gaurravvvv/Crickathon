/* ========== CricPulse — Team Themes ========== */
/* Dynamically applied when user picks a team */

const TEAM_THEMES = {
  CSK: {
    abbr: 'CSK',
    name: 'Chennai Super Kings',
    primary: '#ffd700',
    secondary: '#1a1a2e',
    accent: '#ffd700',
    accentGlow: 'rgba(255, 215, 0, 0.25)',
    gradient: 'linear-gradient(135deg, #ffd700, #f0c040)',
    emoji: '🦁',
    tagline: 'Whistle Podu! 💛'
  },
  MI: {
    abbr: 'MI',
    name: 'Mumbai Indians',
    primary: '#004ba0',
    secondary: '#0a1628',
    accent: '#00aaff',
    accentGlow: 'rgba(0, 170, 255, 0.25)',
    gradient: 'linear-gradient(135deg, #004ba0, #0077cc)',
    emoji: '🔵',
    tagline: 'Duniya Hila Denge! 💙'
  },
  RCB: {
    abbr: 'RCB',
    name: 'Royal Challengers Bengaluru',
    primary: '#d4213d',
    secondary: '#1a0a0e',
    accent: '#ff4060',
    accentGlow: 'rgba(255, 64, 96, 0.25)',
    gradient: 'linear-gradient(135deg, #d4213d, #ff6b6b)',
    emoji: '❤️',
    tagline: 'Ee Sala Cup Namde! 🏆'
  },
  KKR: {
    abbr: 'KKR',
    name: 'Kolkata Knight Riders',
    primary: '#3a225d',
    secondary: '#120a1e',
    accent: '#c9a0ff',
    accentGlow: 'rgba(201, 160, 255, 0.25)',
    gradient: 'linear-gradient(135deg, #3a225d, #7b61ff)',
    emoji: '💜',
    tagline: 'Korbo Lorbo Jeetbo! 💜'
  },
  DC: {
    abbr: 'DC',
    name: 'Delhi Capitals',
    primary: '#004c93',
    secondary: '#0a1428',
    accent: '#4da6ff',
    accentGlow: 'rgba(77, 166, 255, 0.25)',
    gradient: 'linear-gradient(135deg, #004c93, #2196f3)',
    emoji: '🔷',
    tagline: 'Roar Macha! 🦁'
  },
  RR: {
    abbr: 'RR',
    name: 'Rajasthan Royals',
    primary: '#ea1a85',
    secondary: '#1a0a14',
    accent: '#ff69b4',
    accentGlow: 'rgba(255, 105, 180, 0.25)',
    gradient: 'linear-gradient(135deg, #ea1a85, #ff69b4)',
    emoji: '💖',
    tagline: 'Halla Bol! 💗'
  },
  SRH: {
    abbr: 'SRH',
    name: 'Sunrisers Hyderabad',
    primary: '#ff822a',
    secondary: '#1a100a',
    accent: '#ffa64d',
    accentGlow: 'rgba(255, 166, 77, 0.25)',
    gradient: 'linear-gradient(135deg, #ff822a, #ffb347)',
    emoji: '🧡',
    tagline: 'Orange Army! 🔶'
  },
  PBKS: {
    abbr: 'PBKS',
    name: 'Punjab Kings',
    primary: '#d71920',
    secondary: '#1a0a0a',
    accent: '#ff4444',
    accentGlow: 'rgba(255, 68, 68, 0.25)',
    gradient: 'linear-gradient(135deg, #d71920, #ff5555)',
    emoji: '🔴',
    tagline: 'Sadda Punjab! ❤️'
  },
  LSG: {
    abbr: 'LSG',
    name: 'Lucknow Super Giants',
    primary: '#a4d65e',
    secondary: '#0e1a0a',
    accent: '#a4d65e',
    accentGlow: 'rgba(164, 214, 94, 0.25)',
    gradient: 'linear-gradient(135deg, #5b9a1a, #a4d65e)',
    emoji: '💚',
    tagline: 'Super Giants! 💚'
  },
  GT: {
    abbr: 'GT',
    name: 'Gujarat Titans',
    primary: '#1b2133',
    secondary: '#0a0e18',
    accent: '#5dadec',
    accentGlow: 'rgba(93, 173, 236, 0.25)',
    gradient: 'linear-gradient(135deg, #1b2133, #3b5998)',
    emoji: '🛡️',
    tagline: 'Aava De! 💎'
  }
};

/**
 * Apply a team's theme colors to the CSS custom properties
 */
function applyTeamTheme(teamAbbr) {
  const theme = TEAM_THEMES[teamAbbr];
  if (!theme) return;

  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-glow', theme.accentGlow);
  root.style.setProperty('--bg-surface', theme.secondary);

  // Update gradient elements
  const logo = document.querySelector('.login-logo');
  if (logo) logo.style.background = theme.gradient;

  const avatar = document.querySelector('.user-avatar');
  if (avatar) avatar.style.background = theme.gradient;

  return theme;
}
