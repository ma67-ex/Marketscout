"use client";

// Location input with a type-ahead dropdown.
//
// As the user types, this debounces a call to /api/geocode/suggest and shows a
// short list of matching places that narrows as the query gets more specific.
// Picking one fills the input with a clean "City, State, Country" string so the
// analysis runs against the exact place the user meant. Fully keyboard-driven
// (up/down to move, Enter to pick, Esc to dismiss) and closes on outside click.

import { useEffect, useRef, useState } from "react";

export interface LocationSuggestion {
  label: string;
  value: string;
  lat: number;
  lng: number;
}

interface LocationAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

// Wait this long after the last keystroke before querying, so we make one
// request per pause in typing rather than one per character.
const DEBOUNCE_MS = 300;
const MIN_QUERY = 3;

export default function LocationAutocomplete({
  id,
  value,
  onChange,
  placeholder,
  className,
  required,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id ?? "location"}-listbox`;
  // When the value change came from picking a suggestion, don't immediately
  // re-query for the text we just inserted (it would reopen the dropdown).
  const skipNextFetch = useRef(false);

  // Debounced suggestion fetch, re-run whenever the typed value changes.
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode/suggest?q=${encodeURIComponent(q)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        const list: LocationSuggestion[] = Array.isArray(data?.suggestions)
          ? data.suggestions
          : [];
        setSuggestions(list);
        setOpen(list.length > 0);
        setActiveIndex(-1);
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  // Dismiss the dropdown when clicking anywhere outside it.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function select(s: LocationSuggestion) {
    skipNextFetch.current = true;
    onChange(s.value);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
        // Only intercept Enter when the user is actively on a suggestion;
        // otherwise let it submit the form as usual.
        if (activeIndex >= 0) {
          e.preventDefault();
          select(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
      />

      {loading && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border border-muted-foreground/40 border-t-foreground"
        />
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.value}-${i}`}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown (not click) so selection fires before the input blurs.
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm leading-snug ${
                i === activeIndex
                  ? "bg-primary/10 text-foreground"
                  : "text-card-foreground"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
