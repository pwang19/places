import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function hexToKeyBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, "");
  if (clean.length !== 64 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("PRIVATE_NOTES_KEY must be 64 hex characters");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64Encode(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

/** Match Node crypto layout: base64(iv || tag || ciphertext) */
async function encryptNote(plaintext: string, keyHex: string): Promise<string> {
  const rawKey = hexToKeyBytes(keyHex);
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encFull = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: AUTH_TAG_LENGTH * 8 },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const tag = encFull.slice(-AUTH_TAG_LENGTH);
  const ciphertext = encFull.slice(0, -AUTH_TAG_LENGTH);
  const combined = new Uint8Array(IV_LENGTH + AUTH_TAG_LENGTH + ciphertext.length);
  combined.set(iv, 0);
  combined.set(tag, IV_LENGTH);
  combined.set(ciphertext, IV_LENGTH + AUTH_TAG_LENGTH);
  return b64Encode(combined);
}

async function decryptNote(stored: string, keyHex: string): Promise<string> {
  const rawKey = hexToKeyBytes(keyHex);
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const buf = b64Decode(stored);
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted note payload");
  }
  const iv = buf.slice(0, IV_LENGTH);
  const tag = buf.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  const ctWithTag = new Uint8Array(ciphertext.length + tag.length);
  ctWithTag.set(ciphertext, 0);
  ctWithTag.set(tag, ciphertext.length);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: AUTH_TAG_LENGTH * 8 },
    key,
    ctWithTag,
  );
  return new TextDecoder().decode(plain);
}

Deno.serve(async (req: Request) => {
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const keyHex = Deno.env.get("PRIVATE_NOTES_KEY");
  if (!keyHex) {
    return new Response(
      JSON.stringify({ error: "PRIVATE_NOTES_KEY not configured" }),
      { status: 500, headers },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  const url = new URL(req.url);
  const placeIdParam = url.searchParams.get("place_id");

  try {
    if (req.method === "GET") {
      if (!placeIdParam) {
        return new Response(JSON.stringify({ error: "place_id required" }), {
          status: 400,
          headers,
        });
      }
      const placeId = Number(placeIdParam);
      if (!Number.isFinite(placeId)) {
        return new Response(JSON.stringify({ error: "invalid place_id" }), {
          status: 400,
          headers,
        });
      }

      const { data: row, error } = await supabase
        .from("place_private_notes")
        .select("note_ciphertext")
        .eq("place_id", placeId)
        .maybeSingle();

      if (error) throw error;
      if (!row?.note_ciphertext) {
        return new Response(JSON.stringify({ note: null }), { status: 200, headers });
      }
      const note = await decryptNote(row.note_ciphertext, keyHex);
      return new Response(JSON.stringify({ note }), { status: 200, headers });
    }

    if (req.method === "PUT") {
      const body = await req.json().catch(() => ({}));
      const placeId = Number(body.place_id ?? placeIdParam);
      const noteRaw = body.note != null ? String(body.note) : "";
      const trimmed = noteRaw.trim();

      if (!Number.isFinite(placeId)) {
        return new Response(JSON.stringify({ error: "place_id required" }), {
          status: 400,
          headers,
        });
      }

      if (!trimmed) {
        const { error: delErr } = await supabase
          .from("place_private_notes")
          .delete()
          .eq("place_id", placeId);
        if (delErr) throw delErr;
        return new Response(JSON.stringify({ note: null }), { status: 200, headers });
      }

      const ciphertext = await encryptNote(trimmed, keyHex);
      const { error: upErr } = await supabase.from("place_private_notes").upsert(
        {
          place_id: placeId,
          user_id: user.id,
          note_ciphertext: ciphertext,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "place_id,user_id" },
      );
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ note: trimmed }), { status: 200, headers });
    }

    if (req.method === "DELETE") {
      if (!placeIdParam) {
        return new Response(JSON.stringify({ error: "place_id required" }), {
          status: 400,
          headers,
        });
      }
      const placeId = Number(placeIdParam);
      if (!Number.isFinite(placeId)) {
        return new Response(JSON.stringify({ error: "invalid place_id" }), {
          status: 400,
          headers,
        });
      }
      const { error: delErr } = await supabase
        .from("place_private_notes")
        .delete()
        .eq("place_id", placeId);
      if (delErr) throw delErr;
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers,
    });
  }
});
