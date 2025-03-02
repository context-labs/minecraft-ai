import * as THREE from 'three';
import { BlockType, Block } from '../world/Block';

export interface TextureCoordinates {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export class TextureManager {
    private textureAtlas: THREE.Texture;
    private textureSize: number = 16; // Size of each texture in the atlas
    private atlasSize: number = 256; // Size of the atlas texture
    private texturesPerRow: number = 16; // Number of textures per row in the atlas
    private isLoaded: boolean = false;
    
    constructor() {
        console.log('Initializing TextureManager...');
        
        // Create a fallback texture in case the atlas.png is not available
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 256;
        fallbackCanvas.height = 256;
        const ctx = fallbackCanvas.getContext('2d')!;
        
        // Fill with a simple pattern
        const colors = [
            '#7bac51', // 0: Grass top
            '#8c8c8c', // 1: Stone
            '#866043', // 2: Dirt
            '#6e9c4e', // 3: Grass side
            '#6e5530', // 4: Wood side
            '#a77d4c', // 5: Wood top
            '#3a5e25', // 6: Leaves
            '#2f5caa', // 7: Water
            '#dbce8e', // 8: Sand
            '#333333', // 9: Bedrock
            '#9c9c9c', // 10: Gravel
            '#ffffff', // 11: Snow
            '#a4a8b8', // 12: Clay
            '#565656', // 13: Coal Ore
            '#a88a6e', // 14: Iron Ore
            '#fcee4b', // 15: Gold Ore
            '#e6d7a8'  // 16: Sandstone
        ];
        
        // Fill background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 256, 256);
        
        // Draw each texture
        for (let i = 0; i < colors.length; i++) {
            const row = Math.floor(i / this.texturesPerRow);
            const col = i % this.texturesPerRow;
            
            ctx.fillStyle = colors[i];
            ctx.fillRect(
                col * this.textureSize,
                row * this.textureSize,
                this.textureSize,
                this.textureSize
            );
            
            // Add some details to make textures more recognizable
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            
            // Different patterns for different blocks
            switch (i) {
                case 0: // Grass top
                    for (let j = 0; j < 8; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        ctx.fillRect(x, y, 2, 2);
                    }
                    break;
                case 1: // Stone
                    ctx.fillRect(
                        col * this.textureSize + 4,
                        row * this.textureSize + 4,
                        8,
                        8
                    );
                    // Add cracks
                    ctx.beginPath();
                    ctx.moveTo(col * this.textureSize + 2, row * this.textureSize + 8);
                    ctx.lineTo(col * this.textureSize + 6, row * this.textureSize + 12);
                    ctx.lineTo(col * this.textureSize + 14, row * this.textureSize + 6);
                    ctx.stroke();
                    break;
                case 2: // Dirt
                    // Add small stones and roots
                    for (let j = 0; j < 6; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 1 + Math.random() * 2;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 3: // Grass side
                    ctx.fillRect(
                        col * this.textureSize,
                        row * this.textureSize,
                        this.textureSize,
                        4
                    );
                    // Add dirt texture
                    for (let j = 0; j < 5; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + 5 + Math.random() * 10;
                        const size = 1 + Math.random() * 2;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 4: // Wood side
                    for (let j = 0; j < 4; j++) {
                        ctx.fillRect(
                            col * this.textureSize + j * 4,
                            row * this.textureSize,
                            2,
                            this.textureSize
                        );
                    }
                    break;
                case 5: // Wood top
                    // Draw tree rings
                    ctx.beginPath();
                    ctx.arc(
                        col * this.textureSize + this.textureSize / 2,
                        row * this.textureSize + this.textureSize / 2,
                        6, 0, Math.PI * 2
                    );
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(
                        col * this.textureSize + this.textureSize / 2,
                        row * this.textureSize + this.textureSize / 2,
                        3, 0, Math.PI * 2
                    );
                    ctx.stroke();
                    break;
                case 6: // Leaves
                    for (let j = 0; j < 10; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        ctx.fillRect(x, y, 3, 3);
                    }
                    break;
                case 7: // Water
                    // Add wave pattern
                    ctx.beginPath();
                    for (let j = 0; j < 4; j++) {
                        ctx.moveTo(col * this.textureSize, row * this.textureSize + j * 4);
                        ctx.bezierCurveTo(
                            col * this.textureSize + 4, row * this.textureSize + j * 4 + 2,
                            col * this.textureSize + 12, row * this.textureSize + j * 4 - 2,
                            col * this.textureSize + this.textureSize, row * this.textureSize + j * 4
                        );
                    }
                    ctx.stroke();
                    break;
                case 8: // Sand
                    // Add small dots for sand grains
                    for (let j = 0; j < 20; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        ctx.fillRect(x, y, 1, 1);
                    }
                    break;
                case 9: // Bedrock
                    // Add rough texture
                    for (let j = 0; j < 8; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 2 + Math.random() * 3;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 10: // Gravel
                    // Add stone-like shapes
                    for (let j = 0; j < 6; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 2 + Math.random() * 4;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 11: // Snow
                    // Add sparkle effect
                    ctx.fillStyle = 'rgba(200, 200, 255, 0.8)';
                    for (let j = 0; j < 8; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        ctx.fillRect(x, y, 2, 2);
                    }
                    break;
                case 12: // Clay
                    // Add smooth texture with slight variations
                    for (let j = 0; j < 4; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 3 + Math.random() * 3;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 13: // Coal Ore
                    // Add stone texture
                    ctx.fillRect(
                        col * this.textureSize + 4,
                        row * this.textureSize + 4,
                        8,
                        8
                    );
                    // Add coal spots
                    ctx.fillStyle = '#000000';
                    for (let j = 0; j < 5; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 2 + Math.random() * 3;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 14: // Iron Ore
                    // Add stone texture
                    ctx.fillRect(
                        col * this.textureSize + 4,
                        row * this.textureSize + 4,
                        8,
                        8
                    );
                    // Add iron spots
                    ctx.fillStyle = '#d8af93';
                    for (let j = 0; j < 5; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 2 + Math.random() * 3;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 15: // Gold Ore
                    // Add stone texture
                    ctx.fillRect(
                        col * this.textureSize + 4,
                        row * this.textureSize + 4,
                        8,
                        8
                    );
                    // Add gold spots
                    ctx.fillStyle = '#ffdf00';
                    for (let j = 0; j < 5; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 2 + Math.random() * 3;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
                case 16: // Sandstone
                    // Add horizontal lines
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    for (let j = 0; j < 4; j++) {
                        ctx.fillRect(
                            col * this.textureSize,
                            row * this.textureSize + j * 4 + 2,
                            this.textureSize,
                            1
                        );
                    }
                    // Add some darker spots
                    ctx.fillStyle = 'rgba(160, 140, 90, 0.6)';
                    for (let j = 0; j < 8; j++) {
                        const x = col * this.textureSize + Math.random() * this.textureSize;
                        const y = row * this.textureSize + Math.random() * this.textureSize;
                        const size = 1 + Math.random() * 2;
                        ctx.fillRect(x, y, size, size);
                    }
                    break;
            }
        }
        
        console.log('Created fallback canvas texture');
        
        // Use the fallback canvas as initial texture
        this.textureAtlas = new THREE.CanvasTexture(fallbackCanvas);
        this.configureTexture(this.textureAtlas);
        
        // Try to load the atlas.png
        const loader = new THREE.TextureLoader();
        console.log('Attempting to load texture atlas from /textures/atlas.png');
        
        loader.load(
            '/textures/atlas.png', 
            (texture) => {
                console.log('Texture atlas loaded successfully');
                this.textureAtlas = texture;
                this.configureTexture(this.textureAtlas);
                this.isLoaded = true;
            },
            (xhr) => {
                console.log(`Texture atlas loading: ${(xhr.loaded / xhr.total * 100)}%`);
            },
            (err) => {
                console.warn('Failed to load texture atlas, using fallback', err);
            }
        );
    }
    
    private configureTexture(texture: THREE.Texture): void {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
    }
    
    public getTextureAtlas(): THREE.Texture {
        return this.textureAtlas;
    }
    
    public getTextureCoordinates(textureIndex: number): TextureCoordinates {
        if (textureIndex < 0) {
            // Special case for air blocks
            return {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            };
        }
        
        // Calculate the position of the texture in the atlas
        const row = Math.floor(textureIndex / this.texturesPerRow);
        const col = textureIndex % this.texturesPerRow;
        
        // Calculate UV coordinates
        const textureSizeNormalized = this.textureSize / this.atlasSize;
        const left = col * textureSizeNormalized;
        const right = (col + 1) * textureSizeNormalized;
        const top = 1 - row * textureSizeNormalized;
        const bottom = 1 - (row + 1) * textureSizeNormalized;
        
        return { left, right, top, bottom };
    }
    
    // Create a default texture atlas for development
    public static createDefaultTextureAtlas(): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        
        // Fill with a checkerboard pattern for debugging
        const colors = [
            '#7bac51', // 0: Grass top
            '#8c8c8c', // 1: Stone
            '#866043', // 2: Dirt
            '#6e9c4e', // 3: Grass side
            '#6e5530', // 4: Wood side
            '#a77d4c', // 5: Wood top
            '#3a5e25', // 6: Leaves
            '#2f5caa', // 7: Water
            '#dbce8e', // 8: Sand
            '#333333'  // 9: Bedrock
        ];
        
        const textureSize = 16;
        const texturesPerRow = 16;
        
        // Fill background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 256, 256);
        
        // Draw each texture
        for (let i = 0; i < colors.length; i++) {
            const row = Math.floor(i / texturesPerRow);
            const col = i % texturesPerRow;
            
            ctx.fillStyle = colors[i];
            ctx.fillRect(
                col * textureSize,
                row * textureSize,
                textureSize,
                textureSize
            );
            
            // Add some details to make textures more recognizable
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            
            // Different patterns for different blocks
            switch (i) {
                case 0: // Grass top
                    for (let j = 0; j < 5; j++) {
                        const x = col * textureSize + Math.random() * textureSize;
                        const y = row * textureSize + Math.random() * textureSize;
                        ctx.fillRect(x, y, 2, 2);
                    }
                    break;
                case 1: // Stone
                    ctx.fillRect(
                        col * textureSize + 4,
                        row * textureSize + 4,
                        8,
                        8
                    );
                    break;
                case 3: // Grass side
                    ctx.fillRect(
                        col * textureSize,
                        row * textureSize,
                        textureSize,
                        4
                    );
                    break;
                case 4: // Wood side
                    for (let j = 0; j < 4; j++) {
                        ctx.fillRect(
                            col * textureSize + j * 4,
                            row * textureSize,
                            2,
                            textureSize
                        );
                    }
                    break;
                case 6: // Leaves
                    for (let j = 0; j < 8; j++) {
                        const x = col * textureSize + Math.random() * textureSize;
                        const y = row * textureSize + Math.random() * textureSize;
                        ctx.fillRect(x, y, 3, 3);
                    }
                    break;
            }
        }
        
        return canvas;
    }
    
    // Load a texture atlas from a canvas
    public loadFromCanvas(canvas: HTMLCanvasElement): void {
        this.textureAtlas = new THREE.CanvasTexture(canvas);
        this.configureTexture(this.textureAtlas);
    }
    
    public getBlockMaterials(): Record<string, THREE.Material> {
        const materials: Record<string, THREE.Material> = {};
        
        // Create materials for each block type
        for (let type = 0; type < Object.keys(BlockType).length / 2; type++) {
            if (type === BlockType.AIR) continue; // Skip air blocks
            
            const blockData = Block.getBlockData(type as BlockType);
            
            // Create a standard material that can receive shadows
            const material = new THREE.MeshStandardMaterial({
                map: this.textureAtlas,
                transparent: blockData.transparent,
                opacity: blockData.transparent ? 0.8 : 1.0,
                side: blockData.transparent ? THREE.DoubleSide : THREE.FrontSide
            });
            
            // Add to materials dictionary
            materials[type] = material;
        }
        
        return materials;
    }
} 