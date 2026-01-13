const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");
const glassNav = document.getElementById("glassNav");
const shareBtnNav = document.getElementById("shareBtnNav");
const introOverlay = document.getElementById("introOverlay");
const scoreDisplay = document.getElementById("scoreDisplay");
const bestNav = document.getElementById("bestScoreNav");

const CENTER = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const MIN_RADIUS = 60;
const MAX_ROTATION = 6.4; 
const MIN_ROTATION = 5.9; 

let isDrawing = false;
let isGameStarted = false;
let points = [];
let drawingDirection = 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- GAME LIFECYCLE ---
document.getElementById("startBtn").addEventListener("click", () => {
    isGameStarted = true;
    introOverlay.style.display = "none";
    scoreDisplay.classList.remove("hidden");
});

canvas.addEventListener("mousedown", (e) => {
    if (!isGameStarted) return;
    isDrawing = true;
    points = [{ x: e.clientX, y: e.clientY }];
    drawingDirection = 0;
    glassNav.classList.add("hidden"); // Navbar disappears while drawing
    hideMessage();
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing || !isGameStarted) return;
    points.push({ x: e.clientX, y: e.clientY });
    if (Math.abs(getTotalAngle(points)) > MAX_ROTATION) { handleEndDrawing(); return; }
    drawPathAndCalculateScore();
});

canvas.addEventListener("mouseup", handleEndDrawing);

// Mobile
canvas.addEventListener("touchstart", (e) => {
    if(!isGameStarted) return;
    const t = e.touches[0];
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
    if(!isDrawing || !isGameStarted) return;
    const t = e.touches[0];
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });
canvas.addEventListener("touchend", () => canvas.dispatchEvent(new MouseEvent("mouseup", {})));

function handleEndDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    glassNav.classList.remove("hidden"); // Navbar reappears

    if (Math.abs(getTotalAngle(points)) < MIN_ROTATION) {
        showMessage("CLOSE THE CIRCLE!", true);
        failAndReset();
        return;
    }

    const finalScore = calculateAccuracy(points);
    updateBestScore(parseFloat(finalScore));
    shareBtnNav.classList.add("active"); // Only show share after a success
}

function drawPathAndCalculateScore() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p2 = points[points.length - 1];
    
    if (points.length > 5) {
        if (Math.sqrt(Math.pow(p2.x - CENTER.x, 2) + Math.pow(p2.y - CENTER.y, 2)) < MIN_RADIUS) {
            showMessage("TOO SMALL!", true); failAndReset(); return;
        }
        // Direction Validation
        const a1 = Math.atan2(points[points.length-2].y - CENTER.y, points[points.length-2].x - CENTER.x);
        const a2 = Math.atan2(p2.y - CENTER.y, p2.x - CENTER.x);
        let diff = a2 - a1;
        if (diff > Math.PI) diff -= 2 * Math.PI; if (diff < -Math.PI) diff += 2 * Math.PI;
        if (drawingDirection === 0) drawingDirection = Math.sign(diff);
        if (drawingDirection !== 0 && Math.abs(diff) > 0.01 && Math.sign(diff) !== drawingDirection) {
            showMessage("WRONG WAY!", true); failAndReset(); return;
        }
    }

    const scoreStr = calculateAccuracy(points);
    const parts = scoreStr.split('.');
    document.getElementById("scoreMain").textContent = parts[0];
    document.getElementById("scoreDec").textContent = parts[1];

    const scoreNum = parseFloat(scoreStr);
    const color = getScoreColor(scoreNum);
    drawSmoothPath(points, color);
    scoreDisplay.style.color = color;
}

function failAndReset() {
    isDrawing = false;
    shareBtnNav.classList.remove("active");
    setTimeout(() => { points = []; ctx.clearRect(0, 0, canvas.width, canvas.height); hideMessage(); }, 900);
}

// --- MATH & DRAWING ---
function calculateAccuracy(pts) {
    if (pts.length < 10) return "0.00";
    const dists = pts.map(p => Math.sqrt(Math.pow(p.x - CENTER.x, 2) + Math.pow(p.y - CENTER.y, 2)));
    const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
    const dev = Math.sqrt(dists.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / dists.length);
    const score = Math.max(0, 100 - (dev / avg) * 150);
    return score.toFixed(2);
}

function getScoreColor(s) {
    if (s >= 80) return "#00ff00"; // Vibrant Green
    if (s >= 50) return "#ffff00"; // Yellow
    return "#ff0000"; // Red
}

function drawSmoothPath(path, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
    for (var i = 1; i < path.length - 2; i++) {
        var xc = (path[i].x + path[i + 1].x) / 2; var yc = (path[i].y + path[i + 1].y) / 2;
        ctx.quadraticCurveTo(path[i].x, path[i].y, xc, yc);
    }
    if (path.length > 2) ctx.quadraticCurveTo(path[i].x, path[i].y, path[i+1].x, path[i+1].y);
    ctx.stroke();
}

function getTotalAngle(pts) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
        let a1 = Math.atan2(pts[i-1].y - CENTER.y, pts[i-1].x - CENTER.x);
        let a2 = Math.atan2(pts[i].y - CENTER.y, pts[i].x - CENTER.x);
        let diff = a2 - a1;
        if (diff > Math.PI) diff -= 2 * Math.PI; if (diff < -Math.PI) diff += 2 * Math.PI;
        total += diff;
    }
    return total;
}

function showMessage(t, b) { messageDisplay.textContent = t; messageDisplay.style.opacity = 1; }
function hideMessage() { messageDisplay.style.opacity = 0; }

function updateBestScore(s) {
    const b = parseFloat(localStorage.getItem("circle_best") || 0);
    if (s > b) {
        localStorage.setItem("circle_best", s.toFixed(2));
        bestNav.textContent = `Best: ${s.toFixed(2)}%`;
        document.getElementById("newHighScoreDisplay").classList.add("active");
        setTimeout(() => document.getElementById("newHighScoreDisplay").classList.remove("active"), 2000);
    }
}
bestNav.textContent = `Best: ${localStorage.getItem("circle_best") || "0.00"}%`;

shareBtnNav.addEventListener("click", () => {
    navigator.share({ title: 'Perfect Circle', text: `I scored ${document.getElementById("scoreMain").textContent}%!`, url: window.location.href });
});

// Pixel Snow Engine
const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");
bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
let snowflakes = [];
for (let i = 0; i < 140; i++) {
    snowflakes.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, size: Math.random() * 2 + 1, speed: Math.random() * 0.7 + 0.2, drift: (Math.random() - 0.5) * 0.2, opacity: Math.random() * 0.5 + 0.2 });
}
function animateSnow() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    snowflakes.forEach(s => {
        s.y += s.speed; s.x += s.drift;
        if (s.y > bgCanvas.height) { s.y = -5; s.x = Math.random() * bgCanvas.width; }
        bgCtx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`; bgCtx.fillRect(s.x, s.y, s.size, s.size); 
    });
    requestAnimationFrame(animateSnow);
}
animateSnow();