(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { compareExports } = globalThis.IGCleanerCompare;
  const MAX_RENDER = 150;
  let comparison = null;
  let selected = new Set();
  let protectedAccounts = new Set();
  let completed = new Set();
  let run = null;
  let revealProtected = false;
  let noticeText = '';

  function notice(message) {
    noticeText = message;
    $('notice').textContent = message;
  }
  function escapeHtml(input) {
    return String(input).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  const saveSelection = () => chrome.storage.local.set({ selectedTargets: [...selected] });
  const format = number => Number(number || 0).toLocaleString();

  function view() {
    const valid = !!comparison;
    $('summary').hidden = !valid;
    $('results').hidden = !valid;
    if (!valid) return;
    $('followersCount').textContent = format(comparison.followerCount);
    $('followingCount').textContent = format(comparison.followingCount);
    $('nonfollowersCount').textContent = format(comparison.targets.length);
    const query = $('search').value.trim().replace(/^@/, '').toLowerCase();
    const all = comparison.targets.filter(name => {
      if (!revealProtected && protectedAccounts.has(name)) return false;
      return name.includes(query);
    });
    const shown = all.slice(0, MAX_RENDER);
    const eligible = comparison.targets.filter(name => !protectedAccounts.has(name) && !completed.has(name));
    $('count').textContent = format(selected.size) + ' selected · ' + format(eligible.length) + ' eligible';
    $('items').innerHTML = shown.length
      ? shown.map(name => {
          const safe = escapeHtml(name);
          const protectedOne = protectedAccounts.has(name);
          const completedOne = completed.has(name);
          return '<div class="item" role="listitem"><label><input type="checkbox" data-name="' + safe +
            '" ' + (selected.has(name) ? 'checked' : '') + (protectedOne || completedOne ? ' disabled' : '') +
            '><span class="name">@' + safe + '</span></label>' +
            (protectedOne ? '<button data-unprotect="' + safe + '">Unprotect</button>' :
              completedOne ? '<span class="protected">Already processed</span>' : '') +
            '<a href="https://www.instagram.com/' + encodeURIComponent(name) + '/" target="_blank" rel="noopener noreferrer">Profile ↗</a></div>';
        }).join('')
      : '<p class="empty">No accounts match this filter.</p>';
    $('listInfo').textContent = 'Showing ' + format(shown.length) + ' of ' + format(all.length) +
      ' matching accounts. Search by username to find other accounts.';
    $('showProtected').textContent = revealProtected ? 'Hide protected' : 'Show protected (' + format(protectedAccounts.size) + ')';
    const running = !!run?.active;
    $('start').disabled = running || selected.size === 0;
    $('stop').disabled = !running;
    $('import').disabled = running;
    $('clearImport').disabled = running;
    if (run) {
      const lines = [
        (running ? 'Running' : 'Last batch') + ': ' + format(run.processed) + ' / ' +
          format(run.total) + ', verified ' + format(run.succeeded) + ', skipped ' + format(run.skipped),
        run.current ? 'Current: @' + run.current : '',
        run.message || '',
        run.results?.length ? 'Most recent: ' + run.results.slice(-3)
          .map(r => '@' + r.username + ' — ' + r.status).join('; ') : ''
      ].filter(Boolean);
      $('progress').textContent = lines.join('\n');
    } else {
      $('progress').textContent = 'No batch has run yet.';
    }
  }

  async function reload() {
    const saved = await chrome.storage.local.get({
      nonfollowersComparison: null, selectedTargets: [], protectedAccounts: [],
      completedTargets: [], nonfollowersRun: null
    });
    comparison = saved.nonfollowersComparison;
    protectedAccounts = new Set(saved.protectedAccounts);
    completed = new Set(saved.completedTargets);
    const valid = new Set(comparison?.targets || []);
    selected = new Set(saved.selectedTargets.filter(x =>
      valid.has(x) && !protectedAccounts.has(x) && !completed.has(x)));
    run = saved.nonfollowersRun;
    if (comparison) {
      notice('Local comparison loaded (' + new Date(comparison.importedAt).toLocaleString() +
        '). Instagram relationships may have changed since this export.');
    }
    view();
  }

  async function readJsonFiles(files, expected) {
    if (!files.length) throw Error('Choose ' + expected + ' JSON file(s) first.');
    const namePattern = expected === 'followers'
      ? /^followers(?:_\d+)?\.json$/i
      : /^following(?:_\d+)?\.json$/i;
    if (files.some(f => !namePattern.test(f.name))) {
      throw Error('Choose only Instagram ' + expected + '.json or ' + expected +
        '_N.json files. Extract the ZIP first.');
    }
    return Promise.all(files.map(async file => {
      if (file.size > 25 * 1024 * 1024) throw Error(file.name + ' is too large (25 MB limit per file).');
      try { return JSON.parse(await file.text()); }
      catch { throw Error('Could not read ' + file.name + ' as JSON. Choose JSON, not HTML.'); }
    }));
  }

  async function importData() {
    if (run?.active) throw Error('Stop the current run before importing new data.');
    if (!$('verified').checked) throw Error('Confirm that the export is complete and from one account.');
    const followerFiles = [...$('followers').files];
    const followingFiles = [...$('following').files];
    const [followers, following] = await Promise.all([
      readJsonFiles(followerFiles, 'followers'), readJsonFiles(followingFiles, 'following')
    ]);
    const result = compareExports(followers, following);
    const newComparison = {
      followerCount: result.followerCount,
      followingCount: result.followingCount,
      mutualCount: result.mutualCount,
      targets: result.notFollowingBack,
      importedAt: new Date().toISOString()
    };
    const confirmed = confirm('Found ' + format(result.notFollowingBack.length) +
      ' accounts you follow that are missing from your exported followers list. Save these comparison results in this Chrome extension? Nothing will be unfollowed now.');
    if (!confirmed) return;
    await chrome.storage.local.set({
      nonfollowersComparison: newComparison,
      selectedTargets: [], completedTargets: [], nonfollowersRun: null
    });
    selected.clear();
    completed.clear();
    comparison = newComparison;
    run = null;
    $('search').value = '';
    notice('Comparison saved locally. Review and select accounts before running any unfollow actions.');
    view();
  }

  async function updateProtect(action) {
    if (!comparison) return;
    if (action === 'protect') {
      for (const name of selected) protectedAccounts.add(name);
      selected.clear();
      await chrome.storage.local.set({
        protectedAccounts: [...protectedAccounts], selectedTargets: []
      });
      notice('Selected usernames protected from unfollowing.');
      view();
    }
  }

  async function start() {
    if (!comparison || !selected.size || run?.active) return;
    const limit = Math.max(1, Math.min(10, Number($('limit').value) || 5));
    if (!confirm('Unfollow up to ' + limit + ' selected Instagram accounts identified as not following you back? The extension will open their profiles in a new tab, clicking Following → Unfollow only when the controls are recognizable. This changes your account.')) return;
    const response = await chrome.runtime.sendMessage({ type: 'START_NONFOLLOWERS', limit });
    if (response?.error) throw Error(response.error);
    notice('Run started. You can close this popup and return to see progress.');
    await reload();
  }
  function handler(id, fn) {
    $(id).addEventListener('click', () => Promise.resolve().then(fn).catch(e => notice(e.message)));
  }

  handler('import', importData);
  handler('selectAll', async () => {
    if (!comparison) return;
    const query = $('search').value.trim().replace(/^@/, '').toLowerCase();
    for (const name of comparison.targets) {
      if (name.includes(query) && !protectedAccounts.has(name) && !completed.has(name)) selected.add(name);
    }
    await saveSelection(); view();
  });
  handler('clearSelection', async () => { selected.clear(); await saveSelection(); view(); });
  handler('protect', () => updateProtect('protect'));
  handler('showProtected', async () => { revealProtected = !revealProtected; view(); });
  handler('start', start);
  handler('stop', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_NONFOLLOWERS' });
    if (response?.error) throw Error(response.error);
    notice('Stop requested. Any current Instagram action may finish first.');
    await reload();
  });
  handler('clearImport', async () => {
    if (!confirm('Erase imported comparison data, selections, and run history from this extension? Protected usernames will also be removed.')) return;
    await chrome.storage.local.remove(['nonfollowersComparison','selectedTargets','protectedAccounts',
      'completedTargets','nonfollowersRun']);
    comparison = null; selected.clear(); protectedAccounts.clear(); completed.clear(); run = null;
    notice('Imported data and history cleared from this browser.'); view();
  });
  $('search').addEventListener('input', view);
  $('items').addEventListener('change', async e => {
    const name = e.target.dataset.name;
    if (!name || !comparison?.targets.includes(name)) return;
    if (protectedAccounts.has(name) || completed.has(name)) return;
    if (e.target.checked) selected.add(name);
    else selected.delete(name);
    await saveSelection(); view();
  });
  $('items').addEventListener('click', async e => {
    const name = e.target.dataset.unprotect;
    if (!name) return;
    protectedAccounts.delete(name);
    await chrome.storage.local.set({ protectedAccounts: [...protectedAccounts] });
    notice('@' + name + ' removed from protection.'); view();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (['nonfollowersRun','completedTargets','selectedTargets'].some(k => changes[k])) {
      void reload();
    }
  });
  void reload().catch(e => notice('Could not load local results: ' + e.message));
})();
