# Ghost Front — tools

The test harness and release tooling for [Ghost Front](https://github.com/dancockrell/ghost-front).
The game itself is one self-contained HTML file; this is everything used to
keep it honest.

## The tools

| File | What it does |
|---|---|
| `lib.js` | Playwright harness — 8 device profiles, launch/page/open/enter/stats, instrumentation |
| `qa.js` | Regression sweep across every stage and device profile |
| `tools/probe.js` | 30-second smoke test, run after every edit |
| `tools/shot.js` | One screenshot: `file profile stage x out quality` |
| `tools/push.sh` | Publishes a build to itch.io via butler |
| `camp.js` | Campaign-level checks |
| `cut.py` | Sprite sheet cutting |

## Running the smoke test

```bash
npm i playwright
node tools/probe.js
```

`probe.js` is the thirty-second version and catches most regressions.
`qa.js` is the full sweep and is worth running before a release.

## Working practice

[`PROCESS.md`](PROCESS.md) is the operating document: one game file, one
harness, one audit command, and everything else deleted at the end of the
round that created it. It also carries the container-loss recovery steps,
which have been needed more than once.

## Credentials

`tools/butler_creds.txt` holds an itch.io API key. It is **git-ignored and
must stay that way** — `.gitignore` blocks `*creds*`, `*.key`, `*.pem`,
`.env*` and `*token*.txt`. A pre-commit hook runs gitleaks over staged
changes and will refuse a commit that contains a detected secret.

If a key is ever committed, rotate it at itch.io rather than only removing
the file — deletion does not un-publish what was pushed.
