'use client';

import { useEffect, useRef } from 'react';

export default function HlsPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled || !ref.current) return;
        if (Hls.isSupported()) {
          const instance = new Hls({
            liveSyncDurationCount: 3,
            lowLatencyMode: true,
            manifestLoadingMaxRetry: 10,
            manifestLoadingRetryDelay: 1000,
          });
          instance.loadSource(src);
          instance.attachMedia(ref.current);
          hls = instance;
        }
      });
    }
    return () => {
      cancelled = true;
      if (hls) hls.destroy();
    };
  }, [src]);

  return <video ref={ref} controls autoPlay muted playsInline />;
}
