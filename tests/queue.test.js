'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');

function harness(results = []) {
  const store = {
    nonfollowersComparison: {
      targets: ['alpha','bravo','charlie'], importedAt: new Date().toISOString()
    },
    selectedTargets: ['alpha','bravo','charlie'], protectedAccounts: [],
    completedTargets: [], nonfollowersRun: null
  };
  const alarms = { created: [], cleared: [], listener: null };
  const tabs = { tab: null, calls: [], removed: null, updated: null };
  const fastDelays = [];
  const trackedSetTimeout = (callback, delay, ...args) => {
    fastDelays.push(delay);
    return setTimeout(callback, delay, ...args);
  };
  let onMessage, onStartup;
  const chrome = {
    alarms: {
      create: async (name, args) => { alarms.created.push({ name, args }); },
      clear: async name => { alarms.cleared.push(name); },
      onAlarm: { addListener: cb => { alarms.listener = cb; } }
    },
    storage: { local: {
      get: async keys => {
        if (typeof keys === 'string') return { [keys]: store[keys] };
        if (Array.isArray(keys)) return Object.fromEntries(keys.map(k => [k,store[k]]));
        return Object.fromEntries(Object.entries(keys).map(([k,v]) => [k,store[k] === undefined ? v : store[k]]));
      },
      set: async values => { Object.assign(store, values); }
    } },
    tabs: {
      create: async ({ url }) => {
        tabs.tab = { id: 777, status: 'complete', url };
        tabs.calls.push(url);
        return { ...tabs.tab };
      },
      update: async (id, { url }) => {
        tabs.tab = { id, url, status: 'complete' };
        tabs.calls.push(url);
        return { ...tabs.tab };
      },
      get: async () => tabs.tab,
      sendMessage: async (id, { username }) => {
        const result = results.shift() || { status:'unfollowed', reason:'Profile shows Follow.' };
        return result;
      },
      onUpdated: { addListener: cb => { tabs.updated = cb; }, removeListener: () => {} },
      onRemoved: { addListener: cb => { tabs.removed = cb; }, removeListener: () => {} }
    },
    runtime: {
      onMessage: { addListener: cb => { onMessage = cb; } },
      onStartup: { addListener: cb => { onStartup = cb; } }
    }
  };
  const ctx = { chrome, URL, setTimeout: trackedSetTimeout, clearTimeout, Math, Date };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  const send = message => new Promise(resolve => onMessage(message, {}, resolve));
  const fire = () => alarms.listener({ name: 'instagram-nonfollowers-next' });
  const waitForProcessed = async target => {
    for (let attempt=0; attempt < 150; attempt++) {
      if (store.nonfollowersRun.processed >= target) return;
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error('Queue did not advance to ' + target + ': ' + JSON.stringify(store.nonfollowersRun));
  };
  return { store, tabs, alarms, fastDelays, send, fire, waitForProcessed };
}

test('three accounts are processed across separate alarm wake-ups', async () => {
  const f = harness();
  const started = await f.send({ type:'START_NONFOLLOWERS', limit: 0 });
  assert.match(started.message, /3 accounts/);
  for (let count=1; count<=3; count++) {
    f.fire();
    await f.waitForProcessed(count);
  }
  assert.equal(f.tabs.calls.length, 3);
  assert.equal(f.store.nonfollowersRun.active, false);
  assert.equal(f.store.nonfollowersRun.succeeded, 3);
  assert.equal(f.store.completedTargets.length, 3);
  assert.equal(f.store.selectedTargets.length, 0);
});

test('a skipped account does not end the remaining queue', async () => {
  const f = harness([
    { status:'skipped', reason:'Unfollow option not found.' },
    { status:'unfollowed', reason:'Profile shows Follow.' }
  ]);
  await f.send({ type:'START_NONFOLLOWERS', limit: 2 });
  f.fire(); await f.waitForProcessed(1);
  assert.equal(f.store.nonfollowersRun.active, true);
  f.fire(); await f.waitForProcessed(2);
  assert.equal(f.store.nonfollowersRun.skipped, 1);
  assert.equal(f.store.nonfollowersRun.succeeded, 1);
  assert.equal(f.store.nonfollowersRun.active, false);
});

test('an Instagram restriction stops the queue instead of bypassing it', async () => {
  const f = harness([{ status:'skipped', reason:'Instagram action restriction or challenge.' }]);
  await f.send({ type:'START_NONFOLLOWERS', limit:0 });
  f.fire(); await f.waitForProcessed(1);
  assert.equal(f.store.nonfollowersRun.active, false);
  assert.equal(f.store.nonfollowersRun.stopRequested, true);
  assert.equal(f.tabs.calls.length, 1);
});

test('Stop cancels future alarms', async () => {
  const f = harness();
  await f.send({ type:'START_NONFOLLOWERS', limit:0 });
  const stopped = await f.send({ type:'STOP_NONFOLLOWERS' });
  assert.match(stopped.message, /Stop requested/);
  assert.equal(f.store.nonfollowersRun.active, false);
  f.fire(); await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(f.tabs.calls.length, 0);
});

test('fast timer targets 5 seconds, with a 30-second recovery alarm', async () => {
  const f = harness();
  const startedAt = Date.now();
  await f.send({ type: 'START_NONFOLLOWERS', limit: 2 });
  assert.ok(f.fastDelays.includes(1500), 'initial action uses a fast timer');
  const initialAlarm = f.alarms.created.at(-1);
  assert.ok(initialAlarm.args.when >= startedAt + 29000);
  f.fire();
  await f.waitForProcessed(1);
  for (let i=0; i<50 && !f.fastDelays.includes(5000); i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok(f.fastDelays.includes(5000), 'next item uses a 5-second timer');
  const latestAlarm = f.alarms.created.at(-1);
  assert.ok(latestAlarm.args.when >= Date.now() + 28000,
    'Chrome alarms remain a 30-second-or-longer fallback');
  await f.send({ type:'STOP_NONFOLLOWERS' });
  assert.equal(f.store.nonfollowersRun.active, false);
});
