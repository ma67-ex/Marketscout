"use client";

// Field-of-study picker: a dropdown of common fields plus an "Other…" escape
// hatch that reveals a free-text box, so users can pick fast but still enter
// anything not on the list.

import { useState } from "react";

export const FIELDS_OF_STUDY = [
  "Computer Science",
  "Data Science",
  "Engineering",
  "Business & Management",
  "Marketing",
  "Finance & Accounting",
  "Nursing & Healthcare",
  "Nutrition & Dietetics",
  "Psychology",
  "Education",
  "Graphic & Web Design",
  "Culinary Arts",
  "Architecture",
  "Law",
  "Communications",
  "Environmental Science",
  "Fine Arts",
  "Music",
  "Construction & Trades",
  "Agriculture",
] as const;

const OTHER = "__other__";

interface FieldOfStudySelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

export default function FieldOfStudySelect({
  id,
  value,
  onChange,
  className,
  required,
}: FieldOfStudySelectProps) {
  const known = (FIELDS_OF_STUDY as readonly string[]).includes(value);
  // Once the user is in "Other" mode we stay there even while the text box is
  // empty, so it doesn't snap back to the dropdown mid-typing.
  const [other, setOther] = useState(!known && value.length > 0);

  const selectValue = other ? OTHER : known ? value : "";

  return (
    <div className="space-y-2">
      <select
        id={id}
        className={className}
        value={selectValue}
        required={required}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(v);
          }
        }}
      >
        <option value="" disabled>
          Select your field…
        </option>
        {FIELDS_OF_STUDY.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>

      {other && (
        <input
          className={className}
          placeholder="Type your field of study"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus
        />
      )}
    </div>
  );
}
