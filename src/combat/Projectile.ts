import * as THREE from 'three';
import { Player } from '../player/Player';
import { World } from '../world/World';
import { NetworkManager } from '../core/NetworkManager';

export class Projectile {
    private position: THREE.Vector3;
    private velocity: THREE.Vector3;
    private damage: number;
    public owner: Player;
    private mesh: THREE.Object3D;
    private scene: THREE.Scene;
    private world: World;
    private lifetime: number = 5000; // 5 seconds lifetime
    private creationTime: number = Date.now();
    public hasHit: boolean = false;
    private trailEffect: THREE.Line | null = null;
    private trailPoints: THREE.Vector3[] = [];
    private maxTrailLength: number = 10;
    private networkManager: NetworkManager | null = null;
    public id: string;
    
    constructor(
        position: THREE.Vector3,
        velocity: THREE.Vector3,
        damage: number,
        owner: Player,
        scene: THREE.Scene,
        world: World,
        networkManager: NetworkManager | null = null
    ) {
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.damage = damage;
        this.owner = owner;
        this.scene = scene;
        this.world = world;
        this.networkManager = networkManager;
        this.id = `projectile-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        console.log(`[Projectile] Created projectile ${this.id} at position: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
        console.log(`[Projectile] Velocity: ${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}, ${velocity.z.toFixed(2)}, Damage: ${damage}`);
        
        // Create projectile mesh
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
        
        // Create trail effect
        this.createTrail();
    }
    
