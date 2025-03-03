import { serve } from 'bun';
import { join } from 'path';
import { readFileSync } from 'fs';
import type { ServerWebSocket } from "bun";
import { WorldGenerator } from './src/world/WorldGenerator';
import { BlockType } from './src/world/Block';

// Game state types
interface Player {
    id: string;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number };
    selectedBlockType: number;
    username: string;
    connectionTime?: number; // Add connection timestamp
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

// Map to track rate limiting for world state requests
const worldStateRequestTimes = new Map<string, number>();

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

// Generate initial world state
console.log('Generating initial world state...');
const worldGenerator = new WorldGenerator();
const initialWorldBlocks = worldGenerator.generateInitialWorld();

// Convert the generated world to the format used by the game state
for (const [posKey, blockType] of initialWorldBlocks.entries()) {
    gameState.currentWorldState.set(posKey, {
        blockType,
        timestamp: Date.now()
    });
}

console.log(`Generated ${gameState.currentWorldState.size} initial blocks`);

// Create server
const server: ReturnType<typeof serve> = serve({
    port: 3000,
    fetch(req): Response | undefined {
        const url = new URL(req.url);
        let path = url.pathname;
        
        // Handle WebSocket upgrade
        if (path === '/ws') {
            const success: boolean = server.upgrade(req, {
                data: { id: crypto.randomUUID() }
            });
            return success ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
        }
        
        // Handle API requests for world state
        if (path === '/api/world-state') {
            try {
                // Simple rate limiting - check if this IP has requested recently
                const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
                const now = Date.now();
                const lastRequestTime = worldStateRequestTimes.get(clientIP) || 0;
                
                // Allow requests once every 5 seconds per IP
                if (now - lastRequestTime < 5000) {
                    return new Response(JSON.stringify({ 
                        error: 'Rate limit exceeded. Please wait before requesting again.' 
                    }), {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Retry-After': '5'
                        }
                    });
                }
                
                // Update last request time
                worldStateRequestTimes.set(clientIP, now);
                
                // Convert currentWorldState map to an array of objects for JSON serialization
                const blocks = Array.from(gameState.currentWorldState.entries()).map(([posKey, blockData]) => {
                    return {
                        position: keyToPosition(posKey),
                        blockType: blockData.blockType,
                        timestamp: blockData.timestamp
                    };
                });
                
                // Get all players
                const players = Array.from(gameState.players.values());
                
                // Create response object with optimized format for blocks
                const responseData = {
                    // Use a more compact format for blocks to reduce data size
                    blocks: blocks.map(block => [
                        block.position.x,
                        block.position.y, 
                        block.position.z, 
                        block.blockType
                    ]),
                    players,
                    chatMessages: [], // Add chat history if you have it
                    timestamp: now
                };
                
                console.log(`Sending world state via HTTP with ${blocks.length} blocks and ${players.length} players to ${clientIP}`);
                
                // Return uncompressed JSON response
                return new Response(JSON.stringify(responseData), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-store'
                    }
                });
            } catch (error) {
                console.error('Error serving world state via HTTP:', error);
                return new Response(JSON.stringify({ error: 'Internal server error' }), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
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
            
            // Initialize player in game state with fixed spawn point and connection time
            gameState.players.set(playerId, {
                id: playerId,
                position: { ...SPAWN_POINT },  // Use the fixed spawn point
                rotation: { x: 0, y: 0 },
                selectedBlockType: 0,
                username: `Player-${playerId.substring(0, 4)}`,
                connectionTime: Date.now() // Track when the player connected
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
async function sendInitialState(ws: ServerWebSocket<{ id: string }>, playerId: string) {
    // Only send player data, not world state (which is now loaded via HTTP)
    const initialPlayers = Array.from(gameState.players.entries())
        .filter(([id]) => id !== playerId)
        .map(([_, player]) => player);
    
    console.log(`Sending player data to new player ${playerId} (${initialPlayers.length} other players)`);
    
    // Send only player data
    ws.send(JSON.stringify({
        type: MessageType.INITIAL_STATE,
        data: {
            players: initialPlayers,
            // No world state metadata or chunks - client will load via HTTP
            worldStateMetadata: {
                totalBlocks: 0,
                totalChunks: 0,
                chunkSize: 0
            },
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

// Handle player update
function handlePlayerUpdate(playerId: string, data: any) {
    const player = gameState.players.get(playerId);
    if (!player) return;

    // Update player state
    player.position = data.position;
    player.rotation = data.rotation;
    player.selectedBlockType = data.selectedBlockType;

    // Broadcast update to all other players
    const timestamp = Date.now();
    
    for (const [id, ws] of connections.entries()) {
        if (id !== playerId) {
            ws.send(JSON.stringify({
                type: MessageType.PLAYER_UPDATE,
                data: {
                    id: playerId,
                    position: player.position,
                    rotation: player.rotation,
                    selectedBlockType: player.selectedBlockType,
                    timestamp
                }
            }));
        }
    }
}

// Handle block update
function handleBlockUpdate(playerId: string, data: any) {
    const player = gameState.players.get(playerId);
    if (!player) return;

    const { position, blockType } = data;
    
    // Validate that the block is within a reasonable distance from the player
    const dx = player.position.x - position.x;
    const dy = player.position.y - position.y;
    const dz = player.position.z - position.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    
    // Define maximum distance a player can modify blocks (slightly larger than client-side reach)
    const MAX_BLOCK_MODIFICATION_DISTANCE = 10;
    
    if (distanceSquared > MAX_BLOCK_MODIFICATION_DISTANCE * MAX_BLOCK_MODIFICATION_DISTANCE) {
        console.warn(`Player ${playerId} tried to modify a block too far away: distance=${Math.sqrt(distanceSquared).toFixed(2)}`);
        return;
    }
    
    const posKey = positionToKey(position);
    const timestamp = Date.now();

    // Check if this block was recently updated to prevent rapid changes
    const existingBlock = gameState.currentWorldState.get(posKey);
    if (existingBlock && (timestamp - existingBlock.timestamp < 100)) {
        // Skip if the block was updated less than 100ms ago
        return;
    }

    // Update world state
    gameState.currentWorldState.set(posKey, {
        blockType,
        timestamp
    });

    // Add to updates list
    gameState.worldUpdates.push({
        position,
        blockType,
        timestamp
    });

    // Limit the size of the updates list
    if (gameState.worldUpdates.length > 1000) {
        gameState.worldUpdates.shift();
    }

    // Broadcast update to all players except the one who made the change
    for (const [id, ws] of connections.entries()) {
        // Don't send the update back to the player who made it
        if (id === playerId) continue;
        
        // Only send updates to players within range
        const otherPlayer = gameState.players.get(id);
        if (!otherPlayer) continue;

        // Skip sending block updates that occurred before the player connected
        if (otherPlayer.connectionTime && timestamp <= otherPlayer.connectionTime) {
            continue;
        }

        const dx = otherPlayer.position.x - position.x;
        const dy = otherPlayer.position.y - position.y;
        const dz = otherPlayer.position.z - position.z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;

        if (distanceSquared <= MAX_BLOCK_UPDATE_DISTANCE * MAX_BLOCK_UPDATE_DISTANCE) {
            ws.send(JSON.stringify({
                type: MessageType.BLOCK_UPDATE,
                data: {
                    position,
                    blockType,
                    timestamp,
                    playerId
                }
            }));
        }
    }
}

// Broadcast chat message
function broadcastChatMessage(playerId: string, data: any) {
    const player = gameState.players.get(playerId);
    if (!player) return;

    const timestamp = Date.now();
    const chatMessage = {
        message: data.message,
        player: {
            id: playerId,
            username: player.username
        },
        timestamp
    };

    console.log(`[${new Date(timestamp).toISOString()}] Chat from ${player.username}: ${data.message}`);

    // Broadcast to all players
    for (const [_, ws] of connections.entries()) {
        ws.send(JSON.stringify({
            type: MessageType.CHAT,
            data: chatMessage
        }));
    }
}

console.log(`Server running at http://localhost:3000`); 