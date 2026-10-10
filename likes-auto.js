/* Instagram Likes batch assistant.
 * Runs only after explicit Start, through visible Instagram page controls.
 * No private endpoints, CAPTCHA handling, hidden automation or limit evasion.
 */
(() => {
  'use strict';
  if (globalThis.InstagramLikesAutopilot) return;

  const KEY = 'instagramLikesAutopilotStatus';
  const LIMIT_BATCH = 20;
  const LIMIT_TOTAL = 10000;
  const MIN_WAIT_MS = 10000;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ui = globalThis.InstagramLikesUI;
  let executing = false;
  let stopRequested = false;
  let status = {
    state: 'idle', selected: 0, verified: 0, batches: 0,
    skipped: 0, target: 0, batchSize: 0, message: 'Not started.',
    updatedAt: Date.now()
  };

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = el => !!el?.isConnected && !!el.getClientRects?.().length &&
    !el.disabled && el.getAttribute?.('aria-disabled') !== 'true';
  const buttonText = el => normalize(el?.innerText || el?.textContent ||
    el?.getAttribute?.('aria-label'));
  const nativeButtons = root => [...root.querySelectorAll('button,[role="button"],[tabindex="0"]')]
    .filter(visible);
  const unlikeText = value => /^(unlike|unlike\s*\(?\d+\)?|remove likes?|إلغاء الإعجاب|إلغاء تسجيل الإعجاب)$/i.test(normalize(value));
  const dismissText = value => /^(cancel|not now|إلغاء|ليس الآن)$/i.test(normalize(value));
  const blocked = () => /try again later|we restrict certain activity|temporarily blocked|challenge required|suspicious activity|action blocked|please wait a few minutes|تقييد نشاطك|حاول مرة أخرى لاحقاً/i
    .test(document.body?.innerText || '');
  const allMediaSources = () => {
    if (!ui?.isLikesPage()) return new Set();
    // Only images/videos from the Likes content grid; not generic Instagram chrome.
    const result = ui.scan();
    return new Set((result.items || []).map(x => x.source));
  };

  async function publish(update) {
    status = { ...status, ...update, updatedAt: Date.now() };
    try {
      await chrome.storage.local.set({ [KEY]: { ...status } });
    } catch { /* Storage errors should not cause additional clicks. */ }
    try { chrome.runtime.sendMessage({ kind: 'LIKES_AUTO_PROGRESS', state: { ...status } }).catch(() => {}); }
    catch { /* Popup may be closed */ }
  }
  function current() { return { ...status, active: executing }; }
  function ensureSafe() {
    if (stopRequested) throw new Error('Stopped by user.');
    if (!ui?.isLikesPage()) throw new Error('Instagram navigated away from Your activity → Likes. Stopped.');
    if (blocked()) throw new Error('Instagram has restricted activity. Stopped; do not retry until Instagram allows it.');
  }
  async function waitSafely(ms) {
    let left = ms;
    while (left > 0) {
      ensureSafe();
      const chunk = Math.min(left, 400);
      await delay(chunk);
      left -= chunk;
    }
    ensureSafe();
  }
  function selected() {
    const count = ui.selectionCount();
    return Number.isSafeInteger(count) && count >= 0 ? count : null;
  }

  function selectedDialogButton() {
    const dialogs = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')]
      .filter(visible);
    for (const dialog of dialogs) {
      const candidates = nativeButtons(dialog).filter(b => unlikeText(buttonText(b)));
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) return null;
    }
    return null;
  }

  async function awaitConfirmationOrUpdate(beforeSources, expectedCount) {
    const startTime = Date.now();
    let confirmClicked = false;
    while (Date.now() - startTime < 14000) {
      ensureSafe();
      const confirm = selectedDialogButton();
      if (confirm && !confirmClicked) {
        await publish({ message: 'Confirming with Instagram’s native Unlike dialog…' });
        confirm.click();
        confirmClicked = true;
      }
      const count = selected();
      const afterSources = allMediaSources();
      const stillPresent = [...beforeSources].filter(x => afterSources.has(x)).length;
      // A strong success signal: Instagram cleared the selected count and changed
      // the visible grid. This is still a UI observation, not server-side proof.
      if ((count === 0 || count === null) && beforeSources.size > 0 &&
          stillPresent < beforeSources.size && !selectedDialogButton()) {
        return { ok: true, reason: 'Instagram cleared selection and changed the Likes grid.' };
      }
      // If no thumbnails remain in the grid, that's also a valid observable result.
      if ((count === 0 || count === null) && beforeSources.size > 0 &&
          afterSources.size === 0 && !selectedDialogButton()) {
        return { ok: true, reason: 'Instagram cleared selection and the visible grid.' };
      }
      await waitSafely(450);
    }
    return {
      ok: false,
      reason: 'Unable to verify Instagram removed the selected likes. Check the page; automatic cleanup stopped.'
    };
  }

  async function activateSelection(first) {
    if (selected() !== null) return { ok: true, selectedNow: 0 };
    const countBefore = selected();
    // Instagram sometimes exposes a distinct Select button in the Likes activity.
    const selectButtons = nativeButtons(document).filter(b =>
      /^(select|تحديد|اختيار)$/i.test(buttonText(b)));
    if (selectButtons.length === 1) {
      selectButtons[0].click();
      await waitSafely(500);
      if (selected() !== null) return { ok: true, selectedNow: 0 };
    }
    // Some Instagram web versions begin selection when a tile is clicked.
    // Try exactly one tile and verify that we remained on Likes with a selection count.
    if (!first?.media?.isConnected) return {
      ok: false, reason: 'No Instagram media tile is available to enter selection mode.'
    };
    first.media.click();
    await waitSafely(700);
    const countAfter = selected();
    if (countAfter !== null && countAfter > (countBefore ?? 0)) {
      return { ok: true, selectedNow: countAfter };
    }
    return {
      ok: false,
      reason: 'Instagram did not enter selection mode automatically. Select one liked post in Instagram, then try again.'
    };
  }

  function scrollContainer(item) {
    if (!item?.media) return null;
    let node = item.media.parentElement;
    for (let i = 0; node && i < 14; i++, node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 100) {
        return node;
      }
    }
    return null;
  }
  async function loadNext(previousSources) {
    ensureSafe();
    const scan = ui.scan();
    const last = scan.items?.at(-1);
    const pane = scrollContainer(last);
    let tries = 0;
    while (tries++ < 5) {
      ensureSafe();
      if (pane) pane.scrollBy({ top: Math.max(pane.clientHeight * 0.85, 500), behavior: 'instant' });
      else window.scrollBy({ top: Math.max(innerHeight * 0.8, 500), behavior: 'instant' });
      await waitSafely(1100 + tries * 350);
      const next = ui.scan();
      if ((next.items || []).some(item => !previousSources.has(item.source))) {
        return { ok: true, items: next.items };
      }
      // Don't fake a result merely because Instagram rearranged existing items.
    }
    return { ok: false, reason: 'No new liked items loaded after scrolling. End of visible list or Instagram is not loading more.' };
  }

  async function run(options) {
    if (executing) return { error: 'Automatic cleanup is already running.' };
    if (!ui?.isLikesPage()) return { error: 'Open Your activity → Likes on Instagram first.' };
    const batchSize = Math.min(LIMIT_BATCH, Math.max(1, Number(options?.batchSize) || 10));
    const target = Math.min(LIMIT_TOTAL, Math.max(1, Number(options?.target) || 5000));
    const waitMs = Math.max(MIN_WAIT_MS, Math.min(120000, Number(options?.waitSeconds || 15) * 1000));
    executing = true;
    stopRequested = false;
    const prior = status.state === 'paused' || status.state === 'interrupted' ?
      status : null;
    const verified = prior && options?.resume ? prior.verified : 0;
    const batches = prior && options?.resume ? prior.batches : 0;
    await publish({
      state: 'running', selected: 0, verified, batches, skipped: 0,
      batchSize, target, message: 'Starting. Leave the Instagram Likes tab open.'
    });
    // Use a set of sources confirmed removed only in this session.
    const completed = new Set();
    const stalled = new Set();
    try {
      while (status.verified < target) {
        ensureSafe();
        let scan = ui.scan();
        if (scan.error) throw new Error(scan.error);
        let items = scan.items || [];

        if (!items.length || items.every(x => stalled.has(x.source) || completed.has(x.source))) {
          await publish({ message: 'Waiting for Instagram to load more Likes…' });
          const next = await loadNext(new Set([...items.map(x => x.source), ...completed]));
          if (!next.ok) {
            await publish({ state: 'finished', message: next.reason });
            break;
          }
          items = next.items;
        }

        const remaining = Math.min(batchSize, target - status.verified);
        let nativeCount = selected();
        if (nativeCount !== null && nativeCount > remaining) {
          throw new Error('Instagram already has ' + nativeCount +
            ' posts selected, exceeding this batch size. Clear the native selection or increase batch size.');
        }
        let selectedInBatch = nativeCount || 0;
        if (nativeCount === null) {
          const activation = await activateSelection(items[0]);
          if (!activation.ok) throw new Error(activation.reason);
          selectedInBatch += activation.selectedNow;
        }
        const selectedSources = new Set();
        let ambiguous = false;
        for (const item of items) {
          ensureSafe();
          if (selectedInBatch >= remaining) break;
          if (!item.media?.isConnected || stalled.has(item.source) || completed.has(item.source)) continue;
          item.media.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
          const result = await ui.selectItem(item);
          if (result.ok) {
            // Do not count a previously selected tile a second time.
            const next = selected();
            if (next !== null && next > selectedInBatch) {
              selectedInBatch = next;
              selectedSources.add(item.source);
            } else if (result.reason?.startsWith('Already selected')) {
              selectedSources.add(item.source);
            }
          } else {
            stalled.add(item.source);
            if (/did not confirm|not detected|restored/i.test(result.reason || '')) {
              ambiguous = true;
              await publish({ message: 'Selection could not be verified: ' + result.reason });
              break;
            }
          }
          await waitSafely(220);
        }
        if (ambiguous) throw new Error('Instagram selection changed unexpectedly; stopping before Unlike.');
        nativeCount = selected();
        if (nativeCount === null || nativeCount < 1) {
          throw new Error('No verified native selected count. Select one item in Instagram, then retry.');
        }
        if (nativeCount > remaining) throw new Error('Instagram selected more items than the batch limit. Stopping.');

        await publish({
          selected: nativeCount,
          message: 'Selected ' + nativeCount + ' on Instagram. Using Instagram’s native Unlike action…'
        });
        // Capture the pre-action grid for observable confirmation.
        const before = allMediaSources();
        const action = ui.unlikeNative();
        if (action.error) throw new Error(action.error);
        const confirmation = await awaitConfirmationOrUpdate(before, nativeCount);
        if (!confirmation.ok) throw new Error(confirmation.reason);
        const after = allMediaSources();
        for (const name of before) if (!after.has(name)) completed.add(name);
        await publish({
          state: 'running',
          selected: 0,
          verified: status.verified + nativeCount,
          batches: status.batches + 1,
          message: 'Observed Instagram remove a batch of ' + nativeCount +
            ' likes. Waiting before the next batch…'
        });
        if (status.verified >= target) break;
        await waitSafely(waitMs);
        // If older rendered items remain, prefer them over the initial set,
        // otherwise scroll until Instagram loads fresh tiles.
        const latest = ui.scan().items || [];
        if (!latest.length || latest.every(x => completed.has(x.source) || stalled.has(x.source))) {
          const next = await loadNext(new Set([...latest.map(x => x.source), ...completed]));
          if (!next.ok) {
            await publish({ state: 'finished', message: next.reason });
            break;
          }
        }
      }
      if (status.state === 'running') {
        await publish({
          state: 'finished',
          selected: 0,
          message: 'Run finished after ' + status.verified +
            ' observed unlike actions. Verify your Likes list in Instagram.'
        });
      }
    } catch (error) {
      await publish({
        state: 'paused', selected: 0,
        message: error.message || String(error)
      });
    } finally {
      executing = false;
    }
    return { ...status };
  }

  function stop() {
    stopRequested = true;
    return { message: 'Stop requested. The current Instagram action may finish first.' };
  }

  // Never silently resume after a tab reload or Chrome restart.
  if (ui?.isLikesPage()) {
    chrome.storage.local.get(KEY).then(value => {
      const prior = value?.[KEY];
      if (prior && prior.state === 'running' && !executing) {
        status = { ...prior, state: 'interrupted',
          message: 'The Instagram tab reloaded; cleanup stopped. Click Resume when ready.' };
        void publish({});
      } else if (prior && !executing) status = { ...prior };
    }).catch(() => {});
  }
  globalThis.InstagramLikesAutopilot = Object.freeze({ run, stop, current });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (!message?.type?.startsWith('LIKES_AUTO_')) return false;
    if (message.type === 'LIKES_AUTO_START') {
      if (executing) reply({ error: 'Cleanup already running.', state: current() });
      else {
        void run(message.options).catch(error => void publish({
          state: 'paused', message: error.message || String(error)
        }));
        reply({ message: 'Starting automatic cleanup.', state: current() });
      }
    } else if (message.type === 'LIKES_AUTO_STOP') {
      reply({ ...stop(), state: current() });
    } else if (message.type === 'LIKES_AUTO_STATUS') {
      reply({ state: current() });
    } else reply({ error: 'Unknown automatic cleanup action.' });
    return false;
  });
})();
