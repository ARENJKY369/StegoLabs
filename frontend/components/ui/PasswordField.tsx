"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "@/lib/passwordStrength";

const SEGMENT_COLORS = [
  "bg-danger",
  "bg-amber",
  "bg-amber",
  "bg-mint",
  "bg-mint",
];

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showMeter?: boolean;
  autoComplete?: string;
}

/** Masked input with show/hide toggle and the 5-segment strength meter. */
export default function PasswordField({
  label,
  value,
  onChange,
  placeholder = "Enter a password",
  showMeter = true,
  autoComplete = "new-password",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const strength = passwordStrength(value);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-cap font-medium text-ink-dim">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-line bg-raise pl-3 pr-10 text-body text-ink placeholder:text-ink-faint focus:border-line-bright"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-0 top-0 grid h-9 w-9 place-items-center text-ink-faint transition-colors duration-150 hover:text-ink-dim"
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {showMeter && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-150 ${
                  value && i <= strength.score
                    ? SEGMENT_COLORS[strength.score]
                    : "bg-line"
                }`}
              />
            ))}
          </div>
          <span className="w-16 text-right text-cap text-ink-faint">
            {value ? strength.label : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
