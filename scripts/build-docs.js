#!/usr/bin/env node
'use strict';
const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
mkdirSync(join(root, 'docs'), { recursive: true });
copyFileSync(join(root, 'dist', 'tak.js'), join(root, 'docs', 'tak.js'));
console.log('docs/tak.js updated');
