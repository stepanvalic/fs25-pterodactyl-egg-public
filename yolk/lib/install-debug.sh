#!/bin/bash
# Persistent, secret-free disk snapshots. Prefix includes game; totals overlap.
install_debug_init() {
    FS25_INSTALL_LOG_DIR="${DATA_DIR:-${INSTALLER_DIR}/../data}/install-logs"
    mkdir -p "$FS25_INSTALL_LOG_DIR" || return 1
    chmod 700 "$FS25_INSTALL_LOG_DIR"
    FS25_INSTALL_RUN="$FS25_INSTALL_LOG_DIR/$(date -u +%Y%m%dT%H%M%SZ)-$$"
    FS25_DISK_LOG="${FS25_INSTALL_RUN}-disk.log"
    FS25_STEP_PID=""
    FS25_MONITOR_PID=""
    umask 077
    echo "[fs25/install] Diagnostics: $FS25_INSTALL_RUN"
    echo "[fs25/install] df shows filesystem space, NOT necessarily the Wings server disk quota."
    echo "[fs25/install] Retained image + extracted setup + installed game coexist during installation."
}

disk_snapshot() {
    {
        printf '\n[fs25/disk] %s stage=%s (sizes in KiB)\n' "$(date -u +%FT%TZ)" "$1"
        df -Pk "${INSTALLER_DIR}" /tmp
        df -Pi "${INSTALLER_DIR}" /tmp
        local label dir
        for label in installer game wine-prefix data tmp; do
            case "$label" in
                installer) dir="$INSTALLER_DIR" ;;
                game) dir="$GAME_DIR" ;;
                wine-prefix) dir="$WINEPREFIX" ;;
                data) dir="${DATA_DIR:-${DOCS_DIR}}" ;;
                tmp) dir=/tmp ;;
            esac
            [ -d "$dir" ] || continue
            printf '[fs25/disk] %s: ' "$label"
            du -sk "$dir" 2>/dev/null || true
        done
        echo '[fs25/disk] wine-prefix includes game; do not add these two numbers.'
    } 2>&1 | tee -a "$FS25_DISK_LOG" >&2
}

stop_install_monitor() {
    if [ -n "${FS25_MONITOR_PID:-}" ]; then
        kill "$FS25_MONITOR_PID" 2>/dev/null || true
        wait "$FS25_MONITOR_PID" 2>/dev/null || true
        FS25_MONITOR_PID=""
    fi
}

install_interrupted() {
    trap '' INT TERM
    stop_install_monitor
    echo '[fs25/install] Interrupted by signal; check Wings disk quota. Partial files are retained.' >&2
    if [ -n "${FS25_STEP_PID:-}" ]; then
        kill "$FS25_STEP_PID" 2>/dev/null || true
        wineserver -k 2>/dev/null || true
    fi
    disk_snapshot interrupted
    exit 143
}

run_install_step() {
    local stage="$1" rc=0 started=$SECONDS
    shift
    disk_snapshot "before-$stage"
    "$@" &
    FS25_STEP_PID=$!
    (
        sleep_pid=""
        trap 'kill "$sleep_pid" 2>/dev/null || true; exit 0' INT TERM
        while kill -0 "$FS25_STEP_PID" 2>/dev/null; do
            sleep 30 & sleep_pid=$!
            wait "$sleep_pid" || exit 0
            kill -0 "$FS25_STEP_PID" 2>/dev/null || break
            disk_snapshot "$stage"
        done
    ) &
    FS25_MONITOR_PID=$!
    wait "$FS25_STEP_PID" || rc=$?
    FS25_STEP_PID=""
    stop_install_monitor
    echo "[fs25/install] stage=$stage exit=$rc elapsed=$((SECONDS-started))s" >&2
    disk_snapshot "after-$stage"
    return "$rc"
}

base_game_files_present() {
    [ -s "${GAME_DIR}/dedicatedServer.exe" ] &&
    [ -s "${GAME_DIR}/FarmingSimulator2025.exe" ] &&
    [ -s "${GAME_DIR}/x64/FarmingSimulator2025Game.exe" ] &&
    [ -s "${GAME_DIR}/dataS.gar" ]
}

# Presence only; GIANTS still validates the license at runtime.
license_files_present() {
    local token suffix
    for token in "${DOCS_DIR}"/AHT_*.dat; do
        [ -s "$token" ] || continue
        suffix=${token##*/AHT_}
        [ -s "${DOCS_DIR}/AHC_${suffix}" ] && return 0
    done
    return 1
}
