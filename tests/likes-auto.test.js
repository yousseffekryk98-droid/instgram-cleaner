'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'likes-auto.js'), 'utf8');
function fixture({ restricted = false, nativeSelected = 1, unlikeError = '',
  clickActivatesSelection = true } = {}) {
  const stored = {};
  let unlikeClicks = 0;
  let tiles = [{
    source: 'https://example.invalid/media1.jpg',
    media: {
      isConnected: true,
      click: () => { if (clickActivatesSelection) nativeSelected = (nativeSelected ?? 0) + 1; }
    }
  }];
  const ui = {
    isLikesPage: () => true,
    selectionCount: () => nativeSelected,
    scan: () => ({ items: tiles }),
    unlikeNative: () => {
      unlikeClicks++;
      if (unlikeError) return { error: unlikeError };
      nativeSelected = 0;
      tiles = [];
      return { message: 'Clicked native Unlike' };
    },
    selectItem: async () => ({ ok: false, reason: 'not expected in this test' })
  };
  const chrome = {
    storage: { local: {
      set: async updates => { Object.assign(stored, updates); },
      get: async key => typeof key === 'string'
        ? { [key]: stored[key] } : { ...stored }
    } },
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: () => Promise.resolve()
    }
  };
  const context = {
    chrome, document: {
      body: { innerText: restricted ? 'Try again later' : '' },
      querySelectorAll: () => []
    }, globalThis: null,
    location: { pathname: '/your_activity/interactions/likes/' },
    window: { scrollBy: () => {} },
    innerHeight: 900,
    setTimeout, clearTimeout
  };
  context.globalThis = context;
  context.InstagramLikesUI = ui;
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    auto: context.InstagramLikesAutopilot,
    getCalls: () => unlikeClicks, getState: () => stored.instagramLikesAutopilotStatus
  };
}

test('automated batch uses Instagram native Unlike and confirms grid changed', async () => {
  const f = fixture();
  const state = await f.auto.run({ batchSize: 5, target: 1, waitSeconds: 10 });
  assert.equal(f.getCalls(), 1);
  assert.equal(state.state, 'finished');
  assert.equal(state.verified, 1);
  assert.equal(state.batches, 1);
  assert.equal(f.getState().verified, 1);
});

test('stops without clicking if Instagram shows action restriction', async () => {
  const f = fixture({ restricted: true });
  const state = await f.auto.run({ batchSize: 5, target: 1 });
  assert.equal(state.state, 'paused');
  assert.equal(state.verified, 0);
  assert.match(state.message, /restricted activity/);
  assert.equal(f.getCalls(), 0);
});

test('does not count success when Instagram cannot find native Unlike', async () => {
  const f = fixture({ unlikeError: 'Instagram Unlike control not found' });
  const state = await f.auto.run({ batchSize: 5, target: 1 });
  assert.equal(state.state, 'paused');
  assert.equal(state.verified, 0);
  assert.equal(state.batches, 0);
  assert.equal(f.getCalls(), 1);
});

test('stop request is available while tab continues running', () => {
  const f = fixture();
  assert.match(f.auto.stop().message, /Stop requested/);
});

test('autopilot does not need account credentials or private endpoints', () => {
  assert.equal(/fetch\(|XMLHttpRequest|document\.cookie|instagram\.com\/api\//.test(source), false);
});

test('automatically activates selection by clicking one tile, if Instagram confirms it', async () => {
  const f = fixture({ nativeSelected: null });
  const state = await f.auto.run({ batchSize: 1, target: 1 });
  assert.equal(state.state, 'finished');
  assert.equal(state.verified, 1);
  assert.equal(f.getCalls(), 1);
});

test('never clicks Unlike if Instagram does not enter selection mode', async () => {
  const f = fixture({ nativeSelected: null, clickActivatesSelection: false });
  const state = await f.auto.run({ batchSize: 1, target: 1 });
  assert.equal(state.state, 'paused');
  assert.equal(state.verified, 0);
  assert.equal(f.getCalls(), 0);
});
