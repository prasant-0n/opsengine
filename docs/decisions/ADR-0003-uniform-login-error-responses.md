# ADR-0003: Uniform login error responses
**Date:** 2026-10-19
**Status:** Accepted
**Context:** Separate "organization not found" vs "invalid credentials" messages enable domain enumeration by unauthenticated attackers.
**Decision:** All login failures return HTTP 401 `{"error":"Invalid credentials"}`.
**Rationale:** Safer configurable behaviour; no legitimate workflow needs the distinction client-side.
**Consequences:** Helpdesk debugging relies on server logs, not API responses.
