const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer, stopServer, setFetchImplementation, clearRatingsCache } = require('../src/index.js');

function createJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(JSON.stringify(body)),
    text: async () => JSON.stringify(body)
  };
}

test('catalog endpoint enriches posters with fallback ratings when OMDb key is missing', async () => {
  const fetchStub = async (input) => {
    const url = typeof input === 'string' ? input : input.url || input.toString();
    if (url.includes('/catalog/movie/top')) {
      return createJsonResponse({
        metas: [
          {
            id: 'tt1375666',
            type: 'movie',
            name: 'Inception',
            poster: 'https://example.org/poster.jpg',
            description: 'Dream heist thriller'
          }
        ],
        cacheMaxAge: 3600
      });
    }

    throw new Error(`Beklenmeyen fetch isteği: ${url}`);
  };

  setFetchImplementation(fetchStub);
  clearRatingsCache();

  let runningServer;
  try {
    runningServer = await startServer({ port: 0, silent: true, omdbApiKey: '' });
    const address = runningServer.address();
    const baseUrl = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : 'http://127.0.0.1:7000';

    const response = await globalThis.fetch(`${baseUrl}/catalog/movie/top.json`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(Array.isArray(payload.metas));
    assert.equal(payload.metas.length, 1);

    const meta = payload.metas[0];
    assert.equal(meta.id, 'tt1375666');
    assert.ok(meta.poster.startsWith('data:image/svg+xml;base64,'));
    assert.ok(meta.extra);
    assert.deepEqual(meta.extra.ratings, {
      imdb: '8.8',
      rottenTomatoes: '87%',
      metacritic: '74/100'
    });
    assert.ok(meta.behaviorHints);
    assert.deepEqual(meta.behaviorHints.overlayRatings, {
      imdb: '8.8',
      rottenTomatoes: '87%',
      metacritic: '74/100'
    });
    assert.match(
      meta.description,
      /Ratings · IMDb 8\.8 · Rotten Tomatoes 87% · Metacritic 74\/100/
    );
  } finally {
    await stopServer();
    setFetchImplementation(null);
    clearRatingsCache();
  }
});

test('meta endpoint falls back to bundled metadata when Cinemeta is unavailable', async () => {
  const failingFetch = async () => {
    throw new Error('Cinemeta erişilemiyor');
  };

  setFetchImplementation(failingFetch);
  clearRatingsCache();

  let runningServer;
  try {
    runningServer = await startServer({ port: 0, silent: true, omdbApiKey: '' });
    const address = runningServer.address();
    const baseUrl = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : 'http://127.0.0.1:7000';

    const response = await globalThis.fetch(`${baseUrl}/meta/movie/tt1375666.json`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(payload.meta);
    assert.equal(payload.meta.id, 'tt1375666');
    assert.ok(payload.meta.poster.startsWith('data:image/svg+xml;base64,'));
    assert.deepEqual(payload.meta.extra.ratings, {
      imdb: '8.8',
      rottenTomatoes: '87%',
      metacritic: '74/100'
    });
    assert.match(
      payload.meta.description,
      /Ratings · IMDb 8\.8 · Rotten Tomatoes 87% · Metacritic 74\/100/
    );
    assert.equal(payload.cacheMaxAge, 86400);
  } finally {
    await stopServer();
    setFetchImplementation(null);
    clearRatingsCache();
  }
});
