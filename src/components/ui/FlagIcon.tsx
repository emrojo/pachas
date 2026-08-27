'use client';

import React from 'react';
import { LanguageCode } from '@/locales';

export interface FlagIconProps {
  code: LanguageCode | string;
  className?: string;
}

export const SpainFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 640 480"
    className={`inline-block rounded-xs shadow-2xs shrink-0 overflow-hidden border border-black/10 dark:border-white/10 ${className}`}
    aria-label="Bandera de España"
  >
    <path fill="#c60b1e" d="M0 0h640v480H0z" />
    <path fill="#ffc400" d="M0 120h640v240H0z" />
    {/* Stylized coat of arms */}
    <g transform="translate(130, 160) scale(0.65)">
      <rect x="0" y="20" width="80" height="110" rx="8" fill="#c60b1e" stroke="#ffc400" strokeWidth="4" />
      <path d="M 0 75 Q 40 145 80 75 Z" fill="#c60b1e" />
      <rect x="25" y="45" width="30" height="45" fill="#ffc400" rx="4" />
      <circle cx="40" cy="15" r="14" fill="#ffc400" />
      <path d="M 28 8 L 52 8 L 40 0 Z" fill="#c60b1e" />
      {/* Pillars of Hercules */}
      <rect x="-24" y="25" width="10" height="95" rx="3" fill="#ffffff" opacity="0.9" />
      <rect x="94" y="25" width="10" height="95" rx="3" fill="#ffffff" opacity="0.9" />
      <circle cx="-19" cy="20" r="7" fill="#ffc400" />
      <circle cx="99" cy="20" r="7" fill="#ffc400" />
    </g>
  </svg>
);

export const UKFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 640 480"
    className={`inline-block rounded-xs shadow-2xs shrink-0 overflow-hidden border border-black/10 dark:border-white/10 ${className}`}
    aria-label="Flag of the United Kingdom"
  >
    <path fill="#012169" d="M0 0h640v480H0z" />
    <path fill="#FFF" d="m75 0 245 180L565 0h75v60L435 240l205 150v90h-75L320 300 75 480H0v-60l205-150L0 90V0h75z" />
    <path fill="#C8102E" d="m424 288 216 156v36L390 288h34zM640 0v16L450 156h-34L640 0zM0 480v-16l190-140h34L0 480zM0 0l224 164h-34L0 20V0z" />
    <path fill="#FFF" d="M240 0h160v480H240zM0 160h640v160H0z" />
    <path fill="#C8102E" d="M272 0h96v480h-96zM0 192h640v96H0z" />
  </svg>
);

export const FlagIcon: React.FC<FlagIconProps> = ({ code, className = 'w-5 h-3.5' }) => {
  switch (code) {
    case 'es':
      return <SpainFlag className={className} />;
    case 'en':
      return <UKFlag className={className} />;
    default:
      return <SpainFlag className={className} />;
  }
};
