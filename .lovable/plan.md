

## Redesign completo da Login — Black & White Corporativo

Implementar agora o split-screen minimalista preto/branco já planejado anteriormente, mantendo o efeito typewriter já adicionado e toda a lógica existente (login email/senha + atalho contador).

### Mudanças

**1. Asset**
- Copiar `user-uploads://Captura_de_Tela_2026-04-21_às_11.38.10.png` → `src/assets/login-hero.png`.

**2. `src/routes/login.tsx`** — reescrita do JSX (mantendo `TypewriterText`, `useAuth`, `signIn`, redirect, toasts)
- Layout `grid md:grid-cols-2 min-h-screen`, sem o gradiente azul atual.
- **Painel esquerdo** (desktop): `<img>` `object-cover` ocupando 100% do painel. No mobile vira faixa superior `h-40`.
- **Painel direito**: fundo `bg-white`, formulário centralizado `max-w-sm w-full px-6`.
  - Header: logo monocromático (ícone `Boxes` em preto pequeno) + título com typewriter em `text-3xl font-semibold tracking-tight text-black` + subtítulo `text-sm text-neutral-500`.
  - Form sem Card — apenas inputs soltos com labels acima.
  - Inputs: `h-11 border-neutral-200 focus-visible:ring-black focus-visible:ring-1 rounded-md bg-white`.
  - Botão "Entrar": `h-11 w-full bg-black text-white hover:bg-neutral-800 rounded-md font-medium`.
  - Divisor "ou": linhas finas `border-neutral-200`, texto `text-[10px] uppercase tracking-[0.2em] text-neutral-400`.
  - Botão "Sou contador": `variant="outline"` com classes `h-11 border-neutral-300 text-black hover:bg-neutral-50`.
  - Rodapé do painel: `text-xs text-neutral-400` "© SGS — Gestão de inventários".
- Remover `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription` do import.

