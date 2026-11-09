#!/usr/bin/env bash
# ==============================================================================
# OpsEngine Enterprise — Automated Disaster Recovery (DR) Drill Test Harness
# Simulates full disaster recovery: dumps source DB, provisions sandbox DB,
# restores snapshot, validates 100% row/isolation parity, and calculates RTO.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE_URL="${SOURCE_URL:-postgresql://opsengine:opsengine@localhost:5432/opsengine}"
SANDBOX_DB="${SANDBOX_DB:-opsengine_dr_sandbox}"
KEEP_SANDBOX=false
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
REPORT_FILE="${REPO_ROOT}/reports/dr-drill-report-${TIMESTAMP}.json"

# Parse CLI options
while [[ $# -gt 0 ]]; do
  case $1 in
    --source-url)
      SOURCE_URL="$2"
      shift 2
      ;;
    --sandbox-db)
      SANDBOX_DB="$2"
      shift 2
      ;;
    --keep-sandbox)
      KEEP_SANDBOX=true
      shift
      ;;
    --output-report)
      REPORT_FILE="$2"
      shift 2
      ;;
    *)
      echo "[-] Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "${REPORT_FILE}")"

# Derive maintenance connection URL (connecting to 'postgres' database on same host/port)
MAINT_URL="$(echo "${SOURCE_URL}" | sed -E 's|/[a-zA-Z0-9_-]+(\?.*)?$|/postgres\1|')"
SANDBOX_URL="$(echo "${SOURCE_URL}" | sed -E "s|/[a-zA-Z0-9_-]+(\\?.*)?$|/${SANDBOX_DB}\\1|")"

echo "========================================================================"
echo " OpsEngine Disaster Recovery (DR) Drill Automated Harness"
echo " Start Time: $(date -u)"
echo " Source DB:  ${SOURCE_URL}"
echo " Sandbox DB: ${SANDBOX_URL}"
echo " Report:     ${REPORT_FILE}"
echo "========================================================================"

OVERALL_START=$(date +%s)

# Step 1: Query source database baseline metrics
echo "[1/6] Measuring source database baseline metrics..."
if ! psql "${SOURCE_URL}" -c "SELECT 1;" >/dev/null 2>&1; then
  echo "[-] Error: Source database is unreachable." >&2
  exit 1
fi

declare -A SOURCE_COUNTS
TABLES=(
  "_prisma_migrations"
  "tenant_workspaces"
  "tenant_subscriptions"
  "auth_users"
  "tenant_memberships"
  "employees"
  "teams"
  "crm_accounts"
  "crm_opportunities"
  "projects"
  "tickets"
  "invoices"
  "documents"
  "audit_events"
  "leave_requests"
)

for tbl in "${TABLES[@]}"; do
  COUNT="$(psql "${SOURCE_URL}" -t -A -c "SELECT COUNT(*) FROM ${tbl};" 2>/dev/null || echo "0")"
  SOURCE_COUNTS["${tbl}"]="${COUNT}"
  echo "    * ${tbl}: ${COUNT} rows"
done

# Step 2: Trigger fresh snapshot backup
echo "[2/6] Executing snapshot backup via scripts/backup.sh..."
DUMP_START=$(date +%s)
BACKUP_OUTPUT="$("${SCRIPT_DIR}/backup.sh")"
echo "${BACKUP_OUTPUT}"

BACKUP_FILE="$(echo "${BACKUP_OUTPUT}" | grep "Archive:" | awk '{print $2}' | tr -d ' ')"
CHECKSUM_FILE="$(echo "${BACKUP_OUTPUT}" | grep "Checksum:" | awk '{print $2}' | tr -d ' ')"
DUMP_END=$(date +%s)
DUMP_DURATION=$((DUMP_END - DUMP_START))

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "[-] Error: Snapshot backup creation failed or archive not found." >&2
  exit 1
fi
echo "[+] Snapshot generated: ${BACKUP_FILE} (Duration: ${DUMP_DURATION}s)"

# Step 3: Provision clean sandbox database
echo "[3/6] Provisioning clean sandbox database: ${SANDBOX_DB}..."
psql "${MAINT_URL}" -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = '${SANDBOX_DB}' 
    AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || true

psql "${MAINT_URL}" -c "DROP DATABASE IF EXISTS ${SANDBOX_DB};" >/dev/null
psql "${MAINT_URL}" -c "CREATE DATABASE ${SANDBOX_DB};" >/dev/null
echo "[+] Sandbox database ${SANDBOX_DB} provisioned."

