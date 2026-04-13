# Infinite Fold

A 4x4 logic puzzle game where players fold the grid to merge identical numbers based on symmetry.

🎮 **[Play Online](https://[your-username].github.io/infiniteFold/)** - Play directly in your browser!

## Features

- **Folding Mechanics**: Fold the board from any of the 4 edges (Top, Bottom, Left, Right)
  - **1-Row Fold (Short Swipe)**: Fold only the outermost row/column
  - **2-Row Fold (Long Swipe)**: Fold the board exactly in half
- **Real-time Preview**: Ghost numbers appear on target cells during swipe
- **Visual Feedback**: 
  - Merged results shown with semi-transparent state
  - Invalid moves highlight mismatching cells in red
- **Combo System**: Merging numbers prevents new number spawning for that turn
- **Game Over Detection**: "Deadlocked" when no more moves are possible

## Tech Stack

- **React Native** with **Expo** - Cross-platform (Web, iOS, Android)
- **React Native Gesture Handler** - Swipe/pan handling
- **React Native Reanimated** - Smooth animations

## Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

## Running on Different Platforms

```bash
# Web
npm run web

# iOS (requires macOS and Xcode)
npm run ios

# Android (requires Android Studio)
npm run android
```

## Game Rules

1. **Initial State**: Board starts with four `2`s in the center 2×2 area
2. **Folding**: Swipe in any direction to fold the board
   - Short swipe = 1-Row fold
   - Long swipe = 2-Row fold
3. **Merge Rules**:
   - If Source == Target → Merge into Source × 2
   - If Target == 0 → Source moves to Target
   - If Source != Target and Target != 0 → **Invalid move** (entire fold blocked)
4. **Spawning**:
   - No merges → New `2` spawns in random empty cell
   - At least one merge → No spawn (combo reward)
5. **Game Over**: When all 8 possible moves (4 directions × 2 depths) are invalid

## Project Structure

```
infiniteFold/
├── App.js                 # Main app component (React Native)
├── components/            # React Native components
│   ├── GameBoard.js       # Board with gesture handling
│   └── Tile.js            # Individual tile component
├── utils/
│   └── gameLogic.js       # Core game logic
├── docs/                  # Web version for GitHub Pages
│   ├── index.html         # Entry point
│   └── src/
│       ├── app.js         # Web game logic
│       └── game-logic.js  # Core game logic (vanilla JS)
├── assets/                # Images and assets
├── app.json               # Expo configuration
├── babel.config.js        # Babel configuration
└── package.json           # Dependencies
```

## Deploy to GitHub Pages

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/[your-username]/infiniteFold.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` / `docs` folder
   - Click Save

3. **Access your game**
   - Wait 1-2 minutes
   - Visit: `https://[your-username].github.io/infiniteFold/`

## License

MIT
