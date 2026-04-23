import { forwardRef, useId, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  aiFilled?: boolean;
  wrapperClassName?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    aiFilled,
    id,
    className = "",
    wrapperClassName = "",
    children,
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
      <select
        ref={ref}
        id={fieldId}
        className={`w-full appearance-none rounded-lg border ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
            : "border-slate-200 focus:border-teal-500 focus:ring-teal-500/10"
        } px-3.5 py-2.5 pr-9 text-sm text-slate-900 focus:ring-4 focus:outline-none transition-all ${
          aiFilled ? "bg-amber-50/80 border-amber-200" : "bg-white"
        } bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>")] bg-no-repeat bg-[right_0.75rem_center] ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <div className="text-xs text-rose-600 mt-1.5">{error}</div>
      ) : hint ? (
        <div className="text-xs text-slate-500 mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
});

export default Select;
