'use client';

import React from 'react';
import { LanguageCode } from '@/locales';

export interface FlagIconProps {
  code: LanguageCode | string;
  className?: string;
}

const baseSvgClass = 'inline-block rounded-xs shadow-2xs shrink-0 overflow-hidden border border-black/10 dark:border-white/10';

export const SpainFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="España">
    <path fill="#c60b1e" d="M0 0h640v480H0z" />
    <path fill="#ffc400" d="M0 120h640v240H0z" />
    <g transform="translate(130, 160) scale(0.65)">
      <rect x="0" y="20" width="80" height="110" rx="8" fill="#c60b1e" stroke="#ffc400" strokeWidth="4" />
      <path d="M 0 75 Q 40 145 80 75 Z" fill="#c60b1e" />
      <rect x="25" y="45" width="30" height="45" fill="#ffc400" rx="4" />
      <circle cx="40" cy="15" r="14" fill="#ffc400" />
      <path d="M 28 8 L 52 8 L 40 0 Z" fill="#c60b1e" />
      <rect x="-24" y="25" width="10" height="95" rx="3" fill="#ffffff" opacity="0.9" />
      <rect x="94" y="25" width="10" height="95" rx="3" fill="#ffffff" opacity="0.9" />
      <circle cx="-19" cy="20" r="7" fill="#ffc400" />
      <circle cx="99" cy="20" r="7" fill="#ffc400" />
    </g>
  </svg>
);

export const UKFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="United Kingdom">
    <path fill="#012169" d="M0 0h640v480H0z" />
    <path fill="#FFF" d="m75 0 245 180L565 0h75v60L435 240l205 150v90h-75L320 300 75 480H0v-60l205-150L0 90V0h75z" />
    <path fill="#C8102E" d="m424 288 216 156v36L390 288h34zM640 0v16L450 156h-34L640 0zM0 480v-16l190-140h34L0 480zM0 0l224 164h-34L0 20V0z" />
    <path fill="#FFF" d="M240 0h160v480H240zM0 160h640v160H0z" />
    <path fill="#C8102E" d="M272 0h96v480h-96zM0 192h640v96H0z" />
  </svg>
);

export const GaliciaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Galicia">
    <path fill="#ffffff" d="M0 0h640v480H0z" />
    <path fill="#0091dc" d="M0 80 L520 480 L640 480 L120 0 L0 0 Z" />
  </svg>
);

export const CataloniaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Catalunya">
    <path fill="#fccf00" d="M0 0h640v480H0z" />
    <path fill="#d90000" d="M0 53.3h640v53.4H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0z" />
  </svg>
);

export const BasqueFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Euskadi">
    <path fill="#d90000" d="M0 0h640v480H0z" />
    <path fill="#008000" d="M0 0 L640 480 M640 0 L0 480" stroke="#008000" strokeWidth="90" />
    <path fill="#ffffff" d="M0 190h640v100H0zm270-190h100v480H270z" />
  </svg>
);

export const ValenciaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Comunitat Valenciana">
    <path fill="#fccf00" d="M0 0h640v480H0z" />
    <path fill="#d90000" d="M0 53.3h640v53.4H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0z" />
    {/* Blue hoist with crown styling */}
    <rect x="0" y="0" width="160" height="480" fill="#003da5" />
    <path d="M 30 180 L 130 180 L 120 280 L 40 280 Z" fill="#d90000" />
    <circle cx="80" cy="220" r="16" fill="#fccf00" />
    <path d="M 30 180 L 50 140 L 80 165 L 110 140 L 130 180 Z" fill="#fccf00" />
  </svg>
);

export const FranceFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="France">
    <path fill="#002395" d="M0 0h213.3v480H0z" />
    <path fill="#ffffff" d="M213.3 0h213.4v480H213.3z" />
    <path fill="#ed2939" d="M426.7 0h213.3v480H426.7z" />
  </svg>
);

export const PortugalFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Portugal">
    <path fill="#006600" d="M0 0h256v480H0z" />
    <path fill="#ff0000" d="M256 0h384v480H256z" />
    <circle cx="256" cy="240" r="70" fill="#ffcc00" />
    <circle cx="256" cy="240" r="50" fill="#ffffff" stroke="#003399" strokeWidth="4" />
    <path d="M 236 210 h 40 v 40 Q 256 270 236 250 Z" fill="#ff0000" />
  </svg>
);

export const ItalyFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Italia">
    <path fill="#009246" d="M0 0h213.3v480H0z" />
    <path fill="#ffffff" d="M213.3 0h213.4v480H213.3z" />
    <path fill="#ce2b37" d="M426.7 0h213.3v480H426.7z" />
  </svg>
);

export const GermanyFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Deutschland">
    <path fill="#000000" d="M0 0h640v160H0z" />
    <path fill="#dd0000" d="M0 160h640v160H0z" />
    <path fill="#ffce00" d="M0 320h640v160H0z" />
  </svg>
);

