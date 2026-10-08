# Inspection API and interaction rules

Import JavaScript/types from `@borwood/demoable-react` and CSS from `@borwood/demoable-react/styles.css`. All hooks must run beneath the provider. No external state library or consumer CSS framework is required.

## Controller

```tsx
<InspectionProvider
  device="auto"
  initialComponentInspection={true}
  initialEventInspection={true}
  initialOpacity={0.75}
>
  <App />
</InspectionProvider>
```

`device` is `auto | desktop | mobile`. Auto follows the primary-input query `(hover: none) and (pointer: coarse)` and responds to changes; touch support alone does not classify a laptop as mobile. Mobile activation cannot be switched off. Desktop starts off. Initial settings apply once per provider mount. `initialOpacity` is clamped to 0..1; nonfinite values use .75.

`useInspection(): InspectionController` returns `active`, `componentInspection`, `eventInspection`, `componentVisible`, `eventVisible`, `opacity`, `activeId`, `pinnedId`, and methods `setActive(boolean)`, `setComponentInspection(boolean)`, `setEventInspection(boolean)`, `setOpacity(number)`, `pin(id)`, `dismiss()`. `events` exposes the stable event store, also available through `useEvents()`. `eventVisible` controls the independently embedded [EventLog](events.md). Independent providers own independent registries, event stores and settings; the global shortcut affects each desktop provider.

A valid pin and settings survive temporary hiding. Hover is resolved from the actual pointer hit when shown again. Removed targets cannot restore stale pins. The startup hint belongs to the provider lifecycle, does not intercept pointer input, and only renders while active. Its initial four-second display and one-second fade continue while hidden; activation and ordinary rerenders never restart it.

## Wrapper and existing-element refs

`Inspectable` accepts `label: string`, optional `context: ReactNode`, optional `ownerId: string`, standard `div` attributes, children and a forwarded `HTMLDivElement` ref. It adds that explicit wrapper; overlays themselves add no host layout space.

```tsx
const appRef = useRef<HTMLButtonElement>(null);
const target = useInspectable<HTMLButtonElement>({
  label: 'Save button',
  context: <><p>Save a draft.</p><a href="/help">Help</a></>,
}, appRef);
return <button ref={target.ref} onClick={save}>Save</button>;
```

`useInspectable<T extends HTMLElement>(options, applicationRef?)` returns `{ id: string, ref: RefCallback<T> }`. The composed ref preserves object and callback refs, including callback cleanup functions. Use a stable application callback ref when possible. The returned identity is stable within the mount. The context, label, ownership and actual element can change; detach/remount cleanup is explicit. `null`, `false`, empty strings, empty arrays and empty fragments render no context box.

## Explicit groups and portal ownership

```tsx
const group = useInspectionGroup({ label: 'Delivery', context: <p>One delivery.</p> });
const portalMember = useInspectable<HTMLDivElement>({
  label: 'Delivery status', ownerId: group.id,
});
return <>
  <div ref={group.ref('origin')}>Origin</div>
  <div ref={group.ref('destination')}>Destination</div>
  {createPortal(<div ref={portalMember.ref}>Ready</div>, document.body)}
</>;
```

`useInspectionGroup(options)` returns `{ id, ref<T>(key: string, applicationRef?: Ref<T>): RefCallback<T> }`. Keys must be unique and stable among simultaneously rendered members. Fragments never imply a target automatically. Group geometry is the union of visible member rectangles for placement, while outlines follow each actual member; empty gaps are not hover targets. A group has one pin control and context identity.

A member with a valid `ownerId` resolves to that explicit identity and contributes geometry to it. A deeper independently registered DOM descendant wins first. Without a valid registered owner, the member supplies its own identity/context. No React-tree ancestry is inferred for portals. Use a direct owner identity, not an ownership cycle or chain.

Ordinary hover follows the actual DOM event path from deepest registered element outward. Child and parent context are never concatenated. Coincident pin controls get deterministic separate positions, clamped to the viewport. Controls also move to the nearest available position outside the interactive context panel so a visible pin remains selectable. Offscreen members have no on-screen outline/control; a pinned context remains available with its last valid target anchor and side.

