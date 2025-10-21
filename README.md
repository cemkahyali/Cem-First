# Poster Ratings Overlay Stremio Add-on

This repository contains a custom [Stremio](https://www.stremio.com/) add-on that decorates every movie and series poster with critic scores from IMDb, Rotten Tomatoes, and Metacritic. The add-on proxies Stremio's public **Cinemeta** catalog, enriches the metadata with fresh ratings from [OMDb](https://www.omdbapi.com/), and exposes them to the Stremio client as colorful poster badges.

## Features

- 🌟 Seamless enrichment of Cinemeta catalogs for both movies and series.
- 🎯 Poster badges for IMDb, Rotten Tomatoes, and Metacritic so users can compare scores at a glance.
- ♻️ Transparent caching of rating lookups to avoid hitting external APIs unnecessarily.
- 🛡️ Graceful fallbacks — if a score is missing, the add-on replaces it with an “N/A” badge instead of failing.
- ⚙️ Environment-driven configuration (OMDb API key, Cinemeta endpoint, HTTP port).

## Getting Started

### Prerequisites

- **Node.js 18 or newer** (required for the native Fetch API used by the add-on).
- An **OMDb API key** – request a free personal key at [omdbapi.com/apikey.aspx](http://www.omdbapi.com/apikey.aspx).

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

1. Copy the example configuration:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set `OMDB_API_KEY` to the key you obtained in the prerequisites.
3. (Optional) Update `PORT` or `CINEMETA_BASE_URL` if you need a custom setup.

> ℹ️ The project ships with a lightweight `.env` loader, so variables declared in the file are automatically available at runtime without additional dependencies.

### 3. Run the add-on locally

```bash
npm start
```

The manifest will be available at [http://localhost:7000/manifest.json](http://localhost:7000/manifest.json) by default. Import this URL into the Stremio desktop or web client to load the catalog.

### 4. Run the health check (optional)

```bash
npm test
```

The health check validates that your OMDb key is present and reminds you if optional configuration is missing.

## How Ratings Work

- The add-on mirrors Cinemeta metadata so you retain all existing artwork, trailers, and stream links.
- For every title, the service calls OMDb using the IMDb ID (preferred) or title/year combination.
- Retrieved scores are normalized, cached, and injected into:
  - `behaviorHints.badges` – enables poster overlays.
  - `ratings` – stores the raw numeric values.
  - `description` – appends a human-readable summary (helps with clients that do not yet render badges).

If OMDb does not return a given rating, the add-on still adds a badge marked as **N/A**, so each poster clearly displays all three sources.

## Deployment Tips

- Host the add-on on any Node.js-compatible platform (Heroku, Render, Fly.io, etc.).
- Ensure the `OMDB_API_KEY` environment variable is configured wherever you deploy.
- Use a reverse proxy with caching (e.g., Cloudflare) to further reduce repeated OMDb calls.

## Validation Checklist

Before sharing the add-on with users:

- [ ] Import the manifest into Stremio and confirm that every poster shows three rating badges.
- [ ] Trigger search queries, pagination (`skip` extra), and genre filters to ensure metadata enrichment works in all catalog scenarios.
- [ ] Test movies and series that lack Rotten Tomatoes or Metacritic scores to verify that the “N/A” badges render correctly.
- [ ] Check the server logs for `Failed to load ratings` messages — if they appear frequently, verify your OMDb API key and request quota.

## Troubleshooting

| Symptom | Possible Cause | Suggested Fix |
| --- | --- | --- |
| Badges always show “N/A” | OMDb API key missing or invalid | Confirm the key in `.env` and restart the server. |
| Catalog loads without posters | Cinemeta base URL overridden incorrectly | Remove or correct `CINEMETA_BASE_URL` in the environment. |
| Add-on not reachable | Port conflict or blocked by firewall | Change the `PORT` variable and restart, or adjust firewall settings. |

## License

This project is released under the [MIT License](LICENSE) unless stated otherwise.
