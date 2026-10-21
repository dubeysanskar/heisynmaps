import Link from "next/link";
import { docsSequence } from "@/lib/docs/nav";

export default function PrevNext({ href }) {
  const seq = docsSequence();
  const i = seq.findIndex((s) => s.href === href);
  const prev = i > 0 ? seq[i - 1] : null;
  const next = i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
  return (
    <nav className="mt-16 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2" aria-label="Previous and next page">
      {prev ? (
        <Link href={prev.href} className="rounded-xl border border-slate-200 p-4 hover:border-teal-600">
          <span className="text-xs text-slate-500">Previous</span>
          <span className="mt-0.5 block font-medium text-slate-900">← {prev.label}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="rounded-xl border border-slate-200 p-4 text-right hover:border-teal-600">
          <span className="text-xs text-slate-500">Next</span>
          <span className="mt-0.5 block font-medium text-slate-900">{next.label} →</span>
        </Link>
      )}
    </nav>
  );
}
