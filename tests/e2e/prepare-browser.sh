#!/usr/bin/env bash
# One-time setup for the E2E browser (only needed on restricted networks).
# Extracts @sparticuz/chromium + its AL2023 runtime libs (libnss3 etc.).
set -e
cd "$(dirname "$0")/.."
npm install --save-dev @sparticuz/chromium@131 puppeteer-core@23 jsdom@24 playwright@1.49.1 --no-audit --no-fund
node -e "
const { brotliDecompressSync } = require('zlib');
const fs = require('fs');
fs.mkdirSync('/tmp/chromium-libs', { recursive: true });
fs.writeFileSync('/tmp/chromium-libs/al2023.tar',
  brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
console.log('libs decompressed');"
tar -xf /tmp/chromium-libs/al2023.tar -C /tmp/chromium-libs
node -e "require('@sparticuz/chromium').executablePath().then(p=>console.log('chromium at:',p))"
echo "E2E browser ready. Run: LD_LIBRARY_PATH=/tmp/chromium-libs/lib node e2e/run-e2e.js"
