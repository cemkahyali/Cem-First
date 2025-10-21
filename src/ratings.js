const { URLSearchParams } = require('url');

const OMDB_API_KEY = process.env.OMDB_API_KEY;
const OMDB_BASE_URL = 'https://www.omdbapi.com/';

if (typeof fetch !== 'function') {
  throw new Error('Global fetch API is not available. Please use Node.js 18 or newer.');
}

const ratingCache = new Map();

const BADGE_PALETTE = {
  imdb: '#f5c518',
  rottenTomatoes: '#fa320a',
  metacritic: '#2c3e50',
};

function parseYear(releaseInfo) {
  if (!releaseInfo) return undefined;
  const match = `${releaseInfo}`.match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : undefined;
}

function normaliseNumber(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const normalised = value.trim();
    if (!normalised || normalised === 'N/A') return undefined;
    const parsed = Number.parseFloat(normalised);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function extractOmdbRatings(payload) {
  if (!payload) return undefined;
  const imdbRating = normaliseNumber(payload.imdbRating);
  let rottenTomatoes;
  if (Array.isArray(payload.Ratings)) {
    const entry = payload.Ratings.find((rating) => rating.Source === 'Rotten Tomatoes');
    if (entry && entry.Value) {
      const value = entry.Value.replace('%', '');
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) rottenTomatoes = parsed;
    }
  }
  const metacritic = normaliseNumber(payload.Metascore);
  return {
    imdb: imdbRating,
    rottenTomatoes,
    metacritic,
  };
}

function createBadge(label, key, value) {
  const displayValue = formatBadgeValue(key, value);
  const text = displayValue ? `${label} ${displayValue}` : `${label} N/A`;
  return {
    key,
    text,
    color: BADGE_PALETTE[key] || '#1c1c1c',
    textColor: '#ffffff',
    backgroundColor: BADGE_PALETTE[key] || '#1c1c1c',
    available: Boolean(displayValue),
    rawValue: value ?? null,
  };
}

function formatBadgeValue(key, value) {
  if (value === undefined || value === null) return undefined;
  if (key === 'imdb') {
    return Number.isFinite(value) ? value.toFixed(1) : undefined;
  }
  if (key === 'rottenTomatoes') {
    return Number.isFinite(value) ? `${value}%` : undefined;
  }
  if (key === 'metacritic') {
    return Number.isFinite(value) ? `${value}` : undefined;
  }
  return `${value}`;
}

function getCacheKey({ imdbId, title, year }) {
  if (imdbId) return `imdb:${imdbId}`;
  if (title) return `title:${title.toLowerCase()}-${year || 'unknown'}`;
  return undefined;
}

async function fetchOmdbPayload({ imdbId, title, year, type }) {
  if (!OMDB_API_KEY) return undefined;
  const cacheKey = getCacheKey({ imdbId, title, year });
  if (cacheKey && ratingCache.has(cacheKey)) {
    return ratingCache.get(cacheKey);
  }
  const params = new URLSearchParams({ apikey: OMDB_API_KEY });
  if (imdbId) {
    params.set('i', imdbId);
  } else if (title) {
    params.set('t', title);
    if (year) params.set('y', year);
  } else {
    return undefined;
  }
  if (type) {
    params.set('type', type === 'series' ? 'series' : 'movie');
  }
  const url = `${OMDB_BASE_URL}?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OMDb responded with status ${response.status}`);
    }
    const data = await response.json();
    if (data.Response === 'False') {
      if (cacheKey) ratingCache.set(cacheKey, undefined);
      return undefined;
    }
    const ratings = extractOmdbRatings(data);
    if (cacheKey) ratingCache.set(cacheKey, ratings);
    return ratings;
  } catch (error) {
    console.warn(`Failed to load ratings from OMDb: ${error.message}`);
    if (cacheKey) ratingCache.set(cacheKey, undefined);
    return undefined;
  }
}

async function getRatingBadges(meta) {
  const imdbId = meta.imdb_id || meta.imdbId || (meta.id && meta.id.startsWith('tt') ? meta.id : undefined);
  const year = meta.year || parseYear(meta.releaseInfo);
  const title = meta.name || meta.originalTitle;

  const omdbRatings = await fetchOmdbPayload({ imdbId, title, year, type: meta.type });

  const fallbackImdb = normaliseNumber(meta.imdbRating);

  const values = {
    imdb: omdbRatings && omdbRatings.imdb !== undefined ? omdbRatings.imdb : fallbackImdb,
    rottenTomatoes: omdbRatings ? omdbRatings.rottenTomatoes : undefined,
    metacritic: omdbRatings ? omdbRatings.metacritic : undefined,
  };

  const badges = [
    createBadge('IMDb', 'imdb', values.imdb),
    createBadge('RT', 'rottenTomatoes', values.rottenTomatoes),
    createBadge('MC', 'metacritic', values.metacritic),
  ];

  return {
    badges,
    values,
  };
}

module.exports = {
  getRatingBadges,
};
