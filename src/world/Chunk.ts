import * as THREE from 'three';
import { BlockType, Block } from './Block';
import { TextureManager } from '../utils/TextureManager';

// Constants
export const CHUNK_SIZE = 16;
export const BLOCK_SIZE = 1;

// Direction vectors for neighboring blocks
export const DIRECTIONS = [
    [0, 1, 0],  // Top
    [0, -1, 0], // Bottom
    [-1, 0, 0], // Left
    [1, 0, 0],  // Right
    [0, 0, 1],  // Front
    [0, 0, -1]  // Back
];

// Type for the callback function to get blocks from neighboring chunks
export type GetNeighborBlockCallback = (worldX: number, worldY: number, worldZ: number) => BlockType;

export class Chunk {
    private blocks: Uint8Array;
    private mesh: THREE.Mesh | null = null;
    private isDirty: boolean = true;
    private position: THREE.Vector3;
    private worldPosition: THREE.Vector3;
    private textureManager: TextureManager;
    private scene: THREE.Scene;
    private getNeighborBlockCallback: GetNeighborBlockCallback;

    constructor(
        x: number, 
        y: number, 
        z: number, 
        scene: THREE.Scene, 
        textureManager: TextureManager,
        getNeighborBlockCallback: GetNeighborBlockCallback
    ) {
        this.position = new THREE.Vector3(x, y, z);
        this.worldPosition = new THREE.Vector3(
            x * CHUNK_SIZE * BLOCK_SIZE,
            y * CHUNK_SIZE * BLOCK_SIZE,
            z * CHUNK_SIZE * BLOCK_SIZE
        );
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
        this.scene = scene;
        this.textureManager = textureManager;
        this.getNeighborBlockCallback = getNeighborBlockCallback;
        
        // Initialize all blocks to air
        this.blocks.fill(BlockType.AIR);
    }

    public getBlock(x: number, y: number, z: number): BlockType {
        if (this.isOutOfBounds(x, y, z)) {
            return BlockType.AIR;
        }
        
        const index = this.getBlockIndex(x, y, z);
        return this.blocks[index];
    }

    public setBlock(x: number, y: number, z: number, type: BlockType): void {
        if (this.isOutOfBounds(x, y, z)) {
            return;
        }
        
        const index = this.getBlockIndex(x, y, z);
        if (this.blocks[index] !== type) {
            this.blocks[index] = type;
            this.isDirty = true;
        }
    }

    public update(): void {
        if (this.isDirty) {
            this.rebuildMesh();
            this.isDirty = false;
        }
    }

    public markDirty(): void {
        this.isDirty = true;
    }

    public getPosition(): THREE.Vector3 {
        return this.position.clone();
    }

    public getWorldPosition(): THREE.Vector3 {
        return this.worldPosition.clone();
    }

    public dispose(): void {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(material => material.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }
    }

    private isOutOfBounds(x: number, y: number, z: number): boolean {
        return x < 0 || y < 0 || z < 0 || 
               x >= CHUNK_SIZE || y >= CHUNK_SIZE || z >= CHUNK_SIZE;
    }

