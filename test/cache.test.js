/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2018, Joyent, Inc.
 */

/* Test the Metric Agent cache */
'use strict';

var test = require('tape').test;

var mod_bunyan = require('bunyan');

var lib_cache = require('../lib/cache');

var TEST_TTL_SECONDS = 10;
var ENOTFOUND = 'ENOTFOUND';
var STR_NOT_FOUND = 'Not found';

var log = mod_bunyan.createLogger(
    {
        name: 'cache_test',
        level: process.env['LOG_LEVEL'] || 'error',
        stream: process.stderr
    });

test('create cache', function _test(t) {
    var cache = new lib_cache({ log: log });

    t.plan(6);

    t.ok(cache, 'is not undefined');
    t.equal(typeof (cache), 'object', 'is object');
    t.ok(cache._items, 'has items object');
    t.equal(Object.keys(cache._items).length, 0, 'no items');
    t.equal(Object.keys(cache._recentlyUsedKeys).length, 0,
        'no recentlyUsedKeys');
    t.equal(cache._log, log, 'log is equal to opts log value');

    t.end();
});

test('create cache fails with bad or no opts', function _test(t) {
    var missing_opts = 'opts must be defined';
    var missing_log = 'log must be defined';
    var c;

    t.plan(3);

    t.throws(function _mo() { c = new lib_cache(); }, missing_opts);
    t.throws(function _ml() { c = new lib_cache({ log: 1 }); }, missing_log);
    t.notOk(c, 'cache was not created');

    t.end();
});

test('insert item', function _test(t) {
    t.plan(1);

    var cache = new lib_cache({ log: log });
    t.doesNotThrow(function _testInsert() {
        cache.insert('key', { foo: 'bar' }, TEST_TTL_SECONDS);
    });

    t.end();
});

test('insert item fails with bad input', function _test(t) {
    var cache = new lib_cache({ log: log });

    t.plan(5);

    t.throws(function _badKey() {
        var key = 1;
        var value = 1;
        var TTL_SECONDS = 1;
        cache.insert(key, value, TTL_SECONDS);
    }, 'key');

    t.throws(function _missingValue() {
        var key = '1';
        var value;
        var TTL_SECONDS = 1;
        cache.insert(key, value, TTL_SECONDS);
    }, 'value');

    t.throws(function _strTTL() {
        var key = 1;
        var value = 1;
        var TTL_SECONDS = '1';
        cache.insert(key, value, TTL_SECONDS);
    }, 'TTL must be a number');

    t.throws(function _nonIntTTL() {
        var key = 1;
        var value = 1;
        var TTL_SECONDS = 1.1;
        cache.insert(key, value, TTL_SECONDS);
    }, 'TTL must be an integer');

    t.throws(function _negTTL() {
        var key = 1;
        var value = 1;
        var TTL_SECONDS = -1;
        cache.insert(key, value, TTL_SECONDS);
    }, 'TTL must be postive');

    t.end();
});

test('get item', function _test(t) {
    var cache = new lib_cache({ log: log });
    var cache_item = { foo: 'sball' };

    t.plan(2);

    cache.insert('key', cache_item, TEST_TTL_SECONDS);
    cache.get('key', function _get(err, item) {
        t.error(err, 'no error');
        t.deepEqual(item, cache_item, 'cached item equals input item');

        t.end();
    });
});

test('get item bad key', function _test(t) {
    var cache = new lib_cache({ log: log });

    t.plan(1);

    t.throws(function _badKey() {
        cache.get(7, function _get() {});
    }, 'key');

    t.end();
});

test('item expires from cache', function _test(t) {
    var cache = new lib_cache({ log: log });
    var cache_item = { foo: 'd' };
    var TTL_SECONDS = 1; /* Is converted to milliseconds internally */
    var wait_period = (TTL_SECONDS * 1000) * 2; /* wait longer than TTL */
    var key = 'asdf';

    t.plan(4);

    cache.insert(key, cache_item, TTL_SECONDS);
    setTimeout(function _wait() {
        cache.get(key, function _get(err, item) {
            t.ok(err, 'should be an error fetching expired key/value');
            t.equal(STR_NOT_FOUND, err.message, 'correct error message');
            t.equal(ENOTFOUND, err.code, 'correct error code');
            t.notOk(item, 'item should not be set');

            t.end();
        });
    }, wait_period);
});

