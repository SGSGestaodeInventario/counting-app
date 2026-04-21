import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, FileSpreadsheet, Trash2, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { parseExcel } from "@/lib/excel";
import { ConciliacaoGrid, type ItemRow } from "@/components/ConciliacaoGrid";
import { fmtNum } from "@/lib/format";

interface Inventario {
  id: string;
  nome: string;
  status: "em_andamento" | "concluido";
  created_at: string;
}

interface ItemDB {
  id: string;
  material: string;
  descricao: string | null;
  centro: string | null;
  deposito: string | null;
  lote: string | null;
  posicao: string | null;
  estoque_especial: string | null;
  num_estoque_especial: string | null;
  em_qualidade: number;
  transito_te: number;
  bloqueado: number;
  utilizacao_livre: number;
  total_sap: number;
}

export const Route = createFileRoute("/inventario/$id")({ component: InvDetalhe });

function InvDetalhe() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [inv, setInv] = useState<Inventario | null>(null);
  const [itens, setItens] = useState<ItemDB[]>([]);
  const [contagens, setContagens] = useState<{ item_id: string; nome_contador: string; quantidade: number; updated_at: string }[]>([]);
  const [busy, setBusy] = useState(true);
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState("conciliacao");

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const refresh = useCallback(async () => {
    setBusy(true);
    const [{ data: invData, error: e1 }, { data: itensData, error: e2 }, { data: contData, error: e3 }] = await Promise.all([
      supabase.from("inventarios").select("id, nome, status, created_at").eq("id", id).maybeSingle(),
      supabase.from("itens").select("id, material, descricao, centro, deposito, lote, posicao, estoque_especial, num_estoque_especial, em_qualidade, transito_te, bloqueado, utilizacao_livre, total_sap").eq("inventario_id", id).order("material"),
      supabase.from("contagens").select("item_id, nome_contador, quantidade, updated_at").eq("inventario_id", id),
    ]);
    if (e1 || !invData) { toast.error("Inventário não encontrado"); nav({ to: "/dashboard" }); return; }
    if (e2) toast.error("Erro ao carregar itens", { description: e2.message });
    if (e3) toast.error("Erro ao carregar contagens", { description: e3.message });
    setInv(invData as Inventario);
    setItens((itensData ?? []).map((r) => ({ ...r, em_qualidade: Number(r.em_qualidade), transito_te: Number(r.transito_te), bloqueado: Number(r.bloqueado), utilizacao_livre: Number(r.utilizacao_livre), total_sap: Number(r.total_sap) })));
    setContagens((contData ?? []).map((c) => ({ ...c, quantidade: Number(c.quantidade) })));
    setBusy(false);
  }, [id, nav]);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  // Combina itens + contagens
  const rows: ItemRow[] = useMemo(() => {
    const somaPorItem = new Map<string, number>();
    for (const c of contagens) somaPorItem.set(c.item_id, (somaPorItem.get(c.item_id) ?? 0) + c.quantidade);
    return itens.map((it) => {
      const soma = somaPorItem.get(it.id);
      const contado = soma !== undefined;
      const contagem = soma ?? 0;
      return { ...it, contagem, contado, diferenca: contagem - it.total_sap };
    });
  }, [itens, contagens]);

  const stats = useMemo(() => {
    const total = rows.length;
    const contados = rows.filter((r) => r.contado).length;
    const ok = rows.filter((r) => r.contado && Math.abs(r.diferenca) < 0.0001).length;
    const div = rows.filter((r) => r.contado && Math.abs(r.diferenca) >= 0.0001).length;
    const acc = total > 0 ? (ok / total) * 100 : 0;
    return { total, contados, ok, div, acc };
  }, [rows]);

  const handleImport = async (file: File) => {
    if (!inv) return;
    setImporting(true);
    try {
      const parsed = await parseExcel(file);
      if (parsed.length === 0) {
        toast.error("Nenhuma linha válida encontrada no Excel.");
        return;
      }
      // Apaga itens existentes (re-import)
      if (itens.length > 0) {
        if (!confirm(`Esta importação substituirá os ${itens.length} itens já existentes. Continuar?`)) {
          return;
        }
        const { error: delErr } = await supabase.from("itens").delete().eq("inventario_id", inv.id);
        if (delErr) throw delErr;
      }
      // Insere em lotes de 500
      const batch = 500;
      for (let i = 0; i < parsed.length; i += batch) {
        const chunk = parsed.slice(i, i + batch).map((r) => ({ ...r, inventario_id: inv.id }));
        const { error } = await supabase.from("itens").insert(chunk);
        if (error) throw error;
      }
      toast.success(`Importação concluída: ${parsed.length} itens.`);
      await refresh();
      setTab("conciliacao");
    } catch (e) {
      toast.error("Falha na importação", { description: (e as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const concluir = async () => {
    if (!inv) return;
    const novo = inv.status === "em_andamento" ? "concluido" : "em_andamento";
    const { error } = await supabase.from("inventarios").update({ status: novo }).eq("id", inv.id);
    if (error) { toast.error(error.message); return; }
    toast.success(novo === "concluido" ? "Inventário concluído" : "Reaberto");
    await refresh();
  };

  if (loading || !user) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (busy && !inv) return <div className="p-8 text-muted-foreground">Carregando inventário…</div>;
  if (!inv) return null;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{inv.nome}</h1>
            {inv.status === "em_andamento"
              ? <Badge variant="secondary">Em andamento</Badge>
              : <Badge className="bg-success text-success-foreground">Concluído</Badge>}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(inv.id); toast.success("ID copiado"); }}
            className="font-mono text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
          >
            ID: {inv.id} <Copy className="h-3 w-3" />
          </button>
        </div>
        <Button variant={inv.status === "em_andamento" ? "default" : "outline"} onClick={concluir}>
          <CheckCircle2 className="h-4 w-4 mr-1" />
          {inv.status === "em_andamento" ? "Marcar como concluído" : "Reabrir inventário"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Mini label="Itens" value={stats.total} />
        <Mini label="Contados" value={stats.contados} />
        <Mini label="OK" value={stats.ok} cls="text-success" />
        <Mini label="Divergentes" value={stats.div} cls="text-destructive" />
        <Mini label="Acuracidade" value={`${stats.acc.toFixed(1)}%`} cls="text-primary" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          <TabsTrigger value="importar">Importar base Excel</TabsTrigger>
        </TabsList>
        <TabsContent value="conciliacao" className="mt-4">
          {itens.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground mb-4">Nenhum item importado ainda.</p>
                <Button onClick={() => setTab("importar")}>Importar Excel</Button>
              </CardContent>
            </Card>
          ) : (
            <ConciliacaoGrid rows={rows} inventarioId={inv.id} inventarioNome={inv.nome} contagens={contagens} onChange={refresh} />
          )}
        </TabsContent>
        <TabsContent value="importar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar planilha SAP</CardTitle>
              <CardDescription>
                Colunas esperadas: Material, Texto breve material, Centro, Depósito, Em contr.qualidade, Trânsito e TE, Bloqueado, Utilização livre, Unid.medida básica, Lote, Tipo de material, Estoque especial, Nº estoque especial, Posição.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/30 transition">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm font-medium">{importing ? "Importando…" : "Clique para selecionar arquivo .xlsx"}</span>
                <span className="text-xs text-muted-foreground mt-1">Importação substitui a base atual.</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
                />
              </label>
              {itens.length > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  Atualmente: <strong>{itens.length}</strong> itens importados.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Mini({ label, value, cls = "" }: { label: string; value: number | string; cls?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold tabular-nums ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
