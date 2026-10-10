/* Instagram Likes activity page UI adapter. No private Instagram APIs. */
(() => {
  'use strict';
  if (globalThis.InstagramLikesUI) return;
  const SCOPE = '/your_activity/interactions/likes';
  const mediaPath = /^\/(p|reel|tv)\/([^/?#]+)/i;
  const normalized = s => String(s || '').replace(/\s+/g, ' ').trim();
  const visible = el => !!el?.isConnected && el.getClientRects().length > 0;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isLikesPage = () => location.pathname.replace(/\/$/, '').endsWith(SCOPE);
  const roots = () => document.querySelector('main') || document.querySelector('[role="main"]') || document.body;

  function nativeButtons() {
    return [...document.querySelectorAll('button,[role="button"]')]
      .filter(b => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
  }
  function buttonText(button) {
    return normalized(button.innerText || button.textContent || button.getAttribute('aria-label'));
  }
  const isUnlikeText = text => /^(unlike|remove likes?|إلغاء الإعجاب|إلغاء تسجيل الإعجاب)(?:\s*\(?\d+\)?)?$/i.test(normalized(text));
  const isSelectText = text => /^(select|تحديد|اختيار)$/i.test(normalized(text));
  function findUnlikeButton() {
    const candidates = nativeButtons().filter(b => isUnlikeText(buttonText(b)));
    if (candidates.length === 1) return candidates[0];
    return null;
  }
  function selectionCount() {
    // Look for the small native "1 selected" text, never search an entire container's text.
    const els = document.querySelectorAll('span,div,p');
    let count = null;
    for (const el of els) {
      if (!visible(el) || el.childElementCount > 2) continue;
      const content = normalized(el.innerText || el.textContent);
      const match = content.match(/^(\d{1,5})\s+(?:selected|selected items?)$/i)
        || content.match(/^تم تحديد\s*(\d{1,5})$/);
      if (match) {
        const n = Number(match[1]);
        if (Number.isSafeInteger(n)) count = n;
      }
    }
    return count;
  }
  function tileSource(el) {
    if (el.tagName === 'IMG') return el.currentSrc || el.src || el.getAttribute('src') || '';
    if (el.tagName === 'VIDEO') return el.poster || el.currentSrc || el.src || '';
    const style = el.style?.backgroundImage || '';
    const match = style.match(/^url\(["']?(.*?)["']?\)$/);
    return match ? match[1] : '';
  }
  function shortHash(source) {
    let value = 2166136261;
    for (let index = 0; index < source.length; index++) {
      value ^= source.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0).toString(36);
  }
  function tileRect(media) {
    const r = media.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth || innerWidth;
    return r.width >= 95 && r.height >= 95 &&
      r.width <= Math.min(550, viewport * 0.62) && r.height <= 550 &&
      r.width / r.height >= 0.65 && r.width / r.height <= 1.65 &&
      r.right >= 0 && r.left <= viewport && r.bottom > -180 &&
      r.top < (innerHeight || 1200) + 180 ? r : null;
  }
  function candidates() {
    if (!isLikesPage()) return [];
    const scope = roots();
    const selectors = 'img,video,[style*="background-image"]';
    const nodes = [...scope.querySelectorAll(selectors)].slice(0, 700);
    const unique = new Set();
    const result = [];
    for (const media of nodes) {
      const rect = tileRect(media);
      if (!rect) continue;
      // Exclude thumbnails inside navigational chrome.
      if (media.closest('nav,header,aside')) continue;
      const source = tileSource(media);
      if (!source || unique.has(source)) continue;
      unique.add(source);
      result.push({ media, rect, source });
    }
    if (!result.length) return [];
    // Prefer the repeating Instagram media grid instead of avatars or suggested profiles.
    const buckets = new Map();
    for (const item of result) {
      const bucket = Math.round(item.rect.width / 20);
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(item);
    }
    const groups = [...buckets.values()].sort((a,b) => b.length - a.length);
    const winner = groups.find(group => group.length >= 2);
    return winner || (result.length === 1 ? result : []);
  }
  function clickableMedia(media) {
    // Clicking media inside Instagram's SELECT mode bubbles through the card's React handler.
    // Never click a card if Select mode cannot be independently established.
    return media;
  }
  function cardCheckbox(media) {
    // Stay inside this one media tile; never borrow a checkbox from an adjacent tile.
    const baseRect = media.getBoundingClientRect();
    let cursor = media;
    for (let i = 0; cursor && i < 5; i++, cursor = cursor.parentElement) {
      const bounds = cursor.getBoundingClientRect?.();
      if (bounds && (bounds.width > baseRect.width * 1.6 ||
        bounds.height > baseRect.height * 1.65)) break;
      const box = cursor.querySelector?.('input[type="checkbox"],[role="checkbox"]');
      if (box && visible(box)) return box;
    }
    return null;
  }
  function checkboxSelected(el) {
    if (!el) return null;
    return el.matches('input') ? !!el.checked : el.getAttribute('aria-checked') === 'true';
  }
  function scan() {
    if (!isLikesPage()) return { error: 'Open Instagram → Your activity → Likes first.' };
    const found = candidates();
    const counts = new Map();
    const items = found.map((item, index) => {
      const raw = item.source;
      const hashed = shortHash(raw);
      const ordinal = counts.get(hashed) || 0;
      counts.set(hashed, ordinal + 1);
      const parentLink = item.media.closest('a[href]');
      let url = '';
      try {
        const u = new URL(parentLink?.href || '', location.origin);
        if (u.origin === location.origin && mediaPath.test(u.pathname)) url = u.href;
      } catch { /* no link available */ }
      const kind = url.includes('/reel/') || item.media.tagName === 'VIDEO' ? 'Reel' : 'Liked post';
      const alt = normalized(item.media.getAttribute('alt')).slice(0, 72);
      return {
        key: 'tile-' + hashed + (ordinal ? '-' + ordinal : ''),
        title: alt || kind + ' #' + (index + 1),
        url,
        media: item.media,
        source: raw,
        checkbox: cardCheckbox(item.media)
      };
    });
    return {
      items,
      instagramSelected: selectionCount(),
      message: items.length
        ? 'Found ' + items.length + ' loaded media tiles. You can select items in the extension or select them directly on Instagram.'
        : 'No media tiles detected yet. Scroll the Likes grid into view, wait for thumbnails to load, then scan again.'
    };
  }
  function refreshItem(item) {
    if (item.media?.isConnected) return item;
    const match = scan();
    return match.items?.find(x => x.key === item.key) || null;
  }
  function selectModeAvailable() {
    const selected = selectionCount();
    return selected !== null || !!findUnlikeButton() ||
      !!document.querySelector('input[type="checkbox"]:checked,[role="checkbox"][aria-checked="true"]');
  }
  async function startSelectMode() {
    if (selectModeAvailable()) return true;
    const select = nativeButtons().filter(b => isSelectText(buttonText(b)));
    if (select.length !== 1) return false;
    select[0].click();
    await sleep(450);
    return selectModeAvailable();
  }
  async function selectItem(item) {
    const entry = refreshItem(item);
    if (!entry) return { ok: false, reason: 'This tile is no longer loaded. Scroll it into view and scan again.' };
    const countBefore = selectionCount();
    const checkbox = cardCheckbox(entry.media);
    const wasChecked = checkboxSelected(checkbox);
    if (wasChecked === true) return { ok: true, reason: 'Already selected in Instagram.' };
    const mode = selectModeAvailable() || await startSelectMode();
    if (!mode) return {
      ok: false, reason: 'Instagram selection mode was not detected. First select one post manually in Instagram, then scan again.'
    };
    if (!entry.media.isConnected) return { ok:false, reason:'Tile was removed while selecting.' };
    const target = checkbox || clickableMedia(entry.media);
    target.click();
    await pause(350);
    const countAfter = selectionCount();
    const nextCheckbox = cardCheckbox(entry.media);
    const isCheckedNow = checkboxSelected(nextCheckbox);
    if (isCheckedNow === true || (countBefore !== null && countAfter !== null && countAfter === countBefore + 1)) {
      return { ok: true, reason: 'Selected in Instagram.' };
    }
    if (countBefore !== null && countAfter !== null && countAfter < countBefore) {
      // Don't silently deselect an existing user's Instagram selection.
      if (entry.media.isConnected) target.click();
      return { ok: false, reason: 'This tile was already selected in Instagram; its previous state was restored.' };
    }
    return {
      ok: false,
      reason: 'Instagram did not confirm the item was selected. Review the page manually before continuing.'
    };
  }
  function unlikeNative() {
    if (!isLikesPage()) return { error: 'Open your Instagram Likes activity page first.' };
    const btn = findUnlikeButton();
    const count = selectionCount();
    if (count === 0) return { error: 'Instagram shows 0 selected. Select posts on Instagram first.' };
    if (!btn) return {
      error: 'Could not find a unique, visible Instagram Unlike button. Select at least one post, then use the native Unlike action on Instagram.'
    };
    btn.click();
    return {
      message: 'Clicked Instagram’s Unlike control' + (count !== null ? ' for ' + count + ' selected item(s)' : '') +
        '. Complete any Instagram confirmation and check the Likes grid to verify removal.'
    };
  }
  globalThis.InstagramLikesUI = Object.freeze({
    scan, selectItem, selectionCount, unlikeNative, isLikesPage,
    // Pure helpers exposed for regression tests.
    shortHash, isUnlikeText, isSelectText
  });
})();
