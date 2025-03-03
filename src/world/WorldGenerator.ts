import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BlockType } from './Block';

// Constants for world generation
export const CHUNK_SIZE = 16; // Size of a chunk in blocks
export const RENDER_DISTANCE = 8; // Chunks
export const WORLD_HEIGHT = 4; // Chunks
export const TERRAIN_SCALE = 0.01;
export const BIOME_SCALE = 0.005;
export const CAVE_SCALE = 0.03;
export const CAVE_THRESHOLD = 0.3;
export const TREE_DENSITY = 0.005;
export const WATER_LEVEL = 12;

// Biome types
export enum BiomeType {
    PLAINS,
    FOREST,
    DESERT,
    MOUNTAINS,
    SNOW
}

// Ore generation parameters
export interface OreConfig {
    blockType: BlockType;
    frequency: number;
    minHeight: number;
    maxHeight: number;
    size: number;
}

export class WorldGenerator {
    private noise2D: (x: number, y: number) => number;
    private noise3D: (x: number, y: number, z: number) => number;
    private biomeNoise: (x: number, y: number) => number;
    
    // Ore configurations
    private oreConfigs: OreConfig[] = [
        {
            blockType: BlockType.COAL_ORE,
            frequency: 0.1,
            minHeight: 5,
            maxHeight: 80,
            size: 8
        },
        {
            blockType: BlockType.IRON_ORE,
            frequency: 0.05,
            minHeight: 5,
            maxHeight: 60,
            size: 6
        },
        {
            blockType: BlockType.GOLD_ORE,
            frequency: 0.02,
            minHeight: 5,
            maxHeight: 30,
            size: 4
        }
    ];
    
    constructor() {
        // Initialize noise functions
        this.noise2D = createNoise2D();
        this.noise3D = createNoise3D();
        this.biomeNoise = createNoise2D();
    }
    
    // Generate a block at the given coordinates
    public generateBlockAt(x: number, y: number, z: number): BlockType {
        // Get biome at this location
        const biome = this.getBiome(x, z);
        
        // Generate terrain height at this location
        const terrainHeight = this.getTerrainHeight(x, z, biome);
        
        // If above terrain height, it's air (or water if below water level)
        if (y > terrainHeight) {
            if (y <= WATER_LEVEL) {
                return BlockType.WATER;
            }
            return BlockType.AIR;
        }
        
        // If at terrain height, determine surface block based on biome
        if (y === terrainHeight) {
            return this.getSurfaceBlock(biome);
        }
        
        // Check for caves
        const caveNoise = this.noise3D(x * CAVE_SCALE, y * CAVE_SCALE, z * CAVE_SCALE);
        if (caveNoise > CAVE_THRESHOLD && y < terrainHeight - 3) {
            return BlockType.AIR;
        }
        
        // Check for ores
        const oreType = this.generateOre(x, y, z);
        if (oreType !== null) {
            return oreType;
        }
        
        // Underground blocks
        if (y < terrainHeight - 3) {
            return BlockType.STONE;
        } else {
            return BlockType.DIRT;
        }
    }
    
    // Generate the initial world state for a region
    public generateRegion(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Map<string, number> {
        const worldState = new Map<string, number>();
        
        console.log(`Generating region from (${minX},${minY},${minZ}) to (${maxX},${maxY},${maxZ})`);
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                for (let y = minY; y <= maxY; y++) {
                    const blockType = this.generateBlockAt(x, y, z);
                    
                    // Only store non-air blocks to save space
                    if (blockType !== BlockType.AIR) {
                        const key = `${x},${y},${z}`;
                        worldState.set(key, blockType);
                    }
                }
            }
        }
        
        // Generate trees and structures
        this.generateStructuresInRegion(worldState, minX, maxX, minY, maxY, minZ, maxZ);
        
