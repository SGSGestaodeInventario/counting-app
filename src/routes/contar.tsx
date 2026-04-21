import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Boxes, KeyRound, ArrowLeft, Search, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { fmtNum, parseNum } from "@/lib/format";

export const Route = createFileRoute("/contar")({ component: ContarPage });

interface ItemContagem {
  id: string;
  material: string;
  descricao: string | null;
  centro: string | null;
  deposito: string | null;
  lote: string | null;
  posicao: string | null;
  unid_medida: string | null;
  tipo_material: string | null;
  estoque_especial: string | null;
  num_estoque_especial: string | null;
  total_sap: number;
  contagem_minha: number | null; // contagem do usuário atual (nome)
  status: "pendente" | "ok" | "recontagem";
}

interface Sessao {
  inventario_id: string;
  inventario_nome: string;
  senha: string;
  nome: string;
}

const SESSION_KEY = "inv_contador_session_v1";

function ContarPage() {
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  if (!sessao) return <EntradaForm onEntrar={(s) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSessao(s);
  }} />;

  return <ContagemTela sessao={sessao} onSair={() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSessao(null);
  }} />;
}

function EntradaForm({ onEntrar }: { onEntrar: (s: Sessao) => void }) {
  const [inventarioId, setInventarioId] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe seu nome"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("inv-acesso", {
        body: { action: "validar", inventario_id: inventarioId.trim(), senha },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Acesso liberado: ${data.inventario.nome}`);
      onEntrar({
        inventario_id: data.inventario.id,
        inventario_nome: data.inventario.nome,
        senha,
        nome: nome.trim(),
      });
    } catch (e) {
      toast.error("Falha no acesso", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-background to-accent/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 mb-4">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Acesso de contador</h1>
          <p className="text-sm text-muted-foreground mt-1">Use o ID e a senha fornecidos pelo responsável.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar no inventário</CardTitle>
            <CardDescription>Você não precisa ter cadastro — apenas o ID e a senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invid">ID do inventário</Label>
                <Input id="invid" required value={inventarioId} onChange={(e) => setInventarioId(e.target.value)} placeholder="cole aqui o UUID" className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Seu nome</Label>
                <Input id="nome" required maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Identifica suas contagens" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Validando…" : "Entrar e contar"}</Button>
            </form>
            <div className="mt-4 text-center">
              <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Sou administrador
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContagemTela({ sessao, onSair }: { sessao: Sessao; onSair: () => void }) {
  const [itens, setItens] = useState<ItemContagem[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false); // false = oculta itens já OK
  const [edicoes, setEdicoes] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("inv-acesso", {
        body: { action: "listar", inventario_id: sessao.inventario_id, senha: sessao.senha },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const itensRaw: any[] = data.itens ?? [];
      const contagensRaw: { item_id: string; nome_contador: string; quantidade: number }[] = data.contagens ?? [];
      // soma por item (todos os contadores) + minha contagem
      const somaPorItem = new Map<string, number>();
      const minhaPorItem = new Map<string, number>();
      for (const c of contagensRaw) {
        somaPorItem.set(c.item_id, (somaPorItem.get(c.item_id) ?? 0) + Number(c.quantidade));
        if (c.nome_contador === sessao.nome) minhaPorItem.set(c.item_id, Number(c.quantidade));
      }
      const list: ItemContagem[] = itensRaw.map((it) => {
        const totalSap = Number(it.total_sap);
        const soma = somaPorItem.get(it.id);
        const minha = minhaPorItem.get(it.id) ?? null;
        let status: ItemContagem["status"] = "pendente";
        if (soma !== undefined) {
          status = Math.abs(soma - totalSap) < 0.0001 ? "ok" : "recontagem";
        }
        return {
          id: it.id,
          material: it.material,
          descricao: it.descricao,
          centro: it.centro,
          deposito: it.deposito,
          lote: it.lote,
          posicao: it.posicao,
          unid_medida: it.unid_medida,
          tipo_material: it.tipo_material,
          estoque_especial: it.estoque_especial,
          num_estoque_especial: it.num_estoque_especial,
          total_sap: totalSap,
          contagem_minha: minha,
          status,
        };
      });
      setItens(list);
    } catch (e) {
      toast.error("Erro ao carregar itens", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [sessao]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itens.filter((i) => {
      // Padrão: oculta os "ok" (item resolvido)
      if (!showAll && i.status === "ok") return false;
      if (q) {
        const hay = [i.material, i.descricao, i.centro, i.deposito, i.lote, i.posicao].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [itens, search, showAll]);

  const salvarContagem = async (item: ItemContagem, valor: string) => {
    const qtd = parseNum(valor);
    try {
      const { data, error } = await supabase.functions.invoke("inv-acesso", {
        body: {
          action: "salvar",
          inventario_id: sessao.inventario_id,
          senha: sessao.senha,
          nome_contador: sessao.nome,
          item_id: item.id,
          quantidade: qtd,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Contagem salva: ${item.material} = ${fmtNum(qtd)}`);
      setEdicoes((e) => { const x = { ...e }; delete x[item.id]; return x; });
      await refresh();
    } catch (e) {
      toast.error("Falha ao salvar", { description: (e as Error).message });
    }
  };

  const stats = useMemo(() => {
    const total = itens.length;
    const ok = itens.filter((i) => i.status === "ok").length;
    const recont = itens.filter((i) => i.status === "recontagem").length;
    const pend = itens.filter((i) => i.status === "pendente").length;
    return { total, ok, recont, pend };
  }, [itens]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">{sessao.inventario_nome}</h1>
          </div>
          <p className="text-xs text-muted-foreground">Contando como <strong>{sessao.nome}</strong></p>
        </div>
        <Button variant="outline" size="sm" onClick={onSair}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <Mini label="Total" value={stats.total} />
        <Mini label="Pendentes" value={stats.pend} cls="text-warning" />
        <Mini label="Recontagem" value={stats.recont} cls="text-destructive" />
        <Mini label="OK" value={stats.ok} cls="text-success" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8 h-9" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Mostrar itens já OK
        </label>
        <Button variant="outline" size="sm" onClick={refresh}>Atualizar</Button>
      </div>

      {busy ? (
        <div className="text-center py-12 text-muted-foreground">Carregando itens…</div>
      ) : (
        <div className="border rounded-md overflow-auto max-h-[70vh] excel-grid">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Material</th>
                <th>Texto breve</th>
                <th>Centro</th>
                <th>Depósito</th>
                <th>Lote</th>
                <th>Posição</th>
                <th>Unid.</th>
                <th>Tipo</th>
                <th>Est. esp.</th>
                <th className="num">Qtde contada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const editVal = edicoes[it.id] ?? (it.contagem_minha !== null ? fmtNum(it.contagem_minha) : "");
                return (
                  <tr key={it.id} className={it.status === "recontagem" ? "row-recontagem" : ""}>
                    <td>
                      {it.status === "ok" && <span className="text-success font-medium text-xs">✓ OK</span>}
                      {it.status === "recontagem" && <span className="text-destructive font-medium text-xs">⚠ Recontar</span>}
                      {it.status === "pendente" && <span className="text-muted-foreground text-xs">Pendente</span>}
                    </td>
                    <td className="font-mono text-xs">{it.material}</td>
                    <td>{it.descricao ?? "—"}</td>
                    <td>{it.centro ?? "—"}</td>
                    <td>{it.deposito ?? "—"}</td>
                    <td>{it.lote ?? "—"}</td>
                    <td>{it.posicao ?? "—"}</td>
                    <td>{it.unid_medida ?? "—"}</td>
                    <td>{it.tipo_material ?? "—"}</td>
                    <td>{it.estoque_especial ?? "—"}</td>
                    <td className="num" style={{ minWidth: 140 }}>
                      <Input
                        value={editVal}
                        onChange={(e) => setEdicoes((p) => ({ ...p, [it.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") salvarContagem(it, (e.target as HTMLInputElement).value); }}
                        className="h-8 text-right tabular-nums"
                        placeholder="0,000"
                      />
                    </td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => salvarContagem(it, editVal)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">
                  {showAll ? "Nenhum item encontrado." : "Tudo conciliado! 🎉 Marque 'Mostrar itens já OK' para revisar."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Mini({ label, value, cls = "" }: { label: string; value: number; cls?: string }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold tabular-nums ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
