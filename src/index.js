const { loadEnv } = require('./utils/env');

loadEnv();

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { fetchCatalog, fetchMeta } = require('./cinemeta');
const { getRatingBadges } = require('./ratings');

const manifest = {
  id: 'org.cem.poster-ratings',
  version: '1.0.0',
  name: 'Poster Ratings Overlay',
  description: 'Shows IMDb, Rotten Tomatoes, and Metacritic scores on top of every poster.',
  logo: 'https://res.cloudinary.com/stremio/image/upload/v1523456789/addon-ratings.png',
  resources: ['catalog', 'meta'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [
    {
      type: 'movie',
      id: 'top',
      name: 'Top Movies',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'genre', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
      extraSupported: ['search', 'genre', 'skip'],
    },
    {
      type: 'series',
      id: 'top',
      name: 'Top Series',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'genre', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
      extraSupported: ['search', 'genre', 'skip'],
    },
  ],
  behaviorHints: {
    configurable: true,
  },
};

const builder = new addonBuilder(manifest);

async function enrichMeta(originalMeta) {
  const meta = {
    ...originalMeta,
    behaviorHints: {
      ...(originalMeta.behaviorHints || {}),
    },
  };

  try {
    const ratingInfo = await getRatingBadges(meta);
    if (ratingInfo) {
      meta.behaviorHints.badges = ratingInfo.badges;
      meta.behaviorHints.badgesLabel = 'Ratings';

      meta.ratings = {
        ...(meta.ratings || {}),
        imdb: ratingInfo.values.imdb ?? null,
        rottenTomatoes: ratingInfo.values.rottenTomatoes ?? null,
        metacritic: ratingInfo.values.metacritic ?? null,
      };

      const summary = ratingInfo.badges.map((badge) => badge.text).join(' | ');
      if (summary) {
        meta.description = meta.description
          ? `${meta.description}\n\nRatings: ${summary}`
          : `Ratings: ${summary}`;
        meta.ratingSummary = summary;
      }
    }
  } catch (error) {
    console.warn(`Failed to enrich metadata for ${meta.id}: ${error.message}`);
  }

  return meta;
}

builder.defineCatalogHandler(async ({ type, id, extra = {} }) => {
  try {
    const response = await fetchCatalog(type, id, extra);
    const metas = Array.isArray(response.metas) ? response.metas : [];
    const enriched = await Promise.all(metas.map((meta) => enrichMeta(meta)));
    return { metas: enriched };
  } catch (error) {
    console.error(`Catalog handler error for ${type}/${id}:`, error.message);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ type, id }) => {
  try {
    const response = await fetchMeta(type, id);
    if (!response || !response.meta) {
      return { meta: null };
    }
    const enriched = await enrichMeta(response.meta);
    return { meta: enriched };
  } catch (error) {
    console.error(`Meta handler error for ${type}/${id}:`, error.message);
    return { meta: null };
  }
});

const addonInterface = builder.getInterface();
const port = Number.parseInt(process.env.PORT, 10) || 7000;

serveHTTP(addonInterface, { port });

console.log(`Poster Ratings Overlay add-on running on http://localhost:${port}/manifest.json`);
