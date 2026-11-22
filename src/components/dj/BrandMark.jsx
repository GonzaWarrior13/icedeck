import React from 'react';
import { Image } from '@/components/ui/image';

// The Rinkbeats wordmark artwork (white type, mint bars on black). The black
// plate is screened away so it sits flush on the dark console surfaces.
const LOGO = 'https://base44.app/api/apps/6a8f48cd9a055819d8b79b87/files/mp/public/6a8f48cd9a055819d8b79b87/eec752d2d_rinkbeats-logo.png';

export default function BrandMark({ size = 'md', className = '' }) {
  const height = size === 'lg' ? 'h-8' : 'h-[21px]';

  return (
    <span className={`inline-flex flex-col items-start no-select ${className}`}>
      <Image
        src={LOGO}
        alt="Rinkbeats"
        fittingType="fit"
        className={`${height} w-auto`}
        style={{ mixBlendMode: 'screen' }}
      />
      <span className="mt-1 text-[14px] font-medium tracking-[0.14em] text-muted-foreground/55 md:text-[9px]">
        By Gonzalo Coco
      </span>
    </span>
  );
}