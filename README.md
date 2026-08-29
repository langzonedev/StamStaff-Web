# StamStaff Web

Public, external-facing PWA prototype for **StamStaff — simple event availability and rostering for small teams**.

## Current state

**Interactive fictional-data prototype.** The current build demonstrates staff shift reservation/release, manager confirmation, event entry and key failure/lock states. It does not provide real accounts, authentication, shared capacity, email delivery, durable storage or production rostering.

Planned prototype outcomes are described in [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md). The private `langzonedev/StamStaff` repository is the authoritative source for customer requirements, business rules, shared services, security, and delivery decisions.

## Public data rule

Assume every file, commit, build artifact, browser bundle, and issue in this repository is permanently public. Use fictional sample organisations, people, events, and shifts only. Never add credentials, real employee/customer data, private eligibility rules, or internal operational material.

## Planned quality bar

- Mobile-first and useful on phone, tablet, and desktop.
- Plain-language manager/staff flows suitable for a broad age range.
- WCAG 2.2 AA target.
- Truthful labels for local demo data, authentication, synchronisation, notifications, and offline behavior.
- Reproducible lint, type-check, build, and PWA/runtime verification once scaffolding exists.

## Prototype journeys

- Switch between clearly labelled staff and manager previews.
- Reserve or release a fictional capacity-limited shift.
- Confirm fictional provisional reservations as the manager.
- Add the essential details for a new event locally.
- Inspect full, locked, offline and capacity-conflict states.

All changes reset on refresh. The role switch is not authentication and the displayed capacity is not shared between devices.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm run lint` and `npm run build` before publishing a candidate. The private repository remains authoritative for future identity, transactional capacity and notification integration decisions.


