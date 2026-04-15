import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Tile } from './Tile';
import { getFoldPreview, DIRECTIONS } from '../utils/gameLogic';

const SWIPE_THRESHOLD = 20;
const DEPTH_THRESHOLD = 80;
const CANCEL_THRESHOLD = 180; // Swipe beyond board size to cancel

// Fixed constants for perfect alignment
const GAP = 8;
const PADDING = 12;

export function GameBoard({ board, size, onFold, isGameOver, starPositions, grayStars }) {
  const [preview, setPreview] = useState({ valid: true, ghosts: [], mismatches: [] });
  const [activeDirection, setActiveDirection] = useState(null);
  const [activeDepth, setActiveDepth] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null); // {row, col}
  const [isCancelled, setIsCancelled] = useState(false);
  const isCancelledRef = useRef(false);

  // Track touch start position for depth determination
  const startPositionRef = useRef({ x: 0, y: 0 });

  // Calculate cell size: (total - padding*2 - gap*3) / 4
  const cellSize = (size - PADDING * 2 - GAP * 3) / 4;

  const getDirectionFromOffset = useCallback((dx, dy) => {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return null;
    
    // Swipe direction = fold edge
    if (absDx > absDy) {
      return dx > 0 ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
    }
    return dy > 0 ? DIRECTIONS.TOP : DIRECTIONS.BOTTOM;
  }, []);

  // Check if start position is in center cells (1,1), (1,2), (2,1), (2,2)
  const isCenterStart = useCallback((x, y) => {
    const cellWithGap = cellSize + GAP;
    const col = Math.floor((x - PADDING + GAP/2) / cellWithGap);
    const row = Math.floor((y - PADDING + GAP/2) / cellWithGap);
    const clampedCol = Math.max(0, Math.min(3, col));
    const clampedRow = Math.max(0, Math.min(3, row));
    return (clampedRow === 1 || clampedRow === 2) && (clampedCol === 1 || clampedCol === 2);
  }, [cellSize]);
  
  const getDepthFromOffset = useCallback((dx, dy, startX, startY) => {
    const maxOffset = Math.max(Math.abs(dx), Math.abs(dy));
    
    // Cancel if swiped beyond board
    if (maxOffset > CANCEL_THRESHOLD) return 'cancel';
    
    if (maxOffset < SWIPE_THRESHOLD) return null;
    
    // Determine base depth from start position
    const baseDepth = isCenterStart(startX, startY) ? 2 : 1;
    
    if (baseDepth === 2) return 2;
    
    // Outer start: check if long enough for 2-row fold
    return maxOffset < DEPTH_THRESHOLD ? 1 : 2;
  }, [cellSize]);

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .activeOffsetX([-5, 5])
    .activeOffsetY([-5, 5])
    .onBegin((event) => {
      // Store starting position relative to board
      startPositionRef.current = { x: event.x, y: event.y };
      isCancelledRef.current = false;
      setIsCancelled(false);
    })
    .onUpdate((event) => {
      // Clear selection when starting to swipe
      if (selectedTile && Math.abs(event.translationX) + Math.abs(event.translationY) > 10) {
        setSelectedTile(null);
      }
      
      const direction = getDirectionFromOffset(event.translationX, event.translationY);
      const depth = getDepthFromOffset(
        event.translationX, 
        event.translationY,
        startPositionRef.current.x,
        startPositionRef.current.y
      );
      
      // Check for cancellation - once cancelled, stay cancelled until gesture ends
      if (depth === 'cancel' || isCancelledRef.current) {
        if (!isCancelledRef.current) {
          isCancelledRef.current = true;
          setIsCancelled(true);
        }
        setActiveDirection(null);
        setActiveDepth(null);
        setPreview({ valid: true, ghosts: [], mismatches: [] });
        return;
      }
      
      if (direction !== activeDirection || depth !== activeDepth) {
        setActiveDirection(direction);
        setActiveDepth(depth);
        
        if (direction && depth && depth !== 'cancel') {
          const previewResult = getFoldPreview(board, direction, depth);
          setPreview(previewResult);
        } else {
          setPreview({ valid: true, ghosts: [], mismatches: [] });
        }
      }
    })
    .onEnd((event) => {
      if (isCancelledRef.current) {
        setActiveDirection(null);
        setActiveDepth(null);
        isCancelledRef.current = false;
        setIsCancelled(false);
        setPreview({ valid: true, ghosts: [], mismatches: [] });
        return;
      }
      
      const direction = getDirectionFromOffset(event.translationX, event.translationY);
      const depth = getDepthFromOffset(
        event.translationX, 
        event.translationY,
        startPositionRef.current.x,
        startPositionRef.current.y
      );
      
      // Check preview validity - don't execute if empty or invalid
      const previewResult = (direction && depth && depth !== 'cancel') 
        ? getFoldPreview(board, direction, depth)
        : { valid: false, isEmpty: false };
      
      if (direction && depth && depth !== 'cancel' && previewResult.valid && !previewResult.isEmpty) {
        onFold(direction, depth);
      }
      
      setActiveDirection(null);
      setActiveDepth(null);
      isCancelledRef.current = false;
      setIsCancelled(false);
      setPreview({ valid: true, ghosts: [], mismatches: [] });
    });

  const getGhostForCell = (row, col) => {
    return preview.ghosts.find(g => g.row === row && g.col === col);
  };

  const isMismatchCell = (row, col) => {
    return preview.mismatches.some(m => 
      (m.row === row && m.col === col) || 
      (m.targetRow === row && m.targetCol === col)
    );
  };

  // Get affected rows/cols for highlighting
  const getAffectedCells = () => {
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
  };
  
  const affectedCells = getAffectedCells();
  const isAffectedCell = (row, col) => affectedCells.some(c => c.row === row && c.col === col);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={styles.boardContent}>
          {/* Background cells */}
          {Array(4).fill(null).map((_, row) =>
            Array(4).fill(null).map((_, col) => {
              const isAffected = isAffectedCell(row, col);
              return (
                <View
                  key={`cell-${row}-${col}`}
                  style={[
                    styles.cell,
                    isAffected && !activeDirection && styles.affectedCell,
                    {
                      width: cellSize,
                      height: cellSize,
                      left: PADDING + col * (cellSize + GAP),
                      top: PADDING + row * (cellSize + GAP),
                    },
                  ]}
                />
              );
            })
          )}
          
          {/* Unified fold area border during swipe */}
          {activeDirection && activeDepth && (
            <View style={[
              styles.foldAreaBorder,
              activeDirection === DIRECTIONS.TOP && {
                top: PADDING,
                left: PADDING,
                right: PADDING,
                height: activeDepth * cellSize + (activeDepth - 1) * GAP,
              },
              activeDirection === DIRECTIONS.BOTTOM && {
                bottom: PADDING,
                left: PADDING,
                right: PADDING,
                height: activeDepth * cellSize + (activeDepth - 1) * GAP,
              },
              activeDirection === DIRECTIONS.LEFT && {
                left: PADDING,
                top: PADDING,
                bottom: PADDING,
                width: activeDepth * cellSize + (activeDepth - 1) * GAP,
              },
              activeDirection === DIRECTIONS.RIGHT && {
                right: PADDING,
                top: PADDING,
                bottom: PADDING,
                width: activeDepth * cellSize + (activeDepth - 1) * GAP,
              },
            ]} />
          )}

          {/* Tiles */}
          {board.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              if (value === 0) return null;
              const isAffected = isAffectedCell(rowIndex, colIndex);
              return (
                <Tile
                  key={`tile-${rowIndex}-${colIndex}`}
                  value={value}
                  row={rowIndex}
                  col={colIndex}
                  cellSize={cellSize}
                  gap={GAP}
                  padding={PADDING}
                  isMismatch={isMismatchCell(rowIndex, colIndex)}
                  isAffected={isAffected}
                  onPress={() => setSelectedTile({ row: rowIndex, col: colIndex })}
                />
              );
            })
          )}
          
          {/* Ghost/Preview Tiles */}
          {preview.valid && preview.ghosts.map((ghost, index) => (
            <Tile
              key={`ghost-${index}`}
              value={ghost.value}
              row={ghost.row}
              col={ghost.col}
              cellSize={cellSize}
              gap={GAP}
              padding={PADDING}
              isGhost={true}
              isMerge={ghost.isMerge}
            />
          ))}
          
          {/* Star Markers - indicating next spawn/upgrade position */}
          {starPositions && starPositions.map((star, index) => (
            <View
              key={`star-${index}`}
              style={[
                styles.starMarker,
                {
                  width: cellSize,
                  height: cellSize,
                  left: PADDING + star.col * (cellSize + GAP),
                  top: PADDING + star.row * (cellSize + GAP),
                },
              ]}
            >
              <Text style={styles.starText}>★</Text>
            </View>
          ))}
          
          {/* Gray Stars - preview only */}
          {grayStars && grayStars.map((star, index) => (
            <View
              key={`gray-star-${index}`}
              style={[
                styles.starMarker,
                styles.grayStarMarker,
                {
                  width: cellSize,
                  height: cellSize,
                  left: PADDING + star.col * (cellSize + GAP),
                  top: PADDING + star.row * (cellSize + GAP),
                },
              ]}
            >
              <Text style={[styles.starText, styles.grayStarText]}>★</Text>
            </View>
          ))}
        </View>

        {/* Fold Direction Arrow */}
        {activeDirection && activeDepth && !isCancelled && (
          <View style={[
            styles.foldArrowOverlay,
            activeDirection === DIRECTIONS.TOP && {
              top: PADDING + activeDepth * cellSize + (activeDepth - 1) * GAP,
              left: 0,
              right: 0,
              alignItems: 'center',
            },
            activeDirection === DIRECTIONS.BOTTOM && {
              bottom: PADDING + activeDepth * cellSize + (activeDepth - 1) * GAP,
              left: 0,
              right: 0,
              alignItems: 'center',
            },
            activeDirection === DIRECTIONS.LEFT && {
              left: PADDING + activeDepth * cellSize + (activeDepth - 1) * GAP,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            },
            activeDirection === DIRECTIONS.RIGHT && {
              right: PADDING + activeDepth * cellSize + (activeDepth - 1) * GAP,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            },
          ]}>
            <Text style={[
              styles.foldArrow,
              { color: preview.valid ? '#4ecca3' : '#ff4444' }
            ]}>
              {activeDirection === DIRECTIONS.TOP && '▼'}
              {activeDirection === DIRECTIONS.BOTTOM && '▲'}
              {activeDirection === DIRECTIONS.LEFT && '▶'}
              {activeDirection === DIRECTIONS.RIGHT && '◀'}
            </Text>
          </View>
        )}

        {/* Cancelled / Empty Overlay */}
        {(isCancelled || preview.isEmpty) && (
          <View style={[styles.directionOverlay, styles.messageOverlay]}>
            <Text style={styles.messageText}>
              {isCancelled ? 'CANCELLED' : 'EMPTY'}
            </Text>
          </View>
        )}

        {/* Invalid Move Warning */}
        {!preview.valid && !preview.isEmpty && (
          <View style={styles.warningOverlay}>
            <Text style={styles.warningText}>✕ BLOCKED</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#bbada0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  boardContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cell: {
    position: 'absolute',
    backgroundColor: 'rgba(238, 228, 218, 0.35)',
    borderRadius: 6,
  },
  affectedCell: {
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#edc22e',
  },
  foldAreaBorder: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#edc22e',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  foldArrowOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  foldArrow: {
    fontSize: 32,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  starMarker: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 6,
  },
  starText: {
    fontSize: 32,
    color: '#edc22e',
    opacity: 0.8,
  },
  grayStarMarker: {
    opacity: 0.4,
  },
  grayStarText: {
    color: '#999',
    opacity: 0.5,
  },
  directionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  messageOverlay: {
    backgroundColor: 'rgba(100, 100, 100, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  warningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 100, 100, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  warningText: {
    color: '#ff4444',
    fontWeight: 'bold',
    fontSize: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyOverlay: {
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  emptyText: {
    color: '#999',
    fontWeight: 'bold',
    fontSize: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
