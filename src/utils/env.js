const fs = require('fs');
const path = require('path');

function loadEnv(envPath = path.resolve(process.cwd(), '.env')) {
  try {
    if (!fs.existsSync(envPath)) {
      return;
    }
    const contents = fs.readFileSync(envPath, 'utf8');
    contents.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const delimiterIndex = trimmed.indexOf('=');
      if (delimiterIndex === -1) return;
      const key = trimmed.slice(0, delimiterIndex).trim();
      const value = trimmed.slice(delimiterIndex + 1).trim();
      if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;
      process.env[key] = value;
    });
  } catch (error) {
    console.warn(`Unable to load environment variables from ${envPath}: ${error.message}`);
  }
}

module.exports = {
  loadEnv,
};
