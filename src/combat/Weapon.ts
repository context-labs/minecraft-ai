import * as THREE from 'three';
import { Player } from '../player/Player';
import { Projectile } from './Projectile';
import { World } from '../world/World';
import { NetworkManager } from '../core/NetworkManager';
import { CombatManager } from './CombatManager';

// Weapon types
export enum WeaponType {
    SWORD,
    PISTOL,
    RIFLE
}

// Base weapon class
export abstract class Weapon {
    protected name: string;
    protected damage: number;
    protected range: number;
    protected cooldown: number; // Time between attacks in milliseconds
    protected lastAttackTime: number = 0;
    protected type: WeaponType;
    protected model: THREE.Object3D | null = null;
    protected owner: Player | null = null;
    protected isEquipped: boolean = false;
    protected scene: THREE.Scene | null = null;
    protected networkManager: NetworkManager | null = null;
    protected combatManager: CombatManager | null = null;
    
    // Animation properties
    protected isAnimating: boolean = false;
    protected animationTime: number = 0;
    protected animationDuration: number = 300; // milliseconds
    
    // Bobbing effect properties
    protected originalPosition: THREE.Vector3 | null = null;
    protected originalRotation: THREE.Euler | null = null;
    protected bobAmount: number = 0.03;
    protected bobSpeed: number = 5;
    protected bobTime: number = 0;
    protected lastMouseX: number = 0;
    protected lastMouseY: number = 0;
    protected swayAmount: number = 0.05;
    
    constructor(name: string, damage: number, range: number, cooldown: number, type: WeaponType) {
        console.log(`[Weapon] Created weapon: ${name}, damage: ${damage}, range: ${range}, cooldown: ${cooldown}`);
        this.name = name;
        this.damage = damage;
        this.range = range;
        this.cooldown = cooldown;
        this.type = type;
    }
    
    public getName(): string {
        return this.name;
    }
    
    public getDamage(): number {
        return this.damage;
    }
    
    public getRange(): number {
        return this.range;
    }
    
    public getType(): WeaponType {
        return this.type;
    }
    
    public setOwner(player: Player): void {
        console.log(`[Weapon] Setting owner for ${this.name}`);
        this.owner = player;
    }
    
    public setScene(scene: THREE.Scene): void {
        this.scene = scene;
    }
    
    public isReady(): boolean {
        return Date.now() - this.lastAttackTime >= this.cooldown;
    }
    
    public equip(scene: THREE.Scene, owner: Player): void {
        this.scene = scene;
        this.owner = owner;
        
        console.log(`[Weapon] ${this.name} equipped`);
        
        // Create model if it doesn't exist
        if (!this.model) {
            this.model = this.createModel();
            this.scene.add(this.model);
        }
        
        // Position the weapon in view
        this.positionInView();
    }
    
    public unequip(): void {
        console.log(`[Weapon] ${this.name} unequipped`);
        
        // Remove model from scene
        if (this.model && this.scene) {
            this.scene.remove(this.model);
        }
        
        this.scene = null;
    }
    
    // Position the weapon in the camera view
    protected positionInView(): void {
        if (!this.model || !this.owner) return;
        
        // Get camera
        const camera = this.owner.getCamera();
        if (!camera) return;
        
        // Add the model to the camera
        camera.add(this.model);
        
        // Position based on weapon type
        switch (this.type) {
            case WeaponType.SWORD:
                this.model.position.set(0.5, -0.5, -0.7);
                this.model.rotation.set(0, -Math.PI / 4, 0);
                break;
            case WeaponType.PISTOL:
                this.model.position.set(0.3, -0.3, -0.7);
                this.model.rotation.set(0, 0, 0);
                break;
            case WeaponType.RIFLE:
                this.model.position.set(0.3, -0.4, -0.9);
                this.model.rotation.set(0, 0, 0);
                break;
        }
    }
    
    public update(deltaTime: number): void {
        // Update animation if active
        if (this.isAnimating) {
            this.animationTime += deltaTime * 1000; // Convert to milliseconds
            
            if (this.animationTime >= this.animationDuration) {
                // Animation complete
                this.isAnimating = false;
                this.animationTime = 0;
                this.resetAnimation();
            } else {
                // Update animation
                this.updateAnimation(this.animationTime / this.animationDuration);
            }
        }
        
        // Update weapon bobbing when player is moving
        this.updateBobbing(deltaTime);
        
        // Update weapon sway when player looks around
        this.updateSway(deltaTime);
    }
    
