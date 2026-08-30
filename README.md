# StamStaff Web

Public, external-facing PWA prototype for **StamStaff — simple event availability and rostering for small teams**.

## Current state

**Interactive fictional-data prototype.** The current build starts empty and lets a manager create an event and shifts, open availability, preview staff requests, select final assignments, and publish a local roster outcome. An optional tiny example is fictional and additive. Prototype data is saved only in the current browser.

It does not provide real accounts, authentication, shared capacity, email delivery, server transactions or production rostering.

**Phone test:** [Open the owner-only StamStaff prototype](https://stampstaff-prototype.langaz35.chatgpt.site)

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

- Create, edit, delete and recover a local fictional event.
- Add one or more capacity-limited shifts.
- Switch between the Manager and Staff app views at any time.
- Open availability and reserve shifts from the Staff view.
- Request or release a shift, with pending, full, locked and offline states shown in context.
- Select final assignments as the manager and publish a local roster outcome.
- See a staff request become confirmed or not assigned.

Changes persist in this browser until the prototype is reset. The role switch is not authentication, and displayed capacity is not shared between devices.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm run lint` and `npm run build` before publishing a candidate. The private repository remains authoritative for future identity, transactional capacity and notification integration decisions.
