// Edge Function pública: validar acesso ao inventário e retornar itens + contagens
// POST { action: "validar"|"listar"|"salvar", inventario_id, senha, nome_contador?, item_id?, quantidade? }
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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, inventario_id, senha } = body;

    if (!action || !inventario_id || typeof senha !== "string") {
      return json({ error: "Parâmetros inválidos" }, 400);
    }

    // Validar inventário + senha (sempre)
    const { data: inv, error: invErr } = await admin
      .from("inventarios")
      .select("id, nome, status, senha_hash")
      .eq("id", inventario_id)
      .maybeSingle();

    if (invErr || !inv) return json({ error: "Inventário não encontrado" }, 404);

    const ok = await bcrypt.compare(senha, inv.senha_hash);
    if (!ok) return json({ error: "Senha incorreta" }, 401);

    if (action === "validar") {
      return json({ ok: true, inventario: { id: inv.id, nome: inv.nome, status: inv.status } });
    }

    if (action === "listar") {
      const { data: itens, error: e1 } = await admin
        .from("itens")
        .select("*")
        .eq("inventario_id", inventario_id)
        .order("material");
      if (e1) return json({ error: e1.message }, 500);

      const { data: contagens, error: e2 } = await admin
        .from("contagens")
        .select("item_id, nome_contador, quantidade")
        .eq("inventario_id", inventario_id);
      if (e2) return json({ error: e2.message }, 500);

      return json({ ok: true, itens, contagens });
    }

    if (action === "criar_item") {
      const { nome_contador, item, quantidade } = body;
      if (!nome_contador || !item || typeof item !== "object" || typeof quantidade !== "number") {
        return json({ error: "Dados inválidos" }, 400);
      }
      const nome = String(nome_contador).trim();
      if (nome.length < 1 || nome.length > 100) return json({ error: "Nome inválido" }, 400);
      const material = String(item.material ?? "").trim();
      if (!material) return json({ error: "Material obrigatório" }, 400);

      const insertItem = {
        inventario_id,
        material,
        descricao: item.descricao ?? null,
        centro: item.centro ?? null,
        deposito: item.deposito ?? null,
        lote: item.lote ?? null,
        posicao: item.posicao ?? null,
        estoque_especial: item.estoque_especial ?? null,
        num_estoque_especial: item.num_estoque_especial ?? null,
        unid_medida: item.unid_medida ?? null,
        tipo_material: item.tipo_material ?? null,
        em_qualidade: 0,
        transito_te: 0,
        bloqueado: 0,
        utilizacao_livre: 0,
      };
      const { data: novoItem, error: ie } = await admin
        .from("itens")
        .insert(insertItem)
        .select("id")
        .single();
      if (ie || !novoItem) return json({ error: ie?.message ?? "Falha ao criar item" }, 500);

      const { error: ce } = await admin
        .from("contagens")
        .insert({ inventario_id, item_id: novoItem.id, nome_contador: nome, quantidade });
      if (ce) return json({ error: ce.message }, 500);

      return json({ ok: true, item_id: novoItem.id });
    }

    if (action === "salvar") {
      const { nome_contador, item_id, quantidade } = body;
      if (!nome_contador || !item_id || typeof quantidade !== "number") {
        return json({ error: "Dados de contagem inválidos" }, 400);
      }
      const nome = String(nome_contador).trim();
      if (nome.length < 1 || nome.length > 100) return json({ error: "Nome inválido" }, 400);

      const { error } = await admin
        .from("contagens")
        .upsert(
          { inventario_id, item_id, nome_contador: nome, quantidade },
          { onConflict: "item_id,nome_contador" },
        );
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
