import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile?: { name?: string };
        wa_id?: string;
        user_id?: string;
      }>;
      messages?: Array<{
        id: string;
        from: string;
        user_id?: string;
        from_user_id?: string;
        type: string;
        timestamp: string;
        text?: { body?: string };
        image?: { id?: string; mime_type?: string; caption?: string };
        audio?: { id?: string; mime_type?: string };
        video?: { id?: string; mime_type?: string; caption?: string };
        document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
        sticker?: { id?: string; mime_type?: string };
        location?: { latitude?: number; longitude?: number; name?: string };
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id?: string;
        recipient_user_id?: string;
        user_id?: string;
        errors?: Array<{
          code: number;
          title: string;
          message?: string;
        }>;
        conversation?: {
          id: string;
          origin?: { type: string };
          expiration_timestamp?: string;
        };
        pricing?: {
          billable: boolean;
          pricing_model: string;
          category: string;
        };
      }>;
    };
    field: string;
  }>;
}

interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

function normalizeMetaStatus(status: string): string {
  const statusMap: Record<string, string> = {
    accepted: "accepted",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
  };
  return statusMap[status.toLowerCase()] || status.toLowerCase();
}

function formatErrors(errors: Array<{ code: number; title: string; message?: string }>): string {
  return errors.map(e => `[${e.code}] ${e.title}${e.message ? ': ' + e.message : ''}`).join(' | ');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET — Webhook verification with token validation
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const hubToken = url.searchParams.get("hub.verify_token");
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && challenge && hubToken && hubToken === verifyToken) {
      console.log("[WEBHOOK] Verification request accepted");
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    console.warn("[WEBHOOK] Verification rejected - invalid or missing token");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: MetaWebhookPayload = await req.json();
    console.log("[WEBHOOK] Received:", JSON.stringify(payload).substring(0, 500));

    // Save raw payload
    const { data: rawLog } = await supabase
      .from("webhook_raw_logs")
      .insert({ payload, source: "meta" })
      .select("id")
      .single();

    const rawLogId = rawLog?.id;

    if (payload.object !== "whatsapp_business_account") {
      console.log("[WEBHOOK] Ignoring non-WhatsApp payload:", payload.object);
      return new Response(
        JSON.stringify({ success: true, message: "Not a WhatsApp event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalUpdated = 0;
    let totalBsuidsCapured = 0;
    let totalStatuses = 0;
    let totalErrors = 0;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;

        const statuses = change.value.statuses || [];
        totalStatuses += statuses.length;

        const contacts = change.value.contacts || [];
        const contactBsuid = contacts.length > 0 ? contacts[0].user_id : null;
        const contactWaId = contacts.length > 0 ? contacts[0].wa_id : null;

        // BSUID diagnostics
        console.log(`[WEBHOOK][BSUID-DIAG] contacts=${JSON.stringify(contacts)} | statuses_count=${(change.value.statuses||[]).length} | messages_count=${(change.value.messages||[]).length}`);

        for (const status of statuses) {
          const messageId = status.id;
          const normalizedStatus = normalizeMetaStatus(status.status);
          const recipientPhone = status.recipient_id || contactWaId;
          const bsuid = status.user_id || status.recipient_user_id || contactBsuid;
          const hasErrors = status.errors && status.errors.length > 0;
          const errorText = hasErrors ? formatErrors(status.errors!) : null;

          console.log(`[WEBHOOK] Status: ${status.status} -> ${normalizedStatus} | msgId: ${messageId} | phone: ${recipientPhone} | bsuid: ${bsuid || "none"}${hasErrors ? ' | ERRORS: ' + errorText : ''}`);

          // Build update for notifications_sent
          const now = new Date().toISOString();
          const updateData: Record<string, unknown> = {
            zpro_status: normalizedStatus,
          };

          // Backfill: always set current + all earlier timestamps
          if (normalizedStatus === "accepted") {
            updateData.accepted_at = now;
          } else if (normalizedStatus === "sent") {
            updateData.accepted_at = now;
          } else if (normalizedStatus === "delivered") {
            updateData.accepted_at = now;
            updateData.delivered_at = now;
          } else if (normalizedStatus === "read") {
            updateData.accepted_at = now;
            updateData.delivered_at = now;
            updateData.read_at = now;
          }

          const { data, error } = await supabase
            .from("notifications_sent")
            .update(updateData)
            .eq("zpro_message_id", messageId)
            .select("id");

          if (error) {
            console.error(`[WEBHOOK] Error updating notification:`, error);
          } else {
            totalUpdated += data?.length || 0;
          }

          // Build update for whatsapp_notification_logs
          const logUpdate: Record<string, unknown> = { status: normalizedStatus };
          // Backfill: set current + all earlier timestamps to ensure consistency
          if (normalizedStatus === "accepted") {
            logUpdate.accepted_at = now;
          } else if (normalizedStatus === "sent") {
            logUpdate.accepted_at = now;
            logUpdate.sent_at = now;
          } else if (normalizedStatus === "delivered") {
            logUpdate.accepted_at = now;
            logUpdate.sent_at = now;
            logUpdate.delivered_at = now;
          } else if (normalizedStatus === "read") {
            logUpdate.accepted_at = now;
            logUpdate.sent_at = now;
            logUpdate.delivered_at = now;
            logUpdate.read_at = now;
          }

          if (errorText) {
            logUpdate.error_message = errorText;
            totalErrors++;
          }

          await supabase
            .from("whatsapp_notification_logs")
            .update(logUpdate)
            .eq("message_id", messageId);

          // Capture BSUID if present
          if (bsuid && recipientPhone) {
            const cleanPhone = recipientPhone.replace(/\D/g, "");
            const phoneVariants = [cleanPhone];
            if (cleanPhone.startsWith("55")) {
              phoneVariants.push(cleanPhone.substring(2));
            }

            for (const phoneVar of phoneVariants) {
              const { data: residents, error: findError } = await supabase
                .from("residents")
                .select("id, bsuid")
                .or(`phone.like.%${phoneVar}`)
                .is("bsuid", null)
                .limit(5);

              if (!findError && residents && residents.length > 0) {
                for (const resident of residents) {
                  const { error: updateError } = await supabase
                    .from("residents")
                    .update({ bsuid })
                    .eq("id", resident.id);

                  if (!updateError) {
                    totalBsuidsCapured++;
                    console.log(`[WEBHOOK] BSUID captured for resident ${resident.id}: ${bsuid}`);
                  }
                }
                break;
              }
            }
          }
        }

        // Also capture BSUID from incoming messages and save to whatsapp_messages
        const incomingMessages = change.value.messages || [];
        for (const msg of incomingMessages) {
          const msgBsuid = msg.user_id || contactBsuid;
          const msgPhone = msg.from || contactWaId;
          const contactName = contacts.length > 0 ? contacts[0].profile?.name : null;

          // Save incoming message to whatsapp_messages table
          if (msgPhone) {
            const cleanMsgPhone = msgPhone.replace(/\D/g, "");
            // Extract content and media info based on message type
            let messageContent = `[${msg.type}]`;
            let mediaId: string | null = null;
            let mediaMimeType: string | null = null;

            if (msg.type === "text" && msg.text?.body) {
              messageContent = msg.text.body;
            } else if (msg.type === "image" && msg.image) {
              messageContent = msg.image.caption || "[Imagem]";
              mediaId = msg.image.id || null;
              mediaMimeType = msg.image.mime_type || "image/jpeg";
            } else if (msg.type === "audio" && msg.audio) {
              messageContent = "[Áudio]";
              mediaId = msg.audio.id || null;
              mediaMimeType = msg.audio.mime_type || "audio/ogg";
            } else if (msg.type === "video" && msg.video) {
              messageContent = msg.video.caption || "[Vídeo]";
              mediaId = msg.video.id || null;
              mediaMimeType = msg.video.mime_type || "video/mp4";
            } else if (msg.type === "document" && msg.document) {
              messageContent = msg.document.filename || msg.document.caption || "[Documento]";
              mediaId = msg.document.id || null;
              mediaMimeType = msg.document.mime_type || "application/pdf";
            } else if (msg.type === "sticker" && msg.sticker) {
              messageContent = "[Sticker]";
              mediaId = msg.sticker.id || null;
              mediaMimeType = msg.sticker.mime_type || "image/webp";
            } else if (msg.type === "location" && msg.location) {
              messageContent = `📍 ${msg.location.name || ''} (${msg.location.latitude}, ${msg.location.longitude})`;
            }
            const windowExpires = new Date(parseInt(msg.timestamp) * 1000 + 24 * 60 * 60 * 1000).toISOString();

            // Try to find resident by phone
            let residentId: string | null = null;
            let condominiumId: string | null = null;
            const phoneVariantsMsg = [cleanMsgPhone];
            if (cleanMsgPhone.startsWith("55")) {
              phoneVariantsMsg.push(cleanMsgPhone.substring(2));
            }
            for (const pv of phoneVariantsMsg) {
              const { data: res } = await supabase
                .from("residents")
                .select("id, condominium_id")
                .or(`phone.like.%${pv}`)
                .limit(1)
                .single();
              if (res) {
                residentId = res.id;
                condominiumId = res.condominium_id;
                break;
              }
            }

            await supabase.from("whatsapp_messages").insert({
              direction: "inbound",
              from_phone: cleanMsgPhone,
              to_phone: change.value.metadata.phone_number_id,
              bsuid: msgBsuid || null,
              message_type: msg.type,
              content: messageContent,
              meta_message_id: msg.id,
              status: "received",
              resident_id: residentId,
              condominium_id: condominiumId,
              conversation_window_expires_at: windowExpires,
              resident_name: contactName || null,
              media_id: mediaId,
              media_mime_type: mediaMimeType,
            });

            console.log(`[WEBHOOK] Incoming message saved: ${msg.type} from ${cleanMsgPhone}`);
          }

          // Capture BSUID
          if (msgBsuid && msgPhone) {
            const cleanPhone = msgPhone.replace(/\D/g, "");
            const phoneVariants = [cleanPhone];
            if (cleanPhone.startsWith("55")) {
              phoneVariants.push(cleanPhone.substring(2));
            }

            for (const phoneVar of phoneVariants) {
              const { data: residents, error: findError } = await supabase
                .from("residents")
                .select("id, bsuid")
                .or(`phone.like.%${phoneVar}`)
                .is("bsuid", null)
                .limit(5);

              if (!findError && residents && residents.length > 0) {
                for (const resident of residents) {
                  const { error: updateError } = await supabase
                    .from("residents")
                    .update({ bsuid: msgBsuid })
                    .eq("id", resident.id);

                  if (!updateError) {
                    totalBsuidsCapured++;
                    console.log(`[WEBHOOK] BSUID captured from incoming msg for resident ${resident.id}: ${msgBsuid}`);
                  }
                }
                break;
              }
            }
          }
        }
      }
    }

    // Update raw log with counters
    if (rawLogId) {
      await supabase
        .from("webhook_raw_logs")
        .update({
          statuses_count: totalStatuses,
          bsuids_captured: totalBsuidsCapured,
          notifications_updated: totalUpdated,
        })
        .eq("id", rawLogId);
    }

    console.log(`[WEBHOOK] Processing complete: ${totalUpdated} notifications updated, ${totalBsuidsCapured} BSUIDs captured, ${totalErrors} errors saved`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: totalUpdated,
        bsuids_captured: totalBsuidsCapured,
        errors_saved: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[WEBHOOK] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
