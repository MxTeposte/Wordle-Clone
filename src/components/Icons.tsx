type IconProps = { className?: string };

const base = (className = 'size-6') => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const HelpIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" />
    <path d="M12 17h.01" />
  </svg>
);

export const StatsIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </svg>
);

export const SettingsIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);

export const HomeIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v10h12V10" />
  </svg>
);

export const GlobeIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
  </svg>
);

export const BackspaceIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" />
    <path d="m12 9 6 6M18 9l-6 6" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ShareIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

/** Logotipo: cuatro casillas con los colores del juego. */
export const Logo = ({ className = 'size-7' }: IconProps) => (
  <svg className={className} viewBox="0 0 32 32" aria-hidden>
    <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--correct)" />
    <rect x="17" y="1" width="14" height="14" rx="3" fill="var(--present)" />
    <rect x="1" y="17" width="14" height="14" rx="3" fill="var(--absent)" />
    <rect x="17" y="17" width="14" height="14" rx="3" fill="var(--accent)" />
  </svg>
);
