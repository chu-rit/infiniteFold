import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, SafeAreaView, StatusBar, Platform } from 'react-native';
import { GameBoard } from '../components/GameBoard';
import { initializeBoard, checkGameOver, spawnNewNumber, executeFold } from '../utils/gameLogic';

const { width, height } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width * 0.92, 380);

export default function GameScreen() {
  const [board, setBoard] = useState(() => initializeBoard());
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  const [comboCount, setComboCount] = useState(0);

  const resetGame = useCallback(() => {
    setBoard(initializeBoard());
    setScore(0);
    setIsGameOver(false);
    setGameOverDismissed(false);
    setComboCount(0);
  }, []);

  const dismissGameOver = useCallback(() => {
    setGameOverDismissed(true);
  }, []);

  // 웹 환경에서 컨텍스트 메뉴 비활성화
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preventContextMenu = (e) => {
        e.preventDefault();
        return false;
      };
      document.addEventListener('contextmenu', preventContextMenu);
      return () => document.removeEventListener('contextmenu', preventContextMenu);
    }
  }, []);

  const handleFold = useCallback((direction, depth) => {
    const result = executeFold(board, direction, depth);
    
    if (result.mismatches.length > 0) {
      return { valid: false, mismatches: result.mismatches };
    }

    // 게임 오버 상태에서는 피드백만 제공하고 상태는 변경하지 않음
    if (isGameOver) {
      return { valid: true, mergeCount: result.mergeCount, gameOver: true };
    }

    let newBoard = result.board;
    let newCombo = comboCount;

    if (result.mergeCount > 0) {
      newCombo += 1;
      setComboCount(newCombo);
    } else {
      newCombo = 0;
      setComboCount(0);
    }
    newBoard = spawnNewNumber(newBoard);

    const newScore = score + result.points;
    setScore(newScore);
    if (newScore > bestScore) {
      setBestScore(newScore);
    }

    setBoard(newBoard);

    if (checkGameOver(newBoard)) {
      setIsGameOver(true);
    }

    return { valid: true, mergeCount: result.mergeCount };
  }, [board, score, bestScore, isGameOver, comboCount]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8ef" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>INFINITE</Text>
          <Text style={styles.titleAccent}>FOLD</Text>
        </View>
        
        <View style={styles.scoreBlock}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>BEST</Text>
            <Text style={styles.scoreValue}>{bestScore}</Text>
          </View>
        </View>
      </View>

      {/* Combo Indicator - absolute positioned to prevent layout shift */}
      <View style={[styles.comboBar, comboCount === 0 && styles.comboBarHidden]}>
        <Text style={styles.comboText}>🔥 COMBO ×{comboCount > 0 ? comboCount : 1}</Text>
      </View>

      {/* Game Board */}
      <View style={styles.boardContainer}>
        <GameBoard 
          board={board}
          size={BOARD_SIZE}
          onFold={handleFold}
          isGameOver={isGameOver}
        />
      </View>

      {/* Game Over Popup - with close button only */}
      {isGameOver && !gameOverDismissed && (
        <View style={styles.overlay}>
          <View style={styles.gameOverCard}>
            <Text style={styles.gameOverTitle}>DEADLOCKED</Text>
            <Text style={styles.gameOverMessage}>No more valid moves!</Text>
            <Text style={styles.gameOverScore}>Final Score: {score}</Text>
            <View style={styles.closeButton} onTouchEnd={dismissGameOver}>
              <Text style={styles.closeButtonText}>✕ CLOSE</Text>
            </View>
          </View>
        </View>
      )}

      {/* Retry Button - appears after dismissing popup */}
      {isGameOver && gameOverDismissed && (
        <View style={styles.retryBar}>
          <View style={styles.retryButton} onTouchEnd={resetGame}>
            <Text style={styles.retryButtonText}>🔄 TRY AGAIN</Text>
          </View>
        </View>
      )}

          </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8ef',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleBlock: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#776e65',  // Dark brown text
    letterSpacing: 2,
    lineHeight: 32,
  },
  titleAccent: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f65e3b',  // Orange accent
    letterSpacing: 2,
    lineHeight: 32,
  },
  scoreBlock: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreBox: {
    backgroundColor: '#bbada0',  // Brown-gray score box
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  scoreLabel: {
    fontSize: 10,
    color: '#eee4da',
    fontWeight: '600',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  comboBar: {
    backgroundColor: '#f67c5f',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    position: 'absolute',
    top: 120, // Fixed position below score header
    left: 16,
    right: 16,
    zIndex: 10,
  },
  comboBarHidden: {
    opacity: 0,
  },
  comboText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(238, 228, 218, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  gameOverCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  gameOverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 8,
  },
  gameOverMessage: {
    fontSize: 14,
    color: '#776e65',
    marginBottom: 8,
  },
  gameOverScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f67c5f',
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: '#8f7a66',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  retryBar: {
    backgroundColor: '#f65e3b',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButton: {
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  instructions: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 13,
    color: '#776e65',
    textAlign: 'center',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: '#f65e3b',
    textAlign: 'center',
  },
});
