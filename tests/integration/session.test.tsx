import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InspectionProvider, useInspection, useDemoSessionState } from '@borwood/demoable-react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

function Controls() {
  const state = useInspection();
  const [scenario, setScenario] = useDemoSessionState('host:scenario', 'normal', (v): v is string => v === 'normal' || v === 'slow');
  return <><output>{JSON.stringify({ active: state.active, opacity: state.opacity, components: state.componentInspection, scenario })}</output><button onClick={() => { state.setActive(true); state.setOpacity(.4); state.setComponentInspection(false); setScenario('slow'); }}>Change</button></>;
}
const read = () => JSON.parse(document.querySelector('output')!.textContent!);
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('restores settings and explicit host state after provider remount; namespaces are isolated', () => {
  const mount = (key: string) => render(<InspectionProvider device="desktop" sessionKey={key}><Controls /></InspectionProvider>);
  let view = mount('portfolio');
  fireEvent.click(screen.getByText('Change'));
  view.unmount(); view = mount('portfolio');
  expect(read()).toEqual({ active: true, opacity: .4, components: false, scenario: 'slow' });
  view.unmount(); mount('other');
  expect(read()).toEqual({ active: false, opacity: .75, components: true, scenario: 'normal' });
});

test('invalid/obsolete data and denied storage keep defaults usable', () => {
  sessionStorage.setItem('demoable-react:v1:bad:active', '"yes"');
  sessionStorage.setItem('demoable-react:v1:bad:opacity', '9');
  sessionStorage.setItem('demoable-react:v1:bad:components', '{invalid');
  const view = render(<InspectionProvider sessionKey="bad"><Controls /></InspectionProvider>);
  expect(read()).toEqual({ active: false, opacity: .75, components: true, scenario: 'normal' });
  view.unmount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  render(<InspectionProvider sessionKey="blocked"><Controls /></InspectionProvider>);
  fireEvent.click(screen.getByText('Change'));
  expect(read().scenario).toBe('slow');
});

test('server output uses defaults without reading session storage', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem');
  vi.stubGlobal('document', undefined);
  const html = renderToString(<InspectionProvider device="desktop" sessionKey="server"><Controls /></InspectionProvider>);
  expect(html).toContain('&quot;scenario&quot;:&quot;normal&quot;');
  expect(spy).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});


test.each(['desktop', 'auto'] as const)('hydrates %s server defaults before restoring session preferences without replacing host DOM', async device => {
  sessionStorage.setItem('demoable-react:v1:hydrate:active', 'true');
  const app = <InspectionProvider device={device} sessionKey="hydrate"><Controls /></InspectionProvider>;
  vi.stubGlobal('document', undefined);
  const html = renderToString(app);
  vi.unstubAllGlobals();
  if (device === 'auto') vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('pointer: coarse'), addEventListener() {}, removeEventListener() {} }));
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const original = container.querySelector('output');
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => { root = hydrateRoot(container, app, { onRecoverableError: error => errors.push(error) }); });
  try {
    expect(errors).toEqual([]);
    expect(container.querySelector('output')).toBe(original);
    expect(read().active).toBe(true);
  } finally { act(() => root!.unmount()); container.remove(); }
});
