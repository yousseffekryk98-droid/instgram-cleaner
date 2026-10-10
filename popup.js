(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const variant = window.CLEANER_VARIANT || 'unfollow';
  let mode = variant === 'likes' ? 'likes' : 'unfollow';
  let tabId = null;
  let autoStatus = { state: 'idle', verified: 0, batches: 0, message: 'No automatic run yet.' };
  let data = { items: [], selected: [], running: false, done: 0, skipped: 0, instagramSelected: null };
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
      ? 'Open Your activity → Likes. The scanner finds video/photo tiles even without post links. Select items in Instagram or choose them below, then confirm Unlike.'
      : 'Open your profile → Following list. Scan loaded accounts, choose who to unfollow, then run a small batch.';
    $('start').textContent = mode === 'likes' ? 'Select in Instagram' : 'Unfollow selected';
    $('protectRow').hidden = mode !== 'unfollow';
    $('likesFinish').hidden = mode !== 'likes';
    $('autoLikes').hidden = mode !== 'likes';
    const autoRunning = autoStatus.state === 'running';
    $('autoStart').disabled = autoRunning || !$('autoConsent').checked;
    $('autoStop').disabled = !autoRunning;
    $('autoStart').textContent = ['paused', 'interrupted'].includes(autoStatus.state)
      ? 'Resume automatic cleanup' : 'Start automatic cleanup';
    $('autoProgress').textContent =
      'Status: ' + (autoStatus.state || 'idle') +
      ' · Observed: ' + (autoStatus.verified || 0) +
      ' · Batches: ' + (autoStatus.batches || 0) +
      '\n' + (autoStatus.message || '');
    $('count').textContent = data.items.length + ' loaded · ' + data.selected.length + ' selected in extension' +
      (mode === 'likes' && data.instagramSelected !== null ? ' · ' + data.instagramSelected + ' selected on Instagram' : '');
    $('items').innerHTML = data.items.length
      ? data.items.map(item => `<div class="item" role="listitem"><label><input type="checkbox" data-key="${escapeHTML(item.key)}" ${data.selected.includes(item.key) ? 'checked' : ''} ${item.protected ? 'disabled' : ''}><span class="name" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</span></label>${item.protected ? '<span class="protected">Protected</span>' : ''}${item.url ? `<a target="_blank" rel="noopener noreferrer" href="${escapeHTML(item.url)}">View ↗</a>` : ''}</div>`).join('')
      : '<p class="empty">No items yet. Open the correct Instagram screen and scan.</p>';
    $('start').disabled = data.running || data.selected.length === 0;
    $('finishLikes').disabled = data.running;
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
      ? 'select up to ' + limit + ' currently loaded liked tiles in Instagram? Review the selected items before using Unlike.'
      : 'unfollow up to ' + limit + ' selected accounts? This can be difficult to reverse.';
    if (!confirm('Review your selection. Continue to ' + description)) return;
    await send('START', { limit });
  });
  attach('stop', () => send('STOP'));
  attach('autoStart', async () => {
    if (mode !== 'likes') return;
    if (!$('autoConsent').checked) {
      notice('First confirm that automatic unlikes can change your account.');
      return;
    }
    const batchSize = Math.max(1, Math.min(20, Number($('autoBatch').value) || 10));
    const target = Math.max(1, Math.min(10000, Number($('autoTarget').value) || 5000));
    const waitSeconds = Math.max(10, Math.min(120, Number($('autoWait').value) || 15));
    const resume = ['paused','interrupted'].includes(autoStatus.state);
    if (!confirm('Automatically unlike up to ' + target +
      ' posts using Instagram’s visible page controls in groups of ' + batchSize +
      '? This is difficult to reverse. The process stops on restrictions or unverified results.')) return;
    const result = await send('LIKES_AUTO_START', {
      options: { batchSize, target, waitSeconds, resume }
    });
    if (result?.state) { autoStatus = result.state; render(); }
  });
  attach('autoStop', async () => {
    const response = await send('LIKES_AUTO_STOP');
    if (response?.state) { autoStatus = response.state; render(); }
  });
  $('autoConsent').addEventListener('change', render);
  attach('finishLikes', async () => {
    if (!confirm('Press Instagram’s Unlike control for the posts currently selected on Instagram? Review your selections first. Instagram may require a second confirmation.')) return;
    await send('UNLIKE');
  });
  $('items').addEventListener('change', e => {
    if (e.target.matches('input[data-key]')) {
      void send('TOGGLE', { key: e.target.dataset.key, checked: e.target.checked });
    }
  });
  $('modeNav').addEventListener('click', e => {
    const next = e.target.dataset.mode;
    if (!next || (variant !== 'both' && variant !== next)) return;
    mode = next;
    data = { items: [], selected: [], running: false, done: 0, skipped: 0, instagramSelected: null };
    render();
    void send('STATUS');
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message.kind === 'LIKES_AUTO_PROGRESS' && message.state) {
      autoStatus = message.state;
      render();
    }
    if (message.kind === 'CLEANER_PROGRESS' && message.mode === mode) {
      data = message.snapshot;
      render();
      notice(message.message);
    }
  });
  chrome.storage.local.get('instagramLikesAutopilotStatus', data => {
    if (data?.instagramLikesAutopilotStatus) {
      autoStatus = data.instagramLikesAutopilotStatus;
      render();
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.instagramLikesAutopilotStatus?.newValue) {
      autoStatus = changes.instagramLikesAutopilotStatus.newValue;
      render();
    }
  });
  render();
})();
