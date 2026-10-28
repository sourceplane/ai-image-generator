#!/usr/bin/env bash
# TIER 2 — the site a bootstrap produces builds, deploys (dry) and serves.
#
# placement.test.sh proves the tree a bootstrap ends with is the right tree.
# This proves it WORKS, by doing to it what its own pipelines will:
#
#   1. at the finished site, the landing's own checks — install with the
#      lockfile the site ships, render fixtures, typecheck, lint, test,
#      build. The bootstrap's own landings are checked in the box with
#      `orun validate` and `orun plan` alone (`checks: local`; their PR's CI
#      on an `orun/BASE-…` branch is `plan` alone, and the convergence on
#      main builds, deploys and smoke-tests the site), so THIS is where a
#      site those steps refuse is caught: before the tag, not after a build
#      has merged it. Every later pull request of the site runs ci.yml's
#      verify lanes;
#   2. the stage lane's own steps, rendered by `orun plan` in the site: on a
#      pull request (the verify profile) `build-app` — the component's
#      buildCommand, origin and all, the same step the deploy profile runs —
#      `verify-build-output` and `deploy-dry-run` (`wrangler deploy --dry-run
#      --name <reponame>-web-stage`). They run IN THE TREE THE RUNNER STAGES
#      for the job (testing/lib/stage-job.py), with the dependency layout the
#      pinned composition produces: if its install step is `scope: lane`, the
#      top-level node_modules is a symlink to the source checkout's; if not,
#      the job's own install step runs inside the staged tree. Run in a plain
#      checkout, this tier was green while the first live bootstrap's lanes
#      died in the lane layout (Turbopack: "Symlink … points out of the
#      filesystem root");
#   3. serve the built Worker with `wrangler dev` — its `ai` binding pointed
#      at a stand-in for Workers AI (testing/lib/fake-workers-ai.js), which
#      has no local mode — and run the component's OWN `smokeCommand` against
#      it, verbatim, the check the real deploy ends with; then read every
#      route the site promises. A fresh site has no provider key, so this is
#      the site as it is born: the page titled and headed with the site's
#      name, linking the site's repository, showing Workers AI alone; every
#      one of Workers AI's four image models drawing through the stand-in,
#      each asked in its own input shape; every keyed provider, a model the
#      page does not offer and a malformed request refused with a 400 and no
#      call; /api/health ok;
#   4. the same stage lane's build-app again, now with two providers' keys
#      in its environment as the optional secret refs put them there
#      (made-up keys: nothing here reaches a provider), and the result
#      checked: no key in any file of the build or its log, the keys handed
#      to the Worker only from a lane that can deploy. Served with the keys
#      as the deploy hands them over (wrangler's .dev.vars), the page lists
#      those providers beside Workers AI and /api/health names them. Served
#      WITHOUT the AI binding, the deploy's smoke must fail: a Worker that
#      cannot draw is caught by the deploy, not by a visitor.
#
# What it cannot do is the platform's half: create the repository, mint the
# brokered Cloudflare token, deploy for real and probe workers.dev. That is a
# bootstrap against a workspace (BOOTSTRAP.md); everything short of it is here.
#
# Needs: orun, node, pnpm, python3 (+PyYAML), git, curl, and the network for
# `pnpm install` (or a warm store). A few minutes: two installs and three
# builds (the landing's checks over the site, and the stage lane's own in its
# staged tree, without provider keys and with two).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
# shellcheck source=lib/bootstrap.sh
source "$here/lib/bootstrap.sh"

for bin in orun node pnpm python3 git curl; do
  command -v "$bin" >/dev/null || { echo "e2e.test.sh needs $bin on PATH" >&2; exit 1; }
done

