# Minecraft Clone with Three.js

A voxel-based Minecraft clone built using Three.js and TypeScript. View demo [here](https://x.com/0xSamHogan/status/1895954338876703115).

![Minecraft Clone Screenshot](/public/images/demo.png)

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
- Dynamic day-night cycle with sun and moon
- Flight mode (double-tap space to toggle)

## Prerequisites

- [Bun](https://bun.sh/) (recommended)
- Modern web browser with WebGL support

## Installation

1. Clone the repository:
```bash
git clone https://github.com/context-labs/minecraft-ai
cd minecraft-ai
```

2. Install dependencies:
```bash
bun install
# or
npm install
```

## Running the Game

1. Build and start the server:
```bash
bun start
```
This command will build the project and start the server.

2. Open your browser and navigate to `http://localhost:3000`

## Development

For development with hot reloading:

```bash
bun dev
```
This will start the development server with automatic reloading when files change.

To build the project without starting the server:

```bash
bun build
```

To generate the texture atlas:

```bash
bun generate-textures
```

## Project Structure

```
minecraft-clone/
├── dist/                  # Compiled output
├── public/                # Static assets
│   └── textures/          # Game textures
│       └── atlas.png      # Texture atlas
├── src/
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

- **World**: Manages chunks and terrain generation
- **Chunk**: Represents a 16x16x16 section of blocks
- **Block**: Defines different block types and their properties
- **Player**: Handles player movement and interaction
- **TextureManager**: Manages block textures and UV mapping
- **DebugUI**: Displays debug information

## Technical Notes

- The project uses Three.js for 3D rendering
- Custom PointerLockControls implementation for camera control
- Optimized chunk rendering with geometry instancing
- Collision detection for player movement
- Raycasting for block selection and interaction

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
