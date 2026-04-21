import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Boxes, CheckCircle2, Clock, Target, Copy } from "lucide-react";
import { toast } from "sonner";

interface InvSummary {
  id: string;
  nome: string;
  status: "em_andamento" | "concluido";
  created_at: string;
  total_itens: number;
  itens_contados: number;
  acuracidade: number;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [invs, setInvs] = useState<InvSummary[]>([]);
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // tick a cada 60s para atualizar countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setBusy(true);
      // 1. Purga inventários expirados (>7 dias) ANTES de listar
      try { await supabase.rpc("purgar_inventarios_expirados"); } catch { /* silencioso */ }

      const { data: list, error } = await supabase
        .from("inventarios").select("id, nome, status, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao listar inventários", { description: error.message });
        setBusy(false); return;
      }
      const summaries: InvSummary[] = [];
      for (const inv of list ?? []) {
        const { data: itens } = await supabase.from("itens").select("id, total_sap").eq("inventario_id", inv.id);
        const { data: contagens } = await supabase.from("contagens").select("item_id, quantidade").eq("inventario_id", inv.id);
        const total = itens?.length ?? 0;
        const somaPorItem = new Map<string, number>();
        for (const c of contagens ?? []) somaPorItem.set(c.item_id, (somaPorItem.get(c.item_id) ?? 0) + Number(c.quantidade));
        const itensContados = somaPorItem.size;
        let okCount = 0;
        for (const it of itens ?? []) {
          const soma = somaPorItem.get(it.id) ?? null;
          if (soma !== null && Math.abs(soma - Number(it.total_sap)) < 0.0001) okCount++;
        }
        const acuracidade = total > 0 ? (okCount / total) * 100 : 0;
        summaries.push({ id: inv.id, nome: inv.nome, status: inv.status, created_at: inv.created_at, total_itens: total, itens_contados: itensContados, acuracidade });
      }
      setInvs(summaries);
      setBusy(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const total = invs.length;
    const andamento = invs.filter((i) => i.status === "em_andamento").length;
    const concluidos = invs.filter((i) => i.status === "concluido").length;
    const acc = invs.length > 0 ? invs.reduce((a, b) => a + b.acuracidade, 0) / invs.length : 0;
    return { total, andamento, concluidos, acc };
  }, [invs]);

  if (loading || !user) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meus inventários</h1>
          <p className="text-sm text-muted-foreground">Crie, monitore e concilie processos de inventário. Inventários são apagados automaticamente após 7 dias da criação.</p>
        </div>
        <Button asChild>
          <Link to="/inventario/novo"><Plus className="h-4 w-4 mr-1" /> Novo inventário</Link>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard icon={<Boxes className="h-4 w-4" />} label="Inventários" value={String(stats.total)} />
        <StatCard icon={<Clock className="h-4 w-4 text-warning" />} label="Em andamento" value={String(stats.andamento)} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Concluídos" value={String(stats.concluidos)} />
        <StatCard icon={<Target className="h-4 w-4 text-primary" />} label="Acuracidade média" value={`${stats.acc.toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de inventários</CardTitle>
          <CardDescription>Clique para abrir e gerenciar. Compartilhe o ID com os contadores.</CardDescription>
        </CardHeader>
        <CardContent>
          {busy ? (
            <div className="text-muted-foreground py-8 text-center">Carregando…</div>
          ) : invs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Boxes className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum inventário ainda.</p>
              <Button asChild className="mt-4"><Link to="/inventario/novo">Criar o primeiro</Link></Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Nome</th>
                    <th className="py-2 pr-4 font-medium">ID</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium text-right">Itens</th>
                    <th className="py-2 pr-4 font-medium text-right">Contados</th>
                    <th className="py-2 pr-4 font-medium text-right">Acuracidade</th>
                    <th className="py-2 pr-4 font-medium">Expira em</th>
                    <th className="py-2 pr-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {invs.map((inv) => {
                    const pct = inv.total_itens > 0 ? (inv.itens_contados / inv.total_itens) * 100 : 0;
                    const expiraEm = new Date(inv.created_at).getTime() + TTL_MS;
                    const restanteMs = expiraEm - now;
                    return (
                      <tr key={inv.id} className="border-b hover:bg-accent/50">
                        <td className="py-3 pr-4 font-medium">
                          <Link to="/inventario/$id" params={{ id: inv.id }} className="hover:underline">{inv.nome}</Link>
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            onClick={() => { navigator.clipboard.writeText(inv.id); toast.success("ID copiado"); }}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            title="Copiar ID"
                          >
                            {inv.id.slice(0, 8)}… <Copy className="h-3 w-3" />
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          {inv.status === "em_andamento"
                            ? <Badge variant="secondary">Em andamento</Badge>
                            : <Badge className="bg-success text-success-foreground">Concluído</Badge>}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{inv.total_itens}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{inv.itens_contados} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></td>
                        <td className="py-3 pr-4 text-right tabular-nums">{inv.acuracidade.toFixed(1)}%</td>
                        <td className="py-3 pr-4">
                          <CountdownBadge restanteMs={restanteMs} />
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/inventario/$id" params={{ id: inv.id }}>Abrir</Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function CountdownBadge({ restanteMs }: { restanteMs: number }) {
  if (restanteMs <= 0) return <Badge variant="destructive">Expirado</Badge>;
  const totalH = Math.floor(restanteMs / (60 * 60 * 1000));
  const dias = Math.floor(totalH / 24);
  const horas = totalH % 24;
  const urgent = restanteMs < 24 * 60 * 60 * 1000;
  const label = dias > 0 ? `${dias}d ${horas}h` : `${horas}h`;
  return (
    <Badge variant={urgent ? "destructive" : "outline"} className="tabular-nums">
      <Clock className="h-3 w-3 mr-1" /> {label}
    </Badge>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
