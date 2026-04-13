// Infinite Fold - Web Version
import { 
  BOARD_SIZE, 
  DIRECTIONS, 
  initializeBoard, 
  executeFold, 
  getFoldPreview, 
  spawnNewNumber, 
  checkGameOver 
} from './game-logic.js';

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
  render();
  setupEventListeners();
  updateBoardSize();
  window.addEventListener('resize', updateBoardSize);
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

function handleFold(direction, depth) {
  const result = executeFold(board, direction, depth);
  
  if (result.mismatches.length > 0) {
    return { valid: false, mismatches: result.mismatches };
  }

  // Game over state - only provide feedback, don't change state
  if (isGameOver) {
    return { valid: true, mergeCount: result.mergeCount, gameOver: true };
  }

  let newBoard = result.board;

  if (result.mergeCount > 0) {
    comboCount += 1;
  } else {
    comboCount = 0;
  }
  newBoard = spawnNewNumber(newBoard);

  score += result.points;
  if (score > bestScore) {
    bestScore = score;
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
  // iOS Safari를 위해 capture phase 사용
  document.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
  document.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
  document.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true });
  // iOS에서 클릭 이벤트도 처리 (터치 백업)
  document.addEventListener('click', preventClick, { capture: true });
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

let lastTouchTime = 0;
function preventClick(e) {
  // 터치 후 500ms 내의 클릭은 무시 (iOS ghost click 방지)
  if (Date.now() - lastTouchTime < 500) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function handleTouchStart(e) {
  // 보드 요소가 없으면 리턴
  if (!boardElement) return;
  // 멀티터치 무시
  if (e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const rect = boardElement.getBoundingClientRect();
  // 보드 영역 내에서만 시작
  if (touch.clientX < rect.left || touch.clientX > rect.right ||
      touch.clientY < rect.top || touch.clientY > rect.bottom) return;
  
  e.preventDefault();
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
  // 첫 번째 터치 포인트 사용
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

function handleTouchEnd(e) {
  if (!isDragging) return;
  // iOS에서 touchend의 preventDefault는 제거 (클릭 이벤트 차단 문제)
  isDragging = false;
  // changedTouches 사용 (손가락을 뗀 터치만)
  const touch = e.changedTouches[0];
  if (touch) {
    // iOS에서 즉시 실행을 위해 setTimeout 사용
    setTimeout(() => handleDragEnd(), 0);
  }
}

function handleMouseUp(e) {
  if (!isDragging) return;
  isDragging = false;
  handleDragEnd();
}

function handleDragEnd() {
  console.log('handleDragEnd called');
  console.log('currentTranslate:', currentTranslateX, currentTranslateY);
  console.log('startPosition:', startPosition.x, startPosition.y);
  
  // 취소된 경우
  if (isCancelled) {
    console.log('cancelled - resetting');
    activeDirection = null;
    activeDepth = null;
    isCancelled = false;
    preview = { valid: true, ghosts: [], mismatches: [] };
    currentTranslateX = 0;
    currentTranslateY = 0;
    renderBoard();
    return;
  }
  
  // 드래그 거리가 충분하지 않으면 무시
  const direction = getDirectionFromOffset(currentTranslateX, currentTranslateY);
  const depth = getDepthFromOffset(currentTranslateX, currentTranslateY, startPosition.x, startPosition.y);
  
  console.log('direction:', direction, 'depth:', depth);
  
  // 유효하지 않은 방향/깊이면 무시
  if (!direction || !depth || depth === 'cancel') {
    console.log('invalid direction/depth - resetting only');
    activeDirection = null;
    activeDepth = null;
    preview = { valid: true, ghosts: [], mismatches: [] };
    currentTranslateX = 0;
    currentTranslateY = 0;
    renderBoard();
    return;
  }
  
  const previewResult = getFoldPreview(board, direction, depth);
  
  // 유효한 폴드 실행
  if (previewResult.valid && !previewResult.isEmpty) {
    handleFold(direction, depth);
  }
  
  // 상태 초기화
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
  root.innerHTML = `
    <div class="container">
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

      <div class="combo-bar ${comboCount === 0 ? 'hidden' : ''}">
        <div class="combo-text">🔥 COMBO ×${comboCount > 0 ? comboCount : 1}</div>
      </div>

      <div class="board-container"></div>

      ${isGameOver && !gameOverDismissed ? `
        <div class="overlay">
          <div class="game-over-card">
            <div class="game-over-title">DEADLOCKED</div>
            <div class="game-over-message">No more valid moves!</div>
            <div class="game-over-score">Final Score: ${score}</div>
            <div class="close-button" onclick="window.dismissGameOver()">
              <div class="close-button-text">✕ CLOSE</div>
            </div>
          </div>
        </div>
      ` : ''}

      ${isGameOver && gameOverDismissed ? `
        <div class="retry-bar" onclick="window.resetGame()">
          <div class="retry-button-text">🔄 TRY AGAIN</div>
        </div>
      ` : ''}

      <div class="instructions">
        <div class="instruction-text">Swipe to fold • Short: 1-Row • Long: 2-Row</div>
        <div class="tip-text">Always spawns new number after each fold</div>
      </div>
    </div>
  `;
  
  window.resetGame = resetGame;
  window.dismissGameOver = dismissGameOver;
  
  setTimeout(() => {
    renderBoard();
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

// Start the app
init();
