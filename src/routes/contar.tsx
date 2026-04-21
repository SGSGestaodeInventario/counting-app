import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes, Search, LogOut, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fmtNum, parseNum } from "@/lib/format";
import { applySort, type SortState } from "@/lib/sort";
import { TypewriterText } from "@/components/TypewriterText";
import heroImg from "@/assets/login-hero.png";

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
  total_sap: number;
  contagem_minha: number | null;
  status: "pendente" | "ok" | "recontagem";
}

interface Sessao { inventario_id: string; inventario_nome: string; senha: string; nome: string; }

const SESSION_KEY = "inv_contador_session_v1";

function ContarPage() {
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  if (!sessao) return <EntradaForm onEntrar={(s) => { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); setSessao(s); }} />;
  return <ContagemTela sessao={sessao} onSair={() => { sessionStorage.removeItem(SESSION_KEY); setSessao(null); }} />;
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
      onEntrar({ inventario_id: data.inventario.id, inventario_nome: data.inventario.nome, senha, nome: nome.trim() });
    } catch (e) {
      toast.error("Falha no acesso", { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white text-black">
      <div className="relative bg-neutral-100 overflow-hidden h-40 md:h-auto">
        <img src={heroImg} alt="Inventário corporativo" className="w-full h-full object-cover" />
      </div>

      <div className="flex flex-col justify-between px-6 py-10 md:px-16 md:py-14">
        <div className="flex items-center gap-2 text-black">
          <Boxes className="h-5 w-5" />
          <span className="text-sm font-medium tracking-tight">SGS</span>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <h1 className="text-3xl font-semibold tracking-tight text-black">
                <TypewriterText text="Acesso de contador." />
              </h1>
              <p className="text-sm text-neutral-500 mt-2">
                Use o ID e a senha fornecidos pelo responsável.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="invid" className="text-xs font-medium text-neutral-700">ID do inventário</Label>
                <Input
                  id="invid"
                  required
                  value={inventarioId}
                  onChange={(e) => setInventarioId(e.target.value)}
                  placeholder="cole aqui o UUID"
                  className="h-11 border-neutral-200 bg-white rounded-md font-mono text-xs focus-visible:ring-1 focus-visible:ring-black focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-xs font-medium text-neutral-700">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="h-11 border-neutral-200 bg-white rounded-md focus-visible:ring-1 focus-visible:ring-black focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-xs font-medium text-neutral-700">Seu nome</Label>
                <Input
                  id="nome"
                  required
                  maxLength={100}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Identifica suas contagens"
                  className="h-11 border-neutral-200 bg-white rounded-md focus-visible:ring-1 focus-visible:ring-black focus-visible:ring-offset-0"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full bg-black text-white hover:bg-neutral-800 rounded-md font-medium shadow-none"
              >
                {busy ? "Validando…" : "Entrar e contar"}
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                  ou
                </span>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              className="h-11 w-full border-neutral-300 text-black hover:bg-neutral-50 rounded-md shadow-none"
            >
              <Link to="/login">Sou administrador</Link>
            </Button>
          </div>
        </div>

        <p className="text-xs text-neutral-400 text-center md:text-left">
          © SGS — Gestão de inventários
        </p>
      </div>
    </div>
  );
}

type SortKey = "material" | "descricao" | "lote" | "posicao" | "total_sap";
type FilterMode = "pendente" | "recontagem" | "ok";

function ContagemTela({ sessao, onSair }: { sessao: Sessao; onSair: () => void }) {
  const [itens, setItens] = useState<ItemContagem[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("pendente");
  const [edicoes, setEdicoes] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState<SortKey> | null>({ key: "material", dir: "asc" });

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
        if (soma !== undefined) status = Math.abs(soma - totalSap) < 0.0001 ? "ok" : "recontagem";
        return {
          id: it.id, material: it.material, descricao: it.descricao, centro: it.centro, deposito: it.deposito,
          lote: it.lote, posicao: it.posicao, unid_medida: it.unid_medida, tipo_material: it.tipo_material,
          estoque_especial: it.estoque_especial, total_sap: totalSap, contagem_minha: minha, status,
        };
      });
      setItens(list);
    } catch (e) {
      toast.error("Erro ao carregar itens", { description: (e as Error).message });
    } finally { setBusy(false); }
  }, [sessao]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = itens.filter((i) => {
      if (i.status !== filterMode) return false;
      if (q) {
        const hay = [i.material, i.descricao, i.centro, i.deposito, i.lote, i.posicao, i.estoque_especial].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return applySort(base, sort, (r, k) => (r as unknown as Record<string, unknown>)[k]);
  }, [itens, search, filterMode, sort]);

  const salvarContagem = async (item: ItemContagem, valor: string) => {
    const qtd = parseNum(valor);
    try {
      const { data, error } = await supabase.functions.invoke("inv-acesso", {
        body: {
          action: "salvar", inventario_id: sessao.inventario_id, senha: sessao.senha,
          nome_contador: sessao.nome, item_id: item.id, quantidade: qtd,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Salvo: ${item.material} = ${fmtNum(qtd)}`);
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

  const sortOptions: { k: SortKey; label: string }[] = [
    { k: "material", label: "Material" },
    { k: "descricao", label: "Descrição" },
    { k: "lote", label: "Lote" },
    { k: "posicao", label: "Posição" },
    { k: "total_sap", label: "Total SAP" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-bold truncate">{sessao.inventario_nome}</h1>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">Como <strong>{sessao.nome}</strong></p>
        </div>
        <Button variant="outline" size="sm" onClick={onSair}><LogOut className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Sair</span></Button>
      </div>

      {/* TABS DE FILTRO (estilo mobile) */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg mb-3 sticky top-2 z-10 shadow-sm">
        <FilterTab active={filterMode === "pendente"} onClick={() => setFilterMode("pendente")} label="Pendentes" count={stats.pend} cls="text-warning" />
        <FilterTab active={filterMode === "recontagem"} onClick={() => setFilterMode("recontagem")} label="Recontagem" count={stats.recont} cls="text-destructive" />
        <FilterTab active={filterMode === "ok"} onClick={() => setFilterMode("ok")} label="OK" count={stats.ok} cls="text-success" />
      </div>

      {/* BUSCA + ORDENAÇÃO */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8 h-9" />
        </div>
        <select
          value={sort ? `${sort.key}:${sort.dir}` : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) setSort(null);
            else { const [k, d] = v.split(":"); setSort({ key: k as SortKey, dir: d as "asc" | "desc" }); }
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          title="Ordenar por"
        >
          {sortOptions.flatMap((o) => [
            <option key={`${o.k}:asc`} value={`${o.k}:asc`}>{o.label} ↑</option>,
            <option key={`${o.k}:desc`} value={`${o.k}:desc`}>{o.label} ↓</option>,
          ])}
        </select>
      </div>

      {busy ? (
        <div className="text-center py-12 text-muted-foreground">Carregando itens…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg text-muted-foreground">
          {filterMode === "pendente" && "🎉 Nenhum item pendente!"}
          {filterMode === "recontagem" && "✅ Nenhuma recontagem necessária."}
          {filterMode === "ok" && "Nenhum item conferido ainda."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              valor={edicoes[it.id] ?? (it.contagem_minha !== null ? fmtNum(it.contagem_minha) : "")}
              onChangeValor={(v) => setEdicoes((p) => ({ ...p, [it.id]: v }))}
              onSalvar={(v) => salvarContagem(it, v)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterTab({ active, onClick, label, count, cls }: { active: boolean; onClick: () => void; label: string; count: number; cls: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md py-2 px-1 text-xs font-medium transition ${active ? "bg-background shadow-sm" : "text-muted-foreground"}`}
    >
      <div>{label}</div>
      <div className={`text-base font-bold tabular-nums ${cls}`}>{count}</div>
    </button>
  );
}

function ItemCard({
  item, valor, onChangeValor, onSalvar,
}: {
  item: ItemContagem;
  valor: string;
  onChangeValor: (v: string) => void;
  onSalvar: (v: string) => void;
}) {
  const borderCls =
    item.status === "recontagem" ? "border-destructive/40 bg-destructive/5"
    : item.status === "ok" ? "border-success/40 bg-success/5"
    : "border-border";

  return (
    <div className={`border rounded-lg p-3 ${borderCls}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-muted-foreground">{item.material}</div>
          <div className="font-medium text-sm leading-tight">{item.descricao ?? "—"}</div>
        </div>
        {item.status === "recontagem" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-full whitespace-nowrap">
            <AlertTriangle className="h-3 w-3" /> Recontar
          </span>
        )}
        {item.status === "ok" && (
          <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-1 rounded-full whitespace-nowrap">✓ OK</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-3">
        {item.lote && <div><span className="font-medium text-foreground">Lote:</span> {item.lote}</div>}
        {item.posicao && <div><span className="font-medium text-foreground">Pos:</span> {item.posicao}</div>}
        {item.deposito && <div><span className="font-medium text-foreground">Dep:</span> {item.deposito}</div>}
        {item.estoque_especial && <div><span className="font-medium text-foreground">Est.esp:</span> {item.estoque_especial}</div>}
        {item.unid_medida && <div><span className="font-medium text-foreground">Un:</span> {item.unid_medida}</div>}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Quantidade contada</Label>
          <Input
            inputMode="decimal"
            value={valor}
            onChange={(e) => onChangeValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSalvar((e.target as HTMLInputElement).value); }}
            placeholder="0,000"
            className="h-11 text-right text-base tabular-nums"
          />
        </div>
        <Button onClick={() => onSalvar(valor)} className="h-11 px-4">
          <Save className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Salvar</span>
        </Button>
      </div>
    </div>
  );
}
