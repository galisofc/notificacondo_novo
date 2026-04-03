import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, getMetaConfig, isMetaConfigured, buildParamsArray } from "../_shared/meta-whatsapp.ts";

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

  const logId = crypto.randomUUID();
  const startTime = new Date();

  try {
    // Log start
    await supabase.from('edge_function_logs').insert({
      id: logId,
      function_name: 'start-party-hall-usage',
      status: 'running',
      trigger_type: 'scheduled',
      started_at: startTime.toISOString(),
    });

    // Check if function is paused
    const { data: pauseStatus } = await supabase
      .from('cron_job_controls')
      .select('paused')
      .eq('function_name', 'start-party-hall-usage')
      .single();

    if (pauseStatus?.paused) {
      console.log('Function is paused, skipping execution');
      
      await supabase
        .from('edge_function_logs')
        .update({
          status: 'skipped',
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime.getTime(),
          result: { message: 'Function is paused' },
        })
        .eq('id', logId);

      return new Response(
        JSON.stringify({ success: true, message: 'Function is paused' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's date in São Paulo timezone
    const now = new Date();
    const saoPauloDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const today = saoPauloDate.toISOString().split('T')[0];

    console.log(`Looking for confirmed bookings for today or earlier: ${today}`);

    // Find all confirmed bookings for today or past days (handles missed cron runs)
    const { data: bookings, error: bookingsError } = await supabase
      .from('party_hall_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        resident_id,
        condominium_id,
        party_hall_setting_id
      `)
      .lte('booking_date', today)
      .eq('status', 'confirmed');

    if (bookingsError) {
      throw new Error(`Error fetching bookings: ${bookingsError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      console.log('No confirmed bookings found for today');
      
      await supabase
        .from('edge_function_logs')
        .update({
          status: 'success',
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime.getTime(),
          result: { 
            message: 'No confirmed bookings found for today',
            date: today,
            bookingsProcessed: 0
          },
        })
        .eq('id', logId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No confirmed bookings found for today',
          date: today,
          bookingsProcessed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${bookings.length} confirmed bookings for today`);

    // Get app base URL
    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_url')
      .maybeSingle();

    const appBaseUrl = (appSettings?.value as string) || 'https://notificacondo.com.br';

    // Check if WhatsApp is configured
    const whatsappConfigured = isMetaConfigured();

    // Get WhatsApp template info if configured
    let templateInfo: any = null;
    if (whatsappConfigured) {
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('id, waba_template_name, params_order, waba_language')
        .eq('slug', 'party_hall_checklist_entrada')
        .eq('is_active', true)
        .maybeSingle();
      
      templateInfo = template;
      if (!templateInfo) {
        console.log('Template party_hall_checklist_entrada not found or inactive, will skip WhatsApp notification');
      } else {
        console.log(`Template found: ${templateInfo.waba_template_name}, params: ${templateInfo.params_order}`);
      }
    }

    let successCount = 0;
    let errorCount = 0;
    let whatsappSent = 0;
    let whatsappErrors = 0;
    const results: Array<{ bookingId: string; success: boolean; error?: string; whatsappSent?: boolean }> = [];

    // Update each booking to 'in_use' status
    for (const booking of bookings) {
      try {
        // Generate checklist token
        const checklistToken = crypto.randomUUID();

        const { error: updateError } = await supabase
          .from('party_hall_bookings')
          .update({ status: 'in_use', checklist_token: checklistToken })
          .eq('id', booking.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`Booking ${booking.id} status updated to 'in_use' with token ${checklistToken}`);
        successCount++;

        // Send WhatsApp notification with checklist link
        let whatsappResult = false;
        if (whatsappConfigured && templateInfo && booking.resident_id) {
          try {
            // Get resident info
            const { data: resident } = await supabase
              .from('residents')
              .select('name, phone, bsuid')
              .eq('id', booking.resident_id)
              .single();

            if (resident?.phone) {
              // Get condominium name
              const { data: condo } = await supabase
                .from('condominiums')
                .select('name')
                .eq('id', booking.condominium_id)
                .single();

              // Get party hall setting name
              const { data: hallSetting } = await supabase
                .from('party_hall_settings')
                .select('space_name')
                .eq('id', booking.party_hall_setting_id)
                .single();

              const checklistLink = `${appBaseUrl}/checklist-entrada/${checklistToken}`;
              const spaceName = hallSetting?.space_name || 'Salão de Festas';
              const residentName = resident.name || 'Morador';
              const bookingDate = booking.booking_date;

              // Parse params_order from template
              const paramsOrder = templateInfo.params_order || [];
              
              const variables: Record<string, string> = {
                nome: residentName,
                espaco: spaceName,
                data: bookingDate,
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

              if (metaResult.success) {
                whatsappSent++;
                whatsappResult = true;
                console.log(`WhatsApp checklist sent to ${resident.phone} for booking ${booking.id}`);

                // Log the notification
                await supabase.from('whatsapp_notification_logs').insert({
                  resident_id: booking.resident_id,
                  condominium_id: booking.condominium_id,
                  phone: resident.phone,
                  template_name: templateInfo.template_name,
                  status: 'sent',
                  message_id: metaResult.messageId,
                  provider: 'waba',
                });
              } else {
                whatsappErrors++;
                console.error(`WhatsApp error for booking ${booking.id}:`, metaResult.error);
                
                await supabase.from('whatsapp_notification_logs').insert({
                  resident_id: booking.resident_id,
                  condominium_id: booking.condominium_id,
                  phone: resident.phone,
                  template_name: templateInfo.template_name,
                  status: 'failed',
                  error_message: metaResult.error,
                  provider: 'waba',
                });
              }
            }
          } catch (whatsappError) {
            whatsappErrors++;
            console.error(`WhatsApp notification error for booking ${booking.id}:`, whatsappError);
          }
        }

        results.push({ bookingId: booking.id, success: true, whatsappSent: whatsappResult });
      } catch (error) {
        console.error(`Error updating booking ${booking.id}:`, error);
        errorCount++;
        results.push({ 
          bookingId: booking.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Update log with results
    await supabase
      .from('edge_function_logs')
      .update({
        status: errorCount > 0 ? 'partial' : 'success',
        ended_at: endTime.toISOString(),
        duration_ms: duration,
        result: {
          date: today,
          totalBookings: bookings.length,
          successCount,
          errorCount,
          whatsappSent,
          whatsappErrors,
          results,
        },
      })
      .eq('id', logId);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        totalBookings: bookings.length,
        successCount,
        errorCount,
        whatsappSent,
        whatsappErrors,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in start-party-hall-usage:', error);

    await supabase
      .from('edge_function_logs')
      .update({
        status: 'error',
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime.getTime(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', logId);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
