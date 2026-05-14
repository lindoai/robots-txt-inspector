import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readTurnstileTokenFromUrl, verifyTurnstileToken } from '../../_shared/turnstile';
import { renderTextToolPage, turnstileSiteKeyFromEnv } from '../../_shared/tool-page';

type Env = { Bindings: { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string } };

const app = new Hono<Env>();
app.use('/api/*', cors());
app.get('/', (c) =>
  c.html(
    renderTextToolPage({
      title: 'Robots.txt Inspector',
      description: 'Parse robots.txt and explain major rules, sitemaps, and user-agent blocks in plain English.',
      endpoint: '/api/inspect',
      sample: '{ "url": "https://example.com", "rules": [], "sitemaps": [] }',
      siteKey: turnstileSiteKeyFromEnv(c.env),
      buttonLabel: 'Inspect',
      toolSlug: 'robots-txt-inspector',
    })
  )
);
app.get('/health', (c) => c.json({ ok: true }));
app.get('/api/inspect', async (c) => {
  const captcha = await verifyTurnstileToken(
    c.env,
    readTurnstileTokenFromUrl(c.req.url),
    c.req.header('CF-Connecting-IP')
  );
  if (!captcha.ok) return c.json({ error: captcha.error }, 403);

  const normalized = normalizeUrl(c.req.query('url') ?? '');
  if (!normalized) return c.json({ error: 'A valid http(s) URL is required.' }, 400);

  const robotsUrl = new URL('/robots.txt', normalized).toString();
  const text = await fetchText(robotsUrl);
  if (text === null) return c.json({ error: 'Failed to fetch robots.txt.' }, 502);

  const lines = text.split('\n');
  const rules: { userAgent: string; allow: string[]; disallow: string[] }[] = [];
  const sitemaps: string[] = [];
  let current: { userAgent: string; allow: string[]; disallow: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const lower = key.trim().toLowerCase();
    if (lower === 'user-agent') {
      current = { userAgent: value, allow: [], disallow: [] };
      rules.push(current);
    } else if (lower === 'allow' && current) {
      current.allow.push(value);
    } else if (lower === 'disallow' && current) {
      current.disallow.push(value);
    } else if (lower === 'sitemap') {
      sitemaps.push(value);
    }
  }

  const summary = buildSummary(rules, sitemaps);
  return c.json({ url: normalized, robotsUrl, rules, sitemaps, summary });
});

function buildSummary(
  rules: { userAgent: string; allow: string[]; disallow: string[] }[],
  sitemaps: string[]
): string {
  const parts: string[] = [];
  if (rules.length === 0) {
    parts.push('No user-agent rules found.');
  } else {
    for (const r of rules) {
      parts.push(`For "${r.userAgent}": ${r.disallow.length} disallow rule(s), ${r.allow.length} allow rule(s).`);
    }
  }
  if (sitemaps.length > 0) {
    parts.push(`Sitemap(s) declared: ${sitemaps.join(', ')}.`);
  } else {
    parts.push('No sitemaps declared in robots.txt.');
  }
  return parts.join(' ');
}

async function fetchText(url: string) {
  const r = await fetch(url, { headers: { 'user-agent': 'Lindo Free Tools/1.0 (+https://lindo.ai/tools)' } }).catch(() => null);
  return r?.ok ? r.text() : null;
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export default app;