scratch="$(mktemp -d)"
dev_pid=""
# wrangler dev runs under pnpm, node and two workerd processes; a TERM to the
# first does not reach the rest, and waiting on it then never returns. So it is
# started as its own process group (setsid) and the whole group is stopped.
cleanup() {
  if [ -n "$dev_pid" ]; then
    kill -TERM -- "-$dev_pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$dev_pid" 2>/dev/null || break; sleep 0.5; done
    kill -KILL -- "-$dev_pid" 2>/dev/null || true
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT
values="$here/fixtures/acme.json"
repo="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['reponame'])" "$values")"
sub="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['subdomain'])" "$values")"
export CI=1 WRANGLER_SEND_METRICS=false NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1

# The landing's own checks, step for step, run here at once on the whole
# tree. A pull request in the site builds and dry-deploys it through ci.yml's
# lanes; the lint and the tests run here, and by hand before a push.
LANDING_CHECKS=(
  "pnpm install --frozen-lockfile"
  "pnpm run wire:fixture"
  "pnpm typecheck"
  "pnpm lint"
  "pnpm test"
  "pnpm build"
)
checks() { # DIR LOG
  local dir="$1" log="$2" cmd
  for cmd in "${LANDING_CHECKS[@]}"; do
    echo "   \$ $cmd" | tee -a "$log"
    if ! (cd "$dir" && bash -c "$cmd") >> "$log" 2>&1; then
      echo "FAIL: \`$cmd\` failed in $dir" >&2; tail -40 "$log" >&2; return 1
    fi
  done
}

echo "── the offline bootstrap (testing/lib/bootstrap.sh)"
tree="$scratch/$repo"
bootstrap_offline "$root" "$tree" "$values" "$scratch/logs" > "$scratch/bootstrap.log" 2>&1 || {
  echo "FAIL: the offline bootstrap stopped" >&2; tail -40 "$scratch/bootstrap.log" >&2; exit 1; }
echo "   2 phases placed and landed"

# ── 1. the finished site ───────────────────────────────────────────────────
echo "── the finished site: install, the fixture render, typecheck, lint, test, build"
checks "$tree" "$scratch/checks-site.log"

# ── 2. the deploy lane's steps, for stage ──────────────────────────────────
echo "── the stage lane: build-app, verify-build-output, deploy-dry-run"
# The 01-product landing over the repository's empty first commit: every file
# of the site changed, as on its pull request.
s00="$(git -C "$tree" rev-parse HEAD~2)"; s01="$(git -C "$tree" rev-parse HEAD~1)"
(cd "$tree" && orun plan --intent intent.yaml --trigger github-pull-request --changed \
   --base "$s00" --head "$s01" --env stage --output "$scratch/plan.json") > "$scratch/plan.log" 2>&1 \
  || { echo "FAIL: orun plan" >&2; tail -15 "$scratch/plan.log" >&2; exit 1; }
python3 - "$scratch/plan.json" "$scratch/steps" <<'PY'
import json, pathlib, sys
plan = json.load(open(sys.argv[1]))
out = pathlib.Path(sys.argv[2]); out.mkdir()
job = next(j for j in plan["jobs"] if j["component"] == "web" and j["environment"] == "stage")
for s in job["steps"]:
    if s["id"] in ("build-app", "verify-build-output", "deploy-dry-run"):
        (out / f"{s['id']}.sh").write_text(s.get("run") or "")
    if s["id"] == "install-workspace-dependencies":
        (out / "install.sh").write_text(s.get("run") or "")
        (out / "install.wd").write_text(s.get("working-directory") or ".")
        (out / "install.scope").write_text(s.get("scope") or "job")
(out / "path").write_text(job.get("path") or "apps/web")
for k, v in (job.get("env") or {}).items():
    (out / "env").open("a").write(f"export {k}={json.dumps(v)}\n")
PY
# The job's private tree, staged as orun stages it. The source checkout
# carries no build output (a CI checkout has none, so the plain-tree build's is
# removed rather than copied in), and its dependencies are what the pinned
# composition says: a lane-scoped install ran once in the source tree (step 1
# ran the same command) and is linked in, or the job installs its own.
rm -rf "$tree/apps/web/.open-next" "$tree/apps/web/.wrangler"
work="$tree/.orun/runs/e2e/web.stage.verify-deploy/work"
[ -f "$scratch/steps/install.sh" ] || { echo "FAIL: the stage lane has no install step" >&2; exit 1; }
if [ "$(cat "$scratch/steps/install.scope")" = lane ]; then
  python3 "$here/lib/stage-job.py" "$tree" "$work" --shared-deps
  [ -L "$work/node_modules" ] || { echo "FAIL: the staged tree's node_modules is not the lane's symlink" >&2; exit 1; }
  echo "   staged: $(realpath --relative-to="$tree" "$work"); install scope: lane — node_modules → the source tree's"
