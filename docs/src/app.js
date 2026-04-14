// React-based Web App for Infinite Fold
(function() {
  'use strict';

  // Game Constants
  const BOARD_SIZE = 4;
  const INITIAL_VALUE = 2;
  const DIRECTIONS = {
    TOP: 'top',
    BOTTOM: 'bottom',
    LEFT: 'left',
    RIGHT: 'right',
  };

  // Game State
  let gameState = {
    board: [],
    score: 0,
    bestScore: 0,
    comboCount: 0,
    isGameOver: false,
    gameOverDismissed: false,
    starPositions: [],
    grayStars: [],
    validFoldCount: 8,
  };

  // Touch handling
  let touchStartX = 0;
  let touchStartY = 0;
  let activeDirection = null;
  let activeDepth = null;
  let isCancelled = false;

  const SWIPE_THRESHOLD = 20;
  const DEPTH_THRESHOLD = 80;
  const CANCEL_THRESHOLD = 180;

  // Game Logic Functions
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

  function canFold(board, direction, depth) {
    const moves = [];
    const mismatches = [];

    const validateAndAddMove = (fromRow, fromCol, toRow, toCol) => {
      const sourceValue = board[fromRow][fromCol];
      if (sourceValue === 0) return;

      const targetValue = board[toRow][toCol];
      if (targetValue === 0 || targetValue === sourceValue) {
        moves.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, value: sourceValue });
      } else {
        mismatches.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, sourceValue, targetValue });
      }
    };

    if (direction === DIRECTIONS.TOP) {
      if (depth === 1) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          validateAndAddMove(0, col, 1, col);
          validateAndAddMove(BOARD_SIZE - 1, col, BOARD_SIZE - 2, col);
        }
      } else if (depth === 2) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          for (let row = 0; row < BOARD_SIZE / 2; row++) {
            validateAndAddMove(row, col, BOARD_SIZE - 1 - row, col);
          }
        }
      }
    } else if (direction === DIRECTIONS.BOTTOM) {
      if (depth === 1) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          validateAndAddMove(1, col, 0, col);
          validateAndAddMove(BOARD_SIZE - 2, col, BOARD_SIZE - 1, col);
        }
      } else if (depth === 2) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          for (let row = 0; row < BOARD_SIZE / 2; row++) {
            validateAndAddMove(BOARD_SIZE - 1 - row, col, row, col);
          }
        }
      }
    } else if (direction === DIRECTIONS.LEFT) {
      if (depth === 1) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          validateAndAddMove(row, 0, row, 1);
          validateAndAddMove(row, BOARD_SIZE - 1, row, BOARD_SIZE - 2);
        }
      } else if (depth === 2) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          for (let col = 0; col < BOARD_SIZE / 2; col++) {
            validateAndAddMove(row, col, row, BOARD_SIZE - 1 - col);
          }
        }
      }
    } else if (direction === DIRECTIONS.RIGHT) {
      if (depth === 1) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          validateAndAddMove(row, 1, row, 0);
          validateAndAddMove(row, BOARD_SIZE - 2, row, BOARD_SIZE - 1);
        }
      } else if (depth === 2) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          for (let col = 0; col < BOARD_SIZE / 2; col++) {
            validateAndAddMove(row, BOARD_SIZE - 1 - col, row, col);
          }
        }
      }
    }

    const possible = moves.length > 0 && mismatches.length === 0;
    return { possible, moves, mismatches };
  }

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

  function spawnNewNumber(board, specificPosition = null) {
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
    
    let targetCell;
    if (specificPosition) {
      targetCell = specificPosition;
    } else {
      const emptyCells = [];
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (board[row][col] === 0) emptyCells.push({ row, col });
        }
      }
      if (emptyCells.length === 0) return board;
      targetCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }
    
    const newBoard = board.map(row => [...row]);
    newBoard[targetCell.row][targetCell.col] = spawnValue;
    return newBoard;
  }

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

  function checkGameOver(board) {
    return getValidFoldCount(board) === 0;
  }

  function initializeBoard() {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    const center = BOARD_SIZE / 2;
    board[center - 1][center - 1] = INITIAL_VALUE;
    board[center - 1][center] = INITIAL_VALUE;
    board[center][center - 1] = INITIAL_VALUE;
    board[center][center] = INITIAL_VALUE;
    return board;
  }

  function generateStarPositions(currentBoard) {
    const emptyCells = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (currentBoard[row][col] === 0) {
          emptyCells.push({ row, col });
        }
      }
    }
    if (emptyCells.length === 0) return { stars: [], grayStars: [] };
    
    const randomPos = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    
    if (Math.random() <= 0.3) {
      return { stars: [randomPos], grayStars: [] };
    } else {
      return { stars: [], grayStars: [randomPos] };
    }
  }

  // React Components
  const e = React.createElement;

  function GameScreen() {
    const [state, setState] = React.useState(gameState);

    React.useEffect(() => {
      const saved = localStorage.getItem('infiniteFoldBestScore');
      if (saved) {
        setState(prev => ({ ...prev, bestScore: parseInt(saved) }));
      }
      resetGame();
    }, []);

    function resetGame() {
      const newBoard = initializeBoard();
      const starResult = generateStarPositions(newBoard);
      const newState = {
        board: newBoard,
        score: 0,
        isGameOver: false,
        gameOverDismissed: false,
        comboCount: 0,
        starPositions: starResult.stars,
        grayStars: starResult.grayStars,
        validFoldCount: getValidFoldCount(newBoard),
      };
      setState(newState);
      gameState = newState;
    }

    function handleFold(direction, depth) {
      if (state.isGameOver && !state.gameOverDismissed) return;
      
      const { possible, mismatches } = canFold(state.board, direction, depth);
      if (!possible || mismatches.length > 0) return;

      const result = executeFold(state.board, direction, depth);
      let newBoard = result.board;

      let newCombo = state.comboCount;
      if (result.mergeCount > 0) {
        newCombo += 1;
      } else {
        newCombo = 0;
      }

      let starUpgraded = false;
      if (state.starPositions.length > 0) {
        for (const starPos of state.starPositions) {
          const { row, col } = starPos;
          if (newBoard[row][col] === 0) {
            newBoard = spawnNewNumber(newBoard, { row, col });
          } else {
            newBoard[row][col] *= 2;
            starUpgraded = true;
          }
        }
      } else {
        newBoard = spawnNewNumber(newBoard);
      }

      const nextStarResult = generateStarPositions(newBoard);
      const comboBonus = newCombo > 0 ? Math.pow(2, newCombo) : 0;
      const newScore = state.score + result.points + comboBonus;
      
      const newValidFoldCount = getValidFoldCount(newBoard);
      const newIsGameOver = newValidFoldCount === 0;
      
      const newState = {
        ...state,
        board: newBoard,
        score: newScore,
        comboCount: newCombo,
        starPositions: nextStarResult.stars,
        grayStars: nextStarResult.grayStars,
        validFoldCount: newValidFoldCount,
        isGameOver: newIsGameOver,
        bestScore: Math.max(newScore, state.bestScore),
      };

      setState(newState);
      gameState = newState;

      if (newScore > state.bestScore) {
        localStorage.setItem('infiniteFoldBestScore', newScore);
      }
    }

    function dismissGameOver() {
      setState(prev => ({ ...prev, gameOverDismissed: true }));
    }

    return e('div', { style: styles.container }, [
      e('div', { key: 'content', style: styles.contentWrapper }, [
        e('div', { key: 'header', style: styles.header }, [
          e('div', { key: 'title', style: styles.titleBlock }, [
            e('div', { style: styles.title }, 'INFINITE'),
            e('div', { style: styles.titleAccent }, 'FOLD'),
          ]),
          e('div', { key: 'scores', style: styles.scoreBlock }, [
            e('div', { key: 'moves', style: [styles.scoreBox, styles.movesBox] }, [
              e('div', { style: styles.scoreLabel }, 'Possible\nMoves'),
              e('div', { 
                style: [styles.scoreValue, state.validFoldCount <= 2 && styles.movesValueWarning] 
              }, state.validFoldCount),
            ]),
            e('div', { key: 'score', style: styles.scoreBox }, [
              e('div', { style: styles.scoreLabel }, 'SCORE'),
              e('div', { style: styles.scoreValue }, state.score),
            ]),
            e('div', { key: 'best', style: styles.scoreBox }, [
              e('div', { style: styles.scoreLabel }, 'BEST'),
              e('div', { style: styles.scoreValue }, state.bestScore),
            ]),
          ]),
        ]),
      ]),
      e(GameBoard, { 
        key: 'board',
        board: state.board, 
        onFold: handleFold,
        isGameOver: state.isGameOver,
        starPositions: state.starPositions,
        grayStars: state.grayStars,
      }),
      state.isGameOver && !state.gameOverDismissed && e(GameOverPopup, {
        key: 'gameover',
        score: state.score,
        onClose: dismissGameOver,
      }),
      state.isGameOver && state.gameOverDismissed && e(RetryButton, {
        key: 'retry',
        onRetry: resetGame,
      }),
    ]);
  }

  function GameBoard({ board, onFold, isGameOver, starPositions, grayStars }) {
    const boardRef = React.useRef(null);

    React.useEffect(() => {
      const boardElement = boardRef.current;
      if (!boardElement) return;

      let startX = 0, startY = 0;
      let currentDirection = null;
      let currentDepth = null;
      let cancelled = false;

      function handleStart(e) {
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        currentDirection = null;
        currentDepth = null;
        cancelled = false;
      }

      function handleMove(e) {
        if (!e.touches && e.buttons !== 1) return;
        
        const touch = e.touches ? e.touches[0] : e;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance < SWIPE_THRESHOLD) return;
        
        const direction = Math.abs(deltaX) > Math.abs(deltaY) 
          ? (deltaX > 0 ? 'right' : 'left')
          : (deltaY > 0 ? 'bottom' : 'top');
        
        const depth = distance > DEPTH_THRESHOLD ? 2 : 1;
        
        if (distance > CANCEL_THRESHOLD) {
          cancelled = true;
          return;
        }
        
        if (!cancelled) {
          currentDirection = direction;
          currentDepth = depth;
        }
      }

      function handleEnd(e) {
        if (!cancelled && currentDirection && currentDepth) {
          onFold(currentDirection, currentDepth);
        }
        currentDirection = null;
        currentDepth = null;
        cancelled = false;
      }

      // Touch events
      boardElement.addEventListener('touchstart', handleStart, { passive: false });
      boardElement.addEventListener('touchmove', handleMove, { passive: false });
      boardElement.addEventListener('touchend', handleEnd, { passive: false });
      
      // Mouse events
      boardElement.addEventListener('mousedown', handleStart);
      boardElement.addEventListener('mousemove', handleMove);
      boardElement.addEventListener('mouseup', handleEnd);
      boardElement.addEventListener('mouseleave', handleEnd);

      return () => {
        boardElement.removeEventListener('touchstart', handleStart);
        boardElement.removeEventListener('touchmove', handleMove);
        boardElement.removeEventListener('touchend', handleEnd);
        boardElement.removeEventListener('mousedown', handleStart);
        boardElement.removeEventListener('mousemove', handleMove);
        boardElement.removeEventListener('mouseup', handleEnd);
        boardElement.removeEventListener('mouseleave', handleEnd);
      };
    }, [onFold]);

    const cells = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        cells.push(e('div', { 
          key: `cell-${row}-${col}`,
          style: styles.cell 
        }));
      }
    }

    const tiles = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const value = board[row][col];
        if (value !== 0) {
          tiles.push(e('div', {
            key: `tile-${row}-${col}`,
            style: [styles.tile, styles[`tile-${value}`], {
              left: `${12 + col * (80 + 8)}px`,
              top: `${12 + row * (80 + 8)}px`,
            }],
          }, value));
        }
      }
    }

    const stars = [];
    starPositions.forEach((star, index) => {
      stars.push(e('div', {
        key: `star-${index}`,
        style: [styles.starMarker, {
          left: `${12 + star.col * (80 + 8)}px`,
          top: `${12 + star.row * (80 + 8)}px`,
        }],
      }, e('div', { style: styles.starText }, '★')));
    });

    grayStars.forEach((star, index) => {
      stars.push(e('div', {
        key: `gray-star-${index}`,
        style: [styles.starMarker, styles.grayStarMarker, {
          left: `${12 + star.col * (80 + 8)}px`,
          top: `${12 + star.row * (80 + 8)}px`,
        }],
      }, e('div', { style: [styles.starText, styles.grayStarText] }, '★')));
    });

    return e('div', { 
      ref: boardRef,
      style: [styles.boardContainer, styles.board] 
    }, [...cells, ...tiles, ...stars]);
  }

  function GameOverPopup({ score, onClose }) {
    return e('div', { style: styles.overlay }, [
      e('div', { key: 'card', style: styles.gameOverCard }, [
        e('div', { key: 'title', style: styles.gameOverTitle }, 'DEADLOCKED'),
        e('div', { key: 'message', style: styles.gameOverMessage }, 'No more valid moves!'),
        e('div', { key: 'score', style: styles.gameOverScore }, `Final Score: ${score}`),
        e('div', { 
          key: 'close', 
          style: styles.closeButton,
          onClick: onClose 
        }, e('div', { style: styles.closeButtonText }, '✕ CLOSE')),
      ]),
    ]);
  }

  function RetryButton({ onRetry }) {
    return e('div', { style: styles.retrySection }, [
      e('div', {
        key: 'button',
        style: styles.retryButton,
        onClick: onRetry
      }, [
        e('div', { key: 'icon', style: styles.retryIcon }, '↻'),
        e('div', { key: 'text', style: styles.retryText }, 'TRY AGAIN'),
      ]),
    ]);
  }

  // Styles
  const styles = {
    container: {
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    contentWrapper: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    header: {
      width: '100%',
      padding: '8px 16px 12px',
      marginBottom: '20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    titleBlock: {
      display: 'flex',
      flexDirection: 'column',
    },
    title: {
      fontSize: '48px',
      fontWeight: 'bold',
      color: '#776e65',
      letterSpacing: '2px',
      lineHeight: '32px',
    },
    titleAccent: {
      fontSize: '48px',
      fontWeight: 'bold',
      color: '#f67c5f',
      letterSpacing: '2px',
      lineHeight: '32px',
    },
    scoreBlock: {
      display: 'flex',
      gap: '8px',
    },
    scoreBox: {
      backgroundColor: '#bbada0',
      padding: '8px 14px',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: '60px',
      textAlign: 'center',
    },
    movesBox: {
      backgroundColor: '#8f7a66',
    },
    scoreLabel: {
      fontSize: '10px',
      color: '#eee4da',
      fontWeight: '600',
      marginBottom: '2px',
      lineHeight: '1.2',
      whiteSpace: 'pre-line',
    },
    scoreValue: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#fff',
    },
    movesValueWarning: {
      color: '#ff6b6b',
    },
    boardContainer: {
      width: 'min(92vw, 380px)',
      height: 'min(92vw, 380px)',
      position: 'relative',
    },
    board: {
      backgroundColor: '#bbada0',
      borderRadius: '12px',
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: 'repeat(4, 1fr)',
      gap: '8px',
      padding: '12px',
    },
    cell: {
      backgroundColor: 'rgba(238, 228, 218, 0.35)',
      borderRadius: '6px',
    },
    tile: {
      position: 'absolute',
      width: '80px',
      height: '80px',
      borderRadius: '6px',
      fontWeight: 'bold',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '24px',
      transition: 'all 0.15s ease-in-out',
    },
    'tile-2': { backgroundColor: '#eee4da', color: '#776e65' },
    'tile-4': { backgroundColor: '#ede0c8', color: '#776e65' },
    'tile-8': { backgroundColor: '#f2b179', color: '#f9f6f2' },
    'tile-16': { backgroundColor: '#f59563', color: '#f9f6f2' },
    'tile-32': { backgroundColor: '#f67c5f', color: '#f9f6f2' },
    'tile-64': { backgroundColor: '#f65e3b', color: '#f9f6f2' },
    'tile-128': { backgroundColor: '#edcf72', color: '#f9f6f2', fontSize: '20px' },
    'tile-256': { backgroundColor: '#edcc61', color: '#f9f6f2', fontSize: '20px' },
    'tile-512': { backgroundColor: '#edc850', color: '#f9f6f2', fontSize: '20px' },
    'tile-1024': { backgroundColor: '#edc53f', color: '#f9f6f2', fontSize: '18px' },
    'tile-2048': { backgroundColor: '#edc22e', color: '#f9f6f2', fontSize: '18px' },
    starMarker: {
      position: 'absolute',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderRadius: '6px',
      pointerEvents: 'none',
      width: '80px',
      height: '80px',
    },
    starText: {
      fontSize: '32px',
      color: '#edc22e',
      opacity: '0.8',
    },
    grayStarMarker: {
      opacity: '0.4',
    },
    grayStarText: {
      color: '#999',
      opacity: '0.5',
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    gameOverCard: {
      backgroundColor: '#fff',
      padding: '32px',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    },
    gameOverTitle: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#e94560',
      marginBottom: '8px',
    },
    gameOverMessage: {
      fontSize: '14px',
      color: '#776e65',
      marginBottom: '8px',
    },
    gameOverScore: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#f67c5f',
      marginBottom: '16px',
    },
    closeButton: {
      backgroundColor: '#e74c3c',
      padding: '14px',
      borderRadius: '8px',
      minWidth: '140px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    closeButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: '16px',
    },
    retrySection: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '20px',
      marginBottom: '20px',
    },
    retryButton: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#e74c3c',
      padding: '14px 28px',
      borderRadius: '25px',
      gap: '8px',
      cursor: 'pointer',
    },
    retryIcon: {
      fontSize: '20px',
      color: '#fff',
    },
    retryText: {
      fontSize: '16px',
      color: '#fff',
      fontWeight: 'bold',
    },
  };

  // Render app
  ReactDOM.render(e(GameScreen), document.getElementById('root'));
})();
