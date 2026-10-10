/* User-initiated, small-batch Instagram unfollow coordinator. No private APIs. */
(() => {
  'use strict';
  const LIMIT = 10;
  const BETWEEN_ACTIONS_MS = 5500;
  const LOAD_TIMEOUT_MS = 25000;
  let executing = false;

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isUsername = s => typeof s === 'string' && /^[a-z0-9._]{1,30}$/i.test(s);
  const getStored = async () => chrome.storage.local.get({
    nonfollowersComparison: null, selectedTargets: [], protectedAccounts: [],
    completedTargets: [], nonfollowersRun: null
  });
  const lastMessage = e => e instanceof Error ? e.message : String(e);

  async function updateRun(changes, runId) {
    const { nonfollowersRun } = await getStored();
    if (!nonfollowersRun || nonfollowersRun.id !== runId) return null;
    const updated = { ...nonfollowersRun, ...changes, updatedAt: Date.now() };
    await chrome.storage.local.set({ nonfollowersRun: updated });
    return updated;
  }

  async function stop() {
    const { nonfollowersRun } = await getStored();
    if (!nonfollowersRun?.active) return { error: 'No batch is running.' };
    await updateRun({ stopRequested: true, message: 'Stop requested; waiting for the current action.' }, nonfollowersRun.id);
    return { message: 'Stop requested.' };
  }

  async function start(limitInput) {
    const saved = await getStored();
    const { nonfollowersComparison, nonfollowersRun } = saved;
    if (executing || nonfollowersRun?.active) {
      const age = Date.now() - (nonfollowersRun?.updatedAt || 0);
      if (age < 120000 || executing) return { error: 'Another batch is already active. Use Stop first.' };
      await updateRun({ active: false, stopRequested: true, message: 'Previous batch expired after interruption.' }, nonfollowersRun.id);
    }
    if (!nonfollowersComparison?.targets?.length || !nonfollowersComparison.importedAt) {
      return { error: 'Import and compare complete Instagram JSON files before unfollowing.' };
    }
    const allowed = new Set(nonfollowersComparison.targets);
    const protectedNames = new Set(saved.protectedAccounts);
    const completed = new Set(saved.completedTargets);
    const queue = [...new Set(saved.selectedTargets)].filter(name =>
      isUsername(name) && allowed.has(name) && !protectedNames.has(name) && !completed.has(name))
      .slice(0, Math.min(LIMIT, Math.max(1, Number(limitInput) || 5)));
    if (!queue.length) return { error: 'Select at least one eligible non-follower first.' };
    const now = Date.now();
    const run = {
      id: String(now) + '-' + Math.random().toString(36).slice(2),
      active: true, stopRequested: false, total: queue.length,
      processed: 0, succeeded: 0, skipped: 0, current: '',
      results: [], message: 'Starting a new Instagram tab…',
      createdAt: now, updatedAt: now
    };
    executing = true;
    await chrome.storage.local.set({ nonfollowersRun: run });
    void execute(run.id, queue).catch(async e => {
      await updateRun({ active: false, message: 'Unexpected failure: ' + lastMessage(e) }, run.id);
      executing = false;
    });
    return { message: 'Running on up to ' + queue.length + ' selected accounts.' };
  }

  async function waitForDocument(tabId, expectedPath) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const clean = () => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdate);
        chrome.tabs.onRemoved.removeListener(onRemoved);
      };
      const finish = (error) => {
        if (settled) return;
        settled = true; clean();
        if (error) reject(error);
        else resolve();
      };
      const onRemoved = removed => {
        if (removed === tabId) finish(Error('Cleanup tab was closed.'));
      };
      const matches = tab => {
        try {
          return tab?.status === 'complete' &&
            new URL(tab.url).pathname.toLowerCase() === expectedPath.toLowerCase();
        } catch { return false; }
      };
      const onUpdate = (changedId, change, tab) => {
        if (changedId === tabId && matches(tab)) finish();
      };
      const timer = setTimeout(() => finish(Error('Timed out loading Instagram profile.')), LOAD_TIMEOUT_MS);
      chrome.tabs.onUpdated.addListener(onUpdate);
      chrome.tabs.onRemoved.addListener(onRemoved);
      chrome.tabs.get(tabId).then(tab => {
        if (matches(tab)) finish();
      }).catch(finish);
    });
  }

  async function invokeOnProfile(tabId, username) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'UNFOLLOW_IF_FOLLOWING', username
        });
        if (result?.status) return result;
        return { status: 'skipped', reason: 'Unexpected Instagram page response.' };
      } catch (e) {
        if (attempt === 3) return {
          status: 'skipped',
          reason: 'Instagram content script unavailable: ' + lastMessage(e)
        };
        await delay(800);
      }
    }
    return { status: 'skipped', reason: 'Instagram page not ready.' };
  }

  async function execute(runId, queue) {
    let tab = null;
    let finished = false;
    try {
      for (let index = 0; index < queue.length; index++) {
        const currentRun = (await getStored()).nonfollowersRun;
        if (!currentRun || currentRun.id !== runId || currentRun.stopRequested) {
          finished = true; break;
        }
        const username = queue[index];
        const path = '/' + username + '/';
        const url = 'https://www.instagram.com' + path;
        await updateRun({ current: username, message: 'Loading @' + username + '…' }, runId);

        let result;
        try {
          if (!tab) tab = await chrome.tabs.create({ url, active: true });
          else tab = await chrome.tabs.update(tab.id, { url, active: true });
          await waitForDocument(tab.id, path);
          await delay(900);
          if ((await getStored()).nonfollowersRun?.stopRequested) {
            finished = true; break;
          }
          result = await invokeOnProfile(tab.id, username);
        } catch (e) {
          result = { status: 'skipped', reason: lastMessage(e) };
          if (result.reason.includes('tab was closed')) {
            await updateRun({ stopRequested: true }, runId);
          }
        }

        const saved = await getStored();
        const previous = saved.nonfollowersRun;
        if (!previous || previous.id !== runId) { finished = true; break; }
        const succeeded = result.status === 'unfollowed' || result.status === 'already-not-following';
        const status = succeeded ? result.status : 'skipped';
        const results = [...(previous.results || []), {
          username, status, reason: result.reason || ''
        }].slice(-10);
        const updates = {
          processed: previous.processed + 1,
          succeeded: previous.succeeded + Number(succeeded),
          skipped: previous.skipped + Number(!succeeded),
          results,
          current: '',
          message: succeeded
            ? '@' + username + ': ' + (result.reason || status) 
            : '@' + username + ' skipped: ' + (result.reason || 'Could not verify unfollow.')
        };
        const storageUpdates = {};
        // Do not keep attempting other accounts if Instagram signals a restriction.
        const restriction = /restriction|challenge|temporarily blocked|try again later/i.test(result.reason || '');
        if (restriction) updates.message += ' Batch halted because Instagram restricted the action.';
        if (succeeded) {
          storageUpdates.completedTargets = [...new Set([...saved.completedTargets, username])];
          storageUpdates.selectedTargets = saved.selectedTargets.filter(x => x !== username);
        }
        // Keep stopRequested from the latest snapshot.
        storageUpdates.nonfollowersRun = {
          ...previous, ...updates, stopRequested: previous.stopRequested || restriction,
          updatedAt: Date.now()
        };
        await chrome.storage.local.set(storageUpdates);
        if (previous.stopRequested || restriction) { finished = true; break; }
        if (index + 1 < queue.length) await delay(BETWEEN_ACTIONS_MS);
      }
    } finally {
      const prior = (await getStored()).nonfollowersRun;
      if (prior?.id === runId) {
        await updateRun({
          active: false,
          current: '',
          message: prior.stopRequested || finished
            ? 'Batch stopped. Review Instagram for actions already completed.'
            : 'Batch finished. Review Instagram and re-export later to refresh results.'
        }, runId);
      }
      executing = false;
      // Leave the Instagram tab open so the user can independently review the result.
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, reply) => {
    if (request?.type === 'START_NONFOLLOWERS') {
      start(request.limit).then(reply).catch(e => {
        executing = false;
        reply({ error: lastMessage(e) });
      });
      return true;
    }
    if (request?.type === 'STOP_NONFOLLOWERS') {
      stop().then(reply).catch(e => reply({ error: lastMessage(e) }));
      return true;
    }
    return false;
  });

  chrome.runtime.onStartup.addListener(async () => {
    const { nonfollowersRun } = await getStored();
    if (nonfollowersRun?.active) {
      await updateRun({
        active: false, stopRequested: true,
        message: 'Chrome restarted; interrupted batch safely stopped.'
      }, nonfollowersRun.id);
    }
  });
})();
