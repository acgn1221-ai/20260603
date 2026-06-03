/**
 * 《星際穿梭：炫彩避障飛機》- ml5.js 100% 穩定版
 * 操控：舉起單手，用「食指指尖」隔空操控飛機！
 */

let gameState = 'START'; // START, PLAY, GAMEOVER
let player;
let video;
let handpose;
let predictions = []; // 儲存 ml5 的手勢結果
let isModelReady = false;

let obstacles = [];
let stars = [];
let bgLines = [];
let distance = 0;
let currentLevel = 1;
let shieldHP = 100;
let gameOverFrame = 0;

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.elt.style.touchAction = 'none';

  // 📸 1. 攝影機設定 (低解析度大幅優化效能)
  video = createCapture(VIDEO);
  video.size(320, 240);
  video.hide();

  // 🔍 2. 初始化 ml5.js Handpose 模型 (極度穩定、不卡死)
  handpose = ml5.handpose(video, () => {
    isModelReady = true;
    console.log("ml5 手勢 AI 大腦已就緒！");
  });

  // 當有偵測到手時，自動把數據存入 predictions 陣列 (背景事件驅動，絕不卡死 draw)
  handpose.on("predict", (results) => {
    predictions = results;
  });

  player = new Player();
  
  // 初始化背景
  for (let i = 0; i < 12; i++) {
    bgLines.push({ y: i * (height / 10) });
  }
}

function draw() {
  // 基本粉紫背景
  background('#e7c6ff');

  // 鏡像渲染視訊畫面 (置中放大 60%)
  push();
  translate(width / 2, height / 2);
  scale(-1, 1);
  imageMode(CENTER);
  image(video, 0, 0, width * 0.6, height * 0.6);
  pop();

  imageMode(CORNER);
  
  // 遊戲狀態機
  if (gameState === 'START') {
    drawStartScreen();
    checkStartTouch();
  } else if (gameState === 'PLAY') {
    updateGame();
  } else if (gameState === 'GAMEOVER') {
    drawGameOver();
    checkRestart();
  }

  drawUI();
}

function drawStartScreen() {
  textAlign(CENTER, CENTER);
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);
  
  fill(255, 255, 0);
  textSize(28);
  if (predictions && predictions.length > 0) {
    text("👍 偵測到手指！\n飛機即將啟動！", width / 2, height / 2);
  } else {
    text("👋 請在鏡頭前舉起手、露出食指\n啟動避障飛機！", width / 2, height / 2);
  }
}

function checkStartTouch() {
  if (predictions && predictions.length > 0) {
    let coords = getFingertipCoords();
    if (coords) {
      player.initPosition(coords.x, coords.y);
      gameState = 'PLAY';
    }
  }
}

function checkRestart() {
  if (predictions && predictions.length > 0 && frameCount > gameOverFrame + 60) {
    resetGame();
  }
}

// ✈️ 關鍵公式：抓取 ml5 的食指頂點 (Index Finger Tip)
function getFingertipCoords() {
  // 確保拿得到數據
  if (predictions && predictions.length > 0 && predictions[0].landmarks) {
    // ml5 的 landmarks[8] 就是食指指尖 [X, Y, Z]
    let rawX = predictions[0].landmarks[8][0];
    let rawY = predictions[0].landmarks[8][1];

    // 換算置中 60% 畫面的黑邊邊界
    let videoDisplayWidth = width * 0.6;
    let videoDisplayHeight = height * 0.6;
    let offsetX = (width - videoDisplayWidth) / 2;
    let offsetY = (height - videoDisplayHeight) / 2;

    // 鏡像對調公式：手往右，飛機往右
    let targetX = map(video.width - rawX, 0, video.width, offsetX, offsetX + videoDisplayWidth);
    let targetY = map(rawY, 0, video.height, offsetY, offsetY + videoDisplayHeight);
    
    return { x: targetX, y: targetY };
  }
  return null;
}

function updateGame() {
  // 繪製背景網格
  stroke(0, 100, 255, 40);
  strokeWeight(2);
  for (let lineObj of bgLines) {
    line(0, lineObj.y, width, lineObj.y);
    lineObj.y += 2 * currentLevel;
    if (lineObj.y > height) lineObj.y = 0;
  }

  // 更新飛機
  player.update();
  player.display();

  handleDifficulty();

  // 障礙物由右向左
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
    if (obstacles[i].x < -50) obstacles.splice(i, 1);
  }

  // 處理加分星星
  for (let i = stars.length - 1; i >= 0; i--) {
    stars[i].update();
    stars[i].display();
    let d = dist(player.x, player.y, stars[i].x, stars[i].y);
    if (d < 15 + stars[i].r) {
      distance += 50;
      shieldHP = min(shieldHP + 10, 100);
      stars.splice(i, 1);
    }
    if (stars[i].x < -50) stars.splice(i, 1);
  }

  distance += 0.5;
  currentLevel = min(floor(distance / 200) + 1, 5);
}

function handleDifficulty() {
  let speed = 5, freq = 45;
  if (currentLevel === 2) { speed = 7; freq = 35; }
  else if (currentLevel === 3) { speed = 10; freq = 25; }

  if (frameCount % freq === 0) obstacles.push(new Obstacle(speed));
  if (random(1) < 0.02) stars.push(new Star(speed * 0.8));
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
  if (predictions && predictions.length > 0) {
    fill(0, 255, 0);
    text("✋ 指尖追蹤中 (AI Active)", 30, 115);
  } else if (!isModelReady) {
    fill(255, 100, 100);
    text("⌛ Google ml5 引擎載入中...", 30, 115);
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
  text("再次舉起食指重新開始", width / 2, height / 2 + 50);
}

class Player {
  constructor() {
    this.x = width / 4;
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
      this.x = lerp(this.x, constrain(coords.x, 20, width - 20), 0.35);
      this.y = lerp(this.y, constrain(coords.y, 20, height - 20), 0.35);
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
      vertex(this.history[i].x - (this.history.length - i) * 6, this.history[i].y);
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
    this.x = width + random(50, 150);
    this.y = random(50, height - 50);
    this.r = random(15, 30);
    this.speed = speed;
  }
  update() { this.x -= this.speed; }
  display() {
    stroke(255, 100, 0);
    strokeWeight(3);
    fill(150, 0, 0);
    ellipse(this.x, this.y, this.r * 2);
  }
}

class Star {
  constructor(speed) {
    this.x = width + random(50, 150);
    this.y = random(50, height - 50);
    this.r = 8;
    this.speed = speed;
  }
  update() { this.x -= this.speed; }
  display() {
    fill(255, 255, 0);
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