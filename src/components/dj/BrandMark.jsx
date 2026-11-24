import React from 'react';

export default function BrandMark({ size = 'md', className = '' }) {
  const width = size === 'lg' ? 'w-44 sm:w-52' : 'w-32 md:w-40';

  return (
    <span className={`${width} ${className} relative inline-block aspect-[693/104] overflow-hidden`}>
      <img src="/rinkbeats-brand.jpg" alt="RinkBeats" width="693" height="693"
        className="h-full w-full object-cover object-[center_75.5%] mix-blend-screen" />
    </span>
  );
}
