export const theme = {
  colors: {
    bg: "#ffffff",
    bgSub: "#f9fafb",
    surface: "#f2f4f6",
    surfaceHover: "#e8ebee",
    border: "#e5e8eb",
    text: "#191f28",
    textSub: "#4e5968",
    textWeak: "#8b95a1",
    textDisabled: "#b0b8c1",
    primary: "#3182f6",
    primaryHover: "#1b64da",
    primaryWeak: "#e8f3ff",
    rise: "#f04452",
    riseWeak: "#fff0f1",
    fall: "#3182f6",
    fallWeak: "#e8f3ff",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    full: "9999px",
  },
  layout: {
    headerHeight: "60px",
    maxWidth: "1440px",
    sidebarWidth: "320px",
  },
  shadow: {
    card: "0 2px 8px rgba(0, 23, 51, 0.04)",
    popover: "0 8px 24px rgba(0, 23, 51, 0.12)",
  },
} as const;

export type AppTheme = typeof theme;
