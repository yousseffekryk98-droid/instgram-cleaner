/* Instagram Cleaner: local, dependency-free comparison of Instagram JSON exports. */
(function (root) {
  'use strict';
  const USERNAME = /^[a-z0-9._]{1,30}$/i;
  const FORBIDDEN = new Set(['accounts','explore','p','reel','reels','direct','stories','about','settings','your_activity','privacy']);
  function normalizeUsername(raw) {
    if (typeof raw !== 'string') return '';
    const v = raw.trim().replace(/^@/, '');
    if (USERNAME.test(v) && !FORBIDDEN.has(v.toLowerCase())) return v.toLowerCase();
    try {
      const url = new URL(v);
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      return parts.length === 1 && USERNAME.test(parts[0]) && !FORBIDDEN.has(parts[0].toLowerCase())
        ? parts[0].toLowerCase() : '';
    } catch {
      return '';
    }
  }
  function entriesFor(payload, kind) {
    if (!payload || typeof payload !== 'object') throw Error('Invalid JSON document.');
    const rootKey = kind === 'followers' ? 'relationships_followers' : 'relationships_following';
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload[rootKey])) return payload[rootKey];
    if (kind === 'followers' && Array.isArray(payload.followers)) return payload.followers;
    if (kind === 'following' && Array.isArray(payload.following)) return payload.following;
    throw Error('Not a recognizable Instagram ' + kind + ' JSON file. Select the correct JSON export, not an HTML file or the ZIP.');
  }
  function extractUsername(record) {
    if (typeof record === 'string') return normalizeUsername(record);
    if (!record || typeof record !== 'object') return '';
    const d = Array.isArray(record.string_list_data) ? record.string_list_data : [];
    const candidates = [
      ...d.flatMap(x => [x?.value, x?.href]),
      record.title, record.username, record.value
    ];
    for (const v of candidates) {
      const normalized = normalizeUsername(v);
      if (normalized) return normalized;
    }
    return '';
  }
  function parseExport(payload, kind) {
    if (kind !== 'followers' && kind !== 'following') throw Error('Invalid export type.');
    const entries = entriesFor(payload, kind);
    const users = new Set();
    for (const row of entries) {
      const name = extractUsername(row);
      if (name) users.add(name);
    }
    if (!users.size) throw Error('The ' + kind + ' file has no recognizable usernames. Check its format and select the correct file.');
    // Refuse suspiciously malformed data rather than silently treating the missing followers as non-followers.
    if (users.size / entries.length < 0.7) throw Error('Too many ' + kind + ' records could not be parsed. This format is not supported.');
    return users;
  }
  function compareExports(followerPayloads, followingPayloads) {
    if (!Array.isArray(followerPayloads) || !followerPayloads.length ||
        !Array.isArray(followingPayloads) || !followingPayloads.length) {
      throw Error('Choose at least one Followers JSON file and one Following JSON file.');
    }
    const followers = new Set(), following = new Set();
    for (const payload of followerPayloads) for (const name of parseExport(payload, 'followers')) followers.add(name);
    for (const payload of followingPayloads) for (const name of parseExport(payload, 'following')) following.add(name);
    const notFollowingBack = [...following].filter(name => !followers.has(name)).sort();
    return {
      followerCount: followers.size,
      followingCount: following.size,
      mutualCount: following.size - notFollowingBack.length,
      notFollowingBack
    };
  }
  const api = Object.freeze({ normalizeUsername, parseExport, compareExports });
  root.IGCleanerCompare = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
