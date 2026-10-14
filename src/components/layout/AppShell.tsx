"use client";

import styled from "styled-components";
import Header from "./Header";
import RightSidebar from "./RightSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <Body>
        <Main>{children}</Main>
        <RightSidebar />
      </Body>
    </>
  );
}

const Body = styled.div`
  display: flex;
  gap: 24px;
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: 24px;
`;

const Main = styled.main`
  flex: 1;
  min-width: 0;
`;
