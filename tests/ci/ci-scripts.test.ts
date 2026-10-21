import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = process.cwd();
const precheck = path.join(root, "ci/remote-precheck.sh");
const verify = path.join(root, "ci/verify-deploy.sh");
const jenkinsfile = readFileSync(path.join(root, "Jenkinsfile"), "utf8");

let shimDir: string;

function writeShim(name: string, body: string) {
  const file = path.join(shimDir, name);
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
}

/** Runs a ci script the way the pipeline does: piped to `bash -s -- args` with fake host tools on PATH. */
function run(script: string, args: string[], env: Record<string, string> = {}) {
  const result = spawnSync("bash", ["-s", "--", ...args], {
    input: readFileSync(script, "utf8"),
    env: { ...process.env, PATH: `${shimDir}:${process.env.PATH}`, ...env },
    encoding: "utf8",
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

beforeEach(() => {
  shimDir = mkdtempSync(path.join(tmpdir(), "ci-shim-"));
  writeShim("sleep", "exit 0");
  writeShim("uname", `echo "\${SHIM_ARCH:-aarch64}"`);
  writeShim(
    "df",
    `echo "Filesystem 1024-blocks Used Available Capacity Mounted"\necho "/dev/x 100000000 1 \${SHIM_FREE_KB:-50000000} 1% /"`,
  );
  writeShim(
    "docker",
    `
case "$1" in
  info)
    [ "\${SHIM_DOCKER_DOWN:-0}" = 1 ] && exit 1
    case "$*" in *DockerRootDir*) echo /var/lib/docker ;; esac
    exit 0 ;;
  version) echo 29.0.0 ;;
  volume) [ "\${SHIM_VOLUME_EXISTS:-0}" = 1 ] ;;
  inspect)
    case "$*" in
      *State.Running*) echo "\${SHIM_RUNNING:-true}" ;;
      *Mounts*) echo "\${SHIM_MOUNTS-volume:dev-tools-data:/app/data }" ;; # no colon: an empty value means "no mounts"
    esac ;;
  exec)
    case "$*" in
      *touch*) exit "\${SHIM_TOUCH_RC:-0}" ;;
      *) exit "\${SHIM_PROBE_RC:-0}" ;;
    esac ;;
  logs) echo "fake container log line" ;;
esac
`,
  );
});

afterEach(() => {
  rmSync(shimDir, { recursive: true, force: true });
});

describe("ci/remote-precheck.sh", () => {
  it("is valid bash", () => {
    expect(spawnSync("bash", ["-n", precheck]).status).toBe(0);
  });

  it("passes on a healthy arm64 host and says the volume will be created", () => {
    const { code, out } = run(precheck, ["dev-tools-data"]);

    expect(code).toBe(0);
    expect(out).toContain("Architecture aarch64 (matches linux/arm64)");
    expect(out).toContain("will be created on first start");
    expect(out).toContain("Remote precheck passed");
  });

  it("notes when the data volume already exists", () => {
    const { code, out } = run(precheck, ["dev-tools-data"], { SHIM_VOLUME_EXISTS: "1" });

    expect(code).toBe(0);
    expect(out).toContain("exists (the visitor count carries over)");
  });

  it("fails when the docker daemon is not reachable", () => {
    const { code, out } = run(precheck, ["dev-tools-data"], { SHIM_DOCKER_DOWN: "1" });

    expect(code).toBe(1);
    expect(out).toContain("docker daemon is not reachable");
  });

  it("fails on a non-arm64 host, because the image is built for linux/arm64", () => {
    const { code, out } = run(precheck, ["dev-tools-data"], { SHIM_ARCH: "x86_64" });

    expect(code).toBe(1);
    expect(out).toContain("remote architecture is x86_64");
  });

  it("fails when there is less than 1 GiB free", () => {
    const { code, out } = run(precheck, ["dev-tools-data"], { SHIM_FREE_KB: "200000" });

    expect(code).toBe(1);
    expect(out).toMatch(/only \d+ MiB free/);
  });

  it("requires the data volume name", () => {
    expect(run(precheck, []).code).not.toBe(0);
  });
});

describe("ci/verify-deploy.sh", () => {
  const args = ["dev-tools", "dev-tools-data", "/app/data"];

  it("is valid bash", () => {
    expect(spawnSync("bash", ["-n", verify]).status).toBe(0);
  });

  it("passes for a running container with the volume mounted, writable, and answering", () => {
    const { code, out } = run(verify, args);

    expect(code).toBe(0);
    expect(out).toContain("Deploy verification passed");
  });

  it("fails when the container is not running, and shows its logs", () => {
    const { code, out } = run(verify, args, { SHIM_RUNNING: "false" });

    expect(code).toBe(1);
    expect(out).toContain("is not running");
    expect(out).toContain("fake container log line");
  });

  it("fails when no volume is mounted — the build #68 mistake", () => {
    const { code, out } = run(verify, args, { SHIM_MOUNTS: "" });

    expect(code).toBe(1);
    expect(out).toContain("expected volume 'dev-tools-data' mounted at /app/data");
    expect(out).toContain("found: nothing");
  });

  it("fails when a different volume is mounted at the data directory", () => {
    const { code, out } = run(verify, args, { SHIM_MOUNTS: "volume:other-vol:/app/data " });

    expect(code).toBe(1);
    expect(out).toContain("found: volume:other-vol:/app/data");
  });

  it("fails when a bind mount, not the named volume, is at the data directory", () => {
    const { code } = run(verify, args, { SHIM_MOUNTS: "bind::/app/data " });

    expect(code).toBe(1);
  });

  it("fails when the data directory is not writable by the app user", () => {
    const { code, out } = run(verify, args, { SHIM_TOUCH_RC: "1" });

    expect(code).toBe(1);
    expect(out).toContain("not writable by the app user");
  });

  it("fails when the app does not answer /api/visits", () => {
    const { code, out } = run(verify, args, { SHIM_PROBE_RC: "1" });

    expect(code).toBe(1);
    expect(out).toContain("did not answer GET /api/visits");
  });

  it("requires the container, volume and directory arguments", () => {
    expect(run(verify, ["dev-tools"]).code).not.toBe(0);
  });
});

describe("Jenkinsfile", () => {
  const at = (text: string) => {
    const index = jenkinsfile.indexOf(text);
    expect(index, `"${text}" should be in the Jenkinsfile`).toBeGreaterThan(-1);
    return index;
  };

  it("always mounts the data volume itself instead of relying on a job parameter", () => {
    expect(jenkinsfile).toContain("runCommandParts << dataMount");
    expect(jenkinsfile).toMatch(/DATA_VOLUME\s*=\s*'dev-tools-data'/);
    expect(jenkinsfile).toMatch(/DATA_DIR\s*=\s*'\/app\/data'/);
  });

  it("keeps REMOTE_RUN_ARGS for extras only and rejects a second /app/data mount", () => {
    expect(jenkinsfile).toMatch(/name: 'REMOTE_RUN_ARGS',\s*defaultValue: '',/);
    expect(jenkinsfile).toContain("extraRunArgs.contains(env.DATA_DIR)");
  });

  it("verifies the deployment before pruning old images on the remote host", () => {
    expect(at("ci/verify-deploy.sh")).toBeLessThan(at("PRUNE_SCRIPT"));
  });

  it("prechecks the remote host, only when deploying, before the build starts", () => {
    const stage = at("stage('Remote Precheck')");
    expect(stage).toBeLessThan(at("stage('Docker Readiness')"));
    expect(stage).toBeLessThan(at("stage('Build Image')"));
    expect(jenkinsfile.slice(stage, at("stage('Docker Readiness')"))).toContain("params.DEPLOY_REMOTE");
    expect(jenkinsfile).toContain("ci/remote-precheck.sh");
  });

  it("bounds the pipeline and the stages that can hang", () => {
    expect(jenkinsfile).toMatch(/options \{[^}]*timeout\(time: 30, unit: 'MINUTES'\)/);
    expect(jenkinsfile).toMatch(/retry\(2\) \{\s*timeout\(time: 5, unit: 'MINUTES'\)/);
    expect((jenkinsfile.match(/timeout\(time:/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("pins nothing environment-specific: no hostnames, IPs or credentials", () => {
    expect(jenkinsfile).not.toMatch(/\.ts\.net/);
    expect(jenkinsfile).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });
});
