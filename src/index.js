const http = require('http');
const { URL } = require('url');

const DEFAULT_PORT = parseInt(process.env.PORT || '7000', 10);
let currentOmdbApiKey = process.env.OMDB_API_KEY || '';

let fetchImplementation =
  typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;

const ratingsCache = new Map();

const manifestCatalogs = [
  { type: 'movie', id: 'top', name: 'Enriched · Popüler Filmler' },
  { type: 'series', id: 'top', name: 'Enriched · Popüler Diziler' }
];

const manifestBackground = createManifestBackground();

function isTruthyEnv(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getManifest() {
  return {
    id: 'com.cem.poster-ratings',
    version: '1.0.0',
    name: 'Poster Ratings Overlay',
    description:
      'IMDb, Rotten Tomatoes ve Metacritic puanlarını afişlerin üstüne bindirerek gösteren deneysel Stremio eklentisi.',
    resources: ['catalog', 'meta'],
    types: ['movie', 'series'],
    catalogs: manifestCatalogs.map((catalog) => ({ ...catalog })),
    idPrefixes: ['tt'],
    behaviorHints: {
      configurable: true,
      configurationRequired: !hasOmdbApiKey()
    },
    contactEmail: 'addons@example.com',
    background: manifestBackground
  };
}

const manifest = getManifest();

const fallbackMetaStore = {
  'movie:tt1375666': {
    id: 'tt1375666',
    type: 'movie',
    name: 'Inception',
    imdb_id: 'tt1375666',
    year: 2010,
    poster:
      'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxMF5BMl5BanBnXkFtZTcwODI5OTM0Mw@@._V1_.jpg',
    background: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    genres: ['Bilim Kurgu', 'Aksiyon', 'Gerilim'],
    description:
      'Rüya paylaşımı teknolojisi ile bilinçaltına sızan Dom Cobb, büyük bir soygun fırsatı karşılığında hatalarını telafi etmeye çalışır.',
    runtime: 8880,
    releaseInfo: '2010',
    fallbackRatings: {
      imdb: '8.8',
      rottenTomatoes: '87%',
      metacritic: '74/100'
    }
  },
  'movie:tt0816692': {
    id: 'tt0816692',
    type: 'movie',
    name: 'Interstellar',
    imdb_id: 'tt0816692',
    year: 2014,
    poster:
      'https://m.media-amazon.com/images/M/MV5BMjIxMjgxNzM1MV5BMl5BanBnXkFtZTgwNjUxNzE3MjE@._V1_.jpg',
    background: 'https://image.tmdb.org/t/p/original/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg',
    genres: ['Bilim Kurgu', 'Macera', 'Dram'],
    description:
      'İklim krizi insanlığı yok oluşa sürüklerken cesur astronotlar yeni bir yuva bulmak için solucan deliğinden geçer.',
    runtime: 10140,
    releaseInfo: '2014',
    fallbackRatings: {
      imdb: '8.6',
      rottenTomatoes: '73%',
      metacritic: '74/100'
    }
  },
  'series:tt0903747': {
    id: 'tt0903747',
    type: 'series',
    name: 'Breaking Bad',
    imdb_id: 'tt0903747',
    year: 2008,
    poster: 'https://m.media-amazon.com/images/M/MV5BMTEzOTk3NTI2MjdeQTJeQWpwZ15BbWU3MDAwODAwNTc@._V1_.jpg',
    background: 'https://image.tmdb.org/t/p/original/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    genres: ['Suç', 'Dram', 'Gerilim'],
    description:
      'Lise kimya öğretmeni Walter White, ailesini güvence altına almak için eski öğrencisi Jesse Pinkman ile metamfetamin üretmeye başlar.',
    episodes: [],
    releaseInfo: '2008',
    fallbackRatings: {
      imdb: '9.5',
      rottenTomatoes: '96%',
      metacritic: '87/100'
    }
  },
  'series:tt4574334': {
    id: 'tt4574334',
    type: 'series',
    name: 'Stranger Things',
    imdb_id: 'tt4574334',
    year: 2016,
    poster: 'https://m.media-amazon.com/images/M/MV5BMTk2OTQ1NzYxNF5BMl5BanBnXkFtZTgwNzYxMzY3NjE@._V1_.jpg',
    background: 'https://image.tmdb.org/t/p/original/bQLrHIRNEkE3PdIWQrZHynQZazu.jpg',
    genres: ['Bilim Kurgu', 'Korku', 'Gizem'],
    description:
      '1980’ler Indiana’sında kaybolan bir çocuk, karanlık laboratuvar deneyleri ve gizemli güçleri olan bir kızla bağlantılıdır.',
    episodes: [],
    releaseInfo: '2016',
    fallbackRatings: {
      imdb: '8.7',
      rottenTomatoes: '97%',
      metacritic: '76/100'
    }
  }
};

const fallbackCatalogDefinitions = {
  movie: {
    top: {
      name: 'Enriched · Popüler Filmler (Örnek)',
      items: ['movie:tt1375666', 'movie:tt0816692']
    }
  },
  series: {
    top: {
      name: 'Enriched · Popüler Diziler (Örnek)',
      items: ['series:tt0903747', 'series:tt4574334']
    }
  }
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    return respondError(res, 400, 'Geçersiz istek');
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const segments = requestUrl.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return respondJSON(res, getManifest());
  }

  // remove .json suffix from last segment if present
  const lastIndex = segments.length - 1;
  segments[lastIndex] = segments[lastIndex].replace(/\.json$/i, '');

  try {
    switch (segments[0]) {
      case 'manifest':
        return respondJSON(res, getManifest());
      case 'catalog':
        return await handleCatalogRequest(res, segments, requestUrl.searchParams);
      case 'meta':
        return await handleMetaRequest(res, segments);
      default:
        return respondError(res, 404, 'Kaynak bulunamadı');
    }
  } catch (err) {
    console.error(err);
    return respondError(res, 500, 'Beklenmeyen sunucu hatası');
  }
});

