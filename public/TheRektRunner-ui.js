(function(){
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const pnlEl = document.getElementById("pnlVal");
  const restartBtn = document.getElementById("restartBtn");

  const COLORS = {
    bg: "#000000",
    grid: "rgba(0,255,102,0.10)",
    neon: "#00ff66",
    mint: "rgba(138,255,191,0.85)",
    danger: "#ff0033",
    dim: "rgba(0,255,102,0.06)"
  };

  function fit(){
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize", fit, {passive:true});
  fit();

  let mode = "web";
  let t0 = performance.now();

  const world = {
    x: 0,
    speed: 3.2,
    boost: 0,
    dead: false,
    score: 0,
    pnl: 0
  };

  const bull = {
    x: 64,
    y: 260,
    vy: 0,
    r: 10,
    grounded: false
  };

  const terrain = {
    points: [],
    baseY: () => Math.round(window.innerHeight * 0.62),
    amp: 46,
    phase: 0
  };

  const hazards = []; // bear traps
  const boosts = [];  // green candles

  function seededNoise(x){
    // cheap deterministic-ish noise
    return Math.sin(x*0.013) * 0.6 + Math.sin(x*0.041) * 0.3 + Math.sin(x*0.007) * 0.25;
  }

  function updateTerrain(){
    const w = window.innerWidth;
    const step = 10;
    const need = Math.ceil(w/step)+3;
    while(terrain.points.length < need){
      const i = terrain.points.length;
      const px = i*step;
      const nx = (world.x + px);
      const vol = Math.abs(seededNoise(nx)) * 1.2; // "volatility"
      let y = terrain.baseY() + seededNoise(nx) * terrain.amp;

      // red candle crash zones: occasional sharp drops
      const crash = (Math.sin(nx*0.0031) < -0.985) ? 1 : 0;
      if(crash){
        y += 90 + vol*40;
      }

      terrain.points.push({x:px, y, crash});
    }
  }

  function shiftTerrain(dx){
    for(const p of terrain.points) p.x -= dx;
    while(terrain.points.length && terrain.points[0].x < -20) terrain.points.shift();
  }

  function groundYAt(x){
    // linear interp on terrain.points (step=10)
    if(terrain.points.length < 2) return terrain.baseY();
    const step = 10;
    const i = Math.max(0, Math.min(terrain.points.length-2, Math.floor(x/step)));
    const a = terrain.points[i];
    const b = terrain.points[i+1];
    const t = (x - a.x) / (b.x - a.x);
    return a.y + (b.y - a.y) * t;
  }

  function spawn(){
    // bear trap
    if(Math.random() < 0.028){
      hazards.push({
        x: window.innerWidth + 40,
        y: 0,
        w: 22,
        h: 18,
        live: true
      });
    }
    // green candle boost
    if(Math.random() < 0.018){
      boosts.push({
        x: window.innerWidth + 40,
        y: 0,
        w: 14,
        h: 54,
        live: true
      });
    }
  }

  function jump(){
    if(world.dead) { reset(); return; }
    if(bull.grounded){
      bull.vy = -11.6 - Math.min(2.2, world.boost*0.4);
      bull.grounded = false;
    }
  }

  function reset(){
    world.x = 0;
    world.speed = 3.2;
    world.boost = 0;
    world.dead = false;
    world.score = 0;
    world.pnl = 0;
    bull.y = window.innerHeight * 0.45;
    bull.vy = 0;
    bull.grounded = false;
    terrain.points = [];
    hazards.length = 0;
    boosts.length = 0;
  }

  function flashBoost(){
    world.boost = Math.min(6, world.boost + 2.5);
  }

  function setMode(m){ mode = m; }

  // expose for script.js
  window.RektUI = { reset, flashBoost, setMode };

  window.addEventListener("pointerdown", (e)=>{
    // don't jump if interacting with UI buttons/sheet
    if(e.target && (e.target.closest("button") || e.target.closest("input"))) return;
    jump();
  }, {passive:true});

  restartBtn.addEventListener("click", reset);

  function drawGrid(){
    const w = window.innerWidth, h = window.innerHeight;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = COLORS.dim;
    ctx.lineWidth = 1;
    const step = 28;
    for(let x=0; x<=w; x+=step){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
    }
    for(let y=0; y<=h; y+=step){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }
  }

  function drawTerrain(){
    if(terrain.points.length < 2) return;
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.neon;
    ctx.beginPath();
    ctx.moveTo(terrain.points[0].x, terrain.points[0].y);
    for(const p of terrain.points) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // crash zones highlight (danger red glow)
    for(const p of terrain.points){
      if(!p.crash) continue;
      ctx.strokeStyle = "rgba(255,0,51,0.45)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x+14, p.y+50);
      ctx.stroke();
    }
  }

  function drawCandles(){
    // decorative candles scrolling
    const w = window.innerWidth, h = window.innerHeight;
    const n = 14;
    for(let i=0;i<n;i++){
      const x = (w - ((world.x*3 + i*120) % (w+160))) - 40;
      const up = Math.sin((world.x+i*100)*0.01) > -0.2;
      const col = up ? COLORS.neon : COLORS.danger;
      const cy = h*0.22 + (i%5)*34;
      const bh = 26 + (i%6)*10;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, cy-bh); ctx.lineTo(x, cy+bh); ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(x-6, cy-12, 12, 24);
    }
  }

  function drawBull(){
    // pixel-ish bull
    const x = bull.x, y = bull.y;
    ctx.fillStyle = COLORS.neon;
    ctx.fillRect(x-8, y-8, 16, 16);
    ctx.fillRect(x-18, y-2, 10, 6);
    ctx.fillRect(x+8, y-2, 10, 6);
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(x-2, y-2, 4, 4);
  }

  function drawHazards(){
    for(const h of hazards){
      if(!h.live) continue;
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(h.x-h.w/2, h.y+h.h);
      ctx.lineTo(h.x, h.y);
      ctx.lineTo(h.x+h.w/2, h.y+h.h);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,0,51,0.18)";
      ctx.fillRect(h.x-h.w/2, h.y+h.h, h.w, 6);
    }
  }

  function drawBoosts(){
    for(const b of boosts){
      if(!b.live) continue;
      ctx.fillStyle = COLORS.neon;
      ctx.fillRect(b.x-b.w/2, b.y-b.h, b.w, b.h);
      ctx.strokeStyle = COLORS.neon;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y-b.h-14);
      ctx.lineTo(b.x, b.y+10);
      ctx.stroke();
    }
  }

  function collideRectCircle(rx, ry, rw, rh, cx, cy, cr){
    const nx = Math.max(rx, Math.min(cx, rx+rw));
    const ny = Math.max(ry, Math.min(cy, ry+rh));
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function tick(dt){
    if(world.dead) return;

    const base = 3.2 + Math.min(2.6, world.score/700);
    world.speed = base + world.boost*0.55;
    world.boost = Math.max(0, world.boost - dt*0.0016);

    world.x += world.speed;
    world.score += world.speed;
    world.pnl = Math.max(-9999, world.score*0.021 - (world.dead? 80:0));

    // terrain
    updateTerrain();
    shiftTerrain(world.speed);

    // spawn objects
    if(Math.random() < 0.18) spawn();

    // place objects on ground ahead
    for(const h of hazards){
      if(!h.live) continue;
      h.x -= world.speed;
      h.y = groundYAt(h.x) - 18;
      if(h.x < -60) h.live = false;
      if(collideRectCircle(h.x-h.w/2, h.y, h.w, h.h, bull.x, bull.y, bull.r)){
        world.dead = true;
        world.pnl -= 66;
      }
    }
    for(const b of boosts){
      if(!b.live) continue;
      b.x -= world.speed;
      b.y = groundYAt(b.x) - 4;
      if(b.x < -60) b.live = false;
      if(collideRectCircle(b.x-b.w/2, b.y-b.h, b.w, b.h, bull.x, bull.y, bull.r)){
        b.live = false;
        world.boost = Math.min(6, world.boost + 3.2);
      }
    }

    // physics
    const g = 0.62;
    bull.vy += g;
    bull.y += bull.vy;

    const gy = groundYAt(bull.x) - 10;
    if(bull.y >= gy){
      bull.y = gy;
      bull.vy = 0;
      bull.grounded = true;
    }else{
      bull.grounded = false;
    }

    // falling out during crash
    if(bull.y > window.innerHeight + 80){
      world.dead = true;
    }
  }

  function draw(){
    drawGrid();
    drawCandles();
    drawTerrain();
    drawBoosts();
    drawHazards();
    drawBull();

    if(world.dead){
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0,0,window.innerWidth,window.innerHeight);
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 140, window.innerWidth-36, 160);
      ctx.fillStyle = COLORS.danger;
      ctx.font = "700 18px ui-monospace, Menlo, monospace";
      ctx.fillText("REKT.", 34, 182);
      ctx.fillStyle = COLORS.mint;
      ctx.font = "14px ui-monospace, Menlo, monospace";
      ctx.fillText("Tap anywhere to restart.", 34, 212);
      ctx.fillText("Avoid bear traps. Hunt green candles.", 34, 236);
    }
  }

  function fmtUsd(n){
    const sign = n >= 0 ? "+" : "-";
    const v = Math.abs(n);
    return `${sign}$${v.toFixed(2)}`;
  }

  function loop(now){
    const dt = now - t0;
    t0 = now;
    tick(dt);
    draw();
    pnlEl.textContent = fmtUsd(world.pnl);
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();