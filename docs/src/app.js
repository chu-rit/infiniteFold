// Infinite Fold - Web Version
// All code in one file to avoid module loading issues

// ==================== GAME LOGIC ====================

// Game Constants
const BOARD_SIZE = 4;
const INITIAL_VALUE = 2;

const DIRECTIONS = {
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
};

// Initialize board with center 2x2 filled
function initializeBoard() {
  const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  const center = BOARD_SIZE / 2;
  board[center - 1][center - 1] = INITIAL_VALUE;
  board[center - 1][center] = INITIAL_VALUE;
  board[center][center - 1] = INITIAL_VALUE;
  board[center][center] = INITIAL_VALUE;
  return board;
}

// Helper: Check if a cell is an object tile
const getValue = (cell) => cell || 0;

// Calculate symmetric target index
function getSymmetricIndex(index, foldDepth, boardSize = BOARD_SIZE) {
  if (foldDepth === 1) {
    if (index === 0) return 1;
    if (index === boardSize - 1) return boardSize - 2;
    if (index === 1) return 0;
    if (index === boardSize - 2) return boardSize - 1;
    return -1;
  }
  if (foldDepth === 2) {
    return boardSize - 1 - index;
  }
  return -1;
}

// Check if fold is valid and get moves
function canFold(board, direction, depth) {
  const moves = [];
  const mismatches = [];

  const validateAndAddMove = (fromRow, fromCol, toRow, toCol) => {
    const sourceValue = getValue(board[fromRow][fromCol]);
    if (sourceValue === 0) return;

    const targetValue = getValue(board[toRow][toCol]);

    if (targetValue !== 0 && targetValue !== sourceValue) {
      mismatches.push({ 
        row: fromRow, 
        col: fromCol, 
        targetRow: toRow, 
        targetCol: toCol 
      });
      return;
    }

    moves.push({ 
      from: { row: fromRow, col: fromCol }, 
      to: { row: toRow, col: toCol }, 
      value: sourceValue 
    });
  };

  if (direction === DIRECTIONS.TOP) {
    for (let row = 0; row < depth; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const targetRow = getSymmetricIndex(row, depth);
        if (targetRow >= 0) validateAndAddMove(row, col, targetRow, col);
      }
    }
  } else if (direction === DIRECTIONS.BOTTOM) {
    for (let row = BOARD_SIZE - 1; row >= BOARD_SIZE - depth; row--) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const targetRow = getSymmetricIndex(row, depth);
        if (targetRow >= 0) validateAndAddMove(row, col, targetRow, col);
      }
    }
  } else if (direction === DIRECTIONS.LEFT) {
    for (let col = 0; col < depth; col++) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        const targetCol = getSymmetricIndex(col, depth);
        if (targetCol >= 0) validateAndAddMove(row, col, row, targetCol);
      }
    }
  } else if (direction === DIRECTIONS.RIGHT) {
    for (let col = BOARD_SIZE - 1; col >= BOARD_SIZE - depth; col--) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        const targetCol = getSymmetricIndex(col, depth);
        if (targetCol >= 0) validateAndAddMove(row, col, row, targetCol);
      }
    }
  }

  const hasBlocksInFoldArea = moves.length > 0;

  return { 
    possible: mismatches.length === 0 && hasBlocksInFoldArea, 
    moves, 
    mismatches,
    isEmpty: !hasBlocksInFoldArea && mismatches.length === 0
  };
}

