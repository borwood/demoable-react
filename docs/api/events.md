# Live events

Import `InspectionProvider`, `useEvents`, `EventLog`, `instrumentHandler` and `trackPromise` from `@borwood/demoable-react`, and import `@borwood/demoable-react/styles.css` once. Events belong to a provider and continue collecting, updating and expiring while either visibility switch is off. The provider never mounts a log for you.

## Report an arbitrary signal

```tsx
function GenerateButton() {
  const events = useEvents(); // same store as useInspection().events
  function generate() {
    const event = events.start({ label: 'Generate preview', content: 'Waiting for worker' });
    event.run({ content: 'Rendering images', progress: .5 });
    // Call these from real worker/subscription/application callbacks:
    event.complete({ content: 'Preview ready', progress: 1 });
  }
  return <button onClick={generate}>Generate</button>;
}
```

Each `start` creates a distinct stable `id`, even for identical labels. Newest creation comes first; updates never reorder entries. `label` is plain readable text; `content` accepts a React node, including interactive controls. `progress` is an optional number (the log displays 0–1 as progress); `data` holds an application value without rendering it. Treat passed data and React elements as immutable. Retained handles work from background callbacks without requiring a mounted log or an active selection.

`start(input)` returns `{ id, update, run, complete, fail, cancel, dismiss }`. `update` changes any supplied `label`, `content`, `progress` or `data`; an explicit `undefined` clears an optional field. Initial state is `pending`, or supply `state: 'running' | 'succeeded' | 'failed' | 'cancelled'` (and `pending`) when creating. A terminal initial state supports outcome-only reporting. `run`, `complete`, `fail` and `cancel` accept the same optional display patch. Cancellation records an outcome; the application remains responsible for cancelling its underlying work and releasing subscriptions.

The first terminal outcome wins. Repeated terminal calls and `run` on terminal events do nothing and never extend retention. `update` may change retained terminal content without changing its outcome or deadline. Once removal fade starts, all mutations freeze and `dismiss` is idempotent. Removed handles are harmless and cannot resurrect events.

`events.dismiss(id)` is the same idempotent dismissal operation when you have an identity from a snapshot rather than a retained handle.

## Lifetime and cleanup

| Lifetime | Configuration | Deadline |
| --- | --- | --- |
| Manual (default) | `{ type: 'manual' }` | Explicit `dismiss()` only |
| Creation timed | `{ type: 'timed', durationMs: 4321 }` | Creation + duration |
| Completion based | `{ type: 'completion', succeeded: 4000, failed: null, cancelled: 700 }` | First terminal signal + that outcome's duration |

An omitted or `null` completion duration means indefinite retention. Durations must be finite, nonnegative milliseconds; zero is valid. Invalid durations throw at creation/configuration. Long durations are scheduled in bounded chunks to avoid native timeout overflow. Creation-timed deadlines do not restart on completion or updates. An outcome-only creation starts its completion deadline immediately.

Every policy accepts `fadeOutMs`; it overrides the store's default of **200 ms**. Configure that default once with `<InspectionProvider eventOptions={{ fadeOutMs: 300 }}>`. Provider options are initial configuration, not live settings. Entries fade in for **120 ms**. Reduced motion removes the visual animation; the same logical expiration/deletion deadlines still apply. Hidden expiry and removal continue, so an expired event never returns on reactivation. Manual dismissal also uses the configured removal fade.

`createEventStore({ fadeOutMs? })` creates an optional standalone store for non-React integrations. Both standalone and provider stores expose `getSnapshot()` (a stable immutable snapshot until a mutation), `subscribe(listener)` (returns unsubscribe), and `dispose()`. A disposed store cancels all owned timers, clears entries/subscribers and makes future handles inert. The provider disposes automatically on unmount after a microtask so development StrictMode effect replay retains the same store and original deadlines. Clean up application-owned subscriptions in your own effects; the library does not schedule or cancel application work. A standalone store must be explicitly disposed by its owner; `EventLog` uses its provider store.

## Handlers and promises

```tsx
const events = useEvents();
const save = instrumentHandler(events, applicationSave, {
  attempt: (draft: Draft) => ({ label: 'Save draft', content: `Saving ${draft.title}` }),
  succeeded: result => ({ content: `Saved revision ${result.revision}` }),
  failed: error => ({ content: error instanceof Error ? error.message : 'Save failed' }),
});
// Calling save(draft) preserves applicationSave's synchronous/async contract.

const originalPromise = fetch('/preview');
trackPromise(events, originalPromise, { label: 'Fetch preview' }, {
  succeeded: response => ({ content: `HTTP ${response.status}` }),
  failed: () => ({ content: 'Network request failed' }),
});
// The caller still owns handling originalPromise's result or error.
```

`instrumentHandler(store, handler, reporting)` returns a normal function. `reporting.attempt` is either an `EventInput` or an argument-based formatter; optional `succeeded` and `failed` format settlement display patches. Each invocation gets its own running event before the application is called. The wrapper uses the original arguments and `this`, returns the exact synchronous result or promise, and rethrows the original thrown value. Promise/thenable outcomes are observed after settlement. Wrapping a synchronous handler does not make it async, call `preventDefault`, or stop propagation.

`trackPromise(store, promise, input, reporting?)` reports an existing promise and returns that exact promise. Successful/failing formatting is optional. Reporting errors (creation, formatting, callbacks or subscription notification) cannot prevent invocation or replace an application result/error. A failed settlement formatter falls back to the terminal state without a content patch. If a return value has an inaccessible throwing `then` getter, reporting cannot observe its settlement; the application still receives the exact return value and the event remains running until explicitly ended/dismissed. The wrappers do not cancel work. Use the explicit handle API when application signals determine completion.

## Embed the measured log

Use the [standard layout](layout.md) to place orientation and host controls above the app and the measured log below it without writing grid CSS:

```tsx
import { InspectionProvider, DemoLayout } from '@borwood/demoable-react';

function Shell() {
  return <InspectionProvider>
    <DemoLayout orientation={<p>Explore this application.</p>} controls={<DemoControls />}>
      <YourApplication />
    </DemoLayout>
  </InspectionProvider>;
}
```

All three regions consume real layout space and scroll independently. Expanding or resizing the log recomputes available app height. Supply the same provider to the application and log. `EventLog` remains independently embeddable in developer-selected positions, such as an inline section or sidebar grid cell; reserve enough viewport space for context and controls. The provider itself adds no layout wrapper or log. The log registers its actual visible bounds with `useOccupiedRegion` automatically, releasing them on hide/unmount. It is not a fixed overlay.

`EventLog` accepts an optional `className` for host layout styling. Its header and entries remain independently operable; settings now belongs to the orientation/control panel rather than a floating overlay.

Visibility requires both overall activation and event inspection. Component inspection remains independent. A hidden log renders no layout box; an empty visible log has one message row. Compact height is measured from the actual first three rows plus its dedicated header, growing continuously as wrapped/rich content changes. Expanded height uses all content. Both are capped at half the viewport; even an oversized single row is reachable through the inner scroll surface. An explicit expansion button exposes `aria-expanded`; interacting with entry text or buttons does not toggle expansion. Dismiss buttons have accessible names and ordinary keyboard/touch behavior. Entries are not live-announced on every update, preventing repeated progress announcements.

New arrivals stay at the top when you are already viewing the top. While reading older entries, the log preserves the visible entry's identity and offset across arrivals and size updates. It does not group, deduplicate or evict live entries. New entries animate; an update keeps the same mounted entry and creation order.
