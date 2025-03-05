import * as THREE from 'three';
import { Player } from '../player/Player';
import { Projectile } from './Projectile';
import { World } from '../world/World';
import { NetworkManager } from '../core/NetworkManager';

// Constants for combat
const HEADSHOT_MULTIPLIER = 2.0;
const HEAD_HITBOX_SIZE = 0.3; // Size of head hitbox in units
const BODY_HITBOX_SIZE = 0.5; // Size of body hitbox in units

export class CombatManager {
    private players: Map<string, Player> = new Map();
    private projectiles: Projectile[] = [];
    private scene: THREE.Scene;
    private world: World;
    private networkManager: NetworkManager | null = null;
    
    constructor(scene: THREE.Scene, world: World, networkManager: NetworkManager | null = null) {
        console.log('[CombatManager] Initializing combat manager');
        this.scene = scene;
        this.world = world;
        this.networkManager = networkManager;
    }
    
    public registerPlayer(player: Player): void {
        const playerId = player.getId();
        console.log(`[CombatManager] Registering player with ID: ${playerId}`);
        this.players.set(playerId, player);
    }
    
    public unregisterPlayer(player: Player): void {
        const playerId = player.getId();
        console.log(`[CombatManager] Unregistering player with ID: ${playerId}`);
        this.players.delete(playerId);
    }
    
    public addProjectile(projectile: Projectile): void {
        console.log(`[CombatManager] Adding projectile, total: ${this.projectiles.length + 1}`);
        this.projectiles.push(projectile);
    }
    
    public update(deltaTime: number): void {
        console.log(`[CombatManager] Updating combat manager with ${this.projectiles.length} projectiles`);
        
        // Update all projectiles
        const projectilesToRemove: Projectile[] = [];
        
        for (const projectile of this.projectiles) {
            projectile.update(deltaTime);
            
            // Check if projectile should be removed
            if (projectile.hasExpired() || projectile.hasHit) {
                projectilesToRemove.push(projectile);
            }
        }
        
        // Remove inactive projectiles
        if (projectilesToRemove.length > 0) {
            console.log(`[CombatManager] Removing ${projectilesToRemove.length} inactive projectiles`);
            for (const projectile of projectilesToRemove) {
                const index = this.projectiles.indexOf(projectile);
                if (index !== -1) {
                    this.projectiles.splice(index, 1);
                }
                projectile.destroy();
            }
            console.log(`[CombatManager] ${this.projectiles.length} projectiles remaining`);
        }
        
        // Check for collisions with players
        this.checkProjectilePlayerCollisions();
    }
    
    private checkProjectilePlayerCollisions(): void {
        for (const projectile of this.projectiles) {
            // Skip projectiles that have already hit something
            if (projectile.hasHit) continue;
            
            // Skip self-damage
            if (projectile.owner && projectile.owner === projectile.owner) continue;
            
            // Iterate through all players in the map
            for (const [playerId, player] of this.players.entries()) {
                // Skip dead players
                if (player.isDead) continue;
                
                // Skip if the projectile belongs to this player
                if (projectile.owner === player) continue;
                
                const playerPosition = player.getPosition();
                const projectilePosition = projectile.getPosition();
                
                // Check headshot (smaller hitbox at head level)
                const headPosition = playerPosition.clone().add(new THREE.Vector3(0, 1.7, 0)); // Head is ~1.7 units above feet
                if (projectilePosition.distanceTo(headPosition) < HEAD_HITBOX_SIZE) {
                    console.log(`[CombatManager] Headshot detected on player ${player.getId()}`);
                    
                    // Apply damage with headshot multiplier
                    const damage = projectile.getDamage() * HEADSHOT_MULTIPLIER;
                    this.applyDamage(player, damage, projectile.owner, true);
                    
                    // Create hit effect
                    this.createHitMarker(projectilePosition, true);
                    
                    // Mark projectile as hit
                    projectile.onHit(player);
                    break;
                }
                
                // Check body shot (larger hitbox)
                const bodyPosition = playerPosition.clone().add(new THREE.Vector3(0, 0.9, 0)); // Body center is ~0.9 units above feet
                if (projectilePosition.distanceTo(bodyPosition) < BODY_HITBOX_SIZE) {
                    console.log(`[CombatManager] Body hit detected on player ${player.getId()}`);
                    
                    // Apply normal damage
                    const damage = projectile.getDamage();
                    this.applyDamage(player, damage, projectile.owner, false);
                    
                    // Create hit effect
                    this.createHitMarker(projectilePosition, false);
                    
                    // Mark projectile as hit
                    projectile.onHit(player);
                    break;
                }
            }
        }
    }
    
