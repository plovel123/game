// game.js — подъем спрайтов: trackOffset чуть больше, препятствия чуть меньше сдвинуты вниз
// Требует: images/cat.png, images/cat_dead.PNG, cat1.png, cat2.png, crystal*.png, fire*.png, oblako.png, bg*.png

const game = document.getElementById("game");
const cat = document.getElementById("cat");
const livesEl = document.getElementById("lives");
const scoreEl = document.getElementById("score");
const gameOverModal = document.getElementById("gameOverModal");
const finalScoreEl = document.getElementById("finalScore");
const restartButton = document.getElementById("restartButton");
const saveStatusEl = document.getElementById("saveStatus");
const leaderboardModal = document.getElementById("leaderboardModal");
const closeLeaderboard = document.getElementById("closeLeaderboard");
const showLeaderboardBtn = document.getElementById("showLeaderboard");

// === Настройки (поднять спрайты) ===
// Фоллбек/ориентир, если автоматическое вычисление не сработает:
let BASE_TRACK_OFFSET = 140;   // чуть больше, чем раньше (поднимает кота)
const TRACK_PERCENT = 0.27;      // 20% от высоты окна #game -> рельс (увеличивает высоту)
const MIN_TRACK = 110;
const MAX_TRACK = 160;

// Препятствия: уменьшил сдвиг вниз чтобы они были повыше
let OBSTACLE_Y_ADJUST = 6;   // было 6, стало 2 — грибы поднимаются вверх
let FIRE_RELATIVE_ADJUST = 6; // огонек на том же уровне, что и грибы (0 = ровно на том же уровне)

// trackOffset будет вычисляться динамически
let trackOffset = BASE_TRACK_OFFSET;


// === Sprite run animation ===
const catFrames = ["cat1.png", "cat2.png"];
let catFrameIndex = 0;
let catFrameInterval = null;
let animateRun = false;
let isDead = false;

function startRunAnimation() {
  if (isDead) return;
  stopRunAnimation();
  animateRun = true;
  catFrameIndex = 0;
  cat.style.backgroundImage = `url(images/${catFrames[catFrameIndex]})`;
  catFrameInterval = setInterval(() => {
    if (!animateRun || isDead) return;
    catFrameIndex = (catFrameIndex + 1) % catFrames.length;
    cat.style.backgroundImage = `url(images/${catFrames[catFrameIndex]})`;
  }, 250);
}

function stopRunAnimation() {
  animateRun = false;
  if (catFrameInterval) {
    clearInterval(catFrameInterval);
    catFrameInterval = null;
  }
}

// === State ===
let y = 0;
let vy = 0;
let lives = 3;
let score = 0;
let paused = true;
let obstacles = [];
let clouds = [];
scoreEl.innerText = "Score: " + score;

// === Умное вычисление trackOffset ===
function recomputeTrackOffset() {
  const h = Math.max(320, game.clientHeight || 480);
  let suggested = Math.round(h * TRACK_PERCENT);
  suggested = Math.max(MIN_TRACK, Math.min(MAX_TRACK, suggested));
  trackOffset = suggested || BASE_TRACK_OFFSET;

  // обновим кота (и если он в воздухе - учитываем y в gameLoop, тут ставим базовую позицию)
  cat.style.bottom = trackOffset + "px";
  if (!cat.style.backgroundImage) {
    cat.style.backgroundImage = `url(images/${catFrames[0]})`;
  }
}

// initial compute + resize handler
recomputeTrackOffset();
window.addEventListener("resize", () => {
  clearTimeout(window._gc_resize_to);
  window._gc_resize_to = setTimeout(() => {
    recomputeTrackOffset();
    // скорректируем живые препятствия
    obstacles.forEach((ob) => {
      const cls = ob.classList.contains("fire") ? "fire" : "crystal";
      const base = trackOffset - OBSTACLE_Y_ADJUST;
      const extra = (cls === "fire") ? FIRE_RELATIVE_ADJUST : 0;
      ob.style.bottom = Math.max(0, base + extra) + "px";
    });
    cat.style.bottom = trackOffset + "px";
  }, 120);
});