// Execute a fold
function executeFold(board, direction, depth) {
  const { possible, moves, mismatches } = canFold(board, direction, depth);

  if (!possible) {
    return { board, merged: false, mergeCount: 0, points: 0, mismatches };
  }

  const preMergeValues = new Set();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const val = getValue(board[row][col]);
      if (val !== 0) preMergeValues.add(val);
    }
  }

  const newBoard = board.map(row => [...row]);
  let mergeCount = 0;
  let points = 0;
  const mergedTargets = new Set();

  const sortedMoves = [...moves].sort((a, b) => {
    const distA = Math.min(a.from.row, a.from.col, BOARD_SIZE - 1 - a.from.row, BOARD_SIZE - 1 - a.from.col);
    const distB = Math.min(b.from.row, b.from.col, BOARD_SIZE - 1 - b.from.row, BOARD_SIZE - 1 - b.from.col);
    return distA - distB;
  });

  for (const move of sortedMoves) {
    const { from, to, value } = move;
    const targetKey = `${to.row},${to.col}`;

    newBoard[from.row][from.col] = 0;

    if (mergedTargets.has(targetKey)) continue;

    const targetValue = getValue(newBoard[to.row][to.col]);

    if (targetValue === 0) {
      newBoard[to.row][to.col] = value;
    } else if (targetValue === value) {
      newBoard[to.row][to.col] = value * 2;
      mergedTargets.add(targetKey);
      mergeCount++;
      points += value * 2;
    }
  }

  return { 
    board: newBoard, 
    merged: mergeCount > 0, 
    mergeCount, 
    points, 
    mismatches: [],
    preMergeValues: Array.from(preMergeValues)
  };
}

// Get preview for ghost tiles
function getFoldPreview(board, direction, depth) {
  const { possible, moves, mismatches, isEmpty } = canFold(board, direction, depth);

  if (!possible) {
    return { valid: false, ghosts: [], mismatches, isEmpty };
  }

  const ghosts = moves.map(move => ({
    row: move.to.row,
    col: move.to.col,
    value: move.value,
    isMerge: getValue(board[move.to.row][move.to.col]) === move.value && getValue(board[move.to.row][move.to.col]) !== 0
  }));

  return { valid: true, ghosts, mismatches: [], isEmpty: false };
}

// Spawn new number
function spawnNewNumber(board, preMergeValues) {
  const emptyCells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (getValue(board[row][col]) === 0) emptyCells.push({ row, col });
    }
  }

  if (emptyCells.length === 0) return board;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newBoard = board.map(row => [...row]);
  
  let spawnValue = 2;
  if (preMergeValues && preMergeValues.length > 0) {
    spawnValue = preMergeValues[Math.floor(Math.random() * preMergeValues.length)];
  } else {
    const existing = new Set();
    board.forEach(row => row.forEach(c => { if(getValue(c)) existing.add(getValue(c)) }));
    const vals = Array.from(existing);
    if (vals.length > 0) spawnValue = vals[Math.floor(Math.random() * vals.length)];
  }
  
  newBoard[randomCell.row][randomCell.col] = spawnValue;
  return newBoard;
}

// Check game over
function checkGameOver(board) {
  const directions = Object.values(DIRECTIONS);
  const depths = [1, 2];

  for (const direction of directions) {
    for (const depth of depths) {
      const { possible } = canFold(board, direction, depth);
      if (possible) return false;
    }
  }

  return true;
}

// ==================== APP LOGIC ====================

// Constants
const SWIPE_THRESHOLD = 20;
const DEPTH_THRESHOLD = 80;
const CANCEL_THRESHOLD = 180;
const GAP = 8;
const PADDING = 12;

// Game State
let board = initializeBoard();
let score = 0;
let bestScore = localStorage.getItem('infiniteFoldBestScore') || 0;
let isGameOver = false;
let gameOverDismissed = false;
let comboCount = 0;
let particles = [];
let particleIdCounter = 0;

// Preview State
let activeDirection = null;
let activeDepth = null;
let preview = { valid: true, ghosts: [], mismatches: [] };
let isCancelled = false;
let startPosition = { x: 0, y: 0 };

// Touch/Mouse handling
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let currentTranslateX = 0;
let currentTranslateY = 0;

// DOM Elements
const root = document.getElementById('root');
let boardElement = null;
let boardSize = 0;
let cellSize = 0;

// Initialize
function init() {
  updateBoardSize();
  render();
  setupEventListeners();
  window.addEventListener('resize', updateBoardSize);
  
  // 컨텍스트 메뉴 비활성화
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  }, true);
}

