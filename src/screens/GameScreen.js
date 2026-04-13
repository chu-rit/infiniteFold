import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, SafeAreaView, StatusBar, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence, 
  withTiming, 
  withDelay, 
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { GameBoard } from '../components/GameBoard';
import { initializeBoard, checkGameOver, spawnNewNumber, executeFold } from '../utils/gameLogic';

const { width, height } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width * 0.92, 380);

// Flashy Particle Component
const ComboParticle = ({ index, color }) => {
  const progress = useSharedValue(0);
  const angle = (index * 45) * (Math.PI / 180);
  const distance = 80 + Math.random() * 40;
  
  useEffect(() => {
    progress.value = withTiming(1, { duration: 600 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const x = Math.cos(angle) * distance * progress.value;
    const y = Math.sin(angle) * distance * progress.value;
    return {
      position: 'absolute',
      width: 8,
      height: 8,
      backgroundColor: color,
      borderRadius: 4,
      opacity: 1 - progress.value,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: 1 - progress.value * 0.5 },
      ],
    };
  });

  return <Animated.View style={animatedStyle} />;
};

export default function GameScreen() {
  const [board, setBoard] = useState(() => initializeBoard());
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  
  // Reanimated values
  const comboScale = useSharedValue(0);
  const comboOpacity = useSharedValue(0);
  const [particles, setParticles] = useState([]);
  const particleIdCounter = useRef(0);

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

  // Combo effect - animated show/hide when combo changes
  useEffect(() => {
    if (comboCount > 1) {
      // Trigger Burst Animation
      comboScale.value = 0;
      comboOpacity.value = 1;
      
      comboScale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 100 }),
        withSpring(1.0, { damping: 15, stiffness: 100 })
      );

      // Spawn particles
      const newParticles = Array.from({ length: 8 }).map((_, i) => ({
        id: ++particleIdCounter.current,
        color: comboCount >= 3 ? '#e74c3c' : '#f67c5f'
      }));
      setParticles(prev => [...prev, ...newParticles]);

      // Fade out after delay
      comboOpacity.value = withDelay(800, withTiming(0, { duration: 300 }));
      
      // Cleanup particles after animation
      const timer = setTimeout(() => {
        setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      comboOpacity.value = 0;
      comboScale.value = 0;
    }
  }, [comboCount]);

  const comboAnimatedStyle = useAnimatedStyle(() => ({
    opacity: comboOpacity.value,
    transform: [
      { scale: comboScale.value },
      { rotateZ: `${interpolate(comboScale.value, [0, 1], [-10, 0])}deg` }
    ],
  }));

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
    // 3콤보 이상일 때는 블록 생성 안 함
    if (newCombo < 3) {
      newBoard = spawnNewNumber(newBoard, result.preMergeValues);
    }

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

      {/* Flashy Combo Burst Overlay */}
      <View style={styles.comboOverlayContainer} pointerEvents="none">
        {particles.map(p => (
          <ComboParticle key={p.id} index={p.id % 8} color={p.color} />
        ))}
        <Animated.View style={[
          styles.comboBurst,
          comboCount >= 3 && styles.comboBurstSpecial,
          comboAnimatedStyle
        ]}>
          <Text style={styles.comboBurstLabel}>COMBO</Text>
          <View style={styles.comboNumberRow}>
            <Text style={styles.comboBurstX}>×</Text>
            <Text style={[
              styles.comboBurstNumber,
              comboCount >= 3 && styles.comboBurstNumberSpecial
            ]}>{comboCount}</Text>
          </View>
        </Animated.View>
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

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Swipe to fold • Short: 1-Row • Long: 2-Row
        </Text>
        <Text style={styles.tipText}>
          Always spawns new number after each fold
        </Text>
      </View>
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
  comboOverlayContainer: {
    position: 'absolute',
    top: height * 0.35,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  comboBurst: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboBurstSpecial: {
  },
  comboBurstLabel: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  comboNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: -10,
  },
  comboBurstX: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 8,
    marginRight: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  comboBurstNumber: {
    color: '#fff',
    fontSize: 80,
    fontWeight: '900',
    lineHeight: 88,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
  },
  comboBurstNumberSpecial: {
    color: '#ffeb3b',
    fontSize: 100,
    lineHeight: 110,
    textShadowColor: 'rgba(231, 76, 60, 0.8)',
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
