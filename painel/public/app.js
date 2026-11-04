// Painel do dono da King Gelo: início, pedidos, clientes, estoque, avisos de reposição e ajustes.
(() => {
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const modalConteudo = document.getElementById('modal-conteudo');

  // ---------- utilidades ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reais = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const paraCentavos = (v) => Math.round(parseFloat(String(v).replace(/\./g, '').replace(',', '.')) * 100) || 0;
  const deCentavos = (c) => (Number(c || 0) / 100).toFixed(2).replace('.', ',');
  const dataDe = (s) => (s ? new Date(s.replace(' ', 'T') + (s.length <= 19 ? 'Z' : '')) : null);
  const quando = (s) => {
    const d = dataDe(s);
    if (!d) return '';
    const dias = Math.floor((Date.now() - d) / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 30) return `há ${dias} dias`;
    return d.toLocaleDateString('pt-BR');
  };
  const dataHora = (s) => dataDe(s)?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) || '';
  const iniciais = (n) => esc(String(n || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase());
  const fone = (t) => {
    const n = String(t || '').replace(/\D/g, '');
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n;
  };
  const whats = (t, msg = '') => {
    const n = String(t || '').replace(/\D/g, '');
    return n ? `https://wa.me/${n.length <= 11 ? '55' + n : n}${msg ? '?text=' + encodeURIComponent(msg) : ''}` : null;
  };
  const imgSabor = (slug) => `/img/cliente/pacote-${encodeURIComponent(slug)}.webp`;
  const STATUS = { novo: 'Novo', confirmado: 'Confirmado', entregue: 'Entregue', cancelado: 'Cancelado' };
  const NIVEL = { acabando: 'Acabando', atencao: 'Atenção', ok: 'Em dia', 'sem-pedidos': 'Sem pedidos' };
  const TIPOS = ['Casa de bebidas', 'Mercado / supermercado', 'Distribuidora', 'Bar / restaurante', 'Outro'];

  const ICONES = {
    inicio: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    pedidos: '<path d="M6 3h12l1 4H5zM5 7h14l-1.2 12.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 11h6" stroke="#fff" stroke-width="1.8"/>',
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-4 3.3-6 6.5-6s5.9 2 6.5 6z"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.2c2.9.1 5 1.9 5.7 5.8h-4.2"/>',
    estoque: '<path d="M3 8 12 3l9 5v10l-9 5-9-5z"/><path d="m3 8 9 5 9-5M12 13v10" stroke="#fff" stroke-width="1.6" fill="none"/>',
    avisos: '<path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0z"/>',
    ajustes: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 4.7v-2.4l-2.4-.6-.6-1.5 1.3-2.1-1.7-1.7-2.1 1.3-1.5-.6L13.4 3h-2.4l-.6 2.4-1.5.6-2.1-1.3-1.7 1.7 1.3 2.1-.6 1.5L3 10.8v2.4l2.4.6.6 1.5-1.3 2.1 1.7 1.7 2.1-1.3 1.5.6.6 2.4h2.4l.6-2.4 1.5-.6 2.1 1.3 1.7-1.7-1.3-2.1.6-1.5z"/>',
    zap: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/>',
    mais: '<path d="M11 4h2v16h-2z"/><path d="M4 11h16v2H4z"/>',
    sair: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5v-2H6V6h4z"/><path d="m15 7-1.4 1.4 2.6 2.6H9v2h7.2l-2.6 2.6L15 17l5-5z"/>',
  };
  const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONES[n]}</svg>`;

  function toast(msg, erro = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (erro ? ' erro' : '');
    el.textContent = msg;
    document.getElementById('avisos-toast').appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  async function api(metodo, url, corpo) {
    const r = await fetch(url, {
      method: metodo,
      headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      credentials: 'same-origin',
    });
    const dados = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/login') { telaLogin(); throw new Error('Faça login'); }
    if (!r.ok) throw new Error(dados.erro || 'Algo deu errado');
    return dados;
  }

  function abrirModal(html, aoEnviar) {
    modalConteudo.innerHTML = html;
    modal.showModal();
    modalConteudo.onsubmit = async (e) => {
      const botao = e.submitter;
      if (botao?.value === 'cancelar') return;
      e.preventDefault();
      try {
        botao && (botao.disabled = true);
        await aoEnviar(new FormData(modalConteudo));
        modal.close();
      } catch (err) {
        const erroEl = modalConteudo.querySelector('.erro-form');
        if (erroEl) erroEl.textContent = err.message; else toast(err.message, true);
      } finally { botao && (botao.disabled = false); }
    };
  }

  // ---------- login ----------
  function telaLogin() {
    app.innerHTML = `
      <main class="login">
        <form class="login-caixa form" id="form-login">
          <div class="login-marca"><img src="/img/cliente/logo-gelo.webp" alt="King Gelo"></div>
          <p class="login-titulo">Painel Administrativo</p>
          <label class="campo">Usuário<input name="usuario" autocomplete="username" required autofocus></label>
          <label class="campo">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
          <p class="erro-form" id="erro-login"></p>
          <button class="btn btn-azul btn-bloco" type="submit">Entrar</button>
        </form>
      </main>`;
    document.getElementById('form-login').onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(e.target);
      try {
        await api('POST', '/api/login', { usuario: d.get('usuario'), senha: d.get('senha') });
        montarCasca();
        rota();
      } catch (err) { document.getElementById('erro-login').textContent = err.message; }
    };
  }

  // ---------- casca (menus) ----------
  const MENU = [['inicio', 'Início'], ['pedidos', 'Pedidos'], ['clientes', 'Clientes'], ['estoque', 'Estoque'], ['avisos', 'Avisos']];
  let principal;
  function montarCasca() {
    const links = (cls) => MENU.map(([k, n]) => `<a href="#/${k}" data-menu="${k}">${ic(k)}<span>${n}</span>${k === 'avisos' ? '<b class="selo-num oculto" data-contador></b>' : ''}</a>`).join('');
    app.innerHTML = `
      <div class="casca">
        <aside class="lateral">
          <div class="marca"><img src="/img/cliente/logo-gelo.webp" alt="King Gelo"></div>
          <nav class="nav">${links()}</nav>
          <div class="nav rodape-nav">
            <a href="#/ajustes" data-menu="ajustes">${ic('ajustes')}<span>Ajustes</span></a>
            <a href="/" target="_blank" rel="noopener">${ic('inicio')}<span>Ver o site</span></a>
          </div>
        </aside>
        <div>
          <header class="barra-topo"><img src="/img/cliente/logo-gelo.webp" alt="King Gelo"><a href="#/ajustes">Ajustes</a></header>
          <main class="principal" id="principal"></main>
        </div>
      </div>
      <nav class="nav-baixo" aria-label="Menu">${links()}</nav>`;
    principal = document.getElementById('principal');
  }
  function marcarMenu(nome) {
    document.querySelectorAll('[data-menu]').forEach((a) => { if (a.dataset.menu === nome) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function contadorAvisos(n) {
    document.querySelectorAll('[data-contador]').forEach((b) => { b.textContent = n; b.classList.toggle('oculto', !n); });
    document.title = (n ? `(${n}) ` : '') + 'Painel Administrativo · King Gelo';
  }

  // ---------- telas ----------
  // ---------- app no celular (PWA) ----------
  let pedidoInstalar = null; // evento do Android/Chrome para instalar com um toque
  const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const ehCelular = () => matchMedia('(max-width: 860px)').matches || ehIOS() || /android/i.test(navigator.userAgent);
  const lerLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const ICONE_COMPARTILHAR = '<svg class="ic-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Compartilhar"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>';
  function passosInstalar() {
    if (instalado()) return '<p class="meta">O painel já está aberto como app neste aparelho. ✅</p>';
    if (pedidoInstalar) return `<p class="meta">Coloque o painel na tela inicial do celular e abra como um app, sem precisar do navegador.</p>
      <button class="btn btn-azul" type="button" data-instalar>${ic('mais')} Instalar o app</button>`;
    if (ehIOS()) return `<p class="meta">No iPhone, abra este painel no <strong>Safari</strong> e:</p>
      <ol class="passos-app">
        <li>Toque em <strong>Compartilhar</strong> ${ICONE_COMPARTILHAR} na barra de baixo</li>
        <li>Role e toque em <strong>Adicionar à Tela de Início</strong></li>
        <li>Toque em <strong>Adicionar</strong>. O ícone da King Gelo aparece na tela do celular.</li>
      </ol>`;
    return `<p class="meta">No Android, abra este painel no <strong>Chrome</strong> e:</p>
      <ol class="passos-app">
        <li>Toque no menu <strong>⋮</strong> no canto de cima</li>
        <li>Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>)</li>
        <li>Confirme. O ícone da King Gelo aparece junto dos outros apps.</li>
      </ol>`;
  }
  function ligarInstalar(raiz) {
    raiz.querySelectorAll('[data-instalar]').forEach((b) => b.onclick = async () => {
      if (!pedidoInstalar) return;
      pedidoInstalar.prompt();
      const { outcome } = await pedidoInstalar.userChoice;
      pedidoInstalar = null;
      if (outcome === 'accepted') toast('App instalado! Procure o ícone da King Gelo.');
      rota();
    });
    raiz.querySelectorAll('[data-fechar-app]').forEach((b) => b.onclick = () => { gravarLocal('kg_app_dispensado', '1'); b.closest('.banner-app').remove(); });
  }
  const bannerApp = () => (!instalado() && ehCelular() && !lerLocal('kg_app_dispensado')) ? `
      <section class="cartao banner-app">
        <img src="/admin/icones/icone-192.png" alt="" width="56" height="56">
        <div><h2>Use o painel como app</h2><div data-passos>${passosInstalar()}</div></div>
        <button class="fechar" type="button" data-fechar-app aria-label="Não mostrar de novo">×</button>
      </section>` : '';

  async function telaInicio() {
    const r = await api('GET', '/api/resumo');
    contadorAvisos(r.avisosTotal);
    const maxVenda = Math.max(1, ...r.vendas.map((v) => v.unidades));
    const atrasado = r.receberFaixas.find((f) => f.chave === 'mais15').total;
    const producaoTotal = r.cobertura.reduce((t, p) => t + p.produzir, 0);
    principal.innerHTML = `
      <div class="topo-pagina">
        <div><h1>Início</h1><p class="sub">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <a class="btn btn-azul" href="#/pedidos/novo">${ic('mais')} Novo pedido</a>
      </div>
      ${bannerApp()}
      <div class="grade grade-4">
        <div class="cartao kpi"><div class="rotulo">Vendido no mês</div><div class="valor">${reais(r.mes.total)}</div>
          <div class="det">${r.mes.qtd} pedidos${variacao(r.comparacao)}</div>
          ${r.comparacao.projecao !== null ? `<div class="det">No ritmo atual fecha em <strong>${reais(r.comparacao.projecao)}</strong></div>` : ''}</div>
        <div class="cartao kpi" style="--cor:var(--ouro)"><div class="rotulo">A receber</div><div class="valor">${reais(r.receber.total)}</div><div class="det">${r.receber.qtd} pedidos sem pagamento</div>
          ${atrasado ? `<div class="det atrasado">${reais(atrasado)} há mais de 15 dias</div>` : ''}</div>
        <div class="cartao kpi" style="--cor:var(--verde)"><div class="rotulo">Estoque total</div><div class="valor">${r.estoqueTotal}</div><div class="det">saquinhos · ${r.abertos} pedidos em aberto</div></div>
        <div class="cartao kpi ${r.avisosTotal ? 'alerta' : ''}"><div class="rotulo">Clientes para avisar</div><div class="valor">${r.avisosTotal}</div><div class="det">${r.leads} novos interessados</div></div>
      </div>
      <div class="grade grade-2" style="margin-top:16px">
        <section class="cartao">
          <h2>Avisar agora <a href="#/avisos">ver todos</a></h2>
          ${r.avisos.length ? `<div class="lista">${r.avisos.map(itemAviso).join('')}</div>` : '<div class="vazio"><strong>Tudo em dia</strong>Nenhum cliente com estoque acabando.</div>'}
        </section>
        <section class="cartao">
          <h2>Quanto o estoque aguenta <a href="#/estoque">gerenciar</a></h2>
          <p class="meta cartao-sub">Pela venda dos últimos 30 dias. Meta: ${r.coberturaMeta} dias de cada sabor.</p>
          <div class="barras-vendas cobertura">${r.cobertura.map((p) => {
            const nivel = p.dias === null ? 'parado' : p.dias <= 3 ? 'critico' : p.dias < r.coberturaMeta ? 'baixo' : 'ok';
            const larg = p.dias === null ? 100 : Math.min(100, (p.dias / r.coberturaMeta) * 100);
            return `<div class="linha cob-${nivel}"><span>${esc(p.nome)}</span>
              <div class="barra" style="--cor:${nivel === 'critico' ? 'var(--vermelho)' : nivel === 'baixo' ? 'var(--laranja)' : nivel === 'parado' ? '#c5ccd8' : esc(p.cor)}"><i style="width:${larg}%"></i></div>
              <span><strong>${p.dias === null ? 'sem venda' : p.dias === 0 ? 'acabou' : `${p.dias} ${p.dias === 1 ? 'dia' : 'dias'}`}</strong>${p.produzir ? `<small>produzir ${p.produzir}</small>` : ''}</span></div>`;
          }).join('')}
          </div>
          ${producaoTotal ? `<p class="dica-producao">Para ${r.coberturaMeta} dias de estoque, produza <strong>${producaoTotal} saquinhos</strong>.</p>` : ''}
        </section>
        <section class="cartao">
          <h2>Quem cobrar <a href="#/pedidos?f=areceber">ver pedidos</a></h2>
          <div class="faixas">${r.receberFaixas.map((f) => `
            <div class="faixa faixa-${f.chave}"><span>${FAIXA[f.chave]}</span><strong>${reais(f.total)}</strong><small>${f.clientes} ${f.clientes === 1 ? 'cliente' : 'clientes'}</small></div>`).join('')}
          </div>
          ${r.devedores.length ? `<div class="lista">${r.devedores.map((d) => itemContato(d, {
            avatar: d.dias > 15 ? 'var(--vermelho)' : d.dias > 7 ? 'var(--laranja)' : 'var(--ouro)',
            meta: `${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'} · em aberto ${d.dias === 0 ? 'desde hoje' : `há ${d.dias} ${d.dias === 1 ? 'dia' : 'dias'}`}`,
            valor: reais(d.total),
            whatsapp: whats(d.telefone, `Oi ${String(d.nome).split(' ')[0]}, tudo bem? Aqui é da King Gelo 👑 Passando para lembrar do pagamento de ${reais(d.total)} do gelo. Pode ser por Pix!`),
          })).join('')}</div>${r.devedoresTotal > r.devedores.length ? `<p class="meta mais-itens">e mais ${r.devedoresTotal - r.devedores.length}</p>` : ''}`
            : '<div class="vazio"><strong>Ninguém devendo</strong>Todos os pedidos estão pagos.</div>'}
        </section>
        <section class="cartao">
          <h2>Clientes sumidos ${r.sumidos.total ? `<span class="tag acabando">${r.sumidos.total}</span>` : ''}</h2>
          <p class="meta cartao-sub">Passaram bem do tempo que costumam levar para pedir de novo.</p>
          ${r.sumidos.lista.length ? `<div class="lista">${r.sumidos.lista.map((c) => itemContato(c, {
            avatar: 'var(--suave)',
            meta: `${esc(c.cidade)}${c.cidade ? ' · ' : ''}${c.diasSem} dias sem pedir (costuma pedir a cada ~${c.ciclo})`,
            whatsapp: c.whatsapp,
          })).join('')}</div>` : '<div class="vazio"><strong>Ninguém sumiu</strong>Todos os clientes estão comprando no ritmo de sempre.</div>'}
        </section>
        <section class="cartao">
          <h2>Interessados do site <a href="#/clientes?f=lead">ver todos</a></h2>
          <div class="funil">
            <div><strong>${r.leadsSite.total}</strong><span>cadastros em 90 dias</span></div>
            <div><strong>${r.leadsSite.compraram}</strong><span>já compraram</span></div>
            <div><strong>${r.leadsSite.total ? Math.round((r.leadsSite.compraram / r.leadsSite.total) * 100) + '%' : '–'}</strong><span>viraram cliente</span></div>
          </div>
          ${r.leadsSite.parados.length ? `<p class="meta cartao-sub">${r.leadsSite.paradosTotal} ${r.leadsSite.paradosTotal === 1 ? 'parado' : 'parados'} há mais de ${r.leadsSite.diasParado} dias sem comprar:</p>
            <div class="lista">${r.leadsSite.parados.map((l) => itemContato(l, {
              avatar: '#8b3fc4',
              meta: `${esc(l.cidade)}${l.cidade ? ' · ' : ''}${l.volume_informado ? esc(l.volume_informado) + ' · ' : ''}há ${l.dias} dias`,
              whatsapp: l.whatsapp,
            })).join('')}</div>` : '<div class="vazio"><strong>Nenhum interessado parado</strong>Todo mundo que se cadastrou já foi atendido.</div>'}
        </section>
        <section class="cartao">
          <h2>Mais vendidos (30 dias)</h2>
          <div class="barras-vendas">${r.vendas.map((v) => `
            <div class="linha"><span>${esc(v.nome)}</span><div class="barra" style="--cor:${esc(v.cor)}"><i style="width:${(v.unidades / maxVenda) * 100}%"></i></div><span>${v.unidades}</span></div>`).join('')}
          </div>
        </section>
        <section class="cartao">
          <h2>Vendas por cidade (30 dias)</h2>
          ${r.cidades.length ? `<div class="barras-vendas">${r.cidades.map((c) => `
            <div class="linha"><span>${esc(c.cidade)}</span><div class="barra"><i style="width:${(c.total / Math.max(1, r.cidades[0].total)) * 100}%"></i></div><span>${reais(c.total)}</span></div>
            <small class="meta" style="margin:-6px 0 4px">${c.unidades} saquinhos · ${c.clientes} ${c.clientes === 1 ? 'cliente' : 'clientes'}</small>`).join('')}</div>` : '<div class="vazio">Sem vendas nos últimos 30 dias.</div>'}
        </section>
        <section class="cartao">
          <h2>Últimos pedidos <a href="#/pedidos">ver todos</a></h2>
          ${r.ultimos.length ? `<div class="lista">${r.ultimos.map(itemPedido).join('')}</div>` : '<div class="vazio"><strong>Nenhum pedido ainda</strong>Cadastre o primeiro em “Novo pedido”.</div>'}
        </section>
      </div>`;    ligarInstalar(principal);
  }

  const itemPedido = (p) => `
    <a class="linha-item" href="#/pedidos/${p.id}">
      <span class="avatar" style="background:var(--marinho)">#${p.id}</span>
      <span><span class="titulo">${esc(p.estabelecimento || p.cliente_nome)}</span><br><span class="meta">${p.unidades} saquinhos · ${quando(p.criado_em)}</span></span>
      <span class="dir"><span class="tag ${p.status}">${STATUS[p.status]}</span><br><strong>${reais(p.total)}</strong>
        ${p.status !== 'cancelado' ? `<span class="tag ${p.pago ? 'pago' : 'apagar'}">${p.pago ? 'Pago' : 'A receber'}</span>` : ''}</span>
    </a>`;

  const FAIXA = { ate7: 'Até 7 dias', ate15: '8 a 15 dias', mais15: 'Mais de 15 dias' };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const variacao = (c) => {
    if (c.variacao === null) return '';
    const mesPassado = MESES[(new Date().getMonth() + 11) % 12];
    const classe = c.variacao > 0 ? 'sobe' : c.variacao < 0 ? 'desce' : 'igual';
    const seta = c.variacao > 0 ? '▲' : c.variacao < 0 ? '▼' : '=';
    return ` · <span class="variacao ${classe}" title="Comparado com ${mesPassado} até o mesmo dia (${reais(c.anteriorAteHoje)})">${seta} ${Math.abs(c.variacao)}% vs ${mesPassado}</span>`;
  };
  // linha com link para o cliente e botão de WhatsApp ao lado (sem link dentro de link)
  const itemContato = (c, o) => `
    <div class="linha-item">
      <span class="avatar" style="background:${o.avatar}">${iniciais(c.estabelecimento || c.nome)}</span>
      <span><a class="titulo" href="#/clientes/${c.id}">${esc(c.estabelecimento || c.nome)}</a><br><span class="meta">${o.meta}</span></span>
      <span class="dir">${o.valor ? `<strong>${o.valor}</strong>` : ''}
        ${o.whatsapp ? `<a class="btn-zap" href="${esc(o.whatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(c.estabelecimento || c.nome)}">${ic('zap')}</a>` : ''}</span>
    </div>`;

  const itemAviso = (c) => `
    <a class="linha-item" href="#/clientes/${c.id}">
      <span class="avatar" style="background:${c.previsao.nivel === 'acabando' ? 'var(--vermelho)' : 'var(--laranja)'}">${iniciais(c.estabelecimento || c.nome)}</span>
      <span><span class="titulo">${esc(c.estabelecimento || c.nome)}</span><br><span class="meta">~${c.previsao.restante} saquinhos restantes · ${c.previsao.diasRestantes ?? '?'} dias</span></span>
      <span class="dir"><span class="tag ${c.previsao.nivel}">${NIVEL[c.previsao.nivel]}</span></span>
    </a>`;

  // ----- pedidos -----
  async function telaPedidos(q) {
    const filtro = q.get('f') || '';
    const url = filtro === 'areceber' ? '/api/pedidos?pago=0' : filtro ? `/api/pedidos?status=${filtro}` : '/api/pedidos';
    const lista = await api('GET', url);
    const chips = [['', 'Todos'], ['novo', 'Novos'], ['confirmado', 'Confirmados'], ['entregue', 'Entregues'], ['areceber', 'A receber'], ['cancelado', 'Cancelados']];
    principal.innerHTML = `
      <div class="topo-pagina"><div><h1>Pedidos</h1><p class="sub">${lista.length} pedidos</p></div>
        <a class="btn btn-azul" href="#/pedidos/novo">${ic('mais')} Novo pedido</a></div>
      <div class="chips">${chips.map(([k, n]) => `<a class="chip" href="#/pedidos${k ? '?f=' + k : ''}" aria-pressed="${k === filtro}">${n}</a>`).join('')}</div>
      ${lista.length ? `<div class="lista">${lista.map(itemPedido).join('')}</div>` : '<div class="cartao vazio"><strong>Nenhum pedido aqui</strong>Os pedidos aparecem conforme você cadastra.</div>'}`;
  }

  async function telaNovoPedido(q) {
    const [clientes, produtos] = await Promise.all([api('GET', '/api/clientes'), api('GET', '/api/produtos')]);
    const ativos = produtos.filter((p) => p.ativo);
    const pre = q.get('cliente') || '';
    principal.innerHTML = `
      <a class="voltar" href="#/pedidos">← Pedidos</a>
      <div class="topo-pagina"><h1>Novo pedido</h1></div>
      <form class="grade" id="form-pedido" style="grid-template-columns:minmax(0,1fr)">
        <section class="cartao form">
          <div class="form-2">
            <label class="campo">Cliente
              <select name="cliente_id" required>
                <option value="">Escolha o cliente…</option>
                ${clientes.filter((c) => c.status !== 'inativo').map((c) => `<option value="${c.id}" ${String(c.id) === pre ? 'selected' : ''}>${esc(c.estabelecimento || c.nome)} — ${esc(c.nome)}${c.status === 'lead' ? ' (novo)' : ''}</option>`).join('')}
              </select>
              <small><a href="#/clientes/novo">+ cadastrar cliente novo</a></small>
            </label>
            <label class="campo">Situação
              <select name="status"><option value="novo">Novo (ainda não saiu do estoque)</option><option value="confirmado" selected>Confirmado (já separa do estoque)</option><option value="entregue">Entregue</option></select>
            </label>
          </div>
        </section>
        <section class="cartao">
          <h2>Sabores e quantidades</h2>
          <div class="sabores-grade">${ativos.map((p) => `
            <div class="sabor-cartao" style="--cor:${esc(p.cor)}" data-produto="${p.id}" data-preco="${p.preco_atacado}">
              <img src="${imgSabor(p.slug)}" alt="">
              <div><div class="nome">${esc(p.nome)}</div><small class="meta">estoque: ${p.estoque}</small>
                <div class="passador"><button type="button" data-delta="-10" aria-label="Menos 10">−</button><input inputmode="numeric" value="0" aria-label="Quantidade de ${esc(p.nome)}"><button type="button" data-delta="10" aria-label="Mais 10">+</button></div>
              </div>
            </div>`).join('')}
          </div>
        </section>
        <section class="cartao form">
          <div class="form-2">
            <label class="campo">Preço por saquinho (R$)<input name="preco" inputmode="decimal" placeholder="usa o preço de atacado de cada sabor"><small>Deixe vazio para usar o preço de atacado cadastrado no estoque.</small></label>
            <label class="campo">Pagamento<select name="pagamento"><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="prazo">A prazo</option></select></label>
          </div>
          <label class="check"><input type="checkbox" name="pago"> Já está pago</label>
          <label class="campo">Observações<textarea name="observacoes" placeholder="Entrega, combinados…"></textarea></label>
          <div class="total-linha"><span><span id="total-unidades">0</span> saquinhos</span><span class="valor" id="total-valor">${reais(0)}</span></div>
          <p class="erro-form" id="erro-pedido"></p>
          <button class="btn btn-azul btn-bloco" type="submit">Salvar pedido</button>
        </section>
      </form>`;
    const form = document.getElementById('form-pedido');
    const somar = () => {
      let un = 0, total = 0;
      const precoGeral = form.elements.preco.value.trim() ? paraCentavos(form.elements.preco.value) : null;
      form.querySelectorAll('[data-produto]').forEach((el) => {
        const q = Math.max(0, parseInt(el.querySelector('input').value, 10) || 0);
        el.classList.toggle('tem', q > 0);
        un += q; total += q * (precoGeral ?? +el.dataset.preco);
      });
      document.getElementById('total-unidades').textContent = un;
      document.getElementById('total-valor').textContent = reais(total);
    };
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-delta]');
      if (!b) return;
      const inp = b.parentElement.querySelector('input');
      inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + +b.dataset.delta);
      somar();
    });
    form.addEventListener('input', somar);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const precoGeral = form.elements.preco.value.trim() ? paraCentavos(form.elements.preco.value) : null;
      const itens = [...form.querySelectorAll('[data-produto]')].map((el) => ({
        produto_id: +el.dataset.produto, quantidade: parseInt(el.querySelector('input').value, 10) || 0, preco_unit: precoGeral,
      })).filter((i) => i.quantidade > 0);
      try {
        const p = await api('POST', '/api/pedidos', {
          cliente_id: form.elements.cliente_id.value, status: form.elements.status.value, pagamento: form.elements.pagamento.value,
          pago: form.elements.pago.checked, observacoes: form.elements.observacoes.value, itens,
        });
        toast(`Pedido #${p.id} salvo`);
        location.hash = `#/pedidos/${p.id}`;
      } catch (err) { document.getElementById('erro-pedido').textContent = err.message; }
    };
  }

  async function telaPedido(id) {
    const p = await api('GET', `/api/pedidos/${id}`);
    const proximos = { novo: [['confirmado', 'Confirmar e separar do estoque', 'btn-azul'], ['entregue', 'Marcar entregue', 'btn-verde']], confirmado: [['entregue', 'Marcar entregue', 'btn-verde']], entregue: [], cancelado: [] }[p.status];
    const msg = `Oi ${p.cliente_nome.split(' ')[0]}! Aqui é da King Gelo 👑 Seu pedido #${p.id} (${p.unidades} saquinhos, ${reais(p.total)}) está ${STATUS[p.status].toLowerCase()}.`;
    principal.innerHTML = `
      <a class="voltar" href="#/pedidos">← Pedidos</a>
      <div class="topo-pagina">
        <div><h1>Pedido #${p.id}</h1><p class="sub">${dataHora(p.criado_em)} · <a href="#/clientes/${p.cliente_id}">${esc(p.estabelecimento || p.cliente_nome)}</a></p></div>
        <div class="acoes"><span class="tag ${p.status}">${STATUS[p.status]}</span>${p.status !== 'cancelado' ? `<span class="tag ${p.pago ? 'pago' : 'apagar'}">${p.pago ? 'Pago' : 'A receber'}</span>` : ''}</div>
      </div>
      <div class="grade grade-2">
        <section class="cartao">
          <h2>Itens</h2>
          <table class="tabela"><thead><tr><th>Sabor</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead>
            <tbody>${p.itens.map((i) => `<tr><td>${esc(i.nome)}</td><td class="num">${i.quantidade}</td><td class="num">${reais(i.preco_unit)}</td><td class="num">${reais(i.quantidade * i.preco_unit)}</td></tr>`).join('')}</tbody></table>
          <div class="total-linha"><span>${p.unidades} saquinhos</span><span class="valor">${reais(p.total)}</span></div>
        </section>
        <section class="cartao form">
          <h2>Ações</h2>
          <div class="acoes">
            ${proximos.map(([s, n, c]) => `<button class="btn ${c}" data-status="${s}">${n}</button>`).join('')}
            ${p.status !== 'cancelado' ? `<button class="btn btn-claro" data-pago="${p.pago ? 0 : 1}">${p.pago ? 'Desmarcar pagamento' : 'Marcar como pago'}</button>` : ''}
            ${whats(p.telefone) ? `<a class="btn btn-verde" href="${esc(whats(p.telefone, msg))}" target="_blank" rel="noopener">${ic('zap')} WhatsApp</a>` : ''}
            <button class="btn btn-claro" type="button" data-imprimir>Imprimir pedido</button>
          </div>
          <p class="meta">Pagamento: <strong>${esc(p.pagamento)}</strong>${p.entregue_em ? ` · entregue ${quando(p.entregue_em)}` : ''}${p.baixado ? ' · já saiu do estoque' : ''}</p>
          ${p.observacoes ? `<div class="mensagem" style="border-color:var(--azul)">${esc(p.observacoes)}</div>` : ''}
          ${p.status !== 'cancelado' ? '<button class="btn btn-claro" data-status="cancelado" style="color:var(--vermelho)">Cancelar pedido</button>' : ''}
        </section>
      </div>`;
    principal.querySelector('[data-imprimir]').onclick = () => print();
    principal.querySelectorAll('[data-status]').forEach((b) => b.onclick = async () => {
      if (b.dataset.status === 'cancelado' && !confirm('Cancelar este pedido? Se já saiu do estoque, os saquinhos voltam para o estoque.')) return;
      try { await api('PUT', `/api/pedidos/${p.id}/status`, { status: b.dataset.status }); toast('Pedido atualizado'); telaPedido(id); }
      catch (err) { toast(err.message, true); }
    });
    principal.querySelector('[data-pago]')?.addEventListener('click', async (e) => {
      await api('PUT', `/api/pedidos/${p.id}`, { pago: e.currentTarget.dataset.pago === '1' });
      toast('Pagamento atualizado'); telaPedido(id);
    });
  }

  // ----- clientes -----
  async function telaClientes(q) {
    const filtro = q.get('f') || '';
    const busca = q.get('b') || '';
    const lista = await api('GET', `/api/clientes?busca=${encodeURIComponent(busca)}${filtro ? '&status=' + filtro : ''}`);
    const chips = [['', 'Todos'], ['ativo', 'Ativos'], ['lead', 'Interessados'], ['inativo', 'Inativos']];
    principal.innerHTML = `
      <div class="topo-pagina"><div><h1>Clientes</h1><p class="sub">Casas de bebidas, mercados e distribuidoras</p></div>
        <a class="btn btn-azul" href="#/clientes/novo">${ic('mais')} Novo cliente</a></div>
      <form class="busca" id="form-busca"><input name="b" type="search" placeholder="Buscar por nome, loja, cidade ou telefone" value="${esc(busca)}"><button class="btn btn-claro">Buscar</button></form>
      <div class="chips">${chips.map(([k, n]) => `<a class="chip" href="#/clientes?f=${k}&b=${encodeURIComponent(busca)}" aria-pressed="${k === filtro}">${n}</a>`).join('')}</div>
      ${lista.length ? `<div class="lista">${lista.map((c) => `
        <a class="linha-item" href="#/clientes/${c.id}">
          <span class="avatar" style="background:${c.status === 'lead' ? '#8e44c9' : 'var(--azul)'}">${iniciais(c.estabelecimento || c.nome)}</span>
          <span><span class="titulo">${esc(c.estabelecimento || c.nome)}</span><br><span class="meta">${esc(c.nome)} · ${esc(c.cidade)} · ${esc(c.tipo)}</span></span>
          <span class="dir">${c.status !== 'ativo' ? `<span class="tag ${c.status}">${c.status === 'lead' ? 'Interessado' : 'Inativo'}</span>` : `<span class="tag ${c.previsao.nivel}">${NIVEL[c.previsao.nivel]}</span>`}
            ${c.previsao.porSemana ? `<br><span class="meta">~${c.previsao.porSemana}/semana</span>` : ''}</span>
        </a>`).join('')}</div>` : '<div class="cartao vazio"><strong>Nenhum cliente encontrado</strong>Cadastre ou ajuste a busca.</div>'}`;
    document.getElementById('form-busca').onsubmit = (e) => {
      e.preventDefault();
      location.hash = `#/clientes?f=${filtro}&b=${encodeURIComponent(e.target.elements.b.value)}`;
    };
  }

  function formCliente(c = {}) {
    return `
      <div class="form-2">
        <label class="campo">Nome do responsável<input name="nome" required value="${esc(c.nome)}"></label>
        <label class="campo">Estabelecimento<input name="estabelecimento" value="${esc(c.estabelecimento)}" placeholder="Ex.: Adega do João"></label>
        <label class="campo">Tipo<select name="tipo">${TIPOS.map((t) => `<option ${t === c.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo">Cidade<input name="cidade" value="${esc(c.cidade)}" placeholder="Cametá-PA"></label>
        <label class="campo">WhatsApp<input name="telefone" inputmode="tel" value="${esc(fone(c.telefone))}" placeholder="(91) 99999-9999"></label>
        <label class="campo">Situação<select name="status">${[['ativo', 'Ativo'], ['lead', 'Interessado'], ['inativo', 'Inativo']].map(([k, n]) => `<option value="${k}" ${k === (c.status || 'ativo') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="campo">Repõe a cada (dias)<input name="ciclo_dias" inputmode="numeric" value="${esc(c.ciclo_dias || '')}" placeholder="automático"><small>Opcional. Usado enquanto o cliente tem só 1 pedido.</small></label>
      </div>
      <label class="campo">Observações<textarea name="observacoes">${esc(c.observacoes)}</textarea></label>`;
  }
  const dadosCliente = (d) => ({
    nome: d.get('nome'), estabelecimento: d.get('estabelecimento'), tipo: d.get('tipo'), cidade: d.get('cidade'),
    telefone: d.get('telefone'), status: d.get('status'), ciclo_dias: d.get('ciclo_dias') || null, observacoes: d.get('observacoes'),
  });

  function telaNovoCliente() {
    principal.innerHTML = `
      <a class="voltar" href="#/clientes">← Clientes</a>
      <div class="topo-pagina"><h1>Novo cliente</h1></div>
      <form class="cartao form" id="form-cliente">${formCliente()}<p class="erro-form"></p><button class="btn btn-azul" type="submit">Salvar cliente</button></form>`;
    const f = document.getElementById('form-cliente');
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { const c = await api('POST', '/api/clientes', dadosCliente(new FormData(f))); toast('Cliente cadastrado'); location.hash = `#/clientes/${c.id}`; }
      catch (err) { f.querySelector('.erro-form').textContent = err.message; }
    };
  }

  async function telaCliente(id) {
    const c = await api('GET', `/api/clientes/${id}`);
    const pv = c.previsao;
    const cor = { acabando: 'var(--vermelho)', atencao: 'var(--laranja)', ok: 'var(--verde)' }[pv.nivel] || 'var(--linha)';
    principal.innerHTML = `
      <a class="voltar" href="#/clientes">← Clientes</a>
      <div class="topo-pagina">
        <div><h1>${esc(c.estabelecimento || c.nome)}</h1><p class="sub">${esc(c.nome)} · ${esc(c.tipo)} · ${esc(c.cidade)}${c.origem === 'site' ? ' · veio pelo site' : ''}</p></div>
        <div class="acoes">
          ${c.whatsapp ? `<a class="btn btn-verde" href="${esc(c.whatsapp)}" target="_blank" rel="noopener" data-avisar>${ic('zap')} WhatsApp</a>` : ''}
          <a class="btn btn-azul" href="#/pedidos/novo?cliente=${c.id}">${ic('mais')} Novo pedido</a>
        </div>
      </div>
      <div class="grade grade-2">
        <section class="cartao">
          <h2>Estoque estimado no ponto ${pv.nivel !== 'sem-pedidos' ? `<span class="tag ${pv.nivel}">${NIVEL[pv.nivel]}</span>` : ''}</h2>
          ${pv.nivel === 'sem-pedidos' ? `<div class="vazio"><strong>Ainda sem pedidos</strong>${c.volume_informado ? `Informou pelo site: ${esc(c.volume_informado)} por semana.` : 'A previsão aparece depois do primeiro pedido.'}</div>` : `
            <div class="medidor"><div class="barra" style="--cor:${cor}"><i style="width:${pv.fracao}%"></i></div><span>${pv.fracao}%</span></div>
            <p>Restam cerca de <strong>${pv.restante}</strong> de ${pv.ultimoUnidades} saquinhos do último pedido (${quando(pv.ultimoPedido)}).
              ${pv.diasRestantes !== null ? `Acaba em <strong>~${pv.diasRestantes} dias</strong>.` : ''} Vende uns <strong>${pv.porSemana} por semana</strong>.</p>
            ${pv.sugestao ? `<p class="meta">Sugestão de reposição: ${esc(pv.sugestao)}</p>` : ''}
            ${pv.avisadoEm ? `<p class="meta">Avisado ${quando(pv.avisadoEm)}.</p>` : ''}`}
        </section>
        <section class="cartao">
          <h2>Pedidos (${c.pedidos.length})</h2>
          ${c.pedidos.length ? `<div class="lista">${c.pedidos.map((p) => itemPedido({ ...p, estabelecimento: `Pedido #${p.id}` })).join('')}</div>` : '<div class="vazio">Nenhum pedido ainda.</div>'}
        </section>
      </div>
      <form class="cartao form" id="form-cliente" style="margin-top:16px">
        <h2>Dados do cliente</h2>${formCliente(c)}
        <p class="erro-form"></p>
        <div class="acoes"><button class="btn btn-azul" type="submit">Salvar alterações</button>${!c.pedidos.length ? '<button class="btn btn-claro" type="button" id="apagar" style="color:var(--vermelho)">Apagar cliente</button>' : ''}</div>
      </form>`;
    const f = document.getElementById('form-cliente');
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api('PUT', `/api/clientes/${c.id}`, dadosCliente(new FormData(f))); toast('Cliente atualizado'); telaCliente(id); }
      catch (err) { f.querySelector('.erro-form').textContent = err.message; }
    };
    document.getElementById('apagar')?.addEventListener('click', async () => {
      if (!confirm('Apagar este cliente?')) return;
      await api('DELETE', `/api/clientes/${c.id}`); toast('Cliente apagado'); location.hash = '#/clientes';
    });
    if (pv.nivel === 'acabando' || pv.nivel === 'atencao') {
      principal.querySelector('[data-avisar]')?.addEventListener('click', () => api('POST', '/api/avisos', { cliente_id: c.id }).catch(() => {}));
    }
  }

  // ----- estoque -----
  async function telaEstoque() {
    const [produtos, movs] = await Promise.all([api('GET', '/api/produtos'), api('GET', '/api/movimentos')]);
    const TIPO_MOV = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', estorno: 'Volta (cancelado)' };
    principal.innerHTML = `
      <div class="topo-pagina"><div><h1>Estoque</h1><p class="sub">${produtos.reduce((s, p) => s + p.estoque, 0)} saquinhos no total</p></div></div>
      <div class="sabores-grade">${produtos.map((p) => `
        <div class="sabor-cartao ${p.estoque <= p.estoque_minimo ? 'baixo' : ''}" style="--cor:${esc(p.cor)}">
          <img src="${imgSabor(p.slug)}" alt="">
          <div><div class="nome">${esc(p.nome)}</div><div class="qtd">${p.estoque} <small>un.</small></div>
            <small class="meta">mín. ${p.estoque_minimo} · atacado ${reais(p.preco_atacado)}</small>
            ${p.estoque <= p.estoque_minimo ? '<br><span class="tag acabando">Repor</span>' : ''}${!p.ativo ? '<br><span class="tag inativo">Fora de linha</span>' : ''}</div>
          <div class="acoes">
            <button class="btn btn-azul btn-peq" data-entrada="${p.id}">+ Entrada</button>
            <button class="btn btn-claro btn-peq" data-ajuste="${p.id}">Contagem</button>
            <button class="btn btn-claro btn-peq" data-editar="${p.id}">Preços</button>
          </div>
        </div>`).join('')}
      </div>
      <section class="cartao" style="margin-top:16px">
        <h2>Movimentações recentes</h2>
        ${movs.length ? `<table class="tabela"><thead><tr><th>Quando</th><th>Sabor</th><th>Tipo</th><th class="num">Qtd</th><th>Motivo</th></tr></thead><tbody>
          ${movs.map((m) => `<tr><td>${dataHora(m.criado_em)}</td><td>${esc(m.nome)}</td><td>${TIPO_MOV[m.tipo]}</td><td class="num" style="color:${m.quantidade < 0 ? 'var(--vermelho)' : 'var(--verde)'}">${m.quantidade > 0 ? '+' : ''}${m.quantidade}</td><td>${esc(m.motivo)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="vazio">Nenhuma movimentação ainda.</div>'}
      </section>`;
    const prod = (id) => produtos.find((p) => p.id === +id);
    principal.querySelectorAll('[data-entrada]').forEach((b) => b.onclick = () => {
      const p = prod(b.dataset.entrada);
      abrirModal(`<h2>Entrada de ${esc(p.nome)}</h2>
        <label class="campo">Quantos saquinhos entraram?<input name="quantidade" inputmode="numeric" required autofocus></label>
        <label class="campo">Motivo<input name="motivo" placeholder="Produção do dia"></label>
        <p class="erro-form"></p><div class="acoes"><button class="btn btn-azul" value="ok">Adicionar</button><button class="btn btn-claro" value="cancelar" formnovalidate>Cancelar</button></div>`,
      async (d) => { await api('POST', `/api/produtos/${p.id}/movimento`, { tipo: 'entrada', quantidade: d.get('quantidade'), motivo: d.get('motivo') }); toast('Estoque atualizado'); telaEstoque(); });
    });
    principal.querySelectorAll('[data-ajuste]').forEach((b) => b.onclick = () => {
      const p = prod(b.dataset.ajuste);
      abrirModal(`<h2>Contagem de ${esc(p.nome)}</h2><p class="meta">O sistema tem ${p.estoque}. Informe quantos você contou.</p>
        <label class="campo">Quantidade contada<input name="quantidade" inputmode="numeric" required value="${p.estoque}" autofocus></label>
        <label class="campo">Motivo<input name="motivo" placeholder="Contagem, perda, avaria…"></label>
        <p class="erro-form"></p><div class="acoes"><button class="btn btn-azul" value="ok">Salvar contagem</button><button class="btn btn-claro" value="cancelar" formnovalidate>Cancelar</button></div>`,
      async (d) => { await api('POST', `/api/produtos/${p.id}/movimento`, { tipo: 'ajuste', quantidade: d.get('quantidade'), motivo: d.get('motivo') }); toast('Contagem salva'); telaEstoque(); });
    });
    principal.querySelectorAll('[data-editar]').forEach((b) => b.onclick = () => {
      const p = prod(b.dataset.editar);
      abrirModal(`<h2>${esc(p.nome)}</h2>
        <div class="form-2">
          <label class="campo">Preço de atacado (R$)<input name="preco_atacado" inputmode="decimal" value="${deCentavos(p.preco_atacado)}"></label>
          <label class="campo">Preço de varejo (R$)<input name="preco_varejo" inputmode="decimal" value="${deCentavos(p.preco_varejo)}"></label>
          <label class="campo">Estoque mínimo<input name="estoque_minimo" inputmode="numeric" value="${p.estoque_minimo}"><small>Abaixo disso aparece o alerta “Repor”.</small></label>
        </div>
        <label class="check"><input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}> Sabor à venda</label>
        <p class="erro-form"></p><div class="acoes"><button class="btn btn-azul" value="ok">Salvar</button><button class="btn btn-claro" value="cancelar" formnovalidate>Cancelar</button></div>`,
      async (d) => {
        await api('PUT', `/api/produtos/${p.id}`, { preco_atacado: paraCentavos(d.get('preco_atacado')), preco_varejo: paraCentavos(d.get('preco_varejo')), estoque_minimo: d.get('estoque_minimo'), ativo: d.get('ativo') === 'on' });
        toast('Sabor atualizado'); telaEstoque();
      });
    });
  }

  // ----- avisos -----
  async function telaAvisos() {
    const [lista, resumo] = await Promise.all([api('GET', '/api/avisos'), api('GET', '/api/resumo')]);
    contadorAvisos(lista.length);
    principal.innerHTML = `
      <div class="topo-pagina"><div><h1>Avisos</h1><p class="sub">Clientes que já devem estar com pouco King Gelo, pela média de consumo de cada um</p></div></div>
      ${resumo.estoqueBaixo.length ? `<div class="cartao" style="margin-bottom:16px;border-left:5px solid var(--vermelho)"><h2>Seu estoque está baixo</h2>
        <p>${resumo.estoqueBaixo.map((p) => `<strong>${esc(p.nome)}</strong> (${p.estoque})`).join(' · ')}. <a href="#/estoque">Lançar produção</a></p></div>` : ''}
      ${lista.length ? `<div class="grade grade-2">${lista.map((c) => {
        const pv = c.previsao;
        return `<article class="cartao aviso-cartao">
          <div class="cab"><div><a class="titulo" href="#/clientes/${c.id}" style="font-weight:800;color:var(--marinho);text-decoration:none">${esc(c.estabelecimento || c.nome)}</a><div class="meta">${esc(c.nome)} · ${esc(c.cidade)}</div></div><span class="tag ${pv.nivel}">${NIVEL[pv.nivel]}</span></div>
          <div class="medidor"><div class="barra" style="--cor:${pv.nivel === 'acabando' ? 'var(--vermelho)' : 'var(--laranja)'}"><i style="width:${pv.fracao}%"></i></div><span>~${pv.restante} restantes</span></div>
          <p class="meta">Último pedido ${quando(pv.ultimoPedido)} (${pv.ultimoUnidades} un.) · vende ~${pv.porSemana}/semana${pv.diasRestantes !== null ? ` · acaba em ~${pv.diasRestantes} dias` : ''}${pv.avisadoEm ? ` · <strong>avisado ${quando(pv.avisadoEm)}</strong>` : ''}</p>
          <div class="mensagem">${esc(c.mensagem)}</div>
          <div class="acoes">
            ${c.whatsapp ? `<a class="btn btn-verde" href="${esc(c.whatsapp)}" target="_blank" rel="noopener" data-avisar="${c.id}">${ic('zap')} Avisar no WhatsApp</a>` : '<span class="meta">Sem WhatsApp cadastrado</span>'}
            <a class="btn btn-azul" href="#/pedidos/novo?cliente=${c.id}">Lançar pedido</a>
            <button class="btn btn-claro" data-adiar="${c.id}">Lembrar em 3 dias</button>
          </div>
        </article>`;
      }).join('')}</div>` : '<div class="cartao vazio"><strong>Nenhum aviso agora</strong>Quando um cliente estiver com o estoque acabando, ele aparece aqui.</div>'}`;
    principal.querySelectorAll('[data-avisar]').forEach((a) => a.addEventListener('click', () => {
      api('POST', '/api/avisos', { cliente_id: +a.dataset.avisar }).then(() => toast('Aviso registrado')).catch(() => {});
    }));
    principal.querySelectorAll('[data-adiar]').forEach((b) => b.onclick = async () => {
      await api('POST', '/api/avisos', { cliente_id: +b.dataset.adiar, tipo: 'adiado', dias: 3 });
      toast('Vou lembrar em 3 dias'); telaAvisos();
    });
  }

  // ----- ajustes -----
  async function telaAjustes() {
    const c = await api('GET', '/api/config');
    principal.innerHTML = `
      <div class="topo-pagina"><h1>Ajustes</h1></div>
      <div class="grade grade-2">
        <form class="cartao form" id="form-config">
          <h2>Avisos de reposição</h2>
          <label class="campo">Ciclo padrão de reposição (dias)<input name="ciclo_padrao_dias" inputmode="numeric" value="${esc(c.ciclo_padrao_dias)}"><small>Usado para clientes com só 1 pedido.</small></label>
          <div class="form-2">
            <label class="campo">“Acabando” abaixo de (%)<input name="limite_acabando" inputmode="numeric" value="${esc(c.limite_acabando)}"></label>
            <label class="campo">“Atenção” abaixo de (%)<input name="limite_atencao" inputmode="numeric" value="${esc(c.limite_atencao)}"></label>
          </div>
          <label class="campo">Mensagem do aviso<textarea name="mensagem_aviso" rows="5">${esc(c.mensagem_aviso)}</textarea><small>Use {nome}, {estabelecimento} e {sugestao}.</small></label>
          <button class="btn btn-azul" type="submit">Salvar ajustes</button>
        </form>
        <form class="cartao form" id="form-senha">
          <h2>Trocar senha</h2>
          <label class="campo">Senha atual<input name="atual" type="password" autocomplete="current-password" required></label>
          <label class="campo">Nova senha<input name="nova" type="password" autocomplete="new-password" minlength="8" required></label>
          <p class="erro-form"></p>
          <button class="btn btn-azul" type="submit">Trocar senha</button>
          <hr style="border:0;border-top:1px solid var(--linha);width:100%">
          <h2>Seus dados</h2>
          <div class="acoes">
            <a class="btn btn-claro" href="/api/exportar/pedidos.csv" download>Exportar pedidos (planilha)</a>
            <a class="btn btn-claro" href="/api/backup" download>Baixar backup completo</a>
          </div>
          <p class="meta">Guarde o backup em um lugar seguro de vez em quando (Google Drive, pen drive).</p>
          <hr style="border:0;border-top:1px solid var(--linha);width:100%">
          <button class="btn btn-claro" type="button" id="sair">${ic('sair')} Sair do painel</button>
        </form>
        <section class="cartao" id="cartao-app">
          <h2>App no celular</h2>
          <div data-passos>${passosInstalar()}</div>
        </section>
      </div>`;
    ligarInstalar(principal);
    document.getElementById('form-config').onsubmit = async (e) => {
      e.preventDefault();
      await api('PUT', '/api/config', Object.fromEntries(new FormData(e.target)));
      toast('Ajustes salvos');
    };
    document.getElementById('form-senha').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('PUT', '/api/senha', Object.fromEntries(new FormData(e.target))); toast('Senha trocada'); e.target.reset(); }
      catch (err) { e.target.querySelector('.erro-form').textContent = err.message; }
    };
    document.getElementById('sair').onclick = async () => { await api('POST', '/api/sair', {}); telaLogin(); };
  }

  // ---------- rotas ----------
  async function rota() {
    if (!principal) return;
    const [caminho, busca = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const q = new URLSearchParams(busca);
    const [secao = 'inicio', sub] = caminho.split('/');
    marcarMenu(secao);
    principal.innerHTML = '<div class="vazio">Carregando…</div>';
    try {
      if (secao === 'pedidos' && sub === 'novo') await telaNovoPedido(q);
      else if (secao === 'pedidos' && sub) await telaPedido(+sub);
      else if (secao === 'pedidos') await telaPedidos(q);
      else if (secao === 'clientes' && sub === 'novo') telaNovoCliente();
      else if (secao === 'clientes' && sub) await telaCliente(+sub);
      else if (secao === 'clientes') await telaClientes(q);
      else if (secao === 'estoque') await telaEstoque();
      else if (secao === 'avisos') await telaAvisos();
      else if (secao === 'ajustes') await telaAjustes();
      else await telaInicio();
      scrollTo(0, 0);
    } catch (err) {
      if (err.message !== 'Faça login') principal.innerHTML = `<div class="cartao vazio"><strong>Não deu para carregar</strong>${esc(err.message)}</div>`;
    }
  }
  addEventListener('hashchange', rota);

  // app no celular: guarda o pedido de instalação do Android e registra o service worker
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalar = e;
    document.querySelectorAll('[data-passos]').forEach((d) => { d.innerHTML = passosInstalar(); ligarInstalar(d); });
  });
  addEventListener('appinstalled', () => {
    pedidoInstalar = null;
    document.querySelectorAll('.banner-app').forEach((b) => b.remove());
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});

  api('GET', '/api/eu').then(() => {
    montarCasca();
    rota();
    api('GET', '/api/avisos').then((l) => contadorAvisos(l.length)).catch(() => {});
  }).catch(() => {});
})();
