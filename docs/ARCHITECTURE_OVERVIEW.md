# Public Architecture Overview

## Current status

No framework or production architecture is selected or implemented.

## Intended boundary

```text
Public browser/PWA
       |
authenticated, versioned contract
       |
Private authoritative roster service and employee data
```

The public client is responsible for accessible presentation, interaction, and clear state. It is not the authority for identity, roles, shift capacity, provisional claims, final assignments, lock state, or notification delivery.

## Prototype truthfulness

- Local/mock data must be labelled and fictional.
- A role preview is not authentication or authorisation.
- A local capacity change does not prove cross-device concurrency.
- A service-worker cache does not make roster mutations safely offline.
- Provider details, private rules, credentials, and employee records remain outside the public bundle.

The approved stack, contract, security model, environments, and release process will be documented in the private repository before integration.


