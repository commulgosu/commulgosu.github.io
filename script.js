const menuButton = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('#site-nav');

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  siteNav?.classList.toggle('is-open', !open);
});

const canvas = document.querySelector('#game-board');
const difficultySelect = document.querySelector('#difficulty');
const scoreElement = document.querySelector('#score');
const highScoreElement = document.querySelector('#high-score');
const statusElement = document.querySelector('#game-status');
const startButton = document.querySelector('#start-game');
const pauseButton = document.querySelector('#pause-game');
const restartButton = document.querySelector('#restart-game');
const context = canvas?.getContext('2d');
const gridSize = 20;
const cellSize = 21;
const difficultySettings = { easy: 170, normal: 120, hard: 85 };
const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };

let snake = [];
let food = { x: 15, y: 10 };
let enemy = { x: 4, y: 4 };
let direction = 'right';
let queuedDirection = 'right';
let gameTimer = null;
let score = 0;
let highScore = Number.parseInt(localStorage.getItem('snake-high-score') || '0', 10) || 0;
let gameState = 'ready';

const setStatus = (message) => { if (statusElement) statusElement.textContent = message; };
const updateScore = () => {
  if (scoreElement) scoreElement.textContent = String(score);
  if (highScoreElement) highScoreElement.textContent = String(highScore);
};
const sameCell = (a, b) => a.x === b.x && a.y === b.y;
const randomCell = () => ({ x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) });

function openCell() {
  let cell = randomCell();
  while (snake.some((part) => sameCell(part, cell)) || sameCell(enemy, cell)) cell = randomCell();
  return cell;
}

function drawCell(cell, color) {
  context.fillStyle = color;
  context.fillRect(cell.x * cellSize + 1, cell.y * cellSize + 1, cellSize - 2, cellSize - 2);
}

function drawBoard() {
  if (!context) return;
  context.fillStyle = '#07100d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(183, 255, 74, .08)';
  for (let i = 0; i <= gridSize; i += 1) {
    context.beginPath(); context.moveTo(i * cellSize, 0); context.lineTo(i * cellSize, canvas.height); context.stroke();
    context.beginPath(); context.moveTo(0, i * cellSize); context.lineTo(canvas.width, i * cellSize); context.stroke();
  }
  drawCell(food, '#ff4d8d');
  drawCell(enemy, '#55d6ff');
  snake.forEach((part, index) => drawCell(part, index === 0 ? '#e7f5ed' : '#b7ff4a'));
}

function resetGame() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  food = openCell();
  enemy = { x: 4, y: 4 };
  direction = 'right';
  queuedDirection = 'right';
  score = 0;
  gameState = 'ready';
  updateScore();
  drawBoard();
  setStatus('Ready');
  if (pauseButton) pauseButton.disabled = true;
}

function stopTimer() {
  if (gameTimer !== null) { clearInterval(gameTimer); gameTimer = null; }
}

function moveEnemy() {
  const choices = Object.entries(directions).filter(([name]) => {
    const next = { x: enemy.x + directions[name].x, y: enemy.y + directions[name].y };
    return next.x >= 0 && next.x < gridSize && next.y >= 0 && next.y < gridSize;
  });
  const choice = choices[Math.floor(Math.random() * choices.length)];
  enemy = { x: enemy.x + choice[1].x, y: enemy.y + choice[1].y };
}

function endGame() {
  stopTimer();
  gameState = 'over';
  if (score > highScore) { highScore = score; localStorage.setItem('snake-high-score', String(highScore)); }
  updateScore();
  setStatus('Game over');
  if (pauseButton) pauseButton.disabled = true;
  drawBoard();
}

function tick() {
  direction = queuedDirection;
  const head = snake[0];
  const nextHead = { x: head.x + directions[direction].x, y: head.y + directions[direction].y };
  const hitsWall = nextHead.x < 0 || nextHead.x >= gridSize || nextHead.y < 0 || nextHead.y >= gridSize;
  const willEat = sameCell(nextHead, food);
  const hitsSelf = snake.slice(0, willEat ? snake.length : -1).some((part) => sameCell(part, nextHead));
  if (hitsWall || hitsSelf || sameCell(enemy, nextHead)) { endGame(); return; }
  snake.unshift(nextHead);
  if (willEat) { score += 10; food = openCell(); } else snake.pop();
  moveEnemy();
  if (sameCell(enemy, snake[0])) { endGame(); return; }
  updateScore();
  drawBoard();
}

function startGame() {
  if (gameState === 'over') resetGame();
  if (gameState === 'running') return;
  gameState = 'running';
  setStatus('Running');
  if (pauseButton) pauseButton.disabled = false;
  stopTimer();
  gameTimer = setInterval(tick, difficultySettings[difficultySelect.value]);
}

function togglePause() {
  if (gameState === 'running') { stopTimer(); gameState = 'paused'; setStatus('Paused'); }
  else if (gameState === 'paused') { startGame(); }
}

function setDirection(nextDirection) {
  if (!directions[nextDirection] || opposite[direction] === nextDirection) return;
  queuedDirection = nextDirection;
}

document.addEventListener('keydown', (event) => {
  const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  if (event.code === 'Space') { event.preventDefault(); togglePause(); return; }
  if (keyMap[event.key]) { event.preventDefault(); setDirection(keyMap[event.key]); if (gameState === 'ready') startGame(); }
});
startButton?.addEventListener('click', startGame);
pauseButton?.addEventListener('click', togglePause);
restartButton?.addEventListener('click', () => { stopTimer(); resetGame(); startGame(); });
difficultySelect?.addEventListener('change', () => { if (gameState === 'running') { stopTimer(); gameState = 'paused'; startGame(); } });
document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => {
  setDirection(button.dataset.direction);
  if (gameState === 'ready') startGame();
}));

resetGame();
