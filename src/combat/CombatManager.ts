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
} 