// Utilitário de busca com suporte a wildcards (* e ?) e múltiplos termos AND.
// `123*` => começa com 123. `*abc` => termina com abc. `abc` (sem *) => contém abc.
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function termToRegex(term: string): RegExp {
  const hasWildcard = term.includes("*") || term.includes("?");
  // escape regex specials except * and ?
  const escaped = term.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  let pattern: string;
  if (hasWildcard) {
    pattern = "^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
  } else {
    // sem wildcard => contém
    pattern = escaped;
  }
  return new RegExp(pattern, "i");
}

export function matchesQuery(value: string | null | undefined, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const hay = normalize(String(value ?? ""));
  const terms = q.split(/\s+/).filter(Boolean).map(normalize);
  return terms.every((t) => termToRegex(t).test(hay));
}

// Conveniência: testa contra vários campos (OR entre campos, AND entre termos).
export function matchesAny(values: Array<string | null | undefined>, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const terms = q.split(/\s+/).filter(Boolean).map(normalize);
  const hays = values.map((v) => normalize(String(v ?? "")));
  return terms.every((t) => {
    const re = termToRegex(t);
    return hays.some((h) => re.test(h));
  });
}
