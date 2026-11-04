# Publicar o King Gelo (ainda NÃO publicado)

Pendente do cliente/usuário: domínio, certificado e autorização para subir.

1. Copiar o projeto para `/opt/kinggelo` na VPS (sem `painel/dados`).
2. `cd /opt/kinggelo/deploy && docker compose up -d --build`
3. Criar o acesso real do dono: `docker exec -it kinggelo-app node --disable-warning=ExperimentalWarning painel/criar-admin.js <usuario>`
   (não rodar o `exemplo.js` em produção: ele apaga os dados).
4. Colocar `kinggelo.conf.exemplo` (com o domínio) na pasta sites-extra do nginx compartilhado e recarregar o nginx.
5. Backup: pelo painel (Ajustes → Baixar backup) ou `docker cp kinggelo-app:/dados/kinggelo.db .`

Projeto independente: não mexe no código, banco ou configuração de nenhum outro site da VPS.

## Antes de subir, com o domínio em mãos
- Em `index.html`, trocar `og:image` para o endereço completo (ex.: `https://DOMINIO/img/cliente/arte-melancia.webp`)
  e adicionar `<link rel="canonical" href="https://DOMINIO/">`: WhatsApp e Facebook não mostram a prévia com caminho relativo.
- Apagar os usuários de desenvolvimento (`admin` / `dono`) depois de criar o acesso real.
- O servidor já manda compressão (brotli/gzip) e os cabeçalhos de segurança (CSP, X-Frame-Options etc.);
  com `KG_HTTPS=1` também manda HSTS e confia no IP que o nginx informa.
