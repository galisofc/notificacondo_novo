import { supabase } from "@/integrations/supabase/client";

export async function ensureValidSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  try {
    await supabase.auth.refreshSession();
  } catch {
    // Ignore
  }
}

export function isJwtExpiredError(err: unknown) {
  const anyErr = err as any;
  return (
    anyErr?.status === 401 ||
    anyErr?.code === "PGRST303" ||
    String(anyErr?.message || "").toLowerCase().includes("jwt expired")
  );
}