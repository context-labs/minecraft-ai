import * as THREE from 'three';
import { BlockType } from '../world/Block';
import { WeaponType } from '../combat/Weapon';

// Constants for animation
const ATTACK_ANIMATION_DURATION = 300; // milliseconds
const DAMAGE_EFFECT_DURATION = 500; // milliseconds

export class RemotePlayer {
    public id: string;
    public position: THREE.Vector3;
    public rotation: { x: number; y: number };
    public selectedBlockType: BlockType;
    public username: string;
    public mesh: THREE.Group;
    public equippedWeaponType: number = -1; // No weapon equipped by default
    public weaponMesh: THREE.Object3D | null = null;
    public isAttacking: boolean = false;
    public attackAnimationTime: number = 0;
    private _health: number = 100; // Default health
    public isDead: boolean = false;
    public damageEffectTime: number = 0;

    // Getter and setter for health
    public get health(): number {
        return this._health;
    }
    
    public set health(value: number) {
        this._health = value;
        this.updateHealthBar();
    }

    private targetPosition: THREE.Vector3;
    private previousPosition: THREE.Vector3;
    private targetRotation: { x: number; y: number };
    private previousRotation: { x: number; y: number };
    private interpolationStart: number = 0;
    private interpolationDuration: number = 40; // 40ms interpolation
    private nameTag: THREE.Sprite | null = null;
    private healthBar: THREE.Mesh | null = null;
    private originalMaterials: THREE.Material[] = [];

    constructor(data: any, scene: THREE.Scene) {
        this.id = data.id;
        this.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        this.rotation = { x: data.rotation.x, y: data.rotation.y };
        this.selectedBlockType = data.selectedBlockType;
        this.username = data.username;
        
        // Create player mesh
        this.mesh = this.createPlayerMesh();
        
        // Add name tag
        this.createNameTag();
        
        // Add health bar
        this.createHealthBar();
        
        // Initialize health if provided
        if (data.health !== undefined) {
            this.health = data.health;
            this.updateHealthBar();
        }
        
        // Initialize equipped weapon if provided
        if (data.equippedWeaponType !== undefined) {
            this.equippedWeaponType = data.equippedWeaponType;
            this.updateWeaponMesh();
        }

        scene.add(this.mesh);

        this.targetPosition = this.position.clone();
        this.previousPosition = this.position.clone();
        this.targetRotation = { ...this.rotation };
        this.previousRotation = { ...this.rotation };

        this.updatePositionAndRotation();
    }