function updateBoardSize() {
  const container = document.querySelector('.board-container');
  if (!container) return;
  const containerWidth = container.clientWidth - 32;
  const containerHeight = window.innerHeight - 250;
  boardSize = Math.min(containerWidth, containerHeight, 380);
  cellSize = (boardSize - PADDING * 2 - GAP * 3) / 4;
  if (boardElement) {
    boardElement.style.width = boardSize + 'px';
    boardElement.style.height = boardSize + 'px';
  }
  renderBoard();
}

function resetGame() {
  board = initializeBoard();
  score = 0;
  isGameOver = false;
  gameOverDismissed = false;
  comboCount = 0;
  activeDirection = null;
  activeDepth = null;
  preview = { valid: true, ghosts: [], mismatches: [] };
  render();
}

function dismissGameOver() {
  gameOverDismissed = true;
  render();
}

// Combo particle creation
function createComboParticles() {
  const colors = comboCount >= 3 ? ['#e74c3c'] : ['#f67c5f'];
  const newParticles = Array.from({ length: 8 }).map((_, i) => ({
    id: ++particleIdCounter,
    color: colors[i % colors.length],
    angle: (i * 45) * (Math.PI / 180),
    distance: 80 + Math.random() * 40
  }));
  particles = [...particles, ...newParticles];
  
  setTimeout(() => {
    particles = particles.filter(p => !newParticles.find(np => np.id === p.id));
  }, 1000);
}

function handleFold(direction, depth) {
  const result = executeFold(board, direction, depth);
  
  if (result.mismatches.length > 0) {
    return { valid: false, mismatches: result.mismatches };
  }

  if (isGameOver) {
    return { valid: true, mergeCount: result.mergeCount, gameOver: true };
  }

  let newBoard = result.board;
  let newCombo = comboCount;

  if (result.mergeCount > 0) {
    newCombo += 1;
    comboCount = newCombo;
    createComboParticles();
  } else {
    newCombo = 0;
    comboCount = 0;
  }
  
  // 3콤보 이상일 때는 블록 생성 안 함
  if (newCombo < 3) {
    newBoard = spawnNewNumber(newBoard, result.preMergeValues);
  }

  const newScore = score + result.points;
  score = newScore;
  if (newScore > bestScore) {
    bestScore = newScore;
    localStorage.setItem('infiniteFoldBestScore', bestScore);
  }

  board = newBoard;

  if (checkGameOver(newBoard)) {
    isGameOver = true;
  }

  return { valid: true, mergeCount: result.mergeCount };
}

function getDirectionFromOffset(dx, dy) {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return null;
  
  if (absDx > absDy) {
    return dx > 0 ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
  }
  return dy > 0 ? DIRECTIONS.TOP : DIRECTIONS.BOTTOM;
}

function isCenterStart(x, y) {
  const cellWithGap = cellSize + GAP;
  const col = Math.floor((x - PADDING + GAP/2) / cellWithGap);
  const row = Math.floor((y - PADDING + GAP/2) / cellWithGap);
  const clampedCol = Math.max(0, Math.min(3, col));
  const clampedRow = Math.max(0, Math.min(3, row));
  return (clampedRow === 1 || clampedRow === 2) && (clampedCol === 1 || clampedCol === 2);
}

function getDepthFromOffset(dx, dy, startX, startY) {
  const maxOffset = Math.max(Math.abs(dx), Math.abs(dy));
  
  if (maxOffset > CANCEL_THRESHOLD) return 'cancel';
  if (maxOffset < SWIPE_THRESHOLD) return null;
  
  const baseDepth = isCenterStart(startX, startY) ? 2 : 1;
  if (baseDepth === 2) return 2;
  
  return maxOffset < DEPTH_THRESHOLD ? 1 : 2;
}

function setupEventListeners() {
  if (window.PointerEvent) {
    document.addEventListener('pointerdown', handlePointerDown, { passive: false });
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp, { passive: false });
    document.addEventListener('pointercancel', handlePointerUp, { passive: false });
  } else {
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
}