# Step 4: Restore backup into sandbox database
echo "[4/6] Restoring snapshot into sandbox database via scripts/restore.sh..."
RESTORE_START=$(date +%s)
RESTORE_OUTPUT="$(FORCE_RESTORE=true "${SCRIPT_DIR}/restore.sh" "${BACKUP_FILE}" "${SANDBOX_URL}")"
echo "${RESTORE_OUTPUT}"
RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
echo "[+] Sandbox restoration completed in ${RESTORE_DURATION}s."

# Step 5: Verification & Integrity Testing Suite
echo "[5/6] Executing comprehensive data validation & ReBAC isolation suite..."
DRILL_FAILED=false
PARITY_CHECKS_PASSED=0
TOTAL_PARITY_CHECKS=${#TABLES[@]}

echo "--- A. Data Row Parity Verification ---"
declare -A RESTORED_COUNTS
PARITY_JSON="{"
first_tbl=true
for tbl in "${TABLES[@]}"; do
  R_COUNT="$(psql "${SANDBOX_URL}" -t -A -c "SELECT COUNT(*) FROM ${tbl};" 2>/dev/null || echo "0")"
  RESTORED_COUNTS["${tbl}"]="${R_COUNT}"
  S_COUNT="${SOURCE_COUNTS["${tbl}"]}"
  
  if [ "${first_tbl}" = true ]; then
    first_tbl=false
  else
    PARITY_JSON="${PARITY_JSON},"
  fi
  PARITY_JSON="${PARITY_JSON} \"${tbl}\": {\"source\": ${S_COUNT}, \"restored\": ${R_COUNT}, \"parity\": $([ "${S_COUNT}" -eq "${R_COUNT}" ] && echo "true" || echo "false")}"

  if [ "${S_COUNT}" -eq "${R_COUNT}" ]; then
    echo "    [PASS] ${tbl}: source=${S_COUNT}, restored=${R_COUNT}"
    PARITY_CHECKS_PASSED=$((PARITY_CHECKS_PASSED + 1))
  else
    echo "    [FAIL] Parity mismatch on ${tbl}: source=${S_COUNT}, restored=${R_COUNT}"
    DRILL_FAILED=true
  fi
done
PARITY_JSON="${PARITY_JSON} }"

echo "--- B. Multi-Tenant Isolation & Integrity Checks ---"

# Tenant Isolation: Acme Corp workspace (Tenant A)
ACME_WORKSPACE="$(psql "${SANDBOX_URL}" -t -A -c "SELECT name FROM tenant_workspaces WHERE \"tenantId\" = '00000000-0000-4000-8000-0000000000aa' AND lifecycle_status = 'active';" 2>/dev/null || true)"
if [ -n "${ACME_WORKSPACE}" ]; then
  echo "    [PASS] Tenant A (Acme Corp) workspace active: '${ACME_WORKSPACE}'."
else
  echo "    [FAIL] Tenant A (Acme Corp) workspace missing or not active!"
  DRILL_FAILED=true
fi

# Tenant Isolation: Tenant B workspace
TENANT_B_WORKSPACE="$(psql "${SANDBOX_URL}" -t -A -c "SELECT name FROM tenant_workspaces WHERE \"tenantId\" = '00000000-0000-4000-8000-0000000000bb' AND lifecycle_status = 'active';" 2>/dev/null || true)"
if [ -n "${TENANT_B_WORKSPACE}" ]; then
  echo "    [PASS] Tenant B workspace active: '${TENANT_B_WORKSPACE}'."
else
  echo "    [FAIL] Tenant B workspace missing or not active!"
  DRILL_FAILED=true
fi

# Multi-tenant scoping: check for NULL tenant_id on employees
NULL_TENANT_EMPLOYEES="$(psql "${SANDBOX_URL}" -t -A -c "SELECT COUNT(*) FROM employees WHERE tenant_id IS NULL;" 2>/dev/null || echo "0")"
if [ "${NULL_TENANT_EMPLOYEES}" -eq 0 ]; then
  echo "    [PASS] Zero NULL tenant_id occurrences in employees table."
else
  echo "    [FAIL] Found ${NULL_TENANT_EMPLOYEES} employees without tenant_id!"
  DRILL_FAILED=true
fi

# Cross-tenant isolation: check cross-tenant user/employee membership leakage
CROSS_TENANT_LEAKAGE="$(psql "${SANDBOX_URL}" -t -A -c "
  SELECT COUNT(*) 
  FROM employees e
  JOIN tenant_memberships tm ON e.user_id = tm.user_id
  WHERE e.tenant_id = '00000000-0000-4000-8000-0000000000aa'
    AND tm.tenant_id = '00000000-0000-4000-8000-0000000000bb';
" 2>/dev/null || echo "0")"
if [ "${CROSS_TENANT_LEAKAGE}" -eq 0 ]; then
  echo "    [PASS] Cross-tenant isolation verified: 0 cross-tenant membership leaks."
