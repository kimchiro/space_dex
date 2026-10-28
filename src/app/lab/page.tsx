import type { Metadata } from "next";
import { Suspense } from "react";
import LabView from "@/components/lab/LabView";

export const metadata: Metadata = {
  title: "차트·전략 실험실 | Space DEX",
};

export default function LabPage() {
  return (
    <Suspense fallback={null}>
      <LabView />
    </Suspense>
  );
}