async function handleCatalogRequest(res, segments, searchParams) {
  if (segments.length < 3) {
    return respondError(res, 400, 'Eksik katalog parametreleri');
  }

  const type = segments[1];
  const id = segments[2];
  const extraSegments = segments.slice(3);
  const extraFromPath = parseExtraSegments(extraSegments);
  const extraFromQuery = Object.fromEntries(searchParams.entries());
  const extra = { ...extraFromPath, ...extraFromQuery };

  const catalogData = await fetchCinemetaCatalog(type, id, extra);
  const metas = Array.isArray(catalogData?.metas) ? catalogData.metas : [];
  const enrichedMetas = await mapWithConcurrency(
    metas,
    4,
    async (meta) => await enrichMeta(meta, type)
  );

  const response = {
    metas: enrichedMetas,
    cacheMaxAge: catalogData?.cacheMaxAge || 86400
  };

  if (catalogData?.poster) {
    response.poster = catalogData.poster;
  }
  if (catalogData?.name) {
    response.name = catalogData.name;
  }

  return respondJSON(res, response);
}

async function handleMetaRequest(res, segments) {
  if (segments.length < 3) {
    return respondError(res, 400, 'Eksik meta parametreleri');
  }

  const type = segments[1];
  const id = segments[2];
  const metaData = await fetchCinemetaMeta(type, id);
  if (!metaData || !metaData.meta) {
    return respondError(res, 404, 'İçerik bulunamadı');
  }

  const enrichedMeta = await enrichMeta(metaData.meta, type);
  return respondJSON(res, { meta: enrichedMeta, cacheMaxAge: metaData.cacheMaxAge || 86400 });
}

