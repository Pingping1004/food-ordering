// A tiny stand-in for Supabase Auth (GoTrue) so the real frontend can sign in during E2E without a Supabase project.
// Any "<userId>@load.local" e-mail signs in as that user id (the seeded test users); every token is JWT-shaped.
// The test API (backend/test/load/server.ts) accepts the same tokens through its fake Supabase client.
import http from 'node:http';

const PORT = Number(process.env.FAKE_SUPABASE_PORT || 54321);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

const idFromEmail = (email) => (String(email).match(/^([0-9a-f-]{36})@load\.local$/i) || [])[1];
const userFor = (id) => ({
  id, aud: 'authenticated', role: 'authenticated', email: `${id}@load.local`, email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: 'email' }, user_metadata: { name: `user ${id.slice(0, 4)}` },
  identities: [{ id, user_id: id, provider: 'email' }], created_at: new Date().toISOString(),
});
const sessionFor = (id) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, email: `${id}@load.local`, aud: 'authenticated', role: 'authenticated', aal: id.startsWith('aal2-') ? 'aal2' : 'aal1', exp, session_id: id })}.sig`;
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `r-${id}`, user: userFor(id) };
};
const readBody = (req) => new Promise((resolve) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } }); });
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', req.headers.origin || '*');
  res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('vary', 'Origin');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
    const body = await readBody(req);
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(body.refresh_token || '').replace(/^r-/, '');
      return id ? send(res, 200, sessionFor(id)) : send(res, 400, { code: 'refresh_token_not_found', message: 'bad refresh token' });
    }
    const id = idFromEmail(body.email);
    return id && body.password === 'password123'
      ? send(res, 200, sessionFor(id))
      : send(res, 400, { code: 'invalid_credentials', error_code: 'invalid_credentials', message: 'Invalid login credentials' });
  }
  if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
    try {
      const tok = String(req.headers.authorization || '').replace(/^Bearer /i, '');
      const sub = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).sub;
      return sub ? send(res, 200, userFor(sub)) : send(res, 401, { message: 'invalid' });
    } catch { return send(res, 401, { message: 'invalid' }); }
  }
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/health') return send(res, 200, { ok: true });
  send(res, 404, { message: `fake supabase: ${req.method} ${url.pathname} not implemented` });
}).listen(PORT, '127.0.0.1', () => console.log(`fake supabase on :${PORT}`));
