// Jornada do gelo, o ápice do site:
// 1) o saquinho de melancia do centro é espremido (redesenhado linha a linha: cintura aperta, fundo estufa),
// 2) a selagem de baixo estoura com respingos e lascas de gelo, o bloco sai escorregando,
// 3) cai em linha reta pela coluna do produto deixando gotas no rastro,
// 4) mergulha no copão do contato com respingo de verdade, anéis na superfície e o drink subindo.
(() => {
  const $ = (id) => document.getElementById(id);
  const hero = document.querySelector('.hero');
  const centro = $('pacote-centro');
  const voando = $('gelo-voando'), queda = $('queda'), grupo = $('gelo-grupo');
  const brilho = $('gelo-brilho'), faixaBrilho = $('faixa-brilho'), ladoSombra = $('lado-sombra');
  const ecos = [...document.querySelectorAll('.gelo-eco')];
  const tela = $('particulas');
  const copao = $('copao');
  if (!hero || !centro || !voando || !copao || !tela) return;

  // cores de cada sabor: o gelo, o suco que respinga e o drink do copão mudam com o saquinho escolhido
  const SABORES = {
    melancia: { nome: 'melancia', claro: '#ff8a96', meio: '#f2384f', escuro: '#d81834', fundo: '#b30d29', borda: '#ffd0d5', sombra: '#7d0018',
      suco: ['#ff3b55', '#e8223e', '#ff6b7c', '#c8102e'], drink: ['#ff8996', '#f0324b', '#b30f2b'], brilho: '#ff2a45', miolo: ['#d0142f', '#7a0016'] },
    morango: { nome: 'morango', claro: '#ff6f7d', meio: '#e0142e', escuro: '#b80d22', fundo: '#8f0617', borda: '#ffc4cb', sombra: '#5e0010',
      suco: ['#e8112d', '#c40d24', '#ff4d61', '#9e0a1d'], drink: ['#ff6f7d', '#d9152f', '#9e0a1d'], brilho: '#ff1a35', miolo: ['#b80d22', '#5e0010'] },
    laranja: { nome: 'laranja', claro: '#ffc36b', meio: '#ff8f1c', escuro: '#f07000', fundo: '#c65a00', borda: '#ffe2b8', sombra: '#7a3500',
      suco: ['#ff9a1f', '#ff7a00', '#ffb347', '#e06500'], drink: ['#ffb85c', '#ff8a12', '#d96400'], brilho: '#ff8a00', miolo: ['#f07000', '#8a3d00'] },
    limao: { nome: 'limão', claro: '#d8f59a', meio: '#a6e04a', escuro: '#7fc22a', fundo: '#5f9e17', borda: '#effccd', sombra: '#3a6a06',
      suco: ['#b5ea4f', '#8fd12f', '#d2f582', '#6fb21f'], drink: ['#d4f28c', '#a3dc45', '#6fae1d'], brilho: '#9be03a', miolo: ['#7fc22a', '#3a6a06'] },
    maracuja: { nome: 'maracujá', claro: '#ffe680', meio: '#ffc81f', escuro: '#f2a900', fundo: '#c98800', borda: '#fff2bf', sombra: '#7a5200',
      suco: ['#ffd23f', '#ffbf00', '#ffe27a', '#e0a200'], drink: ['#ffe07a', '#ffc21a', '#d99a00'], brilho: '#ffc400', miolo: ['#f2a900', '#7a5200'] },
    coco: { nome: 'água de coco', claro: '#f4fbff', meio: '#d9eef7', escuro: '#b8dcea', fundo: '#96c4d8', borda: '#ffffff', sombra: '#5d8ea6',
      suco: ['#e8f6fc', '#cfe9f4', '#ffffff', '#b2d8e8'], drink: ['#eef9fd', '#d2ecf6', '#a9d3e4'], brilho: '#cfefff', miolo: ['#b8dcea', '#5d8ea6'] },
    macaverde: { nome: 'maçã verde', claro: '#c9f27a', meio: '#8fd334', escuro: '#6bb51c', fundo: '#4f8f0f', borda: '#e6fbc0', sombra: '#2f5a05',
      suco: ['#9ddc3c', '#7cc423', '#c1ee77', '#5ea814'], drink: ['#c2ee70', '#8fd334', '#5e9e14'], brilho: '#8fe03a', miolo: ['#6bb51c', '#2f5a05'] },
    frutas: { nome: 'frutas vermelhas', claro: '#d86aa8', meio: '#a8246e', escuro: '#861456', fundo: '#5e0b3c', borda: '#f3c4de', sombra: '#3a0424',
      suco: ['#b8277a', '#8f1a5c', '#d659a0', '#6e1247'], drink: ['#d464a2', '#a8246e', '#6e1247'], brilho: '#c02a80', miolo: ['#861456', '#3a0424'] },
  };
  let sabor = SABORES.melancia;
  window.__sabor = sabor;
  const PROPORCAO = 443 / 926;  // largura / altura do saquinho
  const CORTE = 0.93;           // altura da boca por onde o bloco sai
  let COR_SUCO = sabor.suco;

  const NS = 'http://www.w3.org/2000/svg';
  const telaSaco = centro.querySelector('.pc-canvas');
  const cs = telaSaco.getContext('2d');
  const leque = [...hero.querySelectorAll('.leque')];
  const geloCopo = $('gelo-copo'), geloRefracao = $('gelo-copo-refracao');
  const clipAcima = $('clip-acima'), clipAbaixo = $('clip-abaixo');
  const liquido = $('liquido'), liquidoSombra = $('liquido-sombra'), liquidoFrente = $('liquido-frente');
  const superficie = $('superficie'), superficieBrilho = $('superficie-brilho'), borda = $('liquido-borda');
  const aneis = [...$('aneis').children];
  const luzDrink = $('luz-drink');
  const barra = $('progresso');
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // celular e aparelho fraco: menos névoa e menos gotas na queda (cada nuvem de vapor é desenhada por cima das outras)
  const leve = matchMedia('(pointer: coarse)').matches || innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4;
  const ctx = tela.getContext('2d');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const sino = (x, c, l) => Math.exp(-(((x - c) / l) ** 2));

  // copão: viewBox "150 250 300 545"; bloco de gelo: 140 × 340 unidades
  const VB = { x: 150, y: 250, w: 300 };
  const ENTRADA = { x: 300, y: 300 }, FUNDO = { x: 300, y: 580 };
  const GELO_H = 340;
  const meiaLargura = (y) => 300 - (196 + (y - 423) * (23 / 319));

  // ---------- saquinho deformado (desenhado linha a linha num canvas) ----------
  const foto = new Image();
  foto.src = 'img/cliente/pacote-melancia.webp';
  let W = 0, Hs = 0, cdpr = 1;
  function medirSaco() {
    Hs = centro.offsetHeight; W = Hs * PROPORCAO;
    cdpr = Math.min(1.5, devicePixelRatio || 1);
    telaSaco.width = Math.round(W * 1.6 * cdpr);
    telaSaco.height = Math.round(Hs * 1.5 * cdpr);
  }

  // largura relativa de cada altura v (0 = topo, 1 = fundo) do saquinho
  function perfil(v, sq, pressao, murcha) {
    let sx = 1 - 0.34 * sq * sino(v, 0.42, 0.17)
      + 0.2 * pressao * sino(v, 0.86, 0.1)
      + 0.07 * pressao * sino(v, 0.07, 0.07);
    return sx * (1 - 0.05 * murcha);
  }

  let chaveSaco = '', ultimoSaco = 0;
  // largura de cada altura do saquinho: os dedos afundam a parte de cima, o bloco empurrado estufa
  // o fundo e, quando a selagem abre, a boca se alarga
  function perfil2(v, sq, pressao, murcha, abre) {
    return (1 - 0.12 * sq * sino(v, 0.3, 0.15) + 0.16 * pressao * sino(v, 0.76, 0.15)
      + 0.09 * abre * suave(0.78, 0.93, v)) * (1 - 0.05 * murcha);
  }
  function desenharSaco(sq, pressao, murcha, abre, t) {
    if (!foto.complete || !foto.naturalWidth || !W) return;
    // parado e sem pressão (que pulsa com o tempo): não precisa redesenhar
    const chave = [sq, pressao, murcha, abre, W].map((v) => v.toFixed(4)).join();
    if (pressao < 0.001 && chave === chaveSaco) return;
    // só a pulsação mudou: basta ~30 quadros por segundo (redesenhar todas as linhas a 60 pesa no celular)
    if (chave === chaveSaco && t - ultimoSaco < 50) return;
    chaveSaco = chave; ultimoSaco = t;
    const iw = foto.naturalWidth, ih = foto.naturalHeight;
    cs.setTransform(cdpr, 0, 0, cdpr, 0, 0);
    cs.clearRect(0, 0, W * 1.6, Hs * 1.5);
    // apertado, o topo cede um pouco para baixo
    const ox = W * 0.8, oy = Hs * (0.04 + 0.025 * sq * (1 - murcha));
    // a pressão pulsa, como mãos apertando em tempos
    const pulso = reduzido ? 0 : Math.max(0, Math.sin(t * 0.0115)) * 0.35 * pressao;
    const pr = Math.min(1, pressao + pulso);
    const esticaY = 1 + 0.03 * pr - 0.02 * murcha;
    const corpoH = Hs * CORTE * esticaY;
    // fatias de 2,5px: só a largura muda de uma para outra, então não aparecem degraus e o custo cai pela metade
    const passo = 2.5;

    // ao abrir, a selagem de baixo se descola e some para dentro; o corpo termina na boca
    const fimV = CORTE + (1 - CORTE) * (1 - abre);
    const fundoY = oy + Hs * fimV * esticaY;
    const wBoca = W * perfil2(Math.min(fimV, 0.97), sq, pr, murcha, abre);
    const labio = W * 0.035 * abre, costas = W * 0.17 * abre;   // curva do lábio da frente e do de trás
    if (abre > 0.02) {
      // por dentro: o fundo escuro do saquinho com o gelo vermelho, entre o lábio da frente e o de trás
      const g = cs.createLinearGradient(0, fundoY, 0, fundoY + costas);
      g.addColorStop(0, sabor.sombra); g.addColorStop(0.5, sabor.escuro); g.addColorStop(1, sabor.claro);
      cs.fillStyle = g;
      cs.beginPath();
      cs.moveTo(ox - wBoca / 2, fundoY);
      cs.quadraticCurveTo(ox, fundoY + 2 * costas, ox + wBoca / 2, fundoY);
      cs.quadraticCurveTo(ox, fundoY + 2 * labio, ox - wBoca / 2, fundoY);
      cs.fill();
      cs.strokeStyle = `rgba(0,0,0,${(0.3 * abre).toFixed(2)})`; cs.lineWidth = 1.5;
      cs.beginPath(); cs.moveTo(ox - wBoca / 2, fundoY); cs.quadraticCurveTo(ox, fundoY + 2 * costas, ox + wBoca / 2, fundoY); cs.stroke();
    }
    // corpo, linha a linha (só a largura muda: a arte não entorta); embaixo, recortado pelo lábio da frente
    cs.save();
    cs.beginPath();
    cs.moveTo(0, 0); cs.lineTo(W * 1.6, 0); cs.lineTo(W * 1.6, fundoY); cs.lineTo(ox + wBoca / 2, fundoY);
    cs.quadraticCurveTo(ox, fundoY + 2 * labio, ox - wBoca / 2, fundoY);
    cs.lineTo(0, fundoY); cs.closePath();
    cs.clip();
    const linhas = Math.ceil((fundoY + labio * 2 - oy) / passo);
    for (let j = 0; j < linhas; j++) {
      const v = Math.min(1, (j * passo) / (Hs * esticaY));
      const w = W * perfil2(Math.min(v, 0.97), sq, pr, murcha, abre);
      const treme = reduzido ? 0 : Math.sin(t * 0.04 + v * 9) * 0.5 * pr;
      cs.drawImage(foto, 0, v * ih, iw, (passo / (Hs * esticaY)) * ih + 1, ox - w / 2 + treme, oy + j * passo, w, passo + 0.6);
    }
    cs.restore();
    // brilho do plástico na borda do lábio da frente
    if (abre > 0.02) {
      cs.strokeStyle = `rgba(255,255,255,${(0.8 * abre).toFixed(2)})`; cs.lineWidth = 2;
      cs.beginPath(); cs.moveTo(ox - wBoca / 2, fundoY); cs.quadraticCurveTo(ox, fundoY + 2 * labio, ox + wBoca / 2, fundoY); cs.stroke();
    }
    // luz e sombra sobre a arte
    cs.globalCompositeOperation = 'source-atop';
    if (sq > 0.01) {
      // marcas dos dedos dos dois lados, onde o plástico afunda
      const yd = oy + Hs * esticaY * 0.3, wd = W * perfil2(0.3, sq, pr, murcha, abre);
      [-1, 1].forEach((lado) => {
        const g = cs.createRadialGradient(ox + lado * wd * 0.5, yd, 0, ox + lado * wd * 0.5, yd, W * 0.34);
        g.addColorStop(0, `rgba(0,0,0,${(0.55 * sq).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cs.fillStyle = g; cs.fillRect(ox + lado * wd * 0.5 - W * 0.4, yd - W * 0.4, W * 0.8, W * 0.8);
      });
    }
    if (pr > 0.01) {
      // plástico esticado no fundo estufado: brilho largo de um lado e sombra do outro
      const yb = oy + Hs * esticaY * 0.78;
      let g = cs.createRadialGradient(ox - W * 0.18, yb - W * 0.05, 0, ox - W * 0.18, yb - W * 0.05, W * 0.42);
      g.addColorStop(0, `rgba(255,255,255,${(0.3 * pr).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      cs.fillStyle = g; cs.fillRect(0, yb - W * 0.5, W * 1.6, W);
      g = cs.createLinearGradient(ox + W * 0.1, 0, ox + W * 0.6, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${(0.28 * pr).toFixed(3)})`);
      cs.fillStyle = g; cs.fillRect(ox, yb - W * 0.45, W * 0.8, W * 0.9);
    }
    if (murcha > 0.01) {
      // depois de esvaziar o plástico fica sem brilho e um pouco mais escuro
      cs.fillStyle = `rgba(0,0,0,${(0.1 * murcha).toFixed(3)})`;
      cs.fillRect(0, 0, W * 1.6, Hs * 1.5);
    }
    cs.globalCompositeOperation = 'source-over';
  }

  // ---------- partículas (canvas) ----------
  let dpr = 1;
  function medirTela() {
    dpr = Math.min(leve ? 1 : 1.5, devicePixelRatio || 1);
    tela.width = innerWidth * dpr;
    tela.height = innerHeight * dpr;
  }
  const particulas = [];
  // tipo: [gravidade, quanto da vida perde por segundo]
  const TIPOS = { gota: [1500, 0.55], lasca: [1500, 0.55], rastro: [-60, 1.6], vapor: [-10, 0.8], vento: [0, 2.4] };
  const nuvem = document.createElement('canvas');
  nuvem.width = nuvem.height = 64;
  {
    const n = nuvem.getContext('2d'), g = n.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(240,250,255,.45)'); g.addColorStop(1, 'rgba(240,250,255,0)');
    n.fillStyle = g; n.fillRect(0, 0, 64, 64);
  }
  function gota(x, y, vx, vy, r, cor, doc = false, tipo = 'gota') {
    particulas.push({ x, y, vx, vy, r, cor, doc, tipo, vida: 1, giro: Math.random() * 6, vg: (Math.random() - 0.5) * 10 });
  }
  function estouro(x, y, largura) {
    for (let i = 0; i < 34; i++) {
      gota(x + (Math.random() - 0.5) * largura * 0.7, y,
        (Math.random() - 0.5) * 520, 120 + Math.random() * 420,
        2 + Math.random() * 5.5, COR_SUCO[i % COR_SUCO.length]);
    }
    for (let i = 0; i < 12; i++) {
      gota(x + (Math.random() - 0.5) * largura * 0.6, y,
        (Math.random() - 0.5) * 380, 80 + Math.random() * 300,
        3 + Math.random() * 5, 'rgba(255,225,230,.85)', false, 'lasca');
    }
  }
  function respingo(x, y, largura, scrollRef) {
    // respingo de copo: sobe pouco, abre para os lados e cai de volta no drink (some ao passar da borda)
    for (let i = 0; i < 30; i++) {
      const lado = (Math.random() - 0.5) * 2;
      gota(x + lado * largura * 0.35, y + scrollRef,
        lado * (40 + Math.random() * 170), -(240 + Math.random() * 380),
        1.6 + Math.random() * 4, COR_SUCO[i % COR_SUCO.length], true);
      particulas[particulas.length - 1].chao = y + scrollRef + 30;
    }
  }
  function desenharParticulas(dt, rolagem) {
    if (!particulas.length) {
      if (!telaLimpa) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, tela.width, tela.height); telaLimpa = true; }
      return;
    }
    telaLimpa = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      const [gravidade, desgaste] = TIPOS[p.tipo];
      p.vy += gravidade * dt;
      p.vx *= 1 - 0.6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.giro += p.vg * dt;
      p.vida -= dt * desgaste;
      const y = p.doc ? p.y - rolagem : p.y;
      if (p.vida <= 0 || y > innerHeight + 40 || y < -200 || (p.chao && p.vy > 0 && p.y > p.chao)) { particulas.splice(i, 1); continue; }
      if (p.tipo === 'vapor') {
        // névoa fria: cresce e some
        p.r *= 1 + 0.9 * dt;
        ctx.globalAlpha = clamp(p.vida) * 0.2;
        ctx.drawImage(nuvem, p.x - p.r, y - p.r, p.r * 2, p.r * 2);
        continue;
      }
      if (p.tipo === 'vento') {
        // risco de ar passando pelo bloco
        ctx.globalAlpha = clamp(p.vida * 1.4) * 0.6;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x, y + p.r * Math.sign(p.vy || -1) * -1); ctx.stroke();
        continue;
      }
      ctx.globalAlpha = clamp(p.vida * 1.6);
      if (p.tipo === 'lasca') {
        ctx.save();
        ctx.translate(p.x, y); ctx.rotate(p.giro);
        ctx.fillStyle = p.cor;
        ctx.beginPath(); ctx.roundRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4, p.r * 0.4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.fillRect(-p.r * 0.6, -p.r * 0.5, p.r * 0.5, p.r * 0.3);
        ctx.restore();
      } else {
        // gota esticada na direção do movimento, com brilho
        const v = Math.hypot(p.vx, p.vy) || 1;
        const estica = 1 + Math.min(1.6, v / 600);
        ctx.save();
        ctx.translate(p.x, y); ctx.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2);
        ctx.fillStyle = p.cor;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * estica, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath(); ctx.ellipse(-p.r * 0.3, -p.r * 0.35 * estica, p.r * 0.28, p.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- copão ----------
  const bolhas = Array.from({ length: 14 }, (_, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', 1.2 + (i % 3) * 0.8);
    c.setAttribute('fill', '#fff');
    c.setAttribute('fill-opacity', '.55');
    $('bolhas').appendChild(c);
    return { c, x: 225 + ((i * 41) % 150), vel: 0.025 + (i % 4) * 0.01, fase: i * 0.29 };
  });

  let ultimoCopo = 0, chaveCopo = '';
  function copo(kk, t) {
    // parado (só as bolhas e a boia mexendo): ~20 quadros por segundo bastam; o copo tem desfoques e
    // muitas gotas, e redesenhar tudo a 60 quadros pesava no celular
    const chave = `${kk.toFixed(4)}|${trajeto.gy.toFixed(2)}|${trajeto.rc.top.toFixed(0)}|${copoVisivel}`;
    // parado: as bolhas e o balanco do gelo no copo a ~15 quadros por segundo bastam (sao lentos)
    if (chave === chaveCopo && t - ultimoCopo < (estaOcioso ? 66 : 50)) return;
    chaveCopo = chave; ultimoCopo = t;
    const y = trajeto.gy;
    // depois do mergulho o bloco afunda um pouco e volta a boiar
    const mergulho = kk > 0.5 ? Math.sin(clamp((kk - 0.5) / 0.25) * Math.PI) * 14 : 0;
    const boia = kk >= 0.5 && !reduzido ? Math.sin(t * 0.0016) * 1.6 : 0;
    // a base do bloco (gy + 157) nunca passa do fundo do copo (~742), nem no mergulho nem com rolagem brusca
    const gy = Math.min(y + mergulho, 572) + boia;
    geloCopo.setAttribute('transform', `translate(${FUNDO.x} ${gy})`);
    // abaixo da superfície o bloco aparece deslocado e um pouco maior (refração do drink)
    geloRefracao.setAttribute('transform', `translate(${FUNDO.x + 5} ${gy + 3}) scale(1.04 1.02)`);
    const impacto = clamp((kk - 0.45) / 0.3);
    const nivel = lerp(612, 478, suave(0.45, 0.78, kk));
    const onda = (reduzido ? 0 : 1) * Math.sin(impacto * Math.PI) * 5 + (reduzido ? 0 : Math.sin(t * 0.004) * 0.8);
    const mw = meiaLargura(nivel);
    if (window.__gelo3d && window.__gelo3d.copo) {
      // entra em pé como terminou a queda, balança no mergulho e depois gira devagar boiando no drink
      const solto = reduzido ? 0 : suave(0.5, 0.9, kk);
      const balanco = kk > 0.45 && !reduzido ? Math.sin(clamp((kk - 0.45) / 0.35) * Math.PI * 2) * (1 - clamp((kk - 0.45) / 0.35)) * 0.12 : 0;
      // a queda é desenhada com câmera em perspectiva; aqui a mesma inclinação é aplicada no bloco,
      // assim na troca de camada ele continua mostrando as mesmas faces
      const px = trajeto.rc.left + (FUNDO.x - VB.x) * trajeto.k - innerWidth / 2;
      const py = trajeto.rc.top + (gy - VB.y) * trajeto.k - innerHeight / 2;
      const zCam = innerHeight / 2 / Math.tan((14 * Math.PI) / 180);
      // mergulho: o bloco entra balançando e inclinando, em vez de descer duro
      const dive = kk < 0.5 && !reduzido ? kk / 0.5 : 0;
      const gingado = dive ? Math.sin(dive * Math.PI * 2.5) * 0.2 * (1 - dive) : 0;
      const inclina = dive ? Math.sin(dive * Math.PI) * 0.22 : 0;
      window.__gelo3d.copo({
        x: FUNDO.x, gy, nivel: nivel + onda * 0.4, mw, rySup: mw * 0.135 + onda, oculto: copoVisivel === false,
        ry: solto * Math.sin(t * 0.00045) * 0.55 + Math.atan(px / zCam),
        rx: 0.12 * solto + Math.sin(t * 0.0011) * 0.04 * solto + Math.atan(py / zCam) + inclina,
        rz: balanco + gingado + Math.sin(t * 0.0009) * 0.035 * solto,
      });
    }

    [liquido, liquidoSombra].forEach((el) => { el.setAttribute('y', nivel); el.setAttribute('height', 800 - nivel); });
    clipAcima.setAttribute('height', Math.max(0, nivel));
    clipAbaixo.setAttribute('y', nivel); clipAbaixo.setAttribute('height', 900 - nivel);
    superficie.setAttribute('cy', nivel + onda * 0.4);
    superficie.setAttribute('rx', mw);
    superficie.setAttribute('ry', mw * 0.135 + onda);
    superficieBrilho.setAttribute('cy', nivel - 2);
    superficieBrilho.setAttribute('rx', mw * 0.6);
    borda.setAttribute('d', `M${300 - mw} ${nivel} A${mw} ${mw * 0.135 + onda} 0 0 0 ${300 + mw} ${nivel}`);
    // o tom de dentro do drink começa na borda da frente da superfície (a curva), não numa linha reta no nível:
    // antes o copo parecia ter metade de uma cor e metade de outra
    liquidoFrente.setAttribute('d', `M${300 - mw} ${nivel} A${mw} ${mw * 0.135 + onda} 0 0 0 ${300 + mw} ${nivel} L420 800 L180 800 Z`);
    aneis.forEach((a, i) => {
      const s = clamp((kk - 0.48 - i * 0.06) / 0.28);
      a.setAttribute('cx', 300); a.setAttribute('cy', nivel);
      a.setAttribute('rx', 20 + s * (mw - 24)); a.setAttribute('ry', (20 + s * (mw - 24)) * 0.135);
      a.setAttribute('stroke-opacity', s > 0 && s < 1 ? 0.7 * (1 - s) : 0);
    });
    luzDrink.setAttribute('opacity', 0.25 + 0.25 * suave(0.45, 0.78, kk));
    bolhas.forEach((b) => {
      const ciclo = reduzido ? b.fase : (t * b.vel * 0.01 + b.fase) % 1;
      b.c.setAttribute('cx', b.x + Math.sin(ciclo * 12) * 3);
      b.c.setAttribute('cy', lerp(745, nivel + 8, ciclo));
    });
  }

  // ---------- medidas de layout em cache (nada de medir o layout depois de escrever estilos) ----------
  const L = {};
  function medirLayout() {
    L.heroTop = hero.getBoundingClientRect().top + scrollY;
    L.heroH = hero.offsetHeight;
    L.docH = document.documentElement.scrollHeight;
    const rc = copao.getBoundingClientRect();
    L.copao = { left: rc.left + scrollX, top: rc.top + scrollY, width: rc.width, height: rc.height };
  }

  // ---------- laço principal ----------
  let suaveY = scrollY, ultimo = performance.now(), ultimoScroll = scrollY, velocidade = 0;
  let inicioSeq = null;
  const DUR_SEQ = 1700, FIM_SEQ = 0.74;  // espremer → estufar → soltar, em 1,7 s
  let pAnterior = 0, kkAnterior = 0, ultimoTremor = null, ultimaAbertura = null, copoVisivel = null, telaLimpa = false;
  window.__gelo = { visivel: false };

  // movimento do bloco: velocidade real de queda (no documento) dirige esticada, inclinação, giro, borrão e ar
  const mov = { yDoc: null, v: 0, vAnt: 0, ang: 0, vAng: 0, ventos: 0, vapores: 0, y0: 0, giroFixo: null };
  let agora = 0, passo = 0.016, rolagemAtual = 0, estado3d = null;
  const trajeto = { gy: ENTRADA.y, rc: { left: 0, top: 0 }, k: 1 };
  const embrulhar = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function posicionarGelo(x, y, alturaPx, livre = 1, solto = false) {
    const esc = alturaPx / GELO_H;
    const yDoc = y + rolagemAtual;
    if (mov.yDoc !== null) mov.v = lerp(mov.v, (yDoc - mov.yDoc) / passo, 0.25);
    mov.yDoc = yDoc;
    const v = reduzido ? 0 : mov.v * livre;
    const rapidez = clamp(Math.abs(v) / 2200);
    // mola: o bloco balança quando a queda acelera ou freia
    const acel = clamp((v - mov.vAnt) / passo / 6000, -1, 1);
    mov.vAnt = v;
    mov.vAng += (-mov.ang * 70 - mov.vAng * 8 + acel * 420) * passo;
    mov.ang += mov.vAng * passo;
    const giroZ = reduzido ? 0 : (mov.ang + Math.sin(agora * 0.0013) * 1.8 + Math.sin(yDoc / 430) * 3.2) * livre;
    // vira devagar em 3D enquanto desce, e a luz corre pela face
    const giroY = reduzido ? 0 : Math.sin(yDoc / 700) * 22 * livre;
    const estica = 1 + 0.16 * rapidez, aperta = 1 / Math.sqrt(estica);
    // bloco em SVG: só quando não há WebGL (com 3D ele fica escondido e não precisa ser atualizado)
    if (!window.__gelo3d) {
      const corpo = `translate(${(x - 70).toFixed(1)}px, ${(y - GELO_H / 2).toFixed(1)}px) scale(${esc.toFixed(4)}) perspective(800px) rotateZ(${giroZ.toFixed(2)}deg) rotateY(${giroY.toFixed(2)}deg) scale(${aperta.toFixed(3)}, ${estica.toFixed(3)})`;
      voando.style.transform = brilho.style.transform = corpo;
      const lado = giroY / 22;
      faixaBrilho.setAttribute('transform', `translate(${(-lado * 78).toFixed(1)} 0) skewX(-14)`);
      faixaBrilho.setAttribute('opacity', (0.35 + 0.35 * Math.abs(lado) + 0.3 * rapidez).toFixed(2));
      ladoSombra.setAttribute('opacity', (Math.abs(lado) * 0.8).toFixed(2));
      ladoSombra.setAttribute('transform', lado < 0 ? 'scale(-1 1)' : '');
      // eco borrado atrás, no sentido contrário ao movimento
      ecos.forEach((eco, i) => {
        const atraso = -v * 0.016 * (i + 1);
        eco.style.opacity = solto ? (rapidez * (i ? 0.22 : 0.38)).toFixed(3) : 0;
        eco.style.transform = `translate(0px, ${atraso.toFixed(1)}px) ${corpo}`;
      });
    }
    // no 3D o bloco capota de verdade: dá voltas em pé conforme cai e se endireita para entrar no copo
    if (livre < 0.05) mov.y0 = yDoc;
    const giro = reduzido ? 0 : (yDoc - mov.y0) / 360;
    if (livre >= 1) mov.giroFixo = null;
    else if (mov.giroFixo === null) mov.giroFixo = embrulhar(giro);
    const voltas = livre < 1 ? mov.giroFixo : embrulhar(giro);
    estado3d = {
      x, y, esc, aperta, estica,
      ry: voltas * livre,
      rx: reduzido ? 0 : Math.sin(giro * 0.6) * 0.3 * livre,
      rz: -giroZ * Math.PI / 180,
      atraso: -v * 0.016, eco: solto ? rapidez : 0, sombra: livre,
    };
    Object.assign(window.__gelo, { x, y, w: 124 * esc, h: 314 * esc });
    if (solto && !reduzido) soprar(x, y, 124 * esc, 314 * esc, v, rapidez);
  }

  // névoa fria saindo do bloco
  function soprar(x, y, w, h, v, rapidez) {
    if (particulas.length > (leve ? 70 : 220)) return;
    const sentido = v < 0 ? -1 : 1;
    mov.vapores += (9 + rapidez * 40) * passo * (leve ? 0.35 : 1);
    while (mov.vapores >= 1) {
      mov.vapores--;
      const borda = Math.random();
      const px = borda < 0.6 ? x + (Math.random() < 0.5 ? -1 : 1) * w * (0.35 + Math.random() * 0.2) : x + (Math.random() - 0.5) * w;
      const py = borda < 0.6 ? y + (Math.random() - 0.5) * h : y + h * 0.45 * (v < -200 ? -1 : 1);
      gota(px, py, (Math.random() - 0.5) * 30, 40 - v * 0.8, w * (0.1 + Math.random() * 0.12), '', false, 'vapor');
    }
  }

  let ultimaPosicao = -1, ultimaRolagem = 0, ultimoOcioso = 0, estaOcioso = false;
  function quadro(t) {
    // parado (ninguem rolando, nenhuma gota no ar, sequencia do saquinho ja terminada): o que ainda se mexe
    // (o gelo balancando, as bolhas do copo) fica bom a ~25 quadros por segundo. A 60 o celular esquentava
    // com a pagina parada (30-40% de um nucleo so redesenhando).
    if (scrollY !== ultimaPosicao) { ultimaPosicao = scrollY; ultimaRolagem = t; }
    // (a nevoa fria que sai do gelo nao conta: ela e lenta e fica boa a 25 quadros)
    const ocioso = !girando && particulas.every((q) => q.tipo === 'vapor') && t - ultimaRolagem > 500 && inicioSeq !== null && t > inicioSeq + DUR_SEQ + 400;
    // espera com setTimeout (e nao pulando quadros com requestAnimationFrame): qualquer laco de rAF ativo faz o
    // navegador produzir 60 quadros por segundo, e as animacoes de CSS da pagina sao recalculadas em todos
    if (ocioso && t - ultimoOcioso < 38) { setTimeout(() => requestAnimationFrame(quadro), 40 - (t - ultimoOcioso)); return; }
    ultimoOcioso = t;
    estaOcioso = ocioso;
    // leitura do layout primeiro, antes de qualquer escrita de estilo neste quadro
    const r = centro.getBoundingClientRect();
    const dt = Math.min(0.033, Math.max(0.001, (t - ultimo) / 1000));
    ultimo = t;
    agora = t; passo = dt;
    suaveY = reduzido ? scrollY : suaveY + (scrollY - suaveY) * (1 - Math.exp(-(dt * 1000) / 110));
    velocidade = lerp(velocidade, Math.abs(scrollY - ultimoScroll), 0.2);
    ultimoScroll = scrollY;
    const vw = innerWidth, vh = innerHeight;
    // a rolagem suavizada (queda macia) só vale no meio do caminho. Perto da embalagem e chegando no copo
    // o gelo usa a rolagem real: com rolagem rápida o atraso fazia ele subir por cima da embalagem ou
    // passar direto do copo, porque mirava onde eles estavam um instante antes.
    const fimCopo = Math.min(L.copao.top + L.copao.height / 2 - vh / 2, L.docH - vh - 2) - 1.5 * vh;
    const fatorSuave = suave(vh * 0.25, vh * 0.9, scrollY) * (1 - suave(fimCopo - vh * 0.5, fimCopo, scrollY));
    const s = lerp(scrollY, suaveY, fatorSuave);
    const deslocado = scrollY - s;
    rolagemAtual = s;
    const estreito = vw < 820;

    const maxRolagem = L.docH - vh;
    if (barra) barra.style.transform = `scaleX(${maxRolagem > 0 ? scrollY / maxRolagem : 0})`;

    // ===== hero: espremer → estufar → estourar → soltar =====
    const percursoHero = Math.max(1, L.heroH - vh);
    // a sequência espremer → abrir → soltar roda sozinha logo que a página abre (não depende de rolar);
    // ao fim o bloco fica pendurado na boca do saquinho, e a rolagem só faz ele terminar de sair e cair
    // espera a foto do saquinho (ou no máximo 2,5s, para não travar se a imagem demorar)
    // espera tambem o gelo 3D ficar pronto (ou desistir), para o bloco nao trocar de versao no meio da queda
    const pronto3d = window.__gelo3d || window.__gelo3dTentou || t > 4500;
    if (inicioSeq === null && pronto3d && ((foto.complete && foto.naturalWidth) || t > 2500)) inicioSeq = t + 700;
    // durante a troca de sabor a sequência volta ao início: o gelo do sabor anterior some junto com o saquinho
    const p = girando ? 0 : reduzido ? FIM_SEQ : inicioSeq === null ? 0 : clamp((t - inicioSeq) / DUR_SEQ) * FIM_SEQ;
    const aperto = suave(0.06, 0.5, p);
    const estourou = suave(0.55, 0.59, p);
    const murcha = suave(0.66, 0.85, p);
    const sq = aperto * (1 - 0.7 * murcha);
    const pressao = suave(0.34, 0.54, p) * (1 - estourou);
    const tremor = reduzido ? 0 : Math.sin(t * 0.05) * 2.4 * pressao;

    const sacoAbre = suave(0.53, 0.62, p);
    desenharSaco(sq, pressao, murcha, sacoAbre, t);
    if (tremor !== ultimoTremor) { centro.style.transform = `translateX(${tremor.toFixed(2)}px)`; ultimoTremor = tremor; }
    const abre = (1 + 0.12 * sq).toFixed(3);
    if (abre !== ultimaAbertura) { leque.forEach((el) => el.style.setProperty('--abre', abre)); ultimaAbertura = abre; }
    hero.classList.toggle('rolou', s - L.heroTop > 4);

    // ===== medidas =====
    const cx = r.left + r.width / 2;
    // enquanto o gelo está preso ao saquinho ele usa a posição REAL do saquinho; a rolagem suavizada
    // (que deixa a queda macia) só entra quando ele se solta. Antes, rolando para cima, a boca calculada
    // ficava acima do saquinho de verdade e o gelo aparecia por cima da embalagem.
    const top = r.top + deslocado;
    const boca = top + r.height * CORTE;
    const alturaSaco = r.width * 0.62 * (GELO_H / 124);

    const rc = { left: L.copao.left - scrollX, top: L.copao.top - scrollY, width: L.copao.width, height: L.copao.height };
    const copoPerto = rc.top < vh * 1.6 && rc.top + rc.height > -vh * 0.6;
    const k = rc.width / VB.w;
    const copoTela = (vx, vy) => [rc.left + (vx - VB.x) * k, rc.top + deslocado + (vy - VB.y) * k];
    const copoDocCentro = rc.top + scrollY + rc.height / 2;
    const E = Math.min(copoDocCentro - vh / 2, maxRolagem - 2);
    const E1 = E - 0.6 * vh;
    const S0 = 0;   // a liberação do bloco começa na primeira rolada
    // trecho final único, em coordenadas do copo: o bloco vem caindo cada vez mais rápido e entra no drink
    // sem parar. A queda livre (por cima de tudo) e o bloco dentro do copo seguem a mesma curva,
    // então a troca de camada em E1 acontece com a mesma posição e a mesma velocidade.
    const Ea = E1 - 0.9 * vh, Epouso = E1 + 0.5 * (E - E1);
    const u = clamp((s - Ea) / (Epouso - Ea)), u1 = (E1 - Ea) / (Epouso - Ea);
    const G0 = (ENTRADA.y - FUNDO.y * u1 * u1) / (1 - u1 * u1);
    trajeto.gy = lerp(G0, FUNDO.y, u * u);
    trajeto.rc = { left: rc.left, top: rc.top + deslocado }; trajeto.k = k;

    // estouro: dispara uma vez ao cruzar o ponto, indo para baixo
    if (!reduzido && pAnterior < 0.56 && p >= 0.56) estouro(cx, boca + 6, r.width);
    pAnterior = p;

    // bloco: preso → empurrado → escorrega rápido
    const desliza = 0.14 * suave(0.55, 0.62, p) + 0.86 * clamp((p - 0.62) / 0.1) ** 2;

    let visivel = false;
    if (s < E1) {
      visivel = p > 0.55;
      grupo.style.opacity = visivel ? 1 : 0;
      const geloWebgl = !!window.__gelo3d;
      // 1) dentro do saquinho até ficar pendurado na boca (tempo); 2) rolando, termina de sair; 3) cai pela coluna
      const PEND = 0.42;                                       // quanto do bloco fica para fora, pendurado
      const saindo = reduzido ? 1 : suave(0, vh * 0.35, s - S0);
      const a = suave(S0 + vh * 0.25, S0 + vh * 0.9, s), b = suave(Ea, E1, s);
      const [ex, ey] = copoTela(ENTRADA.x, trajeto.gy);
      const colunaX = estreito ? vw - 40 : cx;
      // no celular o bloco desce pela lateral num tamanho médio (não some de tão pequeno nem cresce demais no fim)
      const alturaQueda = estreito ? clamp(vh * 0.24, 150, 210) : Math.min(vh * 0.42, 340);
      const h = lerp(lerp(alturaSaco, alturaQueda, a), GELO_H * k, b);
      const fimV = CORTE + (1 - CORTE) * (1 - sacoAbre);
      const bocaY = top + r.height * fimV + r.width * 0.035 * sacoAbre;
      const pendurado = bocaY - h / 2 + PEND * h + (p >= FIM_SEQ && !reduzido ? Math.sin(t * 0.0022) * 3 * (1 - saindo) : 0);
      const saiu = bocaY + h / 2 + 16;
      const naBoca = lerp(lerp(top + r.height * 0.46, pendurado, desliza), saiu, saindo);
      // o bloco nunca sobe por cima do saquinho: fica abaixo da boca até ela passar do meio da tela
      const x = lerp(lerp(cx, colunaX, a), ex, b);
      const y = lerp(Math.max(naBoca, saindo >= 1 ? vh * 0.5 : -1e9), ey, b);
      posicionarGelo(x, y, h, saindo * (1 - suave(0.55, 1, b)), visivel && saindo > 0.5 && b < 0.8);
      // enquanto parte do bloco ainda está dentro, ele é cortado na linha da boca
      const dentro = y - h / 2 < bocaY && b < 0.01;
      if (geloWebgl) {
        queda.style.clipPath = 'none';
        if (estado3d) estado3d.corte = dentro ? bocaY : null;
      } else if (dentro) {
        const bx = cx, meia = (r.width * (1 + 0.09 * sacoAbre)) / 2, lb = r.width * 0.035 * sacoAbre, by = bocaY - lb;
        queda.style.clipPath = `path('M0 ${by.toFixed(1)} L${(bx - meia).toFixed(1)} ${by.toFixed(1)} Q${bx.toFixed(1)} ${(by + 2 * lb).toFixed(1)} ${(bx + meia).toFixed(1)} ${by.toFixed(1)} L${vw} ${by.toFixed(1)} L${vw} ${vh * 3} L0 ${vh * 3} Z')`;
      } else queda.style.clipPath = 'none';
      // gotas que se soltam do bloco enquanto cai
      if (!reduzido && saindo >= 1 && velocidade > 3 && Math.random() < Math.min(leve ? 0.35 : 0.9, velocidade / 40)) {
        const larg = 124 * (h / GELO_H);
        gota(x + (Math.random() - 0.5) * larg, y - h * 0.42, (Math.random() - 0.5) * 30, -(60 + velocidade * 9),
          1.5 + Math.random() * 3, COR_SUCO[(Math.random() * 4) | 0], false, 'rastro');
      }
      if (copoVisivel !== false) { geloCopo.style.opacity = geloRefracao.style.opacity = 0; copoVisivel = false; }
      if (copoPerto) copo(0, t);
      kkAnterior = 0;
    } else {
      grupo.style.opacity = 0;
      mov.yDoc = null; mov.v = mov.vAnt = mov.ang = mov.vAng = 0;
      if (copoVisivel !== true) { geloCopo.style.opacity = geloRefracao.style.opacity = 1; copoVisivel = true; }
      const kk = clamp((s - E1) / (E - E1));
      if (!reduzido && kkAnterior < 0.47 && kk >= 0.47) {
        const [sx2, sy2] = copoTela(300, 478);
        respingo(sx2, sy2, 200 * k, s);
      }
      kkAnterior = kk;
      if (copoPerto) copo(kk, t);
    }
    window.__gelo.visivel = visivel;
    if (window.__gelo3d) window.__gelo3d.desenhar(visivel ? estado3d : null);

    desenharParticulas(dt, s);
    requestAnimationFrame(quadro);
  }

  // ---------- escolher o sabor: o saquinho tocado troca de lugar com o do centro ----------
  const raiz = document.documentElement.style;
  function aplicarCores(sb) {
    sabor = sb; window.__sabor = sb; COR_SUCO = sb.suco;
    raiz.setProperty('--gelo-borda', sb.borda); raiz.setProperty('--gelo-claro', sb.claro);
    raiz.setProperty('--gelo-meio', sb.meio); raiz.setProperty('--gelo-sombra', sb.sombra);
    raiz.setProperty('--drink-claro', sb.drink[0]); raiz.setProperty('--drink', sb.drink[1]); raiz.setProperty('--drink-escuro', sb.drink[2]);
    if (window.__gelo3d && window.__gelo3d.sabor) window.__gelo3d.sabor(sb);
  }
  // o módulo 3D carrega depois deste script: quando ele ficar pronto, recebe o sabor atual
  addEventListener('gelo3d-pronto', () => aplicarCores(sabor));
  centro.dataset.sabor = 'melancia';
  // ---------- carrossel: o leque inteiro gira até o sabor escolhido chegar ao centro ----------
  // 8 vagas em ordem (4 à esquerda, o centro, 3 à direita). Girar = todos andam o mesmo número de vagas;
  // quem passa da ponta some por um lado e volta pelo outro. Durante o giro, cópias "voam" pelas vagas.
  const vagas = [...leque.slice(0, 4), centro, ...leque.slice(4)];
  const CENTRO = 4, N = vagas.length;
  let girando = false, arrastou = -1e9;
  const anguloDe = (el) => (el === centro ? 0 : (parseFloat(el.style.getPropertyValue('--a')) || 0) * (parseFloat(el.style.getPropertyValue('--abre')) || 1));
  const srcDe = (el) => (el === centro ? foto.src : el.src);
  // os saquinhos do leque tem uma versao de 400 px para o celular (srcset): ao trocar de lugar, troca o par inteiro
  const trocarImg = (el, src) => { el.src = src; el.srcset = `${src.replace(/\.webp$/, '-400.webp')} 400w, ${src} 600w`; };
  function estadoDa(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: el.offsetWidth, h: el.offsetHeight, a: anguloDe(el) };
  }
  const quadroVoo = (c, extra = {}) => ({
    transform: `translate(${(c.x - c.w / 2).toFixed(1)}px, ${(c.y - c.h / 2).toFixed(1)}px) rotate(${c.a.toFixed(1)}deg)`,
    width: `${c.w.toFixed(1)}px`, height: `${c.h.toFixed(1)}px`, opacity: c.o ?? 1, ...extra,
  });
  const facilita = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  // curva suave por 4 pontos (Catmull-Rom): os saquinhos andam em arco, não em linha reta
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  function girar(passos) {
    if (girando || !passos) return;
    const estados = vagas.map(estadoDa);
    // vagas imaginárias além das pontas (invisíveis), para quem dá a volta sumir de um lado e voltar do outro
    const alem = (i) => {
      const [a, b] = i < 0 ? [estados[0], estados[1]] : [estados[N - 1], estados[N - 2]];
      return { x: a.x + (a.x - b.x), y: a.y + (a.y - b.y) * 1.3, w: a.w * 0.9, h: a.h * 0.9, a: a.a + (a.a - b.a) };
    };
    const tabela = [alem(-2), alem(-1), ...estados, alem(N), alem(N + 1)];  // índice = vaga + 2
    const estadoEm = (sv) => {
      const i = Math.floor(sv), t = sv - i, g = (k) => tabela[Math.max(0, Math.min(tabela.length - 1, k + 2))];
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      return {
        x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t),
        w: lerp(p1.w, p2.w, t), h: lerp(p1.h, p2.h, t), a: lerp(p1.a, p2.a, t),
        o: clamp(Math.min(sv + 0.6, N - 0.4 - sv) / 0.45),
      };
    };
    const saboresAntes = vagas.map((el) => el.dataset.sabor), srcs = vagas.map(srcDe);
    const depois = new Array(N), srcDepois = new Array(N);
    for (let j = 0; j < N; j++) { const t = (((j - passos) % N) + N) % N; depois[t] = saboresAntes[j]; srcDepois[t] = srcs[j]; }
    const novo = depois[CENTRO];
    if (reduzido) { aplicarGiro(depois, srcDepois); aplicarCores(SABORES[novo]); return; }
    girando = true;
    hero.classList.add('trocando-sabor');
    foto.src = srcDepois[CENTRO];   // já carrega o saquinho novo do centro enquanto gira
    const voadores = srcs.map((src) => {
      const v = new Image();
      v.src = src; v.alt = ''; v.className = 'saco-voando';
      document.body.appendChild(v);
      return v;
    });
    vagas.forEach((el) => { if (el === centro) telaSaco.style.visibility = 'hidden'; else el.style.opacity = '0'; });
    const dur = Math.min(1050, 480 + Math.abs(passos) * 120);
    const t0 = performance.now();
    let coresTrocadas = false, chegou = false;
    const passo = (agoraT) => {
      const k = clamp((agoraT - t0) / dur), e = facilita(k);
      voadores.forEach((v, j) => {
        let sv = j - passos * e;
        // quem passou de uma ponta continua vindo pela outra
        if (sv < -0.6) sv += N; else if (sv > N - 0.4) sv -= N;
        const st = estadoEm(sv);
        v.style.transform = `translate(${(st.x - st.w / 2).toFixed(1)}px, ${(st.y - st.h / 2).toFixed(1)}px) rotate(${st.a.toFixed(2)}deg)`;
        v.style.width = st.w.toFixed(1) + 'px';
        v.style.height = st.h.toFixed(1) + 'px';
        v.style.opacity = st.o.toFixed(3);
        v.style.zIndex = String(30 - Math.round(Math.abs(sv - CENTRO) * 2));
      });
      if (!coresTrocadas && e > 0.5) { coresTrocadas = true; aplicarCores(SABORES[novo]); }
      // o sabor novo encosta no centro: onda de cor atrás dele, na hora certa
      if (!chegou && e > 0.86) { chegou = true; ondaDeCor(); }
      if (k < 1) { requestAnimationFrame(passo); return; }
      aplicarGiro(depois, srcDepois);
      const prontas = [foto, ...leque].map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()));
      Promise.all(prontas).then(() => {
        chaveSaco = '';
        desenharSaco(0, 0, 0, 0, performance.now());
        telaSaco.style.visibility = '';
        leque.forEach((el) => { el.style.opacity = ''; });
        voadores.forEach((v) => v.remove());
        hero.classList.remove('trocando-sabor');
        centro.classList.remove('trocou'); void centro.offsetWidth; centro.classList.add('trocou');
        // o saquinho novo é espremido e solta o gelo da cor dele
        inicioSeq = performance.now() + 250;
        girando = false;
      });
    };
    requestAnimationFrame(passo);
  }
  const ondas = hero.querySelector('.ondas-sabor');
  function ondaDeCor() {
    if (!ondas) return;
    const r = centro.getBoundingClientRect(), pr = ondas.parentElement.getBoundingClientRect();
    ondas.style.left = (r.left + r.width / 2 - pr.left) + 'px';
    ondas.style.top = (r.top + r.height * 0.45 - pr.top) + 'px';
    ondas.classList.remove('pulsa'); void ondas.offsetWidth; ondas.classList.add('pulsa');
  }
  function aplicarGiro(depois, srcDepois) {
    vagas.forEach((el, i) => {
      const sb = SABORES[depois[i]];
      if (el === centro) {
        foto.src = srcDepois[i];
        centro.dataset.sabor = depois[i];
        centro.setAttribute('aria-label', `Saquinho King Gelo sabor ${sb.nome} sendo espremido`);
      } else {
        trocarImg(el, srcDepois[i]);
        el.dataset.sabor = depois[i];
        el.alt = `Saquinho King Gelo sabor ${sb.nome}`;
        el.setAttribute('aria-label', `Girar até o sabor ${sb.nome}`);
      }
    });
    chaveSaco = '';
    const anunciar = document.getElementById('sabor-escolhido');
    if (anunciar) anunciar.textContent = `Sabor ${SABORES[depois[CENTRO]].nome} no centro`;
  }
  foto.addEventListener('load', () => { chaveSaco = ''; });
  // qual saquinho está debaixo do mouse: pelo pixel visível da imagem, não pela caixa retangular
  // (os saquinhos se sobrepõem e a parte transparente de um cobria o vizinho)
  const mascaras = new Map();
  function mascara(src) {
    if (mascaras.has(src)) return mascaras.get(src);
    const img = new Image();
    const m = { pronta: false, w: 48, h: 0, a: null };
    img.onload = () => {
      m.h = Math.round((48 * img.naturalHeight) / img.naturalWidth);
      const c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, m.w, m.h);
      try { m.a = g.getImageData(0, 0, m.w, m.h).data; m.pronta = true; } catch (e) { /* sem leitura: cai na caixa */ }
    };
    img.src = src;
    mascaras.set(src, m);
    return m;
  }
  function opaco(src, u, v) {
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const m = mascara(src);
    if (!m.pronta) return true;
    const x = Math.min(m.w - 1, (u * m.w) | 0), y = Math.min(m.h - 1, (v * m.h) | 0);
    return m.a[(y * m.w + x) * 4 + 3] > 60;
  }
  const palcoLeque = hero.querySelector('.hero-pacotes');
  function saquinhoEm(cx0, cy0) {
    // o do centro fica por cima de todos
    const rc = centro.getBoundingClientRect();
    if (opaco(foto.src, (cx0 - rc.left) / rc.width, (cy0 - rc.top) / rc.height)) return null;
    const pr = palcoLeque.getBoundingClientRect();
    for (let i = leque.length - 1; i >= 0; i--) {
      const el = leque[i];
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w) continue;
      const cs = getComputedStyle(el);
      const [tx = 0, ty = 0] = (cs.translate === 'none' ? '0 0' : cs.translate).split(' ').map(parseFloat);
      const esc = cs.scale === 'none' ? 1 : parseFloat(cs.scale) || 1;
      const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
      const ang = (anguloDe(el) * Math.PI) / 180;
      // desfaz translate → escala → rotação em torno da origem, voltando para coordenadas da imagem
      let px = cx0 - pr.left - el.offsetLeft - ox - tx, py = cy0 - pr.top - el.offsetTop - oy - ty;
      px /= esc; py /= esc;
      const c = Math.cos(-ang), sn = Math.sin(-ang);
      const lx = px * c - py * sn + ox, ly = px * sn + py * c + oy;
      if (opaco(el.currentSrc || el.src, lx / w, ly / h)) return el;
    }
    return null;
  }
  let sobMouse = null;
  palcoLeque.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = girando ? null : saquinhoEm(e.clientX, e.clientY);
    if (el === sobMouse) return;
    if (sobMouse) sobMouse.classList.remove('sob-mouse');
    sobMouse = el;
    if (el) el.classList.add('sob-mouse');
    palcoLeque.style.cursor = el ? 'pointer' : '';
  });
  palcoLeque.addEventListener('pointerleave', () => {
    if (sobMouse) sobMouse.classList.remove('sob-mouse');
    sobMouse = null; palcoLeque.style.cursor = '';
  });
  palcoLeque.addEventListener('click', (e) => {
    // um arrasto que termina em cima de um saquinho também dispara clique: ignora logo depois de arrastar
    if (performance.now() - arrastou < 400) return;
    const el = saquinhoEm(e.clientX, e.clientY);
    if (el) girar(vagas.indexOf(el) - CENTRO);
  });
  vagas.forEach((el, i) => {
    if (el === centro) return;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', `Girar até o sabor ${(SABORES[el.dataset.sabor] || {}).nome || ''}`);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); girar(vagas.indexOf(el) - CENTRO); }
    });
  });
  // setas do teclado e arrastar para o lado (celular) giram uma vaga
  palcoLeque.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); girar(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); girar(1); }
  });
  let toqueX = null, toqueY = null;
  palcoLeque.addEventListener('pointerdown', (e) => { toqueX = e.clientX; toqueY = e.clientY; });
  palcoLeque.addEventListener('pointerup', (e) => {
    if (toqueX === null) return;
    const dx = e.clientX - toqueX, dy = e.clientY - toqueY;
    toqueX = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) { arrastou = performance.now(); girar(dx < 0 ? 1 : -1); }
  });

  medirSaco();
  medirTela();
  medirLayout();
  // o leque aberto não pode passar da borda da tela (com a folga do "crescer" do mouse): mede os saquinhos
  // e diminui todos juntos só o necessário. Medido sem a animação de flutuar e com a escala em 1.
  const palco = hero.querySelector('.hero-pacotes');
  function ajustarLeque() {
    if (girando) return;
    palco.style.setProperty('--leque-escala', 1);
    const limite = document.documentElement.clientWidth - 10, hb = hero.querySelector('.hero-palco').getBoundingClientRect().bottom;
    let esq = Infinity, dir = -Infinity, baixo = -Infinity;
    leque.forEach((el) => { const r = el.getBoundingClientRect(); esq = Math.min(esq, r.left); dir = Math.max(dir, r.right); baixo = Math.max(baixo, r.bottom); });
    if (!isFinite(dir)) return;
    const cx0 = (esq + dir) / 2, meia = ((dir - esq) / 2) * 1.12;   // folga: mouse por cima e o leque abrindo ao espremer
    let k = Math.min(1, (limite - cx0) / meia, (cx0 - 10) / meia);
    if (baixo > hb) k = Math.min(k, 0.97);
    palco.style.setProperty('--leque-escala', Math.max(0.6, k).toFixed(3));
  }
  let esperaLeque = 0;
  const reajustar = () => { clearTimeout(esperaLeque); esperaLeque = setTimeout(ajustarLeque, 120); };
  addEventListener('load', ajustarLeque);
  leque.forEach((el) => el.addEventListener('load', reajustar));
  ajustarLeque();
  addEventListener('resize', () => { medirSaco(); medirTela(); medirLayout(); chaveSaco = ''; reajustar(); });
  addEventListener('load', medirLayout);
  new ResizeObserver(() => medirLayout()).observe(document.body);
  new ResizeObserver(() => { medirSaco(); chaveSaco = ''; }).observe(centro);
  foto.decode?.().catch(() => {});
  requestAnimationFrame(quadro);

  // o gelo 3D (biblioteca de 690 KB e o preparo da luz, que trava o processador por quase 1 s no celular)
  // so comeca depois que o saquinho do topo carregou: o logo e o saquinho aparecem antes
  let pediu3d = false;
  const carregar3d = () => {
    if (pediu3d) return; pediu3d = true;
    import('./gelo3d.js').catch(() => {}).finally(() => { window.__gelo3dTentou = true; });
  };
  const depois = () => ('requestIdleCallback' in window ? requestIdleCallback(carregar3d, { timeout: 600 }) : setTimeout(carregar3d, 100));
  if (foto.complete) depois(); else { foto.addEventListener('load', depois, { once: true }); foto.addEventListener('error', depois, { once: true }); }
  setTimeout(carregar3d, 2500);  // rede muito lenta: nao espera a foto para sempre
})();
