# Plano: Publicação no GitHub Pages

## Objetivo
Publicar a versão web do app no GitHub Pages (branch `gh-pages`) com build do Vite.

## Premissas
- O repositório está no GitHub.
- O build web já funciona com `npm run build` (Vite).
- O app precisa rodar com base relativa (já está `base: "./"` no `vite.config.ts`).

## Plano (passo a passo)
1) **Dependência**
   - Adicionar `gh-pages` como devDependency.
2) **Scripts**
   - Criar script `deploy`:
     - `npm run build` e depois publicar `dist/public` no `gh-pages`.
   - (Opcional) `predeploy` para garantir build automático.
3) **README**
   - Incluir instruções de deploy (comandos e observações).
4) **Config do GitHub**
   - Em Settings → Pages:
     - Source: `gh-pages` / `/ (root)`
5) **Primeiro deploy**
   - `npm run deploy`

## Observações importantes
- A pasta publicada é `dist/public` (webDir do Capacitor).
- A publicação do Pages é só da web; o app mobile continua via Capacitor.

## Perguntas rápidas antes de executar
1) Qual é o nome do repositório no GitHub? https://github.com/macielcr7/cartola-racha
2) A branch padrão é `main`? master 
3) Quer que eu já adicione o link do Pages no README? SIM

