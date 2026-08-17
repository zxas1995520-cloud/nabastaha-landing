/* ============================================================
   NABASTAHA — main.js
   The existing local animation is the cinematic opening.
   It is INTEGRATED, not recreated. ANIMATION_PATH is the single
   source of truth for the animation location.
   ============================================================ */
(function () {
  "use strict";

  /* JS is active: gate entrance/reveal states behind this class */
  document.documentElement.classList.add("js");

  /* ---------- centralized animation path ---------- */
  const ANIMATION_PATH = "./animation/intro.mp4";
  const STORAGE_KEY = "nabastaha_intro_seen";

  const prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const intro = document.getElementById("intro");
  const stage = document.getElementById("intro-stage");
  const skipBtn = document.getElementById("skip-intro");
  const body = document.body;

  /* ============================================================
     1. INTRO — existing local animation
     ============================================================ */

  const setSeen = function () {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch (e) { /* ignore */ }
  };

  const finishQuick = function () {
    /* Returning visitor or reduced-motion: short fade to the page. */
    body.classList.add("page-live");
    intro.classList.add("is-loaded", "is-out", "is-gone");
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("revealed");
    });
    const sticky = document.getElementById("chaos-sticky");
    if (sticky) sticky.classList.add("done");
    setTimeout(function () { intro.remove(); }, 700);
  };

  const buildVideo = function () {
    const video = document.createElement("video");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "auto");
    video.disablePictureInPicture = true;
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("tabindex", "-1");
    video.style.opacity = "0";

    const source = document.createElement("source");
    source.src = ANIMATION_PATH;
    source.type = "video/mp4";
    video.appendChild(source);

    return video;
  };

  /* Analyze the final frame of the supplied animation so the
     transition can adapt to how it actually ends. Default is the
     warm golden rise. */
  const analyzeEnding = function (video) {
    try {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);

      const band = ctx.getImageData(0, Math.floor(h * 0.7), w, Math.floor(h * 0.3)).data;
      let sum = 0, n = 0;
      for (let i = 0; i < band.length; i += 4) {
        sum += 0.2126 * band[i] + 0.7152 * band[i + 1] + 0.0722 * band[i + 2];
        n++;
      }
      const avgBand = sum / n;

      const full = ctx.getImageData(0, 0, w, Math.floor(h * 0.55)).data;
      let fsum = 0, fn = 0;
      for (let i = 0; i < full.length; i += 4) {
        fsum += 0.2126 * full[i] + 0.7152 * full[i + 1] + 0.0722 * full[i + 2];
        fn++;
      }
      const avgFull = fsum / fn;

      if (avgBand > 150 && avgFull > 100) {
        intro.classList.add("ending-bright"); /* ivory dissolve */
      } else if (avgFull < 45) {
        intro.classList.add("ending-dark"); /* stronger golden rise */
      }
      /* otherwise: default warm golden rise */
    } catch (e) { /* default golden rise */ }
  };

  const runIntro = function () {
    /* Cancel the CSS safety-net auto-dismiss — JS owns the intro now. */
    intro.style.animation = "none";

    const video = buildVideo();
    stage.appendChild(video);

    let transitionStarted = false;
    let played = false;
    let fallbackTimer = null;
    let hardTimer = null;

    const startTransition = function (viaSkip) {
      if (transitionStarted) return;
      transitionStarted = true;

      try { video.pause(); } catch (e) { /* ignore */ }
      if (fallbackTimer) { clearTimeout(fallbackTimer); }
      if (hardTimer) { clearTimeout(hardTimer); }

      analyzeEnding(video);

      /* The landing page starts revealing behind the dissolve. */
      body.classList.add("page-live");

      /* Short cinematic hold so the final frame registers. */
      const hold = viaSkip ? 0 : 420;
      setTimeout(function () {
        intro.classList.add("is-out");
        skipBtn.classList.remove("is-visible");
        skipBtn.hidden = true;
        setSeen();
      }, hold);
    };

    const finishIntro = function () {
      setTimeout(function () {
        intro.classList.add("is-gone");
        setTimeout(function () { intro.remove(); }, 700);
      }, 1500);
    };

    const handleFailure = function () {
      if (transitionStarted) return;
      intro.classList.add("is-loaded");
      setTimeout(function () { startTransition(true); }, 700);
    };

    /* --- accurate end detection: the HTML5 `ended` event --- */
    video.addEventListener("ended", function () {
      startTransition(false);
      finishIntro();
    });

    /* --- safety net only (never the primary trigger) --- */
    video.addEventListener("loadedmetadata", function () {
      const dur = video.duration;
      if (Number.isFinite(dur) && dur > 0) {
        fallbackTimer = setTimeout(function () {
          if (!transitionStarted) { startTransition(true); finishIntro(); }
        }, (dur * 1000) + 1600);
      }
    });

    video.addEventListener("loadeddata", function () {
      intro.classList.add("is-loaded");
    });

    let fadedIn = false;
    const fadeVideoIn = function () {
      if (fadedIn) return;
      fadedIn = true;
      video.style.transition = "opacity 0.9s ease";
      video.style.opacity = "1";
    };
    video.addEventListener("canplay", fadeVideoIn);
    setTimeout(fadeVideoIn, 2400); /* safety: never sit on a blank dark screen */

    const play = function () {
      if (played || transitionStarted) return;
      played = true;
      try {
        const p = video.play();
        if (p && typeof p.catch === "function") {
          p.catch(function () {
            video.muted = true;
            const retry = video.play();
            if (retry && typeof retry.catch === "function") {
              retry.catch(handleFailure);
            }
          });
        }
      } catch (e) { handleFailure(); }
    };

    video.addEventListener("canplay", play);
    video.addEventListener("error", handleFailure);

    /* --- Skip Intro (non-distracting, appears after a moment) --- */
    setTimeout(function () {
      if (transitionStarted) return;
      skipBtn.hidden = false;
      requestAnimationFrame(function () { skipBtn.classList.add("is-visible"); });
    }, 900);

    skipBtn.addEventListener("click", function () {
      setSeen();
      startTransition(true);
      finishIntro();
    });

    /* --- Hard safety net: force transition after 14 s no matter what --- */
    hardTimer = setTimeout(function () {
      if (!transitionStarted) { startTransition(true); finishIntro(); }
    }, 14000);

    /* --- Early readyState check: if video data never arrives in 3 s, fail fast --- */
    setTimeout(function () {
      if (transitionStarted) return;
      if (video.readyState < 2) { /* HAVE_CURRENT_DATA or less */
        handleFailure();
      }
    }, 3000);
  };

  /* ============================================================
     2. NAVIGATION
     ============================================================ */

  const initNav = function () {
    const nav = document.getElementById("nav");
    const burger = document.getElementById("nav-burger");
    const links = document.getElementById("nav-links");
    if (!nav || !burger || !links) return;

    const onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 30);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    burger.addEventListener("click", function () {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });

    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  };

  /* ============================================================
     3. SCROLL REVEALS
     ============================================================ */

  const initReveals = function () {
    const els = document.querySelectorAll("[data-reveal]");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("revealed"); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  };

  /* ============================================================
     4. CHAOS → CLARITY (scroll-driven)
     ============================================================ */

  const initChaos = function () {
    const sticky = document.getElementById("chaos-sticky");
    const grid = document.getElementById("chaos-grid");
    if (!sticky || !grid) return;
    const tall = sticky.parentElement;
    const chips = Array.prototype.slice.call(grid.querySelectorAll(".chip"));

    chips.forEach(function (chip, i) {
      const spread = Math.min(grid.getBoundingClientRect().width / 4.4, 175);
      const ox = (Math.random() * 2 - 1) * spread;
      const oy = (Math.random() * 2 - 1) * spread * 0.6;
      const rot = (Math.random() * 2 - 1) * 15;
      chip.style.setProperty("--ox", ox.toFixed(1) + "px");
      chip.style.setProperty("--oy", oy.toFixed(1) + "px");
      chip.style.setProperty("--rot", rot.toFixed(1) + "deg");
      chip.style.setProperty("--o", (0.45 + Math.random() * 0.32).toFixed(2));
      chip.style.setProperty("--bl", (1.2 + Math.random() * 1.6).toFixed(2) + "px");
      chip.style.setProperty("--d", ((i % 6) * 0.07).toFixed(2) + "s");
    });

    if (prefersReducedMotion) { sticky.classList.add("done"); return; }

    let raf = null;
    let done = false;

    const update = function () {
      const rect = tall.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const progress = total > 0 ? scrolled / total : 0;

      if (!done && progress > 0.42) {
        done = true;
        sticky.classList.add("done");
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
      raf = null;
    };

    const onScroll = function () {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  };

  /* ============================================================
     5. INTERACTIVE MEDICAL TERMINOLOGY
     ============================================================ */

  const termData = {
    mandibular: {
      english: "Mandibular Nerve",
      arabic: "العصب الفكي السفلي",
      ipa: "«ماندِبيولار نيرف»",
      text: "هو فرع من العصب ثلاثي التوائم (Trigeminal Nerve) يغذي الجزء السفلي من الوجه — الأسنان السفلية، الفك السفلي، وعضلات المضغ. لو انضغط يسبب ألم أو تنميل بالفك السفلي. فهمت مساره؟ صار حفظ اسمه أسهل."
    },
    trigeminal: {
      english: "Trigeminal Nerve",
      arabic: "العصب ثلاثي التوائم",
      ipa: "«ترايجيمينال نيرف»",
      text: "من أكبر أعصاب الوجه، يتفرع لثلاثة فروع رئيسية: العيوني (Ophthalmic)، الفكي العلوي (Maxillary)، والفكي السفلي (Mandibular). اسمه «ثلاثي التوائم» جاي من التفرعات الثلاثة — افهم التفرعات وصار الحفظ سهل."
    },
    maxillary: {
      english: "Maxillary Artery",
      arabic: "الشريان الفكي العلوي",
      ipa: "«ماكسيلاري أرتري»",
      text: "واحد من أهم الأوعية الدموية بالوجه، يمد الفك العلوي والوجه والأسنان بالدم، ويمر من خلف عنق الفك السفلي (Mandible) إلى عمق الوجه. موقع مساره هو اللي يخليه مهم بالتشريح العملي."
    }
  };

  const initTerms = function () {
    const tabs = document.querySelectorAll(".term-tab");
    const panel = document.getElementById("term-panel");
    if (!panel) return;

    const fields = {
      english: document.getElementById("term-english"),
      arabic: document.getElementById("term-arabic"),
      ipa: document.getElementById("term-ipa"),
      text: document.getElementById("term-text")
    };

    const swap = function (key) {
      const d = termData[key];
      if (!d) return;
      fields.english.textContent = d.english;
      fields.arabic.textContent = d.arabic;
      fields.ipa.textContent = d.ipa;
      fields.text.textContent = d.text;

      panel.classList.remove("is-swapping");
      void panel.offsetWidth;
      panel.classList.add("is-swapping");
    };

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        swap(tab.dataset.term);
      });
    });
  };

  /* ============================================================
     6. SUBTLE PARALLAX (transform/opacity only)
     ============================================================ */

  const initParallax = function () {
    if (prefersReducedMotion) return;
    const els = document.querySelectorAll("[data-parallax]");
    if (!els.length) return;

    let raf = null;
    const update = function () {
      const sy = window.scrollY;
      els.forEach(function (el) {
        const speed = parseFloat(el.dataset.parallax) || 0;
        el.style.setProperty("--par", (sy * speed).toFixed(1) + "px");
      });
      raf = null;
    };
    const onScroll = function () {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  };

  /* ============================================================
     INIT
     ============================================================ */

  const init = function () {
    initNav();
    initReveals();
    initChaos();
    initTerms();
    initParallax();

    if (prefersReducedMotion) {
      let seen = false;
      try { seen = !!sessionStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      if (seen) {
        finishQuick();
        return;
      }
      /* First-time visitor with reduced motion: still show the intro,
         just with simplified transitions (handled by CSS). */
    }

    let seen = false;
    try { seen = !!sessionStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }

    if (seen) {
      finishQuick();
    } else {
      runIntro();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
