// game.js — no double-jump, obstacles at ground level only
// Требует: images/cat.png, images/cat_dead.png, crystal.png, fire.png, oblako.png, bg*.png

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

// ---------- State ----------
let y = 0;                 // высота кота от земли (px)
let vy = 0;                // вертикальная скорость (px/s)
let lives = 3;
let score = 0;
let paused = true;         // стартуем в паузе (появится Start)
let obstacles = [];
let clouds = [];

scoreEl.innerText = "Score: " + score;

// ---------- UI: Start overlay ----------
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

// ---------- Background ----------
const backgrounds = ["images/bg1.PNG", "images/bg2.PNG", "images/bg3.PNG"];
let currentBg = 0;
function changeBackground() {
  game.style.backgroundImage = `url(${backgrounds[currentBg]})`;
  currentBg = (currentBg + 1) % backgrounds.length;
}
changeBackground();
setInterval(changeBackground, 30000);

// ---------- Lives ----------
function renderLives() {
  livesEl.style.backgroundImage = `url(images/lives${lives}.png)`;
}
renderLives();

// ---------- Movement / spawn params ----------
let obstacleSpeed = 4.2;
let speedIncrease = 0.35;
let speedInterval = 11000;
let maxSpeed = 11;

// mobile tweak
const isMobile = (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
if (isMobile) {
  obstacleSpeed = Math.max(2.6, obstacleSpeed * 0.75);
  speedIncrease = Math.max(0.12, speedIncrease * 0.55);
}

function increaseSpeed() {
  if (obstacleSpeed < maxSpeed) {
    obstacleSpeed += speedIncrease;
    if (obstacleSpeed > maxSpeed) obstacleSpeed = maxSpeed;
  }
  setTimeout(increaseSpeed, speedInterval);
}
increaseSpeed();

// ---------- Hitboxes ----------
function getHitboxRect(el) {
  const box = el ? (el.querySelector ? el.querySelector(".hitbox") : null) : null;
  if (!box || !box.getBoundingClientRect) {
    try {
      return el.getBoundingClientRect();
    } catch (e) {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }
  }
  try {
    return box.getBoundingClientRect();
  } catch (e) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }
}
function isColliding(catEl, obstacleEl) {
  const catBox = getHitboxRect(catEl);
  const obstacleBox = getHitboxRect(obstacleEl);
  return !(
    catBox.right < obstacleBox.left ||
    catBox.left > obstacleBox.right ||
    catBox.bottom < obstacleBox.top ||
    catBox.top > obstacleBox.bottom
  );
}

// ---------- Obstacles / Clouds ----------
// Все препятствия строго на земле (bottom: 0)
const obstacleTypes = [
  { img: "images/crystal.png", class: "crystal" },
  { img: "images/fire.png", class: "fire" }
];

function createObstacle() {
  const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
  const obstacle = document.createElement("div");
  obstacle.classList.add("obstacle", type.class);
  obstacle.style.backgroundImage = `url(${type.img})`;
  obstacle.style.left = game.offsetWidth + "px";
  obstacle.style.bottom = "0px"; // ВСЕ препятствия — на земле
  obstacle.innerHTML = `<div class="hitbox"></div>`;
  game.appendChild(obstacle);
  obstacles.push(obstacle);
}

function createCloud() {
  const cloud = document.createElement("div");
  cloud.classList.add("cloud");
  cloud.style.backgroundImage = `url(images/oblako.png)`;
  cloud.style.left = game.offsetWidth + "px";
  const topVh = (Math.random() * 8 + 2);
  cloud.style.top = topVh + "vh";
  game.appendChild(cloud);
  clouds.push(cloud);
}

// ---------- Jump system (single jump only) ----------
const GRAVITY = 2200; // px/s^2
const BASE_JUMP_HEIGHT = 125; // px for strength = 1
const MIN_STRENGTH = 0.95;
const MAX_STRENGTH = 1.85;
const LONG_PRESS_MS = 380;

const maxJumps = 1;       // <-- Только один прыжок
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
  } catch (e) {
    console.error("startJumpWithStrength error:", e);
    return false;
  }
}

// Input handling: игнорируем ввод, когда стартовый оверлей открыт
let pressStartTime = 0;
let pressingKey = false;
let pressingMouse = false;
let pressingTouch = false;

document.addEventListener("keydown", (e) => {
  if (startOverlayEl) return;            // блокируем ввод до старта
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
  if (
    e.target.tagName === "BUTTON" ||
    e.target.tagName === "A" ||
    e.target.closest("a") ||
    e.target.closest(".modal") ||
    startOverlayEl
  ) return;

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
  
  if (
    e.target.tagName === "BUTTON" ||
    e.target.tagName === "A" ||
    e.target.closest("a") ||
    e.target.closest(".modal") ||
    startOverlayEl
  ) return;

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

// ---------- Life / Death ----------
function loseLife() {
  if (paused) return;
  lives--;
  renderLives();

  if (lives <= 0) {
    paused = true;
    obstacles.forEach(o => o.remove());
    clouds.forEach(c => c.remove());
    obstacles = [];
    clouds = [];

    cat.style.backgroundImage = `url("images/cat_dead.PNG")`;
    cat.style.transition = "transform 0.6s ease";
    cat.style.transform = "rotate(180deg)";

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
    }
  }, 300);
}

// ---------- Spawn scheduler ----------
const MIN_GAP_PX_BASE_DESKTOP = 220;
const MIN_GAP_PX_BASE_MOBILE = 300;
const MIN_GAP_PX_BASE = isMobile ? MIN_GAP_PX_BASE_MOBILE : MIN_GAP_PX_BASE_DESKTOP;

let nextObstacleSpawnSec = performance.now() / 1000 + 1.0;
function sampleExp(mean) {
  return -Math.log(1 - Math.random()) * mean;
}
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

// ---------- Game loop ----------
let lastTime = performance.now();

function gameLoop(time) {
  try {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (!paused) {
      // physics
      if (Math.abs(vy) > 0 || y > 0) {
        vy -= GRAVITY * dt;
        y += vy * dt;
        if (y <= 0) {
          y = 0;
          vy = 0;
          jumpsUsed = 0;                 // сбрасываем использование прыжка при касании земли
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
        cat.style.bottom = Math.round(y) + "px";
      }

      // move obstacles
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
        } catch (e) {
          console.error("Collision check error:", e);
        }
        if (left < -200) {
          ob.remove();
          obstacles.splice(i, 1);
          score++;
          scoreEl.innerText = "Score: " + score;
        }
      }

      // clouds
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

      // spawn
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

// ---------- Leaderboard UI ----------
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

// ---------- Start control ----------
function startGame() {
  if (!paused) return;
  paused = false;
  score = 0;
  lives = 3;
  y = 0;
  vy = 0;
  obstacles.forEach(o => o.remove());
  clouds.forEach(c => c.remove());
  obstacles = [];
  clouds = [];
  renderLives();
  scoreEl.innerText = "Score: " + score;
  lastTime = performance.now();
  scheduleNextObstacle();
  scheduleNextCloud();
}