    private createMesh(): THREE.Object3D {
        // Create a simple bullet mesh
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 2.0,
            metalness: 0.5,
            roughness: 0.2
        });
        const bullet = new THREE.Mesh(geometry, material);
        bullet.position.copy(this.position);
        
        // Add a point light to make the projectile glow
        const light = new THREE.PointLight(0xffff00, 1, 3);
        light.position.set(0, 0, 0);
        bullet.add(light);
        
        console.log(`[Projectile] Mesh created for projectile ${this.id}`);
        return bullet;
    }
    
    private createTrail(): void {
        // Initialize trail points with current position
        this.trailPoints.push(this.position.clone());
        
        // Create trail geometry
        const geometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            linewidth: 3,
            opacity: 0.9,
            transparent: true
        });
        
        this.trailEffect = new THREE.Line(geometry, material);
        this.scene.add(this.trailEffect);
        
        console.log(`[Projectile] Trail created for projectile ${this.id}`);
    }
    
    private updateTrail(): void {
        if (!this.trailEffect) return;
        
        // Add current position to trail points
        this.trailPoints.push(this.position.clone());
        
        // Limit trail length
        if (this.trailPoints.length > this.maxTrailLength) {
            this.trailPoints.shift();
        }
        
        // Update trail geometry
        const geometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
        this.trailEffect.geometry.dispose();
        this.trailEffect.geometry = geometry;
    }
    
    public update(deltaTime: number): boolean {
        // Check if projectile has expired or already hit something
        if (this.hasHit || this.hasExpired()) {
            if (this.hasHit) {
                // Only log this once when we first detect the hit
                if (!this.mesh.userData.hitLogged) {
                    console.log(`[Projectile] ${this.id.substring(0, 8)}... has hit something, destroying`);
                    this.mesh.userData.hitLogged = true;
                }
            } else {
                console.log(`[Projectile] ${this.id.substring(0, 8)}... lifetime expired (${Date.now() - this.creationTime}ms), destroying`);
            }
            this.destroy();
            return false;
        }
        
        // Calculate movement based on velocity and delta time
        const movement = this.velocity.clone().multiplyScalar(deltaTime);
        
        // Only log significant movements to reduce spam
        if (movement.length() > 0.5) {
            console.log(`[Projectile] ${this.id.substring(0, 8)}... moving: ${movement.length().toFixed(2)} units`);
        }
        
        // Store previous position for collision detection
        const previousPosition = this.position.clone();
        
        // Update position
        this.position.add(movement);
        
        // Update mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }
        
        // Update trail
        this.updateTrail();
        
        // Check for collisions
        if (this.checkCollision(previousPosition)) {
            return false;
        }
        
        return true;
    }
    
    private checkCollision(previousPosition: THREE.Vector3): boolean {
        // Check collision with blocks
        const direction = this.position.clone().sub(previousPosition).normalize();
        const distance = this.position.distanceTo(previousPosition);
        
        // Raycast to check for block collision
        const blockHit = this.world.raycast(previousPosition, direction, distance);
        if (blockHit) {
            console.log(`[Projectile] ${this.id.substring(0, 8)}... hit block at position: ${blockHit.position.x.toFixed(2)}, ${blockHit.position.y.toFixed(2)}, ${blockHit.position.z.toFixed(2)}`);
            this.position.copy(blockHit.position);
            this.onHit(null); // Hit a block
            this.destroy();
            return true;
        }
        
        // Player collisions are handled by the CombatManager in its checkProjectilePlayerCollisions method
        
        return false;
    }
    
    private createImpactEffect(position: THREE.Vector3, isPlayer: boolean): void {
        console.log(`[Projectile] Creating impact effect at ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}, hit player: ${isPlayer}`);
        
        // Create impact particles
        const particleCount = 10;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const size = Math.random() * 0.05 + 0.02;
            const geometry = new THREE.SphereGeometry(size, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: isPlayer ? 0xff0000 : 0xcccccc,
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            // Random velocity for particles
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(Math.random() * 2 + 1);
            
            // Store velocity in userData
            particle.userData.velocity = velocity;
            particle.userData.lifetime = Math.random() * 500 + 500; // 0.5-1 second
            particle.userData.creationTime = Date.now();
            
            particles.add(particle);
        }
        
        this.scene.add(particles);
        
        // Set up animation for particles
        const animate = () => {
            let allExpired = true;
            
            particles.children.forEach((child) => {
                const particle = child as THREE.Mesh;
                const elapsed = Date.now() - particle.userData.creationTime;
                
                if (elapsed < particle.userData.lifetime) {
                    allExpired = false;
                    
                    // Move particle
                    const velocity = particle.userData.velocity as THREE.Vector3;
                    particle.position.add(velocity.clone().multiplyScalar(0.016)); // Assuming 60fps
                    
                    // Apply gravity
                    particle.userData.velocity.y -= 0.05;
                    
                    // Fade out
                    const opacity = 1 - (elapsed / particle.userData.lifetime);
                    (particle.material as THREE.MeshBasicMaterial).opacity = opacity;
                } else {
                    particle.visible = false;
                }
            });
            
            if (!allExpired) {
                requestAnimationFrame(animate);
            } else {
                // Remove particles from scene
                particles.children.forEach((child) => {
                    const particle = child as THREE.Mesh;
                    particle.geometry.dispose();
                    (particle.material as THREE.MeshBasicMaterial).dispose();
                });
                
                this.scene.remove(particles);
                console.log(`[Projectile] Impact effect for ${this.id} completed and removed`);
            }
        };
        
        animate();
    }
    
    public onHit(target: Player | null, isHeadshot: boolean = false): void {
        // Mark as hit to prevent further collisions
        this.hasHit = true;
        
        if (target) {
            const hitType = isHeadshot ? "HEADSHOT" : "body hit";
            console.log(`[Projectile] ${this.id.substring(0, 8)}... ${hitType} on player ${target.getId()}, damage=${this.damage}${isHeadshot ? " x2" : ""}`);
            
            // Apply damage to target
            target.takeDamage(this.damage, this.owner, isHeadshot);
            
            // Send hit message to network
            if (this.networkManager) {
                this.networkManager.sendProjectileHit(
                    this.id,
                    this.position,
                    target.getId(), // Get actual target ID
                    isHeadshot
                );
                console.log(`[Projectile] ${this.id.substring(0, 8)}... sent hit message to network (target=${target.getId()}, isHeadshot=${isHeadshot})`);
            }
            
            // Create impact effect
            this.createImpactEffect(this.position, true);
        } else {
            console.log(`[Projectile] ${this.id.substring(0, 8)}... hit environment or remote player`);
            
            // Hit environment
            // Send hit message to network
            if (this.networkManager) {
                this.networkManager.sendProjectileHit(
                    this.id,
                    this.position,
                    null,
                    false
                );
                console.log(`[Projectile] ${this.id.substring(0, 8)}... sent environment hit message to network`);
            }
            
            // Create impact effect
            this.createImpactEffect(this.position, false);
        }
    }
    
    public destroy(): void {
        console.log(`[Projectile] Destroying projectile ${this.id}`);
        
        // Remove from scene
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh instanceof THREE.Mesh) {
                this.mesh.geometry.dispose();
                if (this.mesh.material instanceof THREE.Material) {
                    this.mesh.material.dispose();
                } else if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(material => material.dispose());
                }
            }
        }
        
        // Remove trail
        if (this.trailEffect) {
            this.scene.remove(this.trailEffect);
            this.trailEffect.geometry.dispose();
            (this.trailEffect.material as THREE.Material).dispose();
            this.trailEffect = null;
        }
    }
    
    public getPosition(): THREE.Vector3 {
        return this.position.clone();
    }
    
    public getOwner(): Player {
        return this.owner;
    }
    
    public getDamage(): number {
        return this.damage;
    }
    
    public setDamage(damage: number): void {
        console.log(`[Projectile] Setting damage to ${damage} for projectile ${this.id}`);
        this.damage = damage;
    }
    
    public hasExpired(): boolean {
        const age = Date.now() - this.creationTime;
        return age > this.lifetime;
    }
} 