"use client";

import { useEffect, useState } from "react";

export function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className={`rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white ${className}`}
      aria-label="Copy code"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Dark code block with a copy button. `title` shows a file/language label.
export function Code({ code, title, maxHeight }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-900/10">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] text-slate-400">{title || ""}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-auto p-4 text-[12.5px] leading-relaxed text-slate-100" style={maxHeight ? { maxHeight } : undefined}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Several samples of the same request; the chosen language is remembered per visitor.
export function CodeTabs({ tabs }) {
  const [active, setActive] = useState(tabs[0].id);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("naksha-docs-lang");
      if (tabs.some((t) => t.id === saved)) setActive(saved);
    } catch {}
  }, [tabs]);
  const tab = tabs.find((t) => t.id === active) || tabs[0];
  return (
    <div className="my-4 overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-900/10">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2">
        <div className="no-scrollbar flex overflow-x-auto" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => {
                setActive(t.id);
                try {
                  localStorage.setItem("naksha-docs-lang", t.id);
                } catch {}
              }}
              className={`shrink-0 border-b-2 px-3 py-2 text-xs font-medium ${
                t.id === tab.id ? "border-teal-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton text={tab.code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-slate-100">
        <code>{tab.code}</code>
      </pre>
    </div>
  );
}
