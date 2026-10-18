import clsx from "clsx";

export interface LogoProps {
  size?: number;
  className?: string;
  /** When true, renders only the inner cart glyph without the blue background squircle */
  glyphOnly?: boolean;
}

/**
 * PromptServe Brand Logo.
 * Uses the exact SVG icon from /public/favicon.svg (blue rounded squircle with white food cart & light blue speed rays).
 */
export function Logo({ size = 44, className, glyphOnly = false }: LogoProps) {
  if (glyphOnly) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={clsx("shrink-0", className)}
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M138.7 160h234.6a26.7 26.7 0 0 1 26.1 21.5l21.3 106.7A26.7 26.7 0 0 1 394.6 320H192a26.7 26.7 0 0 1-25.6-19.4L136 181.3H101.3v-32h56a16 16 0 0 1 15.5 12.6l6.8 30h208l-16 74.7H201.7l6.6 21.4H384v32H198.8a26.7 26.7 0 0 1-25.6-18.8L138.7 160Zm85.3 181.3a32 32 0 1 1 0 64 32 32 0 0 1 0-64Zm138.7 0a32 32 0 1 1 0 64 32 32 0 0 1 0-64Z"
        />
        <path
          fill="currentColor"
          opacity="0.8"
          d="M242.7 85.3h26.6V144h-26.6zM166.7 104l23.1-13.4 29.4 50.9-23 13.3zM322.8 141.5 352.2 90.6l23 13.4-29.3 50.8z"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="112" fill="#006CFE" />
      <path
        fill="#FFFFFF"
        d="M138.7 160h234.6a26.7 26.7 0 0 1 26.1 21.5l21.3 106.7A26.7 26.7 0 0 1 394.6 320H192a26.7 26.7 0 0 1-25.6-19.4L136 181.3H101.3v-32h56a16 16 0 0 1 15.5 12.6l6.8 30h208l-16 74.7H201.7l6.6 21.4H384v32H198.8a26.7 26.7 0 0 1-25.6-18.8L138.7 160Zm85.3 181.3a32 32 0 1 1 0 64 32 32 0 0 1 0-64Zm138.7 0a32 32 0 1 1 0 64 32 32 0 0 1 0-64Z"
      />
      <path
        fill="#9ED0FF"
        d="M242.7 85.3h26.6V144h-26.6zM166.7 104l23.1-13.4 29.4 50.9-23 13.3zM322.8 141.5 352.2 90.6l23 13.4-29.3 50.8z"
      />
    </svg>
  );
}
