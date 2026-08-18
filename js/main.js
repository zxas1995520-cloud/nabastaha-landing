/* ============================================================
   NABASTAHA — main.js
   Cinematic intro → landing page transition.
   Single state machine: idle → playing → transitioning → gone
   ============================================================ */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const ANIMATION_PATH = "./animation/intro.mp4";
  const STORAGE_KEY = "nabastaha_intro_seen";
  const HARD_TIMEOUT = 18000;

  const prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const intro = document.getElementById("intro");
  const stage = document.getElementById("intro-stage");
  const skipBtn = document.getElementById("skip-intro");
  const body = document.body;

  /* ---------- helpers ---------- */

  const setSeen = function () {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
  };

  const hasSeen = function () {
    try { return !!sessionStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
  };

  const clearAllTimers = function (timers) {
    timers.forEach(function (t) { if (t) clearTimeout(t); });
  };

  /* ---------- finish the intro: always called exactly once ---------- */

  let introFinished = false;

  const finishIntro = function () {
    if (introFinished) return;
    introFinished = true;

    body.classList.remove("intro-active");

    setTimeout(function () {
      intro.classList.add("is-gone");
      setTimeout(function () { intro.remove(); }, 700);
    }, 1500);
  };

  /* ---------- skip straight to page (returning visitors) ---------- */

  const skipToIntro = function () {
    body.classList.add("page-live");
    intro.classList.add("is-loaded", "is-out", "is-gone");
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("revealed");
    });
    var sticky = document.getElementById("chaos-sticky");
    if (sticky) sticky.classList.add("done");
    setTimeout(function () { intro.remove(); }, 700);
  };

  /* ---------- video builder ---------- */

  const buildVideo = function () {
    var video = document.createElement("video");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "auto");
    video.disablePictureInPicture = true;
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("tabindex", "-1");
    video.style.opacity = "0";

    var source = document.createElement("source");
    source.src = ANIMATION_PATH;
    source.type = "video/mp4";
    video.appendChild(source);
    return video;
  };

  /* ---------- analyze final frame for adaptive transition ---------- */

  const analyzeEnding = function (video) {
    try {
      var w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return;
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);

      var band = ctx.getImageData(0, Math.floor(h * 0.7), w, Math.floor(h * 0.3)).data;
      var sum = 0, n = 0;
      for (var i = 0; i < band.length; i += 4) {
        sum += 0.2126 * band[i] + 0.7152 * band[i + 1] + 0.0722 * band[i + 2];
        n++;
      }
      var avgBand = sum / n;

      var full = ctx.getImageData(0, 0, w, Math.floor(h * 0.55)).data;
      var fsum = 0, fn = 0;
      for (var j = 0; j < full.length; j += 4) {
        fsum += 0.2126 * full[j] + 0.7152 * full[j + 1] + 0.0722 * full[j + 2];
        fn++;
      }
      var avgFull = fsum / fn;

      if (avgBand > 150 && avgFull > 100) {
        intro.classList.add("ending-bright");
      } else if (avgFull < 45) {
        intro.classList.add("ending-dark");
      }
    } catch (e) {}
  };

  /* ============================================================
     1. INTRO — cinematic opening with local animation
     ============================================================ */

  const runIntro = function () {
    body.classList.add("intro-active");

    /* Cancel CSS safety-net — JS owns the intro now. */
    intro.style.animation = "none";

    var video = buildVideo();
    stage.appendChild(video);

    var timers = [];
    var state = "idle"; /* idle → playing → transitioning → done */

    const startTransition = function (viaSkip) {
      if (state === "transitioning" || state === "done") return;
      state = "transitioning";
      clearAllTimers(timers);

      try { video.pause(); } catch (e) {}
      analyzeEnding(video);

      body.classList.add("page-live");

      var hold = viaSkip ? 0 : 420;
      setTimeout(function () {
        intro.classList.add("is-out");
        skipBtn.classList.remove("is-visible");
        skipBtn.hidden = true;
        setSeen();
        state = "done";
        finishIntro();
      }, hold);
    };

    /* --- video ended (normal completion) --- */
    video.addEventListener("ended", function () {
      startTransition(false);
    });

    /* --- loadedmetadata: set duration-based fallback --- */
    video.addEventListener("loadedmetadata", function () {
      var dur = video.duration;
      if (Number.isFinite(dur) && dur > 0) {
        intro.classList.add("is-loaded");
        timers.push(setTimeout(function () {
          if (state === "idle" || state === "playing") {
            startTransition(true);
          }
        }, (dur * 1000) + 1600));
      }
    });

    video.addEventListener("loadeddata", function () {
      intro.classList.add("is-loaded");
    });

    /* --- fade video in when ready --- */
    var fadedIn = false;
    const fadeVideoIn = function () {
      if (fadedIn) return;
      fadedIn = true;
      video.style.transition = "opacity 0.9s ease";
      video.style.opacity = "1";
    };
    video.addEventListener("canplay", fadeVideoIn);
    timers.push(setTimeout(fadeVideoIn, 2400));

    /* --- play when ready --- */
    var played = false;
    const play = function () {
      if (played || state !== "idle") return;
      played = true;
      state = "playing";
      try {
        var p = video.play();
        if (p && typeof p.catch === "function") {
          p.catch(function () {
            video.muted = true;
            var retry = video.play();
            if (retry && typeof retry.catch === "function") {
              retry.catch(function () {});
            }
          });
        }
      } catch (e) {}
    };
    video.addEventListener("canplay", play);

    /* --- video failed to load: fall through to page --- */
    video.addEventListener("error", function () {
      if (state !== "idle") return;
      intro.classList.add("is-loaded");
      timers.push(setTimeout(function () {
        startTransition(true);
      }, 700));
    });

    /* --- Skip button --- */
    timers.push(setTimeout(function () {
      if (state === "done") return;
      skipBtn.hidden = false;
      requestAnimationFrame(function () { skipBtn.classList.add("is-visible"); });
    }, 900));

    skipBtn.addEventListener("click", function () {
      setSeen();
      startTransition(true);
    });

    /* --- Hard safety net: force transition after 18s no matter what --- */
    timers.push(setTimeout(function () {
      if (state === "idle" || state === "playing") {
        startTransition(true);
      }
    }, HARD_TIMEOUT));
  };

  /* ============================================================
     2. NAVIGATION
     ============================================================ */

  const initNav = function () {
    var nav = document.getElementById("nav");
    var burger = document.getElementById("nav-burger");
    var links = document.getElementById("nav-links");
    if (!nav || !burger || !links) return;

    var onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 30);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    burger.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
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
    var els = document.querySelectorAll("[data-reveal]");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("revealed"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
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
    var sticky = document.getElementById("chaos-sticky");
    var grid = document.getElementById("chaos-grid");
    if (!sticky || !grid) return;
    var tall = sticky.parentElement;
    var chips = Array.prototype.slice.call(grid.querySelectorAll(".chip"));

    chips.forEach(function (chip, i) {
      var spread = Math.min(grid.getBoundingClientRect().width / 4.4, 175);
      var ox = (Math.random() * 2 - 1) * spread;
      var oy = (Math.random() * 2 - 1) * spread * 0.6;
      var rot = (Math.random() * 2 - 1) * 15;
      chip.style.setProperty("--ox", ox.toFixed(1) + "px");
      chip.style.setProperty("--oy", oy.toFixed(1) + "px");
      chip.style.setProperty("--rot", rot.toFixed(1) + "deg");
      chip.style.setProperty("--o", (0.45 + Math.random() * 0.32).toFixed(2));
      chip.style.setProperty("--bl", (1.2 + Math.random() * 1.6).toFixed(2) + "px");
      chip.style.setProperty("--d", ((i % 6) * 0.07).toFixed(2) + "s");
    });

    if (prefersReducedMotion) { sticky.classList.add("done"); return; }

    var raf = null;
    var done = false;

    var update = function () {
      var rect = tall.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height - vh;
      var scrolled = Math.min(Math.max(-rect.top, 0), total);
      var progress = total > 0 ? scrolled / total : 0;

      if (!done && progress > 0.42) {
        done = true;
        sticky.classList.add("done");
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
      raf = null;
    };

    var onScroll = function () {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  };

  /* ============================================================
     5. INTERACTIVE MEDICAL TERMINOLOGY
     ============================================================ */

  var termData = {
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
    var tabs = document.querySelectorAll(".term-tab");
    var panel = document.getElementById("term-panel");
    if (!panel) return;

    var fields = {
      english: document.getElementById("term-english"),
      arabic: document.getElementById("term-arabic"),
      ipa: document.getElementById("term-ipa"),
      text: document.getElementById("term-text")
    };

    var swap = function (key) {
      var d = termData[key];
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
    var els = document.querySelectorAll("[data-parallax]");
    if (!els.length) return;

    var raf = null;
    var update = function () {
      var sy = window.scrollY;
      els.forEach(function (el) {
        var speed = parseFloat(el.dataset.parallax) || 0;
        el.style.setProperty("--par", (sy * speed).toFixed(1) + "px");
      });
      raf = null;
    };
    var onScroll = function () {
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

    if (hasSeen() || (prefersReducedMotion && hasSeen())) {
      skipToIntro();
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
