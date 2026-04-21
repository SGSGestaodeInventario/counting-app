import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/inventario/novo")({ component: NovoPage });

function NovoPage() {
  const { user, loading, session } = useAuth();
  const nav = useNavigate();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("inv-criar", {
        body: { nome: nome.trim(), senha },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Inventário criado!", { description: `ID: ${data.inventario.id}` });
      nav({ to: "/inventario/$id", params: { id: data.inventario.id } });
    } catch (e) {
      toast.error("Falha ao criar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Novo inventário</CardTitle>
          <CardDescription>Crie um inventário e defina uma senha de acesso para os contadores.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do inventário</Label>
              <Input id="nome" required maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Inventário CD São Paulo - Out/2024" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha de acesso para contadores</Label>
              <Input id="senha" type="password" required minLength={4} maxLength={100} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <p className="text-xs text-muted-foreground">Os contadores usarão o ID do inventário + esta senha + nome para acessar.</p>
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Criando…" : "Criar inventário"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