    // Update weapon bobbing effect
    protected updateBobbing(deltaTime: number): void {
        if (!this.model || !this.owner) return;
        
        // Store original position if not already stored
        if (!this.originalPosition) {
            this.originalPosition = this.model.position.clone();
        }
        
        // Check if player is moving
        const isMoving = this.owner.isMoving();
        
        if (isMoving) {
            // Update bob time
            this.bobTime += deltaTime * this.bobSpeed;
            
            // Calculate bob offset
            const bobOffsetY = Math.sin(this.bobTime * Math.PI * 2) * this.bobAmount;
            const bobOffsetX = Math.cos(this.bobTime * Math.PI) * this.bobAmount * 0.5;
            
            // Apply bob offset if not animating
            if (!this.isAnimating) {
                this.model.position.y = this.originalPosition.y + bobOffsetY;
                this.model.position.x = this.originalPosition.x + bobOffsetX;
            }
        } else if (this.originalPosition && !this.isAnimating) {
            // Gradually return to original position when not moving
            this.model.position.lerp(this.originalPosition, deltaTime * 5);
        }
    }
    
    // Update weapon sway effect
    protected updateSway(deltaTime: number): void {
        if (!this.model || !this.owner) return;
        
        // Store original rotation if not already stored
        if (!this.originalRotation) {
            this.originalRotation = this.model.rotation.clone();
        }
        
        // Get current mouse position
        const mouseX = this.owner.getMouseX();
        const mouseY = this.owner.getMouseY();
        
        // Calculate mouse delta
        const deltaX = mouseX - this.lastMouseX;
        const deltaY = mouseY - this.lastMouseY;
        
        // Update last mouse position
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        
        // Apply sway based on mouse movement if not animating
        if (!this.isAnimating) {
            // Apply rotation offset based on mouse movement
            this.model.rotation.y = this.originalRotation.y - deltaX * this.swayAmount;
            this.model.rotation.x = this.originalRotation.x - deltaY * this.swayAmount;
            
            // Gradually return to original rotation
            this.model.rotation.x += (this.originalRotation.x - this.model.rotation.x) * deltaTime * 5;
            this.model.rotation.y += (this.originalRotation.y - this.model.rotation.y) * deltaTime * 5;
        }
    }
    
    // Start an attack animation
    protected startAnimation(): void {
        this.isAnimating = true;
        this.animationTime = 0;
    }
    
    // Update the animation based on progress (0-1)
    protected updateAnimation(progress: number): void {
        // To be overridden by subclasses
    }
    
    // Reset the animation
    protected resetAnimation(): void {
        // To be overridden by subclasses
        if (this.model) {
            if (this.originalPosition) {
                this.model.position.copy(this.originalPosition);
            }
            if (this.originalRotation) {
                this.model.rotation.copy(this.originalRotation);
            }
        }
    }
    
    public abstract attack(direction: THREE.Vector3, world: World): void;
    
    protected createModel(): THREE.Object3D {
        // Default implementation returns an empty group
        return new THREE.Group();
    }
    
    public setNetworkManager(networkManager: NetworkManager): void {
        this.networkManager = networkManager;
        console.log(`[Weapon] ${this.name} connected to network manager`);
    }
    
    public setCombatManager(combatManager: CombatManager): void {
        console.log(`[Weapon] Setting combat manager for ${this.name}`);
        this.combatManager = combatManager;
    }
    
    // Default implementation returns false, will be overridden by Firearm class
    public isAutoFire(): boolean {
        return false;
    }
    
    public getModel(): THREE.Object3D | null {
        return this.model;
    }
}

// Sword implementation
export class Sword extends Weapon {
    private swingAnimation: number = 0;
    private isSwinging: boolean = false;
    private swordOriginalRotation: THREE.Euler | null = null;
    
    constructor() {
        super("Sword", 25, 3, 500, WeaponType.SWORD); // 25 damage, 3 block range, 500ms cooldown
    }
    
