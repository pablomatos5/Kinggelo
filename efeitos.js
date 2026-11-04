// Efeitos de texto e cards: títulos que sobem palavra por palavra, destaque líquido na palavra-chave,
// revelação ao rolar, números que contam, linha de progresso dos passos e cards de sabor em 3D.
(() => {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toque = matchMedia('(hover: none)').matches;

  // títulos: cada palavra numa "janela" para subir de baixo
  document.querySelectorAll('.secao h2').forEach((h) => {
    const partes = [];
    h.childNodes.forEach((n) => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach((p) => partes.push(p.trim() ? `<span class="palavra"><span>${p}</span></span>` : p));
      else if (n.nodeName === 'EM') partes.push(`<em><span class="palavra"><span>${n.textContent}</span></span></em>`);
      else partes.push(n.outerHTML);
    });
    h.innerHTML = partes.join('');
    h.querySelectorAll('.palavra > span').forEach((el, i) => el.style.setProperty('--i', i));
    h.classList.add('revela-titulo');
  });

  const alvos = document.querySelectorAll(
    '.revela-titulo, .sobre, .secao-lead, .sabor, .beneficio, .unidade, .pergunta, .passos li, .dica, .plano, .galeria figure, .contato p, .form-revenda, .contato-info, .galeria-insta, .hero-frase'
  );
  alvos.forEach((el) => {
    el.classList.add('revela');
    const irmaos = [...el.parentElement.children].filter((c) => c.matches(el.tagName));
    el.style.setProperty('--atraso', `${Math.min(irmaos.indexOf(el), 6) * 90}ms`);
  });

  function contar(el) {
    const fim = +el.dataset.conta, suf = el.dataset.sufixo || '';
    if (reduzido) { el.textContent = fim + suf; return; }
    const t0 = performance.now(), dur = 1300;
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3;
      el.textContent = Math.round(fim * e) + suf;
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  const io = new IntersectionObserver((itens) => {
    itens.forEach((it) => {
      if (!it.isIntersecting) return;
      it.target.classList.add('visivel');
      // depois de revelado, o card passa a responder rápido à inclinação do mouse
      setTimeout(() => it.target.classList.add('pronto'), 1400);
      it.target.querySelectorAll?.('[data-conta]').forEach(contar);
      io.unobserve(it.target);
    });
  // dispara antes de o conteúdo entrar na tela: quando ele aparece já está no lugar
  }, { threshold: 0, rootMargin: '0px 0px 25% 0px' });
  alvos.forEach((el) => io.observe(el));
  document.querySelectorAll('.hero-fatos').forEach((el) => io.observe(el));

  // linha dos passos enche conforme a rolagem
  const passos = document.querySelector('.passos');
  if (passos) {
    const atualizar = () => {
      const r = passos.getBoundingClientRect();
      // longe da tela: nada a fazer (evita medir os passos em toda rolagem da página)
      if (r.bottom < -innerHeight || r.top > innerHeight * 2) return;
      const k = Math.min(1, Math.max(0, (innerHeight * 0.65 - r.top) / r.height));
      passos.style.setProperty('--progresso', k.toFixed(3));
      passos.querySelectorAll('li').forEach((li) => {
        const rl = li.getBoundingClientRect();
        li.classList.toggle('ativo', rl.top + rl.height / 2 < innerHeight * 0.65);
      });
    };
    let pendente = false;
    addEventListener('scroll', () => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(() => { pendente = false; atualizar(); });
    }, { passive: true });
    atualizar();
  }

  // cards de sabor: inclinação 3D e reflexo seguindo o mouse
  if (!toque && !reduzido) {
    document.querySelectorAll('.sabor:not(.sabor-cta), .plano').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
        card.style.setProperty('--ry', `${(x - 0.5) * 12}deg`);
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  // formulário de revenda: monta a mensagem e abre o WhatsApp do King Gelo
  const form = document.getElementById('form-revenda');
  const abertoEm = Date.now();
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const msg = [
      'Olá King Gelo! Quero revender 👑',
      `Nome: ${d.get('nome')}`,
      `Estabelecimento: ${d.get('ponto')} (${d.get('tipo')})`,
      `Cidade: ${d.get('cidade')}`,
      `WhatsApp: ${d.get('telefone')}`,
      `Quantidade por semana: ${d.get('volume')}`,
      'Pode me enviar a tabela de atacado?',
    ].join('\n');
    // registra o interessado no painel do dono (se o servidor do painel estiver no ar)
    fetch('/api/publico/revenda', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      // quanto tempo a página ficou aberta: robô envia em menos de 2 segundos
      body: JSON.stringify({ ...Object.fromEntries(d), tempo: Date.now() - abertoEm }),
    }).catch(() => {});
    window.open('https://wa.me/5591993561705?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  // decodifica todas as imagens com antecedência para não engasgar quando aparecerem
  const preparar = () => document.querySelectorAll('img').forEach((img) => img.decode?.().catch(() => {}));
  (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(preparar);

  // ano do rodapé (fora do HTML: a política de segurança não permite script embutido)
  const ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();

  // animações decorativas (bolhas, ondas, faixa) só rodam enquanto estão na tela
  const pausaveis = document.querySelectorAll('.sabor, .faixa, .sabor-cta, .hero');
  const naTela = new IntersectionObserver((itens) => itens.forEach((it) => it.target.classList.toggle('em-tela', it.isIntersecting)), { rootMargin: '15% 0px' });
  pausaveis.forEach((el) => naTela.observe(el));

  // onde encontrar: filtro dos pontos de venda por cidade
  const filtros = document.querySelectorAll('.filtro');
  if (filtros.length) {
    const pontos = [...document.querySelectorAll('.ponto:not(.ponto-novo)')];
    const anuncio = document.getElementById('pontos-anuncio');
    filtros.forEach((bt) => bt.addEventListener('click', () => {
      const cidade = bt.dataset.cidade;
      filtros.forEach((b) => { b.classList.toggle('ativo', b === bt); b.setAttribute('aria-pressed', String(b === bt)); });
      let n = 0;
      pontos.forEach((li) => {
        const mostra = cidade === 'todas' || li.dataset.cidade === cidade;
        li.hidden = !mostra;
        if (mostra) { li.style.animationDelay = `${Math.min(n, 12) * 35}ms`; li.style.animation = 'none'; void li.offsetWidth; li.style.animation = ''; n++; }
      });
      if (anuncio) anuncio.textContent = `${n} ${n === 1 ? 'ponto' : 'pontos'} de venda`;
    }));
  }

  // menu do celular
  const botao = document.querySelector('.menu-botao'), menu = document.getElementById('menu-principal');
  if (botao && menu) {
    const alternar = (abrir) => {
      menu.classList.toggle('aberto', abrir);
      botao.setAttribute('aria-expanded', String(abrir));
      botao.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
      document.body.style.overflow = abrir ? 'hidden' : '';
    };
    botao.addEventListener('click', () => alternar(!menu.classList.contains('aberto')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) alternar(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') alternar(false); });
    // girou o tablet / alargou a janela com o menu aberto: fecha, senão a página fica sem rolar
    matchMedia('(min-width: 1101px)').addEventListener('change', (e) => { if (e.matches) alternar(false); });
  }
})();
