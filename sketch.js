/**
 * 《星際穿梭：炫彩避障飛機》- 雙執行緒不卡死修復版
 * 操控：Google MediaPipe AI 手勢辨識
 */

let gameState = 'START'; 
let player;
let video;
let detector;
let hands = []; 
let isModelReady = false;
let obstacles = [];
let stars = [];
let bgLines = [];
let distance = 0;
let currentLevel = 1;
let shieldHP = 100;
let gameOverFrame = 0; 

async function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.elt.style.touchAction = 'none';

  // 1. 擷取低解析度降載
  video = createCapture(VIDEO);
  video.size(320, 240); 
  video.hide();

  // 2. 初始化 Google MediaPipe
  const model = handPoseDetection.SupportedModels.MediaPipeHands;
  const detectorConfig = {
    runtime: 'mediapipe',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands'
  };
  detector = await handPoseDetection.createDetector(model, detectorConfig);
  isModelReady = true;
  console.log('MediaPipe AI 引擎已啟動');

  player = new Player();
  
  // 初始化 Retro Wave 背景
  for (let i = 0; i < 12; i++) {
    bgLines.push({
      y: i * (height / 10),
      speed: 3
    });
  }

  // 🔥 【最強流暢關鍵】：把偵測從 draw 抽出來，每 30 毫秒在背景偷偷算一次，絕對不卡死畫面！
  setInterval(getHandTracking, 30);
}

function draw() {
  // 3. 基本粉紫背景
  background('#e7c6ff');

  // 4. 繪製「照鏡子模式」的攝影機影像 (置中放大至寬高 60%)
  push();
  translate(width / 2, height / 2); 
  scale(-1, 1);                     
  imageMode(CENTER);
  image(video, 0, 0, width * 0.6, height * 0.6);
  pop();

  imageMode(CORNER);
  
  // 5. 遊戲狀態機（現在這裡運算流暢度爆表，因為沒有 AI 在這裡塞車了！）
  if (gameState === 'START') { 
    drawStartScreen();
    checkStartTouch();
  } else if (gameState === 'PLAY') {
    updateGame();
  } else if (gameState === 'GAMEOVER') {
    drawGameOver();
    checkRestart();
  }

  // 6. 繪製 UI
  drawUI(); 
}

function drawStartScreen() {
  textAlign(CENTER, CENTER);
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  fill(255, 255, 0);
  textSize(28);
  if (hands && hands.length > 0) {
    text("👍 食指已偵測到！\n飛機即將啟動！", width / 2, height / 2);
  } else {
    text("👋 請舉起食指\n啟動飛機！", width / 2, height / 2);
  }
}

function checkStartTouch() {
  if (hands && hands.length > 0) {
    let coords = getFingertipCoords();
    if (coords) {
      player.initPosition(coords.x, coords.y);
      gameState = 'PLAY';
    }
  }
}

function checkRestart() {
  if (hands && hands.length > 0 && frameCount > gameOverFrame + 60) {
    resetGame();
  }
}

// ⚡ 【後台並行運算】：負責默默在後台算手指位置，算出結果才更新 hands 陣列
async function getHandTracking() {
  if (!detector || !video.elt || video.elt.readyState < 2) return;
  try {
    let result = await detector.estimateHands(video.elt);
    if (result) {
      hands = result;
    }
  } catch (e) {
    // 靜默跳過錯誤，防止控制台崩潰
  }
}

// ✈️ 關鍵公式：修正左右相反、對齊鏡像影像的座標映射
function getFingertipCoords() {
  if (hands && hands.length > 0 && hands[0].keypoints[8]) {
    let rawX = hands[0].keypoints[8].x; 
    let rawY = hands[0].keypoints[8].y;

    // 配合視訊畫面置中 60% 的黑邊範圍進行精準對齊
    let videoDisplayWidth = width * 0.6;
    let videoDisplayHeight = height * 0.6;
    let offsetX = (width - videoDisplayWidth) / 2;
    let offsetY = (height - videoDisplayHeight) / 2;

    // 完美同向公式：用 video.width - rawX 對調左右
    let targetX = map(video.width - rawX, 0, video.width, offsetX, offsetX + videoDisplayWidth);
    let targetY = map(rawY, 0, video.height, offsetY, offsetY + videoDisplayHeight);
    
    return { x: targetX, y: targetY };
  }
  return null;
}

function updateGame() {
  drawRetroGrid();

  player.update();
  player.display();

  handleDifficulty();

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    obstacles[i].display();

    let d = dist(player.x, player.y, obstacles[i].x, obstacles[i].y);
    if (d < 15 + obstacles[i].r) {
      shieldHP -= 25;
      obstacles.splice(i, 1);
      if (shieldHP <= 0) { 
        shieldHP = 0; 
        gameState = 'GAMEOVER'; 
        gameOverFrame = frameCount; 
      }
      continue;
    }
    if (obstacles[i].x < -100) obstacles.splice(i, 1);
  }

  for (let i = stars.length - 1; i >= 0; i--) {
    stars[i].update();
    stars[i].display();
    let d = dist(player.x, player.y, stars[i].x, stars[i].y);
    if (d < 15 + stars[i].r) {
      distance += 50;
      shieldHP = min(shieldHP + 10, 100);
      stars.splice(i, 1);
    }
    if (stars[i].x < -100) stars.splice(i, 1);
  }

  distance += 0.5;
  currentLevel = min(floor(distance / 200) + 1, 5);
}

