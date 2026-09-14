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

  /* ── 5. Filme (modal) ────────────────────────────────── */
  /* Reescrito junto com o markup e o CSS, por causa do bug do vídeo
     aparecendo atrás da hero. O que mudou de fato:

     O player nasce com preload="none" no HTML, então não busca nem
     decodifica nada até a primeira abertura. Antes, dois <video>
     apontando pro mesmo arquivo ficavam vivos desde o carregamento da
     página — e duas camadas de vídeo disputando planos de overlay da GPU
     é a hipótese mais forte pro quadro escapar do container.
     O par disso está no CSS: body.is-locked esconde o vídeo da hero
     enquanto o filme toca. */
  const film    = $('#film');
  const player  = $('#filmPlayer');
  const heroVid = $('#heroLoop');
  let armed = false;

  const openFilm = () => {
    if (!film || !player) return;
    if (!armed) { player.load(); armed = true; }   /* pega os <source> do HTML */
    film.hidden = false;
    document.body.classList.add('is-locked');
    heroVid?.pause();
    player.play().catch(() => {});                 /* sem autoplay: o usuário usa os controles */
    $('#filmClose')?.focus();
  };

  const closeFilm = () => {
    if (!film || !player) return;
    player.pause();
    film.hidden = true;
    document.body.classList.remove('is-locked');
    if (!reduce) heroVid?.play().catch(() => {});
    $('#filmOpen')?.focus();                       /* devolve o foco ao botão de origem */
  };

  $('#filmOpen')?.addEventListener('click', openFilm);
  $('#filmClose')?.addEventListener('click', closeFilm);
  /* clique no fundo fecha; clique no <video> não, senão pausar fecharia */
  film?.addEventListener('click', (e) => { if (e.target === film) closeFilm(); });

  /* Se o vídeo do hero não existir/não puder tocar, mostra só o poster. */
  heroVid?.addEventListener('error', () => { heroVid.style.display = 'none'; }, true);
  if (reduce) heroVid?.pause();

  /* ── 6. Lightbox ─────────────────────────────────────── */
  const lb    = $('#lb');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCap');
  const lbNum = $('#lbCount');
  let group = [];
  let index = 0;

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
  };

  const openLb = (tile) => {
    group = collect(tile);
    if (!group.includes(tile)) group = [tile];
    show(group.indexOf(tile));
    lb.hidden = false;
    document.body.classList.add('is-locked');
    $('#lbClose')?.focus();
  };
  const closeLb = () => {
    lb.hidden = true;
    lbImg.src = '';
    document.body.classList.remove('is-locked');
  };

  document.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile[data-full], .bleed[data-full]');
    if (tile) { e.preventDefault(); openLb(tile); }
  });

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
  const SHOT_MS = 10000;
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
        $$('.viewer__status').forEach(st => { st.textContent = 'Anteprima turntable'; });
      }
    }, 7000);
  }
})();