else
  python3 "$here/lib/stage-job.py" "$tree" "$work"
  echo "   staged: $(realpath --relative-to="$tree" "$work"); install scope: job — installing inside it"
  echo "   ▸ install-workspace-dependencies"
  (cd "$work/$(cat "$scratch/steps/path")/$(cat "$scratch/steps/install.wd")" && bash -e "$scratch/steps/install.sh") \
    > "$scratch/install.log" 2>&1 || { echo "FAIL: the lane's install step" >&2; tail -30 "$scratch/install.log" >&2; exit 1; }
  [ -d "$work/node_modules" ] && [ ! -L "$work/node_modules" ] \
    || { echo "FAIL: the job's install did not land inside its own tree" >&2; exit 1; }
fi
for step in build-app verify-build-output deploy-dry-run; do
  [ -f "$scratch/steps/$step.sh" ] || { echo "FAIL: the stage verify lane has no $step step" >&2; exit 1; }
  echo "   ▸ $step"
  # The runner's per-job environment: the job's env (intent environment
  # `env:`) and ORUN_ENVIRONMENT; the step runs in the component's directory.
  if ! (cd "$work/$(cat "$scratch/steps/path")" && \
        { [ -f "$scratch/steps/env" ] && source "$scratch/steps/env"; true; } && \
        export ORUN_ENVIRONMENT=stage && bash -e "$scratch/steps/$step.sh") > "$scratch/$step.log" 2>&1; then
    echo "FAIL: the deploy lane's $step step" >&2; tail -40 "$scratch/$step.log" >&2; exit 1
  fi
done

# ── 3. serve it, and smoke it as the deploy does ───────────────────────────
# Workers AI has no local mode, so the Worker's `ai` binding is pointed at a
# stand-in (testing/lib/fake-workers-ai.js), a second Worker in the same
# `wrangler dev`, reached over RPC as the real binding is. The config is the
# one the build used, with that ONE change — written beside it in the
# throwaway tree. `nobinding` drops the binding instead: a Worker that lost it.
fake="$scratch/fake-workers-ai"
mkdir -p "$fake"
cp "$here/lib/fake-workers-ai.js" "$fake/index.js"
printf '{ "name": "fake-workers-ai", "main": "index.js", "compatibility_date": "2026-10-01" }\n' > "$fake/wrangler.jsonc"
devconfig() { # APPDIR MODE (standin|nobinding) — writes APPDIR/wrangler.e2e.json
python3 - "$1/wrangler.jsonc" "$1/wrangler.e2e.json" "$2" <<'PY' \
  || { echo "FAIL: could not derive the dev config from the built one" >&2; exit 1; }
import json, sys
src, out, mode = sys.argv[1:]
cfg = json.loads("\n".join(l for l in open(src).read().splitlines() if not l.lstrip().startswith("//")))
if cfg.pop("ai", None) != {"binding": "AI"}:
    sys.exit("the built Worker's wrangler.jsonc does not bind Workers AI as AI")
cfg.pop("$schema", None)
if mode == "standin":
    cfg["services"] = [{"binding": "AI", "service": "fake-workers-ai"}]
json.dump(cfg, open(out, "w"), indent=2)
PY
}
# serve DIR LOG MODE [DEV_VARS] — wrangler dev over the built Worker in DIR, on
# a free port; sets $url. DEV_VARS, when given, is the Worker's secrets file.
serve() {
  local dir="$1" log="$2" mode="$3" vars="${4:-}" extra=()
  stop_dev
  devconfig "$dir" "$mode"
  [ "$mode" = standin ] && extra=(--config "$fake/wrangler.jsonc")
  port=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
  inspector=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
  rm -f "$dir/.dev.vars"
  [ -n "$vars" ] && cp "$vars" "$dir/.dev.vars"
  (cd "$dir" && exec setsid pnpm exec wrangler dev --config wrangler.e2e.json "${extra[@]}" --ip 127.0.0.1 \
     --port "$port" --inspector-port "$inspector" --name "$repo-web-stage" --show-interactive-dev-session=false) \
     > "$log" 2>&1 < /dev/null &
  dev_pid=$!
  url="http://localhost:$port"
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "$url/" && return 0
    kill -0 "$dev_pid" 2>/dev/null || { echo "FAIL: wrangler dev exited" >&2; tail -30 "$log" >&2; exit 1; }
    sleep 1
  done
  curl -s -o /dev/null "$url/" || { echo "FAIL: wrangler dev never answered" >&2; tail -30 "$log" >&2; exit 1; }
}
stop_dev() {
  if [ -n "$dev_pid" ]; then
    kill -TERM -- "-$dev_pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$dev_pid" 2>/dev/null || break; sleep 0.5; done
    kill -KILL -- "-$dev_pid" 2>/dev/null || true
    dev_pid=""
  fi
}
smoke="$(python3 -c "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['spec']['parameters']['smokeCommand'])" "$tree/apps/web/component.yaml")"
app="$work/$(cat "$scratch/steps/path")"

