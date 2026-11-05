'use strict';
// Rotas autenticadas do painel: [método, padrão, função({ db, params, corpo, query })].
const fs = require('node:fs');
const path = require('node:path');
const { transacao, UNIDADES } = require('./banco');
const backup = require('./backup');
const { preverCliente, mensagemAviso, config } = require('./previsao');

const erro = (status, msg) => Object.assign(new Error(msg), { status });
const UNIDADE_IDS = UNIDADES.map((u) => u.id);
const unidadeValida = (v, padrao = 'cameta') => (UNIDADE_IDS.includes(v) ? v : padrao);
const txt = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const inteiro = (v, min = 0) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min) throw erro(400, 'Número inválido');
  return n;
};
const fone = (v) => String(v || '').replace(/\D/g, '').slice(0, 13);
const linkWhats = (tel, msg) => {
  const n = fone(tel);
  return n ? `https://wa.me/${n.length <= 11 ? '55' + n : n}?text=${encodeURIComponent(msg)}` : null;
};

const TOTAL_PEDIDO = '(SELECT COALESCE(SUM(quantidade * preco_unit), 0) FROM itens_pedido WHERE pedido_id = p.id)';
const RECEBIDO_PEDIDO = '(SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE pedido_id = p.id)';
// dia de hoje no Pará (o servidor roda em UTC: depois das 21h já seria "amanhã")
const hojeLocal = (somaDias = 0) => new Date(Date.now() + somaDias * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' });
const dataValida = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const FORMAS = ['pix', 'dinheiro', 'cartao', 'prazo'];
const CATEGORIAS = ['Embalagem', 'Polpa e insumos', 'Energia', 'Entrega e combustível', 'Funcionários', 'Aluguel', 'Marketing', 'Outros'];
// foto do saquinho no site: produtos novos ainda sem foto aparecem com um desenho na cor do sabor
const PASTA_FOTOS = path.resolve(__dirname, '..', 'img', 'cliente');
const temFoto = (slug) => fs.existsSync(path.join(PASTA_FOTOS, `pacote-${slug}.webp`));
const slugDe = (nome) => String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sabor';
const UNIDADES_PEDIDO = '(SELECT COALESCE(SUM(quantidade), 0) FROM itens_pedido WHERE pedido_id = p.id)';

// ---------- estoque ----------
// o que cada unidade movimentou nos últimos `dias`: contatos pelo WhatsApp do site, interessados, clientes e pedidos.
// Pedido conta para a unidade do cliente.
function porUnidade(db, dias) {
  const desde = `-${dias} days`;
  const contatos = db.prepare(`SELECT unidade, origem, COUNT(*) AS n FROM contatos_site WHERE criado_em >= datetime('now', ?) GROUP BY 1, 2`).all(desde);
  const sabores = db.prepare(`SELECT unidade, detalhe, COUNT(*) AS n FROM contatos_site
                              WHERE origem = 'sabor' AND detalhe != '' AND criado_em >= datetime('now', ?) GROUP BY 1, 2 ORDER BY n DESC`).all(desde);
  const clientes = db.prepare(`SELECT unidade, SUM(status = 'ativo') AS ativos, SUM(status = 'lead') AS interessados,
                                      SUM(origem = 'site' AND criado_em >= datetime('now', ?)) AS novosSite
                               FROM clientes GROUP BY unidade`).all(desde);
  const vendas = db.prepare(`SELECT c.unidade, COUNT(*) AS pedidos, COALESCE(SUM(${UNIDADES_PEDIDO}), 0) AS saquinhos, COALESCE(SUM(${TOTAL_PEDIDO}), 0) AS total,
                                    COUNT(DISTINCT c.id) AS compradores
                             FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
                             WHERE p.status IN ('confirmado', 'entregue') AND p.criado_em >= datetime('now', ?) GROUP BY c.unidade`).all(desde);
  const abertos = db.prepare(`SELECT c.unidade, COUNT(*) AS n FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
                              WHERE p.status IN ('novo', 'confirmado') GROUP BY c.unidade`).all();
  return UNIDADES.map((u) => {
    const meus = contatos.filter((c) => c.unidade === u.id);
    const cl = clientes.find((c) => c.unidade === u.id) || {};
    const v = vendas.find((x) => x.unidade === u.id) || {};
    return {
      ...u,
      contatos: { n: meus.reduce((s, c) => s + c.n, 0), porOrigem: meus.map(({ origem, n }) => ({ origem, n })).sort((a, b) => b.n - a.n) },
      sabores: sabores.filter((s) => s.unidade === u.id).slice(0, 5).map(({ detalhe, n }) => ({ sabor: detalhe, n })),
      clientes: { ativos: cl.ativos || 0, interessados: cl.interessados || 0, novosSite: cl.novosSite || 0 },
      vendas: { pedidos: v.pedidos || 0, saquinhos: v.saquinhos || 0, compradores: v.compradores || 0, total: v.total || 0 },
      abertos: (abertos.find((a) => a.unidade === u.id) || {}).n || 0,
    };
  });
}

function movimentar(db, produtoId, tipo, qtd, motivo, pedidoId = null) {
  db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?').run(qtd, produtoId);
  db.prepare('INSERT INTO movimentos (produto_id, tipo, quantidade, motivo, pedido_id) VALUES (?, ?, ?, ?, ?)').run(produtoId, tipo, qtd, motivo, pedidoId);
}
function darBaixa(db, pedidoId) {
  const itens = db.prepare('SELECT i.produto_id, i.quantidade, pr.nome, pr.estoque FROM itens_pedido i JOIN produtos pr ON pr.id = i.produto_id WHERE i.pedido_id = ?').all(pedidoId);
  const falta = itens.filter((i) => i.estoque < i.quantidade);
  if (falta.length) throw erro(409, 'Estoque insuficiente: ' + falta.map((i) => `${i.nome} (tem ${i.estoque}, precisa ${i.quantidade})`).join('; '));
  for (const i of itens) movimentar(db, i.produto_id, 'saida', -i.quantidade, `Pedido #${pedidoId}`, pedidoId);
  db.prepare('UPDATE pedidos SET baixado = 1 WHERE id = ?').run(pedidoId);
}
function estornar(db, pedidoId, motivo = `Pedido #${pedidoId} cancelado`) {
  const itens = db.prepare('SELECT produto_id, quantidade FROM itens_pedido WHERE pedido_id = ?').all(pedidoId);
  for (const i of itens) movimentar(db, i.produto_id, 'estorno', i.quantidade, motivo, pedidoId);
  db.prepare('UPDATE pedidos SET baixado = 0 WHERE id = ?').run(pedidoId);
}

// ---------- pagamentos ----------
// o pedido fica "pago" quando o que entrou cobre o total
function sincronizarPago(db, pedidoId) {
  const p = db.prepare(`SELECT ${TOTAL_PEDIDO} AS total, ${RECEBIDO_PEDIDO} AS recebido FROM pedidos p WHERE p.id = ?`).get(pedidoId);
  db.prepare('UPDATE pedidos SET pago = ? WHERE id = ?').run(p.total > 0 && p.recebido >= p.total ? 1 : 0, pedidoId);
}
function receber(db, pedidoId, valor, forma, dia, obs = '') {
  db.prepare('INSERT INTO pagamentos (pedido_id, valor, forma, recebido_em, observacao) VALUES (?, ?, ?, ?, ?)')
    .run(pedidoId, valor, FORMAS.includes(forma) ? forma : 'pix', dataValida(dia) || hojeLocal(), txt(obs, 200));
  sincronizarPago(db, pedidoId);
}

// ---------- consultas ----------
function pedidoCompleto(db, id) {
  const p = db.prepare(`SELECT p.*, c.nome AS cliente_nome, c.estabelecimento, c.telefone, c.cidade, ${TOTAL_PEDIDO} AS total, ${UNIDADES_PEDIDO} AS unidades,
                               ${RECEBIDO_PEDIDO} AS recebido
                        FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ?`).get(id);
  if (!p) throw erro(404, 'Pedido não encontrado');
  p.itens = db.prepare('SELECT i.*, pr.nome, pr.slug, pr.cor, pr.ativo FROM itens_pedido i JOIN produtos pr ON pr.id = i.produto_id WHERE i.pedido_id = ? ORDER BY pr.id').all(id);
  p.pagamentos = db.prepare('SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY recebido_em, id').all(id);
  p.saldo = Math.max(0, p.total - p.recebido);
  return p;
}
// itens de um pedido (novo ou corrigido): quantidade > 0, sabor existente, preço de atacado se não vier outro
function gravarItens(db, pedidoId, itens, podePreco) {
  const prod = db.prepare('SELECT * FROM produtos WHERE id = ?');
  const ins = db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unit) VALUES (?, ?, ?, ?)');
  for (const i of itens) {
    const p = prod.get(+i.produto_id);
    if (!p) throw erro(400, 'Sabor inválido');
    const preco = podePreco && i.preco_unit != null && i.preco_unit !== '' ? inteiro(i.preco_unit) : p.preco_atacado;
    ins.run(pedidoId, p.id, inteiro(i.quantidade, 1), preco);
  }
}
function clienteComPrevisao(db, c, cfg) {
  const prev = preverCliente(db, c, cfg);
  return { ...c, previsao: prev };
}