    protected createModel(): THREE.Object3D {
        const group = new THREE.Group();
        
        // Sword handle
        const handleGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
        const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        
        // Sword blade
        const bladeGeometry = new THREE.BoxGeometry(0.1, 1, 0.02);
        const bladeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xC0C0C0,
            metalness: 0.8,
            roughness: 0.2
        });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.position.y = 0.75;
        
        // Sword guard
        const guardGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.1);
        const guardMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFD700,
            metalness: 0.7,
            roughness: 0.3
        });
        const guard = new THREE.Mesh(guardGeometry, guardMaterial);
        guard.position.y = 0.25;
        
        group.add(handle, blade, guard);
        
        console.log(`[Sword] Model created`);
        return group;
    }
    
    public attack(direction: THREE.Vector3, world: World): void {
        if (!this.isReady() || !this.owner || !this.scene || !this.model) return;
        
        this.lastAttackTime = Date.now();
        
        // Store original rotation if not already stored
        if (!this.swordOriginalRotation && this.model) {
            this.swordOriginalRotation = this.model.rotation.clone();
        }
        
        // Start the swing animation
        this.startAnimation();
        
        // Calculate hit position in front of player
        const playerPos = this.owner.getPosition();
        const hitPos = playerPos.clone().add(direction.clone().multiplyScalar(this.range));
        
        // Raycast to find potential targets
        const rayResult = world.raycast(playerPos, direction, this.range);
        
        // If we hit a block, adjust hit position
        if (rayResult) {
            hitPos.copy(rayResult.position);
        }
        
        // TODO: Check for player hits
        
        // TODO: Send attack message to network
        if (this.networkManager) {
            this.networkManager.sendPlayerAttack(
                this.type,
                direction
            );
        }
    }
    
    protected updateAnimation(progress: number): void {
        if (!this.model) return;
        
        // Swing animation
        // First half: swing forward
        // Second half: return to original position
        if (progress < 0.5) {
            // Swing forward (0 to 0.5)
            const swingProgress = progress * 2; // Scale to 0-1
            this.model.rotation.x = -Math.PI / 4 * swingProgress;
            this.model.rotation.y = -Math.PI / 4 - (Math.PI / 4) * swingProgress;
        } else {
            // Return (0.5 to 1)
            const returnProgress = (progress - 0.5) * 2; // Scale to 0-1
            this.model.rotation.x = -Math.PI / 4 * (1 - returnProgress);
            this.model.rotation.y = -Math.PI / 4 - (Math.PI / 4) * (1 - returnProgress);
        }
    }
    
    protected resetAnimation(): void {
        if (!this.model) return;
        
        // Reset to original position
        this.model.rotation.x = 0;
        this.model.rotation.y = -Math.PI / 4;
        this.model.rotation.z = 0;
    }
}

// Base class for firearms
export abstract class Firearm extends Weapon {
    protected projectileSpeed: number;
    protected magazineSize: number;
    protected currentAmmo: number;
    protected reloadTime: number; // in milliseconds
    protected isReloading: boolean = false;
    protected reloadStartTime: number = 0;
    protected isAutomatic: boolean;
    protected muzzleFlash: THREE.Object3D | null = null;
    protected muzzleFlashVisible: boolean = false;
    protected muzzleFlashTimer: number = 0;
    
    constructor(
        name: string,
        damage: number,
        range: number,
        cooldown: number,
        type: WeaponType,
        projectileSpeed: number,
        magazineSize: number,
        reloadTime: number,
        isAutomatic: boolean
    ) {
        super(name, damage, range, cooldown, type);
        this.projectileSpeed = projectileSpeed;
        this.magazineSize = magazineSize;
        this.currentAmmo = magazineSize;
        this.reloadTime = reloadTime * 1000; // Convert to milliseconds
        this.isAutomatic = isAutomatic;
        
        console.log(`[Firearm] Created ${name} with damage=${damage}, range=${range}, cooldown=${cooldown}, projectileSpeed=${projectileSpeed}, magazineSize=${magazineSize}, reloadTime=${reloadTime}, isAutomatic=${isAutomatic}`);
    }
    
    public getMagazineSize(): number {
        return this.magazineSize;
    }
    
