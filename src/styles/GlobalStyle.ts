"use client";

import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html,
  body {
    height: 100%;
  }

  body {
    font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
      "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.bg};
    -webkit-font-smoothing: antialiased;
    font-feature-settings: "tnum";
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    font: inherit;
    color: inherit;
    border: none;
    background: none;
    cursor: pointer;
  }

  input {
    font: inherit;
    color: inherit;
    border: none;
    outline: none;
    background: none;
  }

  ul,
  ol {
    list-style: none;
  }
`;
