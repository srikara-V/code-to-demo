# Full toolchain so the Codex agent can generate the walkthrough end-to-end IN
# the container: Codex CLI + Node + Python (runs the app) + Playwright/Chromium
# (records the UI) + Remotion (renders) + ffmpeg.
#
# Base = Playwright image: Node + Chromium + all the system libs already present.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv ffmpeg git jq ca-certificates curl gnupg \
    && rm -rf /var/lib/apt/lists/*

# Google Cloud CLI — the cloud entrypoint uses `gcloud storage` to pull the repo
# tarball from GCS and upload the finished video (auth via the job's service
# account through the metadata server).
RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y --no-install-recommends google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

# Python deps for the demo app (server.py talks to Postgres via psycopg2).
RUN pip3 install --break-system-packages --no-cache-dir "psycopg2-binary>=2.9,<3"

# Codex CLI.
RUN npm install -g @openai/codex@latest

# Pre-bake the video pipeline (npm deps + Remotion's headless browser) at
# /opt/video-project so the agent doesn't pay install / browser-download at run
# time. The agent copies this to a writable workdir, rewrites the tour, and runs it.
COPY instructions/video-project/ /opt/video-project/
RUN cd /opt/video-project \
    && npm install --no-audit --no-fund \
    && (npx --yes remotion browser ensure || true)

ENV CODEX_HOME=/codex-home
ENV VIDEO_PROJECT=/opt/video-project

# Bake the non-secret codex config + the docs the agent references + the cloud
# entrypoint & task. auth.json / .eleven_key are injected at runtime (Secret
# Manager), never baked. Local runs still bind-mount their own copies over these.
COPY codex/config.toml /codex-home/config.toml
COPY instructions/docs/ /workspace/instructions/docs/
COPY codex/agent-task.txt /opt/agent-task.txt
COPY codex/cloud-entrypoint.sh /opt/cloud-entrypoint.sh
RUN chmod +x /opt/cloud-entrypoint.sh

WORKDIR /workspace
# Default (Cloud Run Job) entrypoint. The LOCAL docker runner overrides this by
# passing `codex exec ...` as the run command, so local behavior is unchanged.
CMD ["/opt/cloud-entrypoint.sh"]
