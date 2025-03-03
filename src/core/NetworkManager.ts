import * as THREE from 'three';
import { BlockType } from '../world/Block';
import { World } from '../world/World';
import { Player } from '../player/Player';

// Message types match server
enum MessageType {
    JOIN = 'join',
    LEAVE = 'leave',
    PLAYER_UPDATE = 'player_update',
    BLOCK_UPDATE = 'block_update',
    INITIAL_STATE = 'initial_state',
    WORLD_STATE = 'world_state',
    CHAT = 'chat'
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

    constructor(data: any, scene: THREE.Scene, textureManager: any) {
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

    private createPlayerMesh(textureManager: any): THREE.Group {
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
    private world: World;
    private player: Player;
    private scene: THREE.Scene;
    private remotePlayers: Map<string, RemotePlayer> = new Map();
    private pendingUpdates: Array<{ type: string; data: any }> = [];
    private updateInterval: number | null = null;
    private chatMessages: ChatMessage[] = [];
    private chatListeners: Array<(message: ChatMessage) => void> = [];
    private textureManager: any;

    private lastSentPosition: THREE.Vector3 = new THREE.Vector3();
    private lastSentRotation: { x: number; y: number } = { x: 0, y: 0 };
    private lastSentBlockType: BlockType = 0;
    private lastUpdateTime: number = 0;

    constructor(world: World, player: Player, scene: THREE.Scene, textureManager: any) {
        this.world = world;
        this.player = player;
        this.scene = scene;
        this.textureManager = textureManager;
    }

    public update(deltaTime: number, timestamp: number): void {
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
        const remotePlayer = new RemotePlayer(data, this.scene, this.textureManager);
        this.remotePlayers.set(data.id, remotePlayer);

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
            const newPlayer = new RemotePlayer(data, this.scene, this.textureManager);
            this.remotePlayers.set(data.id, newPlayer);
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
        // Process all existing players
        data.players.forEach((playerData: any) => {
            if (playerData.id !== this.player.id) {
                this.remotePlayers.set(
                    playerData.id,
                    new RemotePlayer(playerData, this.scene, this.textureManager)
                );
            }
        });

        // Process world state - apply current blocks without sending updates back
        if (data.worldState) {
            // Use current world state map instead of updates array
            for (const [posKey, blockData] of Object.entries(data.worldState)) {
                const [x, y, z] = posKey.split(',').map(Number);
                // Set block locally without sending update to server
                this.world.setBlockTypeAtCoordinates(x, y, z, blockData.blockType, false);
            }
        } else if (data.worldUpdates) {
            // Legacy support for worldUpdates array if server hasn't been updated
            data.worldUpdates.forEach((update: any) => {
                const { position, blockType } = update;
                // Set block locally without sending update to server
                this.world.setBlockTypeAtCoordinates(
                    position.x,
                    position.y,
                    position.z,
                    blockType,
                    false
                );
            });
        }

        // Process chat messages if available
        if (data.chatMessages) {
            data.chatMessages.forEach((message: ChatMessage) => {
                this.handleChatMessage(message);
            });
        }

        console.log('Received initial state:', {
            players: data.players.length,
            worldBlocks: data.worldState ? Object.keys(data.worldState).length : 
                        (data.worldUpdates ? data.worldUpdates.length : 0)
        });
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
        if (currentTime - this.lastUpdateTime < MIN_UPDATE_INTERVAL) {
            return;
        }

        // Calculate rotation angles
        const rotationY = Math.atan2(cameraDirection.x, cameraDirection.z);
        const rotationX = Math.asin(-cameraDirection.y);

        // Use thresholds for responsive updates but eliminate unnecessary updates
        const POSITION_THRESHOLD = 0.03; // Only send position updates if moved more than 3cm
        const ROTATION_THRESHOLD = 0.01; // Only send rotation updates if rotated more than ~0.5 degree

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
            this.lastSentRotation = { x: rotationX, y: rotationY };
            this.lastSentBlockType = selectedBlockType;
            this.lastUpdateTime = currentTime;
        }
    }

    public sendBlockUpdate(x: number, y: number, z: number, blockType: BlockType): void {
        this.sendMessage(MessageType.BLOCK_UPDATE, {
            position: { x, y, z },
            blockType
        });
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
}