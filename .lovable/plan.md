

## Animação de digitação no título da Login

Adicionar efeito typewriter no título "App de contagens." da página de login, simulando digitação profissional ao abrir a tela.

### Mudanças

**`src/routes/login.tsx`**
- Criar componente local `TypewriterText` que recebe `text: string` e renderiza caractere por caractere via `useState` + `useEffect` com `setInterval`.
- Velocidade: ~70ms por caractere (ajuste natural, nem rápido nem lento).
- Cursor piscante (`|`) ao lado do texto enquanto digita; após completar, cursor permanece piscando por ~2s e depois some (ou fica fixo, conforme padrão de sites tipo Vercel/Linear).
- Usar `aria-label={text}` no wrapper para leitores de tela lerem o texto completo, e `aria-hidden` no span animado.
- Substituir o `<h1>` atual que renderiza "App de contagens." pelo componente.
- Reservar altura mínima (`min-h-[1em]`) para evitar layout shift durante a digitação.

### Detalhes técnicos
- Cursor implementado com `<span>` + classe Tailwind `animate-pulse` (já disponível via tw-animate-css), ou keyframe inline com `@keyframes blink` se precisar de piscar mais nítido — preferir `animate-pulse` para evitar tocar no CSS global.
- Cleanup do `setInterval` no `useEffect` return.
- Animação dispara apenas no mount (client-side); no SSR renderiza string vazia + cursor, hidrata e começa a digitar — sem hydration mismatch porque o estado inicial é o mesmo nos dois lados.
- Sem novas dependências.

