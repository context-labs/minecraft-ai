import * as THREE from 'three';
import { BlockType } from '../world/Block';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { TextureManager } from '../utils/TextureManager';
;

// Message types match server
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

// Constants for real-time updates
const POSITION_UPDATE_INTERVAL = 50; // 20 updates/sec
const POSITION_THRESHOLD = 0.03; // 3cm threshold
const ROTATION_THRESHOLD = 0.01; // ~0.5 degree threshold
const INTERPOLATION_DURATION = 40; // 40ms interpolation

// Remote player class
export class RemotePlayer {
    public id: string;
    public position: THREE.Vector3;
    public rotation: { x: number; y: number };
    public selectedBlockType: BlockType;
    public username: string;
    public mesh: THREE.Group;

    private targetPosition: THREE.Vector3;
    private previousPosition: THREE.Vector3;
    private targetRotation: { x: number; y: number };
    private previousRotation: { x: number; y: number };
    private interpolationStart: number = 0;
    private interpolationDuration: number = INTERPOLATION_DURATION;

    constructor(data: any, scene: THREE.Scene, textureManager: TextureManager) {
        this.id = data.id;
        this.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        this.rotation = { x: data.rotation.x, y: data.rotation.y };
        this.selectedBlockType = data.selectedBlockType;
        this.username = data.username;
        this.mesh = this.createPlayerMesh(textureManager);

        scene.add(this.mesh);

        this.targetPosition = this.position.clone();
        this.previousPosition = this.position.clone();
        this.targetRotation = { ...this.rotation };
        this.previousRotation = { ...this.rotation };

        this.updatePositionAndRotation();
    }

    private createPlayerMesh(textureManager: TextureManager): THREE.Group {
        const group = new THREE.Group();

        const bodyGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x0000ff });
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);

        const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
        const headMesh = new THREE.Mesh(headGeometry, headMaterial);
        headMesh.position.y = 1.2;

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (context) {
            context.fillStyle = '#000000';
            context.font = 'Bold 24px Arial';
            context.textAlign = 'center';
            context.fillText(this.username, 128, 40);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const nameTagMaterial = new THREE.SpriteMaterial({ map: texture });
        const nameTag = new THREE.Sprite(nameTagMaterial);
        nameTag.position.y = 2.3;
        nameTag.scale.set(2, 0.5, 1);

        group.add(bodyMesh, headMesh, nameTag);

        return group;
    }

    public update(data: any): void {
        this.previousPosition.copy(this.position);
        this.previousRotation = { ...this.rotation };

        this.targetPosition.set(data.position.x, data.position.y, data.position.z);
        this.targetRotation = { x: data.rotation.x, y: data.rotation.y };

        this.interpolationStart = performance.now();

        this.selectedBlockType = data.selectedBlockType;
    }

    private updatePositionAndRotation(): void {
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation.y;

        const head = this.mesh.children[1] as THREE.Mesh;
        if (head) {
            head.rotation.x = this.rotation.x;
        }
    }

    public interpolate(timestamp: number): void {
        const elapsed = timestamp - this.interpolationStart;
        const t = Math.min(elapsed / this.interpolationDuration, 1.0);

        this.position.lerpVectors(this.previousPosition, this.targetPosition, t);
        this.rotation.x = THREE.MathUtils.lerp(this.previousRotation.x, this.targetRotation.x, t);
        this.rotation.y = THREE.MathUtils.lerp(this.previousRotation.y, this.targetRotation.y, t);

        this.updatePositionAndRotation();
    }

    public dispose(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        this.mesh.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach((mat) => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }
}

// Chat message interface
export interface ChatMessage {
    message: string;
    player: {
        id: string;
        username: string;
    };
    timestamp: number;
}

export class NetworkManager {
    private socket: WebSocket | null = null;
    private connected: boolean = false;
    private player: Player;
    private world: World;
    private scene: THREE.Scene;
    private textureManager: TextureManager;
    private remotePlayers: Map<string, RemotePlayer> = new Map();
    private pendingBlockUpdates: Array<{ position: THREE.Vector3, blockType: BlockType }> = [];
    private pendingChunkRequests: Set<string> = new Set();
    private loadedChunks: Set<string> = new Set();
    private serverTimeOffset: number = 0;
    private lastPositionUpdate: number = 0;
    private lastRotationUpdate: number = 0;
    private lastSentPosition: THREE.Vector3 | null = null;
    private lastSentRotation: THREE.Euler | null = null;
    private lastSentBlockType: BlockType = BlockType.DIRT;
    private chatListeners: Array<(message: any) => void> = [];
    public onInitialStateReceived: (() => void) | null = null;
    
