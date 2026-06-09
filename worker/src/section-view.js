/**
 * Section-view beacon worker for zetesislabs.com.
 *
 * Receives POSTed beacons from the IntersectionObserver instrumentation on
 * dhruv.html / index.html / lab.html and writes one event per section-first-view
 * to a Workers Analytics Engine dataset for later aggregation.
 *
 * Endpoint: POST https://zetesislabs.com/api/section-view
 *
 * Expected JSON body:
 *   { "sectionId": "scholarly-articles", "path": "/dhruv.html", "sessionId": "..." }
 *
 * Response: 204 No Content on success, 4xx on malformed input. Failures must be
 * silent on the client side; the page does not depend on this endpoint.
 *
 * Data layout in Analytics Engine (dataset `section_views_dhruv`):
 *   indexes : [sectionId]            -- queryable index, max 96 bytes
 *   blobs   : [
 *     blob1 = sectionId,             -- redundant with index, kept for SQL
 *     blob2 = path,
 *     blob3 = country (cf.country),
 *     blob4 = sessionId,
 *     blob5 = "bot" | "human"
 *   ]
 *   doubles : [1]                    -- per-event count (always 1)
 *
 * No personal data is stored. sessionId is a per-tab opaque token generated
 * client-side and not linked to any identity.
 */

const BOT_REGEX =
  /bot|crawler|spider|crawling|scraper|claudebot|gptbot|amazonbot|bingbot|googlebot|yandex|baidu|petalbot|applebot|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegram|slackbot|discordbot|mj12bot|ahrefsbot|axios|python-requests|curl|wget|libwww|java\/|go-http|node-fetch|okhttp/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    // CORS preflight (sendBeacon does not actually send a preflight, but a
    // future fetch()-based fallback might).
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('Bad JSON', { status: 400, headers: corsHeaders });
    }

    const sectionId = (body && typeof body.sectionId === 'string')
      ? body.sectionId.slice(0, 96)
      : null;
    if (!sectionId) {
      return new Response('Bad sectionId', { status: 400, headers: corsHeaders });
    }

    const path = (body.path && typeof body.path === 'string')
      ? body.path.slice(0, 200)
      : '/';
    const sessionId = (body.sessionId && typeof body.sessionId === 'string')
      ? body.sessionId.slice(0, 64)
      : '';

    const country = (request.cf && request.cf.country) || 'XX';
    const ua = request.headers.get('user-agent') || '';
    const cls = BOT_REGEX.test(ua) ? 'bot' : 'human';

    // Write to Analytics Engine if the binding is wired; if not, no-op so the
    // endpoint still returns 204 and the client beacon is not retried.
    if (env.SECTION_VIEWS && typeof env.SECTION_VIEWS.writeDataPoint === 'function') {
      try {
        env.SECTION_VIEWS.writeDataPoint({
          indexes: [sectionId],
          blobs: [sectionId, path, country, sessionId, cls],
          doubles: [1],
        });
      } catch (e) {
        // Swallow; we never want a beacon to surface a client-visible error.
      }
    }

    return new Response(null, { status: 204, headers: corsHeaders });
  },
};
