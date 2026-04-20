import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TwilioRecording {
  sid: string;
  call_sid: string;
  duration: string;
  channels: number;
  status: string;
  date_created: string;
  uri: string;
}

interface TwilioListResponse {
  recordings: TwilioRecording[];
  next_page_uri: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check: require an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const agentId: string | undefined = body.agent_id;
    const maxPages: number = Math.min(Number(body.max_pages) || 10, 50);

    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    let url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings.json?PageSize=100`;

    let scanned = 0;
    let updated = 0;
    let alreadyHadRecording = 0;
    let unmatched = 0;
    const errors: string[] = [];

    for (let page = 0; page < maxPages && url; page++) {
      const twRes = await fetch(url, {
        headers: { Authorization: `Basic ${twilioAuth}` },
      });

      if (!twRes.ok) {
        const text = await twRes.text();
        errors.push(`Twilio API ${twRes.status}: ${text.slice(0, 200)}`);
        break;
      }

      const data: TwilioListResponse = await twRes.json();
      const recordings = data.recordings || [];

      for (const rec of recordings) {
        scanned++;
        if (rec.status !== "completed") continue;

        const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${rec.sid}.mp3`;
        const duration = parseInt(rec.duration, 10) || null;

        // Find matching call row by twilio_call_sid
        let q = supabase
          .from("calls")
          .select("id, recording_url, duration_seconds, agent_id")
          .eq("twilio_call_sid", rec.call_sid)
          .maybeSingle();

        const { data: callRow, error: findErr } = await q;
        if (findErr) {
          errors.push(`Find error for ${rec.call_sid}: ${findErr.message}`);
          continue;
        }
        if (!callRow) {
          unmatched++;
          continue;
        }

        // Optional agent scoping
        if (agentId && callRow.agent_id !== agentId) continue;

        if (callRow.recording_url) {
          alreadyHadRecording++;
          continue;
        }

        const updates: Record<string, unknown> = { recording_url: recordingUrl };
        if (!callRow.duration_seconds && duration) {
          updates.duration_seconds = duration;
        }

        const { error: upErr } = await supabase
          .from("calls")
          .update(updates)
          .eq("id", callRow.id);

        if (upErr) {
          errors.push(`Update ${callRow.id}: ${upErr.message}`);
        } else {
          updated++;
        }
      }

      if (data.next_page_uri) {
        url = `https://api.twilio.com${data.next_page_uri}`;
      } else {
        url = "";
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned,
        updated,
        already_had_recording: alreadyHadRecording,
        unmatched,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Backfill error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
