import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { fmtNum, parseNum } from "@/lib/format";
import { exportConciliacao, type ExportRow } from "@/lib/excel";
import { Download, Search, Pencil, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applySort, nextSort, sortIndicator, type SortState } from "@/lib/sort";

export interface Contagem {
  item_id: string;
  nome_contador: string;
  quantidade: number;
  updated_at: string;
}

export interface ItemRow {
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
  contagem: number;
  contado: boolean;
  diferenca: number;
}

interface Props {
  rows: ItemRow[];
  inventarioId: string;
  inventarioNome: string;
  contagens: Contagem[];
  onChange: () => void | Promise<void>;
}

type SortKey =
  | "material" | "descricao" | "centro" | "deposito" | "lote" | "posicao"
  | "estoque_especial" | "num_estoque_especial"
  | "em_qualidade" | "transito_te" | "bloqueado" | "utilizacao_livre"
  | "total_sap" | "contagem" | "diferenca";

export function ConciliacaoGrid({ rows, inventarioId, inventarioNome, contagens, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [expandSAP, setExpandSAP] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"todos" | "ok" | "divergente" | "nao_contado">("todos");
  const [sort, setSort] = useState<SortState<SortKey> | null>({ key: "material", dir: "asc" });
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);

  const contagensPorItem = useMemo(() => {
    const m = new Map<string, Contagem[]>();
    for (const c of contagens) {
      const arr = m.get(c.item_id) ?? [];
      arr.push(c);
      m.set(c.item_id, arr);
    }
    return m;
  }, [contagens]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (q) {
        const hay = [r.material, r.descricao, r.centro, r.deposito, r.lote, r.posicao, r.estoque_especial, r.num_estoque_especial]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterStatus === "ok" && !(r.contado && Math.abs(r.diferenca) < 0.0001)) return false;
      if (filterStatus === "divergente" && !(r.contado && Math.abs(r.diferenca) >= 0.0001)) return false;
      if (filterStatus === "nao_contado" && r.contado) return false;
      return true;
    });
    return applySort(base, sort, (r, k) => (r as unknown as Record<string, unknown>)[k]);
  }, [rows, search, filterStatus, sort]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.sap += r.total_sap;
        acc.contagem += r.contagem;
        acc.dif += r.diferenca;
        acc.emQ += r.em_qualidade;
        acc.tte += r.transito_te;
        acc.blq += r.bloqueado;
        acc.ul += r.utilizacao_livre;
        return acc;
      },
      { sap: 0, contagem: 0, dif: 0, emQ: 0, tte: 0, blq: 0, ul: 0 },
    );
  }, [filtered]);

  const handleExport = useCallback(() => {
    const data: ExportRow[] = filtered.map((r) => {
      const cs = contagensPorItem.get(r.id) ?? [];
      return {
        Material: r.material,
        "Texto breve material": r.descricao ?? "",
        Centro: r.centro ?? "",
        Depósito: r.deposito ?? "",
        Lote: r.lote ?? "",
        Posição: r.posicao ?? "",
        "Estoque especial": r.estoque_especial ?? "",
        "Nº estoque especial": r.num_estoque_especial ?? "",
        "Em contr.qualidade": r.em_qualidade,
        "Trânsito e TE": r.transito_te,
        Bloqueado: r.bloqueado,
        "Utilização livre": r.utilizacao_livre,
        "Total SAP": r.total_sap,
        "Quantidade contada": r.contagem,
        Diferença: r.diferenca,
        Contadores: cs.map((c) => `${c.nome_contador}: ${fmtNum(c.quantidade)} (${new Date(c.updated_at).toLocaleString("pt-BR")})`).join(" | "),
      };
    });
    exportConciliacao(`${inventarioNome.replace(/[^\w]+/g, "_")}_conciliacao.xlsx`, data);
  }, [filtered, inventarioNome, contagensPorItem]);

  const Th = ({ k, children, num }: { k: SortKey; children: React.ReactNode; num?: boolean }) => (
    <th
      className={`sortable ${num ? "num" : ""}`}
      onDoubleClick={() => setSort((s) => nextSort(s, k))}
      title="Duplo-clique para ordenar"
    >
      {children}{sortIndicator(sort, k)}
    </th>
  );

  // colunas visíveis (para colspan da linha de totais)
  const colunasTexto = 8 + (expandSAP ? 0 : 0); // material..num_est_esp = 8
  const colunasNumExpandida = expandSAP ? 4 : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar material, descrição, lote, posição, est. especial…"
            className="pl-8 h-9"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="todos">Todos</option>
          <option value="ok">OK (sem divergência)</option>
          <option value="divergente">Divergentes</option>
          <option value="nao_contado">Não contados</option>
        </select>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Exportar Excel
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Mostrando {filtered.length} de {rows.length} itens. <strong>Duplo-clique</strong> em qualquer coluna para ordenar.
        Duplo-clique em "Total SAP" também expande os 4 estoques. Clique no ✏️ para editar contagens.
      </div>

      <div className="border rounded-md overflow-auto max-h-[70vh] excel-grid">
        <table>
          <thead>
            {/* TOTAIS PRIMEIRO (acima do header de colunas) */}
            <tr className="totals-row">
              <td colSpan={colunasTexto} className="text-right uppercase text-xs tracking-wide text-muted-foreground">
                Totais (filtro atual):
              </td>
              {expandSAP && <>
                <td className="num">{fmtNum(totals.emQ)}</td>
                <td className="num">{fmtNum(totals.tte)}</td>
                <td className="num">{fmtNum(totals.blq)}</td>
                <td className="num">{fmtNum(totals.ul)}</td>
              </>}
              <td className="num">{fmtNum(totals.sap)}</td>
              <td className="num">{fmtNum(totals.contagem)}</td>
              <td className={`num ${Math.abs(totals.dif) > 0.0001 ? "text-destructive" : "text-success"}`}>{fmtNum(totals.dif)}</td>
              <td></td>
            </tr>
            {/* HEADER DE COLUNAS */}
            <tr className="head-row">
              <Th k="material">Material</Th>
              <Th k="descricao">Texto breve</Th>
              <Th k="centro">Centro</Th>
              <Th k="deposito">Depósito</Th>
              <Th k="lote">Lote</Th>
              <Th k="posicao">Posição</Th>
              <Th k="estoque_especial">Est. especial</Th>
              <Th k="num_estoque_especial">Nº est. especial</Th>
              {expandSAP && <>
                <Th k="em_qualidade" num>Em contr.qual.</Th>
                <Th k="transito_te" num>Trânsito e TE</Th>
                <Th k="bloqueado" num>Bloqueado</Th>
                <Th k="utilizacao_livre" num>Utiliz. livre</Th>
              </>}
              <th
                className="num sortable bg-accent/40"
                onDoubleClick={() => { setExpandSAP((v) => !v); setSort((s) => nextSort(s, "total_sap")); }}
                title="Duplo clique: ordena e expande/oculta estoques SAP"
              >
                Total SAP {expandSAP ? "▾" : "▸"}{sortIndicator(sort, "total_sap")}
              </th>
              <Th k="contagem" num>Contagem</Th>
              <Th k="diferenca" num>Diferença</Th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isOk = r.contado && Math.abs(r.diferenca) < 0.0001;
              const isDiv = r.contado && Math.abs(r.diferenca) >= 0.0001;
              const cs = contagensPorItem.get(r.id) ?? [];
              return (
                <tr key={r.id} className={isDiv ? "row-recontagem" : isOk ? "row-ok" : ""}>
                  <td className="font-mono text-xs">{r.material}</td>
                  <td>{r.descricao ?? "—"}</td>
                  <td>{r.centro ?? "—"}</td>
                  <td>{r.deposito ?? "—"}</td>
                  <td>{r.lote ?? "—"}</td>
                  <td>{r.posicao ?? "—"}</td>
                  <td>{r.estoque_especial ?? "—"}</td>
                  <td>{r.num_estoque_especial ?? "—"}</td>
                  {expandSAP && <>
                    <td className="num">{fmtNum(r.em_qualidade)}</td>
                    <td className="num">{fmtNum(r.transito_te)}</td>
                    <td className="num">{fmtNum(r.bloqueado)}</td>
                    <td className="num">{fmtNum(r.utilizacao_livre)}</td>
                  </>}
                  <td className="num font-medium">{fmtNum(r.total_sap)}</td>
                  <td className="num" title={cs.map((c) => `${c.nome_contador}: ${fmtNum(c.quantidade)}`).join("\n")}>
                    {r.contado ? (
                      <span>
                        {fmtNum(r.contagem)}
                        {cs.length > 0 && <span className="text-[10px] text-muted-foreground block">{cs.length} contador{cs.length > 1 ? "es" : ""}</span>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className={`num font-medium ${!r.contado ? "text-muted-foreground" : Math.abs(r.diferenca) > 0.0001 ? "text-destructive" : "text-success"}`}>
                    {r.contado ? fmtNum(r.diferenca) : "—"}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingItem(r)} title="Editar contagens">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11 + colunasNumExpandida} className="text-center py-12 text-muted-foreground">Nenhum item encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <EditarContagensDialog
        item={editingItem}
        contagens={editingItem ? contagensPorItem.get(editingItem.id) ?? [] : []}
        inventarioId={inventarioId}
        onClose={() => setEditingItem(null)}
        onSaved={async () => { await onChange(); }}
      />
    </div>
  );
}

