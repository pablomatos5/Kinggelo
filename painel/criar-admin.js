'use strict';
// Cria ou troca a senha do dono: node criar-admin.js <usuario>   (a senha é pedida no terminal)
const readline = require('node:readline');
const { abrirBanco } = require('./banco');

const usuario = String(process.argv[2] || '').trim().toLowerCase();
if (!usuario) { console.error('Uso: npm run admin -- <usuario>'); process.exit(1); }

async function lerSenha() {
  if (process.env.KG_SENHA) return process.env.KG_SENHA;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes('Senha')) process.stdout.write(s); };
  const senha = await new Promise((ok) => rl.question('Senha (mín. 8 caracteres): ', ok));
  rl.close(); process.stdout.write('\n');
  return senha;
}

(async () => {
  const { hashSenha } = require('./server');
  const senha = await lerSenha();
  if (senha.length < 8) { console.error('A senha precisa ter pelo menos 8 caracteres.'); process.exit(1); }
  const db = abrirBanco();
  db.prepare('INSERT INTO usuarios (usuario, senha_hash) VALUES (?, ?) ON CONFLICT(usuario) DO UPDATE SET senha_hash = excluded.senha_hash')
    .run(usuario, hashSenha(senha));
  console.log(`Acesso do usuário "${usuario}" pronto.`);
  process.exit(0);
})();
