import React from 'react';

export default function BrandMark({ size = 'md', className = '' }) {
  const lockup = size === 'lg';
  const frame = lockup ? 'w-44 sm:w-52 aspect-[784/565]' : 'w-32 md:w-40 aspect-[784/112]';

  return (
    <span className={`${frame} ${className} relative inline-block overflow-hidden mix-blend-screen`}>
      <img src="/dropdeck-brand.webp" alt="DropDeck" width="1698" height="926"
        className={`absolute left-1/2 h-auto w-[216.58%] max-w-none -translate-x-1/2 ${lockup ? 'top-[-33.63%]' : 'top-[-522.32%]'}`} />
    </span>
  );
}
