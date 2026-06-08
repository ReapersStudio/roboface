import { Check } from "lucide-react";

export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ children, className = "", variant = "primary", ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="toggle-row">
      <span>
        <span className="control-label">{label}</span>
        {description && <span className="control-hint">{description}</span>}
      </span>
      <button
        type="button"
        aria-label={label}
        aria-pressed={checked}
        className={`toggle ${checked ? "toggle-on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob">
          {checked && <Check size={12} strokeWidth={3} />}
        </span>
      </button>
    </div>
  );
}

export function TextField({ label, value, onChange, type = "text", ...props }) {
  return (
    <label className="field">
      <span className="control-label">{label}</span>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span className="control-label">{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SliderField({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "" }) {
  return (
    <label className="field">
      <span className="flex items-center justify-between gap-3">
        <span className="control-label">{label}</span>
        <span className="mono-value">
          {value}
          {suffix}
        </span>
      </span>
      <input
        className="slider"
        min={min}
        max={max}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SwatchField({ label, value, onChange }) {
  return (
    <label className="field">
      <span className="control-label">{label}</span>
      <span className="color-input">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <span>{value}</span>
      </span>
    </label>
  );
}
