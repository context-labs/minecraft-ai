import { serve } from 'bun';
import { join } from 'path';
import { readFileSync } from 'fs';
import type { ServerWebSocket } from "bun";

// Game state types
interface Player {
    id: string;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number };
    selectedBlockType: number;
    username: string;
}

interface GameState {
    players: Map<string, Player>;
    worldUpdates: Array<{
        position: { x: number, y: number, z: number };
        blockType: number;
        timestamp: number;
    }>;
    currentWorldState: Map<string, {
        blockType: number;
        timestamp: number;
    }>;
    worldSeed: number;
}

// Add a constant for world generation parameters
const WORLD_SIZE = 10; // Number of chunks in each direction from origin
const WORLD_HEIGHT = 8; // Number of vertical chunks

// Add a map to store pre-generated chunks
const worldChunks: Map<string, Array<{ x: number, y: number, z: number, type: number }>> = new Map();

// Add a function to get chunk key
function getChunkKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

// Initialize game state with a fixed seed
const gameState: GameState = {
    players: new Map<string, Player>(),
    worldUpdates: [],
    currentWorldState: new Map<string, {
        blockType: number;
        timestamp: number;
    }>(),
    worldSeed: 12345 // Fixed seed for consistent generation
};

// Generate the entire world at server startup
function generateWorld() {
    console.log("Generating world on server with seed:", gameState.worldSeed);
    
    // Generate chunks in a square around origin
    for (let x = -WORLD_SIZE; x <= WORLD_SIZE; x++) {
        for (let z = -WORLD_SIZE; z <= WORLD_SIZE; z++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                const chunkKey = getChunkKey(x, y, z);
                const chunkData = generateChunkData(x, y, z);
                worldChunks.set(chunkKey, chunkData);
                
                // Log progress periodically
                if ((x + WORLD_SIZE) % 5 === 0 && (z + WORLD_SIZE) % 5 === 0 && y === 0) {
                    console.log(`Generated chunk at (${x}, ${y}, ${z})`);
                }
            }
        }
    }
    
    console.log(`World generation complete. Generated ${worldChunks.size} chunks.`);
}

// Call world generation at startup
generateWorld();

// Helper functions for position conversions
function positionToKey(position: { x: number, y: number, z: number }): string {
    return `${position.x},${position.y},${position.z}`;
}

function keyToPosition(key: string): { x: number, y: number, z: number } {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
}

// Add constants for distance-based updates
const MAX_BLOCK_UPDATE_DISTANCE = 500; // Increased from 200 to 500 for larger view distance

// Define a constant spawn point for players
const SPAWN_POINT = { x: 0, y: 48, z: 0 };

// Define content types
const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Message types
enum MessageType {
    JOIN = 'join',
    LEAVE = 'leave',
    PLAYER_UPDATE = 'player_update',
    BLOCK_UPDATE = 'block_update',
    INITIAL_STATE = 'initial_state',
    WORLD_STATE = 'world_state',
    CHAT = 'chat',
    CHUNK_REQUEST = 'chunk_request',
    CHUNK_DATA = 'chunk_data'
}

interface Message {
    type: MessageType;
    data: any;
}

// WebSocket connections
const connections = new Map<string, ServerWebSocket<{ id: string }>>();

