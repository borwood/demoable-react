export function Icon({ name }: { name: 'question' | 'close' | 'gear' }) {
  return <svg className="demoable-react-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'question' ? <><path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6" /><path d="M12 18h.01" /></> : name === 'close' ? <path d="m6 6 12 12M18 6 6 18" /> : <><path d="m10 3-.5 3-2 1-3-.5-2 3 2.5 2v2l-2.5 2 2 3 3-.5 2 1 .5 3h4l.5-3 2-1 3 .5 2-3-2.5-2v-2l2.5-2-2-3-3 .5-2-1L14 3Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>;
}