    // Add missing properties
    private playerId: string = '';
    private username: string = '';
    private lastPlayerUpdateTime: number = 0;
    
    private updateInterval: number | null = null;
    private pendingUpdates: any[] = [];
    private chatMessages: any[] = [];
    
    constructor(player: Player, world: World, scene: THREE.Scene, textureManager: TextureManager) {
        this.player = player;
        this.world = world;
        this.scene = scene;
        this.textureManager = textureManager;
        
        // Set the network manager reference in the world
        this.world.setNetworkManager(this);
    }
    
    // Add missing method
    private addRemotePlayer(playerData: any): void {
        if (!playerData.id) {
            console.error('Cannot add remote player: missing ID');
            return;
        }
        
        console.log(`Adding remote player: ${playerData.id}`);
        this.remotePlayers.set(
            playerData.id,
            new RemotePlayer(playerData, this.scene, this.textureManager)
        );
    }

    public update(_deltaTime: number, timestamp: number): void {
        this.remotePlayers.forEach((player) => player.interpolate(timestamp));
    }

    public connect(): void {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.socket = new WebSocket(wsUrl);
        this.socket.onopen = this.onOpen.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.socket.onclose = this.onClose.bind(this);
        this.socket.onerror = this.onError.bind(this);
    }

    private onOpen(): void {
        this.connected = true;
        this.processPendingUpdates();
        this.startUpdateInterval();
    }

    private onMessage(event: MessageEvent): void {
        const message = JSON.parse(event.data);
        switch (message.type) {
            case MessageType.JOIN:
                this.handlePlayerJoin(message.data);
                break;
            case MessageType.LEAVE:
                this.handlePlayerLeave(message.data);
                break;
            case MessageType.PLAYER_UPDATE:
                this.handlePlayerUpdate(message.data);
                break;
            case MessageType.BLOCK_UPDATE:
                this.handleBlockUpdate(message.data);
                break;
            case MessageType.INITIAL_STATE:
                this.handleInitialState(message.data);
                break;
            case MessageType.CHAT:
                this.handleChatMessage(message.data);
                break;
            case MessageType.CHUNK_DATA:
                this.handleChunkData(message.data);
                break;
        }
    }

    private onClose(): void {
        this.connected = false;
        if (this.updateInterval !== null) clearInterval(this.updateInterval);
        this.remotePlayers.forEach((player) => player.dispose(this.scene));
        this.remotePlayers.clear();
        setTimeout(() => this.connect(), 5000);
    }

    private onError(error: Event): void {
        console.error('WebSocket error:', error);
    }

    private handlePlayerJoin(data: any): void {
        console.log(`Player joined: ${data.username} (${data.id})`);

        // Create new remote player
        this.addRemotePlayer(data);

        // Display a chat message about the player joining
        this.handleChatMessage({
            message: `has joined the game`,
            player: {
                id: data.id,
                username: data.username
            },
            timestamp: Date.now()
        });
    }

    private handlePlayerLeave(data: any): void {
        console.log(`Player left: ${data.id}`);

        // Get the player before removing them
        const remotePlayer = this.remotePlayers.get(data.id);

        // Remove remote player
        if (remotePlayer) {
            // Display a chat message about the player leaving
            this.handleChatMessage({
                message: `has left the game`,
                player: {
                    id: remotePlayer.id,
                    username: remotePlayer.username
                },
                timestamp: Date.now()
            });

            remotePlayer.dispose(this.scene);
            this.remotePlayers.delete(data.id);
        }
    }

    private handlePlayerUpdate(data: any): void {
        console.log(`Received player update for ${data.id}`);
        // Update remote player
        const remotePlayer = this.remotePlayers.get(data.id);
        if (remotePlayer) {
            remotePlayer.update(data);
        } else {
            // Player not found, create new remote player
            console.log(`Creating new remote player: ${data.id}`);
            this.addRemotePlayer(data);
        }
    }

    private handleBlockUpdate(data: any): void {
        // Update block in world
        this.world.setBlock(
            data.position.x,
            data.position.y,
            data.position.z,
            data.blockType
        );
    }

