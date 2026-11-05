import { createFileRoute } from "@tanstack/react-router";
import { sniffImage } from "@/lib/image-validate";

// Streams a complaint photo from the private bucket. Direct storage reads are
// blocked by policy; this route only serves files that are attached to a
// complaint (photo, before or after proof), so public tracking keeps working
// while unattached or unrelated uploads stay private. Existing links keep the
// same URL shape.
export const Route = createFileRoute("/api/public/photo/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = decodeURIComponent((params as { _splat?: string })._splat ?? "");
        if (!path || path.includes("..") || path.length > 300 || !/^[\w\-./]+$/.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const suffix = `/api/public/photo/${path}`;
        const { data: refs } = await supabaseAdmin
          .from("complaints")
          .select("id")
          .or(`photo_url.like.*${suffix},before_photo_url.like.*${suffix},after_photo_url.like.*${suffix}`)
          .limit(1);
        if (!refs || refs.length === 0) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage.from("complaint-photos").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        // Serve only files whose real bytes are an allowed image; the type comes from the bytes.
        const bytes = new Uint8Array(await data.arrayBuffer());
        const safe = sniffImage(bytes.subarray(0, 16));
        if (!safe) return new Response("Not found", { status: 404 });
        const type = safe.mime;
        return new Response(bytes, {
          headers: {
            "content-type": type,
            "x-content-type-options": "nosniff",
            // Posters/PDF draw these with crossOrigin="anonymous" (needed on preview domains).
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
