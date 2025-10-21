const { URLSearchParams } = require('url');

if (typeof fetch !== 'function') {
  throw new Error('Global fetch API is not available. Please use Node.js 18 or newer.');
}

const DEFAULT_BASE_URL = 'https://v3-cinemeta.strem.io';
const baseUrl = process.env.CINEMETA_BASE_URL || DEFAULT_BASE_URL;

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`Request to ${url} failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function buildQuery(extra = {}) {
  const params = new URLSearchParams();
  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function fetchCatalog(type, id, extra) {
  const safeType = encodeURIComponent(type);
  const safeId = encodeURIComponent(id);
  const query = buildQuery(extra);
  const url = `${baseUrl}/catalog/${safeType}/${safeId}.json${query}`;
  return fetchJSON(url);
}

async function fetchMeta(type, id) {
  const safeType = encodeURIComponent(type);
  const safeId = encodeURIComponent(id);
  const url = `${baseUrl}/meta/${safeType}/${safeId}.json`;
  return fetchJSON(url);
}

module.exports = {
  fetchCatalog,
  fetchMeta,
};
