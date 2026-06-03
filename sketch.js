/**
 * 《星際穿梭：炫彩避障飛機》- 靈魂對調終極修復版
 * 操控：Google MediaPipe AI 手勢辨識
 */

let gameState = 'START'; // START, PLAY, GAMEOVER
let player;
let video;
let detector;
let hands = []; // 儲存手勢偵測結果
let isModelReady = false;
let obstacles = [];
let stars = [];
let bgLines = [];
let distance = 0;
let currentLevel = 1;
let shieldHP = 100;
let gameOverFrame = 0; 

async function setup() {
  // 📸 1. 全螢幕畫布與攝影機設定
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.elt.style.touchAction = 'none';

  // ⚡ 效能優化關鍵：擷取極低解析度 (320x240)
  video = createCapture(VIDEO);
  video.size(320, 240); 
  video.hide();

  // 2. 初始化 Google MediaPipe 手勢偵測器
  try {
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    const detectorConfig = {
      runtime: 'mediapipe',
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands'
    };
    detector = await handPoseDetection.createDetector(model, detectorConfig);
    isModelReady = true;
    console.log('MediaPipe AI 引擎已啟動');
  } catch(e) {
    console.error("AI 引擎初始化失敗:", e);
  }

  player = new Player();
  
  for (let i = 0; i < 12; i++) {
    bgLines.push({ y: i * (height / 10), speed: 3 });
  }

  // 背景獨立非同步偵測，絕不卡死主畫面
  setInterval(getHandTracking, 40);
}

function draw() {
  // 基本粉紫背景
  background('#e7c6ff');

  // 鏡像置中渲染攝影機
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

  // 繪製 UI 計分板
  drawUI(); 
}

// 🎮 新增：起始引導畫面
function drawStartScreen() {
  textAlign(CENTER, CENTER);
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  fill(255, 255, 0);
  textSize(28);
  if (hands && hands.length > 0) {
    text("👍 偵測到食指了！\n請揮動手指控制左側飛機！", width / 2, height / 2);
  } else {
    text("👋 請在鏡頭中央舉起食指\n即可啟動飛機！", width / 2, height / 2);
  }
}

// 🔍 檢查是否有第一次觸碰
function checkStartTouch() {
  if (hands && hands.length > 0) {
    let coords = getFingertipCoords();
    if (coords) {
      player.initPosition(coords.x, coords.y);
      gameState = 'PLAY';
    }
  }
}

// 🔍 檢查是否重新開始
function checkRestart() {
  if (hands && hands.length > 0 && frameCount > gameOverFrame + 60) {
    resetGame();
  }
}

// 核心：非同步抓取手勢，絕不卡死 draw() 迴圈
async function getHandTracking() {
  if (!detector || !video.elt || video.elt.readyState < 2) return;
  try {
    let result = await detector.estimateHands(video.elt);
    if (result) hands = result;
  } catch (e) {}
}

// ✈️ 關鍵：座標映射函式 (絕對同向操控)
function getFingertipCoords() {
  if (hands && hands.length > 0 && hands[0] && hands[0].keypoints && hands[0].keypoints[8]) {
    let rawX = hands[0].keypoints[8].x; 
    let rawY = hands[0].keypoints[8].y;

    // 配合 60% 中央視訊影像的黑邊範圍進行精準對齊
    let videoDisplayWidth = width * 0.6;
    let videoDisplayHeight = height * 0.6;
    let offsetX = (width - videoDisplayWidth) / 2;
    let offsetY = (height - videoDisplayHeight) / 2;

    // 真正的鏡像換算：手往哪，飛機往哪
    let targetX = map(video.width - rawX, 0, video.width, offsetX, offsetX + videoDisplayWidth);
    let targetY = map(rawY, 0, video.height, offsetY, offsetY + videoDisplayHeight);
    
    return { x: targetX, y: targetY };
  }
  return null; // 拿不到就回傳 null，後面有防護不會崩潰
}

function updateGame() {
  drawRetroGrid();

  // 玩家邏輯 (飛機)
  player.update();
  player.display();

  // 難度與生成
  handleDifficulty();

  // 🔴 障礙物邏輯：從最右側出生、往左飛，跟隨手指的是飛機，不是它！
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    obstacles[i].display();

    // 檢查跟飛機的距離
    let d = dist(player.x, player.y, obstacles[i].x, obstacles[i].y);
    if (d < 20 + obstacles[i].r) {
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

  // 🟡 加分星星邏輯
  for (let i = stars.length - 1; i >= 0; i--) {
    stars[i].update();
    stars[i].display();
    let d = dist(player.x, player.y, stars[i].x, stars[i].y);
    if (d < 20 + stars[i].r) {
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
  stroke(0, 100, 255, 40);
  strokeWeight(2);
  for (let lineObj of bgLines) {
    line(0, lineObj.y, width, lineObj.y);
    lineObj.y += 2 * currentLevel; 
    if (lineObj.y > height) lineObj.y = 0;
  }
}

function handleDifficulty() {
  let speed = 5, freq = 40;
  if (currentLevel === 1) { speed = 5; freq = 45; }
  else if (currentLevel === 2) { speed = 7; freq = 40; }
  else if (currentLevel === 3) { speed = 9; freq = 35; }
  
  // 🔒 修正：障礙物一律從「畫面右側邊緣外 (width + 50)」出生，不准出生在手指上！
  if (frameCount % freq === 0) {
    obstacles.push(new Obstacle(speed));
  }
  if (random(1) < 0.02) {
    stars.push(new Star(speed * 0.8));
  }
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

  // 🚀 顯示手勢辨識狀態
  textSize(12);
  if (hands && hands.length > 0) {
    fill(0, 255, 0);
    text("✋ AI 連線成功 (飛機準備就緒)", 30, 115);
  } else if (!isModelReady) {
    fill(255, 100, 100);
    text("⌛ Google AI 大腦加載中...", 30, 115);
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
  text("收開手掌或再次舉手重新開始", width / 2, height / 2 + 50);
}

class Player {
  constructor() {
    this.x = 100; // 飛機初始乖乖留在左邊
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
      // 讓小飛機極度絲滑地跟隨指尖
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
    // 🔒 強制出生在螢幕最右側邊緣外！絕對不是在臉上！
    this.x = width + random(50, 150); 
    this.y = random(50, height - 50);
    this.r = random(15, 30);
    this.speed = speed;
  }
  update() {
    this.x -= this.speed; 
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
  obstacles = []; stars = []; gameState = 'PLAY'; // 重啟後直接進遊戲
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}