echo "── wrangler dev over the built Worker: the site as it is born — Workers AI (stood in for), no key"
serve "$app" "$scratch/dev.log" standin
echo "   ▸ the component's own smokeCommand, DEPLOYED_URL=$url"
DEPLOYED_URL="$url" bash -c "$smoke" || { echo "FAIL: the deploy's smoke refused the site" >&2; exit 1; }

echo "   ▸ every route the site promises, an image from every Workers AI model, and what it must refuse"
routes() { # PROVIDERS (comma-separated, the page's order) LOG
python3 - "$url" "$values" "https://$repo-web-stage.$sub.workers.dev" "$1" "$2" <<'PY'
import base64, html, json, re, sys, urllib.error, urllib.request
base, values, origin, want, log = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4].split(","), sys.argv[5]
name, repo, org = values["productname"], values["reponame"], values["githuborg"]
LABELS = {"workersai": "Workers AI", "replicate": "Replicate", "vertex": "Vertex AI", "openai": "OpenAI", "fireworks": "Fireworks"}
WORKERS_AI = ["@cf/black-forest-labs/flux-1-schnell", "@cf/stabilityai/stable-diffusion-xl-base-1.0",
              "@cf/bytedance/stable-diffusion-xl-lightning", "@cf/lykon/dreamshaper-8-lcm"]
DEFAULTS = {"replicate": "stability-ai/stable-diffusion-3.5-large-turbo", "vertex": "imagen-3.0-fast-generate-001",
            "openai": "dall-e-2", "fireworks": "accounts/fireworks/models/flux-1-schnell-fp8"}
problems = []
def bad(m): problems.append(m)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoRedirect)
def call(path, body=None):
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"content-type": "application/json"}, method="GET" if body is None else "POST")
    try:
        with opener.open(req, timeout=60) as r:
            return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")

status, page = call("/")
if status != 200 or "</html>" not in page:
    bad(f"/ answered {status}, or did not render to its end")
title = re.search(r"<title>(.*?)</title>", page, re.S)
if not title or html.unescape(title.group(1)) != name:
    bad(f"the page's <title> is {title and title.group(1)!r}, not {name!r}")
h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
if not h1 or html.unescape(re.sub(r"<[^>]+>", "", h1.group(1))).strip() != name:
    bad(f"the header does not read {name!r}: {h1 and h1.group(1)[-120:]!r}")
if f'href="https://github.com/{org}/{repo}"' not in page:
    bad(f"the header does not link the site's repository github.com/{org}/{repo}")
