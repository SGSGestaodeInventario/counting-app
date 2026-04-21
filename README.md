# InvControl — Gestão de Inventário SAP

Sistema colaborativo para gestão de processos de inventário com importação Excel, contagem por múltiplos usuários e conciliação automática.

## Como usar (operacional)

### Administradores (criadores)
1. Acessam `/login` com e-mail e senha (criados pelo admin no painel da Lovable Cloud).
2. Criam um inventário em **Novo inventário**, definem uma **senha de acesso**.
3. Compartilham o **ID** + **senha** com os contadores.
4. Importam a planilha SAP (.xlsx) na aba **Importar base Excel**.
5. Acompanham na aba **Conciliação** e exportam o resultado final.

### Contadores (sem cadastro)
1. Acessam `/contar` (link na tela de login).
2. Informam **ID do inventário**, **senha** e **seu nome**.
3. Vêem a lista de itens pendentes (sem ver os estoques SAP).
4. Digitam a quantidade contada → Enter ou botão salvar.
5. Itens com contagem = SAP somem da lista. Divergências ficam destacadas para recontagem.

## Cadastrar usuários administradores

1. Abra o painel **Cloud** → **Users**.
2. Clique em **Add user** → defina email + senha.
3. Não habilite signup público.

## Padrão da planilha SAP

Colunas reconhecidas (acentos e espaços ignorados):
- Material, Texto breve material, Centro, Depósito
- Em contr.qualidade, Trânsito e TE, Bloqueado, Utilização livre
- Unid.medida básica, Lote, Tipo de material, Estoque especial, Nº estoque especial, Posição

**Total SAP** é calculado automaticamente: `Em contr.qualidade + Trânsito e TE + Bloqueado + Utilização livre`.

## Build e deploy no GitHub Pages

```bash
# Repo no GitHub: CountingApp
VITE_BASE_PATH=/CountingApp/ bun run build

# Suba apenas a pasta dist/client/ para o branch gh-pages
# (use git worktree, gh-pages npm package, ou GitHub Actions)
```

Configure GH Pages no repositório → branch `gh-pages` → pasta `/`.

> ⚠️ **Importante:** o backend (Lovable Cloud) **não vai pra GH Pages**. Ele continua rodando no domínio do Lovable, e o frontend chama via HTTPS com CORS já liberado.

## Arquitetura

- **Frontend**: React + TanStack Router (file-based) + Tailwind v4 + shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — Postgres + RLS + Edge Functions
- **Auth**: Supabase Auth para criadores; contadores entram via Edge Function pública validando senha (bcrypt)
- **Modelagem**: `inventarios`, `itens` (com `total_sap` calculada), `contagens` (chave única por item+nome)

## Decisões de produto

- **Contagens somam por nome distinto**: `(item, nome)` é único — refazer com mesmo nome sobrescreve; nomes diferentes somam.
- **Recontagem automática**: contagem ≠ Total SAP → item destacado em amarelo; contagem = Total SAP → item some.
- **Formatação numérica**: `1.250,000` (separador de milhar + 3 casas decimais) em todas as telas.
- **Duplo-clique no "Total SAP"** na conciliação expande/oculta os 4 estoques individuais.
