#!/usr/bin/env bash
# ==============================================================================
# OpsEngine Enterprise — Checksum-Verified Database Restoration Engine
# Validates SHA-256 integrity, terminates locks, and restores custom pg_dump archives.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
BACKUP_FILE="${1:-}"
TARGET_DATABASE_URL="${2:-${TARGET_DATABASE_URL:-${DATABASE_URL:-postgresql://opsengine:opsengine@localhost:5432/opsengine}}}"
FORCE_RESTORE="${FORCE_RESTORE:-false}"

echo "========================================================================"
echo " OpsEngine Database Restoration Engine"
echo " Time: $(date -u)"
echo " Target DB: ${TARGET_DATABASE_URL}"
echo "========================================================================"

# 1. Resolve Backup File
if [ -z "${BACKUP_FILE}" ]; then
  echo "[+] No backup file specified. Locating latest snapshot in ${BACKUP_DIR}..."
  BACKUP_FILE="$(find "${BACKUP_DIR}" -maxdepth 1 -name "opsengine_backup_*.dump" -printf "%T@ %p\n" 2>/dev/null | sort -n | tail -n 1 | cut -d' ' -f2- || true)"
  if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
    echo "[-] Error: No backup dump files found in ${BACKUP_DIR}." >&2
    exit 1
  fi
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[-] Error: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "[+] Selected backup file: ${BACKUP_FILE}"

# 2. Cryptographic SHA-256 Checksum Verification
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "[+] Validating SHA-256 checksum integrity..."
  EXPECTED_HASH="$(awk '{print $1}' "${CHECKSUM_FILE}")"
  ACTUAL_HASH="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"

  if [ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]; then
    echo "[-] CRITICAL SECURITY ALERT: Checksum mismatch detected!" >&2
    echo "    Expected: ${EXPECTED_HASH}" >&2
    echo "    Actual:   ${ACTUAL_HASH}" >&2
    echo "    The backup archive may be corrupted or tampered with. Aborting restoration." >&2
    exit 1
  fi
  echo "[+] SHA-256 checksum verified: ${ACTUAL_HASH} [PASS]"
else
  echo "[!] Warning: No checksum file found at ${CHECKSUM_FILE}. Proceeding without verification."
fi

# 3. Read Manifest Metadata
MANIFEST_FILE="${BACKUP_FILE}.manifest.json"
if [ -f "${MANIFEST_FILE}" ]; then
  echo "[+] Manifest metadata found:"
  if command -v jq >/dev/null 2>&1; then
    jq -r '"    Backup ID: " + .backup_id + "\n    Timestamp: " + .timestamp + "\n    Prisma Migration: " + .latest_prisma_migration + "\n    Size: " + .archive_size_human' "${MANIFEST_FILE}"
  else
    cat "${MANIFEST_FILE}"
  fi
fi

# 4. Target Database Safety Check
if [[ "${TARGET_DATABASE_URL}" == *"opsengine" ]] && [[ "${TARGET_DATABASE_URL}" != *"_dr_"* ]] && [[ "${TARGET_DATABASE_URL}" != *"_sandbox"* ]]; then
  if [ "${FORCE_RESTORE}" != "true" ] && [ "${FORCE_RESTORE}" != "1" ]; then
    echo ""
    echo "[!] WARNING: Target database appears to be PRIMARY / PRODUCTION (${TARGET_DATABASE_URL})."
    echo "    Restoration will OVERWRITE existing data and drop active tables."
    if [ -t 0 ]; then
      read -rp "    Type 'RESTORE_PRODUCTION' to continue: " CONFIRMATION
      if [ "${CONFIRMATION}" != "RESTORE_PRODUCTION" ]; then
        echo "[-] Restoration aborted by user."
        exit 1
      fi
    else
      echo "[-] Non-interactive execution without FORCE_RESTORE=true. Aborting to safeguard primary DB." >&2
      exit 1
    fi
  fi
fi

# 5. Check Target Connectivity
echo "[+] Checking target database connectivity..."
if ! psql "${TARGET_DATABASE_URL}" -c "SELECT 1;" >/dev/null 2>&1; then
  echo "[-] Error: Target database unreachable at ${TARGET_DATABASE_URL}." >&2
  exit 1
fi

# 6. Terminate Idle / Competing Connections
echo "[+] Terminating existing non-backend client connections on target DB..."
psql "${TARGET_DATABASE_URL}" -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = current_database() 
    AND pid <> pg_backend_pid()
    AND backend_type = 'client backend';
" >/dev/null 2>&1 || true

# 7. Execute pg_restore
START_TIME="$(date +%s)"
echo "[+] Restoring database snapshot via pg_restore..."

# Run pg_restore; allow non-fatal clean drops
set +e
pg_restore --clean --if-exists --no-owner --no-privileges -d "${TARGET_DATABASE_URL}" "${BACKUP_FILE}" 2>/tmp/pg_restore_stderr.log
RESTORE_STATUS=$?
set -e

if [ ${RESTORE_STATUS} -ne 0 ]; then
  # Check if failures were just non-fatal warnings (e.g. drop table if exists errors)
  if grep -qi "fatal" /tmp/pg_restore_stderr.log; then
    echo "[-] Fatal error during pg_restore:" >&2
    cat /tmp/pg_restore_stderr.log >&2
    exit 1
  fi
fi

END_TIME="$(date +%s)"
DURATION=$((END_TIME - START_TIME))
echo "[+] pg_restore execution completed in ${DURATION}s."

# 8. Post-Restoration Verification Query
echo "[+] Running post-restore verification checks on target..."
TARGET_WORKSPACES="$(psql "${TARGET_DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM tenant_workspaces;" 2>/dev/null || echo "0")"
TARGET_USERS="$(psql "${TARGET_DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM auth_users;" 2>/dev/null || echo "0")"
TARGET_EMPLOYEES="$(psql "${TARGET_DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM employees;" 2>/dev/null || echo "0")"

echo "    - Restored Tenant Workspaces: ${TARGET_WORKSPACES}"
echo "    - Restored Auth Users:       ${TARGET_USERS}"
echo "    - Restored Employees:        ${TARGET_EMPLOYEES}"

if [ "${TARGET_WORKSPACES}" -eq 0 ] && [ "${TARGET_USERS}" -eq 0 ]; then
  echo "[-] Verification Failed: Target database has 0 workspaces and 0 users!" >&2
  exit 1
fi

echo "========================================================================"
echo " Database Restoration Completed Successfully!"
echo " Duration:    ${DURATION} seconds"
echo " Verified DB: ${TARGET_DATABASE_URL}"
echo "========================================================================"
