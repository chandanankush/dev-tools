#!/usr/bin/env bash
# Runs ON the deploy host (piped over SSH by the Jenkinsfile) right after `docker run`.
# `docker run -d` returns as soon as the container starts, so without this a deploy can
# report SUCCESS while the app is down or its data volume is missing.
#
# usage: bash -s -- <container> <data-volume-name> <data-dir>
set -euo pipefail

app="${1:?container name required}"
volume="${2:?data volume name required}"
data_dir="${3:?data directory required}"

fail() {
  echo "ERROR: $1" >&2
  echo "--- last container logs:" >&2
  docker logs --tail 40 "$app" >&2 || true
  exit 1
}

is_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$app" 2>/dev/null || echo false)" = "true" ]
}

for _ in $(seq 1 15); do
  is_running && break
  sleep 2
done
is_running || fail "container '$app' is not running"
echo "Container '$app' is running"

mounts="$(docker inspect -f '{{range .Mounts}}{{.Type}}:{{.Name}}:{{.Destination}} {{end}}' "$app")"
case " $mounts " in
  *" volume:$volume:$data_dir "*) echo "Volume '$volume' is mounted at $data_dir" ;;
  *) fail "expected volume '$volume' mounted at $data_dir (the visitor count would reset on every deploy); found: ${mounts:-nothing}" ;;
esac

# Runs as the container's user, so a root-owned volume is caught here rather than as a silent 500 later.
docker exec "$app" sh -c "touch '$data_dir/.write-test' && rm -f '$data_dir/.write-test'" ||
  fail "$data_dir is not writable by the app user (volume owned by root? see docs/DEPLOYMENT.md)"
echo "$data_dir is writable by the app user"

# Next's standalone server listens on $HOSTNAME (the container's own address), not 127.0.0.1.
probe="fetch('http://'+(process.env.HOSTNAME||'127.0.0.1')+':'+(process.env.PORT||3050)+'/api/visits').then(async r=>{const b=await r.json();process.exit(r.ok&&Number.isInteger(b.count)?0:1)}).catch(()=>process.exit(1))"
answered=0
for _ in $(seq 1 15); do
  if docker exec "$app" node -e "$probe" >/dev/null 2>&1; then
    answered=1
    break
  fi
  sleep 2
done
[ "$answered" = 1 ] || fail "the app did not answer GET /api/visits within 30s"
echo "App answers GET /api/visits"

echo "Deploy verification passed"
