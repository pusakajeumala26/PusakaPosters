import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconGallery = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </Svg>
);
export const IconBoard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="10" y="4" width="5" height="10" rx="1.5" />
    <rect x="17" y="4" width="4" height="13" rx="1.5" />
  </Svg>
);
export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
);
export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const IconMcp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.67 11.42 C4.98 10.13 10.18 5.03 11.58 3.68 C12.97 2.33 11.86 3.42 12.02 3.32 C12.17 3.22 12.26 3.15 12.50 3.08 C12.74 3.00 13.19 2.91 13.47 2.88 C13.74 2.86 13.92 2.89 14.16 2.94 C14.40 2.99 14.67 3.06 14.89 3.18 C15.12 3.29 15.35 3.47 15.53 3.63 C15.71 3.80 15.85 3.98 15.96 4.17 C16.08 4.36 16.15 4.52 16.22 4.77 C16.28 5.01 16.33 5.32 16.35 5.65 C16.37 5.99 16.34 6.58 16.34 6.77 M17.59 9.45 C16.63 10.40 12.86 14.10 11.79 15.13 C10.71 16.16 11.36 15.50 11.13 15.63 C10.91 15.76 10.66 15.84 10.44 15.90 C10.21 15.96 9.95 15.97 9.78 15.99 C9.62 16.00 9.66 16.01 9.45 15.97 C9.25 15.93 8.77 15.84 8.55 15.77 C8.32 15.70 8.26 15.63 8.12 15.55 C7.99 15.46 7.86 15.35 7.74 15.24 C7.62 15.12 7.50 14.99 7.41 14.86 C7.31 14.72 7.24 14.66 7.17 14.43 C7.09 14.20 6.97 13.79 6.95 13.49 C6.92 13.18 6.96 12.87 7.02 12.60 C7.08 12.33 7.18 12.09 7.31 11.86 C7.44 11.64 6.74 12.32 7.79 11.27 C8.85 10.22 12.67 6.52 13.64 5.58 M13.76 21.12 C13.52 20.88 12.59 20.00 12.33 19.66 C12.07 19.32 12.20 19.28 12.21 19.10 C12.21 18.92 11.12 19.86 12.35 18.58 C13.59 17.30 18.33 12.71 19.62 11.40 C20.90 10.10 19.96 10.96 20.07 10.75 C20.18 10.53 20.23 10.34 20.27 10.11 C20.31 9.88 20.34 9.64 20.33 9.38 C20.31 9.12 20.25 8.79 20.17 8.55 C20.09 8.31 19.99 8.12 19.86 7.93 C19.72 7.74 19.52 7.54 19.35 7.39 C19.18 7.24 18.99 7.13 18.81 7.04 C18.63 6.95 18.50 6.91 18.29 6.86 C18.08 6.82 17.86 6.78 17.54 6.76 C17.21 6.75 16.54 6.77 16.34 6.77 M9.57 13.39 C10.70 12.29 15.21 7.87 16.34 6.77" />
  </Svg>
);
export const IconShieldLock = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 9.807V6a1 1 0 00-1-1c-2 0-4.49-1.19-6.24-2.72a1.17 1.17 0 00-1.52 0C9.5 3.8 7 5 5 5a1 1 0 00-1 1v7c0 3.88 2.107 6.254 5 7.796" />
    <path d="M19 17v-2a2 2 0 00-4 0v2" />
    <rect x="13" y="17" width="8" height="5" rx="1" />
  </Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
  </Svg>
);
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);
export const IconSort = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.5}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg {...p} strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Svg>
);
export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
  </Svg>
);
export const IconImage = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.5}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </Svg>
);
