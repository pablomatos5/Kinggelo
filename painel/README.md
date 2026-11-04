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