    private createPlayerMesh(): THREE.Group {
        const group = new THREE.Group();

        // Create body
        const bodyGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x0000ff });
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.originalMaterials.push(bodyMaterial);
        group.add(bodyMesh);

        // Create head
        const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
        const headMesh = new THREE.Mesh(headGeometry, headMaterial);
        headMesh.position.y = 1.2;
        this.originalMaterials.push(headMaterial);
        group.add(headMesh);

        // Create arms
        const armGeometry = new THREE.BoxGeometry(0.4, 1.2, 0.4);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        
        // Left arm
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.5, 0.3, 0);
        this.originalMaterials.push(armMaterial);
        group.add(leftArm);
        
        // Right arm
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.5, 0.3, 0);
        this.originalMaterials.push(armMaterial.clone());
        group.add(rightArm);

        return group;
    }

    private createNameTag(): void {
        // Create canvas for name tag
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        if (context) {
            context.fillStyle = '#000000';
            context.font = 'Bold 24px Arial';
            context.textAlign = 'center';
            context.fillText(this.username, 128, 32);
            
            // Create sprite for name tag
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            this.nameTag = new THREE.Sprite(material);
            this.nameTag.position.y = 2.5; // Position above player's head
            this.nameTag.scale.set(2, 0.5, 1);
            
            this.mesh.add(this.nameTag);
        }
    }

    private createHealthBar(): void {
        // Create health bar background
        const bgGeometry = new THREE.BoxGeometry(1, 0.1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
        bgMesh.position.y = 2.2; // Position above player's head
        
        // Create health bar foreground
        const fgGeometry = new THREE.BoxGeometry(1, 0.1, 0.1);
        const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.healthBar = new THREE.Mesh(fgGeometry, fgMaterial);
        this.healthBar.position.z = 0.01; // Slightly in front of background
        
        // Add health bar to background
        bgMesh.add(this.healthBar);
        
        // Add health bar to player mesh
        this.mesh.add(bgMesh);
    }

    public update(data: any): void {
        // Update position and rotation
        this.previousPosition.copy(this.position);
        this.targetPosition.set(data.position.x, data.position.y, data.position.z);
        
        this.previousRotation = { ...this.rotation };
        this.targetRotation = { x: data.rotation.x, y: data.rotation.y };
        
        this.interpolationStart = performance.now();
        
        // Update selected block type
        if (data.selectedBlockType !== undefined) {
            this.selectedBlockType = data.selectedBlockType;
        }
        
        // Update health if provided
        if (data.health !== undefined) {
            this.health = data.health;
            this.updateHealthBar();
        }
        
        // Update isDead if provided
        if (data.isDead !== undefined) {
            this.isDead = data.isDead;
            
            // Update player appearance if dead
            if (this.isDead) {
                this.mesh.rotation.x = Math.PI / 2; // Lay player down
            } else {
                this.mesh.rotation.x = 0; // Stand player up
            }
            
            // Update health bar
            this.updateHealthBar();
        }
        
        // Update equipped weapon if provided
        if (data.equippedWeaponType !== undefined && data.equippedWeaponType !== this.equippedWeaponType) {
            this.equippedWeaponType = data.equippedWeaponType;
            this.updateWeaponMesh();
        }
    }

    private updatePositionAndRotation(): void {
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation.y;
        
        // Update weapon position if equipped
        if (this.weaponMesh) {
            this.weaponMesh.rotation.x = this.rotation.x;
        }
    }

    public interpolate(timestamp: number): void {
        const progress = Math.min(1, (timestamp - this.interpolationStart) / this.interpolationDuration);
        
        // Interpolate position
        this.position.lerpVectors(this.previousPosition, this.targetPosition, progress);
        
        // Interpolate rotation
        this.rotation.x = this.previousRotation.x + (this.targetRotation.x - this.previousRotation.x) * progress;
        this.rotation.y = this.previousRotation.y + (this.targetRotation.y - this.previousRotation.y) * progress;
        
        this.updatePositionAndRotation();
    }

    public dispose(scene: THREE.Scene): void {
        // Remove player mesh from scene
        scene.remove(this.mesh);
        
        // Dispose of geometries and materials
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    public updateWeaponMesh(): void {
        // Remove existing weapon mesh if any
        if (this.weaponMesh) {
            this.mesh.remove(this.weaponMesh);
        }
        
        // Create new weapon mesh based on type
        if (this.equippedWeaponType >= 0) {
            this.weaponMesh = this.createWeaponMesh(this.equippedWeaponType);
            this.mesh.add(this.weaponMesh);
        } else {
            this.weaponMesh = null;
        }
    }

    private createWeaponMesh(weaponType: number): THREE.Object3D {
        let weaponMesh: THREE.Object3D;
        
        switch (weaponType) {
            case WeaponType.SWORD:
                // Create sword mesh
                const swordGeometry = new THREE.BoxGeometry(0.1, 1, 0.1);
                const swordMaterial = new THREE.MeshStandardMaterial({
                    color: 0xcccccc,
                    metalness: 0.8,
                    roughness: 0.2
                });
                weaponMesh = new THREE.Mesh(swordGeometry, swordMaterial);
                
                // Add sword handle
                const handleGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.15);
                const handleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x8B4513,
                    metalness: 0.3,
                    roughness: 0.8
                });
                const handle = new THREE.Mesh(handleGeometry, handleMaterial);
                handle.position.y = -0.6;
                weaponMesh.add(handle);
                
                // Position sword in hand
                weaponMesh.position.set(0.7, 0.3, 0.4);
                weaponMesh.rotation.z = Math.PI / 4;
                break;
                
            case WeaponType.PISTOL:
                // Create pistol mesh
                const pistolGroup = new THREE.Group();
                
                // Pistol body
                const pistolBodyGeometry = new THREE.BoxGeometry(0.2, 0.3, 0.6);
                const pistolBodyMaterial = new THREE.MeshStandardMaterial({
                    color: 0x333333,
                    metalness: 0.8,
                    roughness: 0.2
                });
                const pistolBody = new THREE.Mesh(pistolBodyGeometry, pistolBodyMaterial);
                pistolGroup.add(pistolBody);
                
                // Pistol handle
                const pistolHandleGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.2);
                const pistolHandleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x8B4513,
                    metalness: 0.3,
                    roughness: 0.8
                });
                const pistolHandle = new THREE.Mesh(pistolHandleGeometry, pistolHandleMaterial);
                pistolHandle.position.set(0, -0.3, -0.1);
                pistolGroup.add(pistolHandle);
                
                // Position pistol in hand
                pistolGroup.position.set(0.7, 0.3, 0.4);
                
                weaponMesh = pistolGroup;
                break;
                
            case WeaponType.RIFLE:
                // Create rifle mesh
                const rifleGroup = new THREE.Group();
                
                // Rifle body
                const rifleBodyGeometry = new THREE.BoxGeometry(0.2, 0.3, 1.2);
                const rifleBodyMaterial = new THREE.MeshStandardMaterial({
                    color: 0x333333,
                    metalness: 0.8,
                    roughness: 0.2
                });
                const rifleBody = new THREE.Mesh(rifleBodyGeometry, rifleBodyMaterial);
                rifleGroup.add(rifleBody);
                
                // Rifle handle
                const rifleHandleGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.2);
                const rifleHandleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x8B4513,
                    metalness: 0.3,
                    roughness: 0.8
                });
                const rifleHandle = new THREE.Mesh(rifleHandleGeometry, rifleHandleMaterial);
                rifleHandle.position.set(0, -0.3, -0.3);
                rifleGroup.add(rifleHandle);
                
                // Rifle stock
                const rifleStockGeometry = new THREE.BoxGeometry(0.15, 0.25, 0.4);
                const rifleStockMaterial = new THREE.MeshStandardMaterial({
                    color: 0x8B4513,
                    metalness: 0.3,
                    roughness: 0.8
                });
                const rifleStock = new THREE.Mesh(rifleStockGeometry, rifleStockMaterial);
                rifleStock.position.set(0, -0.1, -0.7);
                rifleGroup.add(rifleStock);
                
                // Position rifle in hand
                rifleGroup.position.set(0.7, 0.3, 0.4);
                
                weaponMesh = rifleGroup;
                break;
                
            default:
                // Default empty weapon
                weaponMesh = new THREE.Group();
                break;
        }
        
        return weaponMesh;
    }

    public startAttackAnimation(weaponType: number): void {
        this.isAttacking = true;
        this.attackAnimationTime = 0;
    }

    public updateAttackAnimation(deltaTime: number): void {
        if (!this.isAttacking) return;
        
        this.attackAnimationTime += deltaTime * 1000; // Convert to milliseconds
        
        const progress = Math.min(1, this.attackAnimationTime / ATTACK_ANIMATION_DURATION);
        
        // Animate based on weapon type
        switch (this.equippedWeaponType) {
            case WeaponType.SWORD:
                this.animateSwordAttack(progress);
                break;
                
            case WeaponType.PISTOL:
                this.animatePistolAttack(progress);
                break;
                
            case WeaponType.RIFLE:
                this.animateRifleAttack(progress);
                break;
        }
        
        // Reset animation when complete
        if (progress >= 1) {
            this.isAttacking = false;
            this.resetWeaponPosition();
        }
    }

    private animateSwordAttack(progress: number): void {
        if (!this.weaponMesh) return;
        
        // Swing sword in an arc
        if (progress < 0.5) {
            // Wind up
            const windupProgress = progress * 2; // 0 to 1 during first half
            this.weaponMesh.rotation.z = Math.PI / 4 - (Math.PI / 2) * windupProgress;
        } else {
            // Swing
            const swingProgress = (progress - 0.5) * 2; // 0 to 1 during second half
            this.weaponMesh.rotation.z = -Math.PI / 4 + (Math.PI * 3/4) * swingProgress;
        }
    }

    private animatePistolAttack(progress: number): void {
        if (!this.weaponMesh) return;
        
        // Simple recoil animation
        if (progress < 0.2) {
            // Recoil back
            const recoilProgress = progress * 5; // 0 to 1 during first 20%
            this.weaponMesh.position.z = 0.4 - 0.1 * recoilProgress;
            this.weaponMesh.rotation.x = 0.1 * recoilProgress;
        } else {
            // Return to position
            const returnProgress = (progress - 0.2) * 1.25; // 0 to 1 during remaining 80%
            this.weaponMesh.position.z = 0.3 + 0.1 * returnProgress;
            this.weaponMesh.rotation.x = 0.1 - 0.1 * returnProgress;
        }
    }

    private animateRifleAttack(progress: number): void {
        if (!this.weaponMesh) return;
        
        // Simple recoil animation
        if (progress < 0.2) {
            // Recoil back
            const recoilProgress = progress * 5; // 0 to 1 during first 20%
            this.weaponMesh.position.z = 0.4 - 0.15 * recoilProgress;
            this.weaponMesh.rotation.x = 0.15 * recoilProgress;
        } else {
            // Return to position
            const returnProgress = (progress - 0.2) * 1.25; // 0 to 1 during remaining 80%
            this.weaponMesh.position.z = 0.25 + 0.15 * returnProgress;
            this.weaponMesh.rotation.x = 0.15 - 0.15 * returnProgress;
        }
    }

    private resetWeaponPosition(): void {
        if (!this.weaponMesh) return;
        
        // Reset weapon to default position
        switch (this.equippedWeaponType) {
            case WeaponType.SWORD:
                this.weaponMesh.position.set(0.7, 0.3, 0.4);
                this.weaponMesh.rotation.z = Math.PI / 4;
                break;
                
            case WeaponType.PISTOL:
            case WeaponType.RIFLE:
                this.weaponMesh.position.set(0.7, 0.3, 0.4);
                this.weaponMesh.rotation.x = 0;
                break;
        }
    }

    public showDamageEffect(): void {
        this.damageEffectTime = DAMAGE_EFFECT_DURATION;
        
        // Change materials to red to indicate damage
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.material instanceof THREE.MeshLambertMaterial || 
                    child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.color.set(0xff0000);
                }
            }
        });
    }

    public updateDamageEffect(deltaTime: number): void {
        if (this.damageEffectTime <= 0) return;
        
        this.damageEffectTime -= deltaTime * 1000; // Convert to milliseconds
        
        // Reset materials when effect is done
        if (this.damageEffectTime <= 0) {
            this.resetMaterials();
        }
    }

    private resetMaterials(): void {
        // Reset materials to original colors
        let materialIndex = 0;
        
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (materialIndex < this.originalMaterials.length) {
                    if (child.material instanceof THREE.MeshLambertMaterial) {
                        // Copy color from original material
                        const originalMaterial = this.originalMaterials[materialIndex];
                        if (originalMaterial instanceof THREE.MeshLambertMaterial) {
                            child.material.color.copy(originalMaterial.color);
                        }
                        materialIndex++;
                    } else if (child.material instanceof THREE.MeshStandardMaterial) {
                        // Copy color from original material
                        const originalMaterial = this.originalMaterials[materialIndex];
                        if (originalMaterial instanceof THREE.MeshStandardMaterial) {
                            child.material.color.copy(originalMaterial.color);
                        }
                        materialIndex++;
                    }
                }
            }
        });
    }

    private updateHealthBar(): void {
        if (!this.healthBar) return;
        
        // Update health bar scale based on health percentage
        const healthPercent = Math.max(0, this.health) / 100;
        this.healthBar.scale.x = healthPercent;
        
        // Position health bar to align left
        this.healthBar.position.x = (healthPercent - 1) / 2;
        
        // Update color based on health
        if (this.healthBar.material instanceof THREE.MeshBasicMaterial) {
            if (healthPercent > 0.6) {
                this.healthBar.material.color.set(0x00ff00); // Green
            } else if (healthPercent > 0.3) {
                this.healthBar.material.color.set(0xffff00); // Yellow
            } else {
                this.healthBar.material.color.set(0xff0000); // Red
            }
        }
    }
} 