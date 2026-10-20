# ADR-0001: OTP verification uses challengeId binding
**Date:** 2026-10-19
**Status:** Accepted
**Context:** Root password reset is pre-session; the PRD requires every tenant-owned row access to be tenant-scoped, but verify-otp had no tenant context. A bare 6-digit code lookup across all tenants would allow cross-tenant brute force.
**Decision:** `forgot-password` returns an opaque `challengeId` (otp_codes.id). `verify-otp` requires it and matches code hash against that specific row only.
**Rationale:** The challenge row carries tenantId/userId from the verified email lookup step — the only trustworthy tenant signal available pre-session.
**Consequences:** UI flow passes `?challenge=` between the two screens. Any future email-verification flow must reuse this pattern.
