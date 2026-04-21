import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { parseNum } from "@/lib/format";
import { toast } from "sonner";

export interface NovoItemPayload {
  material: string;
  descricao: string | null;
  centro: string | null;
  deposito: string | null;
  lote: string | null;
  posicao: string | null;
  estoque_especial: string | null;
  num_estoque_especial: string | null;
  unid_medida: string | null;
  tipo_material: string | null;
  contagem: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: NovoItemPayload) => Promise<void> | void;
  /** Quem está registrando (mostrado no rodapé do dialog). */
  contadorLabel: string;
}

export function AdicionarItemDialog({ open, onOpenChange, onSubmit, contadorLabel }: Props) {
  const [material, setMaterial] = useState("");
  const [descricao, setDescricao] = useState("");
  const [centro, setCentro] = useState("");
  const [deposito, setDeposito] = useState("");
  const [lote, setLote] = useState("");
  const [posicao, setPosicao] = useState("");
  const [estoqueEsp, setEstoqueEsp] = useState("");
  const [numEstoqueEsp, setNumEstoqueEsp] = useState("");
  const [unidMedida, setUnidMedida] = useState("");
  const [tipoMaterial, setTipoMaterial] = useState("");
  const [contagem, setContagem] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMaterial(""); setDescricao(""); setCentro(""); setDeposito("");
    setLote(""); setPosicao(""); setEstoqueEsp(""); setNumEstoqueEsp("");
    setUnidMedida(""); setTipoMaterial(""); setContagem("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material.trim()) { toast.error("Informe o material"); return; }
    const qtd = parseNum(contagem);
    if (!Number.isFinite(qtd) || qtd <= 0) { toast.error("Informe uma quantidade válida (> 0)"); return; }
    setBusy(true);
    try {
      await onSubmit({
        material: material.trim(),
        descricao: descricao.trim() || null,
        centro: centro.trim() || null,
        deposito: deposito.trim() || null,
        lote: lote.trim() || null,
        posicao: posicao.trim() || null,
        estoque_especial: estoqueEsp.trim() || null,
        num_estoque_especial: numEstoqueEsp.trim() || null,
        unid_medida: unidMedida.trim() || null,
        tipo_material: tipoMaterial.trim() || null,
        contagem: qtd,
      });
      reset();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar item (sobra)</DialogTitle>
          <DialogDescription>
            Item fora da base SAP. <strong>Total SAP = 0</strong>; a quantidade informada vira a contagem inicial — gerando uma sobra na conciliação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Material *" value={material} onChange={setMaterial} mono required maxLength={100} />
            <Field label="Texto breve / Descrição" value={descricao} onChange={setDescricao} maxLength={255} />
            <Field label="Centro" value={centro} onChange={setCentro} maxLength={50} />
            <Field label="Depósito" value={deposito} onChange={setDeposito} maxLength={50} />
            <Field label="Lote" value={lote} onChange={setLote} maxLength={50} />
            <Field label="Posição" value={posicao} onChange={setPosicao} maxLength={50} />
            <Field label="Estoque especial" value={estoqueEsp} onChange={setEstoqueEsp} maxLength={50} />
            <Field label="Nº estoque especial" value={numEstoqueEsp} onChange={setNumEstoqueEsp} maxLength={50} />
            <Field label="Unid. medida" value={unidMedida} onChange={setUnidMedida} maxLength={20} />
            <Field label="Tipo de material" value={tipoMaterial} onChange={setTipoMaterial} maxLength={50} />
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs font-medium">Quantidade contada *</Label>
            <Input
              inputMode="decimal"
              value={contagem}
              onChange={(e) => setContagem(e.target.value)}
              placeholder="0,000"
              className="h-11 mt-1 text-right text-base tabular-nums"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Será registrada por <strong>{contadorLabel}</strong>.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Adicionando…" : "Adicionar item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, mono, required, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  mono?: boolean; required?: boolean; maxLength?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        className={`h-9 ${mono ? "font-mono text-xs" : ""}`}
      />
    </div>
  );
}
