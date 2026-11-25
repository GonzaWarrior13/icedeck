import React from 'react';

export default function BrandMark({ wordmark = false }) {
  return (
    <img src={wordmark ? '/dropdeck-logo.svg#wordmark' : '/dropdeck-logo.svg'} alt="DropDeck"
      width="788" height={wordmark ? 112 : 566}
      className={`block h-auto ${wordmark ? 'w-44 sm:w-52' : 'w-24 md:w-40'}`} />
  );
}
