// Formatação numérica brasileira: 1.250,000 (3 casas decimais, separador de milhar)
const nf = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function fmtNum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0,000";
  return nf.format(Number(value));
}

export function parseNum(input: string): number {
  if (!input) return 0;
  // Aceita "1.250,000" ou "1250.000" ou "1250,5"
  const cleaned = input.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
