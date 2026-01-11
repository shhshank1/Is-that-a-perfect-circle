// =================================================================
// --- 1. SETUP & INITIALIZATION ---
// =================================================================

const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");

const scoreDisplay = document.getElementById("scoreDisplay");
const bestScoreDisplay = document.getElementById("bestScoreDisplay");
const messageDisplay = document.getElementById("messageDisplay");
const newHighScoreDisplay = document.getElementById("newHighScoreDisplay");
const shareButton = document.getElementById("shareButton");

const BEST_SCORE_KEY = "perfectCircleBestScore";

// Fullscreen canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game constants
const CENTER = { x: canvas.width / 2, y: canvas.height / 2 };
const MIN_RADIUS = 50;
const MIN_SWEEP_ANGLE = 5; // ~286 degrees in radians

let isDrawing = false;
let points = [];
let drawingDirection = 0; // 0 = unknown, 1 = CW, -1 = CCW

loadBestScore();
drawInitialState();

// =================================================================
// --- 2. MOUSE TRACKING & DRAWING LOGIC ---
// =================================================================

function drawInitialState() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCenterDot();
}

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  points = [{ x: e.clientX, y: e.clientY }];
  drawingDirection = 0;
  hideMessage();
  if (navigator.share) hideShareButton();
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  points.push({ x: e.clientX, y: e.clientY });
  drawPathAndCalculateScore();
});

canvas.addEventListener("mouseup", () => {
  if (!isDrawing) return;

  isDrawing = false;
  hideMessage();

  const totalAngle = getTotalAngle(points);
  if (Math.abs(totalAngle) < MIN_SWEEP_ANGLE) {
    showMessage("Draw a full circle", false);
    setTimeout(hideMessage, 2000);
    return;
  }

  const finalScore = calculateAccuracy(points);
  updateBestScore(finalScore);

  if (navigator.share) {
    showShareButton(finalScore);
  }
});

// --- ADD THESE TOUCH EVENTS HERE FOR MOBILE SUPPORT ---

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault(); // Prevents phone from scrolling/refreshing
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousedown", {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent); // Maps touch to mousedown
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault(); 
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousemove", {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent); // Maps move to mousemove
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  const mouseEvent = new MouseEvent("mouseup", {});
  canvas.dispatchEvent(mouseEvent); // Maps lift-off to mouseup
});

// --- END OF TOUCH EVENTS ---

function drawPathAndCalculateScore() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCenterDot();

  let messageShown = false;

  // Direction validation
  if (points.length > 2) {
    const p1 = points[points.length - 2];
    const p2 = points[points.length - 1];

    const angle1 = Math.atan2(p1.y - CENTER.y, p1.x - CENTER.x);
    const angle2 = Math.atan2(p2.y - CENTER.y, p2.x - CENTER.x);

    let angleDiff = angle2 - angle1;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    if (drawingDirection === 0 && points.length > 5) {
      drawingDirection = Math.sign(angleDiff);
    }

    if (
      drawingDirection !== 0 &&
      Math.abs(angleDiff) > 0.01 &&
      Math.sign(angleDiff) === -drawingDirection
    ) {
      showMessage("Wrong way", true);
      messageShown = true;
    }
  }

  // Radius validation
  if (!messageShown) {
    const lastPoint = points[points.length - 1];
    const distanceFromCenter = Math.sqrt(
      Math.pow(lastPoint.x - CENTER.x, 2) +
      Math.pow(lastPoint.y - CENTER.y, 2)
    );

    if (distanceFromCenter < MIN_RADIUS) {
      showMessage("Try drawing a bigger circle", true);
      messageShown = true;
    }
  }

  if (!messageShown) hideMessage();

  const score = calculateAccuracy(points);
  const color = getScoreColor(score);

  drawSmoothPath(points, color);

  scoreDisplay.textContent = `${score}%`;
  scoreDisplay.style.color = color;
}

function drawSmoothPath(path, color) {
  if (path.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);

  for (let i = 1; i < path.length - 2; i++) {
    const xc = (path[i].x + path[i + 1].x) / 2;
    const yc = (path[i].y + path[i + 1].y) / 2;
    ctx.quadraticCurveTo(path[i].x, path[i].y, xc, yc);
  }

  const last = path.length - 1;
  ctx.quadraticCurveTo(
    path[last - 1].x,
    path[last - 1].y,
    path[last].x,
    path[last].y
  );

  ctx.stroke();
}

function drawCenterDot() {
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
}

// =================================================================
// --- 3. SCORING & ACCURACY LOGIC ---
// =================================================================

function getTotalAngle(points) {
  if (points.length < 2) return 0;

  let totalAngle = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];

    const angle1 = Math.atan2(p1.y - CENTER.y, p1.x - CENTER.x);
    const angle2 = Math.atan2(p2.y - CENTER.y, p2.x - CENTER.x);

    let angleDiff = angle2 - angle1;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    totalAngle += angleDiff;
  }

  return totalAngle;
}

function calculateAccuracy(points) {
  if (points.length < 10) return 0;

  const distances = points.map((p) => {
    const dx = p.x - CENTER.x;
    const dy = p.y - CENTER.y;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const avgDistance =
    distances.reduce((sum, d) => sum + d, 0) / distances.length;

  if (avgDistance === 0) return 0;

  const deviation = Math.sqrt(
    distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) /
      distances.length
  );

  const score = Math.max(0, 100 - (deviation / avgDistance) * 150);
  return Math.floor(score);
}

function getScoreColor(score) {
  const hue = (score / 100) * 120;
  return `hsl(${hue}, 100%, 50%)`;
}

// =================================================================
// --- 4. MESSAGE & SHARE HANDLING ---
// =================================================================

function showMessage(text, blinking = false) {
  messageDisplay.textContent = text;
  messageDisplay.style.opacity = 1;
  messageDisplay.classList.toggle("blinking", blinking);
}

function hideMessage() {
  messageDisplay.style.opacity = 0;
  messageDisplay.classList.remove("blinking");
}

if (navigator.share) {
  function showShareButton() {
    shareButton.classList.add("active");
  }

  function hideShareButton() {
    shareButton.classList.remove("active");
  }

  shareButton.addEventListener("click", async () => {
    const finalScore = calculateAccuracy(points);
    try {
      await navigator.share({
        title: "Perfect Circle Challenge",
        text: `I scored ${finalScore}% drawing a perfect circle! Can you beat it?`,
        url: window.location.href,
      });
    } catch (err) {
      console.error("Share failed:", err);
    }
  });
}

// =================================================================
// --- 5. LOCAL STORAGE FOR BEST SCORE ---
// =================================================================

function loadBestScore() {
  const best = localStorage.getItem(BEST_SCORE_KEY) || 0;
  bestScoreDisplay.textContent = `Best: ${best}%`;
  return parseInt(best, 10);
}

function updateBestScore(currentScore) {
  const best = loadBestScore();

  if (currentScore > best) {
    localStorage.setItem(BEST_SCORE_KEY, currentScore);
    bestScoreDisplay.textContent = `Best: ${currentScore}%`;

    newHighScoreDisplay.classList.add("active");
    setTimeout(() => {
      newHighScoreDisplay.classList.remove("active");
    }, 2000);
  }
}
