"use client";

import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-3 py-1.5">
      <button
        type="button"
        onClick={() => zoomOut()}
        className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        title="Zoom out"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => zoomIn()}
        className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        title="Zoom in"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>
      <div className="mx-1 h-4 w-px bg-gray-300" />
      <button
        type="button"
        onClick={() => resetTransform()}
        className="flex h-7 items-center justify-center rounded border border-gray-300 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        title="Reset zoom"
      >
        Fit
      </button>
    </div>
  );
}

interface ImageViewerProps {
  url: string;
}

export default function ImageViewer({ url }: ImageViewerProps) {
  return (
    <div className="flex h-full w-full flex-col bg-white">
      <TransformWrapper
        initialScale={1}
        minScale={0.25}
        maxScale={5}
        centerOnInit
      >
        <ZoomControls />
        <div className="flex-1 overflow-hidden bg-gray-50">
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Uploaded document"
              className="max-w-full max-h-full object-contain"
            />
          </TransformComponent>
        </div>
      </TransformWrapper>
    </div>
  );
}
