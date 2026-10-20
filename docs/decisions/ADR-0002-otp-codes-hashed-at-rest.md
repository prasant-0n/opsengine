# ADR-0002: OTP codes hashed at rest
**Date:** 2026-10-19
**Status:** Accepted
**Context:** 6-digit codes are low-entropy; storing them in plaintext makes any DB read an immediate account-takeover vector for root admins.
**Decision:** Store SHA-256 of the code. Plaintext exists only in the outbound email.
**Rationale:** Low-entropy secrets must be hashed even without salt-per-row — the code is short-lived (10 min) and single-use, so per-row salt adds negligible benefit against offline brute force of one row.
**Consequences:** Cannot recover a code from DB (desired). Email is the sole delivery channel.
