"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

// Search-as-you-type input backed by /api/v1/autocomplete.
export default function PlaceInput({ api, value, onSelect, onClear, placeholder, getBias, autoFocus, marker }) {
  const [text, setText] = useState(value?.label || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    setText(value?.label || "");
  }, [value?.label]);

  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2 || q === value?.label) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const bias = getBias?.() || {};
        const data = await api("/api/v1/autocomplete", { params: { q, limit: 7, ...bias } });
        if (id === seq.current) {
          setResults(data.results);
          setActive(0);
        }
      } catch {
        if (id === seq.current) setResults([]);
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [text, open, api, getBias, value?.label]);

  function choose(result) {
    setOpen(false);
    setResults([]);
    setText(result.label);
    onSelect(result);
  }

  function onKeyDown(e) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
        {marker || <Icon name="search" className="shrink-0 text-[var(--muted)]" />}
        <input
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="h-11 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
          aria-label={placeholder}
        />
        {busy && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />}
        {text && !busy && (
          <button
            type="button"
            onClick={() => {
              setText("");
              setResults([]);
              onClear?.();
            }}
            className="shrink-0 rounded-md p-1 text-[var(--muted)] hover:bg-[var(--hover)]"
            aria-label="Clear"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="relative z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 shadow-xl">
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-3 px-3 py-2 text-left ${i === active ? "bg-[var(--hover)]" : ""}`}
              >
                <Icon
                  name={r.source === "digipin" ? "target" : r.source === "india_post" ? "mail" : "pin"}
                  size={16}
                  className={`mt-0.5 shrink-0 ${r.source === "org" ? "text-amber-500" : r.source === "india_post" ? "text-violet-600" : "text-teal-600"}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {r.source === "org" ? `Saved place · MapPIN ${r.mappin}` : r.label}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
