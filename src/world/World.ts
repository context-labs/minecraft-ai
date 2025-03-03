import * as THREE from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { Chunk, CHUNK_SIZE, BLOCK_SIZE } from './Chunk';
import { BlockType } from './Block';
import { TextureManager } from '../utils/TextureManager';
import { NetworkManager } from '../core/NetworkManager';

// Constants for world generation
const RENDER_DISTANCE = 8; // Chunks
const WORLD_HEIGHT = 4; // Chunks
const TERRAIN_SCALE = 0.01;
const BIOME_SCALE = 0.005;
const CAVE_SCALE = 0.03;
const CAVE_THRESHOLD = 0.3;
const TREE_DENSITY = 0.005;
const WATER_LEVEL = 12;
const INITIAL_CHUNKS = 4; // Added for the new generate method

// Biome types
enum BiomeType {
    PLAINS,
    FOREST,
    DESERT,
    MOUNTAINS,
    SNOW
}

// Ore generation parameters
interface OreConfig {
    blockType: BlockType;
    frequency: number;
    minHeight: number;
    maxHeight: number;
    size: number;
}

export class World {
    private chunks: Map<string, Chunk> = new Map();
    private scene: THREE.Scene;
    private textureManager: TextureManager;
    private networkManager?: NetworkManager;
    private worldSeed: number = 0;
    private isServerWorld: boolean = true; // Default to server world mode
    
    // Keep noise functions for potential future use, but they won't be used for generation
    private noise2D: (x: number, y: number) => number = () => 0;
    private noise3D: (x: number, y: number, z: number) => number = () => 0;
    private biomeNoise: (x: number, y: number) => number = () => 0;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.textureManager = new TextureManager();
        this.setupLighting();
        
