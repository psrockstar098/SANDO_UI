import React from "react";

const paths = {
  plus: "M12 5v14M5 12h14",
  plug: "M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v5",
  puzzle:
    "M10 4a2 2 0 1 1 4 0v1h3a1 1 0 0 1 1 1v3h-1a2 2 0 1 0 0 4h1v3a1 1 0 0 1-1 1h-3v-1a2 2 0 1 0-4 0v1H7a1 1 0 0 1-1-1v-3H5a2 2 0 1 1 0-4h1V6a1 1 0 0 1 1-1h3V4Z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.7a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
  language:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01",
  upgrade: "M12 19V5M5 12l7-7 7 7",
  chevron: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  check: "m5 12 5 5 9-10",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  sidebar: "M4 5h16v14H4zM9 5v14",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6",
  bell: "M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 21h4",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z",
  trash: "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM6 11a6 6 0 0 0 12 0M12 17v4",
  code: "m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14",
  copy: "M9 9h11v11H9zM5 15V4h11",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  chat: "M5 5h14v10H9l-4 4V5Z",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  cloud: "M7 18a4 4 0 1 1 .8-7.9A5.5 5.5 0 0 1 18 11a3.5 3.5 0 0 1 0 7H7Z",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4ZM5 17a3 3 0 0 1 3-3h11",
  pin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z",
  pencil: "M4 20l4-1 11-11-3-3L5 16l-1 4ZM14 6l3 3",
  stop: "M7 7h10v10H7z",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  pause: "M8 5v14M16 5v14",
  logout: "M10 5H5v14h5M15 8l4 4-4 4M19 12H9",
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  className,
  size = 18,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}
