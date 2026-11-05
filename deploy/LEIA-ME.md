# Publicar o King Gelo (kinggelo.com.br)

Roda na VPS 92.112.178.48, atrás do nginx compartilhado do Nexos. Projeto independente: não mexe no código, banco ou
configuração de nenhum outro site da VPS.

| O quê | Onde |
|---|---|
| Código | `/opt/kinggelo` (sem `painel/dados`) |
| App | container `kinggelo-app` (porta 8090, só na rede `nexos_default`) |
| Banco e backups automáticos | volume `kinggelo_dados` → `/dados` no container |
| vhost | `/opt/sites-extra/conf/kinggelo.com.br.conf` (cópia de `deploy/kinggelo.com.br.conf`) |
| Certificado | `/opt/sites-extra/certs/live/kinggelo.com.br` (renovado pelo cron semanal do root) |

## Primeira publicação
1. DNS: registros A de `kinggelo.com.br` e `www` apontando para `92.112.178.48`.
2. Copiar o projeto para `/opt/kinggelo` e subir: `cd /opt/kinggelo/deploy && docker compose up -d --build`
3. Criar o acesso do dono: `docker exec -it kinggelo-app node --disable-warning=ExperimentalWarning painel/criar-admin.js <usuario>`
   (não rodar o `exemplo.js` em produção: ele apaga os dados).
4. Certificado: primeiro um vhost só com a porta 80 (o bloco `listen 80` deste arquivo), recarregar o nginx e emitir:
   ```
   docker run --rm -v /opt/sites-extra/certs:/etc/letsencrypt -v /opt/sites-extra/acme:/var/www/certbot certbot/certbot \
     certonly --webroot -w /var/www/certbot -d kinggelo.com.br -d www.kinggelo.com.br --key-type ecdsa
   ```
   Depois trocar pelo `kinggelo.com.br.conf` completo, testar e recarregar:
   `docker exec nexos-nginx-1 nginx -t && docker exec nexos-nginx-1 nginx -s reload`
   (um `.conf` com certificado que ainda não existe derruba o nginx de **todos** os sites: sempre `nginx -t` antes).

## Atualizar o site
Copiar os arquivos novos para `/opt/kinggelo` e rodar `docker compose up -d --build` em `/opt/kinggelo/deploy`.
O banco fica no volume e não é tocado.

## Backup
Automático, uma cópia por dia dos últimos 14 dias, dentro do volume. Para guardar fora da VPS: painel → Ajustes → Baixar backup,
ou `docker cp kinggelo-app:/dados/kinggelo.db .`

O servidor já manda compressão (brotli/gzip) e os cabeçalhos de segurança (CSP, X-Frame-Options etc.);
com `KG_HTTPS=1` também manda HSTS e confia no IP que o nginx informa.

## Trocar uma imagem do site
As imagens ficam 30 dias guardadas no celular de quem visitou. Para trocar uma imagem, salve o arquivo novo com outro nome
(ex.: `pacote-melancia-2.webp`) e troque o nome no `index.html`; se só sobrescrever, quem já visitou continua vendo a antiga.
