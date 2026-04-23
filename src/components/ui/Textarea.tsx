import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  aiFilled?: boolean;
  wrapperClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    aiFilled,
    rows = 3,
    id,
    className = "",
    wrapperClassName = "",
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
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={`w-full rounded-lg border ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
            : "border-slate-200 focus:border-teal-500 focus:ring-teal-500/10"
        } px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:outline-none transition-all resize-y ${
          aiFilled ? "bg-amber-50/80 border-amber-200" : "bg-white"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <div className="text-xs text-rose-600 mt-1.5">{error}</div>
      ) : hint ? (
        <div className="text-xs text-slate-500 mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
});

export default Textarea;
