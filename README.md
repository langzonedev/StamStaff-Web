# StamStaff Web

Responsive PWA for event availability and manager-published rosters. The public client is paired with private, authoritative Supabase PostgreSQL RPCs. Real names, addresses, credentials and private business logic must never be committed here.

## Implemented client

- Separate Staff and Manager workspaces, with server-derived membership and roles.
- Invited email/password signup, verification, recovery, profile onboarding and profile editing.
- Administrator invitations and delegation to an already activated manager.
- Event dates and trading hours, publication, response closing/reopening and archiving.
- Multiple available blocks per day, interactive timeline and precise time controls; private draft and explicit submission.
- Manager day/event availability table, draft roster with availability visible underneath shifts, publication and change notes.
- Staff see only their own published shifts. Roster updates are in-app, not notification email.
- Online-only changes with pending/error/conflict states and unsaved-change protection.

These are source implementation statements, not proof of a deployed service or successful live email delivery. The private repository records exact build, database, browser and release evidence.

## Routes

`/` is the connected application. `/account/` handles sign-in, verification/recovery callbacks and account setup. `/demo/` preserves the older fictional local prototype, visibly separate from real account data. Its preview role switch is not authentication.

## Configuration

Build-time variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_BASE_PATH` (for Pages, `/StamStaff-Web`)
- `NEXT_PUBLIC_SITE_URL`

Only the project URL and publishable client key belong in the client. Never use a secret/service-role key or database password. Missing connection settings produce a clear setup-unavailable screen. The private backend must expose only its reviewed `api` RPC schema and enforce all permissions and transactional rules.

Auth callbacks use the exact `/account/` URL; password recovery adds `?recovery=1`. Allow these URLs in the authentication provider. The browser uses sessionStorage, an implicit callback suitable for static Pages, and an explicit new-password screen. Custom SMTP and actual delivery must be configured and tested separately. Generic invitation setup links contain no identity, role or bearer secret. Managers share these links manually.

## Development and verification

Node.js 22.13 or newer:

```sh
npm ci
npm run dev
npm run lint
npx tsc --noEmit
```

The GitHub Pages workflow runs the static build and publishes `out/`. Reproduce with `STAMSTAFF_STATIC_EXPORT=1`, `NEXT_PUBLIC_BASE_PATH=/StamStaff-Web`, the site URL and the two Supabase variables, then run `npm run pages:build`. Do not run a build against `.next` while a Next dev process is using it.

The service worker caches public shell assets and shows an offline page on failed navigation. It never caches Supabase account/API responses or private rosters. Writes require connectivity. Unsaved edits are held in memory; keep an editing tab open through a recoverable failure. Reloading or closing a tab can discard them.

WCAG 2.2 AA is the target. Time controls accompany pointer timelines, status uses text as well as colour, and layouts support phone, tablet and desktop. Runtime accessibility and installability require verification against the exact candidate.
