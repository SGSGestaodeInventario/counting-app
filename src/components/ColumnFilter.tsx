import { useMemo, useState, useEffect } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { matchesQuery } from "@/lib/search";

interface Props {
  /** Valores únicos disponíveis para a coluna (após filtros das outras colunas). */
  values: string[];
  /** Set de valores selecionados (vazio = sem filtro). */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}

const EMPTY = "(vazio)";

export function ColumnFilter({ values, selected, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Set<string>>(selected);

  useEffect(() => { if (open) setDraft(new Set(selected)); }, [open, selected]);

  const active = selected.size > 0;

  const visible = useMemo(() => {
    const sorted = [...values].sort((a, b) =>
      String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" }),
    );
    if (!q.trim()) return sorted;
    return sorted.filter((v) => matchesQuery(v || EMPTY, q));
  }, [values, q]);

  const toggle = (v: string) => {
    const next = new Set(draft);
    if (next.has(v)) next.delete(v); else next.add(v);
    setDraft(next);
  };

  const apply = () => { onChange(new Set(draft)); setOpen(false); };
  const clear = () => { onChange(new Set()); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar ${label ?? "coluna"}`}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent ml-1 align-middle ${active ? "bg-foreground text-background" : "text-muted-foreground"}`}
          title={active ? `Filtro ativo (${selected.size})` : "Filtrar"}
        >
          <Filter className="h-3 w-3" fill={active ? "currentColor" : "none"} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-2"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar (use * como coringa)…"
          className="h-8 text-xs mb-2"
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 px-1">
          <button
            className="hover:underline"
            onClick={() => setDraft(new Set(visible.map((v) => v || EMPTY)))}
          >
            Selecionar tudo
          </button>
          <button className="hover:underline" onClick={() => setDraft(new Set())}>Limpar</button>
        </div>
        <div className="max-h-56 overflow-auto border rounded-sm">
          {visible.length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-3 text-center">Sem resultados</div>
          )}
          {visible.map((v) => {
            const key = v || EMPTY;
            return (
              <label
                key={key}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-accent/50 cursor-pointer"
              >
                <Checkbox
                  checked={draft.has(key)}
                  onCheckedChange={() => toggle(key)}
                />
                <span className="truncate flex-1" title={key}>{key}</span>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-1 mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
            Sem filtro
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={apply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
