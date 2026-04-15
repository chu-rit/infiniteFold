// Game State
let board = [];
let score = 0;
let bestScore = 0;
let comboCount = 0;
let isGameOver = false;
let gameOverDismissed = false;
let starPositions = [];
let grayStars = [];
let validFoldCount = 8;

// Touch handling
let touchStartX = 0;
let touchStartY = 0;
let activeDirection = null;
let activeDepth = null;
let isCancelled = false;

// Constants
const SWIPE_THRESHOLD = 20;
const DEPTH_THRESHOLD = 80;
const CANCEL_THRESHOLD = 180;

// Initialize game
function init() {
    loadBestScore();
    resetGame();
    setupEventListeners();
    render();
}

// Load best score from localStorage
function loadBestScore() {
    const saved = localStorage.getItem('infiniteFoldBestScore');
    if (saved) {
        bestScore = parseInt(saved);
        document.getElementById('best-score').textContent = bestScore;
    }
}

// Save best score to localStorage
function saveBestScore() {
    localStorage.setItem('infiniteFoldBestScore', bestScore);
}

// Reset game
function resetGame() {
    board = initializeBoard();
    score = 0;
    isGameOver = false;
    gameOverDismissed = false;
    comboCount = 0;
    
    const starResult = generateStarPositions(board);
    starPositions = starResult.stars;
    grayStars = starResult.grayStars;
    
    validFoldCount = getValidFoldCount(board);
    
    updateUI();
    hideGameOver();
    hideRetryButton();
}

// Generate star positions (30% normal star, 70% gray star)
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
        // 30%: normal star with functionality
        return { stars: [randomPos], grayStars: [] };
    } else {
        // 70%: gray star (preview only)
        return { stars: [], grayStars: [randomPos] };
    }
}

// Handle fold
function handleFold(direction, depth) {
    if (isGameOver && !gameOverDismissed) return;
    
    const { possible, mismatches } = canFold(board, direction, depth);
    if (!possible || mismatches.length > 0) return;

    const result = executeFold(board, direction, depth);
    let newBoard = result.board;

    // Update combo
    let newCombo = comboCount;
    if (result.mergeCount > 0) {
        newCombo += 1;
        comboCount = newCombo;
        showComboPopup(newCombo);
        if (newCombo >= 3) {
            showComboBurst(newCombo);
        }
    } else {
        newCombo = 0;
        comboCount = 0;
    }

    // Handle stars (30% stars only have functionality)
    let starUpgraded = false;
    if (starPositions.length > 0) {
        // Process normal stars only
        for (const starPos of starPositions) {
            const { row, col } = starPos;
            if (newBoard[row][col] === 0) {
                // Star position is empty → spawn at that position
                newBoard = spawnNewNumber(newBoard, { row, col });
            } else {
                // Star position is filled → upgrade block
                newBoard[row][col] *= 2;
                starUpgraded = true;
            }
        }
    } else {
        // No normal stars or only gray stars → normal spawn
        newBoard = spawnNewNumber(newBoard);
    }

    // Generate next turn stars
    const nextStarResult = generateStarPositions(newBoard);
    starPositions = nextStarResult.stars;
    grayStars = nextStarResult.grayStars;

    // Update score (combo bonus only, no star bonus)
    const comboBonus = newCombo > 0 ? Math.pow(2, newCombo) : 0;
    score += result.points + comboBonus;
    
    if (score > bestScore) {
        bestScore = score;
        saveBestScore();
    }

    board = newBoard;

    // Calculate valid fold count
    validFoldCount = getValidFoldCount(board);
    
    if (validFoldCount === 0) {
        isGameOver = true;
        showGameOver();
    }

    updateUI();
    render();
}

// Update UI elements
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('best-score').textContent = bestScore;
    document.getElementById('moves-count').textContent = validFoldCount;
    
    // Warning color for low moves
    const movesElement = document.getElementById('moves-count');
    if (validFoldCount <= 2) {
        movesElement.classList.add('moves-value-warning');
    } else {
        movesElement.classList.remove('moves-value-warning');
    }
}

// Show combo popup
function showComboPopup(combo) {
    const popup = document.createElement('div');
    popup.className = 'combo-popup';
    popup.textContent = `COMBO x${combo}`;
    document.querySelector('.container').appendChild(popup);
    
    setTimeout(() => {
        popup.remove();
    }, 1200);
}

