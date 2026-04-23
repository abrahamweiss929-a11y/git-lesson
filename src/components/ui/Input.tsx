import { forwardRef, useId, type InputHTMLAttributes } from "react";
import Icon, { type IconName } from "./Icon";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  aiFilled?: boolean;
  /** Wrapper class (NOT the input itself). */
  wrapperClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    icon,
    aiFilled,
    className = "",
    wrapperClassName = "",
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={wrapperClassName}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            <Icon name={icon} size={16} />
          </div>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={`w-full rounded-lg border ${
            error
              ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
              : "border-slate-200 focus:border-teal-500 focus:ring-teal-500/10"
          } ${icon ? "pl-9" : "pl-3.5"} pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:outline-none transition-all duration-300 ${
            aiFilled
              ? "bg-amber-50/80 border-amber-200"
              : "bg-white"
          } disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
          {...rest}
        />
        {aiFilled && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none"
            aria-label="Filled by AI"
          >
            <Icon name="sparkle" size={14} />
          </div>
        )}
      </div>
      {error ? (
        <div className="text-xs text-rose-600 mt-1.5">{error}</div>
      ) : hint ? (
        <div className="text-xs text-slate-500 mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
});

export default Input;
