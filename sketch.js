/**
 * 《星際穿梭：炫彩避障飛機》
 * 操控：純手機觸控模式 (Touches Only)
 * 
 * 🚨 提醒：請務必在 index.html 中加入以下標籤以啟用手勢偵測：
 * <script src="https://unpkg.com/ml5@0.12.2/dist/ml5.min.js"></script>
 */

let gameState = 'PLAY'; // PLAY, GAMEOVER
let player;
let video;
let handpose;
let predictions = [];
let obstacles = [];
let stars = [];
let bgLines = [];
let distance = 0;
let currentLevel = 1;
let shieldHP = 100;

function setup() {
  // 📸 1. 全螢幕畫布與攝影機設定
  let canvas = createCanvas(windowWidth, windowHeight);
  // 🔒 徹底禁用手機瀏覽器的拉動、重整等原生行為，把所有觸控百分之百還給 p5.js
  canvas.elt.style.touchAction = 'none';

  video = createCapture(VIDEO);
  video.size(640, 480); // 設定固定解析度以利手勢座標映射
  
  // 初始化 Handpose 模型
  handpose = ml5.handpose(video, modelReady);
  handpose.on('predict', results => { predictions = results; });
  video.hide(); // 隱藏預設的 HTML video 標籤

  player = new Player();
  
  // 初始化 Retro Wave 背景線條
  for (let i = 0; i < 12; i++) {
    bgLines.push({
      y: i * (height / 10),
      speed: 3
    });
  }
}

function modelReady() {
  console.log('Handpose 模型載入成功！');
}

function draw() {
  // 1. 基本粉紫背景
  background('#e7c6ff');

  // 2. 啟動全畫布水平鏡像翻轉（照鏡子模式）
  // 這樣攝影機和飛機都會自動進入鏡像狀態，且操控邏輯最統一
  translate(width, 0);
  scale(-1, 1);

  // 3. 在正中央繪製攝影機影像 (寬高 60%)
  imageMode(CENTER);
  image(video, width / 2, height / 2, width * 0.6, height * 0.6);
  imageMode(CORNER);

  if (gameState === 'PLAY') {
    updateGame();
  } else if (gameState === 'GAMEOVER') {
    drawGameOver();
  }

  // 7. 繪製 UI 計分板 (需要反轉回正常文字方向)
  push();
  translate(width, 0);
  scale(-1, 1);
  drawUI(); 
  pop();
}

function updateGame() {
  // 背景特效 (配合鏡像)
  drawRetroGrid();

  // 玩家邏輯 (飛機)
  player.update();
  player.display();

  // 難度與生成
  handleDifficulty();

  // 障礙物 (隕石) 處理：現在由視覺右側 (x=0附近) 飛向視覺左側 (x=width)
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    obstacles[i].display();

    let d = dist(player.x, player.y, obstacles[i].x, obstacles[i].y);
    if (d < 15 + obstacles[i].r) {
      shieldHP -= 25;
      obstacles.splice(i, 1);
      if (shieldHP <= 0) { shieldHP = 0; gameState = 'GAMEOVER'; }
      continue;
    }
    if (obstacles[i].isOffScreen()) obstacles.splice(i, 1);
  }

  // 加分道具 (星塵) 處理
  for (let i = stars.length - 1; i >= 0; i--) {
    stars[i].update();
    stars[i].display();
    let d = dist(player.x, player.y, stars[i].x, stars[i].y);
    if (d < 15 + stars[i].r) {
      distance += 50;
      shieldHP = min(shieldHP + 10, 100);
      stars.splice(i, 1);
    }
    if (stars[i].isOffScreen()) stars.splice(i, 1);
  }

  distance += 0.5;
  currentLevel = min(floor(distance / 200) + 1, 5);
}

