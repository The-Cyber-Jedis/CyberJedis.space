(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(host) {
    if (reduce || !host) return;
    if (document.getElementById("bg-canvas")) return;

    const canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    host.insertBefore(canvas, host.firstChild);

    const ctx = canvas.getContext("2d");
    const cfg = window.siteConfig?.particles || {};
    const count = cfg.count ?? 48;
    const mouseRadius = cfg.mouseRadius ?? 200;
    const fade = cfg.trailFadeSpeed ?? 0.15;
    const colors = window.siteConfig?.theme?.accents || ["#c0c0c0"];

    let w = 0;
    let h = 0;
    const mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const rect = host.getBoundingClientRect();
      w = Math.max(rect.width, 1);
      h = Math.max(rect.height, 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      size: Math.random() * 2 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    function step() {
      ctx.fillStyle = `rgba(11, 11, 13, ${fade})`;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < mouseRadius && dist > 0) {
          const force = (mouseRadius - dist) / mouseRadius;
          p.vx -= (dx / dist) * force * 0.3;
          p.vy -= (dy / dist) * force * 0.3;
        }
        p.vx += (Math.random() - 0.5) * 0.05;
        p.vy += (Math.random() - 0.5) * 0.05;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 1.5) {
          p.vx = (p.vx / speed) * 1.5;
          p.vy = (p.vy / speed) * 1.5;
        }
        p.x = (p.x + p.vx + w) % w;
        p.y = (p.y + p.vy + h) % h;
        p.vx *= 0.985;
        p.vy *= 0.985;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.25 + Math.random() * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(step);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (e) => {
      const rect = host.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    resize();
    requestAnimationFrame(step);
  }

  window.CJParticles = { mount };
  window.addEventListener("cj:render", () => mount(document.querySelector(".hero")));
})();
