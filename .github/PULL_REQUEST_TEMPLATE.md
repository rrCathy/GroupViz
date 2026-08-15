## Summary

<!-- One sentence: what changed and why. -->

## Risk self-assessment

<!-- Pick one and keep the matching section. -->

- [ ] 🟢 **Low risk** — UI styling / internal logic only, interface signatures unchanged, or bug fix in a non-core feature.
- [ ] 🔴 **High risk** — touches core math (group/algebra/Cayley/layout), introduces a new dependency, changes cross-module shared logic, or breaks a public API. **If so, fill in the human review request:**

> **Human review request**
> - **Change summary:** …
> - **Risk points:** …
> - **Suggested review path:** e.g. `src/core/algebra/layout.ts` lines 80–120
> - **Self-assessment:** what is verified and what remains doubtful…

## Verification checklist

- [ ] `npm run lint` — no errors
- [ ] `npm run test` — all tests green (39 files, 1206 tests)
- [ ] `npm run test:coverage` — above thresholds (stmts/lines ≥ 85, functions ≥ 85, branches ≥ 70)
- [ ] `npm run build` — production build passes
- [ ] New pure-logic code covered by unit tests (core/algebra, core/groups)
- [ ] Browser regression done on the affected view path (Playwright snapshot/screenshot if UI changed)
- [ ] i18n keys added in **both** zh and en (`src/i18n/translations.ts`, `i18n.test.ts` enforces parity)
- [ ] Docs updated where facts changed (test counts, group families, view modes, `docs/*.md`, README, AGENTS.md)
- [ ] No BOM / UTF-8 issues for edited files (Windows tooling)

## Related issues

<!-- Closes #… -->