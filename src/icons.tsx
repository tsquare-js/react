// Small inline icons (Lucide shapes), so the components need no icon font or assets.
const Svg = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const ExpandIcon = () => <Svg d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />;
export const MinusIcon = () => <Svg d="M5 12h14" />;
export const PlusIcon = () => <Svg d="M5 12h14M12 5v14" />;
export const CloseIcon = () => <Svg d="M18 6 6 18M6 6l12 12" />;
