'use strict';
// Dados de exemplo para conhecer o painel. NÃO rodar em produção (apaga clientes, pedidos e estoque).
const { abrirBanco, transacao, SABORES } = require('./banco');
const db = abrirBanco();
const dias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');

transacao(db, () => {
  db.exec('DELETE FROM avisos; DELETE FROM pagamentos; DELETE FROM despesas; DELETE FROM movimentos; DELETE FROM itens_pedido; DELETE FROM pedidos; DELETE FROM clientes;');
  // só os 8 sabores de fábrica (produtos criados em teste saem)
  db.prepare(`DELETE FROM produtos WHERE slug NOT IN (${SABORES.map(() => '?').join(',')})`).run(...SABORES.map((x) => x[0]));
  db.exec('UPDATE produtos SET estoque = 0, preco_atacado = 280, preco_varejo = 400, estoque_minimo = 60, ativo = 1');
  const prods = db.prepare('SELECT id, nome FROM produtos ORDER BY id').all();
  const estoque = [420, 260, 180, 150, 210, 90, 40, 70];
  prods.forEach((p, i) => {
    db.prepare('UPDATE produtos SET estoque = ? WHERE id = ?').run(estoque[i], p.id);
    db.prepare("INSERT INTO movimentos (produto_id, tipo, quantidade, motivo, criado_em) VALUES (?, 'entrada', ?, 'Produção (exemplo)', ?)").run(p.id, estoque[i] + 200, dias(30));
  });
  const cli = db.prepare('INSERT INTO clientes (nome, estabelecimento, tipo, cidade, telefone, status, origem, volume_informado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const ped = db.prepare("INSERT INTO pedidos (cliente_id, status, pagamento, pago, baixado, criado_em, entregue_em) VALUES (?, 'entregue', ?, ?, 1, ?, ?)");
  const item = db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unit) VALUES (?, ?, ?, 280)');
  const clientes = [
    ['João Batista', 'Adega do João', 'Casa de bebidas', 'Cametá-PA', '91988887777', [[21, [40, 20, 10]], [14, [40, 20, 10]], [7, [50, 20, 20]]]],
    ['Maria Souza', 'Mercadinho Bom Preço', 'Mercado / supermercado', 'Cametá-PA', '91977776666', [[20, [30, 30, 30, 20]], [10, [30, 30, 30, 20]]]],
    ['Carlos Lima', 'Distribuidora Rio Tocantins', 'Distribuidora', 'Mocajuba-PA', '91966665555', [[16, [100, 60, 60, 40, 40]], [3, [120, 60, 60, 40, 40]]]],
    ['Ana Paula', 'Bar da Orla', 'Bar / restaurante', 'Cametá-PA', '91955554444', [[12, [24, 12]]]],
    ['Rafael Costa', 'Adega Beira Lago', 'Casa de bebidas', 'Tucuruí-PA', '94991112222', [[18, [60, 30, 30, 20]], [9, [60, 40, 30, 20]]]],
  ];
  for (const [nome, ponto, tipo, cidade, tel, hist] of clientes) {
    const c = cli.run(nome, ponto, tipo, cidade, tel, 'ativo', 'painel', '').lastInsertRowid;
    hist.forEach(([d, qtds], k) => {
      const p = ped.run(c, k % 2 ? 'dinheiro' : 'pix', k < hist.length - 1 ? 1 : 0, dias(d), dias(d)).lastInsertRowid;
      qtds.forEach((q, j) => item.run(p, prods[j].id, q));
    });
  }
  cli.run('Pedro Alves', 'Conveniência Pôr do Sol', 'Casa de bebidas', 'Limoeiro do Ajuru-PA', '91944443333', 'lead', 'site', '50 a 200 saquinhos');

  // pedidos pagos ganham o pagamento; um pedido pago só pela metade
  const total = (id) => db.prepare('SELECT SUM(quantidade * preco_unit) AS t FROM itens_pedido WHERE pedido_id = ?').get(id).t;
  const pag = db.prepare('INSERT INTO pagamentos (pedido_id, valor, forma, recebido_em, observacao) VALUES (?, ?, ?, date(?), ?)');
  for (const p of db.prepare('SELECT id, pagamento, criado_em FROM pedidos WHERE pago = 1').all()) pag.run(p.id, total(p.id), p.pagamento, p.criado_em, '');
  const parcial = db.prepare("SELECT id, criado_em FROM pedidos WHERE pago = 0 ORDER BY id DESC LIMIT 1").get();
  pag.run(parcial.id, Math.round(total(parcial.id) / 2), 'pix', parcial.criado_em, 'Metade no Pix');

  // entregas marcadas: uma para hoje, uma para amanhã e uma atrasada
  const dia = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' });
  const novo = db.prepare("INSERT INTO pedidos (cliente_id, status, pagamento, pago, baixado, criado_em, entrega_em) VALUES (?, 'novo', 'pix', 0, 0, ?, ?)");
  const ids = db.prepare("SELECT id FROM clientes WHERE status = 'ativo' ORDER BY id").all().map((c) => c.id);
  [[ids[0], 0, [30, 20]], [ids[1], 1, [40, 20, 20]], [ids[3], -1, [24]]].forEach(([c, d, qtds]) => {
    const p = novo.run(c, dias(Math.max(0, -d)), dia(d)).lastInsertRowid;
    qtds.forEach((q, j) => item.run(p, prods[j].id, q));
  });

  // despesas do mês
  const desp = db.prepare('INSERT INTO despesas (descricao, categoria, valor, data) VALUES (?, ?, ?, ?)');
  [['3 mil saquinhos', 'Embalagem', 45000, -20], ['Polpa de melancia e morango', 'Polpa e insumos', 62000, -15], ['Conta de energia', 'Energia', 38000, -10],
    ['Combustível das entregas', 'Entrega e combustível', 21000, -5]].forEach(([d, c, v, n]) => desp.run(d, c, v, dia(n)));
});
console.log('Dados de exemplo carregados.');
