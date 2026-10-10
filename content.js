(() => {
  'use strict';
  if (window.__instagramCleaner) return;
  window.__instagramCleaner = true;

  const state = {
    unfollow: { items: new Map(), selected: new Set(), running: false, stop: false, done: 0, skipped: 0 },
    likes: { items: new Map(), selected: new Set(), running: false, stop: false, done: 0, skipped: 0 }
  };
  const FOLLOWING = ['following', 'requested', 'تتابعه'];
  const UNFOLLOW = ['unfollow', 'إلغاء المتابعة'];
  const RESERVED = new Set(['accounts','explore','reels','reel','p','direct','stories','about','settings','your_activity','privacy']);
  let protectedAccounts = new Set();

  chrome.storage.local.get({ protectedAccounts: [] }, v => {
    protectedAccounts = new Set(v.protectedAccounts);
  });
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const label = node => clean(node?.innerText || node?.textContent).toLowerCase();
  const buttons = root => [...root.querySelectorAll('button,[role="button"]')];
  const matches = (el, words) => words.includes(label(el));
  const handleFrom = href => {
    try {
      const u = new URL(href, location.origin);
      if (u.origin !== location.origin) return null;
      const parts = u.pathname.split('/').filter(Boolean);
      return parts.length === 1 && /^[a-z0-9._]{1,30}$/i.test(parts[0]) && !RESERVED.has(parts[0])
        ? parts[0].toLowerCase() : null;
    } catch { return null; }
  };
  const followingDialog = () => [...document.querySelectorAll('[role="dialog"]')]
    .find(d => buttons(d).some(b => matches(b, FOLLOWING)));

  function findRow(button, dialog) {
    let node = button;
    for (let i = 0; i < 8 && node && node !== dialog; i++, node = node.parentElement) {
      const a = [...node.querySelectorAll('a[href]')].find(x => handleFrom(x.getAttribute('href')));
      if (a && buttons(node).length <= 6) return { key: handleFrom(a.getAttribute('href')), button, row: node };
    }
    return null;
  }
  function scanFollowing() {
    const dialog = followingDialog();
    if (!dialog) return 'Open your Instagram profile and click Following before scanning.';
    let count = 0;
    for (const button of buttons(dialog)) {
      if (!matches(button, FOLLOWING)) continue;
      const found = findRow(button, dialog);
      if (!found) continue;
      state.unfollow.items.set(found.key, {
        key: found.key, title: '@' + found.key, url: location.origin + '/' + found.key + '/'
      });
      count++;
    }
    return 'Scanned ' + count + ' visible accounts. Scroll inside Following and scan again for more.';
  }
  function onLikesPage() {
    return globalThis.InstagramLikesUI?.isLikesPage() || false;
  }
  function scanLikes() {
    const ui = globalThis.InstagramLikesUI;
    if (!ui) return 'Likes scanner is unavailable. Reload the Instagram tab after updating the extension.';
    const result = ui.scan();
    if (result.error) return result.error;
    const s = state.likes;
    s.items = new Map(result.items.map(item => [item.key, item]));
    s.selected = new Set([...s.selected].filter(key => s.items.has(key)));
    return result.message;
  }
  function snapshot(mode) {
    const s = state[mode];
    return {
      items: [...s.items.values()].map(x => ({
        key: x.key, title: x.title, url: x.url || '',
        protected: mode === 'unfollow' && protectedAccounts.has(x.key)
      })),
      selected: [...s.selected].filter(x => mode !== 'unfollow' || !protectedAccounts.has(x)),
      running: s.running, done: s.done, skipped: s.skipped,
      instagramSelected: mode === 'likes' ? globalThis.InstagramLikesUI?.selectionCount() ?? null : null
    };
  }
  function report(mode, message) {
    chrome.runtime.sendMessage({ kind: 'CLEANER_PROGRESS', mode, message, snapshot: snapshot(mode) }).catch(() => {});
  }
  function liveFollowing(key) {
    const dialog = followingDialog();
    if (!dialog) return null;
    for (const b of buttons(dialog)) {
      if (!matches(b, FOLLOWING)) continue;
      const row = findRow(b, dialog);
      if (row?.key === key) return row;
    }
    return null;
  }
  const restricted = () => /try again later|we restrict certain activity|temporarily blocked|challenge required|suspicious activity/i.test(document.body.innerText);

  async function unfollowBatch(s, limit) {
    for (const key of [...s.selected].filter(k => !protectedAccounts.has(k)).slice(0, limit)) {
      if (s.stop) break;
      if (restricted()) { report('unfollow', 'Instagram shows an account restriction. Stopped.'); break; }
      const target = liveFollowing(key);
      if (!target || !target.button.isConnected) {
        s.skipped++; report('unfollow', '@' + key + ' is not loaded. Scroll and rescan.'); continue;
      }
      target.button.click();
      await pause(800);
      if (s.stop) break;
      const confirm = [...document.querySelectorAll('[role="dialog"]')]
        .flatMap(d => buttons(d))
        .find(b => matches(b, UNFOLLOW));
      if (confirm && !confirm.disabled) {
        confirm.click();
        s.done++;
        s.selected.delete(key);
        report('unfollow', 'Unfollow clicked for @' + key + '.');
      } else if (!liveFollowing(key)) {
        s.done++;
        s.selected.delete(key);
        report('unfollow', '@' + key + ' is no longer in the visible Following list.');
      } else {
        s.skipped++;
        report('unfollow', 'No expected confirmation appeared; stopped to avoid incorrect clicks.');
        break;
      }
      await pause(4500);
    }
  }

  // Select visible media tiles only in Instagram's native selection mode.
  async function selectLikes(s, limit) {
    const ui = globalThis.InstagramLikesUI;
    if (!ui) { report('likes', 'Update not loaded. Reload the Instagram tab.'); return; }
    const keys = [...s.selected].slice(0, limit);
    for (const key of keys) {
      if (s.stop) break;
      if (restricted()) {
        report('likes', 'Instagram shows an account restriction. Stopping.');
        break;
      }
      const item = s.items.get(key);
      if (!item) { s.skipped++; continue; }
      const result = await ui.selectItem(item);
      if (result.ok) {
        s.done++;
        s.selected.delete(key);
      } else {
        s.skipped++;
      }
      report('likes', result.reason);
      // Ambiguous state: stop rather than click other cards.
      if (!result.ok && /not detected|did not confirm|restored/i.test(result.reason)) break;
      await pause(350);
    }
    report('likes', 'Finished selecting. Verify Instagram selections, then click Unlike selected in Instagram.');
  }
  async function run(mode, limit) {
    const s = state[mode];
    s.running = true; s.stop = false; s.done = 0; s.skipped = 0;
    report(mode, 'Batch started. Keep this tab open.');
    try {
      if (mode === 'unfollow') await unfollowBatch(s, limit);
      else await selectLikes(s, limit);
    } catch (err) {
      s.skipped++;
      report(mode, 'Stopped after page change: ' + err.message);
    } finally {
      s.running = false;
      report(mode, s.stop ? 'Stopped by user.' : 'Finished; verify results in Instagram.');
    }
  }
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    // Auto cleanup messages belong exclusively to likes-auto.js.
    if (msg?.type?.startsWith('LIKES_AUTO_')) return false;
    const mode = msg.mode === 'likes' ? 'likes' : 'unfollow';
    const s = state[mode];
    (async () => {
      let message = '', error = '';
      switch (msg.type) {
        case 'STATUS':
          if (mode === 'likes' && onLikesPage() && !s.items.size) message = scanLikes();
          break;
        case 'SCAN': message = mode === 'unfollow' ? scanFollowing() : scanLikes(); break;
        case 'ALL':
          s.selected = new Set([...s.items.keys()].filter(k => mode !== 'unfollow' || !protectedAccounts.has(k)));
          break;
        case 'CLEAR': s.selected.clear(); break;
        case 'TOGGLE':
          if (s.items.has(msg.key) && !(mode === 'unfollow' && protectedAccounts.has(msg.key))) {
            if (msg.checked) s.selected.add(msg.key);
            else s.selected.delete(msg.key);
          }
          break;
        case 'PROTECT':
          if (mode === 'unfollow') {
            for (const k of s.selected) protectedAccounts.add(k);
            s.selected.clear();
            await chrome.storage.local.set({ protectedAccounts: [...protectedAccounts] });
            message = 'Selected accounts protected.';
          } break;
        case 'UNPROTECT':
          if (mode === 'unfollow') {
            for (const k of s.items.keys()) protectedAccounts.delete(k);
            await chrome.storage.local.set({ protectedAccounts: [...protectedAccounts] });
            message = 'Protection removed from loaded accounts.';
          } break;
        case 'START':
          if (s.running) error = 'Already running.';
          else if (!s.selected.size) error = 'Select items first.';
          else if (mode === 'unfollow' && !followingDialog()) error = 'Open the Following list first.';
          else if (mode === 'likes' && !onLikesPage()) error = 'Open Your activity → Likes first.';
          else { void run(mode, Math.min(25, Math.max(1, Number(msg.limit) || 10))); message = 'Started.'; }
          break;
        case 'UNLIKE': {
          if (mode !== 'likes') { error = 'Choose the Likes tool first.'; break; }
          if (state.likes.running) { error = 'Finish selecting posts before pressing Unlike.'; break; }
          const action = globalThis.InstagramLikesUI?.unlikeNative();
          error = action?.error || (!action ? 'Likes helper unavailable. Reload Instagram.' : '');
          message = action?.message || '';
          break;
        }
        case 'STOP': s.stop = true; message = 'Stop requested.'; break;
        default: error = 'Unknown command.';
      }
      respond({ snapshot: snapshot(mode), message, error });
    })().catch(err => respond({ snapshot: snapshot(mode), error: err.message }));
    return true;
  });
})();
