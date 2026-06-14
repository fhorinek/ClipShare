#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d .venv ]; then
    python3 -m venv .venv
    .venv/bin/pip install -q -r requirements.txt
fi

TURN_ENV_FILE="${TURN_ENV_FILE:-.turn.env}"
TURN_HOST="${TURN_HOST:-clip.horinek.sk}"
TURN_LISTEN_IP="${TURN_LISTEN_IP:-0.0.0.0}"
TURN_PORT="${TURN_PORT:-3478}"
TURN_MIN_PORT="${TURN_MIN_PORT:-49160}"
TURN_MAX_PORT="${TURN_MAX_PORT:-49200}"
TURN_REALM="${TURN_REALM:-$TURN_HOST}"
TURN_USERNAME="${TURN_USERNAME:-clipshare}"
TURN_LOG="${TURN_LOG:-logs/turnserver.log}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-8000}"

if [ -f "$TURN_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$TURN_ENV_FILE"
else
    TURN_PASSWORD="${TURN_PASSWORD:-$(openssl rand -hex 24)}"
    TURN_AUTH_SECRET="${TURN_AUTH_SECRET:-$(openssl rand -hex 32)}"
    umask 077
    {
        printf 'TURN_HOST=%s\n' "$TURN_HOST"
        printf 'TURN_LISTEN_IP=%s\n' "$TURN_LISTEN_IP"
        printf 'TURN_PORT=%s\n' "$TURN_PORT"
        printf 'TURN_MIN_PORT=%s\n' "$TURN_MIN_PORT"
        printf 'TURN_MAX_PORT=%s\n' "$TURN_MAX_PORT"
        printf 'TURN_REALM=%s\n' "$TURN_REALM"
        printf 'TURN_USERNAME=%s\n' "$TURN_USERNAME"
        printf 'TURN_PASSWORD=%s\n' "$TURN_PASSWORD"
        printf 'TURN_AUTH_SECRET=%s\n' "$TURN_AUTH_SECRET"
    } > "$TURN_ENV_FILE"
    echo "Created $TURN_ENV_FILE with TURN credentials."
fi

if [ -z "${TURN_AUTH_SECRET:-}" ]; then
    TURN_AUTH_SECRET="$(openssl rand -hex 32)"
    printf 'TURN_AUTH_SECRET=%s\n' "$TURN_AUTH_SECRET" >> "$TURN_ENV_FILE"
    echo "Added TURN_AUTH_SECRET to $TURN_ENV_FILE."
fi

TURN_EXTERNAL_ARGS=()
if [ "${TURN_EXTERNAL_IP:-}" ]; then
    TURN_EXTERNAL_ARGS=(--external-ip "$TURN_EXTERNAL_IP")
fi

TURN_RELAY_ARGS=()
if [ "${TURN_RELAY_IP:-}" ]; then
    TURN_RELAY_ARGS=(--relay-ip "$TURN_RELAY_IP")
fi

mkdir -p "$(dirname "$TURN_LOG")"

if command -v turnserver >/dev/null 2>&1; then
    TURN_AUTH_ARGS=(
        --use-auth-secret
        --static-auth-secret "$TURN_AUTH_SECRET"
    )
    if [ -z "${TURN_AUTH_SECRET:-}" ]; then
        TURN_AUTH_ARGS=(--lt-cred-mech --user "$TURN_USERNAME:$TURN_PASSWORD")
    fi
    turnserver -n \
        --listening-ip "$TURN_LISTEN_IP" \
        --listening-port "$TURN_PORT" \
        --min-port "$TURN_MIN_PORT" \
        --max-port "$TURN_MAX_PORT" \
        --realm "$TURN_REALM" \
        --server-name "$TURN_REALM" \
        "${TURN_AUTH_ARGS[@]}" \
        --fingerprint \
        --no-cli \
        --no-tls \
        --no-dtls \
        --no-multicast-peers \
        --log-file "$TURN_LOG" \
        --simple-log \
        "${TURN_RELAY_ARGS[@]}" \
        "${TURN_EXTERNAL_ARGS[@]}" &
    TURN_PID=$!
    trap 'kill "$TURN_PID" 2>/dev/null || true' EXIT
    sleep 0.5
    if ! kill -0 "$TURN_PID" 2>/dev/null; then
        echo "turnserver failed to start. Check $TURN_LOG." >&2
        exit 1
    fi
    echo "TURN/STUN listening on $TURN_HOST:$TURN_PORT, relay UDP ports $TURN_MIN_PORT-$TURN_MAX_PORT."
else
    echo "turnserver is not installed; WebRTC will use any externally provided WEBRTC_ICE_SERVERS_JSON only." >&2
fi

if [ -z "${WEBRTC_ICE_SERVERS_JSON:-}" ] && [ -z "${TURN_AUTH_SECRET:-}" ]; then
    WEBRTC_ICE_SERVERS_JSON=$(printf '[{"urls":["stun:%s:%s"]},{"urls":["turn:%s:%s?transport=udp","turn:%s:%s?transport=tcp"],"username":"%s","credential":"%s"}]' \
        "$TURN_HOST" "$TURN_PORT" \
        "$TURN_HOST" "$TURN_PORT" \
        "$TURN_HOST" "$TURN_PORT" \
        "$TURN_USERNAME" "$TURN_PASSWORD")
    export WEBRTC_ICE_SERVERS_JSON
fi

.venv/bin/uvicorn main:app --reload --host "$APP_HOST" --port "$APP_PORT"
