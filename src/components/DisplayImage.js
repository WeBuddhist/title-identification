import Image from "next/image";
import React, { useRef, useCallback, useEffect, useState } from "react";
import { useZoomImageMove } from "@zoom-image/react";

// The source images are used as-is (no cropping or preprocessing), so any
// shape can arrive: wide title strips, 4:3 camera photos, tall pages. The
// image spans the full width of the transcription card below (w-[90%]), as
// the HTR and Normalisation tools do, so the monks can read the text; the
// page scrolls to the card instead of shrinking the image to fit beside it.
// Small crops are scaled up to that width too. Only a tall page is held back,
// to one screen height (MAX_HEIGHT), so the whole page is visible at once:
// its width is capped at MAX_HEIGHT x its aspect ratio, known once it loads.
const MAX_HEIGHT = "90vh";

function DisplayImage({ task }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const { createZoomImage } = useZoomImageMove();
  const [aspectRatio, setAspectRatio] = useState(null);

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
    // which breaks the hugging below and un-centers the image (the testers'
    // "image is no longer centered" bug). Clear the stamped styles so the
    // container keeps hugging the image — the zoom math needs the container
    // to match the image box.
    containerRef.current.style.width = "";
    containerRef.current.style.height = "";
  }, [createZoomImage]);

  const readAspectRatio = useCallback(() => {
    const img = imgRef.current;
    setAspectRatio(
      img?.complete && img.naturalHeight > 0
        ? img.naturalWidth / img.naturalHeight
        : null
    );
  }, []);

  const handleLoad = useCallback(() => {
    readAspectRatio();
    setupZoom();
  }, [readAspectRatio, setupZoom]);

  // On a new image, drop the old one's width cap — or read the new one's
  // right away: a cached image can finish loading before React attaches
  // onLoad, which then never fires.
  useEffect(() => {
    readAspectRatio();
  }, [url, readAspectRatio]);

  // The zoom clone is sized when created, so re-create it whenever the
  // rendered size changes (window resize, the width cap arriving).
  // createZoomImage cleans up the previous instance itself.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(setupZoom);
    observer.observe(container);
    return () => observer.disconnect();
  }, [setupZoom]);

  return (
    <div className="w-[90%] flex justify-center">
      <div
        className="relative w-full cursor-crosshair overflow-hidden"
        ref={containerRef}
        style={
          aspectRatio
            ? { maxWidth: `calc(${MAX_HEIGHT} * ${aspectRatio})` }
            : undefined
        }
      >
        {/* width={0} height={0} + w-full/h-auto renders at the image's actual
            aspect ratio instead of a fixed box */}
        <Image
          ref={imgRef}
          src={url}
          alt="image"
          width={0}
          height={0}
          sizes="95vw"
          className="w-full h-auto"
          onLoad={handleLoad}
          priority={true}
        />
      </div>
    </div>
  );
}

export default DisplayImage;