function EditarContagensDialog({
  item, contagens, inventarioId, onClose, onSaved,
}: {
  item: ItemRow | null;
  contagens: Contagem[];
  inventarioId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [novoQtd, setNovoQtd] = useState("");
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const open = !!item;

  const handleAdd = async () => {
    if (!item) return;
    const nome = novoNome.trim();
    if (!nome) { toast.error("Informe o nome do contador"); return; }
    const qtd = parseNum(novoQtd);
    setBusy(true);
    const { error } = await supabase.from("contagens").upsert(
      { inventario_id: inventarioId, item_id: item.id, nome_contador: nome, quantidade: qtd },
      { onConflict: "item_id,nome_contador" },
    );
    setBusy(false);
    if (error) { toast.error("Erro ao salvar", { description: error.message }); return; }
    toast.success("Contagem adicionada");
    setNovoNome(""); setNovoQtd("");
    await onSaved();
  };

  const handleUpdate = async (c: Contagem) => {
    if (!item) return;
    const val = editVals[c.nome_contador];
    if (val === undefined) return;
    const qtd = parseNum(val);
    setBusy(true);
    const { error } = await supabase.from("contagens").upsert(
      { inventario_id: inventarioId, item_id: item.id, nome_contador: c.nome_contador, quantidade: qtd },
      { onConflict: "item_id,nome_contador" },
    );
    setBusy(false);
    if (error) { toast.error("Erro ao atualizar", { description: error.message }); return; }
    toast.success(`Contagem de ${c.nome_contador} atualizada`);
    setEditVals((p) => { const x = { ...p }; delete x[c.nome_contador]; return x; });
    await onSaved();
  };

  const handleDelete = async (c: Contagem) => {
    if (!item) return;
    if (!confirm(`Excluir contagem de ${c.nome_contador}?`)) return;
    setBusy(true);
    const { error } = await supabase.from("contagens").delete()
      .eq("inventario_id", inventarioId).eq("item_id", item.id).eq("nome_contador", c.nome_contador);
    setBusy(false);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    toast.success("Contagem excluída");
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{item?.material}</DialogTitle>
          <DialogDescription>
            {item?.descricao ?? ""} · Total SAP: <strong>{item ? fmtNum(item.total_sap) : ""}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-2">Contagens registradas</h4>
            {contagens.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma contagem ainda.</p>
            ) : (
              <ul className="space-y-2">
                {contagens.map((c) => (
                  <li key={c.nome_contador} className="flex items-center gap-2 text-sm border rounded-md p-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.nome_contador}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <Input
                      className="h-8 w-24 text-right tabular-nums"
                      value={editVals[c.nome_contador] ?? fmtNum(c.quantidade)}
                      onChange={(e) => setEditVals((p) => ({ ...p, [c.nome_contador]: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => handleUpdate(c)}>Salvar</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDelete(c)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2">Adicionar contagem manual</h4>
            <div className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Nome do contador</Label>
                <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: João" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)} placeholder="0,000" className="h-9 text-right" />
              </div>
              <Button size="sm" disabled={busy} onClick={handleAdd}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
