#!/usr/bin/env python3
"""
N-Link commit leak gate (pre-commit hook).
Proprietary technology — All rights reserved.

Scans the files STAGED for commit (or all tracked files with --all) and ABORTS
the commit on any hard leak. This is the RULE #9 safety gate in executable form:
never commit secrets, the secret engine, or personal data.

BLOCKING (exit 1):
  - forbidden paths tracked: n_language.py (the secret engine goes to NO repo),
    any *.db (personal memories = PII), COMPANY_PROFILE.md, .nlink/ state
  - real secret material in content: API keys / tokens / private key blocks
  - with --strict: any owner-pattern hit (see below) also blocks

OWNER PATTERNS (PII/brand) are deliberately NOT hardcoded here: this file is
tracked, and shipping the owner's name/username inside the gate would itself be
the leak (found by independent security audit, 2026-07-03). They are loaded
from an UNTRACKED patterns file — one regex per line, '#' comments allowed —
resolved in this order:
  --patterns <file>  >  $LEAKCHECK_PATTERNS  >  ./.leakcheck.owner (if present)
Without a patterns file only the universal checks run (still blocks secrets and
forbidden paths). Git hooks live in .git/hooks (never tracked), so a hook may
safely reference the owner patterns file by absolute path.

Usage:  python3 scripts/leak_check.py [--all] [--strict] [--patterns FILE]
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

FORBIDDEN_PATHS = re.compile(
    r"(^|/)(n_language\.py|COMPANY_PROFILE\.md|.*\.db|\.nlink/)", re.IGNORECASE)
SECRET_PATTERNS = re.compile(
    r"(sk-[A-Za-z0-9]{20,}"          # OpenAI/Anthropic-style keys
    r"|ghp_[A-Za-z0-9]{30,}"          # GitHub tokens
    r"|github_pat_[A-Za-z0-9_]{30,}"
    r"|AKIA[0-9A-Z]{16}"              # AWS access keys
    r"|xox[baprs]-[A-Za-z0-9-]{10,}"  # Slack tokens
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----)")


def _owner_patterns(argv: list[str]) -> re.Pattern | None:
    """Load the untracked owner PII/brand patterns (never hardcoded here)."""
    path = ""
    if "--patterns" in argv:
        path = argv[argv.index("--patterns") + 1]
    elif os.environ.get("LEAKCHECK_PATTERNS", "").strip():
        path = os.environ["LEAKCHECK_PATTERNS"].strip()
    elif os.path.isfile(".leakcheck.owner"):
        path = ".leakcheck.owner"
    if not path:
        return None
    try:
        lines = [ln.strip() for ln in open(path, encoding="utf-8")
                 if ln.strip() and not ln.strip().startswith("#")]
    except OSError:
        print(f"leak_check: WARNING — patterns file unreadable: {path}")
        return None
    if not lines:
        return None
    return re.compile("(" + "|".join(lines) + ")", re.IGNORECASE)


def _files(staged_only: bool) -> list[str]:
    cmd = (["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"]
           if staged_only else ["git", "ls-files"])
    out = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return [f for f in out.stdout.splitlines() if f.strip()]


def main() -> int:
    staged_only = "--all" not in sys.argv
    strict = "--strict" in sys.argv
    owner_re = _owner_patterns(sys.argv)
    files = _files(staged_only)
    hard: list[str] = []
    warn: list[str] = []

    for f in files:
        if FORBIDDEN_PATHS.search(f):
            hard.append(f"forbidden path tracked: {f}")
            continue
        try:
            text = open(f, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        if SECRET_PATTERNS.search(text):
            hard.append(f"secret material in: {f}")
        if owner_re:
            m = owner_re.findall(text)
            if m:
                warn.append(f"{f}: {len(m)} owner-pattern hit(s)")

    if strict and warn:
        hard.extend(f"[strict] {w}" for w in warn)
        warn = []

    print(f"leak_check: {len(files)} file(s) scanned "
          f"({'staged' if staged_only else 'all tracked'}"
          f"{', strict' if strict else ''}"
          f"{', owner patterns ON' if owner_re else ', owner patterns OFF'})")
    for w in warn:
        print(f"  warn: {w}")
    if hard:
        print("COMMIT BLOCKED — leak gate:")
        for h in hard:
            print(f"  BLOCK: {h}")
        return 1
    print("leak gate: clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
