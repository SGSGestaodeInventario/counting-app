import * as XLSX from "xlsx";

export interface ImportRow {
  material: string;
  descricao: string | null;
  centro: string | null;
  deposito: string | null;
  em_qualidade: number;
  transito_te: number;
  bloqueado: number;
  utilizacao_livre: number;
  unid_medida: string | null;
  lote: string | null;
  tipo_material: string | null;
  estoque_especial: string | null;
  num_estoque_especial: string | null;
  posicao: string | null;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};

const normKey = (k: string): string =>
  k.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  material: "material",
  textobrevematerial: "descricao",
  textobreve: "descricao",
  descricao: "descricao",
  centro: "centro",
  deposito: "deposito",
  emcontrqualidade: "em_qualidade",
  emcontrolequalidade: "em_qualidade",
  emqualidade: "em_qualidade",
  transitoete: "transito_te",
  transitote: "transito_te",
  bloqueado: "bloqueado",
  utilizacaolivre: "utilizacao_livre",
  unidmedidabasica: "unid_medida",
  unidademedida: "unid_medida",
  unidademedidabasica: "unid_medida",
  lote: "lote",
  tipodematerial: "tipo_material",
  tipomaterial: "tipo_material",
  estoqueespecial: "estoque_especial",
  noestoqueespecial: "num_estoque_especial",
  numestoqueespecial: "num_estoque_especial",
  nestoqueespecial: "num_estoque_especial",
  posicao: "posicao",
};

export async function parseExcel(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return raw
    .map((row) => {
      const out: Partial<ImportRow> = {};
      for (const [origKey, val] of Object.entries(row)) {
        const mapped = COLUMN_MAP[normKey(origKey)];
        if (!mapped) continue;
        if (mapped === "em_qualidade" || mapped === "transito_te" || mapped === "bloqueado" || mapped === "utilizacao_livre") {
          out[mapped] = num(val);
        } else if (mapped === "material") {
          out.material = str(val) ?? "";
        } else {
          (out as Record<string, string | null>)[mapped] = str(val);
        }
      }
      return {
        material: out.material ?? "",
        descricao: out.descricao ?? null,
        centro: out.centro ?? null,
        deposito: out.deposito ?? null,
        em_qualidade: out.em_qualidade ?? 0,
        transito_te: out.transito_te ?? 0,
        bloqueado: out.bloqueado ?? 0,
        utilizacao_livre: out.utilizacao_livre ?? 0,
        unid_medida: out.unid_medida ?? null,
        lote: out.lote ?? null,
        tipo_material: out.tipo_material ?? null,
        estoque_especial: out.estoque_especial ?? null,
        num_estoque_especial: out.num_estoque_especial ?? null,
        posicao: out.posicao ?? null,
      } as ImportRow;
    })
    .filter((r) => r.material && r.material.length > 0);
}

export interface ExportRow {
  Material: string;
  "Texto breve material": string;
  Centro: string;
  Depósito: string;
  Lote: string;
  Posição: string;
  "Estoque especial": string;
  "Nº estoque especial": string;
  "Em contr.qualidade": number;
  "Trânsito e TE": number;
  Bloqueado: number;
  "Utilização livre": number;
  "Total SAP": number;
  "Quantidade contada": number;
  Diferença: number;
  Contadores: string;
}

export function exportConciliacao(filename: string, rows: ExportRow[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Conciliação");
  XLSX.writeFile(wb, filename);
}
