(function () {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const BASE_DROP_MS = 500;
  const MIN_DROP_MS = 80;
  const SOFT_DROP_MS = 50;
  const LINES_PER_LEVEL = 10;
  const SCORE_TABLE = [0, 100, 300, 500, 800];
  const DAS_MS = 150;   // 首移后延迟再开始连移
  const ARR_MS = 50;    // 连移间隔

  // Round 4: 柔和粉色/杏色/奶茶色系
  const TETROMINOES = [
    { name: 'I', shape: [[1, 1, 1, 1]], color: '#e8b4bc' },
    { name: 'O', shape: [[1, 1], [1, 1]], color: '#f0d4a0' },
    { name: 'T', shape: [[0, 1, 0], [1, 1, 1]], color: '#d4a5a5' },
    { name: 'S', shape: [[0, 1, 1], [1, 1, 0]], color: '#c9b896' },
    { name: 'Z', shape: [[1, 1, 0], [0, 1, 1]], color: '#e8c4a8' },
    { name: 'J', shape: [[1, 0, 0], [1, 1, 1]], color: '#c97b84' },
    { name: 'L', shape: [[0, 0, 1], [1, 1, 1]], color: '#e8a0a8' }
  ];

  const PREVIEW_CELL = 24;
  const PREVIEW_SIZE = 120;

  const canvas = document.getElementById('gameCanvas');
  const nextCanvas = document.getElementById('nextCanvas');
  const holdCanvas = document.getElementById('holdCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let board;
  let current;
  let nextPiece;
  let holdPiece;
  let canHold;
  let dropIntervalId = null;
  let dropIntervalMs = BASE_DROP_MS;
  let gameOver = false;
  let paused = false;
  let softDropActive = false;
  let score = 0;
  let totalLines = 0;
  let level = 1;
  let dasTimeoutId = null;
  let arrIntervalId = null;
  let repeatDir = 0;
  // 消行特效：显示 600ms，狗狗 scale 0.8 -> 1.1 -> 1，粒子扩散
  let lineClearEffectStart = 0;
  let lineClearParticles = [];
  const LINE_CLEAR_DURATION_MS = 600;
  const PARTICLE_COLORS = ['#e8b4bc', '#f0d4a0', '#c97b84', '#e8a0a8', '#d4a5a5'];

  function initBoard() {
    board = [];
    for (let y = 0; y < ROWS; y++) {
      board[y] = [];
      for (let x = 0; x < COLS; x++) board[y][x] = 0;
    }
  }

  function spawnX(shape) {
    const cols = shape[0].length;
    return Math.floor((COLS - cols) / 2);
  }

  function createPiece() {
    const def = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    const shape = def.shape.map(row => row.slice());
    return {
      shape: shape,
      x: spawnX(shape),
      y: 0,
      color: def.color
    };
  }

  function copyPiece(p) {
    return {
      shape: p.shape.map(row => row.slice()),
      x: p.x,
      y: p.y,
      color: p.color
    };
  }

  function collides(piece, offsetX, offsetY) {
    const nx = piece.x + offsetX;
    const ny = piece.y + offsetY;
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (!piece.shape[row][col]) continue;
        const gx = nx + col;
        const gy = ny + row;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && board[gy][gx]) return true;
      }
    }
    return false;
  }

  function rotateMatrix(mat) {
    const rows = mat.length;
    const cols = mat[0].length;
    const out = [];
    for (let r = 0; r < cols; r++) {
      out[r] = [];
      for (let c = 0; c < rows; c++) {
        out[r][c] = mat[rows - 1 - c][r];
      }
    }
    return out;
  }

  function rotate() {
    if (gameOver || paused || !current) return;
    const prev = current.shape.map(row => row.slice());
    current.shape = rotateMatrix(current.shape);
    if (collides(current, 0, 0)) {
      current.shape = prev;
    }
  }

  function moveLeft() {
    if (gameOver || paused || !current) return;
    if (!collides(current, -1, 0)) current.x -= 1;
  }

  function moveRight() {
    if (gameOver || paused || !current) return;
    if (!collides(current, 1, 0)) current.x += 1;
  }

  function moveDown() {
    if (gameOver || paused || !current) return false;
    if (collides(current, 0, 1)) {
      lock();
      return false;
    }
    current.y += 1;
    return true;
  }

  function clearLines() {
    let cleared = 0;
    let y = ROWS - 1;
    while (y >= 0) {
      let full = true;
      for (let x = 0; x < COLS; x++) {
        if (!board[y][x]) { full = false; break; }
      }
      if (full) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++;
      } else {
        y--;
      }
    }
    return cleared;
  }

  function updatePanel() {
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const linesEl = document.getElementById('lines');
    if (scoreEl) scoreEl.textContent = score;
    if (levelEl) levelEl.textContent = level;
    if (linesEl) linesEl.textContent = totalLines;
  }

  function getDropIntervalMs() {
    const ms = BASE_DROP_MS * Math.pow(0.9, level - 1);
    return Math.max(MIN_DROP_MS, Math.floor(ms));
  }

  function hold() {
    if (gameOver || paused || !canHold || !current) return;
    const pieceToHold = copyPiece(current);
    pieceToHold.x = spawnX(pieceToHold.shape);
    pieceToHold.y = 0;
    if (holdPiece === null) {
      holdPiece = pieceToHold;
      current = nextPiece;
      nextPiece = createPiece();
      current.x = spawnX(current.shape);
      current.y = 0;
      if (collides(current, 0, 0)) {
        gameOver = true;
        current = null;
        stopDropTimer();
      } else {
        startDropTimer();
      }
    } else {
      const tmp = holdPiece;
      holdPiece = pieceToHold;
      current = tmp;
      current.x = spawnX(current.shape);
      current.y = 0;
    }
    canHold = false;
  }

  function lock() {
    if (!current) return;
    for (let row = 0; row < current.shape.length; row++) {
      for (let col = 0; col < current.shape[row].length; col++) {
        if (!current.shape[row][col]) continue;
        const gy = current.y + row;
        const gx = current.x + col;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
          board[gy][gx] = current.color;
        }
      }
    }
    const linesCleared = clearLines();
    totalLines += linesCleared;
    if (linesCleared > 0) {
      score += SCORE_TABLE[Math.min(linesCleared, 4)];
      startLineClearEffect();
      showLuckyMessage();
    }
    level = Math.floor(totalLines / LINES_PER_LEVEL) + 1;
    dropIntervalMs = getDropIntervalMs();
    canHold = true;
    updatePanel();
    spawnNext();
  }

  function startLineClearEffect() {
    lineClearEffectStart = Date.now();
    lineClearParticles = [];
    for (var i = 0; i < 28; i++) {
      lineClearParticles.push({
        angle: (Math.PI * 2 * i) / 28 + Math.random() * 0.2,
        dist: 0,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        speed: 0.8 + Math.random() * 0.6
      });
    }
    function step() {
      draw();
      if (Date.now() - lineClearEffectStart < LINE_CLEAR_DURATION_MS) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function showLuckyMessage() {
    var el = document.getElementById('lineClearMessage');
    if (el) {
      el.classList.add('visible');
      window.clearTimeout(window._luckyMessageTimeout);
      window._luckyMessageTimeout = window.setTimeout(function () {
        el.classList.remove('visible');
      }, 2000);
    }
  }

  function spawnNext() {
    current = nextPiece;
    nextPiece = createPiece();
    if (collides(current, 0, 0)) {
      gameOver = true;
      current = null;
      stopDropTimer();
    } else {
      startDropTimer();
    }
  }

  function hardDrop() {
    if (gameOver || paused || !current) return;
    while (moveDown()) { }
    lock();
  }

  function startDropTimer() {
    stopDropTimer();
    if (paused) return;
    const ms = softDropActive ? SOFT_DROP_MS : dropIntervalMs;
    dropIntervalId = setInterval(tick, ms);
  }

  function stopDropTimer() {
    if (dropIntervalId) {
      clearInterval(dropIntervalId);
      dropIntervalId = null;
    }
  }

  function setDropSpeed(soft) {
    softDropActive = soft;
    if (dropIntervalId) {
      stopDropTimer();
      startDropTimer();
    }
  }

  function tick() {
    if (paused) return;
    moveDown();
    draw();
  }

  function drawPieceOn(ctx, piece, cellSize, offsetX, offsetY) {
    if (!piece || !piece.shape) return;
    const rows = piece.shape.length;
    const cols = piece.shape[0].length;
    const totalW = cols * cellSize;
    const totalH = rows * cellSize;
    const cx = offsetX + (PREVIEW_SIZE - totalW) / 2;
    const cy = offsetY + (PREVIEW_SIZE - totalH) / 2;
    ctx.fillStyle = piece.color;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!piece.shape[row][col]) continue;
        const px = cx + col * cellSize + 1;
        const py = cy + row * cellSize + 1;
        ctx.fillRect(px, py, cellSize - 2, cellSize - 2);
      }
    }
  }

  function drawNext() {
    if (!nextCanvas) return;
    const nctx = nextCanvas.getContext('2d');
    nctx.fillStyle = '#f5ebe0';
    nctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    drawPieceOn(nctx, nextPiece, PREVIEW_CELL, 0, 0);
  }

  function drawHold() {
    if (!holdCanvas) return;
    const hctx = holdCanvas.getContext('2d');
    hctx.fillStyle = '#f5ebe0';
    hctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    drawPieceOn(hctx, holdPiece, PREVIEW_CELL, 0, 0);
  }

  function drawGrid() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#f5ebe0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e8d5c4';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, h);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(w, y * CELL);
      ctx.stroke();
    }
  }

  function drawBoard() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!board[y][x]) continue;
        ctx.fillStyle = board[y][x];
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      }
    }
  }

  function drawPiece() {
    if (!current) return;
    ctx.fillStyle = current.color;
    for (let row = 0; row < current.shape.length; row++) {
      for (let col = 0; col < current.shape[row].length; col++) {
        if (!current.shape[row][col]) continue;
        const px = (current.x + col) * CELL + 1;
        const py = (current.y + row) * CELL + 1;
        ctx.fillRect(px, py, CELL - 2, CELL - 2);
      }
    }
  }

  function drawGameOver() {
    if (!gameOver) return;
    var overlay = document.getElementById('gameOverOverlay');
    if (overlay) overlay.classList.add('visible');
  }

  function drawPaused() {
    if (!paused) return;
    ctx.fillStyle = 'rgba(248,243,232,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#5c4a3a';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
  }

  function getLineClearScale(elapsed) {
    if (elapsed >= LINE_CLEAR_DURATION_MS) return 1;
    if (elapsed <= 250) return 0.8 + (elapsed / 250) * 0.3;
    return 1.1 - ((elapsed - 250) / 350) * 0.1;
  }

  function drawLineClearEffect() {
    if (lineClearParticles.length === 0) return;
    var elapsed = Date.now() - lineClearEffectStart;
    if (elapsed >= LINE_CLEAR_DURATION_MS) {
      lineClearParticles = [];
      return;
    }
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(248,243,232,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < lineClearParticles.length; i++) {
      var p = lineClearParticles[i];
      p.dist += p.speed * 2.2;
      var x = cx + Math.cos(p.angle) * p.dist;
      var y = cy + Math.sin(p.angle) * p.dist;
      var alpha = 1 - elapsed / LINE_CLEAR_DURATION_MS;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    var scale = getLineClearScale(elapsed);
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.font = '72px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐶', 0, 0);
    ctx.restore();
  }

  function draw() {
    drawGrid();
    drawBoard();
    drawPiece();
    drawLineClearEffect();
    drawPaused();
    drawGameOver();
    drawNext();
    drawHold();
  }

  function clearDASARR() {
    if (dasTimeoutId) {
      clearTimeout(dasTimeoutId);
      dasTimeoutId = null;
    }
    if (arrIntervalId) {
      clearInterval(arrIntervalId);
      arrIntervalId = null;
    }
    repeatDir = 0;
  }

  function onKeyDown(e) {
    if (e.code === 'KeyR') {
      e.preventDefault();
      startGame();
      return;
    }
    if (e.code === 'KeyP') {
      e.preventDefault();
      paused = !paused;
      if (paused) {
        stopDropTimer();
        clearDASARR();
      } else {
        if (current && !gameOver) startDropTimer();
      }
      draw();
      return;
    }
    if (gameOver || paused) return;

    switch (e.code) {
      case 'ArrowLeft':
        e.preventDefault();
        clearDASARR();
        moveLeft();
        repeatDir = -1;
        dasTimeoutId = setTimeout(function () {
          dasTimeoutId = null;
          arrIntervalId = setInterval(function () {
            moveLeft();
            draw();
          }, ARR_MS);
        }, DAS_MS);
        break;
      case 'ArrowRight':
        e.preventDefault();
        clearDASARR();
        moveRight();
        repeatDir = 1;
        dasTimeoutId = setTimeout(function () {
          dasTimeoutId = null;
          arrIntervalId = setInterval(function () {
            moveRight();
            draw();
          }, ARR_MS);
        }, DAS_MS);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveDown();
        setDropSpeed(true);
        break;
      case 'ArrowUp':
      case 'KeyX':
        e.preventDefault();
        rotate();
        break;
      case 'Space':
        e.preventDefault();
        hardDrop();
        break;
      case 'KeyC':
        e.preventDefault();
        hold();
        break;
      default:
        return;
    }
    draw();
  }

  function onKeyUp(e) {
    if (e.code === 'ArrowDown') {
      setDropSpeed(false);
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      clearDASARR();
    }
  }

  function startGame() {
    initBoard();
    gameOver = false;
    paused = false;
    softDropActive = false;
    canHold = true;
    score = 0;
    totalLines = 0;
    level = 1;
    holdPiece = null;
    lineClearEffectStart = 0;
    lineClearParticles = [];
    clearDASARR();
    dropIntervalMs = getDropIntervalMs();
    updatePanel();
    nextPiece = createPiece();
    var overlay = document.getElementById('gameOverOverlay');
    if (overlay) overlay.classList.remove('visible');
    spawnNext();
    draw();
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.evaTetrisRestart = startGame;
  startGame();
})();
