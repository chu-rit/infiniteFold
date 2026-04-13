import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';

const TILE_COLORS = {
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
};

const getColors = (value) => TILE_COLORS[value] || { bg: '#3c3a32', text: '#f9f6f2' };

export function Tile({ value, row, col, cellSize, gap, padding, isGhost = false, isMerge = false, isMismatch = false, isAffected = false, onPress }) {
  const colors = getColors(value);
  
  // Unified positioning: padding + index * (size + gap)
  const position = {
    position: 'absolute',
    left: padding + col * (cellSize + gap),
    top: padding + row * (cellSize + gap),
    width: cellSize,
    height: cellSize,
  };

  const fontSize = value >= 1000 ? cellSize * 0.28 : 
                   value >= 100 ? cellSize * 0.35 : 
                   cellSize * 0.5;

  const tileContent = (
    <>
      <Text style={[styles.text, { color: colors.text, fontSize }]}>
        {value}
      </Text>
      {isGhost && isMerge && (
        <View style={styles.mergeBadge}>
          <Text style={styles.mergeText}>×2</Text>
        </View>
      )}
    </>
  );

  if (onPress && !isGhost) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          position,
          {
            backgroundColor: isMismatch ? '#e94560' : colors.bg,
            borderWidth: (pressed || isAffected) ? 3 : 0,
            borderColor: '#edc22e',
          },
        ]}
      >
        {tileContent}
      </Pressable>
    );
  }

  return (
    <View style={[
      styles.tile,
      position,
      {
        backgroundColor: isMismatch ? '#e94560' : colors.bg,
        opacity: isGhost ? (isMerge ? 0.8 : 0.4) : 1,
        borderWidth: isGhost ? 2 : (isAffected ? 3 : 0),
        borderColor: isGhost ? (isMerge ? '#4ecca3' : '#fff') : '#edc22e',
        transform: [{ scale: isGhost ? 1.05 : 1 }],
      },
    ]}>
      {tileContent}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontWeight: 'bold',
  },
  mergeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#4ecca3',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  mergeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
});
