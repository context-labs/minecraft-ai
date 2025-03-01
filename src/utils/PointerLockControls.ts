import * as THREE from 'three';

export class PointerLockControls {
    private camera: THREE.Camera;
    private domElement: HTMLElement;
    public isLocked: boolean = false;
    private eventListeners: { [key: string]: ((event: any) => void)[] } = {
        'lock': [],
        'unlock': []
    };
    
    // Euler angles for rotation
    private euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
    
    // Mouse sensitivity
    private mouseSensitivity: number = 0.002;
    
    // Maximum vertical angle (radians)
    private maxVerticalAngle: number = Math.PI / 2 * 0.9;
    
    constructor(camera: THREE.Camera, domElement: HTMLElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Setup event listeners
        this.domElement.addEventListener('click', () => {
            if (!this.isLocked) {
                this.lock();
            }
        });
        
        document.addEventListener('pointerlockchange', this.onPointerlockChange.bind(this));
        document.addEventListener('mozpointerlockchange', this.onPointerlockChange.bind(this));
        document.addEventListener('webkitpointerlockchange', this.onPointerlockChange.bind(this));
        
        // Add mouse move event listener
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
    }
    
    private onPointerlockChange(): void {
        const wasLocked = this.isLocked;
        this.isLocked = document.pointerLockElement === this.domElement ||
                        (document as any).mozPointerLockElement === this.domElement ||
                        (document as any).webkitPointerLockElement === this.domElement;
        
        // Dispatch appropriate event
        if (this.isLocked && !wasLocked) {
            this.dispatchEvent({ type: 'lock' });
        } else if (!this.isLocked && wasLocked) {
            this.dispatchEvent({ type: 'unlock' });
        }
    }
    
    private onMouseMove(event: MouseEvent): void {
        if (!this.isLocked) return;
        
        // Get mouse movement
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        // Update euler angles
        this.euler.setFromQuaternion(this.camera.quaternion);
        
        // Apply horizontal rotation (y-axis)
        this.euler.y -= movementX * this.mouseSensitivity;
        
        // Apply vertical rotation (x-axis) with limits
        this.euler.x -= movementY * this.mouseSensitivity;
        this.euler.x = Math.max(-this.maxVerticalAngle, Math.min(this.maxVerticalAngle, this.euler.x));
        
        // Apply rotation to camera
        this.camera.quaternion.setFromEuler(this.euler);
    }
    
    public lock(): void {
        this.domElement.requestPointerLock = this.domElement.requestPointerLock ||
                                            (this.domElement as any).mozRequestPointerLock ||
                                            (this.domElement as any).webkitRequestPointerLock;
        this.domElement.requestPointerLock();
    }
    
    public unlock(): void {
        document.exitPointerLock = document.exitPointerLock ||
                                  (document as any).mozExitPointerLock ||
                                  (document as any).webkitExitPointerLock;
        document.exitPointerLock();
    }
    
    public getObject(): THREE.Object3D {
        return this.camera;
    }
    
    // Set mouse sensitivity
    public setMouseSensitivity(sensitivity: number): void {
        this.mouseSensitivity = sensitivity;
    }
    
    // Event handling methods
    public addEventListener(event: string, callback: (event: any) => void): void {
        if (this.eventListeners[event]) {
            this.eventListeners[event].push(callback);
        }
    }
    
    public removeEventListener(event: string, callback: (event: any) => void): void {
        if (this.eventListeners[event]) {
            const index = this.eventListeners[event].indexOf(callback);
            if (index !== -1) {
                this.eventListeners[event].splice(index, 1);
            }
        }
    }
    
    public dispatchEvent(event: { type: string }): void {
        if (this.eventListeners[event.type]) {
            this.eventListeners[event.type].forEach(callback => callback(event));
        }
    }
} 