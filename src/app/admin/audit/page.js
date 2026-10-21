import { adminSession } from "@/components/admin/guard";
import { fmtDate, Table, Td } from "@/components/admin/ui";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { listAudit } from "@/lib/audit";

export default async function AdminAudit() {
  if (!(await adminSession())) return null;
  const entries = await listAudit({ limit: 200 });

  return (
    <>
      <PageHeader title="Audit log" description="Admin and account changes, newest first (latest 200)." />
      <div className="p-4 sm:p-6">
        <Card>
          <Table head={["Time", "Who", "Action", "Target", "Details"]} empty={entries.length ? null : "Nothing recorded yet"}>
            {entries.map((e, i) => (
              <tr key={`${e.ts}-${i}`} className="align-top">
                <Td className="text-slate-500">{fmtDate(e.ts, { time: true })}</Td>
                <Td>{e.actor_email || "system"}</Td>
                <Td mono className="font-semibold text-slate-800">
                  {e.action}
                </Td>
                <Td mono className="text-slate-600">
                  {e.target || "—"}
                </Td>
                <Td mono wrap className="max-w-[360px] break-all text-slate-500">
                  {e.details ? JSON.stringify(e.details) : "—"}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
