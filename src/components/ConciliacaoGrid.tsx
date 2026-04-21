import { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtNum } from "@/lib/format";
import { exportConciliacao, type ExportRow } from "@/lib/excel";
import { Download, Search } from "lucide-react";

export interface ItemRow {
  id: string;
  material: string;
  descricao: string | null;
  centro: string | null;
  deposito: string | null;
  lote: string | null;
  posicao: string | null;
  em_qualidade: number;
  transito_te: number;
  bloqueado: number;
  utilizacao_livre: number;
  total_sap: number;
  contagem: number; // soma das contagens
  contado: boolean; // alguma contagem registrada
  diferenca: number;
}

interface Props {
  rows: ItemRow[];
  inventarioNome: string;
}

export function ConciliacaoGrid({ rows, inventarioNome }: Props) {
  const [search, setSearch] = useState("");
  const [expandSAP, setExpandSAP] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"todos" | "ok" | "divergente" | "nao_contado">("todos");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = [r.material, r.descricao, r.centro, r.deposito, r.lote, r.posicao].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterStatus === "ok" && !(r.contado && Math.abs(r.diferenca) < 0.0001)) return false;
      if (filterStatus === "divergente" && !(r.contado && Math.abs(r.diferenca) >= 0.0001)) return false;
      if (filterStatus === "nao_contado" && r.contado) return false;
      return true;
    });
  }, [rows, search, filterStatus]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.sap += r.total_sap;
        acc.contagem += r.contagem;
        acc.dif += r.diferenca;
        return acc;
      },
      { sap: 0, contagem: 0, dif: 0 },
    );
  }, [filtered]);

  const handleExport = useCallback(() => {
    const data: ExportRow[] = filtered.map((r) => ({
      Material: r.material,
      "Texto breve material": r.descricao ?? "",
      Centro: r.centro ?? "",
      Depósito: r.deposito ?? "",
      Lote: r.lote ?? "",
      Posição: r.posicao ?? "",
      "Em contr.qualidade": r.em_qualidade,
      "Trânsito e TE": r.transito_te,
      Bloqueado: r.bloqueado,
      "Utilização livre": r.utilizacao_livre,
      "Total SAP": r.total_sap,
      "Quantidade contada": r.contagem,
      Diferença: r.diferenca,
    }));
    exportConciliacao(`${inventarioNome.replace(/[^\w]+/g, "_")}_conciliacao.xlsx`, data);
  }, [filtered, inventarioNome]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar material, descrição, lote, posição…"
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
        Mostrando {filtered.length} de {rows.length} itens. Dica: <strong>duplo-clique</strong> em "Total SAP" expande/oculta os 4 estoques.
      </div>

      <div className="border rounded-md overflow-auto max-h-[70vh] excel-grid">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Texto breve</th>
              <th>Centro</th>
              <th>Depósito</th>
              <th>Lote</th>
              <th>Posição</th>
              {expandSAP && <>
                <th className="num">Em contr.qual.</th>
                <th className="num">Trânsito e TE</th>
                <th className="num">Bloqueado</th>
                <th className="num">Utiliz. livre</th>
              </>}
              <th
                className="num cursor-pointer select-none bg-accent/40"
                onDoubleClick={() => setExpandSAP((v) => !v)}
                title="Duplo clique para expandir/ocultar estoques SAP"
              >
                Total SAP {expandSAP ? "▾" : "▸"}
              </th>
              <th className="num">Contagem</th>
              <th className="num">Diferença</th>
            </tr>
            <tr className="bg-primary/5 font-semibold">
              <td colSpan={6 + (expandSAP ? 4 : 0)} className="text-right uppercase text-xs tracking-wide text-muted-foreground">
                Totais (filtro atual):
              </td>
              <td className="num">{fmtNum(totals.sap)}</td>
              <td className="num">{fmtNum(totals.contagem)}</td>
              <td className={`num ${Math.abs(totals.dif) > 0.0001 ? "text-destructive" : "text-success"}`}>{fmtNum(totals.dif)}</td>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isOk = r.contado && Math.abs(r.diferenca) < 0.0001;
              const isDiv = r.contado && Math.abs(r.diferenca) >= 0.0001;
              return (
                <tr key={r.id} className={isDiv ? "row-recontagem" : isOk ? "row-ok" : ""}>
                  <td className="font-mono text-xs">{r.material}</td>
                  <td>{r.descricao ?? "—"}</td>
                  <td>{r.centro ?? "—"}</td>
                  <td>{r.deposito ?? "—"}</td>
                  <td>{r.lote ?? "—"}</td>
                  <td>{r.posicao ?? "—"}</td>
                  {expandSAP && <>
                    <td className="num">{fmtNum(r.em_qualidade)}</td>
                    <td className="num">{fmtNum(r.transito_te)}</td>
                    <td className="num">{fmtNum(r.bloqueado)}</td>
                    <td className="num">{fmtNum(r.utilizacao_livre)}</td>
                  </>}
                  <td className="num font-medium">{fmtNum(r.total_sap)}</td>
                  <td className="num">{r.contado ? fmtNum(r.contagem) : "—"}</td>
                  <td className={`num font-medium ${!r.contado ? "text-muted-foreground" : Math.abs(r.diferenca) > 0.0001 ? "text-destructive" : "text-success"}`}>
                    {r.contado ? fmtNum(r.diferenca) : "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9 + (expandSAP ? 4 : 0)} className="text-center py-12 text-muted-foreground">Nenhum item encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
