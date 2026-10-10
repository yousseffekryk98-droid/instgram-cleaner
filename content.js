/* Click only the user's requested Instagram profile's native Following/Unfollow controls. */
(() => {
  'use strict';
  if (window.__nonfollowerCleanerReady) return;
  window.__nonfollowerCleanerReady = true;
  const USERNAME = /^[a-z0-9._]{1,30}$/i;
  const FOLLOWING = new Set(['following', 'تتابعه']);
  const FOLLOW = new Set(['follow', 'متابعة']);
  const UNFOLLOW = new Set(['unfollow', 'إلغاء المتابعة']);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = el => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const buttons = root => [...root.querySelectorAll('button,[role="button"]')];
  const visible = el => !!el?.isConnected && !!el.getClientRects().length &&
    !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const candidates = (root, labels) => buttons(root).filter(el => visible(el) && labels.has(text(el)));
  const blocked = () => /try again later|we restrict certain activity|temporarily blocked|challenge required|suspicious activity/i
    .test(document.body?.innerText || '');
  const sameProfile = username => {
    if (!USERNAME.test(username)) return false;
    const path = location.pathname.split('/').filter(Boolean);
    return location.hostname === 'www.instagram.com' &&
      path.length === 1 && path[0].toLowerCase() === username.toLowerCase();
  };
  const hasStopRequest = async () => {
    const data = await chrome.storage.local.get({ nonfollowersRun: null });
    return !data.nonfollowersRun?.active || !!data.nonfollowersRun?.stopRequested;
  };
  const waitFor = async (read, timeout = 3500) => {
    const deadline = Date.now() + timeout;
    do {
      const found = read();
      if (found) return found;
      await delay(180);
    } while (Date.now() < deadline);
    return null;
  };

  function profileButtons(labelSet) {
    const header = document.querySelector('main header');
    const area = header || document.querySelector('main');
    return area ? candidates(area, labelSet) : [];
  }

  function unfollowOption() {
    const scopes = [...document.querySelectorAll('[role="dialog"],[role="menu"]')].filter(visible);
    const matches = scopes.flatMap(scope => candidates(scope, UNFOLLOW));
    const unique = [...new Set(matches)];
    if (unique.length === 1) return unique[0];
    // Some Instagram UI builds use a portaled popup without dialog/menu semantics.
    // Only accept a single, visible option *outside* the main profile content.
    const main = document.querySelector('main');
    const external = candidates(document, UNFOLLOW).filter(el => !main?.contains(el));
    return external.length === 1 ? external[0] : null;
  }

  async function action(username) {
    if (!sameProfile(username)) {
      return { status: 'skipped', reason: 'Current page is not the requested @' + username + ' profile.' };
    }
    if (blocked()) {
      return { status: 'skipped', reason: 'Instagram displayed an action restriction or security challenge.' };
    }
    const main = await waitFor(() => document.querySelector('main'), 5000);
    if (!main || !sameProfile(username)) {
      return { status: 'skipped', reason: 'Instagram profile did not load.' };
    }
    if (profileButtons(FOLLOW).length && !profileButtons(FOLLOWING).length) {
      return { status: 'already-not-following', reason: 'Instagram already shows Follow (not Following).' };
    }
    const following = await waitFor(() => {
      const options = profileButtons(FOLLOWING);
      return options.length === 1 ? options[0] : null;
    }, 4000);
    if (!following) {
      return { status: 'skipped', reason: 'Could not uniquely identify this profile’s Following button.' };
    }
    // Cache the original controls group to verify that the same profile's state changed.
    const originalParent = following.parentElement?.parentElement || following.parentElement;
    if (await hasStopRequest()) return { status: 'skipped', reason: 'Stopped before clicking.' };
    following.click();
    const option = await waitFor(unfollowOption, 3500);
    if (!option || !sameProfile(username)) {
      return { status: 'skipped', reason: 'Instagram did not expose a unique native Unfollow option.' };
    }
    if (await hasStopRequest()) return { status: 'skipped', reason: 'Stopped before confirmation.' };
    option.click();
    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(350);
      if (blocked()) return { status: 'skipped', reason: 'Instagram restricted this action.' };
      if (!sameProfile(username)) return { status: 'skipped', reason: 'Instagram changed to another page.' };
      const scoped = originalParent?.isConnected && candidates(originalParent, FOLLOW);
      if (scoped?.length === 1 || (profileButtons(FOLLOW).length === 1 && !profileButtons(FOLLOWING).length)) {
        return { status: 'unfollowed', reason: 'The profile changed from Following to Follow.' };
      }
    }
    return { status: 'skipped', reason: 'Unfollow was clicked, but Instagram did not confirm the updated following state. Verify manually.' };
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'UNFOLLOW_IF_FOLLOWING') return false;
    action(message.username)
      .then(respond)
      .catch(error => respond({ status: 'skipped', reason: 'Action failed: ' + error.message }));
    return true;
  });
})();
