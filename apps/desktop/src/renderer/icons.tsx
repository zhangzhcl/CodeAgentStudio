/**
 * 内联 SVG 图标集：统一 24 视窗、描边风格，继承 currentColor，
 * 不引入图标库依赖，避免额外体积。
 */
interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconPaperclip = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l8.49-8.48a3.5 3.5 0 1 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" />
  </svg>
);

export const IconGlobe = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
  </svg>
);

export const IconChip = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
    <path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3" />
  </svg>
);

export const IconSend = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const IconStop = ({ size = 18, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
  </svg>
);

export const IconCopy = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

export const IconCheck = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 12.5 10 18 19.5 6.5" />
  </svg>
);

export const IconRefresh = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11A8 8 0 0 0 5.6 6.6L4 8.5M4 13a8 8 0 0 0 14.4 4.4L20 15.5" />
    <path d="M4 4v4.5h4.5M20 20v-4.5h-4.5" />
  </svg>
);

export const IconThumbUp = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M7 11v9H4.5a1.5 1.5 0 0 1-1.5-1.5V12.5A1.5 1.5 0 0 1 4.5 11H7Zm0 0 3.6-7.2A1.5 1.5 0 0 1 13 4.5V9h5a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.8 20H7" />
  </svg>
);

export const IconThumbDown = ({ size = 15, className }: IconProps) => (
  <svg
    {...base(size)}
    className={className}
    style={{ transform: "rotate(180deg)" }}
  >
    <path d="M7 11v9H4.5a1.5 1.5 0 0 1-1.5-1.5V12.5A1.5 1.5 0 0 1 4.5 11H7Zm0 0 3.6-7.2A1.5 1.5 0 0 1 13 4.5V9h5a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.8 20H7" />
  </svg>
);

export const IconPlus = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconChevronDown = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconChevronRight = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconChevronLeft = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const IconPencil = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L8 17l-4 1 1-4 9.5-9.5Z" />
  </svg>
);

export const IconFile = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" />
    <path d="M13 3v6h6" />
  </svg>
);

export const IconX = ({ size = 13, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconArrowDown = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

export const IconTrash = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const IconChat = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z" />
  </svg>
);

export const IconTerminal = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m7 9 3 3-3 3M13 15h4" />
  </svg>
);

export const IconSpinner = ({ size = 14, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeOpacity="0.2"
      strokeWidth="2.4"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 12 12"
        to="360 12 12"
        dur="0.8s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

/** 四角星：品牌标识专用，填充式 */
export const IconSparkle = ({ size = 12, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M12 2c.6 4.9 2.4 6.9 10 10-7.6 3.1-9.4 5.1-10 10-.6-4.9-2.4-6.9-10-10 7.6-3.1 9.4-5.1 10-10Z" />
  </svg>
);

export const IconMore = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
  </svg>
);

export const IconSun = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const IconMoon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
  </svg>
);
