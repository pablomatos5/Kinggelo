// Bloco de gelo em 3D de verdade (WebGL), desenhado por cima da página enquanto cai.
// hero.js calcula posição, velocidade e giro e chama __gelo3d.desenhar(estado) a cada quadro.
// Sem WebGL, nada disso liga e o bloco em SVG continua sendo usado.
import * as THREE from './vendor/three/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

const queda = document.getElementById('queda');
const tela = document.createElement('canvas');
tela.id = 'gelo-3d';

// celular e aparelho fraco: sem antialias, resolução menor e sem o rastro borrado do bloco
const leve = matchMedia('(pointer: coarse)').matches || innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: tela, alpha: true, antialias: !leve, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}

if (renderer && queda) {
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  queda.insertBefore(tela, document.getElementById('particulas'));

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // câmera em que 1 unidade = 1 pixel no plano z = 0
  const FOV = 28;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 10000);
  function medir() {
    const w = innerWidth, h = innerHeight;
    // celular: resolução menor no canvas de tela cheia (é ele que pesa); o bloco continua nítido
    renderer.setPixelRatio(Math.min(leve ? 1.25 : 1.5, devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = h / 2 / Math.tan((FOV / 2) * Math.PI / 180);
    camera.far = camera.position.z * 3;
    camera.updateProjectionMatrix();
    chave = '';
  }

  const luz = new THREE.DirectionalLight(0xffffff, 2.4);
  luz.position.set(-300, 520, 600);
  const contraluz = new THREE.DirectionalLight(0xbfe8ff, 1.8);
  contraluz.position.set(320, -160, -420);
  cena.add(luz, contraluz);

  // ---------- texturas feitas na hora: suco congelado, geada, rachaduras e bolhas ----------
  // cor do suco congelado de cada sabor (vem de hero.js); começa em melancia
  const MELANCIA = { claro: '#ff8a96', meio: '#f2384f', escuro: '#d81834', fundo: '#b30d29', borda: '#ffd0d5', sombra: '#7d0018', brilho: '#ff2a45', miolo: ['#d0142f', '#7a0016'] };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  // ruído suave (value noise) com semente fixa: o mesmo gelo a cada visita
  let semente = 1337;
  const aleat = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const GR = 64, grade = Array.from({ length: GR * GR }, aleat);
  const ruido = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const v = (i, j) => grade[((j & (GR - 1)) * GR) + (i & (GR - 1))];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (v(xi, yi) * (1 - sx) + v(xi + 1, yi) * sx) * (1 - sy) + (v(xi, yi + 1) * (1 - sx) + v(xi + 1, yi + 1) * sx) * sy;
  };
  const fbm = (x, y) => ruido(x, y) * 0.55 + ruido(x * 2.1, y * 2.1) * 0.28 + ruido(x * 4.3, y * 4.3) * 0.17;
  // amassados do plástico: vincos finos em várias direções, mais fortes perto das pontas (onde fica a solda)
  const VINCOS = Array.from({ length: 9 }, () => ({ a: (aleat() - 0.5) * 1.2, f: 0.05 + aleat() * 0.06, c: aleat() * 6, y: (aleat() - 0.5) * 2 }));
  const vinco = (x, y) => VINCOS.reduce((t, k) => {
    const d = Math.sin(k.a) * x + Math.cos(k.a) * (y / 157);
    return t + Math.exp(-(((y / 157) - k.y) ** 2) * 3) * Math.max(0, Math.sin(d * 9 + k.c)) ** 8;
  }, 0);

  function texturaCor(sb = MELANCIA) {
    const W = 512, H = 1024;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    // suco congelado: mais concentrado no meio, mais claro e leitoso nas pontas
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sb.claro); grad.addColorStop(0.25, sb.meio); grad.addColorStop(0.7, sb.escuro); grad.addColorStop(1, sb.meio);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // manchas de concentração (o açúcar e a cor congelam desiguais): calculadas numa grade pequena e
    // ampliadas (suave), em vez de ruído pixel a pixel na textura grande
    const mW = 64, mH = 128, mc = document.createElement('canvas');
    mc.width = mW; mc.height = mH;
    const mg = mc.getContext('2d'), mi = mg.createImageData(mW, mH);
    for (let y = 0; y < mH; y++) for (let x = 0; x < mW; x++) {
      const n = fbm(x / 8.75, y / 8.75), i = (y * mW + x) * 4;
      mi.data[i + 3] = Math.max(0, 0.22 - n * 0.34) * 255;   // escurece onde o ruído é baixo
    }
    mg.putImageData(mi, 0, 0);
    g.imageSmoothingQuality = 'high';
    g.drawImage(mc, 0, 0, W, H);
    // geada: véu branco irregular, mais forte nas laterais e nas pontas
    for (let i = 0; i < 160; i++) {
      const x = aleat() * W, y = aleat() * H, r = 18 + aleat() * 70;
      const borda = Math.max(Math.abs(x / W - 0.5) * 2, Math.abs(y / H - 0.5) * 2) ** 3;
      const gg = g.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, rgba(sb.borda, 0.02 + 0.14 * borda)); gg.addColorStop(1, rgba(sb.borda, 0));
      g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const lado = g.createLinearGradient(0, 0, W, 0);
    lado.addColorStop(0, 'rgba(255,255,255,.3)'); lado.addColorStop(0.12, 'rgba(255,255,255,0)');
    lado.addColorStop(0.88, 'rgba(255,255,255,0)'); lado.addColorStop(1, 'rgba(255,255,255,.3)');
    g.fillStyle = lado; g.fillRect(0, 0, W, H);
    // ar preso: fiapos e bolhinhas leitosas que sobem no sentido do congelamento
    g.filter = 'blur(1.5px)';
    for (let i = 0; i < 22; i++) {
      let x = W * (0.2 + aleat() * 0.6), y = H * (0.1 + aleat() * 0.8);
      g.strokeStyle = `rgba(255,255,255,${0.18 + aleat() * 0.22})`; g.lineWidth = 1 + aleat() * 2.5;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (aleat() - 0.5) * 10; y -= 10 + aleat() * 18; g.lineTo(x, y); }
      g.stroke();
    }
    g.filter = 'none';
    for (let i = 0; i < 60; i++) {
      const x = aleat() * W, y = aleat() * H, r = 1 + aleat() * 3.5;
      g.fillStyle = `rgba(255,255,255,${0.25 + aleat() * 0.4})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // cristais: pontinhos brilhantes
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(255,255,255,${aleat() * 0.5})`;
      g.fillRect(aleat() * W, aleat() * H, 1.2, 1.2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  // relevo (geada granulada + vincos) e rugosidade (fosco com manchas molhadas onde começou a derreter)
  function texturaGeada() {
    const W = 160, H = 320;
    const rel = document.createElement('canvas'), rug = document.createElement('canvas');
    rel.width = rug.width = W; rel.height = rug.height = H;
    const gr = rel.getContext('2d'), gu = rug.getContext('2d');
    const ir = gr.createImageData(W, H), iu = gu.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const grao = ruido(x * 1.4, y * 1.4) * 0.35 + ruido(x * 0.48, y * 0.48) * 0.25;
      const v = Math.min(1, grao + vinco((x / W - 0.5) * 2, (y / H - 0.5) * 314) * 0.6);
      ir.data[i] = ir.data[i + 1] = ir.data[i + 2] = v * 255; ir.data[i + 3] = 255;
      const molhado = Math.max(0, fbm(x / 25 + 7, y / 25) - 0.55) * 4;
      const r = 0.82 - molhado * 0.55 - ruido(x * 1.1, y * 1.1) * 0.12;
      iu.data[i] = iu.data[i + 1] = iu.data[i + 2] = Math.max(0.12, r) * 255; iu.data[i + 3] = 255;
    }
    gr.putImageData(ir, 0, 0); gu.putImageData(iu, 0, 0);
    return { relevo: new THREE.CanvasTexture(rel), rugosidade: new THREE.CanvasTexture(rug) };
  }
  function texturaSombra() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(5,40,90,.75)'); grad.addColorStop(1, 'rgba(5,40,90,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  // ---------- o bloco: casca translúcida com geada + miolo de suco mais escuro ----------
  // mesmas medidas do bloco em SVG (124 × 314 dentro de uma caixa de 340 de altura)
  const casca = new RoundedBoxGeometry(124, 314, 56, 10, 18);
  // forma de gelo de saquinho: almofada irregular, mais fina perto das soldas de cima e de baixo,
  // com as marcas amassadas do plástico e bordas não perfeitamente retas
  function moldarGelo(geo, escala = 1) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nx = x / (62 * escala), ny = y / (157 * escala);
      const fx = Math.max(0, 1 - nx * nx), fy = Math.max(0, 1 - ny * ny);
      const pontas = 0.55 + 0.45 * Math.min(1, (1 - Math.abs(ny)) * 5);   // afina nas soldas
      const irreg = (fbm(nx * 2 + 3, ny * 4) - 0.5) * 7 * escala;
      const marcas = vinco(nx, y / escala) * 1.6 * escala;
      const zz = z * pontas + Math.sign(z) * (8 * fx * fy * escala + irreg * 0.6 - marcas);
      pos.setXYZ(i, x + irreg * 0.35 * fy, y + (fbm(nx * 3, 9) - 0.5) * 4 * escala * Math.abs(ny), zz);
    }
    geo.computeVertexNormals();
    return geo;
  }
  moldarGelo(casca);
  const { relevo: geada, rugosidade } = texturaGeada();
  const corteBoca = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  const matCasca = new THREE.MeshPhysicalMaterial({
    clippingPlanes: [corteBoca],
    map: texturaCor(),
    roughnessMap: rugosidade, roughness: 1,
    bumpMap: geada, bumpScale: 2.2,
    metalness: 0,
    // película de água bem fina por cima da geada: brilho só nas manchas molhadas
    clearcoat: 0.55, clearcoatRoughness: 0.32,
    sheen: 0.32, sheenColor: new THREE.Color('#ffd0d5'), sheenRoughness: 0.55,
    emissive: new THREE.Color('#ff2a45'), emissiveIntensity: 0.18,
    ior: 1.31, specularIntensity: 0.8,
    envMapIntensity: 0.95,
    transparent: true, opacity: 0.95,
  });
  const bloco = new THREE.Mesh(casca, matCasca);
  const miolo = new THREE.Mesh(
    moldarGelo(new RoundedBoxGeometry(108, 296, 40, 6, 16), 0.92),
    new THREE.MeshStandardMaterial({ color: '#d0142f', roughness: 0.7, emissive: '#7a0016', emissiveIntensity: 0.3, clippingPlanes: [corteBoca] }),
  );
  // enquanto o bloco ainda está saindo, nada dele aparece acima da boca do saquinho
  const corpo = new THREE.Group();
  corpo.add(miolo, bloco);

  // rastro borrado: cópias translúcidas atrás do bloco quando ele cai rápido
  const ecos = [0.34, 0.18].map(() => {
    const m = new THREE.Mesh(casca, matCasca.clone());
    m.material.clippingPlanes = [corteBoca];
    m.material.depthWrite = false;
    m.renderOrder = -1;
    cena.add(m);
    return m;
  });

  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false, opacity: 0.45 }),
  );
  sombra.renderOrder = -2;
  cena.add(sombra, corpo);

  let chave = '', vazio = true;
  medir();
  addEventListener('resize', medir);

  window.__gelo3d = {
    // estado: { x, y, esc, aperta, estica, rx, ry, rz, atraso, eco } em pixels de tela e radianos
    desenhar(e) {
      if (!e) {
        if (!vazio) { renderer.clear(); vazio = true; chave = ''; }
        return;
      }
      ecos.forEach((m) => { m.visible = false; });
      const k = `${e.x.toFixed(1)}|${e.y.toFixed(1)}|${e.esc.toFixed(4)}|${e.rx.toFixed(3)}|${e.ry.toFixed(3)}|${e.rz.toFixed(3)}|${e.estica.toFixed(3)}|${e.eco.toFixed(2)}|${e.atraso.toFixed(0)}|${(e.sombra ?? 1).toFixed(2)}|${e.corte == null ? '-' : e.corte.toFixed(1)}`;
      if (k === chave) return;
      chave = k;
      vazio = false;
      const px = e.x - innerWidth / 2, py = innerHeight / 2 - e.y;
      corteBoca.constant = e.corte == null ? 1e6 : innerHeight / 2 - e.corte;
      corpo.position.set(px, py, 0);
      corpo.rotation.set(e.rx, e.ry, e.rz, 'YXZ');
      corpo.scale.set(e.esc * e.aperta, e.esc * e.estica, e.esc * e.aperta);
      ecos.forEach((m, i) => {
        // no modo leve o rastro borrado (duas cópias transparentes do bloco) fica de fora
        m.visible = !leve && e.eco > 0.02;
        m.material.opacity = e.eco * [0.34, 0.18][i];
        m.position.set(px, py - e.atraso * (i + 1), -4 * (i + 1));
        m.rotation.copy(corpo.rotation);
        m.scale.copy(corpo.scale);
      });
      // sombra projetada na página, mais larga quando o bloco gira de lado
      const lado = Math.abs(Math.sin(e.ry));
      sombra.position.set(px + 16 * e.esc, py - 30 * e.esc, -120);
      sombra.scale.set((150 + 70 * lado) * e.esc, 360 * e.esc, 1);
      sombra.rotation.z = e.rz;
      sombra.material.opacity = 0.45 * (e.sombra ?? 1);
      renderer.render(cena, camera);
    },
  };
  queda.classList.add('tem-3d');

  // troca de sabor: refaz a textura do suco congelado e as cores do miolo e do brilho
  window.__gelo3d.sabor = (sb) => {
    const antiga = matCasca.map;
    const nova = texturaCor(sb);
    [matCasca, ...ecos.map((m) => m.material)].forEach((m) => { m.map = nova; m.sheenColor.set(sb.borda); m.emissive.set(sb.brilho); m.needsUpdate = true; });
    miolo.material.color.set(sb.miolo[0]);
    miolo.material.emissive.set(sb.miolo[1]);
    antiga.dispose();
    chave = '';
    if (window.__gelo3d.recopo) window.__gelo3d.recopo();
  };

  // ---------- o mesmo bloco dentro do copão ----------
  // o copo é dividido em duas camadas: fundo + drink atrás, e tom do drink + vidro da frente na frente.
  // Entre elas, um canvas recebe o bloco 3D: inteiro acima do nível e, abaixo, deslocado e ampliado (refração).
  const copoSvg = document.getElementById('copao');
  const grupoAcima = document.getElementById('gelo-copo'), grupoAbaixo = document.getElementById('gelo-copo-refracao');
  let r2 = null;
  const telaCopo = document.createElement('canvas');
  try {
    if (copoSvg && grupoAcima && grupoAbaixo) r2 = new THREE.WebGLRenderer({ canvas: telaCopo, alpha: true, antialias: true });
  } catch (e) { r2 = null; }
  if (r2) {
    r2.setClearColor(0x000000, 0);
    r2.toneMapping = THREE.ACESFilmicToneMapping;
    r2.toneMappingExposure = 1.05;
    const NSX = 'http://www.w3.org/2000/svg';
    const frente = document.createElementNS(NSX, 'svg');
    frente.setAttribute('viewBox', copoSvg.getAttribute('viewBox'));
    frente.setAttribute('aria-hidden', 'true');
    frente.classList.add('copao-frente');
    // tudo o que vem depois do gelo submerso vai para a camada da frente (os nós são movidos, as referências continuam valendo)
    const base = grupoAbaixo.parentNode;
    while (base.nextSibling) frente.appendChild(base.nextSibling);
    grupoAcima.style.display = grupoAbaixo.style.display = 'none';
    // a frente ainda é dividida: o que muda a cada quadro (tom do suco, borda, respingos) fica numa camada
    // leve; vidro, reflexos com desfoque, logo e as gotas de condensação vão para uma camada que nunca muda
    // (o navegador desenha uma vez e reaproveita, em vez de refazer os desfoques a cada quadro do mergulho)
    const fixa = document.createElementNS(NSX, 'svg');
    fixa.setAttribute('viewBox', copoSvg.getAttribute('viewBox'));
    fixa.setAttribute('aria-hidden', 'true');
    fixa.classList.add('copao-frente', 'copao-fixa');
    const respingosEl = frente.querySelector('#respingos');
    while (respingosEl && respingosEl.nextSibling) fixa.appendChild(respingosEl.nextSibling);
    const camada = document.createElement('canvas');
    camada.className = 'copao-gelo';
    copoSvg.after(camada, frente, fixa);
    copoSvg.parentNode.classList.add('copo-3d');

    // caixa do bloco em unidades do SVG, com folga para os cantos quando ele gira
    const BX = 100, BY = 190;
    // o canvas da camada cobre o copo e sobra para cima, onde o bloco aparece antes de entrar
    const TOPO = 60;
    const cena2 = new THREE.Scene();
    const pm2 = new THREE.PMREMGenerator(r2);
    cena2.environment = pm2.fromScene(new RoomEnvironment(), 0.04).texture;
    pm2.dispose();
    const corpo2 = corpo.clone();
    cena2.add(luz.clone(), contraluz.clone(), corpo2);
    const cam2 = new THREE.OrthographicCamera(-BX, BX, BY, -BY, -500, 500);
    const cc = camada.getContext('2d');
    let k = 1, d = 1, chave2 = '', vb = { x: 150, y: 250, w: 300, h: 545 };
    const medirCopo = () => {
      const r = copoSvg.getBoundingClientRect(), pai = copoSvg.parentNode.getBoundingClientRect();
      if (!r.width) return;
      const topo = r.top - pai.top, esq = r.left - pai.left;
      const [x, y, w, h] = copoSvg.getAttribute('viewBox').split(/\s+/).map(Number);
      vb = { x, y, w, h };
      k = r.width / w;
      d = Math.min(leve ? 1 : 2, devicePixelRatio || 1);
      Object.assign(camada.style, { top: `${topo - (y - TOPO) * k}px`, left: `${esq}px`, width: `${r.width}px`, height: `${(h + y - TOPO) * k}px` });
      [frente, fixa].forEach((el) => Object.assign(el.style, { top: `${topo}px`, left: `${esq}px`, width: `${r.width}px`, height: `${r.height}px` }));
      const cw = Math.round(r.width * d), ch = Math.round((h + y - TOPO) * k * d);
      if (camada.width === cw && camada.height === ch) return;
      camada.width = cw; camada.height = ch;
      r2.setPixelRatio(1);
      r2.setSize(Math.round(2 * BX * k * d), Math.round(2 * BY * k * d), false);
      chave2 = '';
    };
    medirCopo();
    addEventListener('resize', medirCopo);
    addEventListener('load', medirCopo);
    new ResizeObserver(medirCopo).observe(copoSvg);
    // unidades do SVG -> pixels do canvas da camada
    const px = (vx) => (vx - vb.x) * k * d, py = (vy) => (vy - TOPO) * k * d;
    window.__gelo3d.recopo = () => { chave2 = ''; };
    window.__gelo3d.copo = (e) => {
      const chave = `${e.rx.toFixed(3)}|${e.ry.toFixed(3)}|${e.rz.toFixed(3)}|${e.gy.toFixed(1)}|${e.nivel.toFixed(1)}|${e.oculto}`;
      if (chave === chave2) return;
      chave2 = chave;
      cc.clearRect(0, 0, camada.width, camada.height);
      if (e.oculto) return;
      corpo2.rotation.set(e.rx, e.ry, e.rz, 'YXZ');
      r2.render(cena2, cam2);
      const lw = 2 * BX * k * d, lh = 2 * BY * k * d;
      const corte = py(e.nivel);
      // o gelo nunca sai das paredes do vidro: acima da borda ele pode sobrar, abaixo dela fica dentro do copo
      const vidro = new Path2D();
      vidro.moveTo(px(vb.x - 400), py(TOPO)); vidro.lineTo(px(vb.x + vb.w + 400), py(TOPO));
      vidro.lineTo(px(vb.x + vb.w + 400), py(423)); vidro.lineTo(px(404), py(423));
      vidro.lineTo(px(381), py(742)); vidro.quadraticCurveTo(px(300), py(756), px(219), py(742));
      vidro.lineTo(px(196), py(423)); vidro.lineTo(px(vb.x - 400), py(423)); vidro.closePath();
      cc.save();
      cc.clip(vidro);
      // acima do drink
      cc.save();
      cc.beginPath(); cc.rect(0, 0, camada.width, corte); cc.clip();
      cc.drawImage(telaCopo, px(e.x - BX), py(e.gy - BY), lw, lh);
      cc.restore();
      // submerso: deslocado e um pouco maior, como o SVG fazia
      cc.save();
      cc.beginPath(); cc.rect(0, corte, camada.width, camada.height - corte); cc.clip();
      cc.globalAlpha = 0.92;
      cc.drawImage(telaCopo, px(e.x + 5 - BX * 1.04), py(e.gy + 3 - BY * 1.02), lw * 1.04, lh * 1.02);
      cc.restore();
      cc.restore();
    };
  }
  // avisa o hero.js (que carregou antes) para mandar o sabor que já estiver escolhido
  dispatchEvent(new Event('gelo3d-pronto'));
}
