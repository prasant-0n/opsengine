# ADR-0005: In-memory rate limiter (dev) with swap-out contract
**Date:** 2026-10-19
**Status:** Accepted
**Context:** Auth routes need brute-force protection now; no Redis in the dev environment.
**Decision:** Fixed-window per-IP limiter in process memory behind a tiny `rateLimit()` interface. Production deployments must back it with a shared store (Redis/DB) — flagged in deploy checklist.
**Rationale:** Interface-first: the security property (per-IP throttling) exists today; the store is swappable without touching routes.
**Consequences:** Limits reset on server restart and don't coordinate across replicas — acceptable pre-production only.
