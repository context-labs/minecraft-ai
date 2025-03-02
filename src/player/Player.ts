// Import Three.js properly
import * as THREE from 'three';
import { World } from '../world/World';
import { BlockType, Block } from '../world/Block';
import { PointerLockControls } from '../utils/PointerLockControls';

// Constants
const PLAYER_HEIGHT = 1.8;
const PLAYER_SPEED = 5.0;
const PLAYER_JUMP_FORCE = 8.0;
const GRAVITY = 20.0;
const REACH_DISTANCE = 5.0;
const MOUSE_SENSITIVITY = 0.002; // Default mouse sensitivity
const MAX_VERTICAL_ANGLE = Math.PI / 2 * 0.9; // Limit vertical rotation to 90% of 90 degrees

// Mining speeds for different block types (in seconds)
const MINING_SPEEDS: Record<BlockType, number> = {
    [BlockType.AIR]: 0,
    [BlockType.GRASS]: 0.3,
    [BlockType.DIRT]: 0.3,
    [BlockType.STONE]: 1.0,
    [BlockType.WOOD]: 0.6,
    [BlockType.LEAVES]: 0.2,
    [BlockType.WATER]: 0,
    [BlockType.SAND]: 0.3,
    [BlockType.BEDROCK]: Infinity, // Cannot be mined
    [BlockType.GRAVEL]: 0.4,
    [BlockType.SNOW]: 0.1,
    [BlockType.CLAY]: 0.4,
    [BlockType.COAL_ORE]: 1.2,
    [BlockType.IRON_ORE]: 1.5,
    [BlockType.GOLD_ORE]: 1.8,
    [BlockType.SANDSTONE]: 0.8
};

// Mining sounds mapping function
function getMiningSound(blockType: BlockType): string {
    switch (blockType) {
        case BlockType.GRASS:
            return 'grass';
        case BlockType.DIRT:
            return 'dirt';
        case BlockType.STONE:
        case BlockType.COAL_ORE:
        case BlockType.IRON_ORE:
        case BlockType.GOLD_ORE:
        case BlockType.SANDSTONE:
        case BlockType.BEDROCK:
            return 'stone';
        case BlockType.SAND:
            return 'sand';
        case BlockType.WOOD:
            return 'wood';
        case BlockType.LEAVES:
            return 'leaves';
        case BlockType.WATER:
            return 'splash';
        case BlockType.GRAVEL:
            return 'gravel';
        case BlockType.SNOW:
            return 'snow';
        case BlockType.CLAY:
            return 'gravel';
        default:
            return 'stone';
    }
}

export class Player {
    private camera: THREE.PerspectiveCamera;
    private controls: PointerLockControls;
    private scene: THREE.Scene;
    private world: World;
    
    private velocity: THREE.Vector3 = new THREE.Vector3();
    private position: THREE.Vector3 = new THREE.Vector3(0, 50, 0); // Start high up
    private onGround: boolean = false;
    private canJump: boolean = false;
    
    private moveForward: boolean = false;
    private moveBackward: boolean = false;
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private jump: boolean = false;
    
    private selectedBlockType: BlockType = BlockType.DIRT;
    
    // Mouse control variables
    private mouseSensitivity: number = MOUSE_SENSITIVITY;
    
    // Mining variables
    private isMining: boolean = false;
    private miningTime: number = 0;
    private miningBlock: { position: THREE.Vector3, blockType: BlockType } | null = null;
    private miningIndicator: HTMLElement | null = null;
    private crackMesh: THREE.Mesh | null = null;
    private miningSound: HTMLAudioElement | null = null;
    private breakSound: HTMLAudioElement | null = null;
    private lastMiningSound: number = 0;
    
    // Add these variables to the Player class properties
    private flightMode: boolean = false;
    private lastSpacePress: number = 0;
    private readonly DOUBLE_TAP_THRESHOLD: number = 300; // ms between taps to count as double-tap
    
    constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene, world: World) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        
        // Set initial position
        this.camera.position.copy(this.position);
        
        // Setup pointer lock controls
        this.controls = new PointerLockControls(this.camera, document.body);
        
        // Set mouse sensitivity
        this.controls.setMouseSensitivity(this.mouseSensitivity);
        
        scene.add(this.controls.getObject());
        
        // Add event listeners
        document.addEventListener('click', this.onClick.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        document.addEventListener('wheel', this.onWheel.bind(this));
        
        // Add lock/unlock event listeners
        this.controls.addEventListener('lock', this.onPointerLockChange.bind(this));
        this.controls.addEventListener('unlock', this.onPointerLockChange.bind(this));
        
        // Setup hotbar selection
        this.setupHotbar();
        
        // Show instructions
        this.showInstructions();
        
        // Setup additional event listeners
        this.setupEventListeners();
        
        // Add CSS for mining cracks
        this.addMiningStyles();
    }
    
    public update(deltaTime: number): void {
        // Update mining
        this.updateMining(deltaTime);
        
        if (!this.controls.isLocked) {
            return;
        }
        
        // Handle flight mode
        if (this.flightMode) {
            // In flight mode, space makes you go up
            if (this.jump) {
                this.velocity.y = 5; // Adjust this value for desired ascent speed
            } else {
                // No gravity in flight mode, maintain height
                this.velocity.y = 0;
            }
        } else {
            // Normal gravity in walking mode
            this.velocity.y -= 9.8 * deltaTime; // Assuming GRAVITY is 9.8
            
            // Handle jumping
            if (this.jump && this.canJump) {
                this.velocity.y = 5; // Assuming PLAYER_JUMP_FORCE is 5
                this.canJump = false;
            }
        }
        
        // Get camera position and direction
        const cameraPosition = this.camera.position.clone();
        const direction = this.getDirection();
        
        // Apply movement in camera direction
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        // Project camera direction onto XZ plane for movement
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        // Calculate forward and right vectors
        const forward = cameraDirection.clone();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
        
        // Apply movement - camera-relative movement approach
        let moveDirection = new THREE.Vector3(0, 0, 0);
        
        // Add forward/backward component (W/S keys)
        if (this.moveForward) {
            moveDirection.add(forward.clone());
        }
        if (this.moveBackward) {
            moveDirection.sub(forward.clone());
        }
        
        // Add left/right component (A/D keys)
        if (this.moveRight) {
            moveDirection.add(right.clone());
        }
        if (this.moveLeft) {
            moveDirection.sub(right.clone());
        }
        
        // Normalize if we're moving to maintain consistent speed in all directions
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
        }
        
        // Set velocity based on movement direction and player speed
        const playerSpeed = 5; // Assuming PLAYER_SPEED is 5
        this.velocity.x = moveDirection.x * playerSpeed;
        this.velocity.z = moveDirection.z * playerSpeed;
        
        // Apply velocity to position with collision detection
        this.move(deltaTime);
        
        // Update camera position
        const controlObject = this.controls.getObject();
        if (controlObject) {
            controlObject.position.copy(this.position);
            // Assuming PLAYER_HEIGHT is 1.6
            controlObject.position.y += 1.6;
        }
    }
    
    public getPosition(): THREE.Vector3 {
        return this.position.clone();
    }
    
    public getDirection(): THREE.Vector3 {
        try {
            if (!this.camera) {
                console.error('Camera is null in getDirection');
                return new THREE.Vector3(0, 0, -1); // Default direction
            }
            
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Validate direction
            if (isNaN(direction.x) || isNaN(direction.y) || isNaN(direction.z)) {
                console.error('Invalid direction vector generated:', direction);
                return new THREE.Vector3(0, 0, -1); // Default direction
            }
            
            return direction;
        } catch (error) {
            console.error('Error in getDirection method:', error);
            return new THREE.Vector3(0, 0, -1); // Default direction
        }
    }
    
    public getSelectedBlockType(): BlockType {
        return this.selectedBlockType;
    }
    
    public setSelectedBlockType(type: BlockType): void {
        this.selectedBlockType = type;
        this.updateHotbarSelection();
    }
    
    private move(deltaTime: number): void {
        // Calculate new position
        const newPosition = this.position.clone();
        newPosition.x += this.velocity.x * deltaTime;
        newPosition.y += this.velocity.y * deltaTime;
        newPosition.z += this.velocity.z * deltaTime;
        
        // Check for collisions
        const playerRadius = 0.3;
        const playerHeight = PLAYER_HEIGHT;
        
        // Check X axis collision
        if (!this.checkCollision(
            newPosition.x, this.position.y, this.position.z,
            playerRadius, playerHeight
        )) {
            this.position.x = newPosition.x;
        } else {
            this.velocity.x = 0;
        }
        
        // Check Z axis collision
        if (!this.checkCollision(
            this.position.x, this.position.y, newPosition.z,
            playerRadius, playerHeight
        )) {
            this.position.z = newPosition.z;
        } else {
            this.velocity.z = 0;
        }
        
        // Check Y axis collision (up)
        if (this.velocity.y > 0) {
            if (!this.checkCollision(
                this.position.x, newPosition.y, this.position.z,
                playerRadius, playerHeight
            )) {
                this.position.y = newPosition.y;
            } else {
                this.velocity.y = 0;
            }
        } else {
            // Check Y axis collision (down)
            if (!this.checkCollision(
                this.position.x, newPosition.y, this.position.z,
                playerRadius, playerHeight
            )) {
                this.position.y = newPosition.y;
                this.onGround = false;
                this.canJump = false;
            } else {
                // We hit the ground
                this.velocity.y = 0;
                this.onGround = true;
                this.canJump = true;
            }
        }
    }
    
    private checkCollision(x: number, y: number, z: number, radius: number, height: number): boolean {
        // Check a box around the player for collisions
        const minX = Math.floor(x - radius);
        const maxX = Math.floor(x + radius);
        const minY = Math.floor(y);
        const maxY = Math.floor(y + height);
        const minZ = Math.floor(z - radius);
        const maxZ = Math.floor(z + radius);
        
        for (let bx = minX; bx <= maxX; bx++) {
            for (let by = minY; by <= maxY; by++) {
                for (let bz = minZ; bz <= maxZ; bz++) {
                    const blockType = this.world.getBlock(bx, by, bz);
                    
                    if (blockType !== BlockType.AIR && blockType !== BlockType.WATER) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    private onClick(event: MouseEvent): void {
        // Lock pointer on first click
        if (!this.controls.isLocked) {
            this.controls.lock();
            return;
        }
        
        try {
            // Get camera position and direction
            const cameraPosition = this.camera.position.clone();
            
            // Add defensive checks for camera position
            if (!cameraPosition || isNaN(cameraPosition.x) || isNaN(cameraPosition.y) || isNaN(cameraPosition.z)) {
                console.error('Invalid camera position:', cameraPosition);
                return;
            }
            
            const direction = this.getDirection();
            
            // Ensure direction is valid
            if (!direction || isNaN(direction.x) || isNaN(direction.y) || isNaN(direction.z)) {
                console.error('Invalid direction vector:', direction);
                return;
            }
            
            // Debug log
            console.log('Raycasting from', cameraPosition, 'in direction', direction);
            
            // Raycast to find block
            const rayResult = this.world.raycast(
                cameraPosition,
                direction,
                REACH_DISTANCE
            );
            
            // Debug log
            console.log('Raycast result:', rayResult);
            
            if (!rayResult) {
                this.stopMining();
                return;
            }
            
            // Left click: start mining block
            if (event.button === 0) {
                // Add defensive checks
                if (rayResult.position && !isNaN(rayResult.position.x) && !isNaN(rayResult.position.y) && !isNaN(rayResult.position.z)) {
                    // Start mining the block
                    this.startMining(rayResult.position, rayResult.blockType);
                } else {
                    console.error('Invalid rayResult position for block breaking:', rayResult.position);
                }
            }
            
            // Right click: place block
            if (event.button === 2) {
                // Add defensive checks
                if (!rayResult.position || !rayResult.normal) {
                    console.error('Invalid rayResult for block placement:', rayResult);
                    return;
                }
                
                // Calculate position to place block
                const placePos = rayResult.position.clone().add(rayResult.normal);
                
                // Check if the position is not inside the player
                const playerPos = this.position.clone();
                playerPos.y += PLAYER_HEIGHT / 2;
                
                if (playerPos.distanceTo(placePos) > 1) {
                    this.world.setBlock(
                        placePos.x,
                        placePos.y,
                        placePos.z,
                        this.selectedBlockType
                    );
                }
            }
        } catch (error) {
            console.error('Error in onClick handler:', error);
        }
    }
    
    private onPointerLockChange(): void {
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.style.display = this.controls.isLocked ? 'none' : 'flex';
        }
    }
    
    private showInstructions(): void {
        // Create instructions element if it doesn't exist
        let instructions = document.getElementById('instructions');
        if (!instructions) {
            const blocker = document.createElement('div');
            blocker.id = 'blocker';
            blocker.style.position = 'absolute';
            blocker.style.width = '100%';
            blocker.style.height = '100%';
            blocker.style.backgroundColor = 'rgba(0,0,0,0.5)';
            blocker.style.zIndex = '1000';
            
            instructions = document.createElement('div');
            instructions.id = 'instructions';
            instructions.style.width = '100%';
            instructions.style.height = '100%';
            instructions.style.display = 'flex';
            instructions.style.flexDirection = 'column';
            instructions.style.justifyContent = 'center';
            instructions.style.alignItems = 'center';
            instructions.style.color = '#ffffff';
            instructions.style.textAlign = 'center';
            instructions.style.cursor = 'pointer';
            instructions.style.fontSize = '16px';
            
            instructions.innerHTML = `
                <span style="font-size:36px">Click to play</span>
                <br />
                <span>WASD = Move, SPACE = Jump, MOUSE = Look around</span>
                <br />
                <span>Left Click = Break block, Right Click = Place block</span>
                <br />
                <span>1-6 = Select block type, Mouse Wheel = Cycle through blocks</span>
                <br />
                <span>ESC = Release mouse</span>
            `;
            
            blocker.appendChild(instructions);
            document.body.appendChild(blocker);
            
            // Add click event to lock pointer
            instructions.addEventListener('click', () => {
                this.controls.lock();
            });
        }
    }
    
    private onKeyDown(event: KeyboardEvent): void {
        // Prevent handling repeated keydown events (when key is held down)
        if (event.repeat) return;
        
        switch (event.code) {
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'KeyD':
                this.moveRight = true;
                break;
            case 'Space':
                this.jump = true;
                
                // Check for double-tap space to toggle flight
                const now = Date.now();
                if (now - this.lastSpacePress < this.DOUBLE_TAP_THRESHOLD) {
                    // Double tap detected, toggle flight mode
                    this.flightMode = !this.flightMode;
                    console.log(`Flight mode ${this.flightMode ? 'enabled' : 'disabled'}`);
                    
                    // Show flight mode status
                    this.showFlightModeStatus();
                    
                    // Reset jump state if entering flight mode
                    if (this.flightMode) {
                        this.velocity.y = 0;
                    }
                }
                this.lastSpacePress = now;
                break;
            case 'Digit1':
                this.setSelectedBlockType(BlockType.DIRT);
                break;
            case 'Digit2':
                this.setSelectedBlockType(BlockType.STONE);
                break;
            case 'Digit3':
                this.setSelectedBlockType(BlockType.GRASS);
                break;
            case 'Digit4':
                this.setSelectedBlockType(BlockType.WOOD);
                break;
            case 'Digit5':
                this.setSelectedBlockType(BlockType.LEAVES);
                break;
            case 'Digit6':
                this.setSelectedBlockType(BlockType.SAND);
                break;
            case 'Escape':
                this.controls.unlock();
                break;
        }
    }
    
    private onKeyUp(event: KeyboardEvent): void {
        switch (event.code) {
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'KeyD':
                this.moveRight = false;
                break;
            case 'Space':
                this.jump = false;
                break;
        }
    }
    
    private onWheel(event: WheelEvent): void {
        // Scroll through hotbar
        const hotbarItems = [
            BlockType.DIRT,
            BlockType.STONE,
            BlockType.GRASS,
            BlockType.WOOD,
            BlockType.LEAVES,
            BlockType.SAND,
            BlockType.WATER,
            BlockType.BEDROCK
        ];
        
        const currentIndex = hotbarItems.indexOf(this.selectedBlockType);
        let newIndex = currentIndex;
        
        if (event.deltaY > 0) {
            // Scroll down
            newIndex = (currentIndex + 1) % hotbarItems.length;
        } else {
            // Scroll up
            newIndex = (currentIndex - 1 + hotbarItems.length) % hotbarItems.length;
        }
        
        this.setSelectedBlockType(hotbarItems[newIndex]);
    }
    
    private setupHotbar(): void {
        // Prevent context menu on right click
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // Set initial hotbar selection
        this.updateHotbarSelection();
    }
    
    private updateHotbarSelection(): void {
        const hotbarSlots = document.querySelectorAll('.hotbar-slot');
        
        // Clear all selections
        hotbarSlots.forEach((slot, index) => {
            slot.classList.remove('selected');
            
            // Set selection based on block type
            switch (this.selectedBlockType) {
                case BlockType.DIRT:
                    if (index === 0) slot.classList.add('selected');
                    break;
                case BlockType.STONE:
                    if (index === 1) slot.classList.add('selected');
                    break;
                case BlockType.GRASS:
                    if (index === 2) slot.classList.add('selected');
                    break;
                case BlockType.WOOD:
                    if (index === 3) slot.classList.add('selected');
                    break;
                case BlockType.LEAVES:
                    if (index === 4) slot.classList.add('selected');
                    break;
                case BlockType.SAND:
                    if (index === 5) slot.classList.add('selected');
                    break;
                case BlockType.WATER:
                    if (index === 6) slot.classList.add('selected');
                    break;
                case BlockType.BEDROCK:
                    if (index === 7) slot.classList.add('selected');
                    break;
            }
        });
    }
    
    private startMining(position: THREE.Vector3, blockType: BlockType): void {
        // Don't mine air, water, or bedrock
        if (blockType === BlockType.AIR || blockType === BlockType.WATER || blockType === BlockType.BEDROCK) {
            return;
        }
        
        // Start mining
        this.isMining = true;
        this.miningTime = 0;
        this.miningBlock = { position: position.clone(), blockType };
        
        // Create or update mining indicator
        this.createMiningIndicator();
        
        // Create crack mesh
        this.createCrackMesh(position);
        
        // Play initial mining sound
        this.playMiningSound(blockType);
    }
    
    private stopMining(): void {
        this.isMining = false;
        this.miningTime = 0;
        this.miningBlock = null;
        
        // Remove mining indicator
        this.removeMiningIndicator();
        
        // Remove crack mesh
        this.removeCrackMesh();
        
        // Stop mining sound
        this.stopMiningSound();
    }
    
    private updateMining(deltaTime: number): void {
        if (!this.isMining || !this.miningBlock) {
            return;
        }
        
        // Check if we're still looking at the same block
        const cameraPosition = this.camera.position.clone();
        const direction = this.getDirection();
        
        const rayResult = this.world.raycast(
            cameraPosition,
            direction,
            REACH_DISTANCE
        );
        
        // If we're no longer looking at the same block, stop mining
        if (!rayResult || 
            !rayResult.position.equals(this.miningBlock.position) || 
            rayResult.blockType !== this.miningBlock.blockType) {
            this.stopMining();
            return;
        }
        
        // Get mining speed for this block type
        const miningSpeed = MINING_SPEEDS[this.miningBlock.blockType];
        
        // Skip if block cannot be mined (bedrock)
        if (miningSpeed === Infinity) {
            this.stopMining();
            return;
        }
        
        // Update mining time
        this.miningTime += deltaTime;
        
        // Calculate progress (0 to 1)
        const progress = this.miningTime / miningSpeed;
        
        // Update mining indicator
        this.updateMiningIndicator(progress);
        
        // Update crack mesh
        this.updateCrackMesh(progress);
        
        // Play mining sound at intervals
        if (Date.now() - this.lastMiningSound > 250) {
            this.playMiningSound(this.miningBlock.blockType);
        }
        
        // Check if mining is complete
        if (this.miningTime >= miningSpeed) {
            // Mine the block
            this.world.setBlock(
                this.miningBlock.position.x,
                this.miningBlock.position.y,
                this.miningBlock.position.z,
                BlockType.AIR
            );
            
            // Play break sound
            this.playBreakSound(this.miningBlock.blockType);
            
            // Stop mining
            this.stopMining();
        }
    }
    
    private createMiningIndicator(): void {
        // Remove existing indicator if it exists
        this.removeMiningIndicator();
        
        // Create a new indicator
        const indicator = document.createElement('div');
        indicator.className = 'mining-indicator';
        
        // Create progress bar
        const progress = document.createElement('div');
        progress.className = 'mining-progress';
        
        // Add progress to indicator
        indicator.appendChild(progress);
        
        // Add indicator to document
        document.body.appendChild(indicator);
        
        // Store reference
        this.miningIndicator = indicator;
        
        // Add styles if they don't exist
        if (!document.getElementById('mining-indicator-styles')) {
            this.addMiningStyles();
        }
    }
    
    private updateMiningIndicator(progress: number): void {
        if (!this.miningIndicator) return;
        
        const progressEl = this.miningIndicator.querySelector('.mining-progress');
        if (progressEl) {
            (progressEl as HTMLElement).style.width = `${progress * 100}%`;
        }
    }
    
    private removeMiningIndicator(): void {
        if (this.miningIndicator && this.miningIndicator.parentNode) {
            this.miningIndicator.parentNode.removeChild(this.miningIndicator);
        }
        this.miningIndicator = null;
    }

    // Add event listener for mouseup to stop mining when mouse button is released
    private setupEventListeners(): void {
        document.addEventListener('mouseup', (event: MouseEvent) => {
            if (event.button === 0) { // Left mouse button
                this.stopMining();
            }
        });
    }

    private addMiningStyles(): void {
        const styleEl = document.createElement('style');
        styleEl.id = 'mining-indicator-styles';
        styleEl.textContent = `
            .mining-indicator {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                width: 200px;
                height: 10px;
                background-color: rgba(0, 0, 0, 0.5);
                border-radius: 5px;
                overflow: hidden;
            }
            .mining-progress {
                height: 100%;
                width: 0%;
                background-color: white;
                transition: width 0.1s ease-out;
            }
        `;
        document.head.appendChild(styleEl);
    }

    private createCrackMesh(position: THREE.Vector3): void {
        // Remove existing crack mesh if it exists
        this.removeCrackMesh();
        
        // Create a slightly larger cube to overlay on the block
        const geometry = new THREE.BoxGeometry(1.001, 1.001, 1.001);
        
        // Create a material with opacity for the crack effect
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.2,
            depthTest: true,
            depthWrite: false,
            wireframe: true
        });
        
        // Create the mesh
        this.crackMesh = new THREE.Mesh(geometry, material);
        
        // Position the mesh at the block position
        this.crackMesh.position.copy(position.clone().add(new THREE.Vector3(0.5, 0.5, 0.5)));
        
        // Add to scene
        this.scene.add(this.crackMesh);
    }
    
    private updateCrackMesh(progress: number): void {
        if (!this.crackMesh) return;
        
        // Update the crack mesh based on progress
        const material = this.crackMesh.material as THREE.MeshBasicMaterial;
        
        // Increase opacity and line thickness as mining progresses
        material.opacity = 0.2 + progress * 0.3;
        
        // Change wireframe density based on progress
        if (progress > 0.75) {
            material.wireframe = false;
        } else {
            material.wireframe = true;
        }
    }
    
    private removeCrackMesh(): void {
        if (this.crackMesh) {
            this.scene.remove(this.crackMesh);
            this.crackMesh.geometry.dispose();
            (this.crackMesh.material as THREE.Material).dispose();
            this.crackMesh = null;
        }
    }

    private playMiningSound(blockType: BlockType): void {
        // Get the sound type for this block
        const soundType = getMiningSound(blockType);
        
        // Create audio element if it doesn't exist
        if (!this.miningSound) {
            this.miningSound = new Audio(`/sounds/dig/${soundType}.mp3`);
            this.miningSound.volume = 0.3;
        } else {
            // Update the source if it's a different block type
            this.miningSound.src = `/sounds/dig/${soundType}.mp3`;
        }
        
        // Play the sound
        this.miningSound.currentTime = 0;
        this.miningSound.play().catch(e => console.error("Error playing mining sound:", e));
        
        // Update last mining sound time
        this.lastMiningSound = Date.now();
    }
    
    private playBreakSound(blockType: BlockType): void {
        // Get the sound type for this block
        const soundType = getMiningSound(blockType);
        
        // Create audio element if it doesn't exist
        if (!this.breakSound) {
            this.breakSound = new Audio(`/sounds/dig/${soundType}.mp3`);
            this.breakSound.volume = 0.5;
        } else {
            // Update the source if it's a different block type
            this.breakSound.src = `/sounds/dig/${soundType}.mp3`;
        }
        
        // Play the sound
        this.breakSound.currentTime = 0;
        this.breakSound.play().catch(e => console.error("Error playing break sound:", e));
    }
    
    private stopMiningSound(): void {
        if (this.miningSound) {
            this.miningSound.pause();
            this.miningSound.currentTime = 0;
        }
    }

    // Add a method to show flight mode status
    private showFlightModeStatus(): void {
        const statusElement = document.createElement('div');
        statusElement.style.position = 'fixed';
        statusElement.style.top = '20%';
        statusElement.style.left = '50%';
        statusElement.style.transform = 'translateX(-50%)';
        statusElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        statusElement.style.color = 'white';
        statusElement.style.padding = '10px 20px';
        statusElement.style.borderRadius = '5px';
        statusElement.style.fontFamily = 'Arial, sans-serif';
        statusElement.style.zIndex = '1000';
        statusElement.style.transition = 'opacity 2s';
        statusElement.textContent = this.flightMode ? 'Flight Mode: ON' : 'Flight Mode: OFF';
        
        document.body.appendChild(statusElement);
        
        // Fade out and remove after 2 seconds
        setTimeout(() => {
            statusElement.style.opacity = '0';
            setTimeout(() => {
                if (statusElement.parentNode) {
                    statusElement.parentNode.removeChild(statusElement);
                }
            }, 2000);
        }, 1000);
    }

    // Update the getter method to use the renamed property
    public isFlying(): boolean {
        return this.flightMode;
    }
} 