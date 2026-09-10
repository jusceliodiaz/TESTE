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

  /* ── 5. Film modal ───────────────────────────────────── */
  const modal   = $('#filmModal');
  const filmVid = $('#filmVideo');
  const heroVid = $('#heroLoop');

  const openFilm = () => {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('is-locked');
    heroVid?.pause();
    filmVid?.play().catch(() => {});
    $('#filmClose')?.focus();
  };
  const closeFilm = () => {
    if (!modal) return;
    filmVid?.pause();
    modal.hidden = true;
    document.body.classList.remove('is-locked');
    if (!reduce) heroVid?.play().catch(() => {});
  };
  $('#playFilm')?.addEventListener('click', openFilm);
  $('#filmClose')?.addEventListener('click', closeFilm);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeFilm(); });

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
    lbImg.alt = t.querySelector('img')?.alt || '';
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
    if (modal && !modal.hidden && e.key === 'Escape') return closeFilm();
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape')     closeLb();
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft')  show(index - 1);
  });

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
  const vHost = $('#viewerCanvas');
  const vFall = $('#viewerFallback');
  if (vHost && vFall) {
    setTimeout(() => {
      if (!vHost.querySelector('canvas')) {
        vHost.style.display = 'none';
        vFall.hidden = false;
        const st = $('#viewerStatus');
        if (st) st.textContent = 'Turntable preview';
      }
    }, 7000);
  }


  /* ── 10. Ano no footer (se houver placeholder) ───────── */
  const y = $('#year');
  if (y) y.textContent = String(new Date().getFullYear());
})();
