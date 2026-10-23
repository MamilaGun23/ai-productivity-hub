import { notFound } from "next/navigation";
import { featureSchema } from "@/lib/contracts";
import { ToolWorkspace } from "@/components/tool-workspace";
export function generateStaticParams() {
  return featureSchema.options.map((tool) => ({ tool }));
}
export default async function ToolPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const result = featureSchema.safeParse(tool);
  if (!result.success) notFound();
  return <ToolWorkspace key={result.data} feature={result.data} />;
}