og = re.search(r'<meta property="og:image" content="([^"]+)"', page)
if not og or not og.group(1).startswith(origin + "/"):
    bad(f"the Open Graph image is not absolute on {origin}: {og and og.group(1)}")
if "AI SDK Image Generator" in page or "ai-image-generator" in page:
    bad("the page still carries the baseline's name")
if "vercel.com/new" in page or "Deploy with Vercel" in page:
    bad("the page still offers to deploy the template to Vercel")
cards = [k for k, label in LABELS.items() if re.search(r'<h3[^>]*>' + re.escape(label) + r"</h3>", page)]
if cards != want:
    bad(f"the page shows the cards {cards}, want {want}")

status, body = call("/api/health")
try:
    health = json.loads(body)
except ValueError:
    health = None
if status != 200 or health != {"ok": True, "providers": want}:
    bad(f"/api/health answered {status} {body[:160]!r}, want 200 ok with providers {want}")

# Every Workers AI model draws, each through the stand-in.
for model in WORKERS_AI:
    prompt = f"a lighthouse at dusk, drawn by {model.split('/')[-1]}"
    s, body = call("/api/generate-images", {"prompt": prompt, "provider": "workersai", "modelId": model})
    try:
        d = json.loads(body); img = base64.b64decode(d.get("image") or "")
    except Exception:
        d, img = {}, b""
    if s != 200 or d.get("provider") != "workersai" or not img.startswith(b"\x89PNG\r\n\x1a\n") \
            or not img.endswith(f"fake-workers-ai:{model}:{prompt}".encode()):
        bad(f"{model}: answered {s} {body[:120]!r}, not the stand-in's image for its prompt")

# What it must refuse, without calling anyone: a provider with no key, a model
# the page does not offer (no arbitrary Workers AI model on the owner's
# account), and a request missing its parts.
for provider, model in DEFAULTS.items():
    if provider in want:
        continue
    s, body = call("/api/generate-images", {"prompt": "x", "provider": provider, "modelId": model})
    if s != 400 or "not available" not in body:
        bad(f"{provider} with no key answered {s} {body[:100]!r}, want 400 not available")
for req in ({"prompt": "x", "provider": "workersai", "modelId": "@cf/meta/llama-4-scout-17b-16e-instruct"},
            {"prompt": "x", "provider": "workersai", "modelId": "@cf/black-forest-labs/flux-2-dev"}):
    s, body = call("/api/generate-images", req)
    if s != 400 or "not available" not in body:
        bad(f"{req['modelId']} answered {s} {body[:100]!r}, want 400: the page does not offer it")
for req in ({"provider": "workersai", "modelId": WORKERS_AI[0]}, {"prompt": "x", "provider": "midjourney", "modelId": "v7"}):
    s, body = call("/api/generate-images", req)
    if s != 400:
        bad(f"{req} answered {s} {body[:100]!r}, want 400")

s, _ = call("/no-such-page")
if s != 404:
    bad(f"/no-such-page answered {s}, want 404")

# What the stand-in was asked, read back from wrangler's output: each model in
# its own shape, and nothing it refused.
asked = [json.loads(l.split("fake-workers-ai ", 1)[1]) for l in open(log, errors="replace")
         if "fake-workers-ai {" in l]
for a in asked:
    if "refused" in a:
        bad(f"the stand-in refused {a['model']}: {a['refused']} ({a['inputs']})")
    elif a["model"].endswith("flux-1-schnell") and sorted(a["inputs"]) != ["prompt", "steps"]:
        bad(f"FLUX was asked {a['inputs']}")
    elif not a["model"].endswith("flux-1-schnell") and not {"prompt", "width", "height"} <= set(a["inputs"]):
        bad(f"{a['model']} was asked {a['inputs']}")
if sorted({a["model"] for a in asked if "refused" not in a}) != sorted(WORKERS_AI):
    bad(f"the stand-in drew with {sorted({a['model'] for a in asked})}, want every Workers AI model once")

if problems:
    for p in problems:
        print(f"  ✕ {p}", file=sys.stderr)
    sys.exit(1)
