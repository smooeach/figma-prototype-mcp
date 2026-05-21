# Natural Language Mapping Dictionaries

Bilingual (English / 한국어) reference dictionaries that map designer natural-language input to Figma Prototype API constructs. These are reference material for the LLM that drives the MCP tools — not part of the runtime, but a stable source-of-truth for how a designer's wording becomes a `setReactionsAsync` payload.

## Files

| File | Part | Covers |
|---|---|---|
| [`natural-language-mapping-dictionary-v2.3.md`](./natural-language-mapping-dictionary-v2.3.md) | Standalone | Overall NL → Figma API mapping; Foundation references (Carbon, Material 3, Apple HIG, etc.) |
| [`trigger-dictionary-v2.7.1.md`](./trigger-dictionary-v2.7.1.md) | Part 1 of 2 | **When** a reaction fires — Triggers (ON_CLICK / ON_DRAG / AFTER_TIMEOUT / Mouse / Key / Media) |
| [`animation-dictionary-v2.7.1.md`](./animation-dictionary-v2.7.1.md) | Part 2 of 2 | **What** the reaction does — Duration / Easing / Transition / Direction |

## Versioning

Each file carries its own semver-style version (`v2.3`, `v2.7.1`) independent of the project's release tags (`v0.x.0`). Update the file's date + version note when editing.