async function fetchCinemetaCatalog(type, id, extra) {
  const url = new URL(`https://v3-cinemeta.strem.io/catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`);

  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      url.searchParams.set(key, `${value}`);
    }
  });

  try {
    const fetchFn = ensureFetch();
    const response = await fetchFn(url, {
      headers: {
        'User-Agent': 'Poster-Ratings-Overlay/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Cinemeta katalog isteği başarısız oldu: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.warn(`Cinemeta katalog isteği başarısız oldu (${type}/${id}): ${err.message}`);
    return getFallbackCatalog(type, id);
  }
}

async function fetchCinemetaMeta(type, id) {
  const url = new URL(`https://v3-cinemeta.strem.io/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`);

  try {
    const fetchFn = ensureFetch();
    const response = await fetchFn(url, {
      headers: {
        'User-Agent': 'Poster-Ratings-Overlay/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Cinemeta meta isteği başarısız oldu: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.warn(`Cinemeta meta isteği başarısız oldu (${type}/${id}): ${err.message}`);
    return getFallbackMeta(type, id);
  }
}

async function enrichMeta(meta, type) {
  const imdbId = extractImdbId(meta);
  const fallbackKey = type && imdbId ? `${type}:${imdbId}` : type && meta?.id ? `${type}:${meta.id}` : null;
  const fallbackMeta = fallbackKey ? fallbackMetaStore[fallbackKey] : null;
  let ratings = null;

  if (imdbId && hasOmdbApiKey()) {
    ratings = await getRatings(imdbId);
  }

  let sanitizedRatings = normalizeRatings(ratings);
  if (!sanitizedRatings && fallbackMeta?.fallbackRatings) {
    sanitizedRatings = normalizeRatings(fallbackMeta.fallbackRatings);
  }
  const summary = sanitizedRatings ? createRatingSummary(sanitizedRatings) : null;
  const basePoster = meta.poster || meta.background || null;
  let decoratedPoster = basePoster;

  if (basePoster && sanitizedRatings) {
    const svgPoster = createPosterOverlaySvg(basePoster, sanitizedRatings);
    if (svgPoster) {
      decoratedPoster = svgPoster;
    }
  }

  const enriched = { ...meta };

  if (decoratedPoster) {
    enriched.poster = decoratedPoster;
  }

  if (sanitizedRatings) {
    enriched.extra = {
      ...(meta.extra || {}),
      ratings: sanitizedRatings
    };
    enriched.behaviorHints = {
      ...(meta.behaviorHints || {}),
      overlayRatings: sanitizedRatings,
      ratingSummary: summary
    };

    if (summary) {
      const extendedDescription = appendSummaryToDescription(meta.description, summary);
      if (extendedDescription) {
        enriched.description = extendedDescription;
      }
    }
  }

  return enriched;
}

function createPosterOverlaySvg(posterUrl, ratings) {
  if (!posterUrl) {
    return null;
  }

  const width = 1000;
  const height = 1500;
  const overlayHeight = 280;
  const badges = buildRatingBadges(ratings, width);

  const escapedPoster = escapeForAttribute(posterUrl);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="overlayGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.85)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.35)" />
    </linearGradient>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="rgba(0,0,0,0.45)" />
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#101010" />
  <image href="${escapedPoster}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${width}" height="${overlayHeight}" fill="url(#overlayGradient)" />
  <g font-family="'Segoe UI', 'Inter', sans-serif" font-size="48">
    ${badges}
  </g>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function buildRatingBadges(ratings, posterWidth) {
  const items = [];

  if (ratings.imdb) {
    items.push({
      label: 'IMDb',
      value: `${ratings.imdb}`,
      subtitle: ' /10',
      accent: '#f5c518'
    });
  }
  if (ratings.rottenTomatoes) {
    items.push({
      label: 'Rotten Tomatoes',
      value: ratings.rottenTomatoes,
      subtitle: '',
      accent: '#fa320a'
    });
  }
  if (ratings.metacritic) {
    items.push({
      label: 'Metacritic',
      value: ratings.metacritic,
      subtitle: '',
      accent: '#63c74d'
    });
  }

  if (!items.length) {
    return '';
  }

  const badgeWidth = Math.min(280, Math.max(220, Math.floor(posterWidth / (items.length * 1.6))));
  const badgeHeight = 180;
  const gap = 36;
  const totalWidth = items.length * badgeWidth + (items.length - 1) * gap;
  const startX = Math.max(40, Math.floor((posterWidth - totalWidth) / 2));

  return items
    .map((item, index) => {
      const x = startX + index * (badgeWidth + gap);
      const labelY = 95;
      const valueY = 150;
      const sanitizedLabel = escapeForText(item.label);
      const sanitizedValue = escapeForText(item.value);
      const sanitizedSubtitle = escapeForText(item.subtitle || '');

      return `
      <g transform="translate(${x}, 50)" filter="url(#badgeShadow)">
        <rect width="${badgeWidth}" height="${badgeHeight}" rx="28" ry="28" fill="rgba(18,18,22,0.92)" stroke="${item.accent}" stroke-width="4" />
        <text x="${badgeWidth / 2}" y="${labelY}" fill="#f8f8f8" font-size="48" font-weight="600" text-anchor="middle">${sanitizedLabel}</text>
        <text x="${badgeWidth / 2}" y="${valueY}" fill="${item.accent}" font-size="60" font-weight="700" text-anchor="middle">${sanitizedValue}<tspan fill="#c8c8c8" font-size="38">${sanitizedSubtitle}</tspan></text>
      </g>`;
    })
    .join('\n');
}

function appendSummaryToDescription(original, summary) {
  const trimmed = typeof original === 'string' ? original.trim() : '';
  if (!trimmed) {
    return summary;
  }
  if (trimmed.includes(summary)) {
    return trimmed;
  }
  return `${trimmed}\n\n${summary}`;
}

function normalizeRatings(ratings) {
  if (!ratings) {
    return null;
  }

  const normalized = {};

  if (ratings.imdb && ratings.imdb !== 'N/A') {
    normalized.imdb = formatImdbScore(ratings.imdb);
  }
  if (ratings.rottenTomatoes && ratings.rottenTomatoes !== 'N/A') {
    normalized.rottenTomatoes = formatPercentScore(ratings.rottenTomatoes);
  }
  if (ratings.metacritic && ratings.metacritic !== 'N/A') {
    normalized.metacritic = formatMetacriticScore(ratings.metacritic);
  }

  return Object.keys(normalized).length ? normalized : null;
}

function createRatingSummary(ratings) {
  const parts = [];
  if (ratings.imdb) {
    parts.push(`IMDb ${ratings.imdb}`);
  }
  if (ratings.rottenTomatoes) {
    parts.push(`Rotten Tomatoes ${ratings.rottenTomatoes}`);
  }
  if (ratings.metacritic) {
    parts.push(`Metacritic ${ratings.metacritic}`);
  }

  return parts.length ? `Ratings · ${parts.join(' · ')}` : null;
}

function extractImdbId(meta) {
  const candidates = [meta.imdb_id, meta.imdbId, meta.id];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^tt\d+$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function getRatings(imdbId) {
  if (!hasOmdbApiKey()) {
    return null;
  }

  if (ratingsCache.has(imdbId)) {
    return ratingsCache.get(imdbId);
  }

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('i', imdbId);
  url.searchParams.set('apikey', getOmdbApiKey());

  try {
    const fetchFn = ensureFetch();
    const response = await fetchFn(url, {
      headers: {
        'User-Agent': 'Poster-Ratings-Overlay/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`OMDb isteği başarısız oldu: ${response.status}`);
    }

    const payload = await response.json();
    if (payload.Response === 'False') {
      ratingsCache.set(imdbId, null);
      return null;
    }

    const rottenEntry = Array.isArray(payload.Ratings)
      ? payload.Ratings.find((item) => item.Source === 'Rotten Tomatoes')
      : null;

    const ratings = {
      imdb: payload.imdbRating,
      rottenTomatoes: rottenEntry ? rottenEntry.Value : payload.tomatoMeter,
      metacritic: payload.Metascore
    };

    ratingsCache.set(imdbId, ratings);
    return ratings;
  } catch (err) {
    console.error(`Puanlar alınamadı (${imdbId}):`, err.message);
    ratingsCache.set(imdbId, null);
    return null;
  }
}

function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let current = 0;

  const worker = async () => {
    while (true) {
      const index = current++;
      if (index >= items.length) {
        break;
      }
      try {
        results[index] = await mapper(items[index], index);
      } catch (err) {
        console.error('Öğe zenginleştirilirken hata oluştu:', err.message);
        results[index] = items[index];
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  return Promise.all(workers).then(() => results);
}

function parseExtraSegments(segments) {
  const extra = {};
  for (const segment of segments) {
    if (!segment) continue;
    const [rawKey, ...rest] = segment.split('=');
    if (!rawKey) continue;
    const key = decodeURIComponent(rawKey);
    const value = rest.length ? decodeURIComponent(rest.join('=')) : '';
    extra[key] = value;
  }
  return extra;
}

function respondJSON(res, data, statusCode = 200) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60'
  });
  res.end(payload);
}

function respondError(res, statusCode, message) {
  respondJSON(res, { error: message }, statusCode);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function escapeForAttribute(value) {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeForText(value) {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatImdbScore(value) {
  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric)) {
    return `${numeric.toFixed(1)}`;
  }
  return `${value}`;
}

function formatPercentScore(value) {
  if (typeof value === 'string' && value.endsWith('%')) {
    return value;
  }
  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric)) {
    return `${numeric}%`;
  }
  return `${value}`;
}

function formatMetacriticScore(value) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) {
    return `${numeric}/100`;
  }
  return `${value}`;
}

function createManifestBackground() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1f1b2e" />
        <stop offset="50%" stop-color="#302244" />
        <stop offset="100%" stop-color="#121212" />
      </linearGradient>
    </defs>
    <rect width="1200" height="600" fill="url(#grad)" />
    <text x="50%" y="40%" font-family="'Segoe UI', sans-serif" font-size="90" fill="#f5c518" text-anchor="middle">Poster Ratings Overlay</text>
    <text x="50%" y="58%" font-family="'Segoe UI', sans-serif" font-size="48" fill="#ffffff" text-anchor="middle">IMDb · Rotten Tomatoes · Metacritic</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function getFallbackCatalog(type, id) {
  const catalogDefinition = fallbackCatalogDefinitions?.[type]?.[id];
  if (!catalogDefinition) {
    return { metas: [], cacheMaxAge: 86400 };
  }

  const metas = catalogDefinition.items
    .map((key) => cloneMeta(fallbackMetaStore[key]))
    .filter(Boolean);

  return {
    metas,
    cacheMaxAge: 86400,
    name: catalogDefinition.name
  };
}

function getFallbackMeta(type, id) {
  const key = `${type}:${id}`;
  const meta = fallbackMetaStore[key];
  if (!meta) {
    return { meta: null, cacheMaxAge: 86400 };
  }
  return {
    meta: cloneMeta(meta),
    cacheMaxAge: 86400
  };
}

function cloneMeta(meta) {
  return meta ? JSON.parse(JSON.stringify(meta)) : null;
}

function getOmdbApiKey() {
  return currentOmdbApiKey;
}

function setOmdbApiKey(value) {
  currentOmdbApiKey = value ? `${value}` : '';
}

function hasOmdbApiKey() {
  return getOmdbApiKey().trim().length > 0;
}

function clearRatingsCache() {
  ratingsCache.clear();
}

function ensureFetch() {
  if (!fetchImplementation) {
    throw new Error(
      "Fetch API erişilebilir değil. Node.js 18+ kullanın veya setFetchImplementation() ile özel bir fetch fonksiyonu sağlayın."
    );
  }
  return fetchImplementation;
}

function setFetchImplementation(customFetch) {
  if (customFetch === null) {
    fetchImplementation =
      typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
    return fetchImplementation;
  }

  if (typeof customFetch !== 'function') {
    throw new TypeError('customFetch bir fonksiyon veya null olmalıdır.');
  }

  fetchImplementation = customFetch;
  return fetchImplementation;
}

function startServer(options = {}) {
  const { port = DEFAULT_PORT, silent = false, omdbApiKey } = options;

  if (server.listening) {
    return Promise.resolve(server);
  }

  if (typeof omdbApiKey !== 'undefined') {
    setOmdbApiKey(omdbApiKey);
  } else {
    setOmdbApiKey(process.env.OMDB_API_KEY || '');
  }

  clearRatingsCache();

  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('error', handleError);
      reject(error);
    };

    server.once('error', handleError);
    server.listen(port, () => {
      server.off('error', handleError);

      const address = server.address();
      const resolvedPort = typeof address === 'object' && address ? address.port : port;

      if (!silent) {
        console.log(`Poster Ratings Overlay eklentisi ${resolvedPort} portunda çalışıyor.`);
        if (!hasOmdbApiKey()) {
          console.warn(
            'Uyarı: OMDB_API_KEY ortam değişkeni tanımlı değil. Puanlar olmadan varsayılan afişler kullanılacak.'
          );
        }
      }

      resolve(server);
    });
  });
}

function stopServer() {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

if (require.main === module) {
  const silentFromEnv = isTruthyEnv(process.env.STARTUP_SILENT);

  startServer({ silent: silentFromEnv }).catch((error) => {
    console.error('Sunucu başlatılırken hata oluştu:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  server,
  manifest,
  getManifest,
  startServer,
  stopServer,
  setFetchImplementation,
  setOmdbApiKey,
  clearRatingsCache,
  createPosterOverlaySvg,
  normalizeRatings,
  createRatingSummary
};
