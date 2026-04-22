#!/usr/bin/env node
/*
 * prerender-github.js
 *
 * Fetch GitHub profile + repo data for the listed users at build time, then
 * splice the rendered HTML into `dhruv.html` between the PRERENDER_* marker
 * comments. The output is written to `dist/dhruv.html`.
 *
 * The page still ships the live-refresh JS; pre-rendered content is what
 * search engines and LLM crawlers see. If the fetch fails (rate limit,
 * network, etc), the build falls back to the original placeholder text
 * rather than breaking.
 *
 * Uses a GITHUB_TOKEN env var if present (CI) for higher rate limits; works
 * unauthenticated for local builds.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const USERS = ['Zetetic-Dhruv'];
const MAX_REPOS = 24;
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'dhruv.html');
const DEST = path.join(ROOT, 'dist', 'dhruv.html');

// ---------- utilities ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function log(...args) {
  console.log('[prerender-github]', ...args);
}

// ---------- fetch ----------
async function fetchJSON(url) {
  const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'zetesislabs-build' };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (res.status === 403) throw new Error('rate-limit');
  if (!res.ok) throw new Error(`http-${res.status}`);
  return res.json();
}

async function fetchUser(user) {
  try {
    const [profile, repos] = await Promise.all([
      fetchJSON(`https://api.github.com/users/${user}`).catch((e) => { log(`profile fetch failed for ${user}: ${e.message}`); return null; }),
      fetchJSON(`https://api.github.com/users/${user}/repos?per_page=100&sort=updated`).catch((e) => { log(`repos fetch failed for ${user}: ${e.message}`); return []; })
    ]);
    return { user, profile, repos: repos || [] };
  } catch (e) {
    log(`fetch failed for ${user}: ${e.message}`);
    return { user, profile: null, repos: [] };
  }
}

// ---------- render ----------
function renderStats(data) {
  let totalRepos = 0, totalFollowers = 0;
  const bios = [];
  data.forEach((u) => {
    if (u.profile) {
      totalRepos += u.profile.public_repos || 0;
      totalFollowers += u.profile.followers || 0;
      if (u.profile.bio) bios.push(`@${u.user}: ${u.profile.bio}`);
    }
  });
  const userLinks = USERS.map((u) =>
    `<a href="https://github.com/${esc(u)}" target="_blank" rel="noopener noreferrer">@${esc(u)}</a>`
  ).join('');
  return [
    `<div class="flex gap-8 text-sm" style="flex-wrap: wrap; align-items: baseline;">`,
    `<div><strong>${totalRepos}</strong> <span class="text-muted">public repos</span></div>`,
    `<div><strong>${totalFollowers}</strong> <span class="text-muted">followers</span></div>`,
    userLinks,
    `</div>`,
    bios.length ? `<p class="text-muted text-sm italic" style="margin-top: 0.75rem;">${esc(bios.join(' \u00b7 '))}</p>` : ''
  ].join('');
}

function renderRepos(data) {
  const merged = [];
  data.forEach((u) => {
    (u.repos || []).forEach((r) => {
      if (r && !r.fork && !r.archived && !r.private) {
        merged.push({
          name: r.name,
          description: r.description,
          html_url: r.html_url,
          pushed_at: r.pushed_at,
          owner: u.user
        });
      }
    });
  });
  merged.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  if (merged.length === 0) {
    return `<div class="text-muted text-sm">No public repositories found.</div>`;
  }
  const shown = merged.slice(0, MAX_REPOS);
  const hidden = merged.length - shown.length;
  const cards = shown.map((r) => [
    `<a href="${esc(r.html_url)}" target="_blank" rel="noopener noreferrer" class="border p-4" style="text-decoration: none; color: inherit; display: block;">`,
    `<div class="flex gap-4" style="justify-content: space-between; align-items: baseline; flex-wrap: wrap;">`,
    `<h4 class="font-bold" style="margin: 0;">${esc(r.name)}</h4>`,
    `<span class="text-muted text-xs">@${esc(r.owner)}  \u00b7  updated ${esc(fmtDate(r.pushed_at))}</span>`,
    `</div>`,
    r.description ? `<p class="text-sm text-muted" style="margin-top: 0.5rem; line-height: 1.5;">${esc(r.description)}</p>` : '',
    `</a>`
  ].join('')).join('');
  const overflow = hidden > 0 ? `<p class="text-muted text-xs italic" style="margin-top: 0.5rem;">${hidden} more on GitHub.</p>` : '';
  return cards + overflow;
}

// ---------- splice ----------
function splice(html, startMarker, endMarker, payload) {
  const re = new RegExp(
    `(<!--\\s*${startMarker}\\s*-->)([\\s\\S]*?)(<!--\\s*${endMarker}\\s*-->)`,
    'm'
  );
  if (!re.test(html)) {
    log(`marker ${startMarker} / ${endMarker} not found; skipping`);
    return html;
  }
  return html.replace(re, `$1\n${payload}\n$3`);
}

// ---------- main ----------
async function main() {
  log(`fetching GitHub data for: ${USERS.join(', ')}`);

  let data;
  try {
    data = await Promise.all(USERS.map(fetchUser));
  } catch (e) {
    log(`fatal fetch error: ${e.message}`);
    data = USERS.map((u) => ({ user: u, profile: null, repos: [] }));
  }

  const statsHtml = renderStats(data);
  const reposHtml = renderRepos(data);

  const repoCount = data.reduce((n, d) => n + (d.repos ? d.repos.length : 0), 0);
  log(`retrieved ${repoCount} total repos`);

  let html = fs.readFileSync(SRC, 'utf8');

  // Only inject when we actually got data; otherwise leave the JS-loading placeholder.
  if (data.some((d) => d.profile || (d.repos && d.repos.length))) {
    html = splice(html, 'PRERENDER_STATS_START', 'PRERENDER_STATS_END', statsHtml);
    html = splice(html, 'PRERENDER_REPOS_START', 'PRERENDER_REPOS_END', reposHtml);
    log('pre-rendered GitHub sections injected into dhruv.html');
  } else {
    log('no usable data; leaving placeholder in place');
  }

  // Ensure dist exists
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, html);
  log(`wrote ${DEST}`);
}

main().catch((e) => {
  console.error('[prerender-github] unrecoverable error:', e);
  // Fallback: copy the original dhruv.html through so build doesn't break.
  try {
    fs.mkdirSync(path.dirname(DEST), { recursive: true });
    fs.copyFileSync(SRC, DEST);
    console.error('[prerender-github] fell back to copying original dhruv.html');
  } catch (copyErr) {
    console.error('[prerender-github] fallback copy also failed:', copyErr);
    process.exit(1);
  }
});