function drawRetroGrid() {
  stroke(0, 100, 255, 60);
  strokeWeight(2);
  for (let lineObj of bgLines) {
    line(0, lineObj.y, width, lineObj.y);
    lineObj.y += 2 * currentLevel; 
    if (lineObj.y > height) lineObj.y = 0;
  }
}

function handleDifficulty() {
  let speed = 4, freq = 40;
  if (currentLevel === 1) { speed = 4; freq = 45; }
  else if (currentLevel === 2) { speed = 6; freq = 40; }
  else if (currentLevel === 3) { speed = 8; freq = 35; }
  else if (currentLevel === 4) { speed = 11; freq = 20; }
  else if (currentLevel === 5) { speed = 14; freq = 15; }

  if (frameCount % freq === 0) obstacles.push(new Obstacle(speed));
  if (random(1) < (currentLevel === 5 ? 0.05 : 0.02)) stars.push(new Star(speed * 0.8));
}

function drawUI() {
  noStroke();
  fill(0, 0, 0, 150);
  rect(15, 15, 230, 85, 8);
  fill(0, 200, 255);
  textSize(16); textAlign(LEFT);
  text(`LEVEL: ${currentLevel}`, 30, 40);
  fill(255);
  text(`DISTANCE: ${floor(distance)} KM`, 30, 60);
  fill(50);
  rect(30, 70, 180, 10);
  fill(shieldHP > 30 ? color(0, 255, 150) : color(255, 50, 50));
  rect(30, 70, map(shieldHP, 0, 100, 0, 180), 10);

  textSize(12);
  if (hands && hands.length > 0) {
    fill(0, 255, 0);
    text("✋ 食指偵測中 (AI Active)", 30, 115);
  } else if (!isModelReady) {
    fill(255, 100, 100);
    text("⌛ Google AI 引擎載入中...", 30, 115);
  } else {
    fill(255, 255, 255);
    text("👋 請舉手以偵測...", 30, 115);
  }
}

function drawGameOver() {
  fill(0, 0, 0, 180);
  rect(0, 0, width, height);
  textAlign(CENTER);
  fill(255, 0, 100);
  textSize(50);
  text("💥 GAME OVER 💥", width / 2, height / 2);
  fill(255);
  textSize(20);
  text("舉起食指重新開始", width / 2, height / 2 + 50);
}

class Player {
  constructor() {
    this.x = width / 2;
    this.y = height / 2;
    this.history = [];
  }
  initPosition(nx, ny) {
    this.x = nx;
    this.y = ny;
    this.history = []; 
  }
  update() {
    let coords = getFingertipCoords();
    if (coords) {
      // 流暢平滑跟手
      this.x = lerp(this.x, constrain(coords.x, 0, width), 0.45);
      this.y = lerp(this.y, constrain(coords.y, 0, height), 0.45);
    }

    this.history.push({x: this.x, y: this.y});
    if (this.history.length > 6) this.history.shift();
  }
  display() {
    noFill();
    strokeWeight(4);
    beginShape();
    for (let i = 0; i < this.history.length; i++) {
      let alpha = map(i, 0, this.history.length, 0, 150);
      stroke(0, 200, 255, alpha);
      vertex(this.history[i].x - (this.history.length - i) * 8, this.history[i].y); 
    }
    endShape();

    push();
    translate(this.x, this.y);
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = color(0, 255, 255);
    fill(255);
    noStroke();
    triangle(18, 0, -10, -10, -10, 10);
    pop();
    drawingContext.shadowBlur = 0;
  }
}

class Obstacle {
  constructor(speed) {
    this.x = width + 50; 
    this.y = random(30, height - 30);
    this.r = (currentLevel >= 2) ? random(15, 35) : 20;
    this.speed = speed;
    this.drift = (currentLevel >= 3) ? random(-1.5, 1.5) : 0;
  }
  update() {
    this.x -= this.speed; 
    this.y += this.drift;
    if (this.y < this.r || this.y > height - this.r) this.drift *= -1;
  }
  display() {
    stroke(255, 100, 0);
    strokeWeight(3);
    fill(150, 0, 0);
    ellipse(this.x, this.y, this.r * 2);
  }
}

class Star {
  constructor(speed) {
    this.x = width + 50; 
    this.y = random(30, height - 30);
    this.r = 10;
    this.speed = speed;
  }
  update() { this.x -= this.speed; } 
  display() {
    fill(255, 255, 0, 150 + sin(frameCount * 0.1) * 100);
    noStroke();
    ellipse(this.x, this.y, this.r * 2);
  }
}

function touchStarted() { return false; }
function touchMoved() { return false; }
function touchEnded() { return false; }

function resetGame() {
  distance = 0; currentLevel = 1; shieldHP = 100;
  obstacles = []; stars = []; gameState = 'START';
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}