// Show combo burst (for 3+ combos)
function showComboBurst(combo) {
    const container = document.getElementById('combo-container');
    container.innerHTML = `
        <div class="combo-burst ${combo >= 5 ? 'combo-burst-special' : ''}">
            <div class="combo-burst-label">COMBO</div>
            <div class="combo-number-row">
                <div class="combo-burst-number">×${combo}</div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 2000);
}

// Show game over
function showGameOver() {
    document.getElementById('final-score').textContent = `Final Score: ${score}`;
    document.getElementById('game-over-overlay').classList.remove('hidden');
}

// Hide game over
function hideGameOver() {
    document.getElementById('game-over-overlay').classList.add('hidden');
}

// Show retry button
function showRetryButton() {
    document.getElementById('retry-section').classList.remove('hidden');
}

// Hide retry button
function hideRetryButton() {
    document.getElementById('retry-section').classList.add('hidden');
}

// Render board
function render() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';

    // Create cells
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            boardElement.appendChild(cell);
        }
    }

    // Create tiles
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const value = board[row][col];
            if (value !== 0) {
                const tile = document.createElement('div');
                tile.className = `tile tile-${value}`;
                tile.textContent = value;
                
                const cellSize = (boardElement.offsetWidth - 24) / 4; // padding + gaps
                const gap = 8;
                const padding = 12;
                
                tile.style.width = `${cellSize}px`;
                tile.style.height = `${cellSize}px`;
                tile.style.left = `${padding + col * (cellSize + gap)}px`;
                tile.style.top = `${padding + row * (cellSize + gap)}px`;
                
                boardElement.appendChild(tile);
            }
        }
    }

    // Render stars
    const cellSize = (boardElement.offsetWidth - 24) / 4;
    const gap = 8;
    const padding = 12;

    // Normal stars
    starPositions.forEach((star, index) => {
        const starElement = document.createElement('div');
        starElement.className = 'star-marker';
        starElement.style.width = `${cellSize}px`;
        starElement.style.height = `${cellSize}px`;
        starElement.style.left = `${padding + star.col * (cellSize + gap)}px`;
        starElement.style.top = `${padding + star.row * (cellSize + gap)}px`;
        starElement.innerHTML = '<div class="star-text">★</div>';
        boardElement.appendChild(starElement);
    });

    // Gray stars
    grayStars.forEach((star, index) => {
        const starElement = document.createElement('div');
        starElement.className = 'star-marker gray-star-marker';
        starElement.style.width = `${cellSize}px`;
        starElement.style.height = `${cellSize}px`;
        starElement.style.left = `${padding + star.col * (cellSize + gap)}px`;
        starElement.style.top = `${padding + star.row * (cellSize + gap)}px`;
        starElement.innerHTML = '<div class="star-text gray-star-text">★</div>';
        boardElement.appendChild(starElement);
    });
}

// Setup event listeners
function setupEventListeners() {
    const boardElement = document.getElementById('board');
    
    // Touch events
    boardElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    boardElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    boardElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Mouse events for desktop
    boardElement.addEventListener('mousedown', handleMouseDown);
    boardElement.addEventListener('mousemove', handleMouseMove);
    boardElement.addEventListener('mouseup', handleMouseUp);
    boardElement.addEventListener('mouseleave', handleMouseUp);
    
    // Game over close button
    document.getElementById('close-button').addEventListener('click', () => {
        hideGameOver();
        showRetryButton();
    });
    
    // Retry button
    document.getElementById('retry-button').addEventListener('click', resetGame);
    
    // Prevent context menu
    document.addEventListener('contextmenu', e => e.preventDefault());
}

// Touch event handlers
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    activeDirection = null;
    activeDepth = null;
    isCancelled = false;
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance < SWIPE_THRESHOLD) return;
    
    const direction = Math.abs(deltaX) > Math.abs(deltaY) 
        ? (deltaX > 0 ? 'right' : 'left')
        : (deltaY > 0 ? 'bottom' : 'top');
    
    const depth = distance > DEPTH_THRESHOLD ? 2 : 1;
    
    if (distance > CANCEL_THRESHOLD) {
        isCancelled = true;
        render();
        return;
    }
    
    if (!isCancelled) {
        activeDirection = direction;
        activeDepth = depth;
        render();
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (!isCancelled && activeDirection && activeDepth) {
        handleFold(activeDirection, activeDepth);
    }
    activeDirection = null;
    activeDepth = null;
    isCancelled = false;
    render();
}

// Mouse event handlers
function handleMouseDown(e) {
    e.preventDefault();
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    activeDirection = null;
    activeDepth = null;
    isCancelled = false;
}

function handleMouseMove(e) {
    const deltaX = e.clientX - touchStartX;
    const deltaY = e.clientY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance < SWIPE_THRESHOLD) return;
    
    const direction = Math.abs(deltaX) > Math.abs(deltaY) 
        ? (deltaX > 0 ? 'right' : 'left')
        : (deltaY > 0 ? 'bottom' : 'top');
    
    const depth = distance > DEPTH_THRESHOLD ? 2 : 1;
    
    if (distance > CANCEL_THRESHOLD) {
        isCancelled = true;
        render();
        return;
    }
    
    if (!isCancelled) {
        activeDirection = direction;
        activeDepth = depth;
        render();
    }
}

function handleMouseUp(e) {
    if (!isCancelled && activeDirection && activeDepth) {
        handleFold(activeDirection, activeDepth);
    }
    activeDirection = null;
    activeDepth = null;
    isCancelled = false;
    render();
}

// Initialize game when page loads
window.addEventListener('load', init);

// Handle window resize
window.addEventListener('resize', render);
