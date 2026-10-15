# Demoable React

## Install the agent skill

In your React project, install the library first, then add its integration skill for Codex, Claude Code or another supported agent:

```sh
npm install @borwood/demoable-react
npx skills add ./node_modules/@borwood/demoable-react/skills/agent/integrate-demoable-react
```

Use Node 22.20+ for the skills CLI. Choose your agent and Project scope, then start a fresh agent session. [Manual installation and prerequisites](https://github.com/borwood/demoable-react/blob/main/docs/integration-skills.md).

## What it offers

- Hover and pin rich component explanations while keeping your app interactive.
- Annotate existing elements, nested components, groups and portals.
- Report live progress, success, failure and cancellation with independent event lifetimes.
- Compose orientation, settings and an expandable event log around your app.
- Customize themes and optionally restore demo settings and state within a session.

## Components and usage

Import `@borwood/demoable-react/styles.css` once and wrap your demo in `InspectionProvider`. Use `Inspectable` for wrapper-based annotations or `useInspectable` to attach explanations to existing elements. `DemoLayout` arranges orientation, your controls, the app and live events; `OrientationPanel` and `EventLog` can also be placed independently.

Use `useEvents` to start and update events, or `instrumentHandler` and `trackPromise` to describe existing work while preserving its results and errors. On desktop, press **?** to toggle the demo layer; on mobile, tap an explanation's **?** to pin it. Supports React 18.3.1 and 19.3.0 with matched React DOM versions.

[Learn more and explore examples in the public repository](https://github.com/borwood/demoable-react#readme), or read the [inspection](https://github.com/borwood/demoable-react/blob/main/docs/api/inspection.md), [events](https://github.com/borwood/demoable-react/blob/main/docs/api/events.md) and [layout](https://github.com/borwood/demoable-react/blob/main/docs/api/layout.md) API guides.
