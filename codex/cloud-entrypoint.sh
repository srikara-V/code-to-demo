#!/usr/bin/env bash
# Entrypoint for the Codex agent running as a Cloud Run Job. The local runner
# overrides the image CMD with `codex exec ...` directly, so this script only
# runs in the cloud path. It self-contains the flow that host bind-mounts used
# to provide: creds, inputs, and output upload — all via Secret Manager + GCS.
#
# Env (from the Cloud Run Job execution overrides):
#   JOB_ID, REPO_TARBALL_GCS (gs://.../repo.tar.gz), OUTPUT_GCS (gs://.../walkthrough.mp4)
# Mounted secrets:
#   /secrets/codex-auth  -> $CODEX_HOME/auth.json   (config.toml is baked in)
#   /secrets/eleven-key  -> /opt/video-project/.eleven_key
set -uo pipefail
echo "[entrypoint] job=${JOB_ID:-?} repo=${REPO_TARBALL_GCS:-?}"

: "${CODEX_HOME:=/codex-home}"
mkdir -p "$CODEX_HOME"
[ -f /secrets/codex-auth ] && cp /secrets/codex-auth "$CODEX_HOME/auth.json"
[ -f /secrets/eleven-key ] && cp /secrets/eleven-key /opt/video-project/.eleven_key

# The agent expects the reference pipeline under /workspace/instructions/video-project.
mkdir -p /workspace/instructions
ln -sfn /opt/video-project /workspace/instructions/video-project

# Pull + extract the repo into /workspace/repo. Robust to archives that nest
# everything under a single top dir (GitHub tarballs) or lay files out flat.
mkdir -p /workspace/repo /workspace/out /tmp/x
gcloud storage cp "$REPO_TARBALL_GCS" /tmp/repo.tar.gz
tar xzf /tmp/repo.tar.gz -C /tmp/x
n=$(ls -1A /tmp/x | wc -l); first=$(ls -1A /tmp/x | head -1)
if [ "$n" -eq 1 ] && [ -d "/tmp/x/$first" ]; then
  cp -a "/tmp/x/$first/." /workspace/repo/
else
  cp -a /tmp/x/. /workspace/repo/
fi

# Run the agent (task baked into the image at build time).
codex exec --json --skip-git-repo-check --cd /workspace "$(cat /opt/agent-task.txt)"

# Upload the produced video, or fail loudly so the job execution is marked failed.
if [ -f /workspace/out/walkthrough.mp4 ]; then
  gcloud storage cp /workspace/out/walkthrough.mp4 "$OUTPUT_GCS"
  echo "[entrypoint] uploaded $OUTPUT_GCS"
else
  echo "[entrypoint] ERROR: agent produced no /workspace/out/walkthrough.mp4" >&2
  exit 1
fi