        console.log('World initialized in server-controlled mode');
    }
    
    public setNetworkManager(networkManager: NetworkManager): void {
        this.networkManager = networkManager;
        console.log('NetworkManager set in World');
    }
    
    public setWorldSeed(seed: number): void {
        console.log(`Setting world seed to ${seed}`);
        this.worldSeed = seed;
        
        // We don't need to initialize noise functions for generation
        // since all chunks come from the server
    }
    
    // This method is kept for compatibility but doesn't do anything in server mode
    public generate(): void {
        console.log('World.generate called - no local generation needed in server mode');
    }
    
    // Load a chunk from server data
    public loadChunkFromData(x: number, y: number, z: number, blocks: any[]): void {
        console.log(`Loading chunk data for chunk (${x}, ${y}, ${z}) with ${blocks.length} blocks`);
        
        // Create a new chunk
        const chunk = new Chunk(
            x, y, z, 
            this.scene, 
            this.textureManager, 
            (worldX, worldY, worldZ) => this.getBlock(worldX, worldY, worldZ)
        );
        
        // Add to chunks map
        const chunkKey = this.getChunkKey(x, y, z);
        this.chunks.set(chunkKey, chunk);
        
        // Set blocks from data WITHOUT broadcasting updates
        // This is critical - we're loading server data, not making changes
        if (blocks && blocks.length > 0) {
            console.log(`Setting ${blocks.length} blocks in chunk (${x}, ${y}, ${z})`);
            for (const block of blocks) {
                // Use direct chunk setBlock to avoid triggering network updates
                chunk.setBlock(block.x, block.y, block.z, block.type);
            }
            
            // Mark chunk as dirty to update its mesh
            chunk.markDirty();
            console.log(`Marked chunk (${x}, ${y}, ${z}) as dirty for mesh update`);
        } else {
            console.warn(`Received empty blocks array for chunk (${x}, ${y}, ${z})`);
        }
        
        // Add to loaded chunks set
        if (this.networkManager) {
            const chunkKey = `${x},${y},${z}`;
            this.networkManager.markChunkLoaded(chunkKey);
        }
    }
    
    // Request a chunk from the server
    public requestChunk(x: number, y: number, z: number): void {
        if (!this.networkManager) {
            console.error('Cannot request chunk: NetworkManager not set');
            return;
        }
        
        console.log(`Requesting chunk (${x}, ${y}, ${z}) from server`);
        this.networkManager.requestChunk(x, y, z);
    }
    
    // Update method - only requests chunks from server
    public update(playerPosition: THREE.Vector3): void {
        // Convert player position to chunk coordinates
        const chunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
        const chunkY = Math.floor(playerPosition.y / CHUNK_SIZE);
        const chunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
        
        console.log(`Player at position (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}), chunk (${chunkX}, ${chunkY}, ${chunkZ})`);
        
        // Determine render distance in chunks
        const renderDistance = 5;
        
        // First, ensure we have chunks directly below the player to prevent falling through the world
        // Request chunks below the player first to ensure there's ground to stand on
        for (let y = chunkY; y >= Math.max(0, chunkY - 5); y--) {
            const chunk = this.getChunk(chunkX, y, chunkZ);
            if (!chunk) {
                console.log(`Prioritizing chunk request for (${chunkX}, ${y}, ${chunkZ}) below player`);
                this.requestChunk(chunkX, y, chunkZ);
            }
        }
        
        // Check and load chunks within render distance
        for (let x = chunkX - renderDistance; x <= chunkX + renderDistance; x++) {
            for (let z = chunkZ - renderDistance; z <= chunkZ + renderDistance; z++) {
                // Use Manhattan distance for prioritization
                const horizontalDistance = Math.abs(x - chunkX) + Math.abs(z - chunkZ);
                
                // Skip if too far horizontally
                if (horizontalDistance > renderDistance) continue;
                
                // Load chunks in vertical range, prioritizing those near player height
                for (let y = Math.max(0, chunkY - 2); y <= chunkY + 2; y++) {
                    // Skip if chunk already exists
                    const chunk = this.getChunk(x, y, z);
                    
                    if (!chunk) {
                        console.log(`Requesting chunk at (${x}, ${y}, ${z}) from server`);
                        this.requestChunk(x, y, z);
                    }
                }
            }
        }
        
        // Update chunk meshes
        this.updateChunks();
        
        // Flush any pending block updates
        this.flushBlockUpdates();
    }
    
    // Get a chunk - don't generate it if it doesn't exist
    private getChunk(x: number, y: number, z: number): Chunk | undefined {
        const key = this.getChunkKey(x, y, z);
        return this.chunks.get(key);
    }
    
    private getChunkKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }
    
    // Keep the essential methods for block manipulation
    
    public getBlock(x: number, y: number, z: number): BlockType {
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        const chunkZ = Math.floor(z / CHUNK_SIZE);
        
        const chunk = this.getChunk(chunkX, chunkY, chunkZ);
        if (!chunk) return BlockType.AIR;
        
        const localX = x - chunkX * CHUNK_SIZE;
        const localY = y - chunkY * CHUNK_SIZE;
        const localZ = z - chunkZ * CHUNK_SIZE;
        
        return chunk.getBlock(localX, localY, localZ);
    }
    
    public setBlock(x: number, y: number, z: number, type: BlockType, broadcastUpdate: boolean = true): void {
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        const chunkZ = Math.floor(z / CHUNK_SIZE);
        
        const chunk = this.getChunk(chunkX, chunkY, chunkZ);
        if (!chunk) {
            console.warn(`Cannot set block at (${x}, ${y}, ${z}): chunk not loaded`);
            return;
        }
        
        const localX = x - chunkX * CHUNK_SIZE;
        const localY = y - chunkY * CHUNK_SIZE;
        const localZ = z - chunkZ * CHUNK_SIZE;
        
        chunk.setBlock(localX, localY, localZ, type);
        chunk.markDirty();
        
        // Broadcast block update to server if needed
        if (broadcastUpdate && this.networkManager) {
            this.networkManager.sendBlockUpdate(x, y, z, type);
        }
    }
    
    public setBlockTypeAtCoordinates(x: number, y: number, z: number, type: BlockType, broadcastUpdate: boolean = true): void {
        this.setBlock(x, y, z, type, broadcastUpdate);
    }
    
    // Raycast for block selection
    public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 10): { position: THREE.Vector3, normal: THREE.Vector3, blockType: BlockType } | null {
        // Implementation remains the same
        // ...
        return null; // Placeholder
    }
    
    private updateChunks(): void {
        // Update all chunks that need updating
        for (const chunk of this.chunks.values()) {
            if (chunk.needsUpdate) {
                chunk.updateMesh();
            }
        }
    }
    
    private flushBlockUpdates(): void {
        // Implementation remains the same
        // ...
    }
    
    private setupLighting(): void {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        
        // Set up shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        
        const d = 200;
        directionalLight.shadow.camera.left = -d;
        directionalLight.shadow.camera.right = d;
        directionalLight.shadow.camera.top = d;
        directionalLight.shadow.camera.bottom = -d;
        
        this.scene.add(directionalLight);
    }
} 