import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes, KeyRound } from "lucide-react";
import { toast } from "sonner";
import heroImg from "@/assets/login-hero.png";

function TypewriterText({ text, speed = 70 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <span aria-label={text} className="inline-block min-h-[1em]">
      <span aria-hidden="true">{shown}</span>
      <span aria-hidden="true" className="inline-block w-[2px] h-[0.9em] align-[-0.1em] ml-0.5 bg-current animate-pulse" />
    </span>
  );
}

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, signIn, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav({ to: "/dashboard" }); }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error("Falha no login", { description: error });
    else toast.success("Bem-vindo!");
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white text-black">
      {/* Painel visual */}
      <div className="relative bg-neutral-100 overflow-hidden h-40 md:h-auto">
        <img
          src={heroImg}
          alt="Inventário corporativo"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Painel formulário */}
      <div className="flex flex-col justify-between px-6 py-10 md:px-16 md:py-14">
        <div className="flex items-center gap-2 text-black">
          <Boxes className="h-5 w-5" />
          <span className="text-sm font-medium tracking-tight">SGS</span>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <h1 className="text-3xl font-semibold tracking-tight text-black">
                <TypewriterText text="App de contagens." />
              </h1>
              <p className="text-sm text-neutral-500 mt-2">
                Gestão de inventários SAP
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium text-neutral-700">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-11 border-neutral-200 bg-white rounded-md focus-visible:ring-1 focus-visible:ring-black focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd" className="text-xs font-medium text-neutral-700">Senha</Label>
                <Input
                  id="pwd"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 border-neutral-200 bg-white rounded-md focus-visible:ring-1 focus-visible:ring-black focus-visible:ring-offset-0"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full bg-black text-white hover:bg-neutral-800 rounded-md font-medium shadow-none"
              >
                {busy ? "Entrando…" : "Entrar"}
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
              <Link to="/contar">
                <KeyRound className="h-4 w-4 mr-2" />
                Sou contador (entrar com ID)
              </Link>
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
