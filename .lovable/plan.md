

## Acesso de Contador no layout split-screen + identidade B&W

Unificar a tela de acesso do contador ao mesmo layout split-screen preto/branco da `/login`, e aplicar a identidade visual minimalista B&W em todo o app.

### 1. `src/routes/contar.tsx` — `EntradaForm` no layout da login

Substituir o card centralizado azul por um split-screen idêntico ao da `/login`:

- Layout `min-h-screen grid md:grid-cols-2 bg-white text-black`.
- **Painel esquerdo**: mesma `heroImg` (`@/assets/login-hero.png`), `object-cover`, virando faixa `h-40` no mobile.
- **Painel direito**: header com ícone `Boxes` + label "SGS"; centro com:
  - Título com `TypewriterText` (extrair para `src/components/TypewriterText.tsx` e reusar nas duas rotas) — texto: `"Acesso de contador."`
  - Subtítulo: `"Use o ID e a senha fornecidos pelo responsável."`
  - Form sem `Card`, inputs `h-11 border-neutral-200 focus-visible:ring-black`, labels `text-xs font-medium text-neutral-700`:
    - **ID do inventário** (mono `text-xs`, placeholder "cole aqui o UUID")
    - **Senha**
    - **Seu nome**
  - Botão primário: `h-11 w-full bg-black text-white hover:bg-neutral-800 rounded-md` → "Entrar e contar".
  - Divisor "ou" (mesmo estilo da login).
  - Botão secundário `variant="outline"` com `Link to="/login"` → "Sou administrador".
  - Rodapé `text-xs text-neutral-400` "© SGS — Gestão de inventários".
- Remover imports de `Card*`, `KeyRound` (substituir por `Boxes`).

### 2. Extrair `TypewriterText`

Mover o componente atualmente inline em `src/routes/login.tsx` para `src/components/TypewriterText.tsx` e importá-lo nas duas rotas — sem mudar comportamento (cursor pulsante, 70ms/char, `aria-label`).

### 3. Identidade visual B&W em todo o app

Trocar a paleta de tokens em `src/styles.css` para escala neutra preto/branco/cinzas, mantendo os tokens semânticos do shadcn (sem mexer em componentes):

- `--background: 0 0% 100%` / `--foreground: 0 0% 4%`
- `--primary: 0 0% 4%` / `--primary-foreground: 0 0% 100%`
- `--secondary / --muted / --accent`: cinzas neutros (`0 0% 96%` / `0 0% 45%`)
- `--border / --input: 0 0% 90%`, `--ring: 0 0% 4%`
- `--card / --popover`: brancos
- `--destructive`: manter vermelho funcional (estados de erro precisam contrastar)
- Manter `--success` e `--warning` em tons neutros escuros (preto/cinza-escuro) — feedback fica via ícones e texto, não cor
- Variante dark: cores invertidas (background preto, foreground branco, cinzas equivalentes)
- Sidebar tokens: alinhar à mesma paleta neutra

### 4. Ajustes pontuais nas telas existentes para casar com B&W

Sem refazer telas, apenas remover usos hard-coded de azul/cores fortes onde existirem (ex.: `text-primary` continua válido pois agora é preto). Os componentes que dependem dos tokens (`Button`, `Input`, `Card`, `Tabs`, etc.) herdam automaticamente a nova paleta.

- `ContagemTela` (header e tabs): cores baseadas em tokens já refletem B&W. Os indicadores `text-success`, `text-warning`, `text-destructive` passam a ser tons neutros (success/warning) + vermelho (destructive) — mantém legibilidade sem azul.
- Estados "OK" / "Recontagem" continuam diferenciados por borda + ícone.

### Resultado

- `/contar` (sem sessão): mesmo split-screen B&W da `/login`, com typewriter e botão "Sou administrador" voltando à `/login`.
- `/contar` (com sessão): tela de contagem mantida, agora monocromática.
- Resto do app (dashboard, inventários, conciliação): identidade B&W minimalista via tokens.

