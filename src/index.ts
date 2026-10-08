declare const __PACKAGE_NAME__: string;
declare const __PACKAGE_VERSION__: string;

/** Identity of the installed package. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
}

export const packageInfo: PackageInfo = Object.freeze({
  name: __PACKAGE_NAME__,
  version: __PACKAGE_VERSION__,
});

export { InspectionProvider, Inspectable, useInspection, useInspectable, useInspectionGroup, useOccupiedRegion, useEvents } from './inspection';
export type { InspectionProviderProps, InspectionController, InspectionDevice, InspectableOptions, InspectableProps } from './inspection';

export { createEventStore } from './events';
export type { EventStore, EventStoreOptions, EventHandle, EventInput, EventUpdate, EventState, EventLifetime, LiveEvent } from './events';
export { instrumentHandler, trackPromise } from './instrumentation';
export type { HandlerReporting } from './instrumentation';
export { EventLog } from './event-log';
export type { EventLogProps } from './event-log';

export { OrientationPanel, DemoLayout } from './demo-layout';
export type { OrientationPanelProps, DemoLayoutProps } from './demo-layout';
