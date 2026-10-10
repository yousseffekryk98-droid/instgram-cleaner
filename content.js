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
  function likeItems() {
    return [...document.querySelectorAll('a[href]')].flatMap(a => {
      const match = new URL(a.href, location.origin).pathname.match(/^\/(p|reel|tv)\/([^/]+)/);
      if (!match) return [];
      const key = match[1] + '/' + match[2];
      return [{ key, title: clean(a.querySelector('img')?.alt).slice(0, 80) || key, url: a.href }];
    });
  }
  function onLikesPage() {
    return location.pathname.includes('/your_activity/interactions/likes');
  }
  function scanLikes() {
    if (!onLikesPage()) return 'Open Your activity → Interactions → Likes before scanning.';
    const items = likeItems();
    for (const item of items) state.likes.items.set(item.key, item);
    return 'Scanned ' + items.length + ' loaded posts/Reels. Use Instagram Select mode for native bulk unlike.';
  }
  function snapshot(mode) {
    const s = state[mode];
    return {
      items: [...s.items.values()].map(x => ({
        ...x, protected: mode === 'unfollow' && protectedAccounts.has(x.key)
      })),
      selected: [...s.selected].filter(x => mode !== 'unfollow' || !protectedAccounts.has(x)),
      running: s.running, done: s.done, skipped: s.skipped
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

  // Likes edition uses Instagram's native multi-select; the user presses Unlike in Instagram.
  function findCheckboxFor(anchor) {
    let node = anchor;
    for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
      const checkbox = node.querySelector('input[type="checkbox"],[role="checkbox"]');
      if (checkbox) return checkbox;
    }
    return null;
  }
  async function selectLikes(s, limit) {
    const select = buttons(document).find(b => matches(b, ['select', 'تحديد']));
    if (select) { select.click(); await pause(500); }
    for (const key of [...s.selected].slice(0, limit)) {
      if (s.stop) break;
      const anchor = [...document.querySelectorAll('a[href]')].find(a => {
        try { return new URL(a.href).pathname.startsWith('/' + key + '/'); }
        catch { return false; }
      });
      const checkbox = anchor && findCheckboxFor(anchor);
      if (!checkbox || !checkbox.isConnected) {
        s.skipped++;
        report('likes', key + ': native selection control not found; select manually.');
        continue;
      }
      const checked = checkbox.matches('input') ? checkbox.checked : checkbox.getAttribute('aria-checked') === 'true';
      if (!checked) { checkbox.click(); s.done++; }
      report('likes', 'Selecting loaded posts in Instagram…');
      await pause(300);
    }
    report('likes', 'Review the highlighted posts and press Instagram’s Unlike button yourself.');
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
    const mode = msg.mode === 'likes' ? 'likes' : 'unfollow';
    const s = state[mode];
    (async () => {
      let message = '', error = '';
      switch (msg.type) {
        case 'STATUS': break;
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
        case 'STOP': s.stop = true; message = 'Stop requested.'; break;
        default: error = 'Unknown command.';
      }
      respond({ snapshot: snapshot(mode), message, error });
    })().catch(err => respond({ snapshot: snapshot(mode), error: err.message }));
    return true;
  });
})();
