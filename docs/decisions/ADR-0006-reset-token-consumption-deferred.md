# ADR-0006: Reset-token consumption deferred to authz feature
**Date:** 2026-10-19
**Status:** Accepted
**Context:** root-auth planning scoped 4 screens + OTP verification. The resetToken issued by verify-otp needs a set-new-password endpoint; that endpoint needs session/token validation rules which belong to the authz feature.
**Decision:** root-auth delivers through resetToken issuance. Consumption endpoint (`POST /api/auth/reset-password`) ships in feature #2 with tests.
**Rationale:** Avoids silently expanding scope; the token is short-lived (10 min) and useless without the consumption endpoint.
**Consequences:** Password reset end-to-end is not usable until feature #2 lands. Documented in approve.md as known gap.
