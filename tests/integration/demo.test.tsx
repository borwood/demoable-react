import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../demo/App';
import { packageInfo } from '@borwood/demoable-react';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test('inspection demo identifies the installed package and demonstrates live event reporting', () => {
  render(<App />);
  expect(screen.getByTestId('package-info').textContent).toBe(`${packageInfo.name} · ${packageInfo.version}`);
  expect(screen.getByText('Component inspection')).toBeTruthy();
  expect(screen.getByText(/Report overlapping work while every application interaction stays usable/)).toBeTruthy();
});
test('normal application interaction remains live over repeated clicks', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Count: 0' }));
  fireEvent.click(screen.getByRole('button', { name: 'Count: 1' }));
  expect(screen.getByRole('button', { name: 'Count: 2' })).toBeTruthy();
});

test('demo orientation is available with both inspection modes off and host controls persist', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  render(<App />);
  fireEvent.keyDown(document, { key: '?' });
  expect(screen.getByRole('region', {name:'Demo orientation'})).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', {name:'Presented name'}), {target:{value:'Ada?'}});
  fireEvent.click(screen.getByRole('button', {name:'Inspection settings'}));
  fireEvent.click(screen.getByRole('checkbox', {name:'Component inspection'}));
  fireEvent.click(screen.getByRole('checkbox', {name:'Event inspection'}));
  expect(screen.getByRole('region', {name:'Demo orientation'})).toBeTruthy();
  fireEvent.keyDown(document, { key: '?' });
  expect(screen.queryByRole('region', {name:'Demo orientation'})).toBeNull();
  fireEvent.keyDown(document, { key: '?' });
  expect((screen.getByRole('textbox', {name:'Presented name'}) as HTMLInputElement).value).toBe('Ada?');
});
