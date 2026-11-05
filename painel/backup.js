'use strict';
// Backup automático: uma cópia do banco por dia, na pasta "backups" ao lado do banco (no servidor, dentro do volume
// /dados). Guarda os últimos GUARDA dias. Protege contra erro de uso e arquivo corrompido; contra perder a VPS inteira,
// o dono ainda baixa o backup de vez em quando (Ajustes) e guarda fora dela.
const fs = require('node:fs');
const path = require('node:path');
const { caminhoBanco } = require('./banco');

const GUARDA = 14;
const NOME = /^kinggelo-\d{4}-\d{2}-\d{2}\.db$/;
const pasta = () => path.join(path.dirname(caminhoBanco()), 'backups');
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Belem' });

function listar() {
  try {
    return fs.readdirSync(pasta()).filter((n) => NOME.test(n)).sort().reverse()
      .map((n) => ({ nome: n, dia: n.slice(9, 19), tamanho: fs.statSync(path.join(pasta(), n)).size }));
  } catch { return []; }
}

// faz o backup do dia (se ainda não existe) e apaga os mais antigos que GUARDA
function fazer(db) {
  const dir = pasta();
  fs.mkdirSync(dir, { recursive: true });
  const nome = `kinggelo-${hoje()}.db`;
  const destino = path.join(dir, nome);
  if (!fs.existsSync(destino)) {
    const tmp = destino + '.parcial';
    try { fs.rmSync(tmp, { force: true }); } catch {}
    // VACUUM INTO copia o banco inteiro e consistente, mesmo com o servidor gravando
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    fs.renameSync(tmp, destino);
    db.prepare("INSERT INTO config (chave, valor) VALUES ('ultimo_backup_auto', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")
      .run(new Date().toISOString());
  }
  for (const b of listar().slice(GUARDA)) fs.rmSync(path.join(dir, b.nome), { force: true });
  return nome;
}

// confere ao ligar o servidor e depois a cada 3 horas (o arquivo do dia só é criado uma vez)
function agendar(db) {
  const rodar = () => { try { fazer(db); } catch (e) { console.error('Backup automático falhou:', e.message); } };
  setTimeout(rodar, 30000).unref();
  setInterval(rodar, 3 * 3600000).unref();
}

const arquivo = (nome) => (NOME.test(nome) ? path.join(pasta(), nome) : null);

module.exports = { fazer, agendar, listar, arquivo, GUARDA };
