/* ============================================================
   PLINTH / 001 — UI
   nav · scroll progress · reveal · film modal · lightbox · matrix
   Vanilla JS, sem dependências.
   ============================================================ */
(() => {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 0. Foco dentro de um diálogo ──────────────────────
     Os dois overlays (filme e lightbox) se declaram aria-modal, mas o Tab
     saía deles e ia percorrer a folha inteira ATRÁS do overlay — teclado e
     leitor de tela ficavam num lugar que o olho não alcança. Um par de
     ciclagem nas pontas resolve; o resto do foco continua nativo.
     O par disso é devolver o foco a quem abriu: sem isso, fechar o overlay
     joga o cursor de volta pro <body> e a navegação recomeça do topo. */
  const FOCUSABLE = 'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

  const trapIn = (root) => (e) => {
    if (e.key !== 'Tab') return;
    const f = $$(FOCUSABLE, root).filter(el => el.offsetWidth || el.offsetHeight);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  /* ── 1. Scroll progress + nav solid ───────────────────── */
  const bar = $('#progressBar');
  const nav = $('#nav');

  /* CSS drives the bar natively where scroll-driven animations exist —
     writing an inline width there would fight the scaleX keyframes. */
  const cssProgress = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()'));

  const onScroll = () => {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    if (bar && !cssProgress) bar.style.width = (max > 0 ? (el.scrollTop / max) * 100 : 0).toFixed(2) + '%';
    if (nav) nav.classList.toggle('is-solid', el.scrollTop > 40);
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── 2. Reveal on enter ───────────────────────────────── */
  const targets = $$('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(el => io.observe(el));
  }

  /* ── 3. Scroll-spy ────────────────────────────────────── */
  const links = $$('.nav__link');
  const sections = links
    .map(l => ({ link: l, el: $(l.getAttribute('href')) }))
    .filter(x => x.el);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(l => l.classList.remove('is-active'));
        const hit = sections.find(s => s.el === e.target);
        if (hit) hit.link.classList.add('is-active');
      });
    }, { threshold: 0, rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s.el));
  }

  /* ── 4. Mobile menu ──────────────────────────────────── */
  const toggle = $('#navToggle');
  const menu   = $('#navMenu');
  const setMenu = (open) => {
    if (!toggle || !menu) return;
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setMenu(menu.classList.contains('is-open') === false));
  menu?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  /* O painel cobria a tela inteira sem nenhuma saída além do próprio botão:
     Escape e um toque fora eram os dois gestos que todo mundo tenta primeiro
     e nenhum dos dois fazia nada. Escape devolve o foco ao botão — quem
     abriu pelo teclado não fica com o cursor dentro de um painel invisível. */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu?.classList.contains('is-open')) {
      setMenu(false);
      toggle?.focus();
    }
  });
  /* Fase de CAPTURA, e engolindo o evento: o painel cobre so o topo da tela,
     entao o toque que o fecha cai em cima de uma chapa — e sem o
     stopPropagation ele fechava o menu E abria a lightbox no mesmo gesto
     (o handler da lightbox e delegado no document, na fase de bolha).
     O primeiro toque so dispensa; o segundo e que age. */
  document.addEventListener('click', (e) => {
    if (!menu?.classList.contains('is-open')) return;
    if (e.target.closest('#navMenu') || e.target.closest('#navToggle')) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu(false);
  }, true);

  /* ── 5. Filme (modal) ────────────────────────────────── */
  /* Reescrito junto com o markup e o CSS, por causa do bug do vídeo
     aparecendo atrás da hero. O que mudou de fato:

     O player nasce com preload="none" no HTML, então não busca nem
     decodifica nada até a primeira abertura. Antes, dois <video>
     apontando pro mesmo arquivo ficavam vivos desde o carregamento da
     página — e duas camadas de vídeo disputando planos de overlay da GPU
     é a hipótese mais forte pro quadro escapar do container.
     Hoje nem são o mesmo arquivo: o hero carrega hero.mp4 (leve, pro loop)
     e o filme carrega film.mp4 (1920px, qualidade de conteúdo).
     O par disso está no CSS: body.is-locked esconde o vídeo da hero
     enquanto o filme toca. */
  const film    = $('#film');
  const player  = $('#filmPlayer');
  const heroVid = $('#heroLoop');
  let armed = false;
  let filmOpener = null;

  const openFilm = () => {
    if (!film || !player) return;
    if (!armed) { player.load(); armed = true; }   /* pega os <source> do HTML */
    film.hidden = false;
    document.body.classList.add('is-locked');
    heroVid?.pause();
    player.play().catch(() => {});                 /* sem autoplay: o usuário usa os controles */
    filmOpener = document.activeElement;
    $('#filmClose')?.focus();
  };

  const closeFilm = () => {
    if (!film || !player) return;
    player.pause();
    film.hidden = true;
    document.body.classList.remove('is-locked');
    if (!reduce) heroVid?.play().catch(() => {});
    /* volta pra quem abriu, não pro botão fixo: o filme pode ser aberto de
       mais de um lugar no futuro e o foco tem que seguir o gesto */
    (filmOpener || $('#filmOpen'))?.focus();
    filmOpener = null;
  };

  $('#filmOpen')?.addEventListener('click', openFilm);
  $('#filmClose')?.addEventListener('click', closeFilm);
  /* clique no fundo fecha; clique no <video> não, senão pausar fecharia */
  film?.addEventListener('click', (e) => { if (e.target === film) closeFilm(); });
  film?.addEventListener('keydown', trapIn(film));

  /* Se o vídeo do hero não existir/não puder tocar, mostra só o poster. */
  heroVid?.addEventListener('error', () => { heroVid.style.display = 'none'; }, true);
  if (reduce) heroVid?.pause();

  /* O loop do hero decodificava a página inteira, inclusive enquanto o
     visualizador 3D está na tela com DOIS contextos WebGL e GTAO por cima —
     um decoder de vídeo e dois renderers disputando a mesma GPU/CPU é metade
     do engasgo. Fora da tela não há o que assistir, então pausa.
     Só reencosta o play se o usuário não pediu menos movimento e o filme não
     está aberto (o modal esconde o vídeo do hero de propósito — ver
     body.is-locked no CSS). */
  if (heroVid && !reduce && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          if (!document.body.classList.contains('is-locked')) heroVid.play().catch(() => {});
        } else {
          heroVid.pause();
        }
      });
    }, { threshold: 0 }).observe(heroVid);
  }

  /* ── 6. Lightbox ─────────────────────────────────────── */
  const lb    = $('#lb');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCap');
  const lbNum = $('#lbCount');
  let group = [];
  let index = 0;
  let lbOpener = null;

  const collect = (tile) => {
    const scope = tile.closest('[data-gallery]');
    if (!scope) return [tile];
    /* tiles diretos + tiles dentro de <figure> */
    return $$('.tile, .bleed', scope).filter(t => t.dataset.full);
  };

  const show = (i) => {
    if (!group.length) return;
    index = (i + group.length) % group.length;
    const t = group[index];
    lbImg.src = t.dataset.full;
    /* nas chapas de dois quadros (.ishot) o alt tem que ser o do quadro
       visível, não o do primeiro <img> do DOM */
    lbImg.alt = (t.querySelector('img.is-active') || t.querySelector('img'))?.alt || '';
    lbCap.textContent = t.dataset.caption || '';
    lbNum.textContent = `${index + 1} / ${group.length}`;

    /* reinicia a animação de entrada: trocar o src não reinicia keyframes
       sozinho, e numa galeria de seis vistas quase iguais a troca seca não
       se percebe — o fade é o que diz "mudou de quadro" */
    lbImg.style.animation = 'none';
    void lbImg.offsetWidth;
    lbImg.style.animation = '';

    /* vizinhos em cache: as chapas são grandes e sem isto cada seta abria um
       branco enquanto o arquivo baixava. Só os dois adjacentes — precarregar
       a galeria inteira custaria mais que a navegação economiza. */
    [index - 1, index + 1].forEach((n) => {
      const nb = group[(n + group.length) % group.length];
      if (nb && nb !== t && nb.dataset.full) { const im = new Image(); im.src = nb.dataset.full; }
    });
  };

  const openLb = (tile) => {
    group = collect(tile);
    if (!group.includes(tile)) group = [tile];
    show(group.indexOf(tile));
    /* galeria de uma imagem só: as setas não teriam pra onde ir */
    lb.classList.toggle('is-single', group.length < 2);
    lb.hidden = false;
    document.body.classList.add('is-locked');
    lbOpener = tile;
    $('#lbClose')?.focus();
  };
  const closeLb = () => {
    lb.hidden = true;
    lbImg.src = '';
    document.body.classList.remove('is-locked');
    /* de volta à chapa que abriu — sem isto o foco caía no <body> e o Tab
       seguinte recomeçava do topo da página. Nas chapas .ishot quem recebe
       foco é o botão interno: o .tile ali é uma <div>, e .focus() numa div
       sem tabindex não faz nada. */
    (lbOpener?.querySelector('.ishot__open') || lbOpener)?.focus();
    lbOpener = null;
  };

  document.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile[data-full], .bleed[data-full]');
    if (tile) { e.preventDefault(); openLb(tile); }
  });

  lb?.addEventListener('keydown', trapIn(lb));
  $('#lbClose')?.addEventListener('click', closeLb);
  $('#lbPrev')?.addEventListener('click', () => show(index - 1));
  $('#lbNext')?.addEventListener('click', () => show(index + 1));
  lb?.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lb__fig')) closeLb();
  });

  /* swipe no mobile */
  let touchX = null;
  lb?.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb?.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  document.addEventListener('keydown', (e) => {
    if (film && !film.hidden && e.key === 'Escape') return closeFilm();
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape')     closeLb();
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft')  show(index - 1);
  });

  /* ── 6b. Interior shots: mini-slider de dois quadros ──── */
  /* Cada chapa do #interior alterna entre o render vazio e o mesmo render
     com pessoas. Gira sozinha a cada 10s, mas cada uma começa com um atraso
     sorteado: em fase, as quatro virariam juntas e a fileira daria um
     "flash" a cada 10s. Desencontradas, a cena respira.
     Só o START é aleatório — a ordem dos quadros continua alternando, senão
     a seta e o giro automático discordariam sobre qual é o próximo quadro.

     Pausa em hover/foco (a WCAG 2.2.2 pede um jeito de parar conteúdo que
     se atualiza sozinho), fora da tela e com a aba em segundo plano; e não
     gira nada sob prefers-reduced-motion. */
  /* Era 10s. O atraso inicial sorteado abaixo e um MULTIPLO deste valor
     (.2 a 1x), entao ele acompanha sozinho: o desencontro entre as quatro
     chapas continua proporcional ao passo, sem segundo numero pra ajustar. */
  const SHOT_MS = 5000;
  const shots = [];

  $$('.ishot').forEach((shot) => {
    const frames = $$('.ishot__img', shot);
    if (frames.length < 2) return;

    let i = Math.max(0, frames.findIndex(f => f.classList.contains('is-active')));
    let timer = null, held = false, onScreen = false;
    const pill = shot.querySelector('.plate-pill');

    const paint = (next) => {
      i = (next + frames.length) % frames.length;
      frames.forEach((f, n) => f.classList.toggle('is-active', n === i));
      /* a lightbox lê data-full/-caption do .tile, então o quadro visível
         precisa estar refletido aqui — senão abre o quadro errado */
      shot.dataset.full = frames[i].getAttribute('src');
      const cap = frames[i].dataset.caption;
      if (cap) shot.dataset.caption = cap;
      /* quadro que traz data-pill renomeia a etiqueta ao aparecer (os passes
         do render: AO, clay, ID…). Sem o atributo a etiqueta fica parada —
         é o caso das horas do dia, onde os dois quadros são o mesmo horário
         e só muda quem está na cena. */
      if (pill && frames[i].dataset.pill) pill.textContent = frames[i].dataset.pill;
    };

    const stop = () => { clearTimeout(timer); timer = null; };
    const tick = () => { paint(i + 1); timer = setTimeout(tick, SHOT_MS); };
    const start = (delay = SHOT_MS) => {
      stop();
      if (reduce || held || !onScreen || document.hidden) return;
      timer = setTimeout(tick, delay);
    };

    /* setas: param o clique antes que ele suba até o handler delegado da
       lightbox — senão trocar de quadro abriria a imagem em tela cheia */
    $$('.ishot__nav', shot).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        paint(i + (btn.classList.contains('ishot__nav--next') ? 1 : -1));
        start();               /* 10s cheios depois de mexer na mão */
      });
    });

    shot.addEventListener('mouseenter', () => { held = true;  stop();  });
    shot.addEventListener('mouseleave', () => { held = false; start(); });
    shot.addEventListener('focusin',    () => { held = true;  stop();  });
    shot.addEventListener('focusout',   () => { held = false; start(); });

    shots.push({
      el: shot,
      /* o primeiro giro sai entre 2s e 10s — é daqui que vem o desencontro
         entre as quatro chapas; do segundo em diante o passo é fixo */
      wake: (visible) => { onScreen = visible; visible ? start(SHOT_MS * (.2 + Math.random() * .8)) : stop(); },
      sync: () => (document.hidden ? stop() : start())
    });
  });

  if (shots.length) {
    /* fora da tela não gira: economiza trabalho e evita que a chapa troque
       de quadro justo enquanto ninguém está olhando */
    const byEl = new Map(shots.map(s => [s.el, s]));
    const shotIO = new IntersectionObserver((entries) => {
      entries.forEach(en => byEl.get(en.target)?.wake(en.isIntersecting));
    }, { rootMargin: '0px 0px -10% 0px' });
    shots.forEach(s => shotIO.observe(s.el));
    document.addEventListener('visibilitychange', () => shots.forEach(s => s.sync()));
  }

  /* ── 7. Turntable fallback (drag-scrub) ──────────────── */
  const tt = $('#viewerFallback');
  if (tt) {
    const img = $('#ttFrame', tt);
    const FRAMES = 36;
    const PATH = (n) => `assets/img/turntable/frame-${String(n).padStart(3, '0')}.webp`;
    let frame = 1, startX = 0, startFrame = 1, dragging = false, preloaded = false;

    /* pré-carrega os 36 frames só quando o fallback vira visível (GLB falhou
       ou o watchdog decidiu por ele) — no caminho feliz o viewer 3D nunca
       precisa deles, então não faz sentido baixar tudo de cara. */
    const preload = () => {
      if (preloaded) return;
      preloaded = true;
      for (let i = 1; i <= FRAMES; i++) { const p = new Image(); p.src = PATH(i); }
    };
    if (!tt.hidden) preload();
    new MutationObserver(() => { if (!tt.hidden) preload(); })
      .observe(tt, { attributes: true, attributeFilter: ['hidden'] });

    const render = () => { img.src = PATH(frame); };

    tt.addEventListener('pointerdown', (e) => {
      dragging = true; startX = e.clientX; startFrame = frame;
      tt.setPointerCapture?.(e.pointerId);
    });
    tt.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const step = Math.round(dx / 12);
      frame = ((startFrame + step - 1) % FRAMES + FRAMES) % FRAMES + 1;
      render();
    });
    tt.addEventListener('pointerup',     () => { dragging = false; });
    tt.addEventListener('pointercancel', () => { dragging = false; });
  }

  /* ── 8. Fullscreen do viewer ─────────────────────────── */
  const stage = $('#viewerStage');
  $('#btnFull')?.addEventListener('click', () => {
    if (!stage) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen?.().catch(() => {});
  });

  /* ── 9. Watchdog do viewer ──────────────────────────
     Se o three.js (CDN) não carregar em 7s, mostra o turntable
     em vez de deixar um retângulo vazio na frente do cliente. */
  /* O fallback cobre os dois painéis (inset:0 + fundo próprio no CSS), então
     mostrá-lo basta — não é preciso esconder cada .viewer__canvas na mão. */
  const vHost = $('#viewerCanvas');
  const vFall = $('#viewerFallback');
  if (vHost && vFall) {
    setTimeout(() => {
      if (!vHost.querySelector('canvas')) {
        vFall.hidden = false;
        $$('.viewer__status').forEach(st => { st.textContent = 'Anteprima rotazione'; });
      }
    }, 7000);
  }
})();
