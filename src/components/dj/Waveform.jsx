import React, { useRef, useEffect, useCallback } from 'react';

export default function Waveform({
  peaks, duration, start, end, currentTime,
  onSeek, onStartChange, onEndChange,
  height = 80, color = '#10B981',
}) {
  const canvasRef = useRef(null);
  const draggingRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    canvas.width = cw * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, height);
    const mid = height / 2;
    if (!peaks || !peaks.length) {
      ctx.fillStyle = '#2E2E2E';
      ctx.fillRect(0, mid - 1, cw, 2);
    } else {
      const barW = cw / peaks.length;
      const playedX = duration ? (currentTime / duration) * cw : 0;
      for (let i = 0; i < peaks.length; i++) {
        const bh = Math.max(1, peaks[i] * (height * 0.92));
        const x = i * barW;
        ctx.fillStyle = x <= playedX ? color : '#2E2E2E';
        ctx.fillRect(x, mid - bh / 2, Math.max(1, barW - 0.5), bh);
      }
    }
    if (duration && currentTime != null) {
      const px = (currentTime / duration) * cw;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(px - 0.5, mid - 9, 1, 18);
    }
    if (start != null && duration) {
      const sx = (start / duration) * cw;
      ctx.fillStyle = '#10B981';
      ctx.fillRect(Math.max(0, sx - 1), 2, 2, 13);
    }
    if (end != null && duration) {
      const ex = (end / duration) * cw;
      ctx.fillStyle = '#A1A1AA';
      ctx.fillRect(Math.min(cw - 2, ex - 1), height - 15, 2, 13);
    }
  }, [peaks, duration, start, end, currentTime, height, color]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const r = () => draw();
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, [draw]);

  const posToTime = (clientX) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(duration || 0, frac * (duration || 0)));
  };

  const onPointerDown = (e) => {
    if (!duration || e.button !== 0 || draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const startDistance = Math.abs(x - start / duration * rect.width);
    const endDistance = end != null ? Math.abs(x - end / duration * rect.width) : Infinity;
    const handle = startDistance <= 14 && y < height / 2 ? 'start'
      : endDistance <= 14 && y >= height / 2 ? 'end' : 'playhead';
    draggingRef.current = { handle, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (handle === 'playhead') onSeek?.(posToTime(e.clientX));
  };
  const onPointerMove = (e) => {
    const drag = draggingRef.current;
    if (drag?.pointerId !== e.pointerId) return;
    const t = posToTime(e.clientX);
    if (drag.handle === 'start') onStartChange?.(Math.min(t, Math.max(0, (end ?? duration) - 0.01)));
    if (drag.handle === 'end') onEndChange?.(Math.max(t, Math.min(duration, start + 0.01)));
    if (drag.handle === 'playhead') onSeek?.(t);
  };
  const onPointerEnd = (e) => {
    if (draggingRef.current?.pointerId === e.pointerId) draggingRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="Audio waveform"
      className="block w-full touch-none cursor-grab active:cursor-grabbing"
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    />
  );
}
