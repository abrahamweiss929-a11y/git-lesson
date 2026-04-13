"use client";

import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      <button
        type="button"
        onClick={() => zoomIn()}
        className="rounded bg-white/90 border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 shadow-sm"
      >
        + Zoom
      </button>
      <button
        type="button"
        onClick={() => zoomOut()}
        className="rounded bg-white/90 border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 shadow-sm"
      >
        - Zoom
      </button>
      <button
        type="button"
        onClick={() => resetTransform()}
        className="rounded bg-white/90 border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 shadow-sm"
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
    <div className="relative h-full w-full overflow-hidden bg-gray-100">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
      >
        <ZoomControls />
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
      </TransformWrapper>
    </div>
  );
}
