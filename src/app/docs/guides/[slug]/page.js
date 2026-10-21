import { notFound } from "next/navigation";
import PrevNext from "@/components/docs/PrevNext";
import { guideBySlug } from "@/lib/docs/guides";
import { siteOrigin } from "@/lib/docs/origin";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  return guide ? { title: guide.title, description: guide.summary } : {};
}

export default async function GuidePage({ params }) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();
  const origin = await siteOrigin();
  const { Body } = guide;

  return (
    <article className="max-w-3xl">
      <p className="text-sm font-medium text-teal-700">{guide.section}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{guide.title}</h1>
      <p className="mt-3 text-lg text-slate-600">{guide.summary}</p>
      <div className="mt-6">
        <Body origin={origin} />
      </div>
      <PrevNext href={`/docs/guides/${guide.slug}`} />
    </article>
  );
}
