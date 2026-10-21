#!/usr/bin/env bash
# Runs ON the deploy host (piped over SSH by the Jenkinsfile) before anything is built.
# Fails fast if the host cannot take this deployment, so a broken target is found in
# seconds instead of after a 20-minute build.
#
# usage: bash -s -- <data-volume-name>
set -euo pipefail

volume="${1:?data volume name required}"
min_free_kb=1048576 # 1 GiB: room for the new image while the old one is still present

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

echo "Connected as $(whoami)@$(hostname)"

docker info >/dev/null 2>&1 || fail "the docker daemon is not reachable by this user (is it running? is the user in the docker group?)"
echo "Docker server $(docker version --format '{{.Server.Version}}')"

# The image is built for linux/arm64; loading it on another architecture "succeeds" and then fails at run time.
arch="$(uname -m)"
case "$arch" in
  aarch64 | arm64) echo "Architecture $arch (matches linux/arm64)" ;;
  *) fail "remote architecture is $arch but the image is built for linux/arm64" ;;
esac

root_dir="$(docker info --format '{{.DockerRootDir}}')"
# /var/lib/docker is usually root-only, so fall back to its parent when df cannot stat it.
free_kb="$(df -Pk "$root_dir" 2>/dev/null | awk 'NR==2 {print $4}')" || true
if [ -z "$free_kb" ]; then
  free_kb="$(df -Pk "$(dirname "$root_dir")" 2>/dev/null | awk 'NR==2 {print $4}')" || true
fi
[ -n "$free_kb" ] || fail "could not read free disk space for $root_dir"
free_mb=$((free_kb / 1024))
[ "$free_kb" -ge "$min_free_kb" ] || fail "only ${free_mb} MiB free under $root_dir; need at least $((min_free_kb / 1024)) MiB"
echo "Free disk under $root_dir: ${free_mb} MiB"

if docker volume inspect "$volume" >/dev/null 2>&1; then
  echo "Data volume '$volume' exists (the visitor count carries over)"
else
  echo "Data volume '$volume' does not exist yet and will be created on first start (the count starts at 0)"
fi

echo "Remote precheck passed"
