# Overlay "back" disambiguation + scroll cue strengthening (NL-steering polish)

**Date:** 2026-06-09
**Status:** Design approved, ready for implementation plan

## Problem

From the 2026-06-08 NL-steering live validation ([[nl-steering-live-validation]], finding F1): on an OVERLAY, the user said "이전 화면으로 돌아가" (go back to the previous screen). The LLM correctly read the literal "돌아가/Back" cue and chose `proto_back`, but Figma's history-pop landed on `login`, whereas the user meant "return to the screen beneath the overlay" = `home` (which is `proto_overlay close`).

The current tool descriptions make this worse: `proto_overlay` close says *"to return to the previous screen use proto_back"* — actively steering the LLM toward Back in exactly the overlay context where Back is usually wrong. "돌아가/back" on an overlay is genuinely ambiguous:
- **dismiss the overlay** to reveal the screen underneath → `proto_overlay close`
- **pop the navigation history** → `proto_back` (on an overlay this often lands on an unexpected earlier frame)

Secondary: the `proto_scroll` "scroll feel" disambiguation (v0.21.0 finding) is already implemented in the description, but only in English; the actual failing input was the Korean "스크롤 느낌".

## Decisions (from brainstorm)

- **Q1 — Scope:** F1 is the substantive work; `proto_scroll` gets a light Korean-cue strengthening only (its disambiguation already exists). No other tools touched.
- **Q2 — Overlay "back" behavior:** the LLM should **ask the user** to clarify (close vs history-back) rather than guess. "돌아가" on an overlay is genuinely ambiguous, so a clarifying question is safer than a default.
- **Approach A (symmetric note):** the ambiguity guidance lives in BOTH `proto_back` and `proto_overlay` descriptions, so whichever tool the LLM leans toward at selection time, it sees the note. The misleading `proto_overlay`→`proto_back` line is replaced. (Rejected: B = `proto_back` only — leaves the misleading overlay line and misses the LLM that considers close first; C = also touch `proto_wire` — overkill, YAGNI.)

This is a describe()-only behavior change. Per the matrix doc, the schema `.describe()` / tool descriptions in code are the single source of the live cue text; the matrix doc records intent.

## Changes

### 1. `proto_back` description (src/server/tools.ts, the `proto_back` entry)

Append after the existing "Use for 'go back / 뒤로' … no fixed destination. To navigate to a SPECIFIC previous frame, use proto_wire instead." line:

> ⚠️ If the source is on an OVERLAY (popup/modal/dialog/sheet shown on top of another screen), 'go back / 돌아가 / 뒤로' is AMBIGUOUS — it may mean dismiss the overlay to reveal the screen underneath (= proto_overlay close) or pop the navigation history (= Back, which on an overlay often lands on an unexpected earlier frame). Ask the user which they mean before wiring.

### 2. `proto_overlay` description (src/server/tools.ts, the `proto_overlay` entry)

Replace the current line:

> 'close' = dismiss an open overlay; to return to the previous screen use proto_back.

with:

> 'close' = dismiss an open overlay, revealing the screen underneath it. If the user says 'go back / 돌아가 / 뒤로' while on an overlay, that is AMBIGUOUS between close (reveal the underlying screen) and proto_back (history pop) — ask the user which they mean rather than guessing.

### 3. `proto_scroll` description (src/server/tools.ts, the `proto_scroll` entry)

Strengthen the existing English disambiguation with the actual Korean failing cue:

> NOT for the general 'scroll feel' between pages ('스크롤 느낌으로 화면이 부드럽게 넘어가게') — for that effect, use a directional transition (PUSH or SLIDE_*) via proto_wire instead.

### 4. Matrix doc (docs/dictionaries/tool-disambiguation-matrix.md, Part 1)

- Add a row capturing the overlay-back ambiguity:

  `| "돌아가/뒤로/back" on an OVERLAY (close vs history) | ASK USER | overlay 'back' is ambiguous: close (reveal underlying screen) vs proto_back (history pop) — clarify before wiring | — |`

- In the existing scroll row (currently row 18), append the Korean cue to the reverse-tool cell: `proto_wire (PUSH/SLIDE for "scroll feel" / "스크롤 느낌")`.

## Testing

- **No unit test for description text** — none exist in the project; description strings are not locked by tests. The matrix doc is the intent record. The only automated check is that the project still typechecks and builds (the change is string concatenation only): `npm run typecheck && npm run test`.
- **Live re-validation** (Claude Desktop + supergateway, real file MCP_test_12):
  1. On the overlay (popup01), "이전 화면으로 돌아가" → the LLM should now **ask** whether to close the overlay or navigate back in history, instead of silently wiring `proto_back`.
  2. "스크롤 느낌으로 다음 화면 넘어가게" → the LLM should pick a directional transition via `proto_wire`, not `proto_scroll`.

## Versioning

describe()-only + doc change. Propose a patch release **v0.25.1**. (Precedent is mixed: the nl-steering-hardening round was pure metadata and pushed without its own version tag — final call at the release step.)