    private applyDamage(player: Player, damage: number, attacker: Player | null, isHeadshot: boolean): void {
        console.log(`[CombatManager] Applying ${damage} damage to player ${player.getId()}${isHeadshot ? ' (HEADSHOT)' : ''}`);
        
        // Apply damage to player
        player.takeDamage(damage, attacker, isHeadshot);
        
        // TODO: Send damage event to network
    }
    
    private createHitMarker(position: THREE.Vector3, isHeadshot: boolean): void {
        console.log(`[CombatManager] Creating hit marker at position: ${position.x}, ${position.y}, ${position.z}, headshot: ${isHeadshot}`);
        // TODO: Implement hit marker UI
        // This would typically be a UI element that appears briefly
    }
    
    // Network-related methods
    public handleRemoteProjectileSpawn(data: any): void {
        console.log(`[CombatManager] Handling remote projectile spawn: ${JSON.stringify(data)}`);
        // TODO: Implement remote projectile spawning
    }
    
    public handleRemoteProjectileHit(data: any): void {
        console.log(`[CombatManager] Handling remote projectile hit: ${JSON.stringify(data)}`);
        // TODO: Implement remote projectile hit
    }

    public createRemoteProjectile(
        id: string,
        position: THREE.Vector3,
        velocity: THREE.Vector3,
        damage: number,
        ownerId: string
    ): void {
        console.log(`[CombatManager] Creating remote projectile with ID: ${id}`);
        
        // Find the owner player by ID
        const ownerPlayer = this.players.get(ownerId);
        
        if (!ownerPlayer) {
            console.warn(`[CombatManager] Owner player with ID ${ownerId} not found, cannot create projectile`);
            return;
        }
        
        // Create a new projectile with the given parameters
        const projectile = new Projectile(
            position,
            velocity,
            damage,
            ownerPlayer,
            this.scene,
            this.world,
            this.networkManager
        );
        
        // Add the projectile to the manager
        this.addProjectile(projectile);
    }

    public createImpactEffect(position: THREE.Vector3, hitPlayer: boolean): void {
        console.log(`[CombatManager] Creating impact effect at ${position.x}, ${position.y}, ${position.z}`);
        
        // Create a particle effect at the impact position
        const particleCount = hitPlayer ? 20 : 10;
        const particleGeometry = new THREE.BufferGeometry();
        const particleMaterial = new THREE.PointsMaterial({
            color: hitPlayer ? 0xff0000 : 0xcccccc,
            size: 0.05,
            transparent: true,
            opacity: 0.8
        });
        
        const positions = new Float32Array(particleCount * 3);
        const velocities: THREE.Vector3[] = [];
        
        // Initialize particles in a sphere
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = position.x;
            positions[i3 + 1] = position.y;
            positions[i3 + 2] = position.z;
            
            // Random velocity direction
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(0.1 + Math.random() * 0.2);
            
            velocities.push(velocity);
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(particles);
        
        // Animate particles
        const startTime = Date.now();
        const duration = 500; // 500ms
        
        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                // Remove particles when animation is complete
                this.scene.remove(particles);
                return;
            }
            
            // Update particle positions
            const positions = particleGeometry.attributes.position.array as Float32Array;
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                positions[i3] += velocities[i].x;
                positions[i3 + 1] += velocities[i].y;
                positions[i3 + 2] += velocities[i].z;
                
                // Apply gravity
                velocities[i].y -= 0.01;
            }
            
            particleGeometry.attributes.position.needsUpdate = true;
            
            // Fade out
            particleMaterial.opacity = 0.8 * (1 - progress);
            
            // Continue animation
            requestAnimationFrame(animateParticles);
        };
        
        // Start animation
        animateParticles();
        
        // Play impact sound
        this.playImpactSound(hitPlayer);
    }

    private playImpactSound(hitPlayer: boolean): void {
        const sound = new Audio(hitPlayer ? '/sounds/hit_impact.mp3' : '/sounds/bullet_impact.mp3');
        sound.volume = 0.2;
        sound.play().catch(e => console.error("Error playing impact sound:", e));
    }
} 