export default function RadarIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Outer arc */}
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Middle arc */}
      <path
        d="M12 7a5 5 0 0 1 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Inner arc */}
      <path
        d="M12 11a1 1 0 0 1 1 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* Center point */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      {/* Vertical baseline */}
      <line x1="12" y1="3" x2="12" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      {/* Horizontal baseline */}
      <line x1="12" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.15" />
    </svg>
  );
}
