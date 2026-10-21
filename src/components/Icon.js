// Minimal stroke icon set (24px grid).
const PATHS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
  close: "M18 6 6 18M6 6l12 12",
  swap: "M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3",
  plus: "M12 5v14M5 12h14",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a4 4 0 0 1 4-4h4M18 9v6a4 4 0 0 1-4 4h-4",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  copy: "M9 9h10v10H9zM5 15V5h10",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  cube: "M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 0v20M3 7l9 5 9-5",
  back: "M15 18l-6-6 6-6",
  chevron: "M6 9l6 6 6-6",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  key: "M15 7a4 4 0 1 1-3.87 5H8v3H5v-3H3v-3h8.13A4 4 0 0 1 15 7Z",
  home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  code: "m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16",
  play: "M7 4v16l13-8L7 4Z",
  users: "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  building: "M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3M4 21h17",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  shield: "M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z",
  book: "M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4Zm16 0h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7V4Z",
  server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
};

export default function Icon({ name, size = 18, className = "", strokeWidth = 1.9 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0f766e" />
      <path d="M9 9v14M19 9v14M9 16h10" fill="none" stroke="#5eead4" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="24.5" cy="9.5" r="2.6" fill="#fbbf24" />
    </svg>
  );
}
