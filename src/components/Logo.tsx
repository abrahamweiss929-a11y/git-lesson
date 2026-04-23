interface LogoProps {
  size?: number;
}

export default function Logo({ size = 36 }: LogoProps) {
  return (
    <div
      className="relative shrink-0 rounded-xl"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, #0D9488 0%, #14B8A6 40%, #F59E0B 100%)",
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex items-center justify-center text-white">
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 2h4v6l5 9a2 2 0 01-2 3H7a2 2 0 01-2-3l5-9V2z" />
          <circle cx="14" cy="16" r="1" fill="currentColor" />
          <circle cx="10" cy="18" r="0.7" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
