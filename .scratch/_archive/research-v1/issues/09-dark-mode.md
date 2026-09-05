Type: research
Status: ready-for-human
Priority: LOW

# Decide dark mode support scope

## Question

Should dark mode be committed to in the tech spec, or left as a stretch goal?

## Context

Tremor supports dark mode via a one-line class toggle (`dark` on `<html>`). Tailwind's `darkMode: 'class'` config enables it. High visual impact in the demo (engineers expect it), low implementation effort.

## Options

- **A** — Commit: add `next-themes` + system-preference detection, test in both modes in Playwright
- **B** — Stretch: implement if time allows, no e2e test coverage required
- **C** — Skip: explicitly out of scope, document the decision

## Recommendation

A — add `next-themes`, costs ~30 minutes, looks significantly more polished in a CEO demo. Test in Playwright as part of the visual smoke test.

## Decision needed

A / B / C. Gates: Playwright config (whether to test in dark mode), Tremor theme setup in tech spec.

## Comments
