import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, StatusBar, Platform } from 'react-native';
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
import { initializeBoard, checkGameOver, spawnNewNumber, executeFold, getValidFoldCount } from '../utils/gameLogic';

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
  const [starPositions, setStarPositions] = useState([]);
  const [grayStars, setGrayStars] = useState([]); // 회색 별표 (미리보기만)
  const [validFoldCount, setValidFoldCount] = useState(() => getValidFoldCount(initializeBoard()));
  
  // 별표 위치 생성 함수 (30% 기존 기능, 70% 회색 별표)
  const generateStarPositions = useCallback((currentBoard) => {
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
      // 30%: 기존 기능 있는 별표
      return { stars: [randomPos], grayStars: [] };
    } else {
      // 70%: 회색 별표 (미리보기만)
      return { stars: [], grayStars: [randomPos] };
    }
  }, []);
  
  // Reanimated values
  const comboScale = useSharedValue(0);
  const comboOpacity = useSharedValue(0);
  const [particles, setParticles] = useState([]);
  const particleIdCounter = useRef(0);

  const resetGame = useCallback(() => {
    const newBoard = initializeBoard();
    setBoard(newBoard);
    setScore(0);
    setIsGameOver(false);
    setGameOverDismissed(false);
    setComboCount(0);
    const starResult = generateStarPositions(newBoard);
    setStarPositions(starResult.stars);
    setGrayStars(starResult.grayStars);
    setValidFoldCount(getValidFoldCount(newBoard));
  }, [generateStarPositions]);

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

  // Combo effect - Tetris style popup
  useEffect(() => {
    if (comboCount > 1) {
      // 초기 상태
      comboScale.value = 0.5;
      comboOpacity.value = 0;
      
      // 테트리스 스타일: 크게 등장 → 유지 → 위로 올라가며 사라짐
      comboScale.value = withSequence(
        withTiming(1.2, { duration: 150 }),  // 빠르게 확대
        withTiming(1.0, { duration: 100 }),   // 정상 크기
        withDelay(700, withTiming(0.8, { duration: 200 }))  // 퇴장 전 축소
      );
      
      comboOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),   // 즉시 표시
        withDelay(800, withTiming(0, { duration: 200 }))  // 800ms 후 사라짐
      );

      // Spawn particles
      const newParticles = Array.from({ length: 8 }).map((_, i) => ({
        id: ++particleIdCounter.current,
        color: comboCount >= 3 ? '#e74c3c' : '#f67c5f'
      }));
      setParticles(prev => [...prev, ...newParticles]);

      // Cleanup particles after animation
      const timer = setTimeout(() => {
        setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
      }, 1200);
      
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
      { translateY: interpolate(comboOpacity.value, [1, 0], [0, -30]) },
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

    let newBoard = result.board.map(row => [...row]);
    let newCombo = comboCount;

    if (result.mergeCount > 0) {
      newCombo += 1;
      setComboCount(newCombo);
    } else {
      newCombo = 0;
      setComboCount(0);
    }

    // 별표 처리: 30% 별표만 기능 작동
    let starUpgraded = false;
    if (starPositions.length > 0) {
      // 기존 기능 있는 별표만 처리
      for (const starPos of starPositions) {
        const { row, col } = starPos;
        if (newBoard[row][col] === 0) {
          // 별표 위치가 비어있음 → spawnNewNumber 사용
          newBoard = spawnNewNumber(newBoard, { row, col });
        } else {
          // 별표 위치가 메워짐 → 블록 업그레이드
          newBoard[row][col] *= 2;
          starUpgraded = true;
        }
      }
    } else {
      // 기존 별표가 없거나 회색 별표만 있을 때: 일반적인 블록 생성
      newBoard = spawnNewNumber(newBoard);
    }

    // 다음 턴 별표 위치 생성
    const nextStarResult = generateStarPositions(newBoard);
    setStarPositions(nextStarResult.stars);
    setGrayStars(nextStarResult.grayStars);

    // 콤보 보너스 점수: 1콤보 +2, 2콤보 +4, 3콤보 +8...
    const comboBonus = newCombo > 0 ? Math.pow(2, newCombo) : 0;
    const newScore = score + result.points + comboBonus;
    setScore(newScore);
    if (newScore > bestScore) {
      setBestScore(newScore);
    }

    setBoard(newBoard);

    // 유효한 접기 경우의 수 계산
    const newValidFoldCount = getValidFoldCount(newBoard);
    setValidFoldCount(newValidFoldCount);
    
    if (newValidFoldCount === 0) {
      setIsGameOver(true);
    }

    return { valid: true, mergeCount: result.mergeCount, starUpgraded };
  }, [board, score, bestScore, isGameOver, comboCount, starPositions, generateStarPositions, getValidFoldCount]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8ef" />
      
      <View style={styles.contentWrapper}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>INFINITE</Text>
          <Text style={styles.titleAccent}>FOLD</Text>
        </View>
        
        <View style={styles.scoreBlock}>
          {/* MOVES 박스 - 유효한 접기 경우의 수 */}
          <View style={[styles.scoreBox, styles.movesBox]}>
            <Text style={styles.scoreLabel}>Possible{'\n'}Moves</Text>
            <Text style={[styles.scoreValue, validFoldCount <= 2 && styles.movesValueWarning]}>
              {validFoldCount}
            </Text>
          </View>
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
            ]}>{comboCount - 1}</Text>
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
          starPositions={starPositions}
          grayStars={grayStars}
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

      {/* Retry Button - Below Game Board */}
      {isGameOver && gameOverDismissed && (
        <View style={styles.retrySection}>
          <View style={styles.retryButton} onTouchEnd={resetGame}>
            <Text style={styles.retryIcon}>↻</Text>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </View>
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8ef',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    marginBottom: 20,
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
  movesBox: {
    backgroundColor: '#8f7a66',  // 더 어두운 색상으로 구분
  },
  movesValueWarning: {
    color: '#ff6b6b',  // 남은 횟수 적을 때 경고 색상
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
    justifyContent: 'flex-start',
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
  retrySection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
    gap: 8,
  },
  retryIcon: {
    fontSize: 20,
    color: '#fff',
  },
  retryText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