function listaAvisos(db) {
  const cfg = config(db);
  return db.prepare("SELECT * FROM clientes WHERE status = 'ativo'").all()
    .map((c) => {
      const prev = preverCliente(db, c, cfg);
      const msg = prev.nivel === 'sem-pedidos' ? '' : mensagemAviso(cfg, c, prev);
      return { ...c, previsao: prev, mensagem: msg, whatsapp: linkWhats(c.telefone, msg) };
    })
    .filter((c) => (c.previsao.nivel === 'acabando' || c.previsao.nivel === 'atencao') && !c.previsao.adiadoAte)
    .sort((a, b) => a.previsao.fracao - b.previsao.fracao);
}

// ---------- insights da tela inicial ----------
const DIA = 86400000;
const dataSql = (s) => new Date(s.replace(' ', 'T') + (s.length <= 19 ? 'Z' : ''));
const COBERTURA_META = 14; // dias de estoque que vale ter de cada sabor
const LEAD_PARADO = 3;     // dias sem compra para o interessado do site contar como parado

function insightsInicio(db, produtos, vendas, mes) {
  const agora = Date.now();

  // 1. quantos dias o estoque de cada sabor aguenta, pelo ritmo de venda recente
  const primeiro = db.prepare("SELECT MIN(criado_em) AS d FROM pedidos WHERE status IN ('confirmado', 'entregue')").get().d;
  const janela = primeiro ? Math.min(30, Math.max(7, (agora - dataSql(primeiro)) / DIA)) : 30;
  const vendidos = new Map(vendas.map((v) => [v.id, v.unidades]));
  const cobertura = produtos.map((p) => {
    const porDia = (vendidos.get(p.id) || 0) / janela;
    const dias = porDia > 0 ? p.estoque / porDia : null;
    return {
      id: p.id, nome: p.nome, cor: p.cor, estoque: p.estoque,
      porDia: Math.round(porDia * 10) / 10,
      dias: dias === null ? null : Math.floor(dias),
      produzir: porDia > 0 ? Math.max(0, Math.ceil(porDia * COBERTURA_META - p.estoque)) : 0,
    };
  }).sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity));

  // 2. quem está devendo e há quanto tempo
  const devedores = db.prepare(`
    SELECT c.id, c.nome, c.estabelecimento, c.telefone, COUNT(*) AS pedidos,
           SUM(${TOTAL_PEDIDO} - ${RECEBIDO_PEDIDO}) AS total, MIN(COALESCE(p.entregue_em, p.criado_em)) AS desde
    FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
    WHERE p.status IN ('confirmado', 'entregue') AND p.pago = 0
    GROUP BY c.id ORDER BY desde`).all()
    .map((d) => ({ ...d, dias: Math.max(0, Math.floor((agora - dataSql(d.desde)) / DIA)) }))
    .filter((d) => d.total > 0);
  const faixas = [['ate7', 0, 7], ['ate15', 8, 15], ['mais15', 16, Infinity]].map(([chave, de, ate]) => {
    const f = devedores.filter((d) => d.dias >= de && d.dias <= ate);
    return { chave, total: f.reduce((s, d) => s + d.total, 0), clientes: f.length };
  });

  // 3. clientes sumidos: passaram bem do ritmo de compra e não pediram de novo
  const cfg = config(db);
  const sumidos = db.prepare("SELECT * FROM clientes WHERE status = 'ativo'").all().map((c) => {
    const prev = preverCliente(db, c, cfg, agora);
    if (prev.nivel === 'sem-pedidos') return null;
    const porDia = prev.porSemana / 7;
    const ciclo = Math.max(1, Math.round(porDia > 0 ? prev.ultimoUnidades / porDia : (c.ciclo_dias || cfg.ciclo)));
    const diasSem = Math.floor((agora - dataSql(prev.ultimoPedido)) / DIA);
    if (diasSem < Math.max(2 * ciclo, ciclo + 7)) return null;
    const msg = `Oi ${c.nome.split(' ')[0]}, tudo bem? Aqui é da King Gelo 👑 Faz um tempinho que não repomos o gelo do ${c.estabelecimento || 'seu ponto'}. Quer que a gente mande um pedido?`;
    return { id: c.id, nome: c.nome, estabelecimento: c.estabelecimento, cidade: c.cidade, diasSem, ciclo, whatsapp: linkWhats(c.telefone, msg) };
  }).filter(Boolean).sort((a, b) => b.diasSem / b.ciclo - a.diasSem / a.ciclo);

  // 4. comparação com o mês passado (até o mesmo dia) e projeção do mês
  const mesAnterior = db.prepare(`SELECT COALESCE(SUM(${TOTAL_PEDIDO}), 0) AS ate_hoje,
      (SELECT COALESCE(SUM(${TOTAL_PEDIDO}), 0) FROM pedidos p WHERE status IN ('confirmado', 'entregue')
         AND strftime('%Y-%m', criado_em) = strftime('%Y-%m', 'now', 'start of month', '-1 month')) AS total
    FROM pedidos p WHERE status IN ('confirmado', 'entregue')
      AND criado_em >= datetime('now', 'start of month', '-1 month') AND criado_em < datetime('now', '-1 month')`).get();
  const hoje = new Date(agora);
  const diaMes = hoje.getUTCDate();
  const diasNoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0)).getUTCDate();
  const comparacao = {
    anteriorAteHoje: mesAnterior.ate_hoje,
    anteriorTotal: mesAnterior.total,
    variacao: mesAnterior.ate_hoje > 0 ? Math.round((mes.total / mesAnterior.ate_hoje - 1) * 100) : null,
    // com poucos dias de venda a projeção fica exagerada
    projecao: diaMes >= 5 ? Math.round((mes.total / diaMes) * diasNoMes) : null,
  };

  // 5. interessados do site: conversão e quem está parado
  const site = db.prepare(`SELECT COUNT(*) AS total,
      SUM(EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = c.id AND p.status IN ('confirmado', 'entregue'))) AS compraram
    FROM clientes c WHERE origem = 'site' AND criado_em >= datetime('now', '-90 days')`).get();
  const parados = db.prepare(`SELECT id, nome, estabelecimento, cidade, telefone, volume_informado, criado_em FROM clientes
    WHERE status = 'lead' AND criado_em <= datetime('now', ?) ORDER BY criado_em`).all(`-${LEAD_PARADO} days`)
    .map((l) => ({ ...l, dias: Math.floor((agora - dataSql(l.criado_em)) / DIA),
      whatsapp: linkWhats(l.telefone, `Oi ${l.nome.split(' ')[0]}, tudo bem? Aqui é da King Gelo 👑 Vi seu cadastro no site para revender. Posso te mandar a tabela de atacado?`) }));

  return {
    cobertura, coberturaMeta: COBERTURA_META,
    receberFaixas: faixas, devedores: devedores.slice(0, 5), devedoresTotal: devedores.length,
    sumidos: { lista: sumidos.slice(0, 5), total: sumidos.length },
    comparacao,
    leadsSite: { total: site.total, compraram: site.compraram || 0, parados: parados.slice(0, 5), paradosTotal: parados.length, diasParado: LEAD_PARADO },
  };
}

