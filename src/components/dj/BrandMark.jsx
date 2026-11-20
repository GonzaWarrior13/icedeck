import React from 'react';

// Rinkbeats wordmark: geometric uppercase, wide tracking, and the mint bar
// joining the K and the B, as in the logo.
export default function BrandMark({ size = 'md', className = '' }) {
  const icon = size === 'lg' ? 'w-8 h-8' : 'w-[22px] h-[22px]';
  const text = size === 'lg' ? 'text-[20px]' : 'text-[15px]';
  const bar = size === 'lg' ? 'h-[15px]' : 'h-[11px]';

  return (
    <span className={`flex items-center gap-2.5 no-select ${className}`}>
      <svg
        viewBox="0 0 24 24"
        className={`${icon} shrink-0 text-primary`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <ellipse cx="12" cy="6.5" rx="7" ry="2.8" />
        <path d="M5 6.5v9.2c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6.5" />
        <path d="M7.6 6.5c.9-.9 1.7.9 2.6 0s1.7-.9 2.6 0" strokeWidth="1.3" />
        <path d="M5.7 11.6c.9-.9 1.7.9 2.6 0s1.7-.9 2.6 0" strokeWidth="1.3" />
        <path d="M13.1 11.6c.9-.9 1.7.9 2.6 0s1.7-.9 2.6 0" strokeWidth="1.3" />
      </svg>
      <span className={`font-body font-bold uppercase leading-none tracking-[0.16em] text-foreground ${text}`}>
        RIN<span className="tracking-normal">K</span><span className={`mx-[3px] inline-block w-[2px] align-middle bg-primary ${bar}`} aria-hidden="true" /><span className="tracking-normal">B</span>EATS
      </span>
    </span>
  );
}