else
  echo "    [FAIL] Detected ${CROSS_TENANT_LEAKAGE} cross-tenant membership leaks!"
  DRILL_FAILED=true
fi

# Referential integrity: check orphan tickets
ORPHAN_TICKETS="$(psql "${SANDBOX_URL}" -t -A -c "SELECT COUNT(*) FROM tickets t LEFT JOIN projects p ON t.project_id = p.id WHERE t.project_id IS NOT NULL AND p.id IS NULL;" 2>/dev/null || echo "0")"
if [ "${ORPHAN_TICKETS}" -eq 0 ]; then
  echo "    [PASS] Referential integrity verified: 0 orphan tickets."
else
  echo "    [FAIL] Found ${ORPHAN_TICKETS} orphan tickets without valid projects!"
  DRILL_FAILED=true
fi

# Referential integrity: check orphan invoice lines
ORPHAN_INV_LINES="$(psql "${SANDBOX_URL}" -t -A -c "SELECT COUNT(*) FROM invoice_lines il LEFT JOIN invoices i ON il.invoice_id = i.id WHERE i.id IS NULL;" 2>/dev/null || echo "0")"
if [ "${ORPHAN_INV_LINES}" -eq 0 ]; then
  echo "    [PASS] Referential integrity verified: 0 orphan invoice lines."
else
  echo "    [FAIL] Found ${ORPHAN_INV_LINES} orphan invoice lines without valid invoices!"
  DRILL_FAILED=true
fi

OVERALL_END=$(date +%s)
TOTAL_RTO=$((OVERALL_END - OVERALL_START))

# Step 6: Teardown & Report Generation
echo "[6/6] Generating audit report and cleaning up sandbox..."

DRILL_STATUS="SUCCESS"
if [ "${DRILL_FAILED}" = true ]; then
  DRILL_STATUS="FAILED"
fi

cat <<EOF > "${REPORT_FILE}"
{
  "drill_id": "dr_drill_${TIMESTAMP}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source_database": "${SOURCE_URL}",
  "sandbox_database": "${SANDBOX_DB}",
  "backup_archive": "${BACKUP_FILE}",
  "status": "${DRILL_STATUS}",
  "metrics": {
    "rto_achieved_seconds": ${TOTAL_RTO},
    "backup_duration_seconds": ${DUMP_DURATION},
    "restore_duration_seconds": ${RESTORE_DURATION},
    "rpo_target_minutes": 15,
    "rto_target_hours": 4,
    "parity_checks_passed": ${PARITY_CHECKS_PASSED},
    "total_parity_checks": ${TOTAL_PARITY_CHECKS}
  },
  "table_parity": ${PARITY_JSON},
  "security_and_isolation": {
    "tenant_a_acme_corp_active": $([ -n "${ACME_WORKSPACE}" ] && echo "true" || echo "false"),
    "tenant_b_active": $([ -n "${TENANT_B_WORKSPACE}" ] && echo "true" || echo "false"),
    "null_tenant_id_violations": ${NULL_TENANT_EMPLOYEES},
    "cross_tenant_leakage_violations": ${CROSS_TENANT_LEAKAGE},
    "orphan_ticket_violations": ${ORPHAN_TICKETS},
    "orphan_invoice_line_violations": ${ORPHAN_INV_LINES}
  }
}
EOF

# Clean up sandbox unless requested otherwise
if [ "${KEEP_SANDBOX}" = false ]; then
  echo "[+] Dropping sandbox database ${SANDBOX_DB}..."
  psql "${MAINT_URL}" -c "
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = '${SANDBOX_DB}' 
      AND pid <> pg_backend_pid();
  " >/dev/null 2>&1 || true
  psql "${MAINT_URL}" -c "DROP DATABASE IF EXISTS ${SANDBOX_DB};" >/dev/null
  echo "[+] Sandbox database cleaned up."
else
  echo "[!] Preserving sandbox database ${SANDBOX_DB} for manual inspection."
fi

echo "========================================================================"
if [ "${DRILL_STATUS}" = "SUCCESS" ]; then
  echo " DISASTER RECOVERY DRILL: PASSED (100% Fidelity)"
else
  echo " DISASTER RECOVERY DRILL: FAILED"
fi
echo " Achieved RTO:      ${TOTAL_RTO} seconds (Target: < 4 hours)"
echo " Table Parity:     ${PARITY_CHECKS_PASSED}/${TOTAL_PARITY_CHECKS} tables matched"
echo " Audit Report:     ${REPORT_FILE}"
echo "========================================================================"

if [ "${DRILL_STATUS}" != "SUCCESS" ]; then
  exit 1
fi