test('remove existing key/value from cache', function _test(t) {
    var cache = new lib_cache({ log: log });
    var cache_item = { foo: 'z' };
    var TTL_SECONDS = 1;
    var key = 'qwerty';

    t.plan(6);

    cache.insert(key, cache_item, TTL_SECONDS);
    cache.remove(key, function _rm(err, result) {
        t.notOk(err, 'err should not be set');
        t.ok(result, 'result should be true');

        cache.get(key, function _get(gerr, item) {
            t.ok(gerr, 'should be an error fetching expired key/value');
            t.equal(STR_NOT_FOUND, gerr.message, 'correct error message');
            t.equal(ENOTFOUND, gerr.code, 'correct error code');
            t.notOk(item, 'item should not be set');

            t.end();
        });
    });
});


test('remove non-existent key/value from cache', function _test(t) {
    var cache = new lib_cache({ log: log });
    var cache_item = { foo: 'zball' };
    var TTL_SECONDS = 1;
    var key = 'zxcv';
    var bad_key = 'lkjh';

    t.plan(4);

    cache.insert(key, cache_item, TTL_SECONDS);
    cache.remove(bad_key, function _rm(err, result) {
        t.ok(err, 'err should be set');
        t.equal(STR_NOT_FOUND, err.message, 'correct error message');
        t.equal(ENOTFOUND, err.code, 'correct error code');
        t.notOk(result, 'result should not be set');

        t.end();
    });
});

test('remove invalid key type', function _test(t) {
    var bad_key = 1;
    var cache = new lib_cache({ log: log });
    var result, error;

    t.plan(3);

    t.throws(function _intKey() {
        cache.remove(bad_key, function _rm(err, res) {
            result = res;
            error = err;
        });
    }, 'key');

    t.notOk(result, 'result should not be set');
    t.notOk(error, 'error should not be set');

    t.end();
});

test('multiple inserts result in 1 recentlyUsedKeys entry', function _test(t) {
    t.plan(3);

    var cache = new lib_cache({ log: log });
    var idx;
    var ttlString = (TEST_TTL_SECONDS * 1000).toString();

    t.doesNotThrow(function _testInsert() {
        for (idx = 0; idx < 10; idx++) {
            cache.insert('dummy', { value: idx }, TEST_TTL_SECONDS);
        }
    });
    t.deepEqual(cache._recentlyUsedKeys[ttlString].length, 1,
        'should only have last insert in recentlyUsedKeys');
    t.equal(cache._recentlyUsedKeys[ttlString][0], 'dummy',
        'should only have dummy');

    t.end();
});

test('sweep removes stale entries', function _test(t) {
    t.plan(8);

    var cache = new lib_cache({ log: log });
    var start = Date.now();

    t.doesNotThrow(function _testInsert() {
        /* Insert an entry that expires at 10 seconds past start */
        cache.insert('expireIn10a', { foo: 'bar' }, 10, { now: start });
        /* Insert an entry that expires at 10 seconds past start + 2s */
        cache.insert('expireIn10b', { foo: 'bar' }, 10,
            { now: start + 2000 });
        /* Insert an entry that expires at 10 seconds past start + 5s */
        cache.insert('expireIn10c', { foo: 'bar' }, 10,
            { now: start + 5000 });
    });

    /*
     * At this point the 10000 bucket should have 3 cache entries:
     *
     *     one that expires at start +10s
     *     one that expires at start +12s
     *     one that expires at start +15s
     *
     * we'll now simulate a sweep happening at start +13s. That should remove
     * the first two entries and leave only the last.
     *
     */

    t.equal(cache._recentlyUsedKeys['10000'].length, 3,
        'should have all 3 keys in _recentlyUsedKeys');
    t.equal(Object.keys(cache._items).length, 3,
        'should have all 3 keys in _items');

    t.doesNotThrow(function _testSweep() {
        cache._sweep({ now: start + 13000 });
    });

    t.equal(cache._recentlyUsedKeys['10000'].length, 1,
        'should have 1 key in _recentlyUsedKeys');
    t.equal(Object.keys(cache._items).length, 1,
        'should have 1 key in _items');
    t.equal(cache._recentlyUsedKeys['10000'][0], 'expireIn10c',
        'non-expired entry should remain in _recentlyUsedKeys["10000"]');
    t.equal(Object.keys(cache._items)[0], 'expireIn10c',
        'non-expired entry should remain in _items');

    t.end();
});