    public getCurrentAmmo(): number {
        return this.currentAmmo;
    }
    
    public isAutoFire(): boolean {
        return this.isAutomatic;
    }
    
    public reload(): void {
        if (this.isReloading || this.currentAmmo === this.magazineSize) return;
        
        this.isReloading = true;
        this.reloadStartTime = Date.now();
        
        // Start reload animation
        this.startReloadAnimation();
        
        console.log(`[Firearm] Reloading, current ammo: ${this.currentAmmo}/${this.magazineSize}`);
    }
    
    protected startReloadAnimation(): void {
        if (!this.model) return;
        
        // Start a longer animation for reload
        this.startAnimation();
        
        // For pistol, drop the magazine down
        if (this.type === WeaponType.PISTOL) {
            // Find the magazine mesh (assuming it's the 4th child in the pistol model)
            const magazine = this.model.children.find(child => 
                child instanceof THREE.Mesh && 
                child.position.y < 0 && 
                child.position.z > 0
            );
            
            if (magazine) {
                // Animate the magazine dropping down
                const originalY = magazine.position.y;
                
                // Create animation
                const dropAnimation = () => {
                    if (!this.isReloading || !magazine) return;
                    
                    const progress = (Date.now() - this.reloadStartTime) / this.reloadTime;
                    
                    if (progress < 0.3) {
                        // Drop magazine
                        magazine.position.y = originalY - 0.5 * (progress / 0.3);
                    } else if (progress < 0.7) {
                        // Keep magazine down
                        magazine.position.y = originalY - 0.5;
                    } else if (progress < 1.0) {
                        // Return magazine
                        magazine.position.y = originalY - 0.5 + 0.5 * ((progress - 0.7) / 0.3);
                    } else {
                        // Animation complete
                        magazine.position.y = originalY;
                        return;
                    }
                    
                    // Continue animation
                    requestAnimationFrame(dropAnimation);
                };
                
                // Start animation
                dropAnimation();
            }
        }
        
        // For rifle, tilt the weapon to the side
        if (this.type === WeaponType.RIFLE) {
            const originalRotation = this.model.rotation.clone();
            
            // Create animation
            const tiltAnimation = () => {
                if (!this.isReloading || !this.model) return;
                
                const progress = (Date.now() - this.reloadStartTime) / this.reloadTime;
                
                if (progress < 0.2) {
                    // Tilt rifle to the side
                    this.model.rotation.z = originalRotation.z + (Math.PI / 6) * (progress / 0.2);
                } else if (progress < 0.8) {
                    // Keep tilted
                    this.model.rotation.z = originalRotation.z + Math.PI / 6;
                } else if (progress < 1.0) {
                    // Return to original rotation
                    this.model.rotation.z = originalRotation.z + (Math.PI / 6) * (1 - ((progress - 0.8) / 0.2));
                } else {
                    // Animation complete
                    this.model.rotation.z = originalRotation.z;
                    return;
                }
                
                // Continue animation
                requestAnimationFrame(tiltAnimation);
            };
            
            // Start animation
            tiltAnimation();
        }
    }
    
    public update(deltaTime: number): void {
        super.update(deltaTime);
        
        // Handle reloading
        if (this.isReloading) {
            const currentTime = Date.now();
            if (currentTime - this.reloadStartTime >= this.reloadTime) {
                this.currentAmmo = this.magazineSize;
                this.isReloading = false;
                console.log(`[Firearm] Reload complete, ammo: ${this.currentAmmo}/${this.magazineSize}`);
            }
        }
        
        // Handle muzzle flash
        if (this.muzzleFlashVisible) {
            this.muzzleFlashTimer += deltaTime;
            if (this.muzzleFlashTimer > 0.05) { // Show for 50ms
                if (this.muzzleFlash) {
                    this.muzzleFlash.visible = false;
                }
                this.muzzleFlashVisible = false;
            }
        }
    }
    
