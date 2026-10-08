# Integration skills

The package ships equivalent, self-contained [agent](../skills/agent/integrate-demoable-react/SKILL.md) and [Claude](../skills/claude/integrate-demoable-react/SKILL.md) skills. Each includes the same API references and complete runnable demo scaffold. No external service is needed.

After installing `@borwood/demoable-react@0.1.0` from npm or a local package archive, copy the entire chosen `integrate-demoable-react` directory from `node_modules/@borwood/demoable-react/skills/agent/` or `skills/claude/` into your consumer project:

| Client | Destination relative to consumer root | Explicit invocation |
| --- | --- | --- |
| Codex | `.agents/skills/integrate-demoable-react/` | `$integrate-demoable-react` |
| Claude Code | `.claude/skills/integrate-demoable-react/` | `/integrate-demoable-react` |

These project discovery paths follow the [official Codex skill documentation](https://learn.chatgpt.com/docs/build-skills) and [Claude Code skill documentation](https://code.claude.com/docs/en/skills), checked October 8, 2026. Start a fresh client session in the consumer project after copying. Other agents can read `SKILL.md` directly. Copy the folder, including `references` and `assets`; copying only the entry file breaks its portable links. Review an existing destination before replacing it.

Ask, for example: “Use integrate-demoable-react to annotate my existing save button without changing its DOM layout, explain its asynchronous result, and add the standard demo layout.” The skill preserves host handlers and refs and explains alternate log placement. It does not authorize publication or deployment.

For a standalone demonstration, copy the skill's `assets/demo` into a new working directory and run `npm install` to install its declared dependencies, including `@borwood/demoable-react@0.1.0`. Then run its typecheck, build and dev commands as documented in `SKILL.md`. To evaluate a local archive instead, replace `npm install` with `npm install C:/path/to/borwood-demoable-react-0.1.0.tgz`, using the actual archive path. The [npm version page](https://www.npmjs.com/package/@borwood/demoable-react/v/0.1.0) shows registry availability. See [the example map](examples.md) for the interactions to try.

Maintainers edit `skills/source/integrate-demoable-react/SKILL.md`, `docs/api/*` and the real demo. Run `npm run skills:sync`, then `npm run skills:check`. Both generated folders have identical files; checking verifies byte-equivalent normalized content, frontmatter and all relative Markdown references. Typechecking includes this check. Packed-consumer validation compiles the bundled example against the installed archive and checks its complete asset inventory.
