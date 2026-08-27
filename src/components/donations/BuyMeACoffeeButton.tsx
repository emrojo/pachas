'use client';

import React from 'react';
import { useDonationUrl } from '@/lib/useDonationUrl';
import { Heart } from 'lucide-react';

export interface BuyMeACoffeeButtonProps {
  size?: 'sm' | 'md' | 'lg';
  showHeart?: boolean;
  className?: string;
  customText?: string;
}

export const BuyMeACoffeeButton: React.FC<BuyMeACoffeeButtonProps> = ({
  size = 'md',
  showHeart = false,
  className = '',
  customText = 'Invítame a un café',
}) => {
  const donationUrl = useDonationUrl();

  const sizeClasses = {
    sm: 'text-xs py-1.5 px-3 gap-1.5 h-8',
    md: 'text-xs sm:text-sm py-2 px-4 gap-2 h-9 sm:h-10',
    lg: 'text-sm sm:text-base py-2.5 px-5 gap-2.5 h-11 sm:h-12',
  };

  return (
    <a
      href={donationUrl}
      target="_blank"
      rel="noopener noreferrer"

      className={`inline-flex items-center justify-center font-bold rounded-2xl bg-[#FFDD00] text-slate-900 hover:bg-[#FFE53B] hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer shadow-xs border border-amber-300/60 shrink-0 select-none ${sizeClasses[size]} ${className}`}
      title="Apoya el proyecto en Buy Me a Coffee"
    >
      {/* Official Buy Me a Coffee SVG Logo */}
      <svg
        className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4 sm:w-4.5 sm:h-4.5'}
        viewBox="0 0 1000 1000"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M799.3 490.8c-28.7-27.5-68.7-43.2-111.4-43.2H617V264.4c0-57.8-47-104.8-104.8-104.8H287.4C229.6 159.6 182.6 206.6 182.6 264.4v395.7c0 98.4 80 178.4 178.4 178.4h151.2c98.4 0 178.4-80 178.4-178.4v-42.5h7.3c42.8 0 82.7-15.7 111.4-43.2 29.8-28.5 46.4-67.4 46.4-108.3-.1-40.8-16.6-76.8-46.4-105.3zm-68.2 144.3c-15.7 15-37.1 23.3-60.5 23.3h-53.6v-142.1h53.6c23.4 0 44.8 8.3 60.5 23.3 16.3 15.6 25.4 36.8 25.4 59.8 0 23-9.1 40.1-25.4 55.7zM617 660.1c0 58.2-47.3 105.5-105.5 105.5H361c-58.2 0-105.5-47.3-105.5-105.5V264.4c0-17.6 14.3-31.9 31.9-31.9h224.8c17.6 0 31.9 14.3 31.9 31.9v395.7z" />
      </svg>
      <span>{customText}</span>
      {showHeart && <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse ml-0.5" />}
    </a>
  );
};
