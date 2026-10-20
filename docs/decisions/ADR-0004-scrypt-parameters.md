# ADR-0004: scrypt parameters (N=2^17, r=8, p=1, 256MB maxmem)
**Date:** 2026-10-19
**Status:** Accepted
**Context:** PRD requires strong password hashing; bcrypt was rejected (native deps broke Turbopack — see docs/decisions/custom-requests.md).
**Decision:** scrypt via node:crypto, async. Salt 16B, key 64B, format `salt_hex:key_hex`.
**Rationale:** Memory-hard, zero native deps, Node built-in. N=2^17 balances ~100ms hash time against login UX.
**Consequences:** Seed/reset tooling must use identical params; maxmem must stay ≥128MB (bug BUG-001).
