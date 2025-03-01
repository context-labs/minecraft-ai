import * as THREE from 'three';
import { Player } from '../player/Player';
import { World } from '../world/World';
import { BlockType } from '../world/Block';

export class DebugUI {
    private player: Player;
    private world: World;
    private debugElement: HTMLElement | null;
    private fpsCounter: FPSCounter;
    
    constructor(player: Player, world: World) {
        this.player = player;
        this.world = world;
        this.debugElement = document.getElementById('debug-info');
        this.fpsCounter = new FPSCounter();
    }
    
    public update(): void {
        if (!this.debugElement) return;
        
        this.fpsCounter.update();
        
        const position = this.player.getPosition();
        const direction = this.player.getDirection();
        const selectedBlock = this.player.getSelectedBlockType();
        
        // Format position with 2 decimal places
        const posX = position.x.toFixed(2);
        const posY = position.y.toFixed(2);
        const posZ = position.z.toFixed(2);
        
        // Format direction with 2 decimal places
        const dirX = direction.x.toFixed(2);
        const dirY = direction.y.toFixed(2);
        const dirZ = direction.z.toFixed(2);
        
        // Get block name
        const blockName = this.getBlockName(selectedBlock);
        
        // Update debug info
        this.debugElement.innerHTML = `
            FPS: ${this.fpsCounter.getFPS()}<br>
            Position: ${posX}, ${posY}, ${posZ}<br>
            Direction: ${dirX}, ${dirY}, ${dirZ}<br>
            Selected Block: ${blockName}<br>
            Controls: WASD = Move, Space = Jump, Mouse = Look<br>
            Left Click = Break, Right Click = Place<br>
            1-6 = Select Block, Scroll = Cycle Blocks<br>
            ESC = Release Mouse
        `;
    }
    
    private getBlockName(type: BlockType): string {
        switch (type) {
            case BlockType.AIR: return 'Air';
            case BlockType.GRASS: return 'Grass';
            case BlockType.DIRT: return 'Dirt';
            case BlockType.STONE: return 'Stone';
            case BlockType.WOOD: return 'Wood';
            case BlockType.LEAVES: return 'Leaves';
            case BlockType.WATER: return 'Water';
            case BlockType.SAND: return 'Sand';
            case BlockType.BEDROCK: return 'Bedrock';
            default: return 'Unknown';
        }
    }
}

class FPSCounter {
    private frames: number = 0;
    private lastTime: number = 0;
    private fps: number = 0;
    
    constructor() {
        this.lastTime = performance.now();
    }
    
    public update(): void {
        this.frames++;
        
        const now = performance.now();
        const elapsed = now - this.lastTime;
        
        // Update FPS every second
        if (elapsed >= 1000) {
            this.fps = Math.round((this.frames * 1000) / elapsed);
            this.frames = 0;
            this.lastTime = now;
        }
    }
    
    public getFPS(): number {
        return this.fps;
    }
} 