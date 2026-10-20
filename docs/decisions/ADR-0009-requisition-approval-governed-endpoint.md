# ADR-0009: Requisition approval is a governed endpoint, not a PATCH transition
**Date:** 2026-10-19
**Status:** Accepted (feature ats-recruitment)
**Context:** The requisition transition matrix allows submitted→approved, so a generic `PATCH {status:"approved"}` would have worked — but without approvedBy/At, stage-history reason, or an audit event, silently bypassing the approval governance the PRD requires.
**Decision:** `PATCH` rejects `approved`/`rejected` with 400 `GOVERNED_ACTION`. Only `POST /api/ats/requisitions/[id]/approve` (permission `recruit.requisition.approve`, audit-enabled incl. denials) may set those statuses; unknown `action` values are rejected (no defaulting). UI exposes approve/reject buttons only.
**Rationale:** Approvals must leave an attributable audit trail; dual paths would let a UI bug or API consumer erase the governance record.
**Consequences:** The unit-tested transition matrix (`canTransitionRequisition`) still describes reachability, but route layer narrows it; any future bulk tools must call the approve endpoint. Verified by Chrome probe asserting PATCH bypass = 400.