print(f"   /, /api/health, four Workers AI models drawing, {len(DEFAULTS) - len(want) + 1 + 4} refusals and a 404 — providers {want}, on {origin}")
PY
}
routes workersai "$scratch/dev.log"

# ── 4. the same lane, with the template's providers' keys ──────────────────
# Made-up keys in the environment as the optional secret refs put them there;
# no provider is ever called with them.
echo "── the stage lane's build-app again, with provider keys as the optional refs supply them"
openai="sk-e2e-fixture-$(python3 -c "import secrets;print(secrets.token_hex(16))")"
replicate="r8_e2e_fixture_$(python3 -c "import secrets;print(secrets.token_hex(16))")"
rm -rf "$app/.open-next" "$app/.next" "$app/.wrangler" "$app/wrangler.e2e.json"
if ! (cd "$app" && { [ -f "$scratch/steps/env" ] && source "$scratch/steps/env"; true; } && \
      export ORUN_ENVIRONMENT=stage OPENAI_API_KEY="$openai" REPLICATE_API_TOKEN="$replicate" && \
      unset CLOUDFLARE_API_TOKEN && bash -e "$scratch/steps/build-app.sh") > "$scratch/build-app-keys.log" 2>&1; then
  echo "FAIL: the deploy lane's build-app step, with provider keys" >&2; tail -40 "$scratch/build-app-keys.log" >&2; exit 1
fi
grep -q "worker-secrets: no Cloudflare credential in this job (a verify lane) — OPENAI_API_KEY, REPLICATE_API_TOKEN reach $repo-web-stage from the deploy lane" \
  "$scratch/build-app-keys.log" || { echo "FAIL: the build did not hand the keys to $repo-web-stage (or claimed to from a verify lane)" >&2; tail -10 "$scratch/build-app-keys.log" >&2; exit 1; }
for key in "$openai" "$replicate"; do
  if grep -rlF -- "$key" "$app/.open-next" "$app/.next" "$scratch/build-app-keys.log" > "$scratch/leaks.txt" 2>/dev/null; then
    echo "FAIL: a provider key is in the build:" >&2; head -5 "$scratch/leaks.txt" >&2; exit 1
  fi
done
echo "   no key in any file of the build or its log; the keys pushed only by a deploy lane"
(cd "$app" && { [ -f "$scratch/steps/env" ] && source "$scratch/steps/env"; true; } && \
   export ORUN_ENVIRONMENT=stage && bash -e "$scratch/steps/verify-build-output.sh") > "$scratch/verify-keys.log" 2>&1 \
  || { echo "FAIL: verify-build-output, with keys" >&2; tail -20 "$scratch/verify-keys.log" >&2; exit 1; }

echo "── wrangler dev over it, with the keys the deploy hands the Worker"
OPENAI_API_KEY="$openai" REPLICATE_API_TOKEN="$replicate" node "$tree/tooling/wire/worker-secrets.mjs" \
  --secret OPENAI_API_KEY --secret REPLICATE_API_TOKEN --secret FIREWORKS_API_KEY --dev-vars "$scratch/keys.dev.vars" > /dev/null
serve "$app" "$scratch/dev-keys.log" standin "$scratch/keys.dev.vars"
echo "   ▸ the component's own smokeCommand, DEPLOYED_URL=$url"
DEPLOYED_URL="$url" bash -c "$smoke" || { echo "FAIL: the deploy's smoke refused the site with provider keys" >&2; exit 1; }
echo "   ▸ every route the site promises, the keyed providers listed beside Workers AI"
routes workersai,replicate,openai "$scratch/dev-keys.log"

echo "── and without its AI binding: the deploy's smoke must refuse a Worker that cannot draw"
serve "$app" "$scratch/dev-nobinding.log" nobinding
if DEPLOYED_URL="$url" bash -c "$smoke" 2>/dev/null; then
  echo "FAIL: the smoke passed a Worker with no Workers AI binding" >&2; exit 1
fi
echo "   refused"
stop_dev

echo "e2e.test.sh: ok"
