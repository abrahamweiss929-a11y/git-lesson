import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "building"
  | "orders"
  | "receipts"
  | "usage"
  | "items"
  | "ask"
  | "search"
  | "plus"
  | "sparkle"
  | "trash"
  | "chevron"
  | "chevronLeft"
  | "chevronDown"
  | "arrow"
  | "upload"
  | "check"
  | "x"
  | "send"
  | "sort"
  | "sortUp"
  | "sortDown"
  | "pdf"
  | "excel"
  | "warning"
  | "info"
  | "download"
  | "flask"
  | "clock"
  | "package"
  | "paperclip"
  | "circle"
  | "chevronRight";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2" />
    </>
  ),
  orders: (
    <>
      <path d="M9 3h6l1 4H8l1-4z" />
      <path d="M4 7h16v13a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  receipts: (
    <>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  usage: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 4 3 5-7" />
    </>
  ),
  items: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  ask: (
    <path d="M21 12a8 8 0 01-8 8 8.1 8.1 0 01-3.6-.84L3 21l1.84-6.4A8 8 0 1121 12z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: (
    <>
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />
      <path d="M19 17l.6 1.8L21 19l-1.4.4L19 21l-.6-1.6L17 19l1.4-.2z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  arrow: <path d="M5 12h14M13 5l7 7-7 7" />,
  upload: (
    <>
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      <path d="M12 3v13M7 8l5-5 5 5" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  sort: (
    <>
      <path d="M7 4v16M3 8l4-4 4 4" />
      <path d="M17 20V4M21 16l-4 4-4-4" />
    </>
  ),
  sortUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  sortDown: <path d="M12 5v14M5 12l7 7 7-7" />,
  pdf: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  excel: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4M12 18v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M12 11v6" />
    </>
  ),
  download: (
    <>
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      <path d="M12 3v13M7 12l5 5 5-5" />
    </>
  ),
  flask: (
    <>
      <path d="M10 2h4M10 2v6l-6 10a2 2 0 002 2h12a2 2 0 002-2L14 8V2" />
      <path d="M7 14h10" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  package: (
    <>
      <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </>
  ),
  paperclip: (
    <path d="M21 11l-9 9a5 5 0 01-7-7l9-9a3 3 0 014 4l-9 9a1 1 0 01-1-1l8-8" />
  ),
  circle: <circle cx="12" cy="12" r="9" />,
};

export default function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
