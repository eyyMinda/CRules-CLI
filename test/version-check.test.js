'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compareSemverGreater } = require('../lib/version-check.js');

test('compareSemverGreater', () => {
  assert.equal(compareSemverGreater('1.2.0', '1.1.9'), true);
  assert.equal(compareSemverGreater('1.1.9', '1.2.0'), false);
  assert.equal(compareSemverGreater('1.0.0', '1.0.0'), false);
  assert.equal(compareSemverGreater('2.0.0', '1.99.99'), true);
});
