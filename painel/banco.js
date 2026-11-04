'use strict';
// Banco SQLite embutido no Node (node:sqlite): sem dependências externas.
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const SABORES = [
  ['melancia', 'Melancia', '#16171c'],
  ['morango', 'Morango', '#d81f2a'],
  ['laranja', 'Laranja', '#ff6a00'],
  ['limao', 'Limão', '#1f9a3a'],
  ['maracuja', 'Maracujá', '#ffa800'],
  ['coco', 'Água de Coco', '#1597e0'],
  ['macaverde', 'Maçã Verde', '#6fbf2e'],
  ['frutas', 'Frutas Vermelhas', '#6a2c91'],
];

function abrirBanco(arquivo = process.env.KG_BANCO || path.join(__dirname, 'dados', 'kinggelo.db')) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY,
      usuario TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      cor TEXT NOT NULL,
      preco_atacado INTEGER NOT NULL DEFAULT 0,   -- centavos
      preco_varejo INTEGER NOT NULL DEFAULT 400,  -- centavos
      estoque INTEGER NOT NULL DEFAULT 0,
      estoque_minimo INTEGER NOT NULL DEFAULT 50,
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      estabelecimento TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL DEFAULT 'Casa de bebidas',
      cidade TEXT NOT NULL DEFAULT '',
      telefone TEXT NOT NULL DEFAULT '',
      observacoes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('lead', 'ativo', 'inativo')),
      origem TEXT NOT NULL DEFAULT 'painel',
      volume_informado TEXT NOT NULL DEFAULT '',
      ciclo_dias INTEGER,                         -- ritmo de reposição informado (opcional)
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'confirmado', 'entregue', 'cancelado')),
      pagamento TEXT NOT NULL DEFAULT 'pix',
      pago INTEGER NOT NULL DEFAULT 0,
      baixado INTEGER NOT NULL DEFAULT 0,         -- já saiu do estoque?
      observacoes TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      entregue_em TEXT
    );
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id INTEGER PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      quantidade INTEGER NOT NULL CHECK (quantidade > 0),
      preco_unit INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS movimentos (
      id INTEGER PRIMARY KEY,
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'estorno')),
      quantidade INTEGER NOT NULL,                -- com sinal
      motivo TEXT NOT NULL DEFAULT '',
      pedido_id INTEGER REFERENCES pedidos(id),
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS avisos (
      id INTEGER PRIMARY KEY,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL DEFAULT 'whatsapp',      -- whatsapp | adiado
      ate TEXT,                                   -- adiado até esta data
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id, criado_em);
    CREATE INDEX IF NOT EXISTS idx_itens_pedido ON itens_pedido(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_mov_produto ON movimentos(produto_id, criado_em);
  `);

  const inserir = db.prepare('INSERT OR IGNORE INTO produtos (slug, nome, cor) VALUES (?, ?, ?)');
  for (const [slug, nome, cor] of SABORES) inserir.run(slug, nome, cor);

  const padrao = db.prepare('INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)');
  padrao.run('ciclo_padrao_dias', '7');
  padrao.run('limite_acabando', '25');
  padrao.run('limite_atencao', '50');
  padrao.run('mensagem_aviso',
    'Oi {nome}! Aqui é da King Gelo 👑 Pelas nossas contas o gelo saborizado aí na {estabelecimento} já deve estar acabando. ' +
    'Quer que a gente separe a reposição? Sugestão: {sugestao}.');
  return db;
}

// transação simples (node:sqlite não tem db.transaction)
function transacao(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { abrirBanco, transacao, SABORES };