// Create server
const server = serve({
    port: 3000,
    fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname;
        
        // Handle WebSocket upgrade
        if (path === '/ws') {
            const success: boolean = server.upgrade(req, {
                data: { id: crypto.randomUUID() }
            });
            return success ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
        }
        
        // Default to index.html for root path
        if (path === '/') {
            path = '/index.html';
        }
        
        try {
            // Determine file path
            let filePath: string;
            
            if (path.startsWith('/dist/')) {
                // Serve from dist directory
                filePath = join(process.cwd(), path);
            } else if (path === '/index.html') {
                // Serve index.html from root
                filePath = join(process.cwd(), 'index.html');
            } else if (path.startsWith('/textures/')) {
                // Serve textures from public directory
                filePath = join(process.cwd(), 'public', path);
            } else {
                // Serve other static files from public directory
                filePath = join(process.cwd(), 'public', path);
            }
            
            // Read file
            const file = readFileSync(filePath);
            
            // Determine content type
            const ext = path.substring(path.lastIndexOf('.'));
            const contentType = contentTypes[ext] || 'application/octet-stream';
            
            // Return response
            return new Response(file, {
                headers: {
                    'Content-Type': contentType
                }
            });
        } catch (error) {
            // Return 404 for file not found
            return new Response('Not Found', {
                status: 404
            });
        }
    },
    // WebSocket event handlers
    websocket: {
        open(ws: ServerWebSocket<{ id: string }>) {
            const playerId = ws.data.id;
            console.log(`Player ${playerId} connected`);
            
            // Store connection
            connections.set(playerId, ws);
            
            // Initialize player in game state with fixed spawn point
            gameState.players.set(playerId, {
                id: playerId,
                position: { ...SPAWN_POINT },  // Use the fixed spawn point
                rotation: { x: 0, y: 0 },
                selectedBlockType: 0,
                username: `Player-${playerId.substring(0, 4)}`
            });
            
            // Send initial state to new player
            sendInitialState(ws, playerId);
            
            // Broadcast join event to all other players
            broadcastPlayerJoin(playerId);
        },
        message(ws, message) {
            try {
                const parsedMessage = JSON.parse(message as string) as Message;
                const playerId = ws.data.id;
                
                switch (parsedMessage.type) {
                    case MessageType.PLAYER_UPDATE:
                        handlePlayerUpdate(playerId, parsedMessage.data);
                        break;
                    case MessageType.BLOCK_UPDATE:
                        handleBlockUpdate(playerId, parsedMessage.data);
                        break;
                    case MessageType.CHAT:
                        broadcastChatMessage(playerId, parsedMessage.data);
                        break;
                    case MessageType.CHUNK_REQUEST:
                        handleChunkRequest(ws, parsedMessage.data);
                        break;
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        },
        close(ws) {
            const playerId = ws.data.id;
            console.log(`Player ${playerId} disconnected`);
            
            // Remove player from game state
            gameState.players.delete(playerId);
            
            // Remove connection
            connections.delete(playerId);
            
            // Broadcast leave event
            broadcastPlayerLeave(playerId);
        }
    }
});

// Send initial state to a new player
function sendInitialState(ws: ServerWebSocket<{ id: string }>, playerId: string) {
    console.log(`Sending initial state to player ${playerId}`);
    
    // Create array of initial players (excluding the new player)
    const initialPlayers = [];
    for (const [id, player] of gameState.players.entries()) {
        if (id !== playerId) {
            initialPlayers.push(player);
        }
    }
    
    // Convert the current world state to an array of objects for JSON
    const worldState = {};
    for (const [posKey, blockData] of gameState.currentWorldState.entries()) {
        worldState[posKey] = {
            blockType: blockData.blockType,
            timestamp: blockData.timestamp
        };
    }
    
    // Send the initial state message
    ws.send(JSON.stringify({
        type: MessageType.INITIAL_STATE,
        data: {
            playerId,
            players: initialPlayers,
            worldState,
            worldSeed: gameState.worldSeed,
            timestamp: Date.now()
        }
    }));
}

// Broadcast player join to all other players
function broadcastPlayerJoin(newPlayerId: string) {
    const player = gameState.players.get(newPlayerId);
    if (!player) return;

    const timestamp = Date.now();
    console.log(`[${new Date(timestamp).toISOString()}] Broadcasting player join: ${player.username} (${newPlayerId})`);

    for (const [playerId, ws] of connections.entries()) {
        if (playerId !== newPlayerId) {
            ws.send(JSON.stringify({
                type: MessageType.JOIN,
                data: {
                    ...player,
                    timestamp
                }
            }));
        }
    }
}

// Broadcast player leave to all other players
function broadcastPlayerLeave(playerId: string) {
    const timestamp = Date.now();
    console.log(`[${new Date(timestamp).toISOString()}] Broadcasting player leave: ${playerId}`);

    for (const [id, ws] of connections.entries()) {
        if (id !== playerId) {
            ws.send(JSON.stringify({
                type: MessageType.LEAVE,
                data: { 
                    id: playerId,
                    timestamp
                }
            }));
        }
    }
}

// Handle player position/rotation update
function handlePlayerUpdate(playerId: string, data: any) {
    const player = gameState.players.get(playerId);
    if (!player) return;

    // Update player state
    player.position = data.position || player.position;
    player.rotation = data.rotation || player.rotation;
    player.selectedBlockType = data.selectedBlockType ?? player.selectedBlockType;

    const timestamp = Date.now();
    console.log(`[${new Date(timestamp).toISOString()}] Broadcasting player update from player ${playerId}:`, {
        position: player.position,
        rotation: player.rotation,
        selectedBlockType: player.selectedBlockType
    });

    // Broadcast update to all other players
    for (const [id, ws] of connections.entries()) {
        if (id !== playerId) {
            ws.send(JSON.stringify({
                type: MessageType.PLAYER_UPDATE,
                data: {
                    id: player.id,
                    position: player.position,
                    rotation: player.rotation,
                    selectedBlockType: player.selectedBlockType,
                    username: player.username,
                    timestamp
                }
            }));
        }
    }
}

// Handle block placement/breaking
function handleBlockUpdate(playerId: string, data: any) {
    const timestamp = Date.now();
    console.log(`[${new Date(timestamp).toISOString()}] Broadcasting block update from player ${playerId}:`, {
        position: data.position,
        blockType: data.blockType
    });

    // Add block update to world state
    gameState.worldUpdates.push({
        position: data.position,
        blockType: data.blockType,
        timestamp
    });

    // Keep only the last 1000 updates
    if (gameState.worldUpdates.length > 1000) {
        gameState.worldUpdates.shift();
    }

    // Update the current world state
    const posKey = positionToKey(data.position);
    
    // If blockType is 0, it means the block was removed, so we should delete it from the map
    if (data.blockType === 0) {
        gameState.currentWorldState.delete(posKey);
    } else {
        // Otherwise, update or add the block to the current state
        gameState.currentWorldState.set(posKey, {
            blockType: data.blockType,
            timestamp
        });
    }

    // Broadcast block update to all players
    for (const ws of connections.values()) {
        ws.send(JSON.stringify({
            type: MessageType.BLOCK_UPDATE,
            data: {
                position: data.position,
                blockType: data.blockType,
                playerId: playerId,
                timestamp
            }
        }));
    }
}

// Broadcast chat message
function broadcastChatMessage(playerId: string, data: any) {
    const player = gameState.players.get(playerId);
    if (!player) return;

    const timestamp = Date.now();
    console.log(`[${new Date(timestamp).toISOString()}] Broadcasting chat message from player ${player.username} (${playerId}): ${data.message}`);

    for (const ws of connections.values()) {
        ws.send(JSON.stringify({
            type: MessageType.CHAT,
            data: {
                message: data.message,
                player: {
                    id: player.id,
                    username: player.username
                },
                timestamp
            }
        }));
    }
}

// Modify the handleChunkRequest function to return pre-generated chunks
function handleChunkRequest(ws: ServerWebSocket<{ id: string }>, data: { x: number, y: number, z: number }) {
    const { x, y, z } = data;
    console.log(`Received chunk request for (${x}, ${y}, ${z})`);
    
    // Get the chunk from pre-generated world
    const chunkKey = getChunkKey(x, y, z);
    const chunkData = worldChunks.get(chunkKey) || [];
    
    // Send chunk data back to client
    ws.send(JSON.stringify({
        type: MessageType.CHUNK_DATA,
        data: {
            x,
            y,
            z,
            blocks: chunkData
        }
    }));
    
    console.log(`Sent chunk data for (${x}, ${y}, ${z}) with ${chunkData.length} blocks`);
}

// Generate chunk data for a given chunk position
function generateChunkData(chunkX: number, chunkY: number, chunkZ: number) {
    console.log(`Generating chunk data for (${chunkX}, ${chunkY}, ${chunkZ})`);
    
    const blocks = [];
    const CHUNK_SIZE = 16;
    
    // Generate a flat platform at the spawn area
    if (chunkY == 3 && chunkX >= -2 && chunkX <= 2 && chunkZ >= -2 && chunkZ <= 2) {
        console.log(`Generating spawn platform at chunk (${chunkX}, ${chunkY}, ${chunkZ})`);
        
        // Create a flat platform at y=48 (which is in chunk 3)
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                // Only add blocks at y=0 of the chunk (which is y=48 in world coordinates)
                blocks.push({
                    x: x,
                    y: 0,
                    z: z,
                    type: 2 // Grass block
                });
                
                // Add dirt below the grass
                for (let y = 1; y < 4; y++) {
                    blocks.push({
                        x: x,
                        y: y,
                        z: z,
                        type: 3 // Dirt block
                    });
                }
                
                // Add stone below the dirt
                for (let y = 4; y < CHUNK_SIZE; y++) {
                    blocks.push({
                        x: x,
                        y: y,
                        z: z,
                        type: 1 // Stone block
                    });
                }
            }
        }
    } 
    // Generate normal terrain for other chunks
    else {
        // Use a simple height function based on chunk coordinates
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                // Calculate world coordinates
                const worldX = chunkX * CHUNK_SIZE + x;
                const worldZ = chunkZ * CHUNK_SIZE + z;
                
                // Generate a height value using a simple function
                // This creates rolling hills with a height between 32 and 64
                const height = Math.floor(
                    48 + 
                    Math.sin(worldX * 0.1) * 8 + 
                    Math.cos(worldZ * 0.1) * 8 +
                    Math.sin(worldX * 0.05 + worldZ * 0.05) * 16
                );
                
                // Calculate the local Y coordinate within this chunk
                const minY = chunkY * CHUNK_SIZE;
                const maxY = minY + CHUNK_SIZE;
                
                // Only add blocks if the height is within this chunk's Y range
                if (height >= minY && height < maxY) {
                    const localY = height - minY;
                    
                    // Add a grass block at the surface
                    blocks.push({
                        x: x,
                        y: localY,
                        z: z,
                        type: 2 // Grass block
                    });
                    
                    // Add dirt blocks below the surface
                    for (let y = localY - 1; y >= 0 && y > localY - 4; y--) {
                        if (y >= 0 && y < CHUNK_SIZE) {
                            blocks.push({
                                x: x,
                                y: y,
                                z: z,
                                type: 3 // Dirt block
                            });
                        }
                    }
                    
                    // Add stone blocks deeper down
                    for (let y = Math.max(0, localY - 4); y >= 0; y--) {
                        blocks.push({
                            x: x,
                            y: y,
                            z: z,
                            type: 1 // Stone block
                        });
                    }
                }
                // If we're below the height, fill with stone or other blocks
                else if (maxY <= height) {
                    // This chunk is completely below the surface, fill with appropriate blocks
                    for (let y = 0; y < CHUNK_SIZE; y++) {
                        // Determine block type based on depth
                        let blockType = 1; // Default to stone
                        
                        // If we're close to the surface, use dirt
                        if (height - (minY + y) < 4) {
                            blockType = 3; // Dirt
                        }
                        
                        blocks.push({
                            x: x,
                            y: y,
                            z: z,
                            type: blockType
                        });
                    }
                }
            }
        }
    }
    
    console.log(`Generated ${blocks.length} blocks for chunk (${chunkX}, ${chunkY}, ${chunkZ})`);
    return blocks;
}

console.log(`Server running at http://localhost:${server.port}`); 