import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, getMetaConfig, isMetaConfigured, buildParamsArray } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendChecklistWhatsApp(
  supabase: any,
  booking: any,
  templateInfo: any,
  appBaseUrl: string,
) {
  if (!booking.resident_id) return { sent: false };

  const { data: resident } = await supabase
    .from('residents')
    .select('full_name, phone, bsuid')
    .eq('id', booking.resident_id)
    .single();

  if (!resident?.phone) return { sent: false };

  const { data: condo } = await supabase
    .from('condominiums')
    .select('name')
    .eq('id', booking.condominium_id)
    .single();

  const { data: hallSetting } = await supabase
    .from('party_hall_settings')
    .select('space_name')
    .eq('id', booking.party_hall_setting_id)
    .single();

  const checklistToken = booking.checklist_token;
  const checklistLink = `${appBaseUrl}/checklist-entrada/${checklistToken}`;
  const spaceName = hallSetting?.space_name || 'Salão de Festas';
  const residentName = resident.name || 'Morador';

  const paramsOrder = templateInfo.params_order || [];
  const variables: Record<string, string> = {
    nome: residentName,
    espaco: spaceName,
    data: booking.booking_date,
    link_checklist: checklistLink,
    condominio: condo?.name || '',
  };

  const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, paramsOrder);

  const metaResult = await sendMetaTemplate({
    phone: resident.phone,
    bsuid: resident.bsuid || undefined,
    templateName: templateInfo.waba_template_name,
    language: templateInfo.waba_language || 'pt_BR',
    bodyParams,
    bodyParamNames,
  });

  // Log notification
  await supabase.from('whatsapp_notification_logs').insert({
    resident_id: booking.resident_id,
    condominium_id: booking.condominium_id,
    phone: resident.phone,
    template_name: templateInfo.waba_template_name,
    status: metaResult.success ? 'sent' : 'failed',
    message_id: metaResult.messageId || null,
    error_message: metaResult.error || null,
    provider: 'waba',
  });

  if (metaResult.success) {
    console.log(`WhatsApp checklist sent to ${resident.phone} for booking ${booking.id}`);
  } else {
    console.error(`WhatsApp error for booking ${booking.id}:`, metaResult.error);
  }

  return { sent: metaResult.success };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const logId = crypto.randomUUID();
  const startTime = new Date();

  try {
    // Parse body to check for manual mode (single booking)
    let manualBookingId: string | null = null;
    try {
      const body = await req.json();
      manualBookingId = body?.bookingId || null;
    } catch {
      // No body = cron mode
    }

    const triggerType = manualBookingId ? 'manual' : 'scheduled';

    // Log start
    await supabase.from('edge_function_logs').insert({
      id: logId,
      function_name: 'start-party-hall-usage',
      status: 'running',
      trigger_type: triggerType,
      started_at: startTime.toISOString(),
    });

    // Check if function is paused (only for cron mode)
    if (!manualBookingId) {
      const { data: pauseStatus } = await supabase
        .from('cron_job_controls')
        .select('paused')
        .eq('function_name', 'start-party-hall-usage')
        .single();

      if (pauseStatus?.paused) {
        console.log('Function is paused, skipping execution');
        await supabase.from('edge_function_logs').update({
          status: 'skipped',
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime.getTime(),
          result: { message: 'Function is paused' },
        }).eq('id', logId);

        return new Response(
          JSON.stringify({ success: true, message: 'Function is paused' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get app base URL
    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_url')
      .maybeSingle();
    const appBaseUrl = (appSettings?.value as string) || 'https://notificacondo.com.br';

    // Check WhatsApp config and template
    const whatsappConfigured = isMetaConfigured();
    let templateInfo: any = null;
    if (whatsappConfigured) {
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('id, waba_template_name, params_order, waba_language')
        .eq('slug', 'party_hall_checklist_entrada')
        .eq('is_active', true)
        .maybeSingle();
      templateInfo = template;
    }

    // ─── MANUAL MODE: single booking ───
    if (manualBookingId) {
      console.log(`Manual mode: processing booking ${manualBookingId}`);

      const { data: booking, error: bookingError } = await supabase
        .from('party_hall_bookings')
        .select('id, booking_date, start_time, end_time, resident_id, condominium_id, party_hall_setting_id, checklist_token')
        .eq('id', manualBookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error(`Booking not found: ${manualBookingId}`);
      }

      let whatsappSent = false;
      if (whatsappConfigured && templateInfo) {
        try {
          const result = await sendChecklistWhatsApp(supabase, booking, templateInfo, appBaseUrl);
          whatsappSent = result.sent;
        } catch (e) {
          console.error('WhatsApp error:', e);
        }
      }

      await supabase.from('edge_function_logs').update({
        status: 'success',
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime.getTime(),
        result: { mode: 'manual', bookingId: manualBookingId, whatsappSent },
      }).eq('id', logId);

      return new Response(
        JSON.stringify({ success: true, mode: 'manual', bookingId: manualBookingId, whatsappSent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CRON MODE: process all confirmed bookings ───
    const now = new Date();
    const saoPauloDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const today = saoPauloDate.toISOString().split('T')[0];

    console.log(`Cron mode: looking for confirmed bookings for ${today} or earlier`);

    const { data: bookings, error: bookingsError } = await supabase
      .from('party_hall_bookings')
      .select('id, booking_date, start_time, end_time, resident_id, condominium_id, party_hall_setting_id')
      .lte('booking_date', today)
      .eq('status', 'confirmed');

    if (bookingsError) throw new Error(`Error fetching bookings: ${bookingsError.message}`);

    if (!bookings || bookings.length === 0) {
      await supabase.from('edge_function_logs').update({
        status: 'success',
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime.getTime(),
        result: { message: 'No confirmed bookings found', date: today, bookingsProcessed: 0 },
      }).eq('id', logId);

      return new Response(
        JSON.stringify({ success: true, message: 'No confirmed bookings found', date: today, bookingsProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${bookings.length} confirmed bookings`);

    let successCount = 0;
    let errorCount = 0;
    let whatsappSent = 0;
    let whatsappErrors = 0;
    const results: Array<{ bookingId: string; success: boolean; error?: string; whatsappSent?: boolean }> = [];

    for (const booking of bookings) {
      try {
        const checklistToken = crypto.randomUUID();
        const { error: updateError } = await supabase
          .from('party_hall_bookings')
          .update({ status: 'in_use', checklist_token: checklistToken })
          .eq('id', booking.id);

        if (updateError) throw updateError;

        console.log(`Booking ${booking.id} updated to 'in_use'`);
        successCount++;

        // Send WhatsApp
        let whatsappResult = false;
        if (whatsappConfigured && templateInfo) {
          try {
            const bookingWithToken = { ...booking, checklist_token: checklistToken };
            const result = await sendChecklistWhatsApp(supabase, bookingWithToken, templateInfo, appBaseUrl);
            whatsappResult = result.sent;
            if (result.sent) whatsappSent++;
            else whatsappErrors++;
          } catch {
            whatsappErrors++;
          }
        }

        results.push({ bookingId: booking.id, success: true, whatsappSent: whatsappResult });
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error);
        errorCount++;
        results.push({ bookingId: booking.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    const duration = Date.now() - startTime.getTime();
    await supabase.from('edge_function_logs').update({
      status: errorCount > 0 ? 'partial' : 'success',
      ended_at: new Date().toISOString(),
      duration_ms: duration,
      result: { date: today, totalBookings: bookings.length, successCount, errorCount, whatsappSent, whatsappErrors, results },
    }).eq('id', logId);

    return new Response(
      JSON.stringify({ success: true, date: today, totalBookings: bookings.length, successCount, errorCount, whatsappSent, whatsappErrors, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in start-party-hall-usage:', error);

    await supabase.from('edge_function_logs').update({
      status: 'error',
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime.getTime(),
      error_message: error instanceof Error ? error.message : 'Unknown error',
    }).eq('id', logId);

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
