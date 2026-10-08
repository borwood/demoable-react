# Runnable integration examples

Run the repository with `npm ci`, `npm run dev -- --port 5173 --strictPort` and open http://127.0.0.1:5173. The [demo source](../demo/App.tsx) imports only the built public package and explicit stylesheet. The equivalent [portable skill example](../skills/agent/integrate-demoable-react/assets/demo/package.json) includes a full standalone Vite/TypeScript scaffold; its skill explains copying and installing the npm package or local archive. All examples use synthetic local work and need no account or service.

| Example in App.tsx | Try it | Integration contract |
| --- | --- | --- |
| `Examples`: Counter card and Counter | Activate with `?`, hover parent then counter | Simple wrapper and deepest nested context |
| `InteractiveContext` | Pin Counter, click Explain the interaction, then Count | Rich context stays interactive without blocking host input |
| `Examples`: refTarget/applicationRef | Click Existing button and Focus through app ref; unmount/restore it | Existing DOM target, composed application ref, stale-pin cleanup |
| `Examples`: group and portal | Inspect Prepare, Deliver and detached Delivery ready badge | Explicit multi-root identity and portal ownership |
| `EventExamples`: overlap | Run overlapping work, then wait for two independent outcomes | Handles, progress, manual and completion retention |
| `EventExamples`: failure/recordCancellation/wrapped | Try a failing promise, cancellation, outcome and wrapped handler | Failed/cancelled/succeeded outcomes and normal host results |
| `Presentation` | Edit Presented name, toggle Count by two, expand log, hide/show layer | Active-only top/app/log layout and preserved application state |

The [layout API](api/layout.md) shows independent `OrientationPanel` and `EventLog` composition for an existing host shell. The packed browser fixtures also compile and exercise these separate components. The [inspection API](api/inspection.md) and [event API](api/events.md) explain exact behavior and supported configuration.

`npm run test:consumer` installs the real archive into React/DOM 18.3.1 and 19.3.0 consumers, using bundled skill example sources, then typechecks and builds them. `npm run test:browser` runs those examples and independent fixtures in Chromium, Firefox and WebKit. This is desktop engine and emulated touch coverage on Windows, not real-device Safari/iOS certification. Stop a manually started dev server with Ctrl+C in its terminal; refresh resets the example's in-memory state.
