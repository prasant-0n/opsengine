#!/usr/bin/env bash
# ==============================================================================
# OpsEngine Enterprise — Automated Database Backup Engine
# Generates compressed custom-format pg_dump, SHA-256 checksum, and metadata manifest.
# ==============================================================================

set -euo pipefail

# Configuration defaults
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DATABASE_URL="${DATABASE_URL:-postgresql://opsengine:opsengine@localhost:5432/opsengine}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
RETENTION_COUNT="${RETENTION_COUNT:-10}"

TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_FILENAME="opsengine_backup_${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
CHECKSUM_PATH="${BACKUP_PATH}.sha256"
MANIFEST_PATH="${BACKUP_PATH}.manifest.json"

echo "========================================================================"
echo " OpsEngine Backup Engine — Starting Database Snapshot"
echo " Time: $(date -u)"
echo " Database: ${DATABASE_URL}"
echo " Destination: ${BACKUP_PATH}"
echo "========================================================================"

mkdir -p "${BACKUP_DIR}"

# 1. Verify pg_dump and psql availability
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[-] Error: pg_dump utility not found in PATH." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[-] Error: psql utility not found in PATH." >&2
  exit 1
fi

# 2. Check source connectivity
echo "[+] Checking database connectivity..."
if ! psql "${DATABASE_URL}" -c "SELECT 1;" >/dev/null 2>&1; then
  echo "[-] Error: Cannot connect to source database ${DATABASE_URL}" >&2
  exit 1
fi

# 3. Gather pre-dump metadata
echo "[+] Gathering database catalog metrics..."
PG_VERSION="$(psql "${DATABASE_URL}" -t -A -c "SELECT version();" 2>/dev/null || echo "Unknown")"
LATEST_MIGRATION="$(psql "${DATABASE_URL}" -t -A -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;" 2>/dev/null || echo "None")"

COUNT_WORKSPACES="$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM tenant_workspaces;" 2>/dev/null || echo "0")"
COUNT_USERS="$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM auth_users;" 2>/dev/null || echo "0")"
COUNT_EMPLOYEES="$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM employees;" 2>/dev/null || echo "0")"
COUNT_TICKETS="$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM tickets;" 2>/dev/null || echo "0")"
COUNT_INVOICES="$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM invoices;" 2>/dev/null || echo "0")"
COUNT_AUDIT_LOGS="$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM audit_events;" 2>/dev/null || echo "0")"

# 4. Execute pg_dump
START_TIME="$(date +%s)"
echo "[+] Executing pg_dump (format: custom, compressed)..."
pg_dump -Fc --no-owner --no-privileges "${DATABASE_URL}" -f "${BACKUP_PATH}"
END_TIME="$(date +%s)"
DURATION=$((END_TIME - START_TIME))

FILE_SIZE_BYTES="$(stat -c%s "${BACKUP_PATH}" 2>/dev/null || stat -f%z "${BACKUP_PATH}" 2>/dev/null || wc -c < "${BACKUP_PATH}")"
HUMAN_SIZE="$(numfmt --to=iec-i --suffix=B "${FILE_SIZE_BYTES}" 2>/dev/null || echo "${FILE_SIZE_BYTES} bytes")"

echo "[+] Snapshot created successfully in ${DURATION}s (${HUMAN_SIZE})."

# 5. Compute SHA-256 checksum
echo "[+] Generating cryptographic SHA-256 checksum..."
SHA256_HASH="$(sha256sum "${BACKUP_PATH}" | awk '{print $1}')"
echo "${SHA256_HASH}  ${BACKUP_FILENAME}" > "${CHECKSUM_PATH}"
echo "[+] Checksum: ${SHA256_HASH}"

# 6. Generate Manifest JSON
echo "[+] Writing metadata manifest: ${MANIFEST_PATH}..."
cat <<EOF > "${MANIFEST_PATH}"
{
  "backup_id": "backup_${TIMESTAMP}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "archive_file": "${BACKUP_FILENAME}",
  "archive_size_bytes": ${FILE_SIZE_BYTES},
  "archive_size_human": "${HUMAN_SIZE}",
  "sha256_checksum": "${SHA256_HASH}",
  "dump_duration_seconds": ${DURATION},
  "pg_version": "${PG_VERSION}",
  "latest_prisma_migration": "${LATEST_MIGRATION}",
  "metadata": {
    "tenant_workspaces": ${COUNT_WORKSPACES},
    "auth_users": ${COUNT_USERS},
    "employees": ${COUNT_EMPLOYEES},
    "tickets": ${COUNT_TICKETS},
    "invoices": ${COUNT_INVOICES},
    "audit_events": ${COUNT_AUDIT_LOGS}
  },
  "status": "COMPLETED"
}
EOF

# 7. Apply retention policy
echo "[+] Applying backup retention policy (keeping latest ${RETENTION_COUNT} dumps)..."
BACKUP_COUNT="$(find "${BACKUP_DIR}" -maxdepth 1 -name "opsengine_backup_*.dump" | wc -l)"
if [ "${BACKUP_COUNT}" -gt "${RETENTION_COUNT}" ]; then
  PRUNE_COUNT=$((BACKUP_COUNT - RETENTION_COUNT))
  echo "[+] Found ${BACKUP_COUNT} backups; pruning ${PRUNE_COUNT} older snapshot(s)..."
  find "${BACKUP_DIR}" -maxdepth 1 -name "opsengine_backup_*.dump" -printf "%T@ %p\n" | \
    sort -n | head -n "${PRUNE_COUNT}" | cut -d' ' -f2- | while read -r old_dump; do
      echo "    - Removing old backup: $(basename "${old_dump}")"
      rm -f "${old_dump}" "${old_dump}.sha256" "${old_dump}.manifest.json"
    done
fi

echo "========================================================================"
echo " Backup Completed Successfully!"
echo " Archive:  ${BACKUP_PATH}"
echo " Checksum: ${CHECKSUM_PATH}"
echo " Manifest: ${MANIFEST_PATH}"
echo " Size:     ${HUMAN_SIZE}"
echo "========================================================================"
