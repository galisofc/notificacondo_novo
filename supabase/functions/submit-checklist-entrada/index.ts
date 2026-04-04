import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { token, items, signer_name, signer_email, signature_image, general_observations } = body;

    // Validate required fields
    if (!token || !signer_name || !signer_email || !signature_image || !items) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: token, signer_name, signer_email, signature_image, items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token exists and booking is in_use
    const { data: booking, error: bookingError } = await supabase
      .from('party_hall_bookings')
      .select('id, condominium_id, checklist_token, status')
      .eq('checklist_token', token)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou reserva não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if checklist already submitted
    const { data: existingChecklist } = await supabase
      .from('party_hall_digital_checklists')
      .select('id')
      .eq('token', token)
      .maybeSingle();

    if (existingChecklist) {
      return new Response(
        JSON.stringify({ success: false, error: 'Checklist já foi preenchido para esta reserva' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert checklist
    const { error: insertError } = await supabase
      .from('party_hall_digital_checklists')
      .insert({
        booking_id: booking.id,
        condominium_id: booking.condominium_id,
        token,
        signer_name,
        signer_email,
        signer_ip: null,
        signer_geolocation: null,
        signature_image,
        items,
        general_observations: general_observations || null,
        signed_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error inserting checklist:', insertError);
      throw new Error(`Erro ao salvar checklist: ${insertError.message}`);
    }

    console.log(`Checklist submitted for booking ${booking.id} by ${signer_name}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Checklist assinado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-checklist-entrada:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