## Placement and reserved regions

The box measures its actual rich content once, then tries positions beside the visible target rectangle (the visible union for groups), separated by 8 CSS pixels. It chooses the first full fit in **right, bottom, left, top** order. Cross-axis shifting preserves adjacency where needed. If none fits, it selects the unshifted candidate with the greatest visible area, excluding registered occupied regions without double-counting overlaps, then shifts into available space; this can overlap the target. The same order breaks ties. It never shrinks just to create an adjacent fit. Position changes follow target geometry rather than pointer position within a stationary target. Viewport and clipping ancestors constrain visible target geometry. ResizeObserver, capture-phase scroll/resize events, and a roughly 30 Hz animation-frame check while visible cover resizing and layout movement without target resize. All owned observers/listeners/frames are disposed on hide or unmount as appropriate.

`useOccupiedRegion<T extends HTMLElement>(): RefCallback<T>` reserves the measured visible rectangle of an existing DOM region:

```tsx
const occupied = useOccupiedRegion<HTMLDivElement>();
return <div ref={occupied}><button>Reserved application control</button></div>;
```

Multiple occupied regions are supported. The context uses available rectangles outside reserved areas. Oversized content is constrained to the most usable available viewport region with an 8px gutter where possible. The context body scrolls; its dismissal header stays reachable. Leave sufficient unreserved viewport space for a usable panel. The hook only registers geometry; `EventLog` and `OrientationPanel` use it automatically to reserve its visible layout region.

## Interaction and appearance

The hover leave grace is 300 ms. A circular ? control counts as its explicitly attached target, even when relocated for a collision or reserved panel. Direct control entry and target/control/card travel keep context open without clicking. Entering context cancels that timer, allowing text selection, links and controls. Library UI never chooses the app target behind it. Pinning suspends hover selection; a different pin control transfers directly. Repeat pin or the circular **x** button dismisses, suppressing the same hovered target until the pointer exits its members. An explicit pin overrides suppression. Keyboard dismissal returns focus to the originating pin control when available. Pointer pinning does not take application focus.

The settings gear is the first control in `OrientationPanel`, supplied automatically by `DemoLayout`, including an otherwise-empty panel. The provider alone does not render a trigger. It is a normal in-flow button, not draggable. Its menu anchors to the trigger, uses a portal to escape panel clipping, and stays within viewport bounds while scrolling/resizing. Escape or Close settings returns focus to the gear; hiding the layer closes the menu.

The **Info and settings background opacity** slider uses 0..1 in .05 steps. Both context and settings backgrounds use `opacity`; their text alpha is `min(opacity + .15, 1)`. Initialization defaults to .75/.90 and respects configured/clamped values. Parent opacity remains1, so nested controls do not multiply transparency. The app, orientation and events are unaffected. Settings preview changes immediately even without a selected component.

Package selectors begin `demoable-react-`. `.demoable-react-theme` provides opt-in app tokens. Library surfaces use their own defaults. Override `--demoable-react-z-index` on the document root to choose the portal stacking level (default 2147483000); within the layer outlines sit below context, then pins. The anchored settings portal uses that level plus1 to remain above overlapping cards. Adjust layer-scoped `--demoable-react-accent`, `--demoable-react-surface-rgb` and `--demoable-react-ink` through CSS. Outlines and the layer are pointer-transparent; actual controls and context are interactive. Focus outlines and reduced-motion behavior ship in the stylesheet.

Pin and close buttons show only **?** and lowercase **x** inside equal 26px circles. Normal pin placement is inset2 CSS pixels from the target top and left; collisions and viewport limits can relocate it. The entire circle responds to pointer/touch input, and native buttons retain accessible names, focus indication and pin state. Very small viewports can reduce the diameter. An offscreen pin keeps its last valid anchor and side, clamped again on resize; its rich content stays mounted during repositioning.

In pathological viewports with no free rectangle, the context falls back to viewport bounds and internal scrolling. The header itself scrolls when necessary to keep dismissal reachable; pin controls remain above overlapping context. Keep enough unreserved space for comfortable interaction. The standard [demo layout](layout.md) reserves its top and bottom panels while retaining flexible app space.
