# Deployment

This project ships as a **Docker container** built by a **Jenkins CI/CD pipeline** and deployed to a remote host (default: `pios.local` — a Raspberry Pi or similar ARM device).

A separate GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR to `main` — type check (`tsc --noEmit`), lint, test, and build — as a merge gate. It does not build or deploy the Docker image; that remains Jenkins' responsibility.

---

## Container architecture

```
Dockerfile (multi-stage)
├── base      node:26-alpine + corepack (installed via npm — build-time only, required for Node 25+)
├── deps      pnpm install --frozen-lockfile
├── builder   next build  (standalone output)
└── runner    fresh node:26-alpine → apk upgrade → npm/npx/corepack removed → non-root USER appuser → node server.js (port 3050)
```

`next.config.ts` sets `output: "standalone"` — the runner image ships only what is needed (`server.js`, `.next/standalone`, `.next/static`, `public/`). No `node_modules` in the final image.

**Target platform:** `linux/arm64/v8` (Raspberry Pi 4/5, Apple Silicon servers). Change `--platform` in the Jenkinsfile `Build Image` stage for x86.

> Security headers (CSP, HSTS, COOP, COEP, CORP, etc.) are enforced by `proxy.ts` (Next.js 16 middleware) at the application layer — no additional nginx/proxy security config is needed for headers. The runner stage runs as a non-root user (`appuser`) and upgrades Alpine packages + npm on every build to minimise CVE exposure. → See [docs/ARCHITECTURE.md — Security model](ARCHITECTURE.md#security-model) for the full header table.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://mopplications.com` | Canonical base URL for metadata and Open Graph |
| `NODE_ENV` | Auto | `production` | Set by runner stage in Dockerfile |
| `NEXT_TELEMETRY_DISABLED` | Auto | `1` | Disables Next.js telemetry in all stages |

> `NEXT_PUBLIC_*` variables are baked into the JS bundle at **build time**. Changing them requires a rebuild.

---

## Jenkins pipeline

File: `Jenkinsfile`

### Pipeline parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `SITE_URL` | string | `https://mopplications.com` | Sets `NEXT_PUBLIC_SITE_URL` at build time |
| `DEPLOY_REMOTE` | boolean | `true` | SSH + deploy to remote Docker host after build |
| `REMOTE_HOST` | string | `pios.local` | Hostname or IP of target machine |
| `REMOTE_APP_NAME` | string | `dev-tools` | Docker container name on remote |
| `REMOTE_PORT_MAPPING` | string | `3050:3050` | `<host>:<container>` port mapping |
| `REMOTE_ENV_VARS` | string | `-e NEXT_PUBLIC_SITE_URL=...` | Extra env flags for `docker run` |
| `REMOTE_RUN_ARGS` | string | — | Additional `docker run` flags |
| `SSH_CREDENTIALS_ID` | string | `pi-ssh-key` | Jenkins credential ID (SSH Username with private key) |

> `IMAGE_NAME` is a fixed pipeline environment variable (`dev-tools`) — not a parameter. There is no registry push step; the image is streamed directly to the remote host over SSH. Image tags use the Jenkins `BUILD_NUMBER` (e.g. `dev-tools:42`), not `:latest`.

### Pipeline stages

```mermaid
flowchart LR
    A[Checkout] --> B[Repo Info]
    B --> C[Docker Readiness]
    C --> D[Setup Buildx]
    D --> E[Build Image\nlinux/arm64/v8\n--load]
    E --> F[Prune Old Images\non build agent]
    F --> G{DEPLOY_REMOTE?}
    G -- Yes --> H[docker save | gzip\n| ssh | gunzip | docker load]
    H --> I[SSH: docker stop + rm\ndocker run --restart unless-stopped\n+ prune old images on remote]
    G -- No --> J[Done]
    I --> J
```

### Credentials required in Jenkins

| ID | Type | Used by |
|---|---|---|
| `pi-ssh-key` (configurable via `SSH_CREDENTIALS_ID`) | SSH Username with private key | Deploy Remote stage — Jenkins extracts both SSH username and key file path automatically |

> No registry credentials needed. The image is saved locally after build and piped directly to the remote host:
> `docker save "$IMAGE_TAG" | gzip | ssh -i "$DEPLOY_KEY" "$SSH_TARGET" 'gunzip | docker load'`

### SSH key setup

1. Generate a key on the build machine: `ssh-keygen -t ed25519 -C "jenkins-deploy"`
2. Copy the public key to the remote host: `ssh-copy-id -i ~/.ssh/id_ed25519.pub user@<deploy-host>`
3. In Jenkins → Credentials → Add → **SSH Username with private key**
   - Username: the remote host's OS user (e.g. `pi`)
   - Private key: paste the contents of `~/.ssh/id_ed25519`
4. Note the credential ID and set it as `SSH_CREDENTIALS_ID` in the pipeline.

---

## Manual build & run (no Jenkins)

### Build

```bash
docker buildx build \
  --platform linux/arm64/v8 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://mopplications.com \
  --tag dev-tools:latest \
  --load \
  .
```

For x86/amd64 hosts:
```bash
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://mopplications.com \
  --tag dev-tools:latest \
  --load \
  .
```

### Run

```bash
docker run -d \
  --name dev-tools \
  --restart unless-stopped \
  -p 3050:3050 \
  -e NEXT_PUBLIC_SITE_URL=https://mopplications.com \
  dev-tools:latest
```

App is available at `http://<host>:3050`.

---

## Deployment architecture diagram

```mermaid
flowchart TD
    subgraph CI["Jenkins CI (Mac, Apple Silicon)"]
        A[git push / manual trigger] --> B[Checkout SCM]
        B --> C[docker buildx\nlinux/arm64/v8\n--load]
        C --> F[Image loaded locally]
    end

    subgraph Remote["Raspberry Pi (pios.local)"]
        G[docker stop dev-tools]
        G --> H[docker rm dev-tools]
        H --> I[docker run\n--restart unless-stopped\n-p 3050:3050]
        I --> J[Next.js standalone\nNode 26 server.js\nport 3050]
    end

    subgraph Internet
        K[User Browser] -->|HTTPS| L[Cloudflare Proxy]
        L -->|http :3050| J
    end

    F -- "docker save | gzip | ssh | gunzip | docker load" --> G
```

---

## Reverse proxy (recommended)

The container exposes port `3050` internally (mapped to `3050` by default). Place a reverse proxy in front for HTTPS termination.

### Caddy example

```caddyfile
mopplications.com {
    reverse_proxy localhost:3050
}
```

Caddy auto-provisions TLS via Let's Encrypt.

### nginx example

```nginx
server {
    listen 80;
    server_name mopplications.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name mopplications.com;

    ssl_certificate     /etc/letsencrypt/live/mopplications.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mopplications.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:3050;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Health check

```bash
curl -sf http://localhost:3050 | head -c 200
# Should return the HTML of the homepage
```

---

## Updating the deployment

1. Push changes to `main`.
2. Trigger Jenkins pipeline (`DEPLOY_REMOTE=true`).
3. Jenkins rebuilds the image, SSHes to the remote host, stops the old container, starts the new one.
4. Zero downtime between stop and start is ~1–2 seconds (Node cold start on arm64).

For zero-downtime rolling deploys, use Docker Compose with a secondary container + Caddy upstream swap, or Kubernetes. These are out of scope for the current setup.
