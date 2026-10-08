import { Children, Fragment, isValidElement, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { InspectionSettings, useInspection, useOccupiedRegion } from './inspection';
import { EventLog } from './event-log';

export interface OrientationPanelProps {
  children?: ReactNode;
  controls?: ReactNode;
  className?: string;
  style?: CSSProperties;
}
function hasContent(content: ReactNode): boolean {
  return Children.toArray(content).some(child => typeof child === 'string' ? child.length > 0 : isValidElement(child) && child.type === Fragment ? hasContent((child.props as {children?: ReactNode}).children) : true);
}
/** Host-owned orientation and controls; the overall demo layer governs visibility. */
export function OrientationPanel({ children, controls, className = '', style }: OrientationPanelProps) {
  const { active } = useInspection();
  const occupied = useOccupiedRegion<HTMLElement>();
  const textPresent = hasContent(children);
  // Keep child state alive while display:none releases all layout/occupied space.
  return <section ref={active ? occupied : null} hidden={!active} className={`demoable-react-orientation ${className}`} style={style} aria-label="Demo orientation" data-demoable-ui="orientation">
    {textPresent && <div className="demoable-react-orientation-text">{children}</div>}
    <div className="demoable-react-controls"><InspectionSettings />{controls}</div>
  </section>;
}
export interface DemoLayoutProps extends Omit<OrientationPanelProps, 'children'> {
  children: ReactNode;
  orientation?: ReactNode;
  appClassName?: string;
  appStyle?: CSSProperties;
}
/** Opt-in three-region presentation shell inside an existing InspectionProvider. */
export function DemoLayout({ children, orientation, controls, className = '', style, appClassName = '', appStyle }: DemoLayoutProps) {
  const { active } = useInspection();
  const root = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !active) return;
    const measure = () => {
      const computed = getComputedStyle(node);
      const available = Math.max(0, node.clientHeight - (parseFloat(computed.paddingTop) || 0) - (parseFloat(computed.paddingBottom) || 0));
      setHeight(previous => previous === available ? previous : available);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [active]);
  return <div ref={root} className={active ? `demoable-react-layout ${className}` : undefined} data-demoable-layout={active ? 'active' : 'inactive'} style={active ? {...style, '--demoable-react-layout-height': height === undefined ? undefined : `${height}px`} as CSSProperties : {display:'contents'}}>
    <OrientationPanel controls={controls}>{orientation}</OrientationPanel>
    <div className={active ? `demoable-react-app ${appClassName}` : undefined} data-demoable-app={active ? 'active' : 'inactive'} style={active ? appStyle : {display:'contents'}}>{children}</div>
    <EventLog />
  </div>;
}
