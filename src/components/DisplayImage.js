import Image from "next/image";
import React, { useRef, useCallback } from "react";
import { useZoomImageMove } from "@zoom-image/react";

function DisplayImage({ task }) {
  const containerRef = useRef(null);
  const { createZoomImage } = useZoomImageMove();

  const url = task?.url;
  const handleImageLoad = useCallback(() => {
    if (containerRef.current) {
      createZoomImage(containerRef.current, {
        zoomFactor: 2,
      });
    }
  }, [url]);

  return (
    <div
      className="relative inline-block max-w-[95%] cursor-crosshair overflow-hidden"
      ref={containerRef}
    >
      {/* width={0} height={0} + w-auto/h-auto renders at the image's actual
          aspect ratio, whatever shape a given batch's crops turn out to be
          (wide strips, tall pages, square crops, ...). max-h keeps very
          tall images from pushing the transcription fields off screen. */}
      <Image
        src={url}
        alt="image"
        width={0}
        height={0}
        sizes="95vw"
        className="w-auto h-auto max-w-full max-h-[40vh]"
        onLoad={handleImageLoad}
        priority={true}
      />
    </div>
  );
}

export default DisplayImage;
