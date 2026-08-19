import Image from "next/image";
import React, { useRef, useCallback, useEffect } from "react";
import { useZoomImageMove } from "@zoom-image/react";

// The source images are used as-is (no cropping or preprocessing), so any
// shape can arrive: wide title strips, 4:3 camera photos, tall pages. The
// image renders at its own aspect ratio, as large as the space allows:
// - width is bounded by w-[90%], matching the transcription card below so the
//   image area lines up with the card's edges at every window size (the old
//   95% container could stick out past the card's edge, which made the
//   zoom-cleanup bug handled in setupZoom below extra visible)
// - height is bounded by `maxHeight`, the leftover screen height measured by
//   TaskView after the card takes what it needs, so image + card fill the
//   screen together without scrolling — whatever the image shape, screen
//   size, or card state. The 45vh class only covers the first paint, before
//   the measurement arrives.
function DisplayImage({ task, maxHeight }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const { createZoomImage } = useZoomImageMove();

  const url = task?.url;

  // Zoom roughly up to the fetched file's real resolution instead of a fixed
  // 2x: the photos hold far more detail than the preview shows, and reading
  // the title text is the whole task. Clamped so tiny sources still zoom
  // usefully and large ones don't blow past their pixels into blur.
  const setupZoom = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0 || !containerRef.current)
      return;
    const detailRatio = img.width > 0 ? img.naturalWidth / img.width : 2;
    createZoomImage(containerRef.current, {
      zoomFactor: Math.min(4, Math.max(2, detailRatio)),
    });
    // The zoom library's internal cleanup (run before every re-create, i.e.
    // every task change) stamps `width/height: 100%` inline on the container,
    // un-shrinking it so the image sits left of the empty remainder. This was
    // the testers' "image is no longer centered" bug: it hit every task after
    // the first. Clear the stamped styles so the container keeps hugging the
    // image — the zoom math needs the container to match the image box.
    containerRef.current.style.width = "";
    containerRef.current.style.height = "";
  }, [createZoomImage]);

  // The zoom clone is sized when created, so re-create it whenever the
  // rendered size may have changed (new measurement, window resize, the card
  // below growing). createZoomImage cleans up the previous instance itself.
  useEffect(() => {
    setupZoom();
  }, [maxHeight, url, setupZoom]);

  return (
    <div className="w-[90%] flex justify-center">
      <div
        className="relative cursor-crosshair overflow-hidden"
        ref={containerRef}
      >
        {/* width={0} height={0} + w-auto/h-auto renders at the image's actual
            aspect ratio instead of a fixed box */}
        <Image
          ref={imgRef}
          src={url}
          alt="image"
          width={0}
          height={0}
          sizes="95vw"
          className="w-auto h-auto max-w-full max-h-[45vh]"
          style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
          onLoad={setupZoom}
          priority={true}
        />
      </div>
    </div>
  );
}

export default DisplayImage;
