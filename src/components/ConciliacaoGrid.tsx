import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fmtNum, parseNum } from "@/lib/format";
import { exportConciliacao, type ExportRow } from "@/lib/excel";
import { Download, Search, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applySort, nextSort, sortIndicator, type SortState } from "@/lib/sort";
import { useAuth } from "@/lib/auth";
import { AdicionarItemDialog, type NovoItemPayload } from "@/components/AdicionarItemDialog";

function emailPrefix(email: string | null | undefined): string {
  if (!email) return "usuário";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

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
  
  const { user } = useAuth();
  const currentUser = emailPrefix(user?.email);
  const [inlineEdit, setInlineEdit] = useState<{ itemId: string; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null);
  const [contadoresItem, setContadoresItem] = useState<ItemRow | null>(null);
  const [deleteContagem, setDeleteContagem] = useState<{ itemId: string; nome: string } | null>(null);
  const [savingInline, setSavingInline] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const handleAddItem = async (payload: NovoItemPayload) => {
    const { data: novo, error: ie } = await supabase.from("itens").insert({
      inventario_id: inventarioId,
      material: payload.material,
      descricao: payload.descricao,
      centro: payload.centro,
      deposito: payload.deposito,
      lote: payload.lote,
      posicao: payload.posicao,
      estoque_especial: payload.estoque_especial,
      num_estoque_especial: payload.num_estoque_especial,
      unid_medida: payload.unid_medida,
      tipo_material: payload.tipo_material,
      em_qualidade: 0, transito_te: 0, bloqueado: 0, utilizacao_livre: 0, total_sap: 0,
    }).select("id").single();
    if (ie || !novo) { toast.error("Erro ao adicionar item", { description: ie?.message }); return; }
    const { error: ce } = await supabase.from("contagens").insert({
      inventario_id: inventarioId, item_id: novo.id, nome_contador: currentUser, quantidade: payload.contagem,
    });
    if (ce) { toast.error("Item criado, mas falhou a contagem", { description: ce.message }); return; }
    toast.success(`Item ${payload.material} adicionado (sobra de ${fmtNum(payload.contagem)})`);
    await onChange();
  };

  const handleDeleteContagem = async () => {
    if (!deleteContagem) return;
    const { error } = await supabase.from("contagens").delete()
      .eq("inventario_id", inventarioId)
      .eq("item_id", deleteContagem.itemId)
      .eq("nome_contador", deleteContagem.nome);
    if (error) { toast.error("Erro ao excluir contagem", { description: error.message }); return; }
    toast.success(`Contagem de ${deleteContagem.nome} excluída`);
    setDeleteContagem(null);
    await onChange();
  };

  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineEdit]);

  const saveInlineEdit = async () => {
    if (!inlineEdit) return;
    const qtd = parseNum(inlineEdit.value);
    setSavingInline(true);
    const { error } = await supabase.from("contagens").upsert(
      { inventario_id: inventarioId, item_id: inlineEdit.itemId, nome_contador: currentUser, quantidade: qtd },
      { onConflict: "item_id,nome_contador" },
    );
    setSavingInline(false);
    if (error) { toast.error("Erro ao salvar", { description: error.message }); return; }
    toast.success(`Contagem registrada por ${currentUser}`);
    setInlineEdit(null);
    await onChange();
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("itens").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    toast.success("Item excluído");
    setDeleteTarget(null);
    await onChange();
  };

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
        Duplo-clique em "Total SAP" expande os 4 estoques. Duplo-clique em "Contagem" para editar como <strong>{currentUser}</strong>.
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
              <th>Contador</th>
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
                  <td
                    className="num cursor-pointer"
                    title={cs.length ? cs.map((c) => `${c.nome_contador}: ${fmtNum(c.quantidade)}`).join("\n") : "Duplo-clique para registrar contagem"}
                    onDoubleClick={() => setInlineEdit({ itemId: r.id, value: r.contado ? fmtNum(r.contagem) : "" })}
                  >
                    {inlineEdit?.itemId === r.id ? (
                      <Input
                        ref={inlineInputRef}
                        value={inlineEdit.value}
                        onChange={(e) => setInlineEdit({ itemId: r.id, value: e.target.value })}
                        onBlur={saveInlineEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveInlineEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); setInlineEdit(null); }
                        }}
                        disabled={savingInline}
                        className="h-7 text-right tabular-nums"
                      />
                    ) : r.contado ? fmtNum(r.contagem) : "—"}
                  </td>
                  <td className={`num font-medium ${!r.contado ? "text-muted-foreground" : Math.abs(r.diferenca) > 0.0001 ? "text-destructive" : "text-success"}`}>
                    {r.contado ? fmtNum(r.diferenca) : "—"}
                  </td>
                  <td
                    className="text-xs text-muted-foreground cursor-pointer"
                    title={cs.length ? "Duplo-clique para ver contagens" : "—"}
                    onDoubleClick={() => { if (cs.length) setContadoresItem(r); }}
                  >
                    {cs.length === 0 ? "—" : cs.length === 1 ? cs[0].nome_contador : (
                      <span>
                        {cs[cs.length - 1].nome_contador} <span className="text-[10px]">+{cs.length - 1}</span>
                      </span>
                    )}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteTarget(r)} title="Excluir item">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12 + colunasNumExpandida} className="text-center py-12 text-muted-foreground">Nenhum item encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o item <strong className="font-mono">{deleteTarget?.material}</strong>
              {deleteTarget?.descricao ? ` — ${deleteTarget.descricao}` : ""}? Todas as contagens associadas também serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!contadoresItem} onOpenChange={(v) => !v && setContadoresItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{contadoresItem?.material}</DialogTitle>
            <DialogDescription>
              {contadoresItem?.descricao ?? ""} · Total SAP: <strong>{contadoresItem ? fmtNum(contadoresItem.total_sap) : ""}</strong>
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 max-h-[60vh] overflow-auto">
            {(contadoresItem ? contagensPorItem.get(contadoresItem.id) ?? [] : []).map((c) => (
              <li key={c.nome_contador} className="flex items-center gap-3 border rounded-md p-2.5 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.nome_contador}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="tabular-nums font-semibold">{fmtNum(c.quantidade)}</div>
                <Button
                  variant="ghost" size="sm" className="h-8 w-8 p-0"
                  onClick={() => setDeleteContagem({ itemId: contadoresItem!.id, nome: c.nome_contador })}
                  title="Excluir contagem"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteContagem} onOpenChange={(v) => !v && setDeleteContagem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a contagem de <strong>{deleteContagem?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContagem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
