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
    private mesh: THREE.Object3D | null = null;
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

    public hasPendingUpdates(): boolean {
        return this.isDirty;
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
            
            // Dispose of all child meshes
            if (this.mesh.children.length > 0) {
                this.mesh.children.forEach(child => {
                    if (child instanceof THREE.Mesh) {
                        // Dispose of geometry
                        if (child.geometry) {
                            child.geometry.dispose();
                        }
                        
                        // Dispose of materials
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => {
                                if (material) material.dispose();
                            });
                        } else if (child.material) {
                            child.material.dispose();
                        }
                    }
                });
            }
            
            this.mesh = null;
        }
        
        // Clear block data
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
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
        
        // Calculate world coordinates for the neighbor block
        const worldX = this.position.x * CHUNK_SIZE + x;
        const worldY = this.position.y * CHUNK_SIZE + y;
        const worldZ = this.position.z * CHUNK_SIZE + z;
        
        try {
            // Use callback to query block from the world
            const blockType = this.getNeighborBlockCallback(worldX, worldY, worldZ);
            
            // Validate the returned block type
            if (blockType === undefined || blockType === null) {
                return BlockType.AIR; // Default to AIR for safety
            }
            
            return blockType;
        } catch (e) {
            // If for any reason this fails, default to AIR
            // This ensures faces get drawn rather than being invisible
            return BlockType.AIR;
        }
    }

    private rebuildMesh(): void {
        try {
            // Create separate geometries for opaque and transparent blocks
            const opaqueGeometry = new THREE.BufferGeometry();
            const transparentGeometry = new THREE.BufferGeometry();
            
            // Arrays for opaque blocks
            const opaquePositions: number[] = [];
            const opaqueNormals: number[] = [];
            const opaqueUvs: number[] = [];
            const opaqueIndices: number[] = [];
            
            // Arrays for transparent blocks
            const transparentPositions: number[] = [];
            const transparentNormals: number[] = [];
            const transparentUvs: number[] = [];
            const transparentIndices: number[] = [];
            
            let blockCount = 0;
            let opaqueFaceCount = 0;
            let transparentFaceCount = 0;
            
            // For each block in the chunk
            for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    for (let x = 0; x < CHUNK_SIZE; x++) {
                        const blockType = this.getBlock(x, y, z);
                        
                        // Skip air blocks - they don't need faces
                        if (blockType === BlockType.AIR) {
                            continue;
                        }
                        
                        blockCount++;
                        
                        // Get block data
                        const blockData = Block.getBlockData(blockType);
                        const isTransparent = Block.isTransparent(blockType);
                        
                        // Choose the appropriate arrays based on block transparency
                        const positions = isTransparent ? transparentPositions : opaquePositions;
                        const normals = isTransparent ? transparentNormals : opaqueNormals;
                        const uvs = isTransparent ? transparentUvs : opaqueUvs;
                        const indices = isTransparent ? transparentIndices : opaqueIndices;
                        
                        // Check each face of the block
                        for (let d = 0; d < 6; d++) {
                            // Get position of neighboring block
                            const nx = x + DIRECTIONS[d][0];
                            const ny = y + DIRECTIONS[d][1];
                            const nz = z + DIRECTIONS[d][2];
                            
                            // Get the type of the neighboring block
                            const neighborType = this.getNeighborBlock(nx, ny, nz);
                            
                            // 1. If neighbor is air, show the face
                            if (neighborType === BlockType.AIR) {
                                this.addFace(
                                    positions, normals, uvs, indices,
                                    x, y, z, d, blockData.texture
                                );
                                isTransparent ? transparentFaceCount++ : opaqueFaceCount++;
                                continue;
                            }
                            
                            // 2. If blocks are different types, show the face
                            if (blockType !== neighborType) {
                                this.addFace(
                                    positions, normals, uvs, indices,
                                    x, y, z, d, blockData.texture
                                );
                                isTransparent ? transparentFaceCount++ : opaqueFaceCount++;
                                continue;
                            }
                            
                            // 3. If both blocks are transparent, show face between them too
                            if (isTransparent) {
                                this.addFace(
                                    positions, normals, uvs, indices,
                                    x, y, z, d, blockData.texture
                                );
                                transparentFaceCount++;
                            }
                        }
                    }
                }
            }
            
            // Log mesh statistics
            console.log(`Chunk at (${this.position.x}, ${this.position.y}, ${this.position.z}) has ${blockCount} blocks, ${opaqueFaceCount} opaque faces, and ${transparentFaceCount} transparent faces`);
            
            // If there are no faces to render, remove any existing mesh and return
            if (opaqueFaceCount === 0 && transparentFaceCount === 0) {
                if (this.mesh) {
                    this.scene.remove(this.mesh);
                    
                    // Dispose of materials and geometry
                    if (this.mesh.children.length > 0) {
                        this.mesh.children.forEach(child => {
                            if (child instanceof THREE.Mesh) {
                                if (child.material) child.material.dispose();
                                if (child.geometry) child.geometry.dispose();
                            }
                        });
                    }
                    
                    this.mesh = null;
                }
                return;
            }
            
            // Create a group to hold both opaque and transparent meshes
            const group = new THREE.Group();
            
            // Set up opaque geometry if there are opaque faces
            if (opaqueFaceCount > 0) {
                opaqueGeometry.setAttribute('position', new THREE.Float32BufferAttribute(opaquePositions, 3));
                opaqueGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(opaqueNormals, 3));
                opaqueGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(opaqueUvs, 2));
                opaqueGeometry.setIndex(opaqueIndices);
                opaqueGeometry.computeBoundingSphere();
                
                // Create material for opaque blocks
                const opaqueMaterial = new THREE.MeshLambertMaterial({
                    map: this.textureManager.getTextureAtlas(),
                    transparent: false,
                    side: THREE.FrontSide,
                    depthWrite: true,
                    depthTest: true
                });
                
                // Create mesh for opaque blocks
                const opaqueMesh = new THREE.Mesh(opaqueGeometry, opaqueMaterial);
                opaqueMesh.position.set(
                    this.worldPosition.x,
                    this.worldPosition.y,
                    this.worldPosition.z
                );
                group.add(opaqueMesh);
            }
            
            // Set up transparent geometry if there are transparent faces
            if (transparentFaceCount > 0) {
                transparentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(transparentPositions, 3));
                transparentGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(transparentNormals, 3));
                transparentGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(transparentUvs, 2));
                transparentGeometry.setIndex(transparentIndices);
                transparentGeometry.computeBoundingSphere();
                
                // Create material for transparent blocks
                const transparentMaterial = new THREE.MeshLambertMaterial({
                    map: this.textureManager.getTextureAtlas(),
                    transparent: true,
                    alphaTest: 0.1,
                    side: THREE.DoubleSide,
                    depthWrite: false, // Important for correct transparency rendering
                    depthTest: true
                });
                
                // Create mesh for transparent blocks
                const transparentMesh = new THREE.Mesh(transparentGeometry, transparentMaterial);
                transparentMesh.position.set(
                    this.worldPosition.x,
                    this.worldPosition.y,
                    this.worldPosition.z
                );
                group.add(transparentMesh);
            }
            
            // Remove old mesh from scene
            if (this.mesh) {
                this.scene.remove(this.mesh);
                
                // Dispose of materials
                if (this.mesh.children.length > 0) {
                    this.mesh.children.forEach(child => {
                        if (child instanceof THREE.Mesh) {
                            if (child.material) child.material.dispose();
                            if (child.geometry) child.geometry.dispose();
                        }
                    });
                }
            }
            
            // Add the group to the scene
            this.scene.add(group);
            
            // Store the group as the mesh
            this.mesh = group;
            
            // Mark chunk as clean
            this.isDirty = false;
        } catch (error) {
            console.error('Error rebuilding chunk mesh:', error);
        }
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

    // Count the number of non-AIR blocks in the chunk
    public countNonAirBlocks(): number {
        let count = 0;
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    if (this.getBlock(x, y, z) !== BlockType.AIR) {
                        count++;
                    }
                }
            }
        }
        return count;
    }
    
    // Build the mesh immediately for initial loading
    public buildInitialMesh(): void {
        console.log(`Building initial mesh for chunk at (${this.position.x}, ${this.position.y}, ${this.position.z})`);
        this.rebuildMesh();
        this.isDirty = false;
    }
} 