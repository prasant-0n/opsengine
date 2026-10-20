import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { myTeamQuery } from "@/features/organization/lib/team";

export const dynamic = "force-dynamic";

// My Team is a subject-relative view: it returns only the viewer's own direct
// reports and their own team memberships — data the viewer is always in scope
// for by construction (PRD §3.4.4 SELF/TEAM relationships). Authorization here
// is therefore permission presence on either time.report.read_team or
// org.read_directory (non-SELF scope); the query itself is tenant- and
// subject-predicated server-side. Globex (SELF only) must get 403.
export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const ctx = await buildAuthContext(token);
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const allowed =
    ctx.permissions.some((p) => p.key === PERMISSIONS.TIME_REPORT_READ_TEAM) ||
    ctx.permissions.some(
      (p) => p.key === PERMISSIONS.ORG_READ_DIRECTORY && p.scopeType !== "SELF",
    );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await myTeamQuery(ctx);
  return NextResponse.json(result);
}
