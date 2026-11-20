import React, { useRef, useEffect, useCallback } from 'react';

export default function Waveform({
  peaks, duration, start, end, currentTime,
  onSeek, onStartChange, onEndChange,
  height = 80, color = '#E7B472',
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
      ctx.fillStyle = '#26231D';
      ctx.fillRect(0, mid - 1, cw, 2);
      return;
    }
    const n = peaks.length;
    const barW = cw / n;
    const playedX = duration ? (currentTime / duration) * cw : 0;
    for (let i = 0; i < n; i++) {
      const p = peaks[i];
      const bh = Math.max(1, p * (height * 0.92));
      const x = i * barW;
      ctx.fillStyle = x <= playedX ? color : '#3B372F';
      ctx.fillRect(x, mid - bh / 2, Math.max(1, barW - 0.5), bh);
    }
    if (duration && currentTime != null) {
      const px = (currentTime / duration) * cw;
      ctx.fillStyle = '#F2EDE4';
      ctx.fillRect(px - 1, 0, 2, height);
    }
    if (start != null && duration) {
      const sx = (start / duration) * cw;
      ctx.fillStyle = '#E7B472';
      ctx.fillRect(sx - 2, 0, 4, height);
    }
    if (end != null && duration) {
      const ex = (end / duration) * cw;
      ctx.fillStyle = '#A8A29A';
      ctx.fillRect(ex - 2, 0, 4, height);
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
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cw = rect.width;
    const startPx = duration ? ((start || 0) / duration) * cw : -10;
    const endPx = duration && end != null ? (end / duration) * cw : -10;
    if (Math.abs(x - startPx) < 8) { draggingRef.current = 'start'; return; }
    if (end != null && Math.abs(x - endPx) < 8) { draggingRef.current = 'end'; return; }
    onSeek?.(posToTime(e.clientX));
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const t = posToTime(e.clientX);
    if (draggingRef.current === 'start') onStartChange?.(t);
    if (draggingRef.current === 'end') onEndChange?.(t);
  };
  const onPointerUp = () => { draggingRef.current = null; };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, touchAction: 'none', cursor: 'pointer' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}