        return worldState;
    }
    
    // Generate the initial world state around the origin
    public generateInitialWorld(renderDistance: number = RENDER_DISTANCE): Map<string, number> {
        const chunkSize = CHUNK_SIZE;
        const minX = -renderDistance * chunkSize;
        const maxX = renderDistance * chunkSize;
        const minZ = -renderDistance * chunkSize;
        const maxZ = renderDistance * chunkSize;
        const minY = 0;
        const maxY = WORLD_HEIGHT * chunkSize;
        
        return this.generateRegion(minX, maxX, minY, maxY, minZ, maxZ);
    }
    
    private getTerrainHeight(x: number, z: number, biome: BiomeType): number {
        // Base terrain height using 2D noise
        let height = Math.floor((this.noise2D(x * TERRAIN_SCALE, z * TERRAIN_SCALE) + 1) * 10) + 20;
        
        // Adjust height based on biome
        switch (biome) {
            case BiomeType.PLAINS:
                // Flatter terrain
                height = Math.floor(height * 0.7) + 15;
                break;
            case BiomeType.FOREST:
                // Slightly varied terrain
                height = Math.floor(height * 0.8) + 18;
                break;
            case BiomeType.DESERT:
                // Dunes and flat areas
                height = Math.floor(height * 0.6) + 12;
                break;
            case BiomeType.MOUNTAINS:
                // Much higher terrain
                height = Math.floor(height * 1.5) + 25;
                break;
            case BiomeType.SNOW:
                // High elevation
                height = Math.floor(height * 1.2) + 30;
                break;
        }
        
        return height;
    }
    
    private getSurfaceBlock(biome: BiomeType): BlockType {
        switch (biome) {
            case BiomeType.PLAINS:
                return BlockType.GRASS;
            case BiomeType.FOREST:
                return BlockType.GRASS;
            case BiomeType.DESERT:
                return BlockType.SAND;
            case BiomeType.MOUNTAINS:
                return Math.random() < 0.3 ? BlockType.STONE : BlockType.GRASS;
            case BiomeType.SNOW:
                return BlockType.SNOW;
            default:
                return BlockType.GRASS;
        }
    }
    
    private getBiome(x: number, z: number): BiomeType {
        const noise = this.biomeNoise(x * BIOME_SCALE, z * BIOME_SCALE);
        return this.getBiomeFromNoise(noise);
    }
    
    private getBiomeFromNoise(noise: number): BiomeType {
        if (noise < -0.6) {
            return BiomeType.DESERT;
        } else if (noise < -0.2) {
            return BiomeType.PLAINS;
        } else if (noise < 0.2) {
            return BiomeType.FOREST;
        } else if (noise < 0.6) {
            return BiomeType.MOUNTAINS;
        } else {
            return BiomeType.SNOW;
        }
    }
    
    private generateOre(x: number, y: number, z: number): BlockType | null {
        for (const ore of this.oreConfigs) {
            if (y >= ore.minHeight && y <= ore.maxHeight) {
                // Use 3D noise to determine ore placement
                const noise = this.noise3D(
                    x * ore.frequency,
                    y * ore.frequency,
                    z * ore.frequency
                );
                
                // Higher threshold for rarer ores
                if (noise > 0.7) {
                    return ore.blockType;
                }
            }
        }
        
        return null;
    }
    
    private generateStructuresInRegion(worldState: Map<string, number>, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void {
        // Generate trees
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const biome = this.getBiome(x, z);
                
                // Only generate trees in forest and plains biomes
                if (biome === BiomeType.FOREST || (biome === BiomeType.PLAINS && Math.random() < 0.2)) {
                    // Determine tree density based on biome
                    const treeDensity = biome === BiomeType.FOREST ? TREE_DENSITY * 2 : TREE_DENSITY * 0.5;
                    
                    // Random chance to place a tree
                    if (Math.random() < treeDensity) {
                        // Find the ground level
                        let groundY = -1;
                        for (let y = maxY; y >= minY; y--) {
                            const key = `${x},${y},${z}`;
                            const blockType = worldState.get(key);
                            
                            if (blockType === BlockType.GRASS) {
                                groundY = y;
                                break;
                            }
                        }
                        
                        // If we found ground, place a tree
                        if (groundY !== -1) {
                            this.generateTree(worldState, x, groundY, z);
                        }
                    }
                }
            }
        }
    }
    
    private generateTree(worldState: Map<string, number>, x: number, y: number, z: number): void {
        // Tree height (4-6 blocks)
        const height = 4 + Math.floor(Math.random() * 3);
        
        // Generate trunk
        for (let i = 1; i <= height; i++) {
            worldState.set(`${x},${y + i},${z}`, BlockType.WOOD);
        }
        
        // Generate leaves
        const leafHeight = Math.floor(height * 0.7);
        const leafRadius = 2;
        
        for (let ly = 0; ly <= leafHeight; ly++) {
            const radius = ly === 0 || ly === leafHeight ? 1 : leafRadius;
            
            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    // Skip trunk positions
                    if (lx === 0 && lz === 0 && ly < leafHeight) {
                        continue;
                    }
                    
                    // Make leaves more circular/oval shaped
                    if (lx * lx + lz * lz <= radius * radius + 1) {
                        const leafX = x + lx;
                        const leafY = y + height - leafHeight + ly;
                        const leafZ = z + lz;
                        
                        // Only place leaves in air blocks
                        const key = `${leafX},${leafY},${leafZ}`;
                        if (!worldState.has(key)) {
                            worldState.set(key, BlockType.LEAVES);
                        }
                    }
                }
            }
        }
    }
} 