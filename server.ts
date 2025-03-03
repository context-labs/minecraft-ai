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
}

// Initialize game state
const gameState: GameState = {
    players: new Map<string, Player>(),
    worldUpdates: [],
    currentWorldState: new Map<string, {
        blockType: number;
        timestamp: number;
    }>()
};

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

// Define a constant spawn point for all players
const SPAWN_POINT = {
    x: 0,
    y: 50,  // Start high enough to avoid spawning inside terrain
    z: 0
};

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
    CHAT = 'chat'
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
            const success = server.upgrade(req, {
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

// Send initial state to new player
function sendInitialState(ws: ServerWebSocket<{ id: string }>, playerId: string) {
    const initialPlayers = Array.from(gameState.players.entries())
        .filter(([id]) => id !== playerId)
        .map(([_, player]) => player);
    
    // Convert currentWorldState map to an array of objects for JSON serialization
    const currentWorld = Array.from(gameState.currentWorldState.entries()).map(([posKey, blockData]) => {
        return {
            position: keyToPosition(posKey),
            blockType: blockData.blockType,
            timestamp: blockData.timestamp
        };
    });
    
    ws.send(JSON.stringify({
        type: MessageType.INITIAL_STATE,
        data: {
            players: initialPlayers,
            worldState: currentWorld,
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

console.log(`Server running at http://localhost:${server.port}`); 