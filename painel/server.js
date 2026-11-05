'use strict';
// Servidor do King Gelo: entrega o site, o painel do dono em /admin e a API em /api.
// Só usa módulos do próprio Node (http, sqlite, crypto).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { abrirBanco } = require('./banco');
const { rotas, semDinheiro } = require('./api');
const backup = require('./backup');

const PORTA = +process.env.PORT || 8090;
const RAIZ_SITE = path.resolve(__dirname, '..');
const RAIZ_PAINEL = path.join(__dirname, 'public');
const HTTPS = process.env.KG_HTTPS === '1';           // atrás do nginx com certificado
const SESSAO_DIAS = 14;
const db = abrirBanco();

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};

// ---------- senhas e sessões ----------
function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(senha, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
}
function conferirSenha(senha, guardado) {
  const [, salHex, hHex] = String(guardado).split('$');
  if (!salHex || !hHex) return false;
  const h = crypto.scryptSync(senha, Buffer.from(salHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(h, Buffer.from(hHex, 'hex'));
}
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + SESSAO_DIAS * 86400000).toISOString();
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)').run(hashToken(token), usuarioId, expira);
  db.prepare("DELETE FROM sessoes WHERE expira_em < ?").run(new Date().toISOString());
  return token;
}
function lerCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function usuarioDaSessao(req) {
  const t = lerCookies(req).kg_sessao;
  if (!t) return null;
  const s = db.prepare('SELECT u.id, u.usuario, u.papel, s.expira_em, s.token_hash FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?').get(hashToken(t));
  if (!s || s.expira_em < new Date().toISOString()) return null;
  return s;
}
function cookieSessao(token, maxAge) {
  return `kg_sessao=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${HTTPS ? '; Secure' : ''}`;
}

// ---------- limite de tentativas (login e formulário público) ----------
const tentativas = new Map();
function limitar(chave, max, janelaMs, contar = true) {
  const agora = Date.now();
  const lista = (tentativas.get(chave) || []).filter((t) => agora - t < janelaMs);
  if (!contar) { tentativas.set(chave, lista); return lista.length >= max; }
  lista.push(agora);
  // nunca guarda mais que o necessário (um ataque insistente não faz a lista crescer sem fim)
  if (lista.length > max + 1) lista.splice(0, lista.length - (max + 1));
  tentativas.set(chave, lista);
  validade.set(chave, agora + janelaMs);
  return lista.length > max;
}
// limpeza periódica das chaves que já expiraram
const validade = new Map();
setInterval(() => {
  const agora = Date.now();
  for (const [chave, ate] of validade) if (ate < agora) { validade.delete(chave); tentativas.delete(chave); }
}, 10 * 60000).unref();

const HASH_FALSO = hashSenha(crypto.randomBytes(12).toString('hex'));

// ---------- respostas ----------
function json(res, status, corpo, extras = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extras });
  res.end(JSON.stringify(corpo));
}
function lerCorpo(req, limite = 64 * 1024) {
  return new Promise((ok, erro) => {
    let tam = 0; const partes = [];
    req.on('data', (c) => { tam += c.length; if (tam > limite) { erro(Object.assign(new Error('grande demais'), { status: 413 })); req.destroy(); } else partes.push(c); });
    req.on('end', () => {
      if (!partes.length) return ok({});
      try { ok(JSON.parse(Buffer.concat(partes).toString('utf8'))); } catch { erro(Object.assign(new Error('JSON inválido'), { status: 400 })); }
    });
    req.on('error', erro);
  });
}

// cabeçalhos de segurança de todas as páginas e arquivos
const SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "font-src 'self'", "img-src 'self' data: blob:", "media-src 'self'", "connect-src 'self'",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; '),
};
if (HTTPS) {
  SEGURANCA['Strict-Transport-Security'] = 'max-age=31536000';
  SEGURANCA['Content-Security-Policy'] += '; upgrade-insecure-requests';
}

