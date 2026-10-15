import type { CSSProperties } from 'react';

/** RGB channels accept space-separated numbers, e.g. "24 30 33". Other colors accept CSS colors. */
export interface InspectionTheme {
  surfaceRgb?: string;
  inkRgb?: string;
  ink?: string;
  muted?: string;
  demoSurface?: string;
  border?: string;
  accent?: string;
  focus?: string;
  buttonSurface?: string;
  hoverSurface?: string;
  success?: string;
  failure?: string;
  cancelled?: string;
  eventSurface?: string;
  eventBorder?: string;
}
export function themeStyle(theme: InspectionTheme = {}): CSSProperties {
  return Object.fromEntries(Object.entries(theme).map(([key, value]) => [`--demoable-react-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, value])) as CSSProperties;
}
