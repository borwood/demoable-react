---
name: integrate-demoable-react
description: Add or update Demoable React component explanations and live events in a React application, preserving its layout, refs and handlers.
---

# Integrate Demoable React

Use the installed public package API and import `@borwood/demoable-react/styles.css` once. Install `@borwood/demoable-react@0.1.0` from npm, or install a supplied local archive when evaluating a source checkout before registry publication. Preserve the user's existing React version and build system. Matched React/DOM 18.3.1 and 19.3.0 are tested. ESM, browser rendering and Node 22.19+ tooling are supported; no CommonJS entry is supplied.

## Compose the application

Place `InspectionProvider` above annotated components and event producers. Recommend `DemoLayout` inside it: orientation text and host-owned controls above, a flexible scrolling app region in the middle, and `EventLog` below, all in real layout space. Accept an existing host's composition; independent `OrientationPanel` and `EventLog` are also supported. Read [layout](references/layout.md) for props, responsive bounds and tokens. Mount a layout or orientation panel to supply the settings gear; the provider alone adds none.

Desktop starts inactive; component and event settings both default on. `?` toggles the overall layer except while editing, repeating or composing input. The exact hint `activate component and event inspection with '?' key` has one initialization lifecycle: four seconds then a one-second fade, visible only while active; activation does not restart it. Reduced motion removes the fade. Auto mobile uses `(hover: none) and (pointer: coarse)` and stays active; hosts may choose `device="desktop"` or `"mobile"`. Individual modes remain independent. Overall hiding removes the presentation frame and releases panel space while preserving mounted host state, settings and valid pins. Event work and expiry continue.

The first top-row control is a normal settings gear. Shared context/settings background opacity defaults to .75; text alpha is `min(background + .15, 1)` (default .90), without parent-opacity multiplication. The slider uses 0..1, step .05. Never apply this opacity to the host application or whole log.

## Annotate without breaking the host

Read [inspection](references/inspection.md) when adding targets. `Inspectable` creates a div; use `useInspectable(options, applicationRef)` for existing, inline, table or layout-sensitive elements. Keep original handlers and composed refs. For fragments/multiple roots, register explicit `useInspectionGroup` members. Portals need explicit `ownerId`; React ancestry does not infer ownership. Independently registered deeper DOM descendants win.

Supply readable labels and rich React context, including ordinary links and controls. Empty context renders no card. Deepest hover selects one context; the circular `?` also counts as hovering its target, including displaced controls. Target-to-card travel has a 300ms grace. Pinning suspends hover selection; another pin transfers it, repeat pin or `x` dismisses it. Dismissal suppresses immediate hover reopening until target exit. Unmount clears a pin; going offscreen retains it. Do not repurpose application focus as selection.

The single-mounted card prefers adjacent right/bottom/left/top fits, then maximum exposed area with viewport shifting/overlap fallback. Its position follows target geometry, not pointer movement inside a stationary target. Oversized content scrolls with reachable dismissal. Panels reserve their regions automatically; `useOccupiedRegion` reserves other host controls. Preserve native names, toggle/pin/expansion semantics, keyboard focus and touch actions; verify host input, tab navigation and narrow/short viewports in a real browser.

## Explain actual application work

Read [events](references/events.md) for exact types and lifetime contracts. `useEvents().start({label, content, progress?, data?, lifetime?})` returns a distinct stable handle on every call, including same-label overlap. Use `run`, `update`, `complete`, `fail`, `cancel` and `dismiss` from application callbacks or subscriptions. Content is a React node; updates never reorder creation order. Outcome-only events set an initial terminal `state`. Cancellation reports an outcome; the host must cancel its actual work.

Choose manual retention (default), creation-timed `{type:'timed', durationMs:4321}`, or outcome-specific `{type:'completion', succeeded:4000, failed:null, cancelled:700}`. Durations are arbitrary finite nonnegative milliseconds; omitted/null completion durations retain indefinitely. `fadeOutMs` overrides the 200ms removal default; entry fade-in is 120ms. First terminal outcome wins; retained terminal content may update without resetting its deadline; fading/removed handles are inert. Hidden collection, updates and expiry never replay expired entries.

Use `instrumentHandler` for attempt/result descriptions while preserving arguments, `this`, exact returns/promises, errors and propagation. Use `trackPromise` for an existing promise and keep application error handling. Neither helper schedules or cancels application work. Clean up application-owned timers/subscriptions on unmount; the provider owns its store disposal. Owners of standalone `createEventStore` must call `dispose()`.

The log is independently embeddable, visible only with overall and event modes enabled. It has a one-row empty minimum, measures up to three actual rows in compact mode, and expands to content up to half the viewport with internal scrolling. Its dedicated expansion control does not hijack entry interactions. Newest creation appears first; updates stay in place and reading older entries preserves scroll position. There is no grouping, eviction or persistent history.

## Run and adapt the examples

The complete [example scaffold](assets/demo/package.json) includes [App.tsx](assets/demo/App.tsx), [styles](assets/demo/app.css), [entry](assets/demo/main.tsx), [HTML](assets/demo/index.html) and [TypeScript configuration](assets/demo/tsconfig.json). Copy the whole `assets/demo` directory to a new working directory outside the installed skill. From that directory, install the declared dependencies:

```powershell
npm install
npm run typecheck
npm run build
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

For a local archive instead, replace the first command with `npm install C:/path/to/borwood-demoable-react-0.1.0.tgz` using its actual path. The [npm version page](https://www.npmjs.com/package/@borwood/demoable-react/v/0.1.0) shows registry availability.

Open http://127.0.0.1:5173. Press `?`; inspect the nested counter, pin and expand its interactive explanation, increment the host counter, use the existing-element ref and its focus button, then inspect the shared delivery group/portal. Run overlapping work, failure, cancellation, outcome-only and wrapped-handler actions. Edit the top controls and hide/show inspection to confirm preserved state. Stop the server with Ctrl+C in its terminal. The scaffold uses synthetic local work and no backend. Adapt the relevant patterns to the user's application rather than replacing it with this demo.

Check the installed types and build, then exercise affected interaction, geometry, keyboard/touch and hidden-lifetime behavior. Runtime hiding does not remove code from production bundles: production exclusion, DEV/DEMO build integration, hosted deployment and cross-session event history are not implemented. Do not imply that installing this skill authorizes publishing or unrelated application changes.
