/* Run with Node.js 18+: node --test tests/compare.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUsername, parseExport, compareExports } = require('../compare.js');

const makeRecord = (user, shape = 'value') => {
  if (shape === 'title') return { title: user, string_list_data: [] };
  if (shape === 'href') return { string_list_data: [{ href: 'https://www.instagram.com/' + user + '/' }] };
  return { title: '', media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/' + user + '/', value: user, timestamp: 1 }] };
};

test('normalizes usernames, handles case, links, and rejects unrelated URLs', () => {
  assert.equal(normalizeUsername('@Some.User'), 'some.user');
  assert.equal(normalizeUsername('https://www.instagram.com/Foo/'), 'foo');
  assert.equal(normalizeUsername('https://evil.example/Foo'), '');
  assert.equal(normalizeUsername('https://www.instagram.com/p/'), '');
  assert.equal(normalizeUsername('a'.repeat(31)), '');
});

test('compares mixed official follower arrays and following object', () => {
  const followers = [makeRecord('Alice'), makeRecord('BOB', 'href')];
  const following = { relationships_following: [
    makeRecord('alice', 'title'), makeRecord('Bob'),
    makeRecord('Charles'), makeRecord('CHARLES'), makeRecord('Delta', 'title')
  ] };
  const compared = compareExports([followers], [following]);
  assert.equal(compared.followerCount, 2);
  assert.equal(compared.followingCount, 4);
  assert.equal(compared.mutualCount, 2);
  assert.deepEqual(compared.notFollowingBack, ['charles', 'delta']);
});

test('merges multiple followers_N pages without incorrectly flagging later pages', () => {
  const followers1 = [makeRecord('alice')];
  const followers2 = [makeRecord('bobby')];
  const following = { relationships_following: [
    makeRecord('alice'), makeRecord('bobby'), makeRecord('chris')
  ] };
  const output = compareExports([followers1, followers2], [following]);
  assert.deepEqual(output.notFollowingBack, ['chris']);
});

test('parses alternate wrapped followers JSON', () => {
  assert.deepEqual([...parseExport({ relationships_followers: [makeRecord('foo')] }, 'followers')], ['foo']);
  assert.deepEqual([...parseExport({ followers: [makeRecord('bar')] }, 'followers')], ['bar']);
});

test('rejects wrong files rather than inventing nonfollowers', () => {
  assert.throws(() => compareExports([{ relationships_following: [makeRecord('a')] }], [
    { relationships_following: [makeRecord('b')] }
  ]), /recognizable Instagram followers/);
  assert.throws(() => parseExport([{ nonsense: 1 }, { nonsense: 2 }, makeRecord('yes')], 'followers'),
    /Too many/);
  assert.throws(() => compareExports([], []), /Choose at least one/);
});
