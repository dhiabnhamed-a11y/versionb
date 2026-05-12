# Google OAuth Redirect URI Runbook

This app has two separate auth surfaces:

- App login uses Auth.js/NextAuth credentials at `/api/auth/*`.
- YouTube social account connection uses the custom social integration OAuth flow at `/api/integrations/oauth/youtube/*`.

The current Google `redirect_uri_mismatch` is caused by registering the wrong callback path or registering the right path for the wrong origin. YouTube connection sends this callback path:

```text
/api/integrations/oauth/youtube/callback
```

It does not send the standard Auth.js Google callback unless a Google login provider is added later:

```text
/api/auth/callback/google
```

## Required Google Cloud Redirect URIs

Register every exact origin that can initiate YouTube OAuth. Google requires exact scheme, host, port, and path matches.

Development:

```text
http://localhost:3000/api/integrations/oauth/youtube/callback
```

Production:

```text
https://taskit-pearl.vercel.app/api/integrations/oauth/youtube/callback
```

If a custom production domain is attached, also register:

```text
https://YOUR_CUSTOM_DOMAIN/api/integrations/oauth/youtube/callback
```

If you intentionally test OAuth from a Vercel or Cloudflare preview URL, register that exact preview URL too:

```text
https://YOUR_VERCEL_PREVIEW_URL/api/integrations/oauth/youtube/callback
https://YOUR_CLOUDFLARE_PAGES_PREVIEW_URL/api/integrations/oauth/youtube/callback
```

Google OAuth web clients do not support wildcard redirect URI matching for these callback URLs, so arbitrary preview deployments cannot all work with one wildcard entry. Add each preview origin explicitly or run OAuth from the canonical production domain.

## Environment Matrix

Local `.env`:

```text
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
OAUTH_ALLOWED_ORIGINS=http://localhost:3000
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
```

Production:

```text
NEXTAUTH_URL=https://taskit-pearl.vercel.app
AUTH_URL=https://taskit-pearl.vercel.app
NEXT_PUBLIC_APP_URL=https://taskit-pearl.vercel.app
APP_URL=https://taskit-pearl.vercel.app
OAUTH_ALLOWED_ORIGINS=https://taskit-pearl.vercel.app
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
```

Preview deployment:

```text
NEXTAUTH_URL=https://YOUR_PREVIEW_DOMAIN
AUTH_URL=https://YOUR_PREVIEW_DOMAIN
NEXT_PUBLIC_APP_URL=https://YOUR_PREVIEW_DOMAIN
APP_URL=https://YOUR_PREVIEW_DOMAIN
OAUTH_ALLOWED_ORIGINS=https://YOUR_PREVIEW_DOMAIN
```

## Runtime Resolution Rules

The social OAuth resolver now chooses redirect origins in this order:

1. Localhost request origin, so local development cannot accidentally send production callbacks.
2. Request origin listed in `OAUTH_ALLOWED_ORIGINS`, for explicitly authorized preview domains.
3. `SOCIAL_OAUTH_BASE_URL`, `OAUTH_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `APP_URL`, `AUTH_URL`, `NEXTAUTH_URL`.
4. Platform origin from `VERCEL_URL` or `CF_PAGES_URL`.
5. Request origin as a final fallback.

Set `OAUTH_DEBUG=true` temporarily to log the resolved `redirect_uri`, source, request origin, and configured origin.
