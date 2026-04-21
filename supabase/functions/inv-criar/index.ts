// Edge Function autenticada: criar inventário com senha hash
// POST { nome, senha } com Authorization: Bearer <user_jwt>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u?.user) return json({ error: "Sessão inválida" }, 401);

    const { nome, senha } = await req.json();
    if (!nome || typeof nome !== "string" || nome.trim().length < 1 || nome.length > 200)
      return json({ error: "Nome inválido" }, 400);
    if (!senha || typeof senha !== "string" || senha.length < 4 || senha.length > 100)
      return json({ error: "Senha deve ter entre 4 e 100 caracteres" }, 400);

    const senha_hash = await bcrypt.hash(senha, 10);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin
      .from("inventarios")
      .insert({ nome: nome.trim(), criador_id: u.user.id, senha_hash })
      .select("id, nome, status, created_at")
      .single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, inventario: data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
