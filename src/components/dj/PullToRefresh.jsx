import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';

const THRESHOLD = 64;

// Mobile pull-to-refresh around an existing scroll container. It only engages at the
// very top of the list, so the sticky player and page headers keep working.
export default function PullToRefresh({ onRefresh, className = '', contentClassName = '', children }) {
  const scrollRef = useRef(null);
  const pullRef = useRef(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const busy = useRef(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const setPullValue = (value) => {
    pullRef.current = value;
    setPull(value);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const onStart = (event) => {
      if (busy.current || event.touches.length !== 1 || el.scrollTop > 0) return;
      startY.current = event.touches[0].clientY;
      pulling.current = true;
    };

    const onMove = (event) => {
      if (!pulling.current || busy.current) return;
      if (el.scrollTop > 0) {
        pulling.current = false;
        setPullValue(0);
        return;
      }
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPullValue(0);
        return;
      }
      if (event.cancelable) event.preventDefault();
      setPullValue(Math.min(96, delta * 0.5));
    };

    const finish = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullRef.current < THRESHOLD || !refreshRef.current) {
        setPullValue(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setPullValue(THRESHOLD);
      try {
        await refreshRef.current();
      } finally {
        busy.current = false;
        setRefreshing(false);
        setPullValue(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', finish);
    el.addEventListener('touchcancel', finish);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', finish);
      el.removeEventListener('touchcancel', finish);
    };
  }, []);

  return (
    <div ref={scrollRef} className={`relative overflow-y-auto scroll-area ${className}`}>
      <div
        className="flex items-center justify-center overflow-hidden text-muted-foreground"
        style={{ height: pull, transition: pulling.current ? 'none' : 'height 0.2s ease' }}
        aria-live="polite"
      >
        {refreshing ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-label="Refreshing" />
        ) : pull >= THRESHOLD ? (
          <ArrowDown className="w-4 h-4 rotate-180" aria-hidden="true" />
        ) : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}