// pause bg animation by default
try { game.style.animationPlayState = "paused"; } catch (e) {}

// === Start overlay ===
let startOverlayEl = null;
let onStartKey = null;
function createStartOverlay() {
  if (startOverlayEl) return;
  const overlay = document.createElement("div");
  overlay.id = "startOverlay";
  overlay.style = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.65);
    z-index: 1200;
  `;
  const box = document.createElement("div");
  box.style = `
    background: rgba(18,18,18,0.95);
    padding: 28px;
    border-radius: 12px;
    text-align: center;
    color: white;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    width: min(520px, 90vw);
  `;
  const title = document.createElement("h2");
  title.textContent = "Press Start";
  title.style.margin = "0 0 12px 0";
  const info = document.createElement("p");
  info.textContent = "Tap / Space to jump. Hold longer for a stronger jump.";
  info.style.margin = "6px 0 18px 0";
  const btn = document.createElement("button");
  btn.id = "startButton";
  btn.className = "btn primary";
  btn.textContent = "Start";
  btn.style.fontSize = "18px";
  btn.style.padding = "10px 18px";
  box.appendChild(title);
  box.appendChild(info);
  box.appendChild(btn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  startOverlayEl = overlay;

  const removeStartListener = () => {
    if (onStartKey) {
      document.removeEventListener("keydown", onStartKey);
      onStartKey = null;
    }
  };

  btn.addEventListener("click", () => {
    if (paused) startGame();
    removeStartListener();
    overlay.remove();
    startOverlayEl = null;
  });

  onStartKey = function (e) {
    if (e.code === "Space" || e.code === "Enter") {
      if (paused) startGame();
      removeStartListener();
      if (startOverlayEl) {
        startOverlayEl.remove();
        startOverlayEl = null;
      }
      e.preventDefault && e.preventDefault();
    }
  };
  document.addEventListener("keydown", onStartKey);
}
createStartOverlay();

// === Background helpers ===
function enableBackgroundMovement() {
  try { game.style.animationPlayState = "running"; } catch (e) {}
  game.classList.add("bg-moving");
}
function disableBackgroundMovement() {
  try { game.style.animationPlayState = "paused"; } catch (e) {}
  game.classList.remove("bg-moving");
}

// === Lives render ===
function renderLives() {
  livesEl.style.backgroundImage = `url(images/lives${lives}.png)`;
}
renderLives();

// === Movement parameters ===
let obstacleSpeed = 4.2;
let speedIncrease = 0.35;
let speedInterval = 11000;
let maxSpeed = 11;
const isMobile = (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
if (isMobile) {
  obstacleSpeed = Math.max(2.6, obstacleSpeed * 0.75);
  speedIncrease = Math.max(0.12, speedIncrease * 0.55);
  BASE_TRACK_OFFSET =300;
}
function increaseSpeed() {
  if (obstacleSpeed < maxSpeed) {
    obstacleSpeed += speedIncrease;
    if (obstacleSpeed > maxSpeed) obstacleSpeed = maxSpeed;
  }
  setTimeout(increaseSpeed, speedInterval);
}
increaseSpeed();

// === Hitboxes ===
function getHitboxRect(el) {
  const box = el ? (el.querySelector ? el.querySelector(".hitbox") : null) : null;
  if (!box || !box.getBoundingClientRect) {
    try { return el.getBoundingClientRect(); } catch (e) { return { left:0,right:0,top:0,bottom:0 }; }
  }
  try { return box.getBoundingClientRect(); } catch (e) { return { left:0,right:0,top:0,bottom:0 }; }
}
function isColliding(catEl, obstacleEl) {
  const catBox = getHitboxRect(catEl);
  const obstacleBox = getHitboxRect(obstacleEl);
  return !(catBox.right < obstacleBox.left || catBox.left > obstacleBox.right || catBox.bottom < obstacleBox.top || catBox.top > obstacleBox.bottom);
}

// === Obstacles / Clouds ===
const obstacleTypes = [
  { img: "images/crystal.png", class: "crystal" },
  { img: "images/fire.png", class: "fire" }
];

function createObstacle() {
  const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
  const obstacle = document.createElement("div");
  obstacle.classList.add("obstacle", type.class);
  obstacle.style.left = game.offsetWidth + "px";

  let finalBottom = trackOffset - OBSTACLE_Y_ADJUST;
  if (type.class === "fire") finalBottom += FIRE_RELATIVE_ADJUST;

  obstacle.style.bottom = Math.max(0, finalBottom) + "px";
  obstacle.innerHTML = `<div class="hitbox"></div>`;

  let frames = [];
  if (type.class === "crystal") frames = ["crystal1.png","crystal2.png","crystal3.png","crystal4.png"];
  if (type.class === "fire") frames = ["fire1.png","fire2.png","fire3.png","fire4.png"];
  let frameIndex = 0;
  if (frames.length) {
    obstacle.style.backgroundImage = `url(images/${frames[frameIndex]})`;
    const animId = setInterval(() => {
      if (!document.body.contains(obstacle)) { clearInterval(animId); return; }
      frameIndex = (frameIndex + 1) % frames.length;
      obstacle.style.backgroundImage = `url(images/${frames[frameIndex]})`;
    }, 150);
  } else {
    obstacle.style.backgroundImage = `url(${type.img})`;
  }

  game.appendChild(obstacle);
  obstacles.push(obstacle);
}

function createCloud() {
  const cloud = document.createElement("div");
  cloud.classList.add("cloud");
  cloud.style.backgroundImage = `url(images/oblako.png)`;
  cloud.style.left = game.offsetWidth + "px";
  cloud.style.top = (Math.random() * 8 + 2) + "vh";
  game.appendChild(cloud);
  clouds.push(cloud);
}

// === Jump (single) ===
const GRAVITY = 2200;
const BASE_JUMP_HEIGHT = 125;
const MIN_STRENGTH = 0.95;
const MAX_STRENGTH = 1.85;
const LONG_PRESS_MS = 380;
const maxJumps = 1;
let jumpsUsed = 0;
const coyoteTime = 0.12;
let lastGroundTime = -9999;
const jumpBufferTime = 0.12;
let lastJumpRequest = null;

function computeStrength(ms) {
  const t = Math.min(ms, LONG_PRESS_MS) / LONG_PRESS_MS;
  return MIN_STRENGTH + (MAX_STRENGTH - MIN_STRENGTH) * t;
}
function canJumpNow(nowSec) {
  if (jumpsUsed < maxJumps) return true;
  if (nowSec - lastGroundTime <= coyoteTime) return true;
  return false;
}
function startJumpWithStrength(strength) {
  try {
    if (!Number.isFinite(strength)) strength = MIN_STRENGTH;
    const nowSec = performance.now() / 1000;
    if (!canJumpNow(nowSec)) {
      lastJumpRequest = { time: nowSec, strength };
      return false;
    }
    const targetH = BASE_JUMP_HEIGHT * strength;
    const v0 = Math.sqrt(2 * GRAVITY * targetH);
    vy = v0;
    jumpsUsed++;
    return true;
  } catch (e) { console.error(e); return false; }
}

// === Input handlers ===
let pressStartTime = 0;
let pressingKey = false;
let pressingMouse = false;
let pressingTouch = false;

document.addEventListener("keydown", (e) => {
  if (startOverlayEl) return;
  if (e.repeat) return;
  if ((e.code === "Space" || e.code === "ArrowUp") && !pressingKey) {
    pressingKey = true;
    pressStartTime = performance.now();
    e.preventDefault && e.preventDefault();
  }
});
document.addEventListener("keyup", (e) => {
  if (startOverlayEl) return;
  if ((e.code === "Space" || e.code === "ArrowUp") && pressingKey) {
    pressingKey = false;
    const dur = Math.max(0, performance.now() - pressStartTime);
    const strength = computeStrength(dur);
    startJumpWithStrength(strength);
    pressStartTime = 0;
  }
});

game.addEventListener("mousedown", (e) => {
  if (e.target.tagName === "BUTTON" || e.target.tagName === "A" || e.target.closest("a") || e.target.closest(".modal") || startOverlayEl) return;
  if (pressingMouse) return;
  pressingMouse = true;
  pressStartTime = performance.now();
  e.preventDefault && e.preventDefault();
});
window.addEventListener("mouseup", (e) => {
  if (startOverlayEl) return;
  if (!pressingMouse) return;
  pressingMouse = false;
  const dur = Math.max(0, performance.now() - pressStartTime);
  const strength = computeStrength(dur);
  startJumpWithStrength(strength);
  pressStartTime = 0;
});

game.addEventListener("touchstart", (e) => {
  if (e.target.tagName === "BUTTON" || e.target.tagName === "A" || e.target.closest("a") || e.target.closest(".modal") || startOverlayEl) return;
  if (pressingTouch) return;
  pressingTouch = true;
  pressStartTime = performance.now();
  e.preventDefault && e.preventDefault();
}, { passive: false });
game.addEventListener("touchend", (e) => {
  if (startOverlayEl) return;
  if (!pressingTouch) return;
  pressingTouch = false;
  const dur = Math.max(0, performance.now() - pressStartTime);
  const strength = computeStrength(dur);
  startJumpWithStrength(strength);
  pressStartTime = 0;
});

// === Life / Death ===
function loseLife() {
  if (paused) return;
  lives--;
  renderLives();

  if (lives <= 0) {
    paused = true;
    isDead = true;

    stopRunAnimation();
    disableBackgroundMovement();

    obstacles.forEach(o => o.remove());
    clouds.forEach(c => c.remove());
    obstacles = [];
    clouds = [];

    cat.style.backgroundImage = `url("images/cat_dead.PNG")`;
    cat.style.transition = "transform 0.6s ease";
    cat.style.transform = "rotate(180deg)";
    cat.style.bottom = (trackOffset) + "px";

    setTimeout(async () => {
      finalScoreEl.textContent = String(score);
      gameOverModal.style.display = "flex";
      if (typeof walletAddress === "string" && walletAddress) {
        saveStatusEl.textContent = "Saving result...";
        try {
          const resp = await fetch("/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: walletAddress, score })
          });
          const data = await resp.json();
          saveStatusEl.textContent = data && data.success ? "Result saved! ✅" : "Can't save result ❌";
        } catch (e) {
          console.error(e);
          saveStatusEl.textContent = "Save result error";
        }
      } else {
        saveStatusEl.textContent = "Connect your wallet to save result.";
      }
    }, 600);

    return;
  }

  paused = true;
  stopRunAnimation();
  disableBackgroundMovement();

  let blinkCount = 0;
  const blink = setInterval(() => {
    cat.style.opacity = cat.style.opacity === "0" ? "1" : "0";
    blinkCount++;
    if (blinkCount > 5) {
      clearInterval(blink);
      cat.style.opacity = "1";
      obstacles.forEach(o => o.remove());
      clouds.forEach(c => c.remove());
      obstacles = [];
      clouds = [];
      paused = false;
      if (!isDead) {
        startRunAnimation();
        enableBackgroundMovement();
      }
    }
  }, 300);
}

// === Spawn scheduler ===
const MIN_GAP_PX_BASE_DESKTOP = 220;
const MIN_GAP_PX_BASE_MOBILE = 300;
const MIN_GAP_PX_BASE = isMobile ? MIN_GAP_PX_BASE_MOBILE : MIN_GAP_PX_BASE_DESKTOP;

let nextObstacleSpawnSec = performance.now() / 1000 + 1.0;
function sampleExp(mean) { return -Math.log(1 - Math.random()) * mean; }
function scheduleNextObstacle() {
  const now = performance.now() / 1000;
  const speedPxPerSec = Math.max(40, obstacleSpeed * 60);
  const minGapPx = MIN_GAP_PX_BASE + Math.max(0, obstacleSpeed - 4) * 22;
  const minIntervalSec = Math.max(0.20, minGapPx / speedPxPerSec);
  const mean = minIntervalSec * 1.25;
  let interval = sampleExp(mean);
  if (interval < minIntervalSec) interval = minIntervalSec + Math.random() * 0.25 * minIntervalSec;
  interval += (Math.random() - 0.5) * 0.12 * interval;
  nextObstacleSpawnSec = now + interval;
}
scheduleNextObstacle();

let nextCloudSpawnSec = performance.now() / 1000 + 2.0;
function scheduleNextCloud() {
  const now = performance.now() / 1000;
  const mean = 3.8;
  nextCloudSpawnSec = now + Math.max(1.0, sampleExp(mean));
}
scheduleNextCloud();

// === Game loop ===
let lastTime = performance.now();

function gameLoop(time) {
  try {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (!paused) {
      if (Math.abs(vy) > 0 || y > 0) {
        vy -= GRAVITY * dt;
        y += vy * dt;
        if (y <= 0) {
          y = 0;
          vy = 0;
          jumpsUsed = 0;
          lastGroundTime = performance.now() / 1000;
          if (lastJumpRequest) {
            const nowSec = performance.now() / 1000;
            if (nowSec - lastJumpRequest.time <= jumpBufferTime) {
              startJumpWithStrength(lastJumpRequest.strength);
              lastJumpRequest = null;
            } else {
              lastJumpRequest = null;
            }
          }
        }
        cat.style.bottom = Math.round(y + trackOffset) + "px";
      }

      const speedPxPerSec = Math.max(40, obstacleSpeed * 60);
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        let left = parseFloat(ob.style.left);
        if (!Number.isFinite(left)) left = game.offsetWidth;
        left -= speedPxPerSec * dt;
        ob.style.left = left + "px";
        try {
          if (isColliding(cat, ob)) {
            ob.remove();
            obstacles.splice(i, 1);
            loseLife();
            continue;
          }
        } catch (e) { console.error("Collision check error:", e); }
        if (left < -200) {
          ob.remove();
          obstacles.splice(i, 1);
          score++;
          scoreEl.innerText = "Score: " + score;
        }
      }

      for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i];
        let left = parseFloat(c.style.left);
        if (!Number.isFinite(left)) left = game.offsetWidth;
        left -= 80 * dt;
        c.style.left = left + "px";
        if (left < -400) {
          c.remove();
          clouds.splice(i, 1);
        }
      }

      const nowSec = time / 1000;
      if (nowSec >= nextObstacleSpawnSec) {
        createObstacle();
        scheduleNextObstacle();
      }
      if (nowSec >= nextCloudSpawnSec) {
        createCloud();
        scheduleNextCloud();
      }
    }
  } catch (err) {
    console.error("GameLoop error:", err);
  } finally {
    try {
      requestAnimationFrame(gameLoop);
    } catch (e) {
      console.error("requestAnimationFrame failed:", e);
      setTimeout(() => requestAnimationFrame(gameLoop), 1000);
    }
  }
}
requestAnimationFrame(gameLoop);

// === Leaderboard UI ===
showLeaderboardBtn && showLeaderboardBtn.addEventListener("click", async (e) => {
  try {
    const res = await fetch("/leaderboard");
    const data = await res.json();
    const ul = document.getElementById("leaders");
    ul.innerHTML = "";
    data.forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${p.wallet_address} — ${p.score}`;
      ul.appendChild(li);
    });
    leaderboardModal.style.display = "flex";
  } catch (err) {
    console.error("Ошибка загрузки лидерборда:", err);
  }
  e.currentTarget && e.currentTarget.blur && e.currentTarget.blur();
});
closeLeaderboard && closeLeaderboard.addEventListener("click", () => {
  leaderboardModal.style.display = "none";
});
if (restartButton) restartButton.addEventListener("click", () => location.reload());

// === Start control ===
function startGame() {
  if (!paused) return;
  paused = false;
  score = 0;
  lives = 3;
  y = 0;
  vy = 0;
  isDead = false;
  obstacles.forEach(o => o.remove());
  clouds.forEach(c => c.remove());
  obstacles = [];
  clouds = [];
  renderLives();
  scoreEl.innerText = "Score: " + score;
  lastTime = performance.now();
  scheduleNextObstacle();
  scheduleNextCloud();

  startRunAnimation();
  enableBackgroundMovement();
}