    private handleInitialState(data: any): void {
        console.log('Received initial state from server:', data);
        
        // Store player ID and username if provided
        if (data.playerId) {
            this.playerId = data.playerId;
            console.log(`Set player ID to ${this.playerId}`);
        }
        
        if (data.username) {
            this.username = data.username;
            console.log(`Set username to ${this.username}`);
        }
        
        // Calculate server time offset
        const serverTime = data.timestamp;
        const clientTime = Date.now();
        this.serverTimeOffset = serverTime - clientTime;
        console.log(`Server time offset: ${this.serverTimeOffset}ms`);
        
        // Set world seed from server
        if (data.worldSeed !== undefined) {
            console.log(`Setting world seed from server: ${data.worldSeed}`);
            this.world.setWorldSeed(data.worldSeed);
        } else {
            console.warn('No world seed provided in initial state');
        }
        
        // Process existing players
        if (data.players) {
            console.log(`Processing ${data.players.length} players from initial state`);
            for (const playerData of data.players) {
                // Skip if it's the local player
                if (playerData.id === this.playerId) {
                    continue;
                }
                
                this.addRemotePlayer(playerData);
            }
        }
        
        // Process existing world state
        if (data.worldState) {
            console.log(`Processing ${Object.keys(data.worldState).length} block updates from initial state`);
            for (const [posKey, blockData] of Object.entries(data.worldState)) {
                const position = posKey.split(',').map(Number);
                const blockType = (blockData as any).blockType;
                
                // Update the world without broadcasting back to server
                this.world.setBlockTypeAtCoordinates(
                    position[0], position[1], position[2],
                    blockType,
                    false // Don't broadcast back to server
                );
            }
        }
        
        // Notify that initial state has been received
        if (this.onInitialStateReceived) {
            console.log('Calling onInitialStateReceived callback');
            this.onInitialStateReceived();
        }
    }

    private handleChatMessage(data: ChatMessage): void {
        // Add to chat history
        this.chatMessages.push(data);

        // Limit chat history to 100 messages
        if (this.chatMessages.length > 100) {
            this.chatMessages.shift();
        }

        // Notify listeners
        this.chatListeners.forEach(listener => {
            listener(data);
        });
    }

    private startUpdateInterval(): void {
        // Clear any existing interval first to prevent duplicates
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
        }

        // Set update interval to 100ms (10 updates per second maximum)
        // This is a good balance - player updates are still responsive
        // but we only check for movement 10 times per second
        const UPDATE_INTERVAL = 20;