// texto (html/css/js/svg/json) vai comprimido; a versão comprimida fica em memória até o arquivo mudar
const COMPRIMIVEL = new Set(['.html', '.css', '.js', '.svg', '.json', '.txt', '.xml', '.webmanifest']);
const comprimidos = new Map();
function comprimido(alvo, etag, tipo) {
  const chave = `${alvo}|${tipo}`;
  const guardado = comprimidos.get(chave);
  if (guardado && guardado.etag === etag) return guardado.dados;
  const bruto = fs.readFileSync(alvo);
  const dados = tipo === 'br'
    ? zlib.brotliCompressSync(bruto, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bruto.length } })
    : zlib.gzipSync(bruto, { level: 9 });
  comprimidos.set(chave, { etag, dados });
  return dados;
}

function servirArquivo(res, raiz, rel, req) {
  const alvo = path.resolve(raiz, '.' + path.posix.normalize('/' + rel));
  if (!alvo.startsWith(raiz + path.sep) && alvo !== raiz) return false;
  // o código e o banco do painel nunca saem pelo site
  const relativo = path.relative(RAIZ_SITE, alvo).split(path.sep);
  if (raiz === RAIZ_SITE && (relativo[0] === 'painel' || relativo.some((p) => p.startsWith('.')))) return false;
  let st;
  try { st = fs.statSync(alvo); } catch { return false; }
  if (st.isDirectory()) return servirArquivo(res, raiz, path.posix.join(rel, 'index.html'), req);
  const ext = path.extname(alvo).toLowerCase();
  const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
  // html/css/js sempre revalidam (ETag): mudanca no codigo aparece na hora. Fontes e a biblioteca 3D nao mudam
  // (1 ano). Imagens ficam 30 dias no aparelho: ao TROCAR uma imagem, salve com nome novo, senao quem ja visitou
  // continua vendo a antiga. (Antes o teste era por "/img/" no caminho e falhava no Windows, que usa "\".)
  const pasta = raiz === RAIZ_SITE ? relativo[0] : '';
  const cache = pasta === 'fontes' || pasta === 'vendor' ? 'public, max-age=31536000, immutable'
    : pasta === 'img' ? 'public, max-age=2592000' : 'no-cache';
  const base = { ...SEGURANCA, ETag: etag, 'Cache-Control': cache };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, base); res.end(); return true; }
  const aceita = String(req.headers['accept-encoding'] || '');
  const cod = !COMPRIMIVEL.has(ext) || st.size < 1024 ? null : /\bbr\b/.test(aceita) ? 'br' : /\bgzip\b/.test(aceita) ? 'gzip' : null;
  if (cod) {
    const dados = comprimido(alvo, etag, cod);
    res.writeHead(200, { ...base, 'Content-Type': TIPOS[ext], 'Content-Encoding': cod, 'Content-Length': dados.length, Vary: 'Accept-Encoding' });
    res.end(req.method === 'HEAD' ? undefined : dados);
    return true;
  }
  res.writeHead(200, { ...base, 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Content-Length': st.size, ...(COMPRIMIVEL.has(ext) ? { Vary: 'Accept-Encoding' } : {}) });
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(alvo).pipe(res);
  return true;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  let caminho;
  try { caminho = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  try {
    if (caminho.startsWith('/api/')) {
      const metodo = req.method;
      // proteção contra CSRF: escrita só com JSON e da mesma origem
      if (metodo !== 'GET') {
        const origem = req.headers.origin;
        let hostOrigem = null;
        try { hostOrigem = origem ? new URL(origem).host : null; } catch { hostOrigem = '?'; }
        if (origem && hostOrigem !== req.headers.host) return json(res, 403, { erro: 'Origem não permitida' });
        if (!String(req.headers['content-type'] || '').includes('application/json')) return json(res, 415, { erro: 'Envie JSON' });
      }
      // o IP do X-Forwarded-For só vale atrás do nginx (que sobrescreve o cabeçalho); sem proxy qualquer um
      // poderia inventar um IP a cada tentativa e driblar o limite de login
      const ip = (HTTPS && req.headers['x-forwarded-for']?.split(',').pop().trim()) || req.socket.remoteAddress;

      if (caminho === '/api/login' && metodo === 'POST') {
        // só as tentativas erradas contam: quem entra certo várias vezes (vários aparelhos) não fica bloqueado
        if (limitar('login:' + ip, 8, 15 * 60000, false)) return json(res, 429, { erro: 'Muitas tentativas. Espere alguns minutos.' });
        const { usuario, senha } = await lerCorpo(req);
        const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(String(usuario || '').trim().toLowerCase());
        // usuário inexistente também passa pelo scrypt: o tempo de resposta não revela quais usuários existem
        const confere = conferirSenha(String(senha || ''), u ? u.senha_hash : HASH_FALSO);
        if (!u || !confere) {
          limitar('login:' + ip, 8, 15 * 60000);
          return json(res, 401, { erro: 'Usuário ou senha incorretos' });
        }
        return json(res, 200, { ok: true, usuario: u.usuario }, { 'Set-Cookie': cookieSessao(criarSessao(u.id), SESSAO_DIAS * 86400) });
      }
      if (caminho === '/api/sair' && metodo === 'POST') {
        const t = lerCookies(req).kg_sessao;
        if (t) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(t));
        return json(res, 200, { ok: true }, { 'Set-Cookie': cookieSessao('', 0) });
      }
      // formulário de revenda do site (público)
      if (caminho === '/api/publico/revenda' && metodo === 'POST') {
        if (limitar('lead:' + ip, 5, 60 * 60000)) return json(res, 429, { erro: 'Muitos envios' });
        const d = await lerCorpo(req, 4096);
        // robô de spam: preencheu o campo invisível ou enviou rápido demais. Responde "ok" sem gravar nada,
        // assim ele não descobre que foi barrado
        if (String(d.site || '').trim() || (d.tempo != null && Number(d.tempo) < 2000)) return json(res, 201, { ok: true });
        const txt = (v, n) => String(v || '').trim().slice(0, n);
        if (!txt(d.nome, 80) || !txt(d.ponto, 120)) return json(res, 400, { erro: 'Nome e estabelecimento são obrigatórios' });
        db.prepare(`INSERT INTO clientes (nome, estabelecimento, tipo, cidade, telefone, status, origem, volume_informado)
                    VALUES (?, ?, ?, ?, ?, 'lead', 'site', ?)`)
          .run(txt(d.nome, 80), txt(d.ponto, 120), txt(d.tipo, 40) || 'Outro', txt(d.cidade, 80), txt(d.telefone, 20).replace(/\D/g, ''), txt(d.volume, 40));
        return json(res, 201, { ok: true });
      }

      const usuario = usuarioDaSessao(req);
      if (!usuario) return json(res, 401, { erro: 'Faça login' });
      const dono = usuario.papel === 'dono';
      // downloads (só o dono): cópia do banco agora, backup automático de um dia e planilha de pedidos
      if (metodo === 'GET' && (caminho === '/api/backup' || caminho.startsWith('/api/backups/') || caminho.startsWith('/api/exportar/')) && !dono) {
        return json(res, 403, { erro: 'Só o dono pode baixar os dados' });
      }
      if (metodo === 'GET' && caminho.startsWith('/api/backups/')) {
        const arq = backup.arquivo(caminho.slice('/api/backups/'.length));
        if (!arq || !fs.existsSync(arq)) return json(res, 404, { erro: 'Backup não encontrado' });
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${path.basename(arq)}"`, 'Cache-Control': 'no-store' });
        return fs.createReadStream(arq).pipe(res);
      }
      if (metodo === 'GET' && caminho === '/api/backup') {
        const tmp = path.join(require('node:os').tmpdir(), `kinggelo-${Date.now()}.db`);
        db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
        const nome = `kinggelo-backup-${new Date().toISOString().slice(0, 10)}.db`;
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${nome}"`, 'Cache-Control': 'no-store' });
        return fs.createReadStream(tmp).on('close', () => fs.rm(tmp, () => {})).pipe(res);
      }
      if (metodo === 'GET' && caminho === '/api/exportar/pedidos.csv') {
        const linhas = db.prepare(`
          SELECT p.id, p.criado_em, p.entrega_em, p.status, p.pagamento, p.pago, c.estabelecimento, c.nome, c.cidade, c.telefone,
                 (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE pedido_id = p.id) AS recebido,
                 pr.nome AS sabor, i.quantidade, i.preco_unit
          FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
          JOIN itens_pedido i ON i.pedido_id = p.id JOIN produtos pr ON pr.id = i.produto_id
          ORDER BY p.id DESC, pr.id`).all();
        // texto que começa com = + - @ vira fórmula no Excel: um nome malicioso vindo do formulário do site
        // poderia rodar uma fórmula no computador do dono; um apóstrofo na frente desarma
        const cel = (v) => {
          let t = String(v ?? '');
          if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t;
          return `"${t.replace(/"/g, '""')}"`;
        };
        const valor = (c) => (c / 100).toFixed(2).replace('.', ',');
        // "Recebido no pedido" se repete em cada sabor do mesmo pedido (é do pedido todo, não da linha)
        const csv = ['Pedido;Data;Entrega marcada;Situação;Pagamento;Pago;Recebido no pedido;Estabelecimento;Responsável;Cidade;WhatsApp;Sabor;Quantidade;Preço unitário;Total']
          .concat(linhas.map((l) => [l.id, l.criado_em, l.entrega_em || '', l.status, l.pagamento, l.pago ? 'sim' : 'não', valor(l.recebido), l.estabelecimento, l.nome, l.cidade, l.telefone,
            l.sabor, l.quantidade, valor(l.preco_unit), valor(l.quantidade * l.preco_unit)].map(cel).join(';'))).join('\r\n');
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="pedidos-kinggelo-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
        return res.end('\ufeff' + csv);
      }
      for (const [m, padrao, fn, so] of rotas) {
        if (m !== metodo) continue;
        const achou = caminho.match(padrao);
        if (!achou) continue;
        // rotas marcadas 'dono' (dinheiro, acessos, ajustes) não abrem para a equipe
        if (so === 'dono' && !dono) return json(res, 403, { erro: 'Só o dono pode fazer isso' });
        const corpo = metodo === 'GET' ? {} : await lerCorpo(req);
        const r = fn({ db, params: achou.slice(1), corpo, query: url.searchParams, usuario, hashSenha, conferirSenha });
        // rotas que criam algo devolvem { http: 201, corpo }; para a equipe os valores em dinheiro saem da resposta
        const [status, corpoResp] = r && r.http ? [r.http, r.corpo] : [200, r];
        return json(res, status, dono ? corpoResp : semDinheiro(corpoResp));
      }
      return json(res, 404, { erro: 'Rota não encontrada' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (caminho === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
    if (caminho.startsWith('/admin/')) {
      const rel = caminho.slice('/admin/'.length) || 'index.html';
      if (servirArquivo(res, RAIZ_PAINEL, rel, req)) return;
      if (servirArquivo(res, RAIZ_PAINEL, 'index.html', req)) return;
    }
    if (servirArquivo(res, RAIZ_SITE, caminho, req)) return;
    // página 404 com a cara do site (cai no texto simples se o arquivo não existir)
    let pagina404 = null;
    try { pagina404 = fs.readFileSync(path.join(RAIZ_SITE, '404.html')); } catch {}
    res.writeHead(404, { ...SEGURANCA, 'Content-Type': pagina404 ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : pagina404 || 'Página não encontrada');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) json(res, status, { erro: status === 500 ? 'Erro interno' : e.message });
  }
});

// conexões lentas de propósito (ataque que segura o servidor) são encerradas
servidor.headersTimeout = 15000;
servidor.requestTimeout = 30000;
servidor.keepAliveTimeout = 5000;

if (require.main === module) {
  backup.agendar(db);
  servidor.listen(PORTA, () => console.log(`King Gelo em http://localhost:${PORTA}  ·  painel em http://localhost:${PORTA}/admin/`));
}
module.exports = { db, hashSenha, servidor };