function handleTouchStart(e) {
  if (!boardElement) return;
  if (e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const rect = boardElement.getBoundingClientRect();
  if (touch.clientX < rect.left || touch.clientX > rect.right ||
      touch.clientY < rect.top || touch.clientY > rect.bottom) return;
  
  startDrag(touch.clientX, touch.clientY);
}

function handleMouseDown(e) {
  const rect = boardElement.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom) return;
  
  startDrag(e.clientX, e.clientY);
}

function startDrag(x, y) {
  const rect = boardElement.getBoundingClientRect();
  startPosition = { x: x - rect.left, y: y - rect.top };
  dragStartX = x;
  dragStartY = y;
  isDragging = true;
  isCancelled = false;
}

function handleTouchMove(e) {
  if (!isDragging) return;
  const touch = e.touches[0];
  if (!touch) return;
  
  e.preventDefault();
  handleDragMove(touch.clientX, touch.clientY);
}

function handleMouseMove(e) {
  if (!isDragging) return;
  handleDragMove(e.clientX, e.clientY);
}

function handleDragMove(x, y) {
  currentTranslateX = x - dragStartX;
  currentTranslateY = y - dragStartY;
  
  const direction = getDirectionFromOffset(currentTranslateX, currentTranslateY);
  const depth = getDepthFromOffset(currentTranslateX, currentTranslateY, startPosition.x, startPosition.y);
  
  if (depth === 'cancel') {
    isCancelled = true;
    activeDirection = null;
    activeDepth = null;
    preview = { valid: true, ghosts: [], mismatches: [] };
    renderBoard();
    return;
  }
  
  if (direction !== activeDirection || depth !== activeDepth) {
    activeDirection = direction;
    activeDepth = depth;
    
    if (direction && depth && depth !== 'cancel') {
      const previewResult = getFoldPreview(board, direction, depth);
      preview = previewResult;
    } else {
      preview = { valid: true, ghosts: [], mismatches: [] };
    }
    renderBoard();
  }
}

function handlePointerDown(e) {
  if (!boardElement) return;
  const rect = boardElement.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom) return;
  
  e.preventDefault();
  startDrag(e.clientX, e.clientY);
}

function handlePointerMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  handleDragMove(e.clientX, e.clientY);
}

function handlePointerUp(e) {
  if (!isDragging) return;
  isDragging = false;
  e.preventDefault();
  
  const direction = getDirectionFromOffset(currentTranslateX, currentTranslateY);
  const depth = getDepthFromOffset(currentTranslateX, currentTranslateY, startPosition.x, startPosition.y);
  
  if (direction && depth && depth !== 'cancel') {
    const previewResult = getFoldPreview(board, direction, depth);
    if (previewResult.valid && !previewResult.isEmpty) {
      handleFold(direction, depth);
    }
  }
  
  activeDirection = null;
  activeDepth = null;
  isCancelled = false;
  preview = { valid: true, ghosts: [], mismatches: [] };
  currentTranslateX = 0;
  currentTranslateY = 0;
  render();
}

function handleTouchEnd(e) {
  if (!isDragging) return;
  isDragging = false;
  
  const direction = getDirectionFromOffset(currentTranslateX, currentTranslateY);
  const depth = getDepthFromOffset(currentTranslateX, currentTranslateY, startPosition.x, startPosition.y);
  
  if (direction && depth && depth !== 'cancel') {
    const previewResult = getFoldPreview(board, direction, depth);
    if (previewResult.valid && !previewResult.isEmpty) {
      handleFold(direction, depth);
    }
  }
  
  activeDirection = null;
  activeDepth = null;
  isCancelled = false;
  preview = { valid: true, ghosts: [], mismatches: [] };
  currentTranslateX = 0;
  currentTranslateY = 0;
  render();
}

function handleMouseUp(e) {
  if (!isDragging) return;
  isDragging = false;
  handleDragEnd();
}