    private getBlockIndex(x: number, y: number, z: number): number {
        return (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
    }
    
    private getNeighborBlock(x: number, y: number, z: number): BlockType {
        // If the coordinates are within this chunk, use getBlock
        if (!this.isOutOfBounds(x, y, z)) {
            return this.getBlock(x, y, z);
        }
        
        // Otherwise, calculate world coordinates and use the callback
        const worldX = this.position.x * CHUNK_SIZE + x;
        const worldY = this.position.y * CHUNK_SIZE + y;
        const worldZ = this.position.z * CHUNK_SIZE + z;
        
        return this.getNeighborBlockCallback(worldX, worldY, worldZ);
    }

    private rebuildMesh(): void {
        console.log(`Rebuilding mesh for chunk at (${this.position.x}, ${this.position.y}, ${this.position.z})`);
        
        // Remove old mesh if it exists
        this.dispose();
        
        // Create geometry for the chunk
        const geometry = new THREE.BufferGeometry();
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        
        // Track which blocks have been processed
        const processed = new Set<number>();
        
        // For each block in the chunk
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const blockType = this.getBlock(x, y, z);
                    
                    // Skip air blocks
                    if (blockType === BlockType.AIR) {
                        continue;
                    }
                    
                    // Get block data
                    const blockData = Block.getBlockData(blockType);
                    
                    // Check each face of the block
                    for (let d = 0; d < DIRECTIONS.length; d++) {
                        const dir = DIRECTIONS[d];
                        const nx = x + dir[0];
                        const ny = y + dir[1];
                        const nz = z + dir[2];
                        
                        // Get neighbor block type (either in this chunk or from neighboring chunks)
                        const neighborType = this.getNeighborBlock(nx, ny, nz);
                        
                        // Always render faces next to air
                        if (neighborType === BlockType.AIR) {
                            this.addFace(
                                positions, normals, uvs, indices,
                                x, y, z, d, blockData.texture
                            );
                            continue;
                        }
                        
                        // If the neighbor is transparent and we're not, add a face
                        if (Block.isTransparent(neighborType) && !Block.isTransparent(blockType)) {
                            this.addFace(
                                positions, normals, uvs, indices,
                                x, y, z, d, blockData.texture
                            );
                        }
                        // Also add faces between different transparent blocks (but not between the same type)
                        else if (Block.isTransparent(blockType) && Block.isTransparent(neighborType) && neighborType !== blockType) {
                            // Skip air blocks
                            if (!Block.isAir(blockType)) {
                                this.addFace(
                                    positions, normals, uvs, indices,
                                    x, y, z, d, blockData.texture
                                );
                            }
                        }
                    }
                }
            }
        }
        
        // If there are no faces to render, return
        if (positions.length === 0) {
            console.log(`No faces to render for chunk at (${this.position.x}, ${this.position.y}, ${this.position.z})`);
            return;
        }
        
        console.log(`Adding ${positions.length / 3} vertices for chunk at (${this.position.x}, ${this.position.y}, ${this.position.z})`);
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        
        // Create mesh
        const material = new THREE.MeshLambertMaterial({
            map: this.textureManager.getTextureAtlas(),
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            depthWrite: true,
            depthTest: true
        });
        
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1;
        material.polygonOffsetUnits = 1;
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.worldPosition);
        this.scene.add(this.mesh);
        
        console.log(`Mesh added to scene for chunk at (${this.position.x}, ${this.position.y}, ${this.position.z})`);
    }

    private addFace(
        positions: number[], 
        normals: number[], 
        uvs: number[], 
        indices: number[],
        x: number, 
        y: number, 
        z: number, 
        faceDir: number, 
        textures: { top: number, bottom: number, left: number, right: number, front: number, back: number }
    ): void {
        // Vertex positions for a cube face
        const vertexPositions = [
            // Top face (y+)
            [0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1],
            // Bottom face (y-)
            [0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0],
            // Left face (x-)
            [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0],
            // Right face (x+)
            [1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1],
            // Front face (z+)
            [0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
            // Back face (z-)
            [1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0]
        ];
        
        // Normal vectors for each face
        const normalVectors = [
            [0, 1, 0],  // Top
            [0, -1, 0], // Bottom
            [-1, 0, 0], // Left
            [1, 0, 0],  // Right
            [0, 0, 1],  // Front
            [0, 0, -1]  // Back
        ];
        
        // Get texture index based on face direction
        let textureIndex: number;
        switch (faceDir) {
            case 0: textureIndex = textures.top; break;
            case 1: textureIndex = textures.bottom; break;
            case 2: textureIndex = textures.left; break;
            case 3: textureIndex = textures.right; break;
            case 4: textureIndex = textures.front; break;
            case 5: textureIndex = textures.back; break;
            default: textureIndex = 0;
        }
        
        // Calculate UV coordinates based on texture index
        const textureUVs = this.textureManager.getTextureCoordinates(textureIndex);
        
        // Get current vertex count
        const vertexCount = positions.length / 3;
        
        // Add vertices for this face
        const verts = vertexPositions[faceDir];
        for (let i = 0; i < 4; i++) {
            positions.push(
                (x + verts[i * 3]) * BLOCK_SIZE,
                (y + verts[i * 3 + 1]) * BLOCK_SIZE,
                (z + verts[i * 3 + 2]) * BLOCK_SIZE
            );
            
            // Add normal
            const normal = normalVectors[faceDir];
            normals.push(normal[0], normal[1], normal[2]);
            
            // Add UV coordinates
            const uvCoords = [
                [textureUVs.left, textureUVs.bottom],
                [textureUVs.left, textureUVs.top],
                [textureUVs.right, textureUVs.top],
                [textureUVs.right, textureUVs.bottom]
            ];
            
            uvs.push(uvCoords[i][0], uvCoords[i][1]);
        }
        
        // Add indices for two triangles (making a quad)
        indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
        );
    }
} 