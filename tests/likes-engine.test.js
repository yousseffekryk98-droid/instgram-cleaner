'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'likes-engine.js'), 'utf8');

function mockLikesPage({ selected = 1, count = 3, pathName = '/your_activity/interactions/likes/' } = {}) {
  let nativeUnlikeClicks = 0;
  let itemClicks = 0;
  const images = Array.from({ length: count }, (_, i) => ({
    tagName: 'IMG',
    currentSrc: 'https://example-cdn.invalid/photo_' + i + '.jpg',
    isConnected: true,
    getAttribute: name => name === 'alt' ? 'Example Reel ' + (i + 1) : null,
    closest: () => null,
    getClientRects: () => [{}],
    getBoundingClientRect: () => ({
      left: 190 + i * 190, right: 370 + i * 190,
      top: 210, bottom: 390, width: 180, height: 180
    }),
    click: () => { selected++; itemClicks++; }
  }));
  const selectedElement = {
    tagName: 'SPAN', isConnected: true, childElementCount: 0,
    getClientRects: () => [{}],
    get innerText() { return selected + ' selected'; }
  };
  const unlike = {
    tagName: 'BUTTON', isConnected: true, disabled: false,
    getClientRects: () => [{}],
    innerText: 'Unlike (' + selected + ')',
    getAttribute: () => null,
    click: () => { nativeUnlikeClicks++; }
  };
  const main = {
    querySelectorAll: expression => expression.startsWith('img,video') ? images : []
  };
  const document = {
    documentElement: { clientWidth: 1400 },
    body: main,
    querySelector: selector => selector === 'main' ? main : null,
    querySelectorAll: selector => {
      if (selector === 'span,div,p') return [selectedElement];
      if (selector.startsWith('button,')) return [unlike];
      return [];
    }
  };
  const context = {
    document, location: { pathname: pathName }, innerWidth: 1400,
    innerHeight: 900, URL, setTimeout, clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    ui: context.InstagramLikesUI,
    getNativeClicks: () => nativeUnlikeClicks,
    getTileClicks: () => itemClicks
  };
}

test('scan finds the visible Instagram Likes grid even without post anchors', () => {
  const fixture = mockLikesPage();
  const { items, instagramSelected } = fixture.ui.scan();
  assert.equal(items.length, 3);
  assert.equal(instagramSelected, 1);
  assert.equal(new Set(items.map(x => x.key)).size, 3);
  assert.ok(items.every(x => !x.url));
});

test('reads the native selection toolbar independently of popup selection', () => {
  const fixture = mockLikesPage({ selected: 4 });
  assert.equal(fixture.ui.selectionCount(), 4);
  assert.equal(fixture.ui.scan().items.length, 3);
});

test('selecting a visible media tile checks for native selection count increase', async () => {
  const fixture = mockLikesPage();
  const item = fixture.ui.scan().items[0];
  const result = await fixture.ui.selectItem(item);
  assert.equal(result.ok, true);
  assert.equal(fixture.getTileClicks(), 1);
  assert.equal(fixture.ui.selectionCount(), 2);
});

test('unlike is a single native click, not an assumed success', () => {
  const fixture = mockLikesPage();
  const result = fixture.ui.unlikeNative();
  assert.equal(fixture.getNativeClicks(), 1);
  assert.match(result.message, /Complete any Instagram confirmation/);
});

test('never calls Unlike when Instagram says zero selected', () => {
  const fixture = mockLikesPage({ selected: 0 });
  const result = fixture.ui.unlikeNative();
  assert.match(result.error, /0 selected/);
  assert.equal(fixture.getNativeClicks(), 0);
});

test('does not scan or unlike a different Instagram page', () => {
  const fixture = mockLikesPage({ pathName: '/explore/' });
  assert.match(fixture.ui.scan().error, /Open Instagram/);
  assert.match(fixture.ui.unlikeNative().error, /Likes activity/);
  assert.equal(fixture.getNativeClicks(), 0);
});

test('matches valid native Unlike labels only', () => {
  const fixture = mockLikesPage();
  assert.equal(fixture.ui.isUnlikeText('Unlike (1)'), true);
  assert.equal(fixture.ui.isUnlikeText('Unlike 5'), true);
  assert.equal(fixture.ui.isUnlikeText('إلغاء الإعجاب'), true);
  assert.equal(fixture.ui.isUnlikeText('Unliked content'), false);
});
