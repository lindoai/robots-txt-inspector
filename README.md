# Robots.txt Inspector

Parse robots.txt and explain major rules, sitemaps, and user-agent blocks in plain English.

## API

```
GET /api/inspect?url=https://example.com
```

Returns parsed robots.txt rules, sitemaps, and a plain-English summary.

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lindoai/robots-txt-inspector)

## Environment

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
