/* ============================================================
   星际猎手 · 飞机大战 — 官网交互
   ============================================================ */
(() => {
  "use strict";

  /* ---------- 1. 星野背景动画 ---------- */
  const canvas = document.getElementById("starfield");
  const ctx = canvas.getContext("2d");
  let stars = [];
  let meteors = [];
  let W = 0, H = 0, DPR = 1;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const STAR_COLORS = ["#ffffff", "#ffffff", "#cfe9ff", "#00d4ff", "#a78bfa", "#ffd166"];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
  }

  function buildStars() {
    const count = Math.max(80, Math.min(240, Math.floor((W * H) / 8500)));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.4 + Math.random() * 1.3,
      a: 0.25 + Math.random() * 0.6,
      tw: 0.4 + Math.random() * 1.6,       // 闪烁速度
      ph: Math.random() * Math.PI * 2,     // 闪烁相位
      vy: 0.04 + Math.random() * 0.14,     // 缓慢下坠
      depth: 0.25 + Math.random() * 0.75,  // 视差深度
      color: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0]
    }));
  }

  let nextMeteor = performance.now() + 2500;
  function spawnMeteor() {
    const fromLeft = Math.random() > 0.5;
    meteors.push({
      x: fromLeft ? -60 : W + 60,
      y: Math.random() * H * 0.45,
      vx: (fromLeft ? 1 : -1) * (5 + Math.random() * 4),
      vy: 2.2 + Math.random() * 1.6,
      len: 90 + Math.random() * 90,
      life: 1
    });
    nextMeteor = performance.now() + 4000 + Math.random() * 5000;
  }

  function tick(now) {
    // 鼠标视差缓动
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;

    ctx.clearRect(0, 0, W, H);
    const t = now / 1000;

    for (const s of stars) {
      const alpha = s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph));
      const px = s.x - mouse.x * s.depth * 8;
      const py = s.y + (t * s.vy * 22) % H - mouse.y * s.depth * 6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(px, (py + H) % H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 流星
    if (now > nextMeteor) spawnMeteor();
    meteors = meteors.filter((m) => m.life > 0);
    for (const m of meteors) {
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.016;
      const tailX = m.x - m.vx * (m.len / Math.hypot(m.vx, m.vy));
      const tailY = m.y - m.vy * (m.len / Math.hypot(m.vx, m.vy));
      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, "rgba(140,220,255,.85)");
      grad.addColorStop(1, "rgba(140,220,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouse.tx = (e.clientX / W - 0.5) * 2;
    mouse.ty = (e.clientY / H - 0.5) * 2;
  });
  resize();
  requestAnimationFrame(tick);

  /* ---------- 2. 导航 ---------- */
  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    })
  );

  // 高亮当前区块
  const sections = [...document.querySelectorAll("main section[id]")];
  const linkMap = new Map(
    [...navLinks.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a])
  );
  const spy = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          linkMap.forEach((a, id) => a.classList.toggle("active", id === en.target.id));
        }
      }
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => spy.observe(s));

  /* ---------- 3. 滚动显现 ---------- */
  const revealObs = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          revealObs.unobserve(en.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => revealObs.observe(el));

  /* ---------- 4. 复制命令 ---------- */
  const copyBtn = document.getElementById("copyBtn");
  copyBtn.addEventListener("click", async () => {
    const code = document.getElementById(copyBtn.dataset.target).textContent.trim();
    let ok = false;
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
    }
    if (ok) {
      const old = copyBtn.textContent;
      copyBtn.textContent = "已复制 ✓";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = old;
        copyBtn.classList.remove("copied");
      }, 1600);
    }
  });

  /* ---------- 5. 试玩弹窗 ---------- */
  const modal = document.getElementById("demoModal");
  const frame = document.getElementById("demoFrame");
  const loader = document.getElementById("demoLoader");
  const fallback = document.getElementById("demoFallback");
  const GAME_URL =
    "https://raw.githubusercontent.com/gzdyj/feijidazhan/master/index.html?v=" + Date.now();
  let gameHtml = null;
  let loading = false;

  async function openDemo() {
    modal.classList.add("open");
    document.body.classList.add("modal-open");
    if (gameHtml) {
      frame.hidden = false;
      loader.hidden = true;
      return;
    }
    if (loading) return;
    loading = true;
    loader.hidden = false;
    fallback.hidden = true;
    frame.hidden = true;
    try {
      const res = await fetch(GAME_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      gameHtml = await res.text();
      frame.srcdoc = gameHtml;
      frame.hidden = false;
      loader.hidden = true;
    } catch {
      loader.hidden = true;
      fallback.hidden = false;
    } finally {
      loading = false;
    }
  }

  function closeDemo() {
    modal.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  document.getElementById("playBtn").addEventListener("click", (e) => {
    e.preventDefault();
    openDemo();
  });
  document.getElementById("navPlayBtn").addEventListener("click", (e) => {
    e.preventDefault();
    openDemo();
  });
  modal.querySelectorAll("[data-close]").forEach((el) =>
    el.addEventListener("click", closeDemo)
  );
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeDemo();
  });

  /* ---------- 6. 页脚年份 ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
