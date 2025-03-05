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
        if(this.projectiles.length > 0) {
            console.log(`[CombatManager] Updating combat manager with ${this.projectiles.length} projectiles`);
        }
        
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
        // Only log if we have both projectiles and players to check
        if (this.projectiles.length > 0 && this.players.size > 0) {
            console.log(`[CombatManager] Checking collisions for ${this.projectiles.length} projectiles against ${this.players.size} players`);
        }
        
        for (const projectile of this.projectiles) {
            // Skip projectiles that have already hit something
            if (projectile.hasHit) continue;
            
            // Skip projectiles that don't have an owner
            if (!projectile.owner) continue;
            
            const projectilePosition = projectile.getPosition();
            const projectileOwner = projectile.owner;
            
            // Iterate through all players in the map
            for (const [playerId, player] of this.players.entries()) {
                // Skip dead players
                if (player.isDead) {
                    // Only log this once per player, not for every projectile
                    // console.log(`[CombatManager] Skipping dead player ${playerId}`);
                    continue;
                }
                
                // Skip if the projectile belongs to this player (self-damage prevention)
                if (projectileOwner === player) {
                    // No need to log this for every projectile check
                    // console.log(`[CombatManager] Skipping projectile owner ${playerId}`);
                    continue;
                }
                
                const playerPosition = player.getPosition();
                
                // Only log detailed position info when distances are close to threshold
                // to reduce console spam
                const projectileToPlayer = projectilePosition.distanceTo(playerPosition);
                const isClose = projectileToPlayer < 3.0; // Only log if within 3 units
                
                if (isClose) {
                    console.log(`[CombatManager] Projectile ${projectile.id.substring(0, 8)}... near player ${playerId}: distance=${projectileToPlayer.toFixed(2)}`);
                }
                
                // Check headshot (smaller hitbox at head level)
                const headPosition = playerPosition.clone().add(new THREE.Vector3(0, 1.7, 0)); // Head is ~1.7 units above feet
                const headDistance = projectilePosition.distanceTo(headPosition);
                
                if (isClose) {
                    console.log(`[CombatManager] Head distance: ${headDistance.toFixed(2)}, threshold: ${HEAD_HITBOX_SIZE}`);
                }
                
                if (headDistance < HEAD_HITBOX_SIZE) {
                    console.log(`[CombatManager] HEADSHOT! Projectile ${projectile.id.substring(0, 8)}... hit player ${player.getId()} (distance: ${headDistance.toFixed(2)})`);
                    
                    // Apply damage with headshot multiplier
                    const damage = projectile.getDamage() * HEADSHOT_MULTIPLIER;
                    this.applyDamage(player, damage, projectile.owner, true);
                    
                    // Create hit effect
                    this.createHitMarker(projectilePosition, true);
                    
                    // Mark projectile as hit
                    projectile.onHit(player, true);
                    break;
                }
                
                // Check body shot (larger hitbox)
                const bodyPosition = playerPosition.clone().add(new THREE.Vector3(0, 0.9, 0)); // Body center is ~0.9 units above feet
                const bodyDistance = projectilePosition.distanceTo(bodyPosition);
                
                if (isClose) {
                    console.log(`[CombatManager] Body distance: ${bodyDistance.toFixed(2)}, threshold: ${BODY_HITBOX_SIZE}`);
                }
                
                if (bodyDistance < BODY_HITBOX_SIZE) {
                    console.log(`[CombatManager] BODY HIT! Projectile ${projectile.id.substring(0, 8)}... hit player ${player.getId()} (distance: ${bodyDistance.toFixed(2)})`);
                    
                    // Apply normal damage
                    const damage = projectile.getDamage();
                    this.applyDamage(player, damage, projectile.owner, false);
                    
                    // Create hit effect
                    this.createHitMarker(projectilePosition, false);
                    
                    // Mark projectile as hit
                    projectile.onHit(player, false);
                    break;
                }
            }
        }
    }
    
    private applyDamage(player: Player, damage: number, attacker: Player | null, isHeadshot: boolean): void {
        console.log(`[CombatManager] Applying ${damage} damage to player ${player.getId()}${isHeadshot ? ' (HEADSHOT)' : ''}`);
        
        // Apply damage to player
        player.takeDamage(damage, attacker, isHeadshot);
        
        // Send damage event to network if network manager is available
        if (this.networkManager && attacker) {
            this.networkManager.sendPlayerDamage(
                player.getId(),
                damage,
                isHeadshot
            );
        }
    }
    
    private createHitMarker(position: THREE.Vector3, isHeadshot: boolean): void {
        console.log(`[CombatManager] Creating hit marker at position: ${position.x}, ${position.y}, ${position.z}, headshot: ${isHeadshot}`);
        
        // Create a hit marker UI element
        const hitMarkerElement = document.createElement('div');
        hitMarkerElement.className = 'hit-marker';
        
        // Add headshot class if it's a headshot
        if (isHeadshot) {
            hitMarkerElement.classList.add('headshot');
        }
        
        // Add the hit marker to the DOM
        document.body.appendChild(hitMarkerElement);
        
        // Remove the hit marker after a short delay
        setTimeout(() => {
            if (hitMarkerElement.parentNode) {
                hitMarkerElement.parentNode.removeChild(hitMarkerElement);
            }
        }, 300); // 300ms duration
        
        // Play hit sound
        this.playImpactSound(true);
    }
    
    // Network-related methods
    public handleRemoteProjectileSpawn(data: any): void {
        console.log(`[CombatManager] Handling remote projectile spawn: ${JSON.stringify(data)}`);
        
        // Extract data from the message
        const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        const velocity = new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z);
        const damage = data.damage;
        const ownerId = data.ownerId;
        const projectileId = data.id;
        
        // Create a remote projectile
        this.createRemoteProjectile(
            projectileId,
            position,
            velocity,
            damage,
            ownerId
        );
    }
    
    public handleRemoteProjectileHit(data: any): void {
        console.log(`[CombatManager] Handling remote projectile hit: ${JSON.stringify(data)}`);
        
        // Extract data from the message
        const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        const projectileId = data.projectileId;
        const targetId = data.targetId;
        const isHeadshot = data.isHeadshot || false;
        
        // Find the projectile by ID (if it exists in our local simulation)
        const projectile = this.projectiles.find(p => p.id === projectileId);
        
        if (projectile) {
            console.log(`[CombatManager] Found local projectile ${projectileId}, marking as hit`);
            // Mark the projectile as hit
            projectile.hasHit = true;
            
            // If a player was hit
            if (targetId) {
                // Find the target player
                const targetPlayer = this.players.get(targetId);
                
                if (targetPlayer) {
                    console.log(`[CombatManager] Found target player ${targetId}, applying hit effect`);
                    // Create hit effect on the player
                    this.createHitMarker(position, isHeadshot);
                } else {
                    console.log(`[CombatManager] Target player ${targetId} not found in local players map`);
                }
            }
            
            // Create impact effect
            this.createImpactEffect(position, targetId !== null);
        } else {
            console.log(`[CombatManager] Projectile ${projectileId} not found locally, creating impact effect only`);
            // If we don't have the projectile locally, just create the impact effect
            this.createImpactEffect(position, targetId !== null);
            
            // If a player was hit, create a hit marker
            if (targetId) {
                this.createHitMarker(position, isHeadshot);
            }
        }
        
        // Play impact sound
        this.playImpactSound(targetId !== null);
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
        console.log(`[CombatManager] Creating impact effect at ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}, hit player: ${hitPlayer}`);
        
        // Create particle effect
        const particleCount = hitPlayer ? 30 : 15; // More particles for player hits
        const particleSize = hitPlayer ? 0.1 : 0.05; // Larger particles for player hits
        const particleColor = hitPlayer ? 0xff0000 : 0xcccccc; // Red for player hits, gray for environment
        
        const particles = new THREE.Group();
        const particleGeometry = new THREE.SphereGeometry(particleSize, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({ color: particleColor });
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Random position within a small radius of the impact
            const radius = 0.2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            particle.position.set(
                position.x + radius * Math.sin(phi) * Math.cos(theta),
                position.y + radius * Math.sin(phi) * Math.sin(theta),
                position.z + radius * Math.cos(phi)
            );
            
            // Random velocity
            const speed = 1 + Math.random() * 2;
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            );
            
            particles.add(particle);
        }
        
        this.scene.add(particles);
        
        // Animate particles
        const startTime = Date.now();
        const duration = 500; // 500ms
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                // Animation complete, remove particles
                this.scene.remove(particles);
                particles.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                return;
            }
            
            // Update particle positions
            particles.children.forEach((particle) => {
                particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.016)); // Assume 60fps
                particle.userData.velocity.multiplyScalar(0.95); // Slow down over time
                particle.scale.multiplyScalar(0.98); // Shrink over time
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
        
        // Play impact sound
        this.playImpactSound(hitPlayer);
    }

    private playImpactSound(hitPlayer: boolean): void {
        console.log(`[CombatManager] Playing impact sound, hit player: ${hitPlayer}`);
        
        // Play appropriate sound based on whether a player was hit
        const soundName = hitPlayer ? 'player_hit' : 'impact';
        
        // Use audio system to play sound
        // This assumes there's an audio system available
        // You might need to adjust this based on your actual audio implementation
        if (typeof Audio !== 'undefined') {
            const sound = new Audio(`/sounds/${soundName}.mp3`);
            sound.volume = 0.5;
            sound.play().catch(e => console.error('Error playing sound:', e));
        }
    }

    // Add a method to check collisions with remote players
    public checkRemotePlayerCollisions(remotePlayers: Map<string, any>): void {
        if (this.projectiles.length === 0 || remotePlayers.size === 0) {
            return; // No projectiles or remote players to check
        }
        
        console.log(`[CombatManager] Checking collisions for ${this.projectiles.length} projectiles against ${remotePlayers.size} remote players`);
        
        for (const projectile of this.projectiles) {
            // Skip projectiles that have already hit something
            if (projectile.hasHit) continue;
            
            // Skip projectiles that don't have an owner
            if (!projectile.owner) continue;
            
            const projectilePosition = projectile.getPosition();
            const projectileOwnerId = projectile.owner.getId();
            
            // Check against all remote players
            for (const [remotePlayerId, remotePlayer] of remotePlayers.entries()) {
                // Skip if the projectile belongs to this remote player (self-damage prevention)
                if (projectileOwnerId === remotePlayerId) {
                    continue;
                }
                
                // Skip dead remote players
                if (remotePlayer.isDead) {
                    continue;
                }
                
                const remotePlayerPosition = remotePlayer.position;
                
                // Only log detailed position info when distances are close to threshold
                const projectileToPlayer = projectilePosition.distanceTo(remotePlayerPosition);
                const isClose = projectileToPlayer < 3.0; // Only log if within 3 units
                
                if (isClose) {
                    console.log(`[CombatManager] Projectile ${projectile.id.substring(0, 8)}... near remote player ${remotePlayerId}: distance=${projectileToPlayer.toFixed(2)}`);
                }
                
                // Check headshot (smaller hitbox at head level)
                const headPosition = remotePlayerPosition.clone().add(new THREE.Vector3(0, 1.7, 0)); // Head is ~1.7 units above feet
                const headDistance = projectilePosition.distanceTo(headPosition);
                
                if (isClose) {
                    console.log(`[CombatManager] Remote head distance: ${headDistance.toFixed(2)}, threshold: ${HEAD_HITBOX_SIZE}`);
                }
                
                if (headDistance < HEAD_HITBOX_SIZE) {
                    console.log(`[CombatManager] REMOTE HEADSHOT! Projectile ${projectile.id.substring(0, 8)}... hit remote player ${remotePlayerId} (distance: ${headDistance.toFixed(2)})`);
                    
                    // Apply damage with headshot multiplier
                    const damage = projectile.getDamage() * HEADSHOT_MULTIPLIER;
                    
                    // Send damage to network
                    if (this.networkManager) {
                        this.networkManager.sendPlayerDamage(
                            remotePlayerId,
                            damage,
                            true // isHeadshot
                        );
                    }
                    
                    // Create hit effect
                    this.createHitMarker(projectilePosition, true);
                    
                    // Mark projectile as hit
                    projectile.onHit(null, true); // null because RemotePlayer is not a Player
                    break;
                }
                
                // Check body shot (larger hitbox)
                const bodyPosition = remotePlayerPosition.clone().add(new THREE.Vector3(0, 0.9, 0)); // Body center is ~0.9 units above feet
                const bodyDistance = projectilePosition.distanceTo(bodyPosition);
                
                if (isClose) {
                    console.log(`[CombatManager] Remote body distance: ${bodyDistance.toFixed(2)}, threshold: ${BODY_HITBOX_SIZE}`);
                }
                
                if (bodyDistance < BODY_HITBOX_SIZE) {
                    console.log(`[CombatManager] REMOTE BODY HIT! Projectile ${projectile.id.substring(0, 8)}... hit remote player ${remotePlayerId} (distance: ${bodyDistance.toFixed(2)})`);
                    
                    // Apply normal damage
                    const damage = projectile.getDamage();
                    
                    // Send damage to network
                    if (this.networkManager) {
                        this.networkManager.sendPlayerDamage(
                            remotePlayerId,
                            damage,
                            false // not a headshot
                        );
                    }
                    
                    // Create hit effect
                    this.createHitMarker(projectilePosition, false);
                    
                    // Mark projectile as hit
                    projectile.onHit(null, false); // null because RemotePlayer is not a Player
                    break;
                }
            }
        }
    }
}