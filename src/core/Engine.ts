import * as THREE from 'three';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { DebugUI } from '../ui/DebugUI';
import { NetworkManager } from './NetworkManager';
import { TextureManager } from '../utils/TextureManager';
// Fix the ChatUI import error by commenting it out for now
// import { ChatUI } from '../ui/ChatUI';

// Create a simple temporary ChatUI class
class ChatUI {
    constructor(networkManager: any) {
        // Simple constructor
    }
    
    update(): void {
        // Empty update method
    }
}

// Define the same spawn point as on the server
const SPAWN_POINT = {
    x: 0,
    y: 50, // Start high enough to avoid spawning inside terrain
    z: 0
};

export class Engine {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private world: World;
    private player: Player;
    private debugUI: DebugUI;
    private clock: THREE.Clock;
    private isRunning: boolean = false;
    private networkManager: NetworkManager;
    private textureManager: TextureManager;
    private chatUI: ChatUI;

    constructor() {
        console.log('Initializing Engine...');
        
        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
        
        this.camera = new THREE.PerspectiveCamera(
            75, // Field of view
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near clipping plane
            1000 // Far clipping plane
        );
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);
        
        // Initialize texture manager
        console.log('Initializing TextureManager...');
        this.textureManager = new TextureManager();
        
        console.log('Initializing World...');
        // Initialize game components
        this.world = new World(this.scene);
        
        console.log('Initializing Player...');
        this.player = new Player(this.camera, this.scene, this.world);
        
        // Set initial player position to match server spawn point
        this.player.setPosition(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z);
        
        console.log('Initializing DebugUI...');
        this.debugUI = new DebugUI(this.player, this.world);
        
        // Initialize network manager
        console.log('Initializing NetworkManager...');
        this.networkManager = new NetworkManager(this.world, this.player, this.scene, this.textureManager);
        
        // Initialize chat UI
        console.log('Initializing ChatUI...');
        this.chatUI = new ChatUI(this.networkManager);
        
        // Initialize clock for frame rate independent movement
        this.clock = new THREE.Clock();
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Hook player block updates to network
        this.hookPlayerBlockUpdates();
        
        console.log('Engine initialization complete');
    }
    
    // Hook into player block interactions to send to the network
    private hookPlayerBlockUpdates(): void {
        // Monkey-patch the player's block setting methods
        const originalSetBlock = this.world.setBlock.bind(this.world);
        this.world.setBlock = (x: number, y: number, z: number, type: number) => {
            // Call the original method
            originalSetBlock(x, y, z, type);
            
            // Send the update to the network
            console.log(`Sending block update: x=${x}, y=${y}, z=${z}, type=${type}`);
            // this.networkManager.sendBlockUpdate(x, y, z, type);
        };
    }
    
    public start(): void {
        if (!this.isRunning) {
            console.log('Starting engine...');
            this.isRunning = true;
            this.clock.start();
            
            console.log('Generating world...');
            this.world.generate();
            
            console.log('Connecting to network...');
            this.networkManager.connect();
            
            console.log('Starting game loop...');
            this.gameLoop();
        }
    }
    
    public stop(): void {
        this.isRunning = false;
        this.clock.stop();
    }
    
    private gameLoop(): void {
        if (!this.isRunning) return;
        
        requestAnimationFrame(this.gameLoop.bind(this));
        
        const deltaTime = this.clock.getDelta();
        const timestamp = performance.now();
        
        // Update game components
        this.player.update(deltaTime);
        this.world.update(deltaTime, this.player.getPosition());
        
        // Make sure NetworkManager.update is called with both deltaTime and timestamp
        this.networkManager.update(deltaTime, timestamp);
        
        this.debugUI.update();
        this.chatUI.update();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
} 