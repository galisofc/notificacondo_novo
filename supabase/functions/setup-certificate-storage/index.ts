import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Verificando/Criando bucket 'certificates'...");

    // Tenta criar o bucket se não existir
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = buckets.some((b) => b.name === "certificates");

    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket("certificates", {
        public: false,
      });
      if (createError) throw createError;
      console.log("Bucket 'certificates' criado.");
    } else {
      console.log("Bucket 'certificates' já existe.");
    }

    // Como não podemos rodar SQL arbitrário facilmente sem a RPC, 
    // assumimos que as tabelas foram criadas via migrations/UI.
    // Esta função serve apenas para garantir o bucket.

    return new Response(
      JSON.stringify({ success: true, message: "Storage infrastructure checked/created" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error infrastructure check:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