        console.log('Starting player update interval');
        this.updateInterval = setInterval(() => {
            this.sendPlayerUpdate();
        }, UPDATE_INTERVAL) as unknown as number;
    }

    private processPendingUpdates(): void {
        // Send any pending updates
        for (const update of this.pendingUpdates) {
            this.sendMessage(update.type, update.data);
        }

        // Clear pending updates
        this.pendingUpdates = [];
    }

    public sendPlayerUpdate(): void {
        if (!this.connected) return;

        const playerPosition = this.player.getPosition();
        const cameraDirection = this.player.getDirection();
        const selectedBlockType = this.player.getSelectedBlockType();

        // Check if sufficient time has passed since last update
        const currentTime = performance.now();
        const MIN_UPDATE_INTERVAL = 50; // Reduced to 50ms (max 20 updates/sec)

        // Only proceed if minimum time has passed
        if (currentTime - this.lastPlayerUpdateTime < MIN_UPDATE_INTERVAL) {
            return;
        }

        // Calculate rotation angles
        const rotationY = Math.atan2(cameraDirection.x, cameraDirection.z);
        const rotationX = Math.asin(-cameraDirection.y);

        // Use thresholds for responsive updates but eliminate unnecessary updates
        const POSITION_THRESHOLD = 0.03; // Only send position updates if moved more than 3cm
        const ROTATION_THRESHOLD = 0.01; // Only send rotation updates if rotated more than ~0.5 degree

        // Initialize position and rotation if null
        if (this.lastSentPosition === null) {
            this.lastSentPosition = new THREE.Vector3();
        }
        
        if (this.lastSentRotation === null) {
            this.lastSentRotation = new THREE.Euler();
        }

        // Check if position has changed significantly
        const positionChanged = this.lastSentPosition.distanceTo(playerPosition) > POSITION_THRESHOLD;

        // Check if rotation has changed significantly
        const rotationChanged =
            Math.abs(this.lastSentRotation.x - rotationX) > ROTATION_THRESHOLD ||
            Math.abs(this.lastSentRotation.y - rotationY) > ROTATION_THRESHOLD;

        // Check if selected block has changed
        const blockTypeChanged = this.lastSentBlockType !== selectedBlockType;

        // Only send update if something significant has changed
        if (positionChanged || rotationChanged || blockTypeChanged) {
            console.log(`Sending player update: position=${positionChanged}, rotation=${rotationChanged}, block=${blockTypeChanged}`);
            this.sendMessage(MessageType.PLAYER_UPDATE, {
                position: {
                    x: playerPosition.x,
                    y: playerPosition.y,
                    z: playerPosition.z
                },
                rotation: {
                    x: rotationX,
                    y: rotationY
                },
                selectedBlockType: selectedBlockType
            });

            // Update last sent values
            this.lastSentPosition.copy(playerPosition);
            this.lastSentRotation = new THREE.Euler(rotationX, rotationY, 0, 'YXZ');
            this.lastSentBlockType = selectedBlockType;
            this.lastPlayerUpdateTime = currentTime;
        }
    }

    // Send a block update to the server
    public sendBlockUpdate(x: number, y: number, z: number, blockType: BlockType): void {
        console.log(`NetworkManager.sendBlockUpdate called: x=${x}, y=${y}, z=${z}, type=${blockType}`);
        
        // Store the last sent block type for debugging
        this.lastSentBlockType = blockType;
        
        // If not connected, queue the update
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log(`Not connected to server, queueing block update`);
            this.pendingUpdates.push({
                type: MessageType.BLOCK_UPDATE,
                data: {
                    position: { x, y, z },
                    blockType
                }
            });
            return;
        }
        
        // Send the update to the server
        const message = {
            type: MessageType.BLOCK_UPDATE,
            data: {
                position: { x, y, z },
                blockType
            }
        };
        
        console.log(`Sending block update to server: ${JSON.stringify(message)}`);
        this.socket.send(JSON.stringify(message));
    }

    public sendChatMessage(message: string): void {
        this.sendMessage(MessageType.CHAT, {
            message
        });
    }

    private sendMessage(type: string, data: any): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send message, socket not open');

            // Queue the message to be sent when connected
            if (type !== MessageType.PLAYER_UPDATE) {  // Don't queue position updates as they'll be outdated
                this.pendingUpdates.push({ type, data });
            }
            return;
        }

        try {
            const message = JSON.stringify({ type, data });
            this.socket.send(message);
        } catch (error) {
            console.error('Error sending message:', error);
            // Queue the message to be sent later on error
            if (type !== MessageType.PLAYER_UPDATE) {
                this.pendingUpdates.push({ type, data });
            }
        }
    }

    public addChatListener(listener: (message: ChatMessage) => void): void {
        this.chatListeners.push(listener);
    }

    public removeChatListener(listener: (message: ChatMessage) => void): void {
        const index = this.chatListeners.indexOf(listener);
        if (index !== -1) {
            this.chatListeners.splice(index, 1);
        }
    }

    public getChatHistory(): ChatMessage[] {
        return [...this.chatMessages];
    }

    // Mark a chunk as loaded
    public markChunkLoaded(chunkKey: string): void {
        console.log(`Marking chunk ${chunkKey} as loaded`);
        this.loadedChunks.add(chunkKey);
        this.pendingChunkRequests.delete(chunkKey);
    }
    
    // Handle chunk data received from server
    private handleChunkData(data: any): void {
        const { x, y, z, blocks } = data;
        const chunkKey = `${x},${y},${z}`;
        
        console.log(`Received chunk data for (${x}, ${y}, ${z}) with ${blocks.length} blocks`);
        
        // Remove from pending requests
        this.pendingChunkRequests.delete(chunkKey);
        
        // Load the chunk into the world
        this.world.loadChunkFromData(x, y, z, blocks);
    }
    
    // Request a chunk from the server
    public requestChunk(x: number, y: number, z: number): void {
        if (!this.socket || !this.connected) {
            console.error('Cannot request chunk: not connected to server');
            return;
        }
        
        const chunkKey = `${x},${y},${z}`;
        
        // Don't request chunks that are already loaded or pending
        if (this.loadedChunks.has(chunkKey) || this.pendingChunkRequests.has(chunkKey)) {
            console.log(`Chunk ${chunkKey} already loaded or pending, skipping request`);
            return;
        }
        
        console.log(`Sending chunk request for (${x}, ${y}, ${z})`);
        
        // Add to pending requests
        this.pendingChunkRequests.add(chunkKey);
        
        // Send request to server
        this.sendMessage(MessageType.CHUNK_REQUEST, { x, y, z });
    }
}