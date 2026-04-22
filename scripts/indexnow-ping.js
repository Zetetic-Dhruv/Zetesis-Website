#!/usr/bin/env node
/*
 * indexnow-ping.js
 *
 * Submit updated URLs to IndexNow (https://www.indexnow.org/). A single POST
 * notifies Bing, Yandex, Naver, Seznam, and DuckDuckGo. Google has tested
 * IndexNow but does NOT currently consume it — for Google, use Search Console.
 *
 * Usage:
 *   node scripts/indexnow-ping.js
 *   node scripts/indexnow-ping.js https://zetesislabs.com/foo.html https://zetesislabs.com/bar.html
 *
 * Environment:
 *   INDEXNOW_KEY  (optional) overrides the embedded key.
 */

'use strict';

const DEFAULT_KEY = '9b9e2a83c35fb9e6e7a601e0acb2510e';
const HOST = 'zetesislabs.com';
const DEFAULT_URLS = [
  'https://zetesislabs.com/',
  'https://zetesislabs.com/dhruv.html',
  'https://zetesislabs.com/lab.html',
  'https://zetesislabs.com/sitemap.xml',
  'https://zetesislabs.com/llms.txt',
];

const key = process.env.INDEXNOW_KEY || DEFAULT_KEY;
const urls = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_URLS;

const payload = {
  host: HOST,
  key,
  keyLocation: `https://${HOST}/${key}.txt`,
  urlList: urls,
};

console.log(`[indexnow] submitting ${urls.length} URL(s) to api.indexnow.org`);
urls.forEach((u) => console.log(`  - ${u}`));

fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'User-Agent': 'zetesislabs-indexnow/1.0',
  },
  body: JSON.stringify(payload),
})
  .then(async (res) => {
    const body = await res.text();
    console.log(`[indexnow] HTTP ${res.status}`);
    if (body) console.log(`[indexnow] body: ${body.slice(0, 500)}`);
    if (res.status === 200 || res.status === 202) {
      console.log('[indexnow] accepted by Bing/Yandex/DDG/Naver/Seznam');
    } else if (res.status === 422) {
      console.warn('[indexnow] 422: URL not matching key host, or keyLocation mismatch — deploy the key file first');
      process.exitCode = 1;
    } else {
      console.warn(`[indexnow] unexpected status ${res.status}`);
      process.exitCode = 1;
    }
  })
  .catch((e) => {
    console.error('[indexnow] request failed:', e.message);
    process.exitCode = 2;
  });