function handleDragEnd() {
  if (isCancelled) {
    activeDirection = null;
    activeDepth = null;
    isCancelled = false;
    preview = { valid: true, ghosts: [], mismatches: [] };
    currentTranslateX = 0;
    currentTranslateY = 0;
    renderBoard();
    return;
  }
  
  const direction = getDirectionFromOffset(currentTranslateX, currentTranslateY);
  const depth = getDepthFromOffset(currentTranslateX, currentTranslateY, startPosition.x, startPosition.y);
  
  if (!direction || !depth || depth === 'cancel') {
    activeDirection = null;
    activeDepth = null;
    preview = { valid: true, ghosts: [], mismatches: [] };
    currentTranslateX = 0;
    currentTranslateY = 0;
    renderBoard();
    return;
  }
  
  const previewResult = getFoldPreview(board, direction, depth);
  
  if (previewResult.valid && !previewResult.isEmpty) {
    handleFold(direction, depth);
  }
  
  activeDirection = null;
  activeDepth = null;
  isCancelled = false;
  preview = { valid: true, ghosts: [], mismatches: [] };
  currentTranslateX = 0;
  currentTranslateY = 0;
  render();
}

function getAffectedCells() {
  if (!activeDirection || !activeDepth) return [];
  const cells = [];
  
  if (activeDirection === DIRECTIONS.TOP) {
    for (let row = 0; row < activeDepth; row++) {
      for (let col = 0; col < 4; col++) cells.push({ row, col });
    }
  } else if (activeDirection === DIRECTIONS.BOTTOM) {
    for (let row = 4 - activeDepth; row < 4; row++) {
      for (let col = 0; col < 4; col++) cells.push({ row, col });
    }
  } else if (activeDirection === DIRECTIONS.LEFT) {
    for (let col = 0; col < activeDepth; col++) {
      for (let row = 0; row < 4; row++) cells.push({ row, col });
    }
  } else if (activeDirection === DIRECTIONS.RIGHT) {
    for (let col = 4 - activeDepth; col < 4; col++) {
      for (let row = 0; row < 4; row++) cells.push({ row, col });
    }
  }
  return cells;
}

function isAffectedCell(row, col) {
  return getAffectedCells().some(c => c.row === row && c.col === col);
}

function isMismatchCell(row, col) {
  return preview.mismatches.some(m => 
    (m.row === row && m.col === col) || 
    (m.targetRow === row && m.targetCol === col)
  );
}

function getTileColorClass(value) {
  if (value <= 2048) return `tile-${value}`;
  return 'tile-default';
}

