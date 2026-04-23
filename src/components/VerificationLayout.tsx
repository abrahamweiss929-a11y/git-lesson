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
import Icon from "@/components/ui/Icon";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface VerificationLayoutProps {
  uploadedFiles: UploadedFileInfo[];
  children: React.ReactNode;
}

// Topbar is 72px — use calc to give the split-pane the full remaining height.
const SPLIT_HEIGHT = "h-[calc(100dvh-72px)]";

export default function VerificationLayout({
  uploadedFiles,
  children,
}: VerificationLayoutProps) {
  const isMobile = useMediaQuery("(max-width: 899px)");
  const [collapsed, setCollapsed] = useState(false);
  const documentPanelRef = usePanelRef();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "doc-verification-pane",
    storage:
      typeof window !== "undefined"
        ? localStorage
        : { getItem: () => null, setItem: () => {} },
  });

  // No documents — render standard single-column layout
  if (uploadedFiles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-8">{children}</div>
    );
  }

  // Mobile: stacked vertical layout
  if (isMobile) {
    return (
      <div className={`flex ${SPLIT_HEIGHT} flex-col`}>
        <div className="max-h-[50vh] shrink-0 overflow-hidden border-b border-slate-200">
          <DocumentPane files={uploadedFiles} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    );
  }

  // Desktop: split-pane layout
  return (
    <div className={`${SPLIT_HEIGHT} overflow-hidden`}>
      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        id="doc-verification-pane"
      >
        {/* Left pane: document viewer */}
        <Panel
          id="document"
          defaultSize="45%"
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
        <Separator className="group relative flex w-2 items-center justify-center bg-slate-100 transition-colors hover:bg-teal-400">
          <div className="h-8 w-0.5 rounded bg-slate-300 transition-colors group-hover:bg-white" />
        </Separator>

        {/* Right pane: form */}
        <Panel id="form" defaultSize="55%" minSize="20%">
          <div className="flex h-full">
            {/* Collapsed strip — show expand button */}
            {collapsed && (
              <button
                type="button"
                onClick={() => documentPanelRef.current?.expand()}
                className="flex w-9 shrink-0 flex-col items-center justify-center gap-2 border-r border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100"
                aria-label="Show document"
              >
                <Icon name="chevronLeft" size={16} className="text-slate-500" />
                <span className="text-xs text-slate-500 [writing-mode:vertical-lr] rotate-180">
                  Show document
                </span>
              </button>
            )}
            <div className="flex-1 overflow-y-auto px-8 py-8">{children}</div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
