'use strict';
const assert = require('node:assert/strict');
const { assess } = require('../../freshness.js');

const now = Date.parse('2026-10-02T19:00:00Z');
const currentPartial = {
  refresh_summary: {
    at: '2026-10-02T18:00:00Z',
    total: 30,
    successful: 28,
    failed: ['blocked-a','blocked-b'],
    complete: true
  }
};
assert.equal(assess(currentPartial, {}, now).fresh, true, 'A complete current snapshot stays fresh when individual sources are blocked');
assert.match(assess(currentPartial, {}, now).reason, /28 \/ 30/);

const stale = {
  refresh_summary: {
    at: '2026-10-01T10:00:00Z',
    total: 30,
    successful: 30,
    failed: [],
    complete: true
  }
};
assert.equal(assess(stale, {}, now).fresh, false, 'Old snapshots must be stale');
assert.equal(assess(currentPartial, {last_error:'collector failed'}, now).fresh, false, 'A failed latest refresh must be stale');
assert.equal(assess(currentPartial, {running:true}, now).fresh, false, 'An in-progress refresh is not yet fresh');
console.log('freshness tests passed');
