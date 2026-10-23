import { handleAI } from "@/lib/ai/handler";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ feature: string }> },
) {
  const { feature } = await context.params;
  return handleAI(request, feature);
}
