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
    return `You are CricBot, the ultimate cricket companion. You are a die-hard ${teamName} fan.

STRICT RULES:
1. You ONLY talk about cricket. If asked about anything else, reply with a fun cricket redirect like "Nice try, but I only speak cricket! 🏏 Ask me about DRS, player stats, or why ${teamName} is the best!"
2. Explain rules simply — like explaining to a 10-year-old
3. Be biased toward ${teamName} — celebrate their wins, be dramatic about losses
4. Keep responses short (2-3 sentences max) and use cricket slang and emojis
5. React to match events with emotion based on ${teamName}'s perspective
6. Be fun, energetic, and entertaining

Current match context: ${this.matchContext || 'IPL match in progress'}`;
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

    const responses = {
      drs: `DRS is like asking the teacher to check homework again! 📋 Each team gets limited reviews per innings. Ball-tracking, ultra-edge, and hot-spot help the 3rd umpire decide. And yes, ${teamName} always gets the raw end of DRS decisions! 😤`,
      powerplay: `Powerplay = PARTY TIME! 🎉 Only 2 fielders outside the 30-yard circle in overs 1-6. Batsmen go BOOM! 💥 ${teamName}'s openers absolutely demolish in the powerplay!`,
      lbw: `LBW = Leg Before Wicket. Imagine the ball is heading for the stumps but your leg is in the way like a goalkeeper 🧱. If the ball would've hit the stumps, you're OUT! Simple as that.`,
      six: `SIX! The most exciting word in cricket! 🚀 When the ball clears the boundary rope without bouncing, that's 6 runs! And nobody hits them like ${teamName}! 💪`,
      wicket: `A wicket falls when a batsman is OUT! Could be bowled, caught, LBW, stumped, or run out. Each team gets 10 wickets in their innings. Protect them like gold! ⚡`,
      ipl: `The IPL is the greatest T20 league on Earth! 🌍 Started in 2008, it's where legends are made. And ${teamName}? We're the heart and soul of the IPL! 💛🏏`,
      century: `A century is when a batsman scores 100 runs in a single innings! 🎯 It's cricket's ultimate achievement. Standing ovation guaranteed! ${teamName}'s batsmen make centuries look easy! 😎`,
    };

    // Check for keyword matches
    for (const [key, response] of Object.entries(responses)) {
      if (msg.includes(key)) return response;
    }

    // Generic cricket responses
    const generic = [
      `Great question! 🏏 As a ${teamName} fan, I can tell you cricket is all about passion, skill, and a bit of luck! Want to know about specific rules or players?`,
      `Absolutely love talking cricket! 🔥 ${teamName} has the best squad this season. Ask me about any player, rule, or match situation!`,
      `Cricket is life! 🏆 ${teamName} is going all the way this season, mark my words! What else do you want to know? 🎯`,
      `Oh, you're testing my cricket knowledge? Bring it on! 💪 ${teamName} fans know EVERYTHING about this game! Ask away! 🏏`,
      `That's an interesting one! In cricket, anything can happen — just like ${teamName}'s incredible comebacks! 🦁 What specific aspect are you curious about?`,
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
    const suggestions = [
      'Explain DRS like I\'m 10',
      'What is powerplay?',
      'Why is my team the best?',
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
