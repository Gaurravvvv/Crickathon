/* ========== CricPulse — Polls Dashboard ========== */

class PollsDashboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.polls = [];
    this.votedPolls = new Set(); // track which polls user voted on
  }

  async loadPolls(url) {
    try {
      const res = await fetch(url);
      this.polls = await res.json();
      this.render();
    } catch (err) {
      console.error('Failed to load polls:', err);
      // fallback to inline data
      this.render();
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = this.polls.map(poll => this._renderPoll(poll)).join('');
    this._bindEvents();
  }

  _renderPoll(poll) {
    const totalVotes = poll.votes.reduce((a, b) => a + b, 0);
    const hasVoted = this.votedPolls.has(poll.id);

    return `
      <div class="poll-card" id="poll-${poll.id}" data-poll-id="${poll.id}">
        <span class="poll-tag ${poll.tag}">${poll.tag === 'match' ? '🏏 Match' : '🎉 Fun'}</span>
        <div class="poll-question">${poll.question}</div>
        <div class="poll-options">
          ${poll.options.map((opt, i) => {
            const pct = totalVotes > 0 ? Math.round((poll.votes[i] / totalVotes) * 100) : 0;
            return `
              <div class="poll-option ${hasVoted ? 'voted-state' : ''}" data-poll="${poll.id}" data-idx="${i}">
                <div class="poll-bar" style="width: ${hasVoted ? pct : 0}%"></div>
                <div class="poll-option-text">
                  <span>${opt}</span>
                  <span class="poll-pct">${hasVoted ? pct + '%' : ''}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="poll-meta">
          <span class="poll-vote-count">${totalVotes.toLocaleString()} votes</span>
          <button class="poll-comment-toggle" data-poll="${poll.id}">
            💬 ${poll.comments.length} comment${poll.comments.length !== 1 ? 's' : ''}
          </button>
        </div>
        <div class="poll-comments" id="poll-comments-${poll.id}" style="display: none;">
          ${poll.comments.map(c => `
            <div class="poll-comment">
              <div class="poll-comment-avatar">${c.name[0].toUpperCase()}</div>
              <div class="poll-comment-text">
                <span class="poll-comment-name">${c.name}</span> ${c.text}
              </div>
            </div>
          `).join('')}
          <div class="poll-comment-input-wrap">
            <input type="text" class="poll-comment-input" data-poll="${poll.id}" placeholder="Add a comment..." />
            <button class="poll-comment-send" data-poll="${poll.id}">
              <span class="material-icons-round">send</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Vote clicks
    this.container.querySelectorAll('.poll-option').forEach(opt => {
      opt.addEventListener('click', () => this._handleVote(opt));
    });

    // Comment toggle
    this.container.querySelectorAll('.poll-comment-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const pollId = btn.dataset.poll;
        const comments = document.getElementById(`poll-comments-${pollId}`);
        comments.style.display = comments.style.display === 'none' ? 'block' : 'none';
      });
    });

    // Comment send
    this.container.querySelectorAll('.poll-comment-send').forEach(btn => {
      btn.addEventListener('click', () => this._handleComment(btn.dataset.poll));
    });

    this.container.querySelectorAll('.poll-comment-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._handleComment(input.dataset.poll);
      });
    });
  }

  _handleVote(optEl) {
    const pollId = parseInt(optEl.dataset.poll);
    const idx = parseInt(optEl.dataset.idx);

    if (this.votedPolls.has(pollId)) return; // already voted
    this.votedPolls.add(pollId);

    const poll = this.polls.find(p => p.id === pollId);
    poll.votes[idx]++;
    const totalVotes = poll.votes.reduce((a, b) => a + b, 0);

    const card = document.getElementById(`poll-${pollId}`);
    card.querySelectorAll('.poll-option').forEach((o, i) => {
      const pct = Math.round((poll.votes[i] / totalVotes) * 100);
      o.classList.add('voted-state');
      if (i === idx) o.classList.add('voted');

      // Animate bar
      const bar = o.querySelector('.poll-bar');
      const pctEl = o.querySelector('.poll-pct');
      setTimeout(() => {
        bar.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }, 50);
    });

    card.querySelector('.poll-vote-count').textContent = totalVotes.toLocaleString() + ' votes';

    // Play sound
    if (window.soundFX) window.soundFX.notify();
  }

  _handleComment(pollId) {
    pollId = parseInt(pollId);
    const input = this.container.querySelector(`.poll-comment-input[data-poll="${pollId}"]`);
    const text = input.value.trim();
    if (!text) return;

    const poll = this.polls.find(p => p.id === pollId);
    const userName = window.currentUser?.name || 'You';
    poll.comments.push({ name: userName, text });

    const commentsEl = document.getElementById(`poll-comments-${pollId}`);
    const inputWrap = commentsEl.querySelector('.poll-comment-input-wrap');

    const commentEl = document.createElement('div');
    commentEl.className = 'poll-comment';
    commentEl.style.animation = 'fadeInUp 0.3s ease';
    commentEl.innerHTML = `
      <div class="poll-comment-avatar">${userName[0].toUpperCase()}</div>
      <div class="poll-comment-text">
        <span class="poll-comment-name">${userName}</span> ${this._escapeHtml(text)}
      </div>
    `;
    commentsEl.insertBefore(commentEl, inputWrap);

    input.value = '';

    // Update count
    const card = document.getElementById(`poll-${pollId}`);
    const toggle = card.querySelector('.poll-comment-toggle');
    toggle.textContent = `💬 ${poll.comments.length} comment${poll.comments.length !== 1 ? 's' : ''}`;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.PollsDashboard = PollsDashboard;
