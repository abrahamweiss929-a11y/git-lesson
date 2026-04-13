"use client";

import { useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from "react-resizable-panels";
import type { UploadedFileInfo } from "@/components/DocumentUpload";
import DocumentPane from "@/components/DocumentPane";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface VerificationLayoutProps {
  uploadedFiles: UploadedFileInfo[];
  children: React.ReactNode;
}

export default function VerificationLayout({
  uploadedFiles,
  children,
}: VerificationLayoutProps) {
  const isMobile = useMediaQuery("(max-width: 899px)");
  const [collapsed, setCollapsed] = useState(false);
  const documentPanelRef = usePanelRef();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "doc-verification-pane",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  // No documents — render standard single-column layout
  if (uploadedFiles.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">{children}</div>
    );
  }

  // Mobile: stacked vertical layout
  if (isMobile) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
        <div className="max-h-[50vh] shrink-0 overflow-hidden border-b border-gray-200">
          <DocumentPane files={uploadedFiles} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-8">{children}</div>
      </div>
    );
  }

  // Desktop: split-pane layout
  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-hidden">
      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        id="doc-verification-pane"
      >
        {/* Left pane: document viewer */}
        <Panel
          id="document"
          defaultSize="50%"
          minSize="20%"
          collapsible={true}
          collapsedSize="0%"
          onResize={(panelSize) => {
            setCollapsed(panelSize.asPercentage === 0);
          }}
          panelRef={documentPanelRef}
        >
          <DocumentPane files={uploadedFiles} />
        </Panel>

        {/* Resize handle */}
        <Separator className="group relative flex w-2 items-center justify-center bg-gray-200 transition-colors hover:bg-blue-400">
          <div className="h-8 w-0.5 rounded bg-gray-400 transition-colors group-hover:bg-white" />
        </Separator>

        {/* Right pane: form */}
        <Panel id="form" defaultSize="50%" minSize="20%">
          <div className="flex h-full">
            {/* Collapsed strip — show expand button */}
            {collapsed && (
              <button
                type="button"
                onClick={() => documentPanelRef.current?.expand()}
                className="flex w-8 shrink-0 flex-col items-center justify-center gap-2 border-r border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100"
              >
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
                <span className="text-xs text-gray-500 [writing-mode:vertical-lr] rotate-180">
                  Show document
                </span>
              </button>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-8">
              {children}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
