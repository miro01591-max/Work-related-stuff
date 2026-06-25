const TOTANGO_BASE = 'https://api.totango.com';
const ALLOWED_ORIGIN = '*';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    const allowedPaths = [
      '/api/v1/search/accounts',
      '/api/v3/touchpoints/',
    ];

    const isAllowed = allowedPaths.some(p => path.startsWith(p));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
      });
    }

    const totangoUrl = TOTANGO_BASE + path + url.search;

    const headers = new Headers();
    headers.set('app-token', env.TOTANGO_TOKEN);

    // Preserve content-type from original request
    const contentType = request.headers.get('Content-Type') || 'application/json';
    headers.set('Content-Type', contentType);

    let body = null;
    if (request.method === 'POST') {
      body = await request.text();
    }

    try {
      const response = await fetch(totangoUrl, {
        method: request.method,
        headers,
        body
      });

      const data = await response.text();

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        }
      });
    }
  }
};
