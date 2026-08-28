'use strict';

const { toNetlify } = require('./_adapter');

exports.handler = toNetlify(require('../../api/stats'));
