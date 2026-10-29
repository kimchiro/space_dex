import type { ReactNode, SVGProps } from "react";

function Svg({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

type IconProps = { size?: number };

export const CrosshairIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v18M3 12h18" />
  </Svg>
);
export const TrendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19 20 5" />
    <circle cx="4" cy="19" r="1.6" />
    <circle cx="20" cy="5" r="1.6" />
  </Svg>
);
export const HLineIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h18" />
    <circle cx="12" cy="12" r="1.6" />
  </Svg>
);
export const FibIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5h18M3 10h18M3 14h18M3 19h18" />
    <path d="M5 19 19 5" strokeDasharray="2 2" />
  </Svg>
);
export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);
export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </Svg>
);
export const RedoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9a5 5 0 0 0 0 10h3" />
  </Svg>
);
export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);
export const ExpandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
export const ShrinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
);
export const IndicatorIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17c3-6 5-9 8-6s5 1 10-6" />
    <path d="M3 21h18" />
  </Svg>
);
export const CodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
  </Svg>
);
export const FlaskIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
    <path d="M7 15h10" />
  </Svg>
);
export const ReplayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M10 9l5 3-5 3Z" />
  </Svg>
);
export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Svg>
);
export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Svg>
);
export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h9M4 9h12M4 13h7M4 17h14M4 21h10" />
  </Svg>
);
export const NewsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h13v14H6a2 2 0 0 1-2-2Z" />
    <path d="M17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5" />
  </Svg>
);
export const LayoutIcon = ({ count, size = 18 }: { count: number; size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    {(count === 2 || count === 4) && <path d="M12 4v16" />}
    {(count === 3 || count >= 5) && <path d="M9 4v16M15 4v16" />}
    {count >= 4 && <path d="M3 12h18" />}
  </Svg>
);
export const ChevronDown = (p: IconProps) => (
  <Svg {...p} size={p.size ?? 14}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const StarIcon = ({ filled, size = 14 }: { filled?: boolean; size?: number }) => (
  <Svg size={size} fill={filled ? "currentColor" : "none"}>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9Z" />
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p} size={p.size ?? 16}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p} size={p.size ?? 16}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const SaveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h11l3 3v13H5Z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </Svg>
);
export const ChevronRight = (p: IconProps) => (
  <Svg {...p} size={p.size ?? 14}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const ChevronLeft = (p: IconProps) => (
  <Svg {...p} size={p.size ?? 14}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);
export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
  </Svg>
);
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </Svg>
);
export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </Svg>
);
export const MessageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v11H9l-5 4Z" />
  </Svg>
);
export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 3 3 10.5l7 2.5 2.5 7Z" />
    <path d="m10 13 4.5-4.5" />
  </Svg>
);
