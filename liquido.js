// Fronteiras líquidas: entre uma seção e outra, a borda das cores se comporta como dois líquidos.
// Quando o gelo atravessa, ele arrasta uma língua da cor de cima para dentro da de baixo (ou o inverso
// ao rolar para cima); a língua estica, solta gotas que se dissolvem e a borda volta ao normal em ondas.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const main = document.querySelector('main');
  if (!main) return;
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // celular e aparelho fraco: sem o filtro que funde as gotas (desfoque por quadro) e com menos gotas
  const leve = matchMedia('(pointer: coarse)').matches || innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4;

  const H = 340;          // metade da altura da faixa (quanto a cor pode invadir)
  const N = 72;           // pontos da "corda" ao longo da borda
  const blocos = [...main.children].filter((el) => el.matches('section, .faixa'));
  const camada = document.createElement('div');
  camada.id = 'liquidos';
  camada.setAttribute('aria-hidden', 'true');
  main.prepend(camada);

  const cor = (el) => getComputedStyle(el).backgroundColor;
  let largura = innerWidth;

  const bordas = [];
  for (let i = 0; i < blocos.length - 1; i++) {
    const cima = blocos[i], baixo = blocos[i + 1];
    if (cor(cima) === cor(baixo)) continue;
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('borda-liquida');
    const id = 'goo' + i;
    // o filtro "gosmento" só roda enquanto há gotas, e só na área delas (economiza muito processamento)
    svg.innerHTML = `
      <defs>
        <filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="10" height="10" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"/>
        </filter>
      </defs>
      <rect class="fundo-baixo" x="-40" y="0" width="100" height="10"/>
      <path class="superficie" id="sup${i}"/>
      <path class="brilho-liquido" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0"/>
      <g class="gotas-cima"></g>
      <g class="gotas-baixo"></g>`;
    // só as gotas passam pelo filtro "gosmento" (que funde as vizinhas). Uma cópia da superfície dentro do
    // filtro era cortada na borda da área dele e aparecia como quadrados no meio das ondas.
    camada.appendChild(svg);
    bordas.push({
      cima, baixo, svg,
      caminho: svg.querySelector('.superficie'),
      brilho: svg.querySelector('.brilho-liquido'),
      gotasCima: svg.querySelector('.gotas-cima'),
      gotasBaixo: svg.querySelector('.gotas-baixo'),
      fundo: svg.querySelector('.fundo-baixo'),
      filtro: svg.querySelector('filter'), filtroId: id, comFiltro: false,
      d: new Float32Array(N), v: new Float32Array(N),
      gotas: [], preso: false, relAnterior: null, dir: 1, ativa: true,
    });
  }

  function pintar() {
    largura = document.documentElement.clientWidth;
    const topoMain = main.getBoundingClientRect().top + scrollY;
    bordas.forEach((b) => {
      const y = b.baixo.offsetTop;
      b.topoDoc = topoMain + y;   // posição da borda no documento (evita medir o layout a cada quadro)
      // a faixa líquida nunca passa da altura das seções vizinhas
      b.hT = Math.min(H, b.cima.offsetHeight);
      b.hB = Math.min(H, b.baixo.offsetHeight);
      b.svg.style.top = y - b.hT + 'px';
      b.svg.setAttribute('viewBox', `0 0 ${largura} ${b.hT + b.hB}`);
      b.svg.setAttribute('width', largura);
      b.svg.setAttribute('height', b.hT + b.hB);
      b.fundo.setAttribute('y', b.hT);
      b.fundo.setAttribute('height', b.hB + 40);
      b.corCima = cor(b.cima); b.corBaixo = cor(b.baixo);
      b.fundo.setAttribute('width', largura + 80);
      b.fundo.style.fill = b.corBaixo;
      b.caminho.style.fill = b.corCima;
      b.gotasBaixo.style.fill = b.corBaixo;
      b.gotasCima.style.fill = b.corCima;
      b.ativa = true;
    });
  }

  function desenharSuperficie(b) {
    const passo = largura / (N - 1);
    const base = b.hT;
    // curva suave passando pelos pontos médios (sem quinas entre os pontos da corda)
    let d = `M-40 -60 L-40 ${(base + b.d[0]).toFixed(1)} L0 ${(base + b.d[0]).toFixed(1)}`;
    for (let i = 1; i < N; i++) {
      const xm = ((i - 0.5) * passo).toFixed(1), ym = (base + (b.d[i - 1] + b.d[i]) / 2).toFixed(1);
      d += ` Q${((i - 1) * passo).toFixed(1)} ${(base + b.d[i - 1]).toFixed(1)} ${xm} ${ym}`;
    }
    const fim = ` L${largura} ${(base + b.d[N - 1]).toFixed(1)} L${largura + 40} ${(base + b.d[N - 1]).toFixed(1)}`;
    b.caminho.setAttribute('d', d + fim + ` L${largura + 40} -60 Z`);
    const linha = d.replace(/^M-40 -60 L/, 'M') + fim;
    b.brilho.setAttribute('d', linha);
    // a mesma borda fechada para baixo: o "corpo" da cor de baixo para as gotas dela grudarem
  }

  function novaGota(b, grupo, x, y, vx, vy, r, g, vida = 1) {
    const c = document.createElementNS(NS, 'ellipse');
    grupo.appendChild(c);
    b.gotas.push({ c, x, y, vx, vy, r, g, vida, max: vida });
  }
  // a língua arrebenta: gotas da cor arrastada seguem o gelo e se dissolvem
  function soltarGotas(b, x, ponta, dir) {
    const grupo = dir > 0 ? b.gotasCima : b.gotasBaixo;
    for (let j = 0; j < (leve ? 6 : 11); j++) {
      novaGota(b, grupo, x + (Math.random() - 0.5) * 90, b.hT + ponta,
        (Math.random() - 0.5) * 260, dir * (180 + Math.random() * 420), 10 + Math.random() * 22, 0, 1.1);
    }
  }
  // impacto: quando o gelo fura a borda, a outra cor espirra para trás como uma coroa
  function espirrar(b, x, largura, dir) {
    const grupo = dir > 0 ? b.gotasBaixo : b.gotasCima;
    for (let j = 0; j < (leve ? 8 : 15); j++) {
      const lado = Math.random() < 0.5 ? -1 : 1;
      novaGota(b, grupo, x + lado * (largura * 0.5 + Math.random() * 40), b.hT,
        lado * (120 + Math.random() * 420), -dir * (260 + Math.random() * 560), 5 + Math.random() * 15, dir * 1500, 1.2);
    }
  }

  let ultimo = performance.now();
  function quadro(t) {
    const dt = Math.min(0.033, (t - ultimo) / 1000);
    ultimo = t;
    const g = window.__gelo;
    const passo = largura / (N - 1);

    bordas.forEach((b) => {
      const yTela = b.topoDoc - scrollY;
      if (yTela < -H * 2 || yTela > innerHeight + H * 2) { b.relAnterior = null; return; }

      // gelo atravessando esta borda?
      let agarrando = false;
      if (g && g.visivel && !reduzido) {
        const rel = g.y - yTela; // > 0: centro do gelo abaixo da borda
        if (b.relAnterior !== null && Math.abs(rel - b.relAnterior) > 0.5) b.dir = Math.sign(rel - b.relAnterior);
        // a frente do bloco acabou de furar a borda: chute nas ondas + coroa de respingos
        const frente = rel + b.dir * g.h / 2, frenteAntes = b.relAnterior === null ? null : b.relAnterior + b.dir * g.h / 2;
        if (frenteAntes !== null && Math.sign(frente) !== Math.sign(frenteAntes) && Math.abs(rel - b.relAnterior) < g.h) {
          const sig = g.w * 1.6;
          for (let i = 0; i < N; i++) {
            const dx = (i * passo - g.x) / sig;
            b.v[i] += b.dir * 900 * Math.exp(-dx * dx) - b.dir * 520 * Math.exp(-(((Math.abs(i * passo - g.x) - sig) / (sig * 0.5)) ** 2));
          }
          espirrar(b, g.x, g.w, b.dir);
          b.agitadaAte = t + 1500;
        }
        b.relAnterior = rel;
        const meio = g.h / 2;
        const entrou = b.dir > 0 ? rel > -meio && rel < meio + 240 : rel < meio && rel > -meio - 240;
        if (entrou) {
          agarrando = true;
          const alvo = Math.max(-b.hT * 0.92, Math.min(b.hB * 0.92, 0.95 * (rel + b.dir * meio)));
          const sigma = g.w * 0.85;
          for (let i = 0; i < N; i++) {
            const dx = (i * passo - g.x) / sigma;
            const peso = Math.exp(-dx * dx);
            if (peso > 0.01) b.d[i] += (alvo * peso - b.d[i]) * Math.min(1, 14 * dt) * peso;
          }
        }
        if (b.preso && !agarrando) {
          const iMeio = Math.round(g.x / passo);
          soltarGotas(b, g.x, b.d[Math.max(0, Math.min(N - 1, iMeio))] * 0.8, b.dir);
        }
        b.preso = agarrando;
      }

      // ondulação calma o tempo todo enquanto a borda está na tela: o líquido nunca fica "congelado"
      // (no modo leve a borda fica parada até o gelo passar, para não redesenhar sem parar no celular)
      if (!reduzido && !leve) {
        for (let i = 0; i < N; i++) {
          const x = i / (N - 1);
          b.v[i] += (Math.sin(t * 0.0011 + x * 9) + 0.6 * Math.sin(t * 0.0017 - x * 15 + 1.3)) * 150 * dt;
        }
      }
      // física da corda: mola de volta ao zero + tensão entre vizinhos + amortecimento
      let energia = 0;
      for (let sub = 0; sub < 2; sub++) {
        const h = dt / 2;
        for (let i = 0; i < N; i++) {
          const e = i > 0 ? b.d[i - 1] : b.d[i];
          const di = i < N - 1 ? b.d[i + 1] : b.d[i];
          const a = -34 * b.d[i] + 1400 * (e + di - 2 * b.d[i]) / Math.max(1, passo / 10) - 3.6 * b.v[i];
          b.v[i] += a * h;
        }
        for (let i = 0; i < N; i++) b.d[i] += b.v[i] * h;
      }
      for (let i = 0; i < N; i++) energia += Math.abs(b.d[i]) + Math.abs(b.v[i]) * 0.05;

      // gotas se dissolvendo na outra cor
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      b.gotas = b.gotas.filter((p) => {
        p.vida -= dt * 0.9;
        p.vy += p.g * dt;
        p.vy *= 1 - 1.4 * dt; p.vx *= 1 - 1.8 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const r = Math.max(0, p.r * Math.min(1, (p.vida / p.max) * 1.4));
        // gota esticada no sentido do movimento
        const vel = Math.hypot(p.vx, p.vy);
        const estica = 1 + Math.min(1.3, vel / 650);
        p.c.setAttribute('cx', p.x.toFixed(1));
        p.c.setAttribute('cy', p.y.toFixed(1));
        p.c.setAttribute('rx', (r / Math.sqrt(estica)).toFixed(1));
        p.c.setAttribute('ry', (r * estica).toFixed(1));
        p.c.setAttribute('transform', `rotate(${(Math.atan2(p.vy, p.vx) * 180 / Math.PI - 90).toFixed(0)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        if (p.vida <= 0) { p.c.remove(); return false; }
        x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r); y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r);
        return true;
      });
      const precisaFiltro = !leve && b.gotas.length > 0;
      if (precisaFiltro) {
        Object.entries({ x: x0 - 30, y: y0 - 30, width: x1 - x0 + 60, height: y1 - y0 + 60 }).forEach(([k, v]) => b.filtro.setAttribute(k, v.toFixed(0)));
      }
      if (precisaFiltro !== b.comFiltro) {
        [b.gotasCima, b.gotasBaixo].forEach((g) => (precisaFiltro ? g.setAttribute('filter', `url(#${b.filtroId})`) : g.removeAttribute('filter')));
        b.comFiltro = precisaFiltro;
      }

      // brilho molhado e sombra de profundidade aparecem quando a borda é agitada
      const agito = Math.min(1, energia / 2500);
      if (Math.abs(agito - (b.agito || 0)) > 0.01) {
        b.brilho.setAttribute('opacity', (0.12 + 0.45 * agito).toFixed(2));
        b.agito = agito;
      }
      // agitada: todo quadro; só a ondulação calma: ~30 quadros por segundo bastam e poupam bateria
      if (agarrando || b.gotas.length) b.agitadaAte = t + 1500;
      const agitada = t < (b.agitadaAte || 0);
      if (agitada || b.ativa || (leve ? energia > 1 : t - (b.ultimoDesenho || 0) > 50)) { desenharSuperficie(b); b.ultimoDesenho = t; }
      b.ativa = agitada;
    });

    requestAnimationFrame(quadro);
  }

  pintar();
  bordas.forEach(desenharSuperficie);
  addEventListener('resize', pintar);
  addEventListener('load', pintar);
  new ResizeObserver(pintar).observe(document.body);
  requestAnimationFrame(quadro);
})();
