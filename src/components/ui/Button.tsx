import { forwardRef, type ButtonHTMLAttributes } from "react";
import Icon, { type IconName } from "./Icon";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "ghost"
  | "danger";

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs h-8",
  md: "px-4 py-2.5 text-sm h-10",
  lg: "px-6 py-3 text-sm h-12",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-teal-600 to-teal-700 text-white shadow-[0_4px_14px_-2px_rgba(13,148,136,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(13,148,136,0.5)] hover:-translate-y-px active:translate-y-0",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm",
  accent:
    "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_4px_14px_-2px_rgba(245,158,11,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(245,158,11,0.5)] hover:-translate-y-px",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    iconRight,
    loading,
    className = "",
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const iconSize = size === "sm" ? 14 : 16;
  const classes =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25";
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      className={`${classes} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <svg
          className="animate-spin"
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeOpacity="0.25"
          />
          <path
            d="M12 2a10 10 0 0110 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
});

export default Button;