function render() {
  const comboBurstStyle = comboCount > 1 ? `
    <style>
      @keyframes comboBurst {
        0% { transform: scale(0) rotate(-10deg); opacity: 1; }
        50% { transform: scale(1.2) rotate(0deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 0; }
      }
      @keyframes particle {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
      }
      .combo-burst {
        animation: comboBurst 1.1s ease-out forwards;
      }
      .particle {
        animation: particle 1s ease-out forwards;
      }
    </style>
  ` : '';
  
  const comboBurstHTML = comboCount > 1 ? `
    <div class="combo-burst-container">
      <div class="combo-burst ${comboCount >= 3 ? 'special' : ''}">
        <div class="combo-label">COMBO</div>
        <div class="combo-number-row">
          <span class="combo-x">×</span>
          <span class="combo-number ${comboCount >= 3 ? 'special' : ''}">${comboCount}</span>
        </div>
      </div>
    </div>
  ` : '';
  
  const particlesHTML = particles.map(p => {
    const tx = Math.cos(p.angle) * p.distance;
    const ty = Math.sin(p.angle) * p.distance;
    return `
      <div class="particle" style="
        position: absolute;
        width: 8px;
        height: 8px;
        background-color: ${p.color};
        border-radius: 50%;
        left: 50%;
        top: 35%;
        --tx: ${tx}px;
        --ty: ${ty}px;
      "></div>
    `;
  }).join('');

  root.innerHTML = `
    <div class="container">
      ${comboBurstStyle}
      
      <div class="combo-overlay" style="pointer-events: none;">
        ${particlesHTML}
        ${comboBurstHTML}
      </div>

      <div class="header">
        <div class="title-block">
          <div class="title">INFINITE</div>
          <div class="title-accent">FOLD</div>
        </div>
        
        <div class="score-block">
          <div class="score-box">
            <div class="score-label">SCORE</div>
            <div class="score-value">${score}</div>
          </div>
          <div class="score-box">
            <div class="score-label">BEST</div>
            <div class="score-value">${bestScore}</div>
          </div>
        </div>
      </div>

      <div class="board-container"></div>

      ${isGameOver && !gameOverDismissed ? `
        <div class="overlay">
          <div class="game-over-card">
            <div class="game-over-title">DEADLOCKED</div>
            <div class="game-over-message">No more valid moves!</div>
            <div class="game-over-score">Final Score: ${score}</div>
            <div class="close-button" id="closeBtn">
              <div class="close-button-text">✕ CLOSE</div>
            </div>
          </div>
        </div>
      ` : ''}

      ${isGameOver && gameOverDismissed ? `
        <div class="retry-bar" id="retryBtn">
          <div class="retry-button-text">🔄 TRY AGAIN</div>
        </div>
      ` : ''}

      <div class="instructions">
        <div class="instruction-text">Swipe to fold • Short: 1-Row • Long: 2-Row</div>
        <div class="tip-text">Always spawns new number after each fold</div>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    renderBoard();
    
    const closeBtn = document.getElementById('closeBtn');
    const retryBtn = document.getElementById('retryBtn');
    
    if (closeBtn) {
      closeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        dismissGameOver();
      }, { passive: false });
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dismissGameOver();
      });
    }
    
    if (retryBtn) {
      retryBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        resetGame();
      }, { passive: false });
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetGame();
      });
    }
  }, 0);
}

function renderBoard() {
  const container = document.querySelector('.board-container');
  if (!container) return;
  
  const affectedCells = getAffectedCells();
  
  container.innerHTML = `
    <div class="game-board" style="width: ${boardSize}px; height: ${boardSize}px;">
      <div class="board-content">
        ${Array(4).fill(null).map((_, row) =>
          Array(4).fill(null).map((_, col) => {
            const isAffected = affectedCells.some(c => c.row === row && c.col === col);
            return `
              <div class="cell ${isAffected && !activeDirection ? 'affected' : ''}" 
                   style="width: ${cellSize}px; height: ${cellSize}px; 
                          left: ${PADDING + col * (cellSize + GAP)}px; 
                          top: ${PADDING + row * (cellSize + GAP)}px;">
              </div>
            `;
          }).join('')
        ).join('')}
        
        ${activeDirection && activeDepth ? `
          <div class="fold-area-border" style="
            ${activeDirection === DIRECTIONS.TOP ? `
              top: ${PADDING}px;
              left: ${PADDING}px;
              right: ${PADDING}px;
              height: ${activeDepth * cellSize + (activeDepth - 1) * GAP}px;
            ` : ''}
            ${activeDirection === DIRECTIONS.BOTTOM ? `
              bottom: ${PADDING}px;
              left: ${PADDING}px;
              right: ${PADDING}px;
              height: ${activeDepth * cellSize + (activeDepth - 1) * GAP}px;
            ` : ''}
            ${activeDirection === DIRECTIONS.LEFT ? `
              left: ${PADDING}px;
              top: ${PADDING}px;
              bottom: ${PADDING}px;
              width: ${activeDepth * cellSize + (activeDepth - 1) * GAP}px;
            ` : ''}
            ${activeDirection === DIRECTIONS.RIGHT ? `
              right: ${PADDING}px;
              top: ${PADDING}px;
              bottom: ${PADDING}px;
              width: ${activeDepth * cellSize + (activeDepth - 1) * GAP}px;
            ` : ''}
          "></div>
        ` : ''}
        
        ${board.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            if (value === 0) return '';
            const isAffected = affectedCells.some(c => c.row === rowIndex && c.col === colIndex);
            const isMismatch = isMismatchCell(rowIndex, colIndex);
            const fontSize = value >= 1000 ? cellSize * 0.28 : value >= 100 ? cellSize * 0.35 : cellSize * 0.5;
            return `
              <div class="tile ${getTileColorClass(value)} ${isAffected ? 'affected' : ''} ${isMismatch ? 'mismatch' : ''}" 
                   style="width: ${cellSize}px; height: ${cellSize}px;
                          left: ${PADDING + colIndex * (cellSize + GAP)}px;
                          top: ${PADDING + rowIndex * (cellSize + GAP)}px;
                          font-size: ${fontSize}px;">
                <span class="tile-value">${value}</span>
              </div>
            `;
          }).join('')
        ).join('')}
        
        ${preview.valid && preview.ghosts.map((ghost, index) => {
          const fontSize = ghost.value >= 1000 ? cellSize * 0.28 : ghost.value >= 100 ? cellSize * 0.35 : cellSize * 0.5;
          return `
            <div class="tile ghost ${ghost.isMerge ? 'merge' : ''} ${getTileColorClass(ghost.value)}"
                 style="width: ${cellSize}px; height: ${cellSize}px;
                        left: ${PADDING + ghost.col * (cellSize + GAP)}px;
                        top: ${PADDING + ghost.row * (cellSize + GAP)}px;
                        font-size: ${fontSize}px;">
              <span class="tile-value">${ghost.value}</span>
              ${ghost.isMerge ? '<div class="merge-badge">×2</div>' : ''}
            </div>
          `;
        }).join('')}
      </div>
      
      ${activeDirection && !isCancelled ? `
        <div class="arrow-overlay" style="
          ${activeDirection === DIRECTIONS.TOP ? `
            top: ${PADDING + (activeDepth || 1) * cellSize + ((activeDepth || 1) - 0.5) * GAP - 24}px;
            left: 0; right: 0;
            justify-content: center;
          ` : ''}
          ${activeDirection === DIRECTIONS.BOTTOM ? `
            bottom: ${PADDING + (activeDepth || 1) * (cellSize + GAP) - GAP/2 - 24}px;
            left: 0; right: 0;
            justify-content: center;
          ` : ''}
          ${activeDirection === DIRECTIONS.LEFT ? `
            left: ${PADDING + (activeDepth || 1) * cellSize + ((activeDepth || 1) - 0.5) * GAP - 24}px;
            top: 0; bottom: 0;
            justify-content: center;
          ` : ''}
          ${activeDirection === DIRECTIONS.RIGHT ? `
            right: ${PADDING + (activeDepth || 1) * cellSize + ((activeDepth || 1) - 0.5) * GAP - 24}px;
            top: 0; bottom: 0;
            justify-content: center;
          ` : ''}
        ">
          <div class="arrow-text" style="color: ${preview.valid ? '#4ecca3' : '#ff4444'}">
            ${activeDirection === DIRECTIONS.TOP ? '▼' : ''}
            ${activeDirection === DIRECTIONS.BOTTOM ? '▲' : ''}
            ${activeDirection === DIRECTIONS.LEFT ? '▶' : ''}
            ${activeDirection === DIRECTIONS.RIGHT ? '◀' : ''}
          </div>
        </div>
      ` : ''}
      
      ${(isCancelled || preview.isEmpty) ? `
        <div class="message-overlay">
          <div class="message-text">${isCancelled ? 'CANCELLED' : 'EMPTY'}</div>
        </div>
      ` : ''}

      ${!preview.valid && !preview.isEmpty ? `
        <div class="warning-overlay">
          <div class="warning-text">✕ BLOCKED</div>
        </div>
      ` : ''}
    </div>
  `;
  
  boardElement = container.querySelector('.game-board');
}

init();
