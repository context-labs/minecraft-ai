# Minecraft Clone with Three.js

A voxel-based Minecraft clone built using Three.js and TypeScript.

![Minecraft Clone Screenshot](screenshot.png)

## Features

- Procedurally generated terrain with different biomes
- Block breaking and placement
- Player movement with collision detection
- Different block types (grass, dirt, stone, wood, leaves, etc.)
- Basic physics (gravity, jumping)
- First-person camera controls
- Hotbar for block selection
- Debug information display
- Lighting system with shadows

## Prerequisites

- Node.js (v14 or higher)
- Bun or npm

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd minecraft-clone
```

2. Install dependencies:
```bash
bun install
# or
npm install
```

## Running the Game

1. Start the development server:
```bash
bun start
# or
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

## Development

For development with hot reloading:

```bash
bun dev
# or
npm run dev
```

To generate the texture atlas:

```bash
bun generate-textures
# or
npm run generate-textures
```

## Project Structure

```
minecraft-clone/
├── dist/                  # Compiled output
├── public/                # Static assets
│   └── textures/          # Game textures
│       └── atlas.png      # Texture atlas
├── src/
│   ├── core/              # Core game engine
│   │   └── Engine.ts      # Main game engine
│   ├── player/            # Player-related code
│   │   └── Player.ts      # Player controller
│   ├── ui/                # User interface
│   │   └── DebugUI.ts     # Debug information display
│   ├── utils/             # Utility functions
│   │   ├── TextureManager.ts         # Texture management
│   │   └── TextureAtlasGenerator.ts  # Texture atlas generator
│   └── world/             # World generation and management
│       ├── Block.ts       # Block definitions
│       ├── Chunk.ts       # Chunk management
│       └── World.ts       # World generation
├── index.html             # Main HTML file
├── index.ts               # Entry point
├── server.ts              # Development server
├── build.ts               # Build script
├── package.json           # Project configuration
└── README.md              # Project documentation
```

## Controls

- **WASD**: Move
- **Space**: Jump
- **Mouse**: Look around
- **Left Click**: Break block
- **Right Click**: Place block
- **1-6 Keys**: Select block type
- **Mouse Wheel**: Cycle through block types
- **ESC**: Release mouse pointer

## How It Works

The game is built using the following components:

- **Engine**: Main game engine that manages the scene, camera, and game loop
- **World**: Manages chunks and terrain generation
- **Chunk**: Represents a 16x16x16 section of blocks
- **Block**: Defines different block types and their properties
- **Player**: Handles player movement and interaction
- **TextureManager**: Manages block textures and UV mapping
- **DebugUI**: Displays debug information

## Technical Notes

- The project uses Three.js as a dependency installed via npm
- Custom PointerLockControls implementation for better compatibility
- Fallback texture generation if atlas.png is not available
- Debug logging added to help diagnose rendering issues
- Enhanced lighting with ambient and directional lights

## Performance Considerations

- Chunks are only rendered when visible
- Only visible faces of blocks are rendered
- Chunks are loaded/unloaded based on player position
- Frustum culling is used to avoid rendering off-screen objects

## Future Improvements

- Multiplayer support
- Inventory system
- Crafting
- More block types
- Day/night cycle
- Mobs and creatures
- Saving/loading worlds

## License

MIT
