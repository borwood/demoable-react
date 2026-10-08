# Demo presentation layout

Import `DemoLayout`, `OrientationPanel` and their exported prop types from `@borwood/demoable-react`, plus `@borwood/demoable-react/styles.css`. They run inside an existing `InspectionProvider`. Host React components own every control's value and handler.

```tsx
import { useState } from 'react';
import { InspectionProvider, DemoLayout } from '@borwood/demoable-react';
import '@borwood/demoable-react/styles.css';

function Presentation() {
  const [name, setName] = useState('Alex');
  const [editable, setEditable] = useState(true);
  return <DemoLayout
    orientation={<><strong>Try editing a draft.</strong> Changes stay local.</>}
    controls={<>
      <label>Name <input value={name} onChange={e => setName(e.target.value)} /></label>
      <label><input type="checkbox" checked={editable} onChange={e => setEditable(e.target.checked)} /> Editing enabled</label>
    </>}
  >
    <YourApplication name={name} editable={editable} />
  </DemoLayout>;
}
export function Demo() {
  return <InspectionProvider><Presentation /></InspectionProvider>;
}
```

`?` enables the overall demo visibility layer on desktop. Orientation and controls appear whenever `active` is true, including when both component and event inspection are disabled. Switching the layer off removes the entire presentation frame: stable `display: contents` wrappers carry no package classes, inline presentation styles, sizing, margins, background, rounding, grid, isolation or dedicated scrolling. The host uses its normal layout and page/host scrolling. The app and orientation children remain mounted, preserving host and local control state. Typing `?` in an input does not toggle the layer. Mobile follows the provider's always-active rule.

`DemoLayoutProps` accepts required `children` (the main app), optional `orientation`, `controls`, `className`, `style`, `appClassName` and `appStyle`. It supplies an `OrientationPanel`, flexible scrolling app region and `EventLog`. The gear is always the first control while active, even without orientation or host controls. Fixed grid row assignments prevent phantom rows when panels hide. The app scroll region clips at its rounded corners; inspection overlays render through the provider portal above the app. The provider itself does not change host layout.

`OrientationPanelProps` accepts `children` (arbitrary orientation content), `controls` (arbitrary React controls), `className` and `style`. Text appears above a wrapping control row whose first item is the settings gear. The anchored menu can escape panel clipping through a portal; the gear remains in the row. Use it alone for host-controlled composition:

```tsx
<InspectionProvider>
  <OrientationPanel controls={<DemoControls />}><p>How to explore this app.</p></OrientationPanel>
  <YourApplication />
  <EventLog />
</InspectionProvider>
```

Standalone placement and available height are the developer's responsibility. Both panels reserve their actual visible rectangles automatically so context cards avoid their controls; hidden/unmounted panels release those reservations. Library UI does not select inspectable targets underneath it.

## Appearance and overflow

The default shell fills `100dvh` with `auto minmax(0,1fr) auto` rows. Orientation is capped at 30% and the log at 50% of the measured shell content height (also bounded by 30dvh/50dvh); each region scrolls independently, preserving app space. Vertical app insets and orientation padding scale down in short shells. The log header is capped at half of its region and can scroll, preserving a reachable entry surface even in very short embedded layouts. Controls wrap on narrow screens. Keyboard focus scrolls to controls inside each region. In extremely short viewports the panel headers can scroll too. Hosts can override shell height with `style` or a class for nested presentation.

All package selectors are scoped. Customize these variables on your layout class or through `style` (cast custom properties to `CSSProperties` in TypeScript):

| Token | Default |
| --- | --- |
| `--demoable-react-demo-surface` | `#e9e6f0` |
| `--demoable-react-app-surface` | `#fff` |
| `--demoable-react-app-radius` | `28px` |
| `--demoable-react-app-inset` | `16px` (bounded by 3vw) |

Presentation `className`, `style`, `appClassName` and `appStyle` apply only while active; their visual and layout effects are removed while inactive. Stable boxless wrapper elements remain in the DOM so app and control instances stay mounted. It does not reset the host app, create a control schema or provide a state backend. Avoid unbounded fixed-width application content; the active app region scrolls its own overflow. Inactive content follows the host's original scrolling model. The runnable demo uses a text field for the presented name and a toggle that changes counter increments.
