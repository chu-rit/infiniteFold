// Game Constants
const BOARD_SIZE = 4;
const INITIAL_VALUE = 2;

const DIRECTIONS = {
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
};

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
    const sourceValue = board[fromRow][fromCol];
    if (sourceValue === 0) return;

    const targetValue = board[toRow][toCol];

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

    const targetValue = newBoard[to.row][to.col];

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
    mismatches: [] 
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
    isMerge: board[move.to.row][move.to.col] === move.value && board[move.to.row][move.to.col] !== 0
  }));

  return { valid: true, ghosts, mismatches: [], isEmpty: false };
}

// Spawn new number - A 방식: 접은 후 보드의 남은 값들 중에서만 선택
function spawnNewNumber(board) {
  const emptyCells = [];
  
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length === 0) return board;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newBoard = board.map(row => [...row]);
  
  // 숫자 선택 로직 - 접은 후 보드의 남은 값들 중에서만 선택
  const existing = new Set();
  board.forEach(row => row.forEach(c => { 
    const val = c;
    if(val) existing.add(val); 
  }));
  const vals = Array.from(existing);
  
  let spawnValue = 2;
  if (vals.length > 0) {
    spawnValue = vals[Math.floor(Math.random() * vals.length)];
  }
  
  newBoard[randomCell.row][randomCell.col] = spawnValue;

  return newBoard;
}

// Get count of valid fold moves (0 = game over)
function getValidFoldCount(board) {
  const directions = Object.values(DIRECTIONS);
  const depths = [1, 2];
  let count = 0;

  for (const direction of directions) {
    for (const depth of depths) {
      const { possible } = canFold(board, direction, depth);
      if (possible) count++;
    }
  }

  return count;
}

// Check game over - for backward compatibility
function checkGameOver(board) {
  return getValidFoldCount(board) === 0;
}

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

export { BOARD_SIZE, DIRECTIONS, initializeBoard, canFold, executeFold, getFoldPreview, spawnNewNumber, checkGameOver };
