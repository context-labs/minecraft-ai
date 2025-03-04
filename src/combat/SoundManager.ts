import { WeaponType } from './Weapon';

// Sound categories
export enum SoundCategory {
    WEAPON_FIRE,
    WEAPON_RELOAD,
    WEAPON_EMPTY,
    PLAYER_DAMAGE,
    PLAYER_DEATH,
    PROJECTILE_HIT
}

export class SoundManager {
    private static instance: SoundManager;
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private volume: number = 0.5;
    
    // Sound paths
    private soundPaths = {
        [WeaponType.SWORD]: {
            attack: '/sounds/combat/sword_swing.mp3',
            hit: '/sounds/combat/sword_hit.mp3'
        },
        [WeaponType.PISTOL]: {
            fire: '/sounds/combat/pistol_fire.mp3',
            reload: '/sounds/combat/pistol_reload.mp3',
            empty: '/sounds/combat/gun_empty.mp3'
        },
        [WeaponType.RIFLE]: {
            fire: '/sounds/combat/rifle_fire.mp3',
            reload: '/sounds/combat/rifle_reload.mp3',
            empty: '/sounds/combat/gun_empty.mp3'
        },
        player: {
            damage: '/sounds/combat/player_hurt.mp3',
            death: '/sounds/combat/player_death.mp3'
        },
        projectile: {
            hit: {
                block: '/sounds/combat/bullet_impact.mp3',
                player: '/sounds/combat/bullet_flesh.mp3'
            }
        }
    };
    
    private constructor() {
        // Private constructor to enforce singleton pattern
    }
    
    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }
    
    public setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        
        // Update volume for all loaded sounds
        this.sounds.forEach(sound => {
            sound.volume = this.volume;
        });
    }
    
    public playWeaponSound(weaponType: WeaponType, action: 'attack' | 'fire' | 'reload' | 'empty' | 'hit'): void {
        let soundPath = '';
        
        switch (weaponType) {
            case WeaponType.SWORD:
                if (action === 'attack' || action === 'hit') {
                    soundPath = this.soundPaths[weaponType][action];
                }
                break;
            case WeaponType.PISTOL:
            case WeaponType.RIFLE:
                if (action === 'fire' || action === 'reload' || action === 'empty') {
                    soundPath = this.soundPaths[weaponType][action];
                }
                break;
        }
        
        if (soundPath) {
            this.playSound(soundPath);
        }
    }
    
    public playPlayerSound(action: 'damage' | 'death'): void {
        const soundPath = this.soundPaths.player[action];
        if (soundPath) {
            this.playSound(soundPath);
        }
    }
    
    public playProjectileHitSound(target: 'block' | 'player'): void {
        const soundPath = this.soundPaths.projectile.hit[target];
        if (soundPath) {
            this.playSound(soundPath);
        }
    }
    
    private playSound(path: string): void {
        try {
            // Check if sound is already loaded
            let sound = this.sounds.get(path);
            
            if (!sound) {
                // Create and load the sound
                sound = new Audio(path);
                sound.volume = this.volume;
                this.sounds.set(path, sound);
            }
            
            // Reset and play
            sound.currentTime = 0;
            sound.play().catch(error => {
                console.error(`Error playing sound ${path}:`, error);
            });
        } catch (error) {
            console.error(`Error with sound ${path}:`, error);
        }
    }
    
    public preloadSounds(): void {
        // Preload all weapon sounds
        Object.values(WeaponType).forEach(type => {
            if (typeof type === 'number') {
                const weaponSounds = this.soundPaths[type];
                if (weaponSounds) {
                    Object.values(weaponSounds).forEach(path => {
                        this.preloadSound(path);
                    });
                }
            }
        });
        
        // Preload player sounds
        Object.values(this.soundPaths.player).forEach(path => {
            this.preloadSound(path);
        });
        
        // Preload projectile hit sounds
        Object.values(this.soundPaths.projectile.hit).forEach(path => {
            this.preloadSound(path);
        });
    }
    
    private preloadSound(path: string): void {
        if (!this.sounds.has(path)) {
            const audio = new Audio();
            audio.src = path;
            audio.volume = this.volume;
            audio.preload = 'auto';
            this.sounds.set(path, audio);
        }
    }
} 