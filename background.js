/* Instagram Cleaner - durable alarm-driven unfollow queue (Manifest V3).
 * No private APIs, rate limit bypass or hidden browser actions.
 */
(() => {
  'use strict';
  const KEY = 'nonfollowersRun';
  const ALARM = 'instagram-nonfollowers-next';
  const GAP_MS = 30000; // Chrome alarms wake the service worker between actions.
  const MAX_QUEUE = 5000;
  const LOAD_TIMEOUT = 25000;
  let executing = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const validName = s => typeof s === 'string' && /^[a-z0-9._]{1,30}$/i.test(s);
  const storage = () => chrome.storage.local.get({
    nonfollowersComparison: null, selectedTargets: [],
    protectedAccounts: [], completedTargets: [], [KEY]: null
  });
  const getRun = async () => (await chrome.storage.local.get(KEY))[KEY];
  const saveRun = async run => chrome.storage.local.set({ [KEY]: {
    ...run, updatedAt: Date.now()
  } });
  const errorMessage = e => e instanceof Error ? e.message : String(e);
  const blockedReason = s =>
    /restriction|restrict|challenge|captcha|temporarily blocked|try again later|suspicious activity|action blocked|please wait a few minutes|تقييد|حاول مرة أخرى لاحقاً/i.test(s || '');
  async function nextAlarm(when) {
    await chrome.alarms.create(ALARM, { when: Date.now() + when });
  }
  async function removeAlarm() { await chrome.alarms.clear(ALARM); }
  function same(id, run) { return !!run && run.id === id; }
  async function stop(reason = 'Stopped by user. No further accounts will be processed.') {
    const run = await getRun();
    if (!run?.active) return { error: 'No unfollow queue is running.' };
    run.stopRequested = true;
    // Stop immediately when waiting between accounts; otherwise let the current
    // UI operation finish and have finishEntry mark the queue inactive.
    if (!run.inFlight) run.active = false;
    run.message = reason;
    await saveRun(run);
    await removeAlarm();
    return { message: 'Stop requested. The current action may finish first.' };
  }

  async function start(limitInput) {
    const saved = await storage();
    if (saved[KEY]?.active) return {
      error: 'A queue already exists. Stop it before starting another.'
    };
    const comparison = saved.nonfollowersComparison;
    if (!Array.isArray(comparison?.targets) || !comparison?.importedAt) {
      return { error: 'Import Followers and Following JSON before starting.' };
    }
    const allowed = new Set(comparison.targets);
    const protectedNames = new Set(saved.protectedAccounts);
    const completed = new Set(saved.completedTargets);
    const eligible = [...new Set(saved.selectedTargets)].filter(name =>
      validName(name) && allowed.has(name) &&
      !protectedNames.has(name) && !completed.has(name));
    const requested = Number(limitInput);
    const length = requested === 0 ? eligible.length :
      Math.min(eligible.length, Math.max(1, Math.floor(requested) || 10));
    const queue = eligible.slice(0, Math.min(MAX_QUEUE, length));
    if (!queue.length) return { error: 'Select eligible accounts before starting.' };
    const run = {
      id: String(Date.now()) + '-' + Math.random().toString(36).slice(2),
      queue, index: 0, active: true, stopRequested: false,
      total: queue.length, processed: 0, succeeded: 0, skipped: 0,
      tabId: null, current: '', inFlight: null, results: [],
      message: 'Queue saved. Opening Instagram…',
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await saveRun(run);
    await nextAlarm(1500);
    return { message: 'Queue scheduled for ' + queue.length + ' accounts, one at a time.' };
  }

  async function waitForDocument(tabId, username) {
    const expectedPath = '/' + username.toLowerCase() + '/';
    return new Promise((resolve, reject) => {
      let finished = false;
      const matches = tab => {
        try {
          const address = new URL(tab.url);
          return tab.status === 'complete' &&
            address.hostname === 'www.instagram.com' &&
            address.pathname.toLowerCase() === expectedPath;
        } catch { return false; }
      };
      const cleanup = () => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(updated);
        chrome.tabs.onRemoved.removeListener(removed);
      };
      const done = error => {
        if (finished) return;
        finished = true; cleanup();
        if (error) reject(error);
        else resolve();
      };
      const updated = (id, change, tab) => { if (id === tabId && matches(tab)) done(); };
      const removed = id => { if (id === tabId) done(new Error('Cleanup tab closed.')); };
      const timer = setTimeout(() => done(new Error('Instagram profile loading timed out.')), LOAD_TIMEOUT);
      chrome.tabs.onUpdated.addListener(updated);
      chrome.tabs.onRemoved.addListener(removed);
      chrome.tabs.get(tabId).then(tab => { if (matches(tab)) done(); }).catch(done);
    });
  }
  async function contentAction(tabId, username) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'UNFOLLOW_IF_FOLLOWING', username
        });
        return result?.status ? result : {
          status: 'skipped', reason: 'Unexpected Instagram response.'
        };
      } catch (e) {
        if (attempt >= 3) return {
          status: 'skipped', reason: 'Instagram content script not ready: ' + errorMessage(e)
        };
        await sleep(750);
      }
    }
  }

  async function finishEntry(id, username, response) {
    const saved = await storage(), run = saved[KEY];
    if (!same(id, run) || !run.active) return;
    // A stop requested during the action always wins.
    const successful = ['unfollowed', 'already-not-following'].includes(response.status);
    const restricted = blockedReason(response.reason);
    const outcome = {
      username, status: successful ? response.status : 'skipped',
      reason: response.reason || ''
    };
    if (successful) {
      await chrome.storage.local.set({
        completedTargets: [...new Set([...saved.completedTargets, username])],
        selectedTargets: saved.selectedTargets.filter(x => x !== username)
      });
    }
    run.index++;
    run.processed++;
    run.succeeded += Number(successful);
    run.skipped += Number(!successful);
    run.results = [...run.results, outcome].slice(-30);
    run.current = '';
    run.inFlight = null;
    run.message = '@' + username + ': ' + (response.reason || response.status);
    if (restricted) {
      run.stopRequested = true;
      run.message += ' Instagram restriction detected; queue stopped.';
    }
    if (run.stopRequested || run.index >= run.queue.length) {
      run.active = false;
      run.message += run.stopRequested ? ' No more profiles will be processed.' : ' Queue complete.';
      await saveRun(run);
      await removeAlarm();
    } else {
      run.message += ' Next account scheduled in at least 30 seconds.';
      await saveRun(run);
      await nextAlarm(GAP_MS);
    }
  }

  async function processNext() {
    if (executing) return;
    executing = true;
    let run;
    try {
      run = await getRun();
      if (!run?.active) return;
      if (run.stopRequested) {
        run.active = false;
        await saveRun(run);
        await removeAlarm();
        return;
      }
      if (run.inFlight) {
        // Chrome can suspend the worker during a network or UI operation.
        // Don't click the same account again after restart. Mark uncertain.
        await finishEntry(run.id, run.inFlight, {
          status: 'skipped',
          reason: 'Interrupted while processing this profile; verify it manually.'
        });
        return;
      }
      const username = run.queue[run.index];
      if (!username) {
        run.active = false;
        run.message = 'All selected accounts processed.';
        await saveRun(run);
        await removeAlarm();
        return;
      }
      // Account may have been protected while an existing queue was running.
      const latest = await storage();
      if (latest.protectedAccounts.includes(username) ||
          latest.completedTargets.includes(username)) {
        await finishEntry(run.id, username, {
          status: 'skipped', reason: 'Already processed or protected; skipped.'
        });
        return;
      }
      run.current = username;
      run.inFlight = username;
      run.message = 'Opening @' + username + ' (' + (run.index + 1) + '/' + run.total + ')';
      await saveRun(run);
      // Recovery alarm if browser suspends the active worker part-way through.
      await nextAlarm(90000);
      let response;
      try {
        const url = 'https://www.instagram.com/' + username + '/';
        let tab;
        if (run.tabId) {
          tab = await chrome.tabs.get(run.tabId);
          tab = await chrome.tabs.update(tab.id, { url, active: true });
        } else {
          tab = await chrome.tabs.create({ url, active: true });
          const latestRun = await getRun();
          if (same(run.id, latestRun)) {
            latestRun.tabId = tab.id;
            await saveRun(latestRun);
          }
        }
        await waitForDocument(tab.id, username);
        await sleep(700);
        const latestRun = await getRun();
        if (latestRun?.stopRequested) response = {
          status: 'skipped', reason: 'User requested stop before the click.'
        };
        else response = await contentAction(tab.id, username);
      } catch (e) {
        response = {
          status: 'skipped', reason: errorMessage(e)
        };
        if (/Cleanup tab closed/i.test(response.reason)) {
          await stop('Cleanup tab closed; stop requested.');
        }
      }
      await finishEntry(run.id, username, response);
    } catch (e) {
      const latest = await getRun();
      if (latest?.active) {
        latest.stopRequested = true;
        latest.active = false;
        latest.message = 'Queue stopped after unexpected error: ' + errorMessage(e);
        await saveRun(latest);
      }
      await removeAlarm();
    } finally { executing = false; }
  }

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM) void processNext();
  });
  chrome.runtime.onMessage.addListener((request, sender, reply) => {
    if (request?.type === 'START_NONFOLLOWERS') {
      start(request.limit).then(reply).catch(e => reply({ error: errorMessage(e) }));
      return true;
    }
    if (request?.type === 'STOP_NONFOLLOWERS') {
      stop().then(reply).catch(e => reply({ error: errorMessage(e) }));
      return true;
    }
    if (request?.type === 'STATUS_NONFOLLOWERS') {
      getRun().then(run => reply({ run })).catch(e => reply({ error: errorMessage(e) }));
      return true;
    }
    return false;
  });
  chrome.runtime.onStartup.addListener(() => {
    void getRun().then(async run => {
      if (!run?.active) return;
      // After restart never repeat an action without verifying manually.
      if (run.inFlight) {
        await finishEntry(run.id, run.inFlight, {
          status: 'skipped', reason: 'Chrome restarted during this profile; verify manually.'
        });
      } else {
        await nextAlarm(2000);
      }
    });
  });
})();