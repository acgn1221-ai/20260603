/**
 * 《星際穿梭：炫彩避障飛機》
 * 操控：滑鼠/觸控 Y 軸
 */

let gameState = 'PLAY'; // PLAY, GAMEOVER
let player;
let video;
let obstacles = [];
let stars = [];
let bgLines = [];
let distance = 0;
let currentLevel = 1;
let shieldHP = 100;

function setup() {
  // 📸 1. 全螢幕畫布與攝影機設定
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
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

function draw() {
  // 🎨 2. 畫布背景與鏡頭置中顯示 (寬高 60%)
  background('#e7c6ff');
  
  imageMode(CENTER);
  image(video, width / 2, height / 2, width * 0.6, height * 0.6);
  imageMode(CORNER); // 改回預設，避免影響其他繪圖

  if (gameState === 'PLAY') {
    updateGame();
  } else if (gameState === 'GAMEOVER') {
    drawGameOver();
  }
}

function updateGame() {
  // 1. 背景特效 (霓虹網格)
  stroke(0, 100, 255, 60);
  strokeWeight(2);
  for (let lineObj of bgLines) {
    line(0, lineObj.y, width, lineObj.y);
    lineObj.y -= 2 * currentLevel; 
    if (lineObj.y < 0) lineObj.y = height;
  }

  // 2. 玩家邏輯
  player.update();
  player.display();

  // 3. 難度遞進與生成系統
  handleDifficulty();

  // 4. 障礙物 (隕石) 處理
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    obstacles[i].display();

    // 絕對碰撞偵測 (飛機半徑 15)
    let d = dist(player.x, player.y, obstacles[i].x, obstacles[i].y);
    if (d < 15 + obstacles[i].r) {
      shieldHP -= 25;
      obstacles.splice(i, 1);
      if (shieldHP <= 0) {
        shieldHP = 0;
        gameState = 'GAMEOVER';
      }
      continue;
    }

    if (obstacles[i].isOffScreen()) obstacles.splice(i, 1);
  }

  // 5. 加分道具 (星塵) 處理
  for (let i = stars.length - 1; i >= 0; i--) {
    stars[i].update();
    stars[i].display();

    let d = dist(player.x, player.y, stars[i].x, stars[i].y);
    if (d < 15 + stars[i].r) {
      distance += 50;
      shieldHP = min(shieldHP + 10, 100);
      stars.splice(i, 1);
      continue;
    }

    if (stars[i].isOffScreen()) stars.splice(i, 1);
  }

  // 6. 關卡與計分
  distance += 0.5;
  currentLevel = min(floor(distance / 200) + 1, 5);

  drawUI();
}

function handleDifficulty() {
  let speed = 4;
  let freq = 40;

  if (currentLevel === 1) { speed = 4; freq = 45; }
  else if (currentLevel === 2) { speed = 6; freq = 40; }
  else if (currentLevel === 3) { speed = 8; freq = 35; }
  else if (currentLevel === 4) { speed = 11; freq = 20; }
  else if (currentLevel === 5) { speed = 14; freq = 15; }

  if (frameCount % freq === 0) {
    obstacles.push(new Obstacle(speed));
  }

  let starRate = (currentLevel === 5) ? 0.05 : 0.02;
  if (random(1) < starRate) {
    stars.push(new Star(speed * 0.8));
  }
}

function drawUI() {
  noStroke();
  fill(0, 0, 0, 150);
  rect(15, 15, 230, 85, 8);
  fill(0, 200, 255);
  textSize(16);
  textAlign(LEFT);
  text(`LEVEL: ${currentLevel}`, 30, 40);
  fill(255);
  text(`DISTANCE: ${floor(distance)} KM`, 30, 60);
  
  // 血條
  fill(50);
  rect(30, 70, 180, 10);
  fill(shieldHP > 30 ? color(0, 255, 150) : color(255, 50, 50));
  rect(30, 70, map(shieldHP, 0, 100, 0, 180), 10);
}

function drawGameOver() {
  fill(0, 0, 0, 10);
  rect(0, 0, width, height);
  textAlign(CENTER);
  fill(255, 0, 100);
  textSize(50);
  text("💥 GAME OVER 💥", width / 2, height / 2);
  fill(255);
  textSize(20);
  text("點擊畫面重新開始", width / 2, height / 2 + 50);
}

class Player {
  constructor() {
    this.x = 80;
    this.y = height / 2;
    this.history = [];
  }
  update() {
    this.x = lerp(this.x, mouseX, 0.2);
    this.y = lerp(this.y, mouseY, 0.2);
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
      vertex(this.history[i].x - (this.history.length - i) * 8, this.history[i].y);
    }
    endShape();

    // 飛機本體
    push();
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
    this.x = width + 40;
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
  isOffScreen() { return this.x < -100; }
}

class Star {
  constructor(speed) {
    this.x = width + 40;
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
  isOffScreen() { return this.x < -100; }
}

function mousePressed() { if (gameState === 'GAMEOVER') resetGame(); }
function touchStarted() { if (gameState === 'GAMEOVER') resetGame(); return false; }
function touchMoved() {
  // 確保手機瀏覽器不會因為上下滑動而重整網頁
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