const rotas = [
  ['GET', /^\/api\/eu$/, ({ usuario }) => ({ usuario: usuario.usuario, papel: usuario.papel })],
  // o painel pergunta de minuto em minuto: aparece aviso quando chega interessado novo pelo site
  ['GET', /^\/api\/novidades$/, ({ db }) => ({
    leads: db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE status = 'lead'").get().n,
    ultimoLead: db.prepare("SELECT id, nome, estabelecimento, cidade, unidade FROM clientes WHERE origem = 'site' ORDER BY id DESC LIMIT 1").get() || null,
  })],

  ['GET', /^\/api\/resumo$/, ({ db }) => {
    const produtos = db.prepare('SELECT id, slug, nome, cor, estoque, estoque_minimo FROM produtos WHERE ativo = 1 ORDER BY id').all();
    const mes = db.prepare(`SELECT COALESCE(SUM(${TOTAL_PEDIDO}), 0) AS total, COUNT(*) AS qtd FROM pedidos p
                            WHERE status IN ('confirmado', 'entregue') AND strftime('%Y-%m', criado_em) = strftime('%Y-%m', 'now')`).get();
    const receber = db.prepare(`SELECT COALESCE(SUM(${TOTAL_PEDIDO} - ${RECEBIDO_PEDIDO}), 0) AS total, COUNT(*) AS qtd FROM pedidos p
                                WHERE status IN ('confirmado', 'entregue') AND pago = 0`).get();
    const entregas = db.prepare(`SELECT p.id, p.status, p.entrega_em, c.nome AS cliente_nome, c.estabelecimento, c.cidade, ${UNIDADES_PEDIDO} AS unidades
                                 FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
                                 WHERE p.status IN ('novo', 'confirmado') AND p.entrega_em IS NOT NULL AND p.entrega_em <= ?
                                 ORDER BY p.entrega_em, c.cidade, p.id`).all(hojeLocal(1));
    const abertos = db.prepare("SELECT COUNT(*) AS n FROM pedidos WHERE status IN ('novo', 'confirmado')").get().n;
    const leads = db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE status = 'lead'").get().n;
    const vendas = db.prepare(`SELECT pr.id, pr.nome, pr.cor, COALESCE(SUM(i.quantidade), 0) AS unidades
                               FROM produtos pr LEFT JOIN itens_pedido i ON i.produto_id = pr.id
                               AND i.pedido_id IN (SELECT id FROM pedidos WHERE status IN ('confirmado', 'entregue') AND criado_em >= datetime('now', '-30 days'))
                               GROUP BY pr.id ORDER BY unidades DESC`).all();
    const ultimos = db.prepare(`SELECT p.id, p.status, p.pago, p.criado_em, p.entrega_em, c.nome AS cliente_nome, c.estabelecimento, ${TOTAL_PEDIDO} AS total, ${UNIDADES_PEDIDO} AS unidades, ${RECEBIDO_PEDIDO} AS recebido
                                FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ORDER BY p.id DESC LIMIT 6`).all();
    const cidades = db.prepare(`SELECT COALESCE(NULLIF(c.cidade, ''), 'Sem cidade') AS cidade, SUM(${UNIDADES_PEDIDO}) AS unidades, SUM(${TOTAL_PEDIDO}) AS total, COUNT(DISTINCT c.id) AS clientes
                                FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
                                WHERE p.status IN ('confirmado', 'entregue') AND p.criado_em >= datetime('now', '-30 days')
                                GROUP BY 1 ORDER BY total DESC`).all();
    const insights = insightsInicio(db, produtos, vendas, mes);
    const avisos = listaAvisos(db);
    // quem já está em "clientes sumidos" não se repete em "avisar agora"
    const sumidosIds = new Set(insights.sumidos.lista.map((c) => c.id));
    return {
      ...insights,
      cidades,
      porUnidade: porUnidade(db, 30),
      estoqueTotal: produtos.reduce((s, p) => s + p.estoque, 0),
      estoqueBaixo: produtos.filter((p) => p.estoque <= p.estoque_minimo),
      produtos, mes, receber, abertos, leads, vendas, ultimos, entregas, hoje: hojeLocal(),
      avisos: avisos.filter((c) => !sumidosIds.has(c.id)).slice(0, 5), avisosTotal: avisos.length,
    };
  }],

  // ---------- produtos e estoque ----------
  ['GET', /^\/api\/produtos$/, ({ db }) => db.prepare('SELECT * FROM produtos ORDER BY ativo DESC, id').all().map((p) => ({ ...p, foto: temFoto(p.slug) }))],
  // produto novo (gelo comum, sabor novo): começa com estoque zero; a entrada é lançada depois
  ['POST', /^\/api\/produtos$/, ({ db, corpo }) => {
    const nome = txt(corpo.nome, 40);
    if (!nome) throw erro(400, 'Informe o nome do produto');
    if (db.prepare('SELECT 1 FROM produtos WHERE lower(nome) = lower(?)').get(nome)) throw erro(409, 'Já existe um produto com esse nome');
    let slug = slugDe(nome), n = 2;
    while (db.prepare('SELECT 1 FROM produtos WHERE slug = ?').get(slug)) slug = `${slugDe(nome)}-${n++}`;
    const cor = /^#[0-9a-f]{6}$/i.test(corpo.cor || '') ? corpo.cor : '#1aa3ef';
    const r = db.prepare('INSERT INTO produtos (slug, nome, cor, preco_atacado, preco_varejo, estoque_minimo) VALUES (?, ?, ?, ?, ?, ?)').run(
      slug, nome, cor, inteiro(corpo.preco_atacado ?? 0), inteiro(corpo.preco_varejo ?? 0), inteiro(corpo.estoque_minimo ?? 50));
    return { http: 201, corpo: db.prepare('SELECT * FROM produtos WHERE id = ?').get(r.lastInsertRowid) };
  }, 'dono'],
  ['PUT', /^\/api\/produtos\/(\d+)$/, ({ db, params, corpo }) => {
    const p = db.prepare('SELECT * FROM produtos WHERE id = ?').get(+params[0]);
    if (!p) throw erro(404, 'Produto não encontrado');
    const nome = corpo.nome != null ? txt(corpo.nome, 40) : p.nome;
    if (!nome) throw erro(400, 'Informe o nome do produto');
    if (db.prepare('SELECT 1 FROM produtos WHERE lower(nome) = lower(?) AND id != ?').get(nome, p.id)) throw erro(409, 'Já existe um produto com esse nome');
    db.prepare('UPDATE produtos SET nome = ?, cor = ?, preco_atacado = ?, preco_varejo = ?, estoque_minimo = ?, ativo = ? WHERE id = ?').run(
      nome, /^#[0-9a-f]{6}$/i.test(corpo.cor || '') ? corpo.cor : p.cor,
      corpo.preco_atacado != null ? inteiro(corpo.preco_atacado) : p.preco_atacado,
      corpo.preco_varejo != null ? inteiro(corpo.preco_varejo) : p.preco_varejo,
      corpo.estoque_minimo != null ? inteiro(corpo.estoque_minimo) : p.estoque_minimo,
      corpo.ativo != null ? (corpo.ativo ? 1 : 0) : p.ativo, p.id);
    return db.prepare('SELECT * FROM produtos WHERE id = ?').get(p.id);
  }, 'dono'],
  ['POST', /^\/api\/produtos\/(\d+)\/movimento$/, ({ db, params, corpo }) => transacao(db, () => {
    const p = db.prepare('SELECT * FROM produtos WHERE id = ?').get(+params[0]);
    if (!p) throw erro(404, 'Produto não encontrado');
    const motivo = txt(corpo.motivo, 120);
    if (corpo.tipo === 'entrada') {
      movimentar(db, p.id, 'entrada', inteiro(corpo.quantidade, 1), motivo || 'Produção / entrada');
    } else if (corpo.tipo === 'ajuste') {
      const novo = inteiro(corpo.quantidade, 0);
      if (novo !== p.estoque) movimentar(db, p.id, 'ajuste', novo - p.estoque, motivo || 'Contagem do estoque');
    } else throw erro(400, 'Tipo de movimento inválido');
    return db.prepare('SELECT * FROM produtos WHERE id = ?').get(p.id);
  })],
  ['GET', /^\/api\/movimentos$/, ({ db, query }) => {
    const prod = query.get('produto');
    return db.prepare(`SELECT m.*, pr.nome FROM movimentos m JOIN produtos pr ON pr.id = m.produto_id
                       ${prod ? 'WHERE m.produto_id = ?' : ''} ORDER BY m.id DESC LIMIT 100`).all(...(prod ? [+prod] : []));
  }],

  // ---------- clientes ----------
  ['GET', /^\/api\/clientes$/, ({ db, query }) => {
    const busca = `%${txt(query.get('busca'), 60)}%`;
    const status = query.get('status');
    const unidade = unidadeValida(query.get('unidade'), null);
    const cfg = config(db);
    return db.prepare(`SELECT * FROM clientes WHERE (nome LIKE ? OR estabelecimento LIKE ? OR cidade LIKE ? OR telefone LIKE ?)
                       ${status ? 'AND status = ?' : ''} ${unidade ? 'AND unidade = ?' : ''} ORDER BY status = 'lead' DESC, nome`)
      .all(busca, busca, busca, busca, ...(status ? [status] : []), ...(unidade ? [unidade] : []))
      .map((c) => clienteComPrevisao(db, c, cfg));
  }],
  ['POST', /^\/api\/clientes$/, ({ db, corpo }) => {
    if (!txt(corpo.nome)) throw erro(400, 'Informe o nome');
    const r = db.prepare(`INSERT INTO clientes (nome, estabelecimento, tipo, cidade, telefone, observacoes, status, ciclo_dias, unidade)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      txt(corpo.nome, 80), txt(corpo.estabelecimento, 120), txt(corpo.tipo, 40) || 'Casa de bebidas', txt(corpo.cidade, 80),
      fone(corpo.telefone), txt(corpo.observacoes, 1000), ['lead', 'ativo', 'inativo'].includes(corpo.status) ? corpo.status : 'ativo',
      corpo.ciclo_dias ? inteiro(corpo.ciclo_dias, 1) : null, unidadeValida(corpo.unidade));
    return { http: 201, corpo: db.prepare('SELECT * FROM clientes WHERE id = ?').get(r.lastInsertRowid) };
  }],
  ['GET', /^\/api\/clientes\/(\d+)$/, ({ db, params }) => {
    const c = db.prepare('SELECT * FROM clientes WHERE id = ?').get(+params[0]);
    if (!c) throw erro(404, 'Cliente não encontrado');
    const cfg = config(db);
    const prev = preverCliente(db, c, cfg);
    const msg = prev.nivel === 'sem-pedidos' ? '' : mensagemAviso(cfg, c, prev);
    c.previsao = prev;
    c.whatsapp = linkWhats(c.telefone, msg || `Oi ${c.nome.split(' ')[0]}! Aqui é da King Gelo 👑`);
    c.pedidos = db.prepare(`SELECT p.id, p.status, p.pago, p.criado_em, p.entrega_em, ${TOTAL_PEDIDO} AS total, ${UNIDADES_PEDIDO} AS unidades, ${RECEBIDO_PEDIDO} AS recebido
                            FROM pedidos p WHERE cliente_id = ? ORDER BY p.id DESC`).all(c.id);
    return c;
  }],
  ['PUT', /^\/api\/clientes\/(\d+)$/, ({ db, params, corpo }) => {
    const c = db.prepare('SELECT * FROM clientes WHERE id = ?').get(+params[0]);
    if (!c) throw erro(404, 'Cliente não encontrado');
    const v = { ...c, ...corpo };
    db.prepare(`UPDATE clientes SET nome = ?, estabelecimento = ?, tipo = ?, cidade = ?, telefone = ?, observacoes = ?, status = ?, ciclo_dias = ?, unidade = ? WHERE id = ?`).run(
      txt(v.nome, 80) || c.nome, txt(v.estabelecimento, 120), txt(v.tipo, 40), txt(v.cidade, 80), fone(v.telefone), txt(v.observacoes, 1000),
      ['lead', 'ativo', 'inativo'].includes(v.status) ? v.status : c.status, v.ciclo_dias ? inteiro(v.ciclo_dias, 1) : null, unidadeValida(v.unidade, c.unidade), c.id);
    return db.prepare('SELECT * FROM clientes WHERE id = ?').get(c.id);
  }],
  ['DELETE', /^\/api\/clientes\/(\d+)$/, ({ db, params }) => {
    const id = +params[0];
    if (db.prepare('SELECT COUNT(*) AS n FROM pedidos WHERE cliente_id = ?').get(id).n) throw erro(409, 'Cliente tem pedidos: marque como inativo em vez de apagar');
    db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
    return { ok: true };
  }, 'dono'],

  // ---------- pedidos ----------
  ['GET', /^\/api\/pedidos$/, ({ db, query }) => {
    const filtros = [], args = [];
    if (query.get('status')) { filtros.push('p.status = ?'); args.push(query.get('status')); }
    if (query.get('cliente')) { filtros.push('p.cliente_id = ?'); args.push(+query.get('cliente')); }
    if (query.get('pago') === '0') filtros.push("p.pago = 0 AND p.status != 'cancelado'");
    const unidade = unidadeValida(query.get('unidade'), null);
    if (unidade) { filtros.push('c.unidade = ?'); args.push(unidade); }
    // a entregar: ainda não entregues, pelo dia marcado (sem data vão para o fim) e pela cidade
    const entregar = query.get('entregar') === '1';
    if (entregar) filtros.push("p.status IN ('novo', 'confirmado')");
    return db.prepare(`SELECT p.*, c.nome AS cliente_nome, c.estabelecimento, c.telefone, c.cidade, c.unidade, ${TOTAL_PEDIDO} AS total, ${UNIDADES_PEDIDO} AS unidades,
                              ${RECEBIDO_PEDIDO} AS recebido
                       FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''}
                       ORDER BY ${entregar ? 'p.entrega_em IS NULL, p.entrega_em, c.cidade, p.id' : 'p.id DESC'} LIMIT 200`).all(...args);
  }],
  ['GET', /^\/api\/pedidos\/(\d+)$/, ({ db, params }) => pedidoCompleto(db, +params[0])],
  ['POST', /^\/api\/pedidos$/, ({ db, corpo, usuario }) => transacao(db, () => {
    const dono = usuario.papel === 'dono';
    const c = db.prepare('SELECT * FROM clientes WHERE id = ?').get(+corpo.cliente_id);
    if (!c) throw erro(400, 'Escolha o cliente');
    const itens = (corpo.itens || []).filter((i) => +i.quantidade > 0);
    if (!itens.length) throw erro(400, 'Adicione pelo menos um sabor');
    const status = ['novo', 'confirmado', 'entregue'].includes(corpo.status) ? corpo.status : 'novo';
    const forma = FORMAS.includes(corpo.pagamento) ? corpo.pagamento : 'pix';
    const r = db.prepare('INSERT INTO pedidos (cliente_id, status, pagamento, pago, observacoes, entregue_em, entrega_em) VALUES (?, ?, ?, 0, ?, ?, ?)').run(
      c.id, status, forma, txt(corpo.observacoes, 1000), status === 'entregue' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
      dataValida(corpo.entrega_em));
    const id = Number(r.lastInsertRowid);
    gravarItens(db, id, itens, dono);
    if (status !== 'novo') darBaixa(db, id);
    // "já está pago": entra um pagamento do total (a equipe não mexe em dinheiro)
    if (dono && corpo.pago) {
      const t = db.prepare(`SELECT ${TOTAL_PEDIDO} AS total FROM pedidos p WHERE p.id = ?`).get(id).total;
      if (t > 0) receber(db, id, t, forma, hojeLocal());
    }
    // quem compra deixa de ser lead
    if (c.status === 'lead') db.prepare("UPDATE clientes SET status = 'ativo' WHERE id = ?").run(c.id);
    return { http: 201, corpo: pedidoCompleto(db, id) };
  })],
  ['PUT', /^\/api\/pedidos\/(\d+)\/status$/, ({ db, params, corpo }) => transacao(db, () => {
    const p = pedidoCompleto(db, +params[0]);
    const novo = corpo.status;
    if (!['novo', 'confirmado', 'entregue', 'cancelado'].includes(novo)) throw erro(400, 'Status inválido');
    if (p.status === 'cancelado') throw erro(409, 'Pedido cancelado não pode mudar de status');
    if (novo === 'cancelado' && p.baixado) estornar(db, p.id);
    if ((novo === 'confirmado' || novo === 'entregue') && !p.baixado) darBaixa(db, p.id);
    if (novo === 'novo' && p.baixado) estornar(db, p.id);
    db.prepare('UPDATE pedidos SET status = ?, entregue_em = ? WHERE id = ?').run(
      novo, novo === 'entregue' ? (p.entregue_em || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null, p.id);
    return pedidoCompleto(db, p.id);
  })],
  ['PUT', /^\/api\/pedidos\/(\d+)$/, ({ db, params, corpo, usuario }) => transacao(db, () => {
    const p = pedidoCompleto(db, +params[0]);
    const forma = FORMAS.includes(corpo.pagamento) ? corpo.pagamento : p.pagamento;
    db.prepare('UPDATE pedidos SET pagamento = ?, observacoes = ?, entrega_em = ? WHERE id = ?').run(
      forma, txt(corpo.observacoes ?? p.observacoes, 1000), corpo.entrega_em !== undefined ? dataValida(corpo.entrega_em) : p.entrega_em, p.id);
    // botão "marcar como pago": recebe o que falta; "desmarcar": apaga os pagamentos
    if (corpo.pago != null) {
      if (usuario.papel !== 'dono') throw erro(403, 'Só o dono mexe em pagamentos');
      if (corpo.pago && p.saldo > 0) receber(db, p.id, p.saldo, forma, hojeLocal());
      if (!corpo.pago) { db.prepare('DELETE FROM pagamentos WHERE pedido_id = ?').run(p.id); sincronizarPago(db, p.id); }
    }
    return pedidoCompleto(db, p.id);
  })],
  // corrigir sabores e quantidades: devolve ao estoque o que tinha saído e tira de novo com os itens corrigidos
  ['PUT', /^\/api\/pedidos\/(\d+)\/itens$/, ({ db, params, corpo, usuario }) => transacao(db, () => {
    const p = pedidoCompleto(db, +params[0]);
    if (p.status === 'cancelado') throw erro(409, 'Pedido cancelado não pode ser alterado');
    const itens = (corpo.itens || []).filter((i) => +i.quantidade > 0);
    if (!itens.length) throw erro(400, 'O pedido precisa de pelo menos um sabor');
    const baixado = p.baixado;
    if (baixado) estornar(db, p.id, `Pedido #${p.id} corrigido (volta)`);
    db.prepare('DELETE FROM itens_pedido WHERE pedido_id = ?').run(p.id);
    // a equipe não define preço: cada sabor mantém o preço que já tinha no pedido (ou o de atacado, se for novo)
    const antes = new Map(p.itens.map((i) => [i.produto_id, i.preco_unit]));
    const dono = usuario.papel === 'dono';
    gravarItens(db, p.id, itens.map((i) => ({ ...i, preco_unit: dono ? i.preco_unit : antes.get(+i.produto_id) ?? null })), true);
    if (baixado) darBaixa(db, p.id);
    const novo = pedidoCompleto(db, p.id);
    if (novo.recebido > novo.total) throw erro(409, `Já foi recebido R$ ${(novo.recebido / 100).toFixed(2).replace('.', ',')}: o total não pode ficar menor que isso. Apague um pagamento antes.`);
    sincronizarPago(db, p.id);
    return pedidoCompleto(db, p.id);
  })],
  ['POST', /^\/api\/pedidos\/(\d+)\/pagamentos$/, ({ db, params, corpo }) => transacao(db, () => {
    const p = pedidoCompleto(db, +params[0]);
    if (p.status === 'cancelado') throw erro(409, 'Pedido cancelado');
    const valor = inteiro(corpo.valor, 1);
    if (valor > p.saldo) throw erro(400, `Falta receber só R$ ${(p.saldo / 100).toFixed(2).replace('.', ',')}`);
    receber(db, p.id, valor, corpo.forma, corpo.recebido_em, corpo.observacao);
    return pedidoCompleto(db, p.id);
  }), 'dono'],
  ['DELETE', /^\/api\/pagamentos\/(\d+)$/, ({ db, params }) => {
    const g = db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(+params[0]);
    if (!g) throw erro(404, 'Pagamento não encontrado');
    db.prepare('DELETE FROM pagamentos WHERE id = ?').run(g.id);
    sincronizarPago(db, g.pedido_id);
    return pedidoCompleto(db, g.pedido_id);
  }, 'dono'],

  // ---------- avisos de reposição ----------
  ['GET', /^\/api\/avisos$/, ({ db }) => listaAvisos(db)],
  ['POST', /^\/api\/avisos$/, ({ db, corpo }) => {
    const c = db.prepare('SELECT id FROM clientes WHERE id = ?').get(+corpo.cliente_id);
    if (!c) throw erro(404, 'Cliente não encontrado');
    if (corpo.tipo === 'adiado') {
      const ate = new Date(Date.now() + inteiro(corpo.dias || 3, 1) * 86400000).toISOString();
      db.prepare("INSERT INTO avisos (cliente_id, tipo, ate) VALUES (?, 'adiado', ?)").run(c.id, ate);
    } else {
      db.prepare("INSERT INTO avisos (cliente_id, tipo) VALUES (?, 'whatsapp')").run(c.id);
    }
    return { ok: true };
  }],

  // ---------- configurações ----------
  ['GET', /^\/api\/config$/, ({ db }) => Object.fromEntries(db.prepare('SELECT chave, valor FROM config').all().map((r) => [r.chave, r.valor]))],
  ['PUT', /^\/api\/config$/, ({ db, corpo }) => {
    const permitidas = ['ciclo_padrao_dias', 'limite_acabando', 'limite_atencao', 'mensagem_aviso'];
    const up = db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor');
    for (const k of permitidas) if (corpo[k] != null) up.run(k, txt(corpo[k], 1000));
    return { ok: true };
  }, 'dono'],
  ['PUT', /^\/api\/senha$/, ({ db, corpo, usuario, hashSenha, conferirSenha }) => {
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuario.id);
    if (!conferirSenha(String(corpo.atual || ''), u.senha_hash)) throw erro(400, 'Senha atual incorreta');
    if (String(corpo.nova || '').length < 8) throw erro(400, 'A nova senha precisa ter pelo menos 8 caracteres');
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(String(corpo.nova)), u.id);
    // senha trocada: derruba as outras sessões (se alguém tinha entrado com a senha antiga, sai agora)
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND token_hash != ?').run(u.id, usuario.token_hash);
    return { ok: true };
  }],

  // ---------- unidades: o que cada uma está atendendo ----------
  ['GET', /^\/api\/unidades$/, ({ db, query }) => {
    const dias = [7, 30, 90].includes(+query.get('dias')) ? +query.get('dias') : 30;
    const ultimos = db.prepare('SELECT id, unidade, origem, detalhe, criado_em FROM contatos_site ORDER BY id DESC LIMIT 30').all();
    const interessados = db.prepare(`SELECT id, nome, estabelecimento, cidade, unidade, criado_em FROM clientes
                                     WHERE status = 'lead' ORDER BY id DESC LIMIT 12`).all();
    return { dias, lista: porUnidade(db, dias), ultimos, interessados };
  }],

  // ---------- financeiro: vendas, recebido, despesas e lucro do mês ----------
  ['GET', /^\/api\/financeiro$/, ({ db, query }) => {
    const mes = /^\d{4}-\d{2}$/.test(query.get('mes') || '') ? query.get('mes') : hojeLocal().slice(0, 7);
    // pedidos são gravados em UTC: -3 horas para cair no mês certo do Pará
    const vendidoNo = db.prepare(`SELECT COALESCE(SUM(${TOTAL_PEDIDO}), 0) AS total, COUNT(*) AS pedidos, COALESCE(SUM(${UNIDADES_PEDIDO}), 0) AS unidades
                                  FROM pedidos p WHERE status IN ('confirmado', 'entregue') AND strftime('%Y-%m', criado_em, '-3 hours') = ?`);
    const gastoNo = db.prepare('SELECT COALESCE(SUM(valor), 0) AS t FROM despesas WHERE substr(data, 1, 7) = ?');
    const vendido = vendidoNo.get(mes);
    const recebido = db.prepare('SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE substr(recebido_em, 1, 7) = ?').get(mes).total;
    const despesas = db.prepare('SELECT * FROM despesas WHERE substr(data, 1, 7) = ? ORDER BY data DESC, id DESC').all(mes);
    const gasto = despesas.reduce((s, d) => s + d.valor, 0);
    const porCategoria = CATEGORIAS.map((c) => ({ categoria: c, total: despesas.filter((d) => d.categoria === c).reduce((s, d) => s + d.valor, 0) })).filter((c) => c.total);
    // os últimos 6 meses, para comparar
    const meses = [];
    const [a, m] = mes.split('-').map(Number);
    for (let k = 5; k >= 0; k--) {
      const chave = new Date(Date.UTC(a, m - 1 - k, 1)).toISOString().slice(0, 7);
      const v = vendidoNo.get(chave).total, g = gastoNo.get(chave).t;
      meses.push({ mes: chave, vendido: v, gasto: g, lucro: v - g });
    }
    return { mes, vendido, recebido, despesas, gasto, porCategoria, lucro: vendido.total - gasto, caixa: recebido - gasto,
      custoPorSaquinho: vendido.unidades && gasto ? Math.round(gasto / vendido.unidades) : null, categorias: CATEGORIAS, meses, hoje: hojeLocal() };
  }, 'dono'],
  ['POST', /^\/api\/despesas$/, ({ db, corpo }) => {
    const descricao = txt(corpo.descricao, 120);
    if (!descricao) throw erro(400, 'Descreva a despesa');
    const r = db.prepare('INSERT INTO despesas (descricao, categoria, valor, data) VALUES (?, ?, ?, ?)').run(
      descricao, CATEGORIAS.includes(corpo.categoria) ? corpo.categoria : 'Outros', inteiro(corpo.valor, 1), dataValida(corpo.data) || hojeLocal());
    return { http: 201, corpo: db.prepare('SELECT * FROM despesas WHERE id = ?').get(r.lastInsertRowid) };
  }, 'dono'],
  ['DELETE', /^\/api\/despesas\/(\d+)$/, ({ db, params }) => {
    if (!db.prepare('DELETE FROM despesas WHERE id = ?').run(+params[0]).changes) throw erro(404, 'Despesa não encontrada');
    return { ok: true };
  }, 'dono'],

  // ---------- acessos: o dono cria logins para a equipe (sem acesso a dinheiro) ----------
  ['GET', /^\/api\/usuarios$/, ({ db }) => db.prepare("SELECT id, usuario, papel, criado_em FROM usuarios ORDER BY papel = 'dono' DESC, usuario").all(), 'dono'],
  ['POST', /^\/api\/usuarios$/, ({ db, corpo, hashSenha }) => {
    const usuario = txt(corpo.usuario, 30).toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw erro(400, 'Usuário: de 3 a 30 letras, números, ponto ou traço, sem espaço');
    if (String(corpo.senha || '').length < 8) throw erro(400, 'A senha precisa ter pelo menos 8 caracteres');
    if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuario)) throw erro(409, 'Esse usuário já existe');
    const papel = corpo.papel === 'dono' ? 'dono' : 'equipe';
    const r = db.prepare('INSERT INTO usuarios (usuario, senha_hash, papel) VALUES (?, ?, ?)').run(usuario, hashSenha(String(corpo.senha)), papel);
    return { http: 201, corpo: { id: Number(r.lastInsertRowid), usuario, papel } };
  }, 'dono'],
  ['PUT', /^\/api\/usuarios\/(\d+)$/, ({ db, params, corpo, usuario, hashSenha }) => {
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(+params[0]);
    if (!u) throw erro(404, 'Usuário não encontrado');
    if (corpo.papel && corpo.papel !== u.papel) {
      if (u.id === usuario.id) throw erro(400, 'Você não pode mudar o seu próprio acesso');
      db.prepare('UPDATE usuarios SET papel = ? WHERE id = ?').run(corpo.papel === 'dono' ? 'dono' : 'equipe', u.id);
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(u.id);
    }
    if (corpo.senha) {
      if (String(corpo.senha).length < 8) throw erro(400, 'A senha precisa ter pelo menos 8 caracteres');
      db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(String(corpo.senha)), u.id);
      if (u.id !== usuario.id) db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(u.id);
    }
    return { ok: true };
  }, 'dono'],
  ['DELETE', /^\/api\/usuarios\/(\d+)$/, ({ db, params, usuario }) => {
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(+params[0]);
    if (!u) throw erro(404, 'Usuário não encontrado');
    if (u.id === usuario.id) throw erro(400, 'Você não pode apagar o seu próprio acesso');
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(u.id);
    return { ok: true };
  }, 'dono'],

  // ---------- backups automáticos (um por dia, guardados no servidor) ----------
  ['GET', /^\/api\/backups$/, ({ db }) => ({
    lista: backup.listar(), guarda: backup.GUARDA,
    ultimo: db.prepare("SELECT valor FROM config WHERE chave = 'ultimo_backup_auto'").get()?.valor || null,
  }), 'dono'],
];

// a equipe não vê dinheiro: os valores saem da resposta antes de ir para o navegador
const CAMPOS_DINHEIRO = new Set(['total', 'preco_unit', 'preco_atacado', 'preco_varejo', 'recebido', 'saldo', 'valor', 'projecao',
  'anteriorAteHoje', 'anteriorTotal', 'variacao', 'pagamentos', 'receber', 'receberFaixas', 'devedores', 'devedoresTotal', 'comparacao', 'mes', 'cidades']);
// "total" nessas chaves e uma contagem (de pessoas), nao dinheiro
const CONTAGENS = new Set(['leadsSite', 'sumidos']);
function semDinheiro(v, pai = '') {
  if (Array.isArray(v)) return v.map((x) => semDinheiro(x, pai));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v)
      .filter(([k]) => !CAMPOS_DINHEIRO.has(k) || (k === 'total' && CONTAGENS.has(pai)))
      .map(([k, x]) => [k, semDinheiro(x, k)]));
  }
  return v;
}

module.exports = { rotas, semDinheiro };
