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

  /* ── 0a. Pausa global de movimento ─────────────────────
     A página soma três fontes de movimento contínuo: o loop da hero, os
     quatro sliders .ishot e os doze loops do #motion. A WCAG 2.2.2 pede UM
     mecanismo pra parar o que se move sozinho por mais de 5s — e "pausa no
     hover", que era o que existia, não é mecanismo nenhum pra quem não usa
     ponteiro.
     Em vez de um controle por peça (doze botõezinhos sobre as chapas), um
     só no topo: cada fonte registra aqui o que fazer, o botão avisa todas
     de uma vez, e o visualizador 3D — que é outro módulo — escuta o mesmo
     estado por evento.
     Fora do escopo de propósito: as entradas [data-reveal], que acontecem
     uma vez e acabam. A 2.2.2 fala de movimento CONTÍNUO.
     Não persiste entre visitas, também de propósito: quem precisa disso
     por condição vestibular já está coberto pelo prefers-reduced-motion,
     que desliga tudo sozinho sem pedir clique nenhum. */
  let motionPaused = false;
  const motionSubs = [];
  const onMotion = (fn) => motionSubs.push(fn);

  const btnMotion = $('#btnMotion');
  const setMotion = (paused) => {
    motionPaused = paused;
    if (btnMotion) {
      btnMotion.classList.toggle('is-paused', paused);
      btnMotion.setAttribute('aria-label', paused
        ? 'Riprendi i video e le animazioni'
        : 'Metti in pausa i video e le animazioni');
      const label = $('.nav__motion-label', btnMotion);
      /* o rótulo visível diz a AÇÃO, não o estado — e continua contido no
         aria-label acima, como a 2.5.3 (Label in Name) exige */
      if (label) label.textContent = paused ? 'Riprendi' : 'Pausa';
    }
    motionSubs.forEach(fn => fn(paused));
    /* viewer.js roda como módulo separado e não enxerga nada daqui */
    document.dispatchEvent(new CustomEvent('plinth:motion', { detail: { paused } }));
  };
  btnMotion?.addEventListener('click', () => setMotion(!motionPaused));

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

  /* A versão anterior acendia o link só enquanto a PRÓPRIA seção cruzava uma
     faixa de 5% no meio da tela (rootMargin -45%/-50%). Como #modeling e
     #post são seções que contêm apenas o título, o link piscava por um
     instante e apagava — e a pessoa percorria Argilla + Render in studio
     (várias telas) com NENHUM item ativo, sem referência de onde estava.
     O critério agora é "a última seção cuja borda de cima já passou da
     linha": o rótulo de um capítulo fica aceso pelo capítulo inteiro,
     inclusive nas seções sem âncora que vêm depois dele. */
  const links = $$('.nav__link');
  const marks = links
    .map(l => ({ link: l, el: $(l.getAttribute('href')) }))
    .filter(x => x.el);

  if (marks.length) {
    /* ordem do DOM, não a da barra: #viewer aparece na página ANTES de #post
       e #interior, mas é o último item do menu */
    const ordered = marks.slice().sort((a, b) =>
      (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);

    let queued = false;
    const spy = () => {
      queued = false;
      const lineY = window.innerHeight * 0.45;
      let current = null;
      ordered.forEach((m) => { if (m.el.getBoundingClientRect().top <= lineY) current = m; });
      links.forEach(l => l.classList.toggle('is-active', !!current && l === current.link));
    };
    /* uma leitura de layout por QUADRO, não por evento de scroll: sem o rAF
       são 4 getBoundingClientRect a cada tick do scroll, no meio do paint */
    const queueSpy = () => { if (!queued) { queued = true; requestAnimationFrame(spy); } };
    document.addEventListener('scroll', queueSpy, { passive: true });
    window.addEventListener('resize', queueSpy);
    spy();
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
    if (!reduce && !motionPaused) heroVid?.play().catch(() => {});
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
    let heroOn = false;
    /* três condições, uma função só: na tela, movimento não pausado, e o
       modal do filme fechado. Qualquer uma delas mudando reavalia o mesmo
       ponto, em vez de cada evento chamar play/pause por conta própria. */
    const syncHero = () => {
      if (heroOn && !motionPaused && !document.body.classList.contains('is-locked')) {
        heroVid.play().catch(() => {});
      } else {
        heroVid.pause();
      }
    };
    new IntersectionObserver((entries) => {
      entries.forEach((e) => { heroOn = e.isIntersecting; syncHero(); });
    }, { threshold: 0 }).observe(heroVid);
    onMotion(syncHero);
  }

  /* ── 5b. Loops do #motion ────────────────────────────── */

  /* Doze <video> em autoplay é o mesmo problema da hero multiplicado: cada um
     mantém um decoder vivo enquanto está "tocando", mesmo a três telas de
     distância, e no fim da página eles dividiriam a GPU com os dois contextos
     WebGL do visualizador. Então só toca o que está na tela — e quem sai dela
     pausa e devolve o decoder.
     Sob prefers-reduced-motion nenhum deles toca: são loops decorativos, e o
     atributo autoplay do markup (que existe pro caso do JS falhar) é desfeito
     aqui no primeiro quadro. */
  const loops = $$('video[data-loop]');
  if (loops.length) {
    if (reduce) {
      /* sem movimento os loops nunca tocam — então o poster deixa de ser
         placeholder e passa a ser a chapa. Carrega logo, é o que se vê. */
      loops.forEach((v) => {
        v.autoplay = false;
        v.pause();
        if (v.dataset.poster) { v.poster = v.dataset.poster; delete v.dataset.poster; }
      });
    } else if ('IntersectionObserver' in window) {
      /* um conjunto do que está na tela + uma única função que decide, pelo
         mesmo motivo da hera: visibilidade, aba e pausa global são três
         entradas do mesmo estado, não três donos do play/pause */
      const onScreen = new Set();
      const syncLoops = () => {
        loops.forEach((v) => {
          if (onScreen.has(v) && !motionPaused && !document.hidden) v.play().catch(() => {});
          else v.pause();
        });
      };
      /* O poster entra por JS, não pelo atributo: `poster` não aceita
         loading="lazy", então doze deles no markup seriam 340 KB baixados
         no load da página mesmo pra quem nunca rola até aqui. Com
         data-poster a imagem só é pedida quando a chapa se aproxima — e
         chega antes do vídeo, porque um webp de ~30 KB resolve muito mais
         rápido que abrir o mp4 com preload="none".
         Margem de 300px (era 200): o poster precisa de um respiro a mais
         que o play pra não aparecer já dentro do campo de visão. */
      const loopIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            if (e.target.dataset.poster) {
              e.target.poster = e.target.dataset.poster;
              delete e.target.dataset.poster;
            }
            onScreen.add(e.target);
          } else {
            onScreen.delete(e.target);
          }
        });
        syncLoops();
      }, { rootMargin: '300px 0px' });
      loops.forEach((v) => { v.pause(); loopIO.observe(v); });
      /* aba em segundo plano: o navegador já costuma estrangular o decoder,
         mas pausar explícito evita o caso em que ele não faz isso */
      document.addEventListener('visibilitychange', syncLoops);
      onMotion(syncLoops);
    }
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
      if (reduce || motionPaused || held || !onScreen || document.hidden) return;
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
    /* sync() chama start(), que agora cai fora na guarda quando pausado —
       ou seja, o mesmo caminho serve pra parar e pra retomar */
    onMotion(() => shots.forEach(s => s.sync()));
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
