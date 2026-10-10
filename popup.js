(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const variant = window.CLEANER_VARIANT || 'unfollow';
  let mode = variant === 'likes' ? 'likes' : 'unfollow';
  let tabId = null;
  let data = { items: [], selected: [], running: false, done: 0, skipped: 0 };
  const escapeHTML = input => String(input).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const notice = message => { if (message) $('notice').textContent = message; };

  function render() {
    $('modeNav').hidden = variant !== 'both';
    for (const b of document.querySelectorAll('[data-mode]')) {
      b.classList.toggle('active', b.dataset.mode === mode);
    }
    $('modeTitle').textContent = mode === 'likes' ? 'Liked posts & Reels' : 'Unfollow manager';
    $('guide').textContent = mode === 'likes'
      ? 'Go to Your activity → Likes. Press Instagram Select, scan loaded posts and choose items. Finish using Instagram Unlike.'
      : 'Open your profile → Following list. Scan loaded accounts, choose who to unfollow, then run a small batch.';
    $('start').textContent = mode === 'likes' ? 'Select in Instagram' : 'Unfollow selected';
    $('protectRow').hidden = mode !== 'unfollow';
    $('count').textContent = data.items.length + ' loaded · ' + data.selected.length + ' selected';
    $('items').innerHTML = data.items.length
      ? data.items.map(item => `<div class="item" role="listitem"><label><input type="checkbox" data-key="${escapeHTML(item.key)}" ${data.selected.includes(item.key) ? 'checked' : ''} ${item.protected ? 'disabled' : ''}><span class="name" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</span></label>${item.protected ? '<span class="protected">Protected</span>' : ''}<a target="_blank" rel="noopener noreferrer" href="${escapeHTML(item.url)}">View ↗</a></div>`).join('')
      : '<p class="empty">No items yet. Open the correct Instagram screen and scan.</p>';
    $('start').disabled = data.running || data.selected.length === 0;
    $('stop').disabled = !data.running;
    $('progress').textContent = data.running
      ? 'Running: ' + data.done + ' handled, ' + data.skipped + ' skipped'
      : (data.done || data.skipped ? 'Last run: ' + data.done + ' handled, ' + data.skipped + ' skipped' : '');
  }
  function send(type, extra = {}) {
    if (tabId == null) { notice('Open instagram.com and reopen the extension.'); return Promise.resolve(null); }
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, { type, mode, ...extra }, result => {
        if (chrome.runtime.lastError) {
          notice('Reload the Instagram page after installing or updating the extension.');
          return resolve(null);
        }
        if (result?.snapshot) { data = result.snapshot; render(); }
        notice(result?.error || result?.message);
        resolve(result);
      });
    });
  }
  function attach(id, action) {
    $(id).addEventListener('click', () => Promise.resolve().then(action).catch(e => notice(e.message)));
  }
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (tab?.url?.startsWith('https://www.instagram.com/')) {
      tabId = tab.id;
      void send('STATUS');
    } else notice('Go to www.instagram.com, sign in, then reopen this popup.');
  });
  attach('open', async () => {
    await chrome.tabs.create({ url: mode === 'likes'
      ? 'https://www.instagram.com/your_activity/interactions/likes/'
      : 'https://www.instagram.com/' });
    notice(mode === 'likes' ? 'Open Likes, click Select and use Scan.' : 'Open your profile, click Following, then Scan.');
  });
  attach('scan', () => send('SCAN'));
  attach('all', () => send('ALL'));
  attach('clear', () => send('CLEAR'));
  attach('protect', () => send('PROTECT'));
  attach('unprotect', () => send('UNPROTECT'));
  attach('start', async () => {
    const limit = Math.max(1, Math.min(25, Number($('max').value) || 10));
    const description = mode === 'likes'
      ? 'select up to ' + limit + ' liked posts in Instagram? You must press Unlike on Instagram yourself.'
      : 'unfollow up to ' + limit + ' selected accounts? This can be difficult to reverse.';
    if (!confirm('Review your selection. Continue to ' + description)) return;
    await send('START', { limit });
  });
  attach('stop', () => send('STOP'));
  $('items').addEventListener('change', e => {
    if (e.target.matches('input[data-key]')) {
      void send('TOGGLE', { key: e.target.dataset.key, checked: e.target.checked });
    }
  });
  $('modeNav').addEventListener('click', e => {
    const next = e.target.dataset.mode;
    if (!next || (variant !== 'both' && variant !== next)) return;
    mode = next;
    data = { items: [], selected: [], running: false, done: 0, skipped: 0 };
    render();
    void send('STATUS');
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message.kind === 'CLEANER_PROGRESS' && message.mode === mode) {
      data = message.snapshot;
      render();
      notice(message.message);
    }
  });
  render();
})();
