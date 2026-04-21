

## Filtros por coluna estilo Excel + busca com wildcard

Adicionar filtros por coluna na conciliação (igual Excel) e expandir a busca da contagem por múltiplos campos. Implementar suporte a wildcards (`*`) em todos os campos de busca do app.

### 1. Helper de busca com wildcard — `src/lib/search.ts` (novo)

Criar função utilitária `matchesQuery(value: string, query: string): boolean` que:
- Normaliza acentos e caixa.
- Suporta `*` como coringa (qualquer sequência) e `?` (um caractere).
- `123*` → `^123.*$` (começa com 123).
- `*abc` → termina com abc; `*abc*` (ou apenas `abc`) → contém abc.
- Sem `*` → comportamento atual (contém — preserva retrocompatibilidade).
- Suporta múltiplos termos separados por espaço (AND).

Usado em todos os pontos de busca (conciliação, contagem, dashboard).

### 2. Filtros por coluna na Conciliação — `src/components/ConciliacaoGrid.tsx`

Adicionar uma **linha de filtro abaixo do header** (estilo Excel) com um botão-funil em cada coluna textual (Material, Texto breve, Centro, Depósito, Lote, Posição, Est. especial, Nº est. especial, Contador):

- Componente novo `src/components/ColumnFilter.tsx`:
  - Ícone `Filter` (lucide) no `<th>`; muda para azul/preto sólido quando ativo.
  - Ao clicar → `Popover` (shadcn já disponível) com:
    - `Input` no topo (suporta wildcard `*`, usa `matchesQuery`).
    - Lista com checkboxes dos valores únicos da coluna **dentro dos itens já filtrados pelas outras colunas** (comportamento Excel).
    - Botões "Selecionar tudo / Limpar" e "Aplicar".
  - Estado: `Set<string>` de valores selecionados por coluna.
- Estado global no grid: `columnFilters: Record<SortKey, Set<string>>`.
- `filtered` passa a aplicar:
  1. busca global (com wildcard via `matchesQuery`),
  2. filtro de status existente,
  3. filtros por coluna (interseção AND entre colunas, OR entre valores de uma mesma coluna),
  4. ordenação.
- Para colunas numéricas (Total SAP, Contagem, Diferença): manter sem filtro de coluna nesta versão (ordenação já cobre).
- Coluna "Contador" filtra pelo nome do contador mais recente exibido.
- Indicador visual: header com filtro ativo ganha `bg-accent` e o ícone preenchido.

### 3. Busca multi-campo na Contagem — `src/routes/contar.tsx`

Substituir o input único de busca por uma barra com:
- Um `Input` principal "Buscar" + um seletor de **escopo** (`Select`) com opções: `Tudo`, `Material`, `Depósito`, `Posição`, `Lote`, `Descrição`.
- O usuário pode digitar `123*` em qualquer escopo.
- Internamente: aplica `matchesQuery` apenas no(s) campo(s) selecionado(s); `Tudo` mantém o comportamento atual (todos os campos concatenados).
- Adicionar dica abaixo do campo: `Use * como coringa (ex.: 123* )`.

### 4. Padronizar wildcard em todos os campos de busca do app

Trocar comparações `.includes()` em buscas pelo helper `matchesQuery`:
- `src/routes/dashboard.tsx` (busca de inventários).
- `src/components/ConciliacaoGrid.tsx` (busca global do grid).
- `src/routes/contar.tsx` (busca de itens).
- Qualquer outro `Input` com `Search` icon que filtre lista localmente.

Adicionar placeholder consistente: `"Buscar (use * como coringa)…"` nos campos principais.

### 5. Sem mudanças em backend / banco

Tudo é filtragem client-side sobre dados já carregados. Sem migrações, sem alteração de RLS, sem nova edge function.

### Resultado

- **Conciliação**: cada coluna textual tem um funil clicável → popup com busca + checkboxes dos valores únicos, igual Excel. Filtros combinam entre si.
- **Contagem**: usuário escolhe filtrar por Material / Depósito / Posição / Lote / Descrição / Tudo, com wildcard.
- **Em todo app**: digitar `123*` filtra "começa com 123"; `*XYZ` filtra "termina com XYZ"; `ABC` (sem `*`) continua sendo "contém ABC".

