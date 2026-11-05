# King Gelo — site + painel do dono

Um único servidor Node (sem dependências, usa o SQLite embutido do Node 22.13+) entrega:

- `/` — o site (arquivos da pasta acima)
- `/admin/` — o painel do dono: início, pedidos, clientes, estoque, avisos de reposição e ajustes
- `/api/` — API do painel (login obrigatório) e `/api/publico/revenda` (formulário de revenda do site)

## Rodar

```bash
cd painel
npm run admin -- dono      # cria o acesso do dono (pede a senha no terminal)
npm start                  # http://localhost:8090 e http://localhost:8090/admin/
npm run exemplo            # opcional, SÓ para testar: apaga tudo e carrega dados de exemplo
```

Variáveis: `PORT` (padrão 8090), `KG_BANCO` (caminho do arquivo do banco; padrão `painel/dados/kinggelo.db`),
`KG_HTTPS=1` quando estiver atrás do nginx com certificado (cookie de sessão fica `Secure`).

## O que o painel faz
- **Pedidos**: novo pedido, correção de sabores e quantidades depois de salvo (o estoque é acertado sozinho), dia de entrega
  marcado e a lista "Para entregar" por dia e cidade (com impressão).
- **Pagamentos em partes**: cada pedido guarda os pagamentos (valor, forma, dia). Fica "Parcial" até a soma chegar ao total.
- **Produtos**: além dos 8 sabores, dá para cadastrar outros (ex.: gelo comum), editar nome, cor e preços e tirar de linha.
- **Financeiro**: despesas por tipo, vendido × recebido × despesas e o lucro do mês, com os últimos 6 meses.
- **Acessos**: o dono cria logins. `equipe` lança pedidos, entregas e estoque, mas o servidor não manda nenhum valor em
  dinheiro para ela e barra financeiro, downloads, acessos e ajustes.
- **Interessado novo**: o painel aberto confere a cada minuto e avisa (aviso na tela e, se permitido, notificação do aparelho).
- **Backup automático**: uma cópia por dia em `dados/backups` (no servidor: `/dados/backups`), guardando 14 dias; dá para
  baixar em Ajustes. Uma cópia fora do servidor, de vez em quando, continua sendo do dono.

## Como funcionam os avisos de reposição

Para cada cliente ativo, o painel olha os pedidos confirmados/entregues:

- com 2 ou mais pedidos: tudo o que ele comprou antes do último foi vendido no intervalo entre o primeiro e o
  último pedido → isso dá a média de saquinhos por dia;
- com 1 pedido: usa o "repõe a cada (dias)" do cliente, ou o ciclo padrão dos Ajustes (7 dias).

Com essa média, estima quanto do último pedido ainda resta. Abaixo de 25% fica **Acabando**, abaixo de 50%
**Atenção** (os dois limites e a mensagem do WhatsApp são editáveis em Ajustes). O botão "Avisar no WhatsApp"
abre a conversa com a mensagem pronta e a sugestão de reposição (média dos sabores dos últimos 3 pedidos).

## Estoque

Pedido **confirmado** ou **entregue** tira os saquinhos do estoque (bloqueia se não houver o suficiente).
Cancelar devolve. Entradas (produção) e contagens ficam registradas em "Movimentações".

## Backup

O banco é um único arquivo (`dados/kinggelo.db`). Para copiar com o servidor rodando:
`sqlite3 dados/kinggelo.db ".backup backup.db"` (ou pare o servidor e copie o arquivo).
