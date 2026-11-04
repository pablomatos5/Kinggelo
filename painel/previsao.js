'use strict';
// Previsão de estoque do cliente: pelo ritmo dos pedidos anteriores, estima quanto do último
// pedido ainda resta no ponto de venda e quando vale avisar para repor.

const DIA = 86400000;

function config(db) {
  const c = Object.fromEntries(db.prepare('SELECT chave, valor FROM config').all().map((r) => [r.chave, r.valor]));
  return {
    ciclo: Math.max(1, +c.ciclo_padrao_dias || 7),
    acabando: (+c.limite_acabando || 25) / 100,
    atencao: (+c.limite_atencao || 50) / 100,
    mensagem: c.mensagem_aviso || '',
  };
}

const data = (s) => new Date(s.replace(' ', 'T') + (s.length <= 19 ? 'Z' : ''));

function preverCliente(db, cliente, cfg = config(db), agora = Date.now()) {
  // conta só o que realmente saiu para o cliente
  const pedidos = db.prepare(`
    SELECT p.id, COALESCE(p.entregue_em, p.criado_em) AS quando,
           (SELECT SUM(quantidade) FROM itens_pedido WHERE pedido_id = p.id) AS unidades
    FROM pedidos p
    WHERE p.cliente_id = ? AND p.status IN ('confirmado', 'entregue')
    ORDER BY quando`).all(cliente.id);
  if (!pedidos.length) return { nivel: 'sem-pedidos', pedidos: 0 };

  const ultimo = pedidos[pedidos.length - 1];
  const diasDesde = Math.max(0, (agora - data(ultimo.quando)) / DIA);
  let porDia;
  if (pedidos.length >= 2) {
    // tudo o que comprou antes do último pedido foi consumido no intervalo entre o primeiro e o último
    const dias = Math.max(1, (data(ultimo.quando) - data(pedidos[0].quando)) / DIA);
    const consumido = pedidos.slice(0, -1).reduce((s, p) => s + p.unidades, 0);
    porDia = consumido / dias;
  } else {
    porDia = ultimo.unidades / (cliente.ciclo_dias || cfg.ciclo);
  }
  const restante = Math.max(0, ultimo.unidades - porDia * diasDesde);
  const fracao = ultimo.unidades ? restante / ultimo.unidades : 0;
  const diasRestantes = porDia > 0 ? restante / porDia : null;
  const nivel = fracao <= cfg.acabando ? 'acabando' : fracao <= cfg.atencao ? 'atencao' : 'ok';

  // sugestão de reposição: média dos sabores pedidos nos últimos 3 pedidos
  const ids = pedidos.slice(-3).map((p) => p.id);
  const sabores = db.prepare(`
    SELECT pr.nome, ROUND(SUM(i.quantidade) * 1.0 / ?) AS qtd
    FROM itens_pedido i JOIN produtos pr ON pr.id = i.produto_id
    WHERE i.pedido_id IN (${ids.map(() => '?').join(',')})
    GROUP BY pr.id ORDER BY qtd DESC`).all(ids.length, ...ids);

  const aviso = db.prepare('SELECT tipo, ate, criado_em FROM avisos WHERE cliente_id = ? ORDER BY id DESC LIMIT 1').get(cliente.id);
  const avisadoDepois = aviso && data(aviso.criado_em) > data(ultimo.quando);
  const adiado = aviso && aviso.tipo === 'adiado' && aviso.ate && data(aviso.ate) > agora;

  return {
    nivel,
    pedidos: pedidos.length,
    ultimoPedido: ultimo.quando,
    ultimoUnidades: ultimo.unidades,
    porSemana: Math.round(porDia * 7),
    restante: Math.round(restante),
    fracao: Math.round(fracao * 100),
    diasRestantes: diasRestantes === null ? null : Math.round(diasRestantes),
    sugestao: sabores.filter((s) => s.qtd > 0).map((s) => `${s.qtd} ${s.nome}`).join(', '),
    avisadoEm: avisadoDepois && aviso.tipo === 'whatsapp' ? aviso.criado_em : null,
    adiadoAte: adiado ? aviso.ate : null,
  };
}

function mensagemAviso(cfg, cliente, prev) {
  return cfg.mensagem
    .replaceAll('{nome}', cliente.nome.split(' ')[0])
    .replaceAll('{estabelecimento}', cliente.estabelecimento || 'sua loja')
    .replaceAll('{sugestao}', prev.sugestao || 'o mesmo do último pedido');
}

module.exports = { preverCliente, mensagemAviso, config };