    public attack(direction: THREE.Vector3, world: World): void {
        if (!this.isReady() || this.isReloading || this.currentAmmo <= 0 || !this.owner || !this.scene) return;
        
        this.lastAttackTime = Date.now();
        this.currentAmmo--;
        
        // Show muzzle flash
        this.showMuzzleFlash();
        
        // Create and fire projectile
        this.createProjectile(direction, world);
        
        // Send attack message to network
        if (this.networkManager) {
            this.networkManager.sendPlayerAttack(
                this.type,
                direction
            );
            console.log(`[Firearm] Sent attack message to network`);
        }
        
        // Auto-reload when empty
        if (this.currentAmmo === 0) {
            console.log(`[Firearm] ${this.name} magazine empty, auto-reloading`);
            this.reload();
        }
        
        // TODO: Play firing sound
    }
    
    protected createProjectile(direction: THREE.Vector3, world: World): void {
        if (!this.owner || !this.scene) return;
        
        const position = this.owner.getPosition().clone();
        position.y += 1.6; // Adjust to be at eye level
        
        // Create projectile with velocity in the direction of aim
        const velocity = direction.clone().normalize().multiplyScalar(this.projectileSpeed);
        
        const projectile = new Projectile(
            position,
            velocity,
            this.damage,
            this.owner,
            this.scene,
            world,
            this.networkManager
        );
        
        // Send projectile spawn message to network
        if (this.networkManager) {
            this.networkManager.sendProjectileSpawn(
                position,
                velocity,
                this.damage
            );
            console.log(`[Firearm] Sent projectile spawn message to network`);
        }
        
        // Add projectile to CombatManager for tracking
        if (this.combatManager) {
            console.log(`[Firearm] Adding projectile to combat manager`);
            this.combatManager.addProjectile(projectile);
        } else {
            console.warn(`[Firearm] No combat manager available to track projectile`);
        }
    }
    
    protected createMuzzleFlash(): THREE.Object3D {
        const group = new THREE.Group();
        
        // Create a cone for the muzzle flash
        const flashGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFF00,
            transparent: true,
            opacity: 0.8
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.rotation.x = Math.PI / 2;
        
        // Add a point light for the glow effect
        const light = new THREE.PointLight(0xFFFF00, 2, 2);
        light.position.set(0, 0, 0);
        
        group.add(flash, light);
        group.visible = false;
        
        console.log(`[Firearm] Muzzle flash created`);
        return group;
    }
    
    protected showMuzzleFlash(): void {
        // Create muzzle flash if it doesn't exist
        if (!this.muzzleFlash && this.model) {
            this.muzzleFlash = this.createMuzzleFlash();
            
            // Position at the end of the barrel
            if (this.type === WeaponType.PISTOL) {
                this.muzzleFlash.position.z = 0.7;
            } else if (this.type === WeaponType.RIFLE) {
                this.muzzleFlash.position.z = 1.3;
            }
            
            this.model.add(this.muzzleFlash);
        }
        
        // Show muzzle flash
        if (this.muzzleFlash) {
            this.muzzleFlash.visible = true;
            this.muzzleFlashVisible = true;
            this.muzzleFlashTimer = 0;
        }
    }
}

// Pistol implementation
export class Pistol extends Firearm {
    constructor() {
        super(
            "Pistol",
            15,         // damage
            50,         // range
            200,        // cooldown
            WeaponType.PISTOL,
            200,        // projectile speed
            12,         // magazine size
            1.5,        // reload time
            false       // not automatic
        );
    }
    