function drawRetroGrid() {
  stroke(0, 100, 255, 60);
  strokeWeight(2);
  for (let lineObj of bgLines) {
    line(0, lineObj.y, width, lineObj.y);
    lineObj.y -= 2 * currentLevel; 
    if (lineObj.y < 0) lineObj.y = height;
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

  // 🚀 顯示手勢辨識狀態 (讓玩家知道 AI 準備好了沒)
  textSize(12);
  noStroke();
  if (predictions.length > 0) {
    fill(0, 255, 0);
    text("✋ 手勢偵測中 (AI Active)", 30, 115);
  } else {
    fill(255, 100, 100);
    text("⌛ 等待手勢或載入模型中...", 30, 115);
  }
}

function drawGameOver() {
  push();
  translate(width, 0);
  scale(-1, 1);
  fill(0, 0, 0, 10);
  rect(0, 0, width, height);
  textAlign(CENTER);
  fill(255, 0, 100);
  textSize(50);
  text("💥 GAME OVER 💥", width / 2, height / 2);
  fill(255);
  textSize(20);
  text("點擊畫面重新開始", width / 2, height / 2 + 50);
  pop();
}

class Player {
  constructor() {
    this.x = width - 80; // 🛠️ 修正：讓飛機起始於視覺左側 (flipped 座標系下 x 越大越靠左)
    this.y = height / 2;
    this.history = [];
  }
  update() {
    let targetX, targetY;
    let isActive = false;

    // 📱 1. 觸控優先：如果偵測到觸控點，優先跟隨手指座標
    if (touches.length > 0) {
      targetX = width - touches[0].x;
      targetY = touches[0].y;
      isActive = true;
    } 
    // 👁️ 2. 手勢次之：如果沒觸控但偵測到 AI 手勢 (食指指尖)
    else if (predictions.length > 0) {
      let tip = predictions[0].landmarks[8];
      targetX = map(tip[0], 0, video.width, width, 0);
      targetY = map(tip[1], 0, video.height, 0, height);
      isActive = true;
    }

    if (isActive) {
      this.x = lerp(this.x, constrain(targetX, 0, width), 0.2);
      this.y = lerp(this.y, constrain(targetY, 0, height), 0.2);
    }

    this.history.push({x: this.x, y: this.y});
    if (this.history.length > 5) this.history.shift();
  }
  display() {
    // 藍色尾跡
    noFill();
    strokeWeight(4);
    beginShape();
    for (let i = 0; i < this.history.length; i++) {
      let alpha = map(i, 0, this.history.length, 0, 150);
      stroke(0, 200, 255, alpha);
      vertex(this.history[i].x + (this.history.length - i) * 8, this.history[i].y); // 🛠️ 修正：噴氣尾跡應向右(小x)延伸
    }
    endShape();

    push();
    // 讓飛機頭視覺上朝向飛行方向
    translate(this.x, this.y);
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = color(0, 255, 255);
    fill(255);
    noStroke();
    triangle(15, 0, -12, -12, -12, 12);
    pop();
    drawingContext.shadowBlur = 0;
  }
}

class Obstacle {
  constructor(speed) {
    this.x = -40; // 在鏡像座標系下，-40 是視覺上的右側邊緣外
    this.y = random(30, height - 30);
    this.r = (currentLevel >= 2) ? random(15, 35) : 20;
    this.speed = speed;
    this.drift = (currentLevel >= 3) ? random(-1.5, 1.5) : 0;
  }
  update() {
    this.x += this.speed; // 在鏡像座標系下，增加 X 是由右往左飛
    this.y += this.drift;
    if (this.y < this.r || this.y > height - this.r) this.drift *= -1;
  }
  display() {
    stroke(255, 100, 0);
    strokeWeight(3);
    fill(150, 0, 0);
    ellipse(this.x, this.y, this.r * 2);
  }
  isOffScreen() { return this.x > width + 100; }
}

class Star {
  constructor(speed) {
    this.x = -40;
    this.y = random(30, height - 30);
    this.r = 10;
    this.speed = speed;
  }
  update() { this.x += this.speed; }
  display() {
    fill(255, 255, 0, 150 + sin(frameCount * 0.1) * 100);
    noStroke();
    ellipse(this.x, this.y, this.r * 2);
  }
  isOffScreen() { return this.x > width + 100; }
}

function mousePressed() { if (gameState === 'GAMEOVER') resetGame(); }

// 🔒 2. 防止手機網頁預設行為干擾
function touchStarted() {
  if (gameState === 'GAMEOVER') resetGame();
  return false;
}
function touchMoved() {
  // 封鎖手機瀏覽器的滑動干擾 (如：下拉更新)
  return false;
}
function resetGame() {
  distance = 0; currentLevel = 1; shieldHP = 100;
  obstacles = []; stars = []; gameState = 'PLAY';
}

// 🔄 3. 視窗自適應縮放
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
