import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, SafeAreaView, StatusBar, Platform, Animated } from 'react-native';
import { GameBoard } from '../components/GameBoard';
import { initializeBoard, checkGameOver, spawnNewNumber, executeFold, getPossibleMovesCount } from '../utils/gameLogic';

const { width, height } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width * 0.92, 380);

export default function GameScreen() {
  const [board, setBoard] = useState(() => initializeBoard());
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [possibleMoves, setPossibleMoves] = useState(getPossibleMovesCount(initializeBoard()));
  const comboAnim = useRef(new Animated.Value(0)).current;
  const comboTimerRef = useRef(null);

  const resetGame = useCallback(() => {
    const newBoard = initializeBoard();
    setBoard(newBoard);
    setScore(0);
    setIsGameOver(false);
    setGameOverDismissed(false);
    setComboCount(0);
    setShowCombo(false);
    setPossibleMoves(getPossibleMovesCount(newBoard));
  }, []);

  const dismissGameOver = useCallback(() => {
    setGameOverDismissed(true);
  }, []);

  const triggerComboEffect = useCallback((count) => {
    // 이전 애니메이션 중단
    comboAnim.stopAnimation();
    
    setShowCombo(true);
    comboAnim.setValue(0);
    
    Animated.sequence([
      Animated.spring(comboAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 100,
      }),
      Animated.timing(comboAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCombo(false);
    });
  }, [comboAnim]);

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
    const prevComboCount = comboCount;

    if (result.mergeCount > 0) {
      const newCombo = comboCount + 1;
      setComboCount(newCombo);
      // 2번 연속부터 콤보 효과 (1콤보로 표시)
      if (newCombo >= 2) {
        triggerComboEffect(newCombo);
      }
    } else {
      setComboCount(0);
      setShowCombo(false);
    }
    
    // 이전 턴에 콤보가 없었거나(0), 이번 턴에 머지가 없었으면 새 블럭 생성
    if (prevComboCount < 1 || result.mergeCount === 0) {
      newBoard = spawnNewNumber(newBoard);
    }

    const newScore = score + result.points;
    setScore(newScore);
    if (newScore > bestScore) {
      setBestScore(newScore);
    }

    setBoard(newBoard);
    setPossibleMoves(getPossibleMovesCount(newBoard));

    if (checkGameOver(newBoard)) {
      setIsGameOver(true);
    }

    return { valid: true, mergeCount: result.mergeCount };
  }, [board, score, bestScore, isGameOver, comboCount]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8ef" />
      
      {/* Combo Effect - Tetris Style */}
      {showCombo && comboCount >= 2 && (
        <Animated.View 
          style={[
            styles.comboEffect,
            {
              opacity: comboAnim,
              transform: [
                { scale: comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) },
                { translateY: comboAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) },
              ],
            },
          ]}
        >
          <Text style={styles.comboEffectText}>COMBO</Text>
          <Text style={styles.comboEffectNumber}>×{comboCount - 1}</Text>
        </Animated.View>
      )}

      {/* Game Board Container with Header */}
      <View style={styles.boardContainer}>
        <View style={styles.headerRow}>
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
            <View style={[styles.scoreBox, styles.movesBox]}>
              <Text style={styles.scoreLabel}>Possible{'\n'}Moves</Text>
              <Text style={styles.scoreValue}>{possibleMoves}</Text>
            </View>
          </View>
        </View>

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
    maxWidth: 430,
    alignSelf: 'center',
    width: '100%',
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
  movesBox: {
    backgroundColor: '#8f7a66',
  },
  comboEffect: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    pointerEvents: 'none',
  },
  comboEffectText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f67c5f',
    textShadowColor: 'rgba(246, 124, 95, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 4,
  },
  comboEffectNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#f65e3b',
    textShadowColor: 'rgba(246, 94, 59, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
    marginTop: -5,
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    paddingBottom: 12,
    marginTop: -40,
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 50,
  },
  retryButton: {
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
