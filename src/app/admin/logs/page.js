import Link from "next/link";
import { adminSession } from "@/components/admin/guard";
import { fmtDate, fmtNum, Pager, StatusCode, Table, Td } from "@/components/admin/ui";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { keyLabel, listLogs, orgLabel, orgOptions } from "@/lib/admin";
import { SKUS } from "@/lib/catalog";

const LIMIT = 50;
const STATUS = [
  ["", "Any status"],
  ["2xx", "2xx success"],
  ["errors", "All errors"],
  ["4xx", "4xx client"],
  ["5xx", "5xx server"],
];

export default async function AdminLogs({ searchParams }) {
  if (!(await adminSession())) return null;
  const sp = await searchParams;
  const filters = {
    status: STATUS.some(([v]) => v === sp.status) ? sp.status : "",
    org: sp.org || "",
    sku: SKUS[sp.sku] ? sp.sku : "",
    q: sp.q || "",
  };
  const offset = Math.max(0, Number(sp.offset) || 0);
  const [{ logs, hasMore }, orgs] = await Promise.all([listLogs({ ...filters, limit: LIMIT, offset }), orgOptions()]);
  const select = "h-9 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm";

  return (
    <>
      <PageHeader title="Request logs" description="Every /api/v1 request across all customers, newest first. Kept for 14 days." />
      <div className="p-4 sm:p-6">
        <Card>
          <form action="/admin/logs" className="flex flex-wrap items-center gap-2">
            <select name="status" defaultValue={filters.status} className={select}>
              {STATUS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select name="org" defaultValue={filters.org} className={`${select} max-w-[220px]`}>
              <option value="">Any organisation</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {orgLabel(o.id, o.name)}
                </option>
              ))}
            </select>
            <select name="sku" defaultValue={filters.sku} className={select}>
              <option value="">Any API</option>
              {Object.entries(SKUS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Path, error code or IP"
              className="h-9 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 sm:w-56"
            />
            <button className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700">Filter</button>
            {(filters.status || filters.org || filters.sku || filters.q) && (
              <Link href="/admin/logs" className="text-sm text-slate-500 hover:text-slate-900">
                Clear
              </Link>
            )}
          </form>
          <div className="mt-4" />
          <Table
            head={["Time", "Status", "Request", "Organisation", "Key", "Error", { label: "Latency", right: true }, "IP"]}
            empty={logs.length ? null : "No requests match these filters"}
          >
            {logs.map((r, i) => (
              <tr key={`${r.ts}-${i}`}>
                <Td className="text-slate-500">{fmtDate(r.ts, { time: true })}</Td>
                <Td>
                  <StatusCode status={r.status} />
                </Td>
                <Td mono>
                  {r.method} {r.path}
                </Td>
                <Td>
                  {r.org_id ? (
                    <Link href={r.org_id === "org_system" ? "/admin/logs?org=org_system" : `/admin/orgs/${r.org_id}`} className="hover:text-teal-700 hover:underline">
                      {orgLabel(r.org_id, r.org_name)}
                    </Link>
                  ) : (
                    <span className="text-slate-400">Unauthenticated</span>
                  )}
                </Td>
                <Td className="text-slate-600">{r.key_id ? keyLabel(r.key_id, r.key_name) : "—"}</Td>
                <Td mono className="text-slate-500">
                  {r.error_code || "—"}
                </Td>
                <Td right className="text-slate-600">
                  {fmtNum(r.latency_ms)} ms
                </Td>
                <Td mono className="text-slate-500">
                  {r.ip || "—"}
                </Td>
              </tr>
            ))}
          </Table>
          <Pager basePath="/admin/logs" params={filters} offset={offset} limit={LIMIT} hasMore={hasMore} />
        </Card>
      </div>
    </>
  );
}
