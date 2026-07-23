const menuButton = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('#site-nav');
const tabLinks = [...document.querySelectorAll('[data-tab]')];
const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  siteNav?.classList.toggle('is-open', !open);
});

function showTab(id, updateHash = true) {
  const panel = document.querySelector(`#${id}`);
  if (!panel || !tabLinks.some((link) => link.dataset.tab === id)) return;
  tabPanels.forEach((item) => { item.hidden = item !== panel; });
  tabLinks.forEach((link) => {
    const selected = link.dataset.tab === id;
    link.setAttribute('aria-selected', String(selected));
    link.tabIndex = selected ? 0 : -1;
  });
  if (updateHash && window.location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  siteNav?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  panel.focus({ preventScroll: true });
}

tabLinks.forEach((link, index) => {
  link.addEventListener('click', (event) => { event.preventDefault(); showTab(link.dataset.tab); });
  link.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    tabLinks[(index + step + tabLinks.length) % tabLinks.length].focus();
  });
});

window.addEventListener('hashchange', () => showTab(window.location.hash.slice(1) || 'home', false));
showTab(window.location.hash.slice(1) || 'home', false);

const marketApiUrl = 'https://commulgosu-github-io.vercel.app/api/quotes';
const marketCards = [...document.querySelectorAll('[data-symbol]')];
const marketSummary = document.querySelector('#market-summary');
const marketTrendIcon = document.querySelector('#market-trend-icon');
const marketTrendLabel = document.querySelector('#market-trend-label');
const marketTrendValue = document.querySelector('#market-trend-value');
const marketUpdated = document.querySelector('#market-updated');
const wonFormatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
let marketTimer = null;

function parseMarketNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const number = Number(value.replace(/[,%]/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

function clearMarket() {
  marketCards.forEach((card) => { card.hidden = true; });
  if (marketSummary) { marketSummary.hidden = true; marketSummary.className = 'market-summary'; }
  if (marketUpdated) { marketUpdated.hidden = true; marketUpdated.textContent = ''; }
}

function renderMarket(payload) {
  clearMarket();
  if (payload?.marketOpen === false) return;
  const quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
  const quoteMap = new Map(quotes.map((quote) => [String(quote.symbol), quote]));
  const visibleQuotes = [];

  marketCards.forEach((card) => {
    const quote = quoteMap.get(card.dataset.symbol);
    const price = parseMarketNumber(quote?.price);
    const changeRate = parseMarketNumber(quote?.changeRate);
    if (price === null || changeRate === null) return;
    const priceElement = card.querySelector('[data-market-price]');
    const changeElement = card.querySelector('[data-market-change]');
    if (priceElement) priceElement.textContent = wonFormatter.format(price);
    if (changeElement) {
      changeElement.textContent = `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%`;
      changeElement.classList.toggle('is-positive', changeRate > 0);
      changeElement.classList.toggle('is-negative', changeRate < 0);
    }
    card.hidden = false;
    visibleQuotes.push({ price, changeRate });
  });

  if (visibleQuotes.length !== marketCards.length) return;
  const totalChangeRate = visibleQuotes.reduce((total, quote) => total + quote.changeRate, 0);
  if (totalChangeRate === 0 || !marketSummary) return;
  const positive = totalChangeRate > 0;
  marketSummary.hidden = false;
  marketSummary.classList.add(positive ? 'is-positive' : 'is-negative');
  if (marketTrendIcon) marketTrendIcon.textContent = positive ? '☀️' : '🌧️';
  if (marketTrendLabel) marketTrendLabel.textContent = positive ? '전체 흐름 상승' : '전체 흐름 하락';
  if (marketTrendValue) marketTrendValue.textContent = `${positive ? '+' : ''}${totalChangeRate.toFixed(2)}%`;
  if (marketUpdated && payload.updatedAt) {
    marketUpdated.hidden = false;
    marketUpdated.textContent = `마지막 확인: ${payload.updatedAt} (${payload.timezone || 'Asia/Seoul'})`;
  }
}

async function loadMarketData() {
  try {
    const response = await fetch(marketApiUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('시장 데이터 응답 오류');
    renderMarket(await response.json());
  } catch {
    clearMarket();
  }
}

loadMarketData();
marketTimer = window.setInterval(loadMarketData, 60_000);

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

function drawMarker(cell, color) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2, cellSize * .28, 0, Math.PI * 2);
  context.fill();
}

function drawSnake() {
  if (!snake.length) return;
  context.strokeStyle = '#397a00';
  context.lineWidth = cellSize * .72;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  snake.forEach((part, index) => {
    const x = part.x * cellSize + cellSize / 2;
    const y = part.y * cellSize + cellSize / 2;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.stroke();
  const head = snake[0];
  context.fillStyle = '#16221e';
  context.beginPath();
  context.arc(head.x * cellSize + cellSize / 2, head.y * cellSize + cellSize / 2, cellSize * .38, 0, Math.PI * 2);
  context.fill();
}

function drawBoard() {
  if (!context) return;
  context.fillStyle = '#eef5f0';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(22, 34, 30, .08)';
  for (let i = 0; i <= gridSize; i += 1) {
    context.beginPath(); context.moveTo(i * cellSize, 0); context.lineTo(i * cellSize, canvas.height); context.stroke();
    context.beginPath(); context.moveTo(0, i * cellSize); context.lineTo(canvas.width, i * cellSize); context.stroke();
  }
  drawMarker(food, '#d33674');
  drawMarker(enemy, '#147a9e');
  drawSnake();
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
  setStatus('준비');
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
  setStatus('게임 오버');
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
  setStatus('게임 중');
  if (pauseButton) pauseButton.disabled = false;
  stopTimer();
  gameTimer = setInterval(tick, difficultySettings[difficultySelect.value]);
}

function togglePause() {
  if (gameState === 'running') { stopTimer(); gameState = 'paused'; setStatus('일시정지'); }
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
