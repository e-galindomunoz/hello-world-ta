import { getPublishedImageUrl } from "@/lib/supabase/feed-images";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPublishedImageUrl(id);
  const headers = { "Cache-Control": "no-store" };
  if (result.status !== 200) {
    return new Response(result.status === 404 ? "Image not found." : "Image unavailable.", {
      status: result.status,
      headers,
    });
  }
  return new Response(null, { status: 307, headers: { ...headers, Location: result.url } });
}
