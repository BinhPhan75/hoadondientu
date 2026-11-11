# PMKT e-invoice module integration

The downloader is embedded by PMKT at `https://pmkt.nghiatingold.com`. The client and server reject other parent/origin values. The client sends `HOADON_BRIDGE_READY` to that exact origin and accepts `PMKT_EINVOICE_SESSION` only from that origin and `window.parent`. It requests a replacement session with `HOADON_BRIDGE_REFRESH_REQUEST` after an API 401 or shortly before the bridge JWT expires.

## Production configuration

Configure these values in the downloader's Production deployment and redeploy:

| Setting | Value |
| --- | --- |
| `PMKT_APP_ORIGIN` | `https://pmkt.nghiatingold.com` |
| `VITE_PMKT_ORIGIN` | `https://pmkt.nghiatingold.com` |
| `PMKT_BRIDGE_SECRET` | A randomly generated secret with at least 32 bytes; set the identical value in PMKT Production |

`VITE_PMKT_ORIGIN` is embedded during the client build. `PMKT_APP_ORIGIN` controls server-side frame/CORS policy; Vercel's static-response CSP is fixed to the verified Production origin. The two environment variables default to that origin, but should be explicitly set so a deployment's configuration is auditable. Do not include a path or trailing slash, use a wildcard, or expose the bridge secret to the browser. If the bridge secret is missing or shorter than 32 bytes, protected API routes fail closed. The API also fails closed on invalid/missing bridge JWTs.

The PMKT-issued HS256 JWT must have issuer `pmkt-v2`, audience `hoadondientu`, a UUID subject, and an unexpired `exp` claim. Protected downloader API calls carry it as a Bearer token. The PMKT browser handoff contains the GDT taxpayer `taxCode` and `password`; those credentials and the bridge token stay in memory and are not written to URLs, browser storage, or logs. The taxpayer still controls the separate GDT portal login, CAPTCHA, and invoice-query flow.

The old downloader user-login/admin routes and their Neon/PostgreSQL auth database have been removed. Remove the old auth-only `DATABASE_URL`, `POSTGRES_*`, `NEON_DATABASE_URL`, `ADMIN_INITIAL_*`, `AUTH_TOKEN_SECRET`, and `AUTH_WEBAPP_URL` settings from the downloader deployment. Invoice and other non-auth storage are unaffected. `/api/health` remains public; other `/api` operations require the PMKT bridge token.
