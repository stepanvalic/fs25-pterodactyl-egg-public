#!/bin/bash
# FORCE_UPDATE bookkeeping, sourced by start.sh.
#
# The panel toggle is the update request. A container cannot switch a panel
# variable back off, so "one-shot" is tracked here instead: every off -> on change
# seen across boots gets its own refresh ID. The key is therefore POSTed once per
# switch-on (reusing the INSTALLER_POLICY=latest guard), restarts with the toggle
# still on reuse that ID, and install-game.sh --update never installs the same
# release twice. Only ${DATA_DIR}/.download-state is written; game data is not.
force_update_prepare() {
    local state="${DATA_DIR}/.download-state" count
    FORCE_UPDATE_ENABLED=0
    FORCE_UPDATE_NEW=0
    case "${FORCE_UPDATE:-false}" in
        1|true|yes|on) FORCE_UPDATE_ENABLED=1 ;;
    esac
    mkdir -p "$state" || return 1
    chmod 700 "$state"

    if [ "$FORCE_UPDATE_ENABLED" -eq 0 ]; then
        touch "$state/force-update-armed"
        return 0
    fi
    if [ -f "$state/force-update-armed" ] || [ ! -s "$state/force-update-id" ]; then
        # Counter + time: unique even if .download-state is wiped while
        # installer/releases (and its .installed markers) survive.
        count=$(cut -d- -f2 "$state/force-update-id" 2>/dev/null || echo 0)
        [[ "$count" =~ ^[0-9]+$ ]] || count=0
        printf 'force-%s-%s\n' "$((count + 1))" "$(date -u +%Y%m%dT%H%M%SZ)" \
            > "$state/force-update-id" || return 1
        rm -f "$state/force-update-armed"
        FORCE_UPDATE_NEW=1
    fi
    INSTALLER_POLICY=latest
    INSTALLER_REFRESH_ID=$(cat "$state/force-update-id")
    export INSTALLER_POLICY INSTALLER_REFRESH_ID
}