export const ChinaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="China">
    <path fill="#de2910" d="M0 0h640v480H0z" />
    {/* Big Star */}
    <polygon fill="#ffde00" points="100,60 112,98 152,98 120,122 132,160 100,136 68,160 80,122 48,98 88,98" />
    {/* 4 Small Stars */}
    <polygon fill="#ffde00" points="200,40 205,52 217,52 208,60 211,72 200,65 189,72 192,60 183,52 195,52" />
    <polygon fill="#ffde00" points="240,80 245,92 257,92 248,100 251,112 240,105 229,112 232,100 223,92 235,92" />
    <polygon fill="#ffde00" points="240,140 245,152 257,152 248,160 251,172 240,165 229,172 232,160 223,152 235,152" />
    <polygon fill="#ffde00" points="200,180 205,192 217,192 208,200 211,212 200,205 189,212 192,200 183,192 195,192" />
  </svg>
);

export const JapanFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Japan">
    <path fill="#ffffff" d="M0 0h640v480H0z" />
    <circle cx="320" cy="240" r="144" fill="#bc002d" />
  </svg>
);

export const IndiaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="India">
    <path fill="#ff9933" d="M0 0h640v160H0z" />
    <path fill="#ffffff" d="M0 160h640v160H0z" />
    <path fill="#138808" d="M0 320h640v160H0z" />
    <circle cx="320" cy="240" r="48" fill="none" stroke="#000080" strokeWidth="6" />
    <circle cx="320" cy="240" r="10" fill="#000080" />
  </svg>
);

export const RussiaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Russia">
    <path fill="#ffffff" d="M0 0h640v160H0z" />
    <path fill="#0039a6" d="M0 160h640v160H0z" />
    <path fill="#d52b1e" d="M0 320h640v160H0z" />
  </svg>
);

export const ArabicFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Arabic">
    <path fill="#007a3d" d="M0 0h640v480H0z" />
    <path fill="#ffffff" d="M120 220 h400 v20 H120z" />
    <path fill="#ffffff" d="M220 260 h200 v12 H220z" />
    <circle cx="320" cy="170" r="28" fill="#ffffff" opacity="0.9" />
  </svg>
);

export const GreeceFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Greece">
    <path fill="#005bae" d="M0 0h640v480H0z" />
    <path fill="#ffffff" d="M0 53.3h640v53.4H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0z" />
    <rect x="0" y="0" width="240" height="240" fill="#005bae" />
    <path fill="#ffffff" d="M96 0h48v240H96zm-96 96h240v48H0z" />
  </svg>
);

export const TurkeyFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Turkey">
    <path fill="#e30a17" d="M0 0h640v480H0z" />
    <circle cx="270" cy="240" r="120" fill="#ffffff" />
    <circle cx="300" cy="240" r="96" fill="#e30a17" />
    <polygon fill="#ffffff" points="390,240 435,255 408,216 408,264 435,225" />
  </svg>
);

export const NetherlandsFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="Netherlands">
    <path fill="#ae1c28" d="M0 0h640v160H0z" />
    <path fill="#ffffff" d="M0 160h640v160H0z" />
    <path fill="#21468b" d="M0 320h640v160H0z" />
  </svg>
);

export const SouthAfricaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 640 480" className={`${baseSvgClass} ${className}`} aria-label="South Africa">
    <path fill="#000000" d="M0 0h640v480H0z" />
    <path fill="#de3831" d="M0 0h640v160H0z" />
    <path fill="#002395" d="M0 320h640v160H0z" />
    <path fill="#ffffff" d="M0 130h640v60H0zm0 160h640v60H0z" />
    <path d="M0 0 L320 240 L0 480 Z" fill="#000000" />
    <path d="M0 30 L280 240 L0 450 Z" fill="#fcb514" />
    <path d="M0 60 L240 240 L0 420 Z" fill="#000000" />
    <path d="M0 170 L260 170 L380 0 L480 0 L340 210 L640 210 L640 270 L340 270 L480 480 L380 480 L260 310 L0 310 Z" fill="#007a3d" />
  </svg>
);

export const FlagIcon: React.FC<FlagIconProps> = ({ code, className = 'w-5 h-3.5' }) => {
  switch (code) {
    case 'es':
      return <SpainFlag className={className} />;
    case 'en':
      return <UKFlag className={className} />;
    case 'gl':
      return <GaliciaFlag className={className} />;
    case 'ca':
      return <CataloniaFlag className={className} />;
    case 'eu':
      return <BasqueFlag className={className} />;
    case 'va':
      return <ValenciaFlag className={className} />;
    case 'fr':
      return <FranceFlag className={className} />;
    case 'pt':
      return <PortugalFlag className={className} />;
    case 'it':
      return <ItalyFlag className={className} />;
    case 'de':
      return <GermanyFlag className={className} />;
    case 'zh':
      return <ChinaFlag className={className} />;
    case 'ja':
      return <JapanFlag className={className} />;
    case 'hi':
      return <IndiaFlag className={className} />;
    case 'ru':
      return <RussiaFlag className={className} />;
    case 'ar':
      return <ArabicFlag className={className} />;
    case 'el':
      return <GreeceFlag className={className} />;
    case 'tr':
      return <TurkeyFlag className={className} />;
    case 'nl':
      return <NetherlandsFlag className={className} />;
    case 'af':
      return <SouthAfricaFlag className={className} />;
    default:
      return <SpainFlag className={className} />;
  }
};
