#!/usr/bin/env node

const { loadEnv } = require('../src/utils/env');

loadEnv();

const requiredEnv = ['OMDB_API_KEY'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.warn(
    `⚠️  Missing optional environment variable(s): ${missing.join(', ')}.\n` +
      'The add-on will still run, but Rotten Tomatoes and Metacritic scores require a valid OMDb API key.'
  );
} else {
  console.log('✅ Environment ready – OMDb API key detected.');
}

console.log('Health check completed.');