    protected createModel(): THREE.Object3D {
        const group = new THREE.Group();
        
        // Pistol body
        const bodyGeometry = new THREE.BoxGeometry(0.2, 0.3, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2F4F4F,
            metalness: 0.7,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Pistol grip
        const gripGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.2);
        const gripMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            metalness: 0.1,
            roughness: 0.8
        });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.y = -0.35;
        grip.position.z = 0.15;
        
        // Pistol barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1A1A1A,
            metalness: 0.9,
            roughness: 0.1
        });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.5;
        
        // Pistol trigger
        const triggerGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.05);
        const triggerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1A1A1A,
            metalness: 0.8,
            roughness: 0.2
        });
        const trigger = new THREE.Mesh(triggerGeometry, triggerMaterial);
        trigger.position.y = -0.1;
        trigger.position.z = 0.25;
        
        group.add(body, grip, barrel, trigger);
        
        console.log(`[Pistol] Model created`);
        return group;
    }
    
    protected updateAnimation(progress: number): void {
        if (!this.model) return;
        
        // Recoil animation
        // First quarter: quick recoil
        // Rest: slower return to position
        if (progress < 0.25) {
            // Quick recoil (0 to 0.25)
            const recoilProgress = progress * 4; // Scale to 0-1
            this.model.position.z = -0.2 * recoilProgress;
            this.model.rotation.x = Math.PI / 16 * recoilProgress;
        } else {
            // Return to position (0.25 to 1)
            const returnProgress = (progress - 0.25) * (4/3); // Scale to 0-1
            this.model.position.z = -0.2 * (1 - returnProgress);
            this.model.rotation.x = Math.PI / 16 * (1 - returnProgress);
        }
    }
    
    protected resetAnimation(): void {
        if (!this.model) return;
        
        // Reset to original position
        this.model.position.z = 0;
        this.model.rotation.x = 0;
    }
    
    public attack(direction: THREE.Vector3, world: World): void {
        super.attack(direction, world);
        
        // Start recoil animation when firing
        if (this.currentAmmo > 0) {
            this.startAnimation();
        }
    }
}

// Rifle implementation
export class Rifle extends Firearm {
    constructor() {
        super(
            "Rifle",
            20,           // damage
            100,          // range
            100,          // cooldown
            WeaponType.RIFLE,
            300,          // projectile speed
            30,           // magazine size
            2.0,          // reload time
            true          // automatic
        );
    }
    
    protected createModel(): THREE.Object3D {
        const group = new THREE.Group();
        
        // Rifle body
        const bodyGeometry = new THREE.BoxGeometry(0.2, 0.3, 1.2);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1A1A1A,
            metalness: 0.7,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Rifle stock
        const stockGeometry = new THREE.BoxGeometry(0.15, 0.25, 0.4);
        const stockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            metalness: 0.1,
            roughness: 0.8
        });
        const stock = new THREE.Mesh(stockGeometry, stockMaterial);
        stock.position.z = -0.7;
        
        // Rifle barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1A1A1A,
            metalness: 0.9,
            roughness: 0.1
        });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.9;
        
        // Rifle grip
        const gripGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.2);
        const gripMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            metalness: 0.1,
            roughness: 0.8
        });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.y = -0.35;
        grip.position.z = 0.2;
        
        // Rifle magazine
        const magGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.1);
        const magMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2F4F4F,
            metalness: 0.7,
            roughness: 0.3
        });
        const magazine = new THREE.Mesh(magGeometry, magMaterial);
        magazine.position.y = -0.35;
        magazine.position.z = 0.0;
        
        // Rifle scope
        const scopeGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.3, 16);
        const scopeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1A1A1A,
            metalness: 0.9,
            roughness: 0.1
        });
        const scope = new THREE.Mesh(scopeGeometry, scopeMaterial);
        scope.position.y = 0.2;
        scope.position.z = 0.3;
        
        group.add(body, stock, barrel, grip, magazine, scope);
        
        console.log(`[Rifle] Model created`);
        return group;
    }
    
    protected updateAnimation(progress: number): void {
        if (!this.model) return;
        
        // Recoil animation
        // First quarter: quick recoil
        // Rest: slower return to position
        if (progress < 0.25) {
            // Quick recoil (0 to 0.25)
            const recoilProgress = progress * 4; // Scale to 0-1
            this.model.position.z = -0.3 * recoilProgress;
            this.model.rotation.x = Math.PI / 12 * recoilProgress;
        } else {
            // Return to position (0.25 to 1)
            const returnProgress = (progress - 0.25) * (4/3); // Scale to 0-1
            this.model.position.z = -0.3 * (1 - returnProgress);
            this.model.rotation.x = Math.PI / 12 * (1 - returnProgress);
        }
    }
    
    protected resetAnimation(): void {
        if (!this.model) return;
        
        // Reset to original position
        this.model.position.z = 0;
        this.model.rotation.x = 0;
    }
    
    public attack(direction: THREE.Vector3, world: World): void {
        super.attack(direction, world);
        
        // Start recoil animation when firing
        if (this.currentAmmo > 0) {
            this.startAnimation();
        }
    }
} 