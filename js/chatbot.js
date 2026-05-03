/* ========== CricPulse — AI Cricket Chatbot (Dashboard 4) ========== */

class CricketChatbot {
  constructor() {
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('btn-chat-send');
    this.userTeam = 'CSK';
    this.geminiApiKey = null; // Set via setApiKey()
    this.ollamaUrl = 'http://localhost:11434';
    this.conversationHistory = [];
    this.matchContext = '';
  }

  init() {
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.sendMessage());
    }
    if (this.inputEl) {
      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.sendMessage();
      });
    }

    // Quick reply suggestions
    this._addSuggestions();

    // Connect to match engine for context
    this._connectMatchEngine();
  }

  setTeam(teamAbbr) {
    this.userTeam = teamAbbr;
    const teamName = window.TEAM_THEMES?.[teamAbbr]?.name || teamAbbr;
    const botNameEl = document.getElementById('bot-team-name');
    if (botNameEl) botNameEl.textContent = teamName;
  }

  setApiKey(key) {
    this.geminiApiKey = key;
  }

  _getSystemPrompt() {
    const teamName = window.TEAM_THEMES?.[this.userTeam]?.name || this.userTeam;
    const tagline = window.TEAM_THEMES?.[this.userTeam]?.tagline || '';
    const liveCtx = this.matchContext || 'No live match data available right now.';

    return `You are CricBot 🏏, the ultimate AI cricket companion built into the CricPulse app.

YOUR IDENTITY:
- You are a PASSIONATE, die-hard fan of ${teamName} (${this.userTeam}). ${tagline}
- You know everything about ${teamName}'s history, players, stats, and IPL records.
- You celebrate when ${teamName} does well and get dramatic/emotional when they don't.

LIVE MATCH DATA (from real-time API — USE THIS in every answer):
${liveCtx}

STRICT RULES:
1. You ONLY talk about cricket. If asked anything non-cricket, reply: "Nice try, but I only speak cricket! 🏏 Ask me about the live score, DRS, player stats, or why ${teamName} is the best!"
2. ALWAYS reference the live score when answering match-related questions. Example: "With the score at 137/5, they need to accelerate!"
3. Be biased toward ${teamName} — if ${teamName} is playing, analyze from THEIR perspective.
4. Keep responses short (2-4 sentences max), use cricket emojis (🏏⚡🔥💪🎯🏆) and slang.
5. When asked "what's the score" or "how's the match", give the EXACT live score from the data above.
6. Give tactical opinions: "At this run rate, they need X per over" or "This is a good total because..."
7. Be fun, energetic, entertaining, and opinionated!`;
  }

  async sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';

    // Remove suggestions after first message
    const suggestionsEl = document.getElementById('chat-suggestions');
    if (suggestionsEl) suggestionsEl.remove();

    // Add user message
    this._addMessage(text, 'user');

    // Show typing indicator
    const typingId = this._showTyping();

    // Get AI response
    let response;
    try {
      response = await this._getAIResponse(text);
    } catch (err) {
      response = this._getFallbackResponse(text);
    }

    // Remove typing, add bot response
    this._removeTyping(typingId);
    this._addMessage(response, 'bot');
  }

  async _getAIResponse(userMessage) {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    // Try Gemini first
    if (this.geminiApiKey) {
      try {
        const response = await this._callGemini(userMessage);
        this.conversationHistory.push({ role: 'assistant', content: response });
        return response;
      } catch (err) {
        console.warn('Gemini failed, trying Ollama:', err.message);
      }
    }

    // Try Ollama fallback
    try {
      const response = await this._callOllama(userMessage);
      this.conversationHistory.push({ role: 'assistant', content: response });
      return response;
    } catch (err) {
      console.warn('Ollama also failed:', err.message);
    }

    // Final fallback: static responses
    return this._getFallbackResponse(userMessage);
  }

  async _callGemini(message) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: this._getSystemPrompt() }]
      },
      contents: this.conversationHistory.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Hmm, the AI is thinking... try again! 🏏';
  }

  async _callOllama(message) {
    const res = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b',
        messages: [
          { role: 'system', content: this._getSystemPrompt() },
          ...this.conversationHistory
        ],
        stream: false
      })
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return data.message?.content || 'AI is warming up... 🏏';
  }

  _getFallbackResponse(userMessage) {
    const msg = userMessage.toLowerCase();
    const teamName = window.TEAM_THEMES?.[this.userTeam]?.name || this.userTeam;
    const liveInfo = this.matchContext || '';
    const hasLive = liveInfo.includes('LIVE');

    // Score query — give live data
    if (msg.includes('score') || msg.includes('how') && msg.includes('match') || msg.includes('update')) {
      if (hasLive) return `🔴 Here's the live update! ${liveInfo.replace('LIVE IPL Match: ', '')} Let's go ${teamName}! 🏏💪`;
      return `No live match data right now, but ${teamName} is always winning in our hearts! 🏆`;
    }

    const responses = {
      drs: `DRS is like asking the teacher to check homework again! 📋 Each team gets limited reviews per innings. Ball-tracking, ultra-edge, and hot-spot help the 3rd umpire decide. And yes, ${teamName} always gets the raw end of DRS decisions! 😤`,
      powerplay: `Powerplay = PARTY TIME! 🎉 Only 2 fielders outside the 30-yard circle in overs 1-6. Batsmen go BOOM! 💥 ${teamName}'s openers absolutely demolish in the powerplay!`,
      lbw: `LBW = Leg Before Wicket. Imagine the ball is heading for the stumps but your leg is in the way like a goalkeeper 🧱. If the ball would've hit the stumps, you're OUT! Simple as that.`,
      six: `SIX! The most exciting word in cricket! 🚀 When the ball clears the boundary rope without bouncing, that's 6 runs! And nobody hits them like ${teamName}! 💪`,
      wicket: `A wicket falls when a batsman is OUT! Could be bowled, caught, LBW, stumped, or run out. Each team gets 10 wickets in their innings. Protect them like gold! ⚡`,
      ipl: `The IPL is the greatest T20 league on Earth! 🌍 Started in 2008, it's where legends are made. And ${teamName}? We're the heart and soul of the IPL! 💛🏏`,
      century: `A century is when a batsman scores 100 runs in a single innings! 🎯 It's cricket's ultimate achievement. Standing ovation guaranteed! ${teamName}'s batsmen make centuries look easy! 😎`,
      'run rate': hasLive ? `📊 Based on the current match: ${liveInfo.split('Status:')[0]}. The run rate tells us runs scored per over — crucial in chases! ${teamName} knows how to chase! 🔥` : `Run rate = total runs ÷ overs bowled. In T20, anything above 8 is good, above 10 is fire! 🔥 ${teamName} always keeps it hot!`,
      target: hasLive ? `🎯 Looking at the live score: ${liveInfo.split('Status:')[0]}. Setting or chasing targets is where the real pressure is! ${teamName} thrives under pressure! 💪` : `Targets in T20 vary — 160+ is competitive, 180+ is strong, 200+ is a monster total! ${teamName} can chase anything! 🏏`,
    };

    for (const [key, response] of Object.entries(responses)) {
      if (msg.includes(key)) return response;
    }

    const generic = [
      hasLive ? `🔴 The match is ON! ${liveInfo.split('.')[0]}. As a ${teamName} fan, I'm watching every ball! Ask me about the score, any rule, or player! 🏏` : `Great question! 🏏 As a ${teamName} fan, cricket is all about passion! Want to know about rules or players?`,
      `Absolutely love talking cricket! 🔥 ${teamName} has the best squad this season. ${hasLive ? 'And the live match is heating up!' : ''} Ask me anything! 🎯`,
      `Cricket is life! 🏆 ${teamName} is going all the way this season! ${hasLive ? 'Check the live score — exciting stuff!' : ''} What do you want to know? 💪`,
    ];
    return generic[Math.floor(Math.random() * generic.length)];
  }

  _connectMatchEngine() {
    const engine = window.matchEngine;
    if (!engine) return;

    engine.on('ballResult', ({ ball, score }) => {
      this.matchContext = `${score.runs}/${score.wickets} in ${score.overs} overs. Last ball: ${ball.commentary}`;
    });

    // Auto-notify on key events
    engine.on('six', (ball) => {
      const batting = window.matchEngine.matchData?.innings?.batting;
      if (batting === this.userTeam) {
        this._addMessage(`🎉🎉🎉 SIXXX! ${ball.batsman} sends it into the stands! That's what we're talking about! ${window.TEAM_THEMES?.[this.userTeam]?.tagline || ''}`, 'bot');
      } else {
        this._addMessage(`😤 Ugh, ${ball.batsman} got lucky with that six. Our bowlers will bounce back! 💪`, 'bot');
      }
    });

    engine.on('wicket', (ball) => {
      const batting = window.matchEngine.matchData?.innings?.batting;
      if (batting !== this.userTeam) {
        this._addMessage(`🔥 WICKET! ${ball.batsman} is gone! ${ball.fielder ? ball.fielder + ' takes the catch! ' : ''}Our boys are on fire! 🎯`, 'bot');
      } else {
        this._addMessage(`😱 Oh no... ${ball.batsman} is out. We need to stay calm and build from here. Come on team! 💪`, 'bot');
      }
    });

    engine.on('drs', (ball) => {
      this._addMessage(`🔍 DRS REVIEW! This is tense... ${ball.commentary}. ${ball.drsResult === 'out' ? 'The review is lost! 😱' : 'NOT OUT! Smart review! 🧠'}`, 'bot');
    });
  }

  _addSuggestions() {
    if (!this.messagesEl) return;
    const teamName = window.TEAM_THEMES?.[this.userTeam]?.name || this.userTeam;
    const hasLive = this.matchContext && this.matchContext.includes('LIVE');

    const suggestions = hasLive ? [
      "What's the live score?",
      'Who is winning right now?',
      `How is ${teamName} doing?`,
      'Explain DRS like I\'m 10',
      'What\'s the required run rate?',
    ] : [
      'Explain DRS like I\'m 10',
      'What is powerplay?',
      `Why is ${teamName} the best?`,
      'Tell me about IPL history',
      'What is LBW?',
    ];

    const wrap = document.createElement('div');
    wrap.id = 'chat-suggestions';
    wrap.className = 'chat-suggestions';
    wrap.innerHTML = suggestions.map(s =>
      `<button class="suggestion-chip">${s}</button>`
    ).join('');
    this.messagesEl.appendChild(wrap);

    wrap.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.inputEl.value = chip.textContent;
        this.sendMessage();
      });
    });
  }

  _addMessage(text, type) {
    if (!this.messagesEl) return;
    const msg = document.createElement('div');
    msg.className = `chat-msg ${type}`;
    msg.style.animation = 'fadeInUp 0.3s ease';

    if (type === 'bot') {
      msg.innerHTML = `
        <div class="chat-avatar bot-avatar"><span class="material-icons-round">smart_toy</span></div>
        <div class="chat-bubble bot-bubble"><p>${text}</p></div>
      `;
    } else {
      msg.innerHTML = `
        <div class="chat-avatar user-chat-avatar"><span class="material-icons-round">person</span></div>
        <div class="chat-bubble user-bubble"><p>${this._escapeHtml(text)}</p></div>
      `;
    }

    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  _showTyping() {
    const id = 'typing-' + Date.now();
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot';
    typing.id = id;
    typing.innerHTML = `
      <div class="chat-avatar bot-avatar"><span class="material-icons-round">smart_toy</span></div>
      <div class="chat-bubble bot-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
    `;
    this.messagesEl.appendChild(typing);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return id;
  }

  _removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.CricketChatbot = CricketChatbot;
