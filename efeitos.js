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

  // ---------- unidade mais perto: os botões de WhatsApp perguntam antes de abrir ----------
  // (sem JS, ou em navegador sem <dialog>, o link segue direto para a matriz em Cametá)
  const UNIDADES = { cameta: '5591993561705', tucurui: '5594984385947' };
  const lerUnidade = () => { try { return localStorage.getItem('kg_unidade'); } catch { return null; } };
  const gravarUnidade = (u) => { try { localStorage.setItem('kg_unidade', u); } catch {} };
  const linkZap = (unidade, texto) => `https://wa.me/${UNIDADES[unidade]}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
  // conta o contato para a unidade no painel do dono (nada pessoal: só a unidade, de onde veio e o sabor)
  const registrarContato = (unidade, origem, detalhe = '') => {
    fetch('/api/publico/contato', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ unidade, origem, detalhe }),
    }).catch(() => {});
  };

  const janela = document.getElementById('escolha-unidade');
  let escolhendo = null; // o botão que abriu a janela: { origem, detalhe }
  if (janela && typeof janela.showModal === 'function') {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-origem]');
      // Ctrl/meio do mouse: abre direto, como um link comum
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const texto = new URL(a.href).searchParams.get('text') || '';
      escolhendo = { origem: a.dataset.origem, detalhe: a.dataset.detalhe || '' };
      const ultima = lerUnidade();
      janela.querySelectorAll('.escolha').forEach((op) => {
        op.href = linkZap(op.dataset.unidade, texto);
        op.classList.toggle('ultima', op.dataset.unidade === ultima);
      });
      janela.showModal();
      (janela.querySelector('.escolha.ultima') || janela.querySelector('.escolha')).focus();
    });
    janela.addEventListener('click', (e) => {
      const op = e.target.closest('.escolha');
      if (op) {
        gravarUnidade(op.dataset.unidade);
        registrarContato(op.dataset.unidade, escolhendo?.origem || 'contato', escolhendo?.detalhe);
        setTimeout(() => janela.close(), 0); // o link abre o WhatsApp normalmente
        return;
      }
      // toque no fundo escuro, fora da caixa, fecha
      const r = janela.getBoundingClientRect();
      if (e.target === janela && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) janela.close();
    });
  }
  // número direto (cartões das unidades, contato, rodapé) ou link aberto sem a janela: conta para a unidade do número
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="https://wa.me/"]');
    if (!a || e.defaultPrevented || a.closest('#escolha-unidade')) return;
    const num = a.getAttribute('href').slice(14).split(/[?/]/)[0];
    const unidade = Object.keys(UNIDADES).find((k) => UNIDADES[k] === num);
    if (unidade) registrarContato(unidade, a.dataset.origem || 'contato', a.dataset.detalhe);
  });

  // formulário de revenda: monta a mensagem e abre o WhatsApp da unidade escolhida
  const form = document.getElementById('form-revenda');
  const formUnidade = document.getElementById('form-unidade');
  if (formUnidade && UNIDADES[lerUnidade()]) formUnidade.value = lerUnidade();
  // a cidade digitada já sugere a unidade
  form?.elements.cidade?.addEventListener('change', (e) => {
    const c = e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/tucurui/.test(c)) formUnidade.value = 'tucurui';
    else if (/cameta|baiao|mocajuba|limoeiro|curucambaba|umarizal|porto grande|carapajo|bom jardim/.test(c)) formUnidade.value = 'cameta';
  });
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
    const unidade = UNIDADES[d.get('unidade')] ? d.get('unidade') : 'cameta';
    gravarUnidade(unidade);
    window.open(linkZap(unidade, msg), '_blank', 'noopener');
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
