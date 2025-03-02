import * as THREE from 'three';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { DebugUI } from '../ui/DebugUI';
import { SkySystem } from '../world/SkySystem';

export class Engine {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private world: World;
    private player: Player;
    private debugUI: DebugUI;
    private skySystem: SkySystem;
    private clock: THREE.Clock;
    private isRunning: boolean = false;

    constructor() {
        console.log('Initializing Engine...');
        
        // Initialize Three.js components
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(
            75, // Field of view
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near clipping plane
            1000 // Far clipping plane
        );
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        console.log('Initializing SkySystem...');
        this.skySystem = new SkySystem(this.scene);
        
        console.log('Initializing World...');
        // Initialize game components
        this.world = new World(this.scene);
        
        console.log('Initializing Player...');
        this.player = new Player(this.camera, this.scene, this.world);
        
        console.log('Initializing DebugUI...');
        this.debugUI = new DebugUI(this.player, this.world, this.skySystem);
        
        // Initialize clock for frame rate independent movement
        this.clock = new THREE.Clock();
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        console.log('Engine initialization complete');
    }
    
    public start(): void {
        if (!this.isRunning) {
            console.log('Starting engine...');
            this.isRunning = true;
            this.clock.start();
            
            console.log('Generating world...');
            this.world.generate();
            
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
        
        // Update game components
        this.skySystem.update(deltaTime);
        this.player.update(deltaTime);
        this.world.update(deltaTime, this.player.getPosition());
        this.debugUI.update();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
} 