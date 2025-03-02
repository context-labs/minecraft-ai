import * as THREE from 'three';

export class SkySystem {
    private scene: THREE.Scene;
    private sun: THREE.Mesh;
    private moon: THREE.Mesh;
    private skyDome: THREE.Mesh;
    
    // Change day duration to 2 minutes total (1 min day + 1 min night)
    private dayDuration: number = 120; // 2 minutes in seconds
    private timeOfDay: number = 0; // 0-1 representing time of day (0 = midnight, 0.5 = noon)
    private dayCount: number = 1;
    
    // Sky colors for different times of day - expanded for better gradients
    private skyColors = {
        night: new THREE.Color(0x0a0a2a),      // Dark blue
        predawn: new THREE.Color(0x1a1a4a),    // Deep blue
        dawn: new THREE.Color(0xf08020),        // Orange-red
        morning: new THREE.Color(0x87CEEB),     // Light blue
        day: new THREE.Color(0x4a9eff),         // Sky blue
        afternoon: new THREE.Color(0x87CEEB),   // Light blue
        dusk: new THREE.Color(0xff7733),        // Orange-red
        postdusk: new THREE.Color(0x1a1a4a)     // Deep blue
    };
    
    // Light intensities
    private sunlightIntensity = {
        night: 0.1,
        dawn: 0.5,
        day: 1.0,
        dusk: 0.5
    };
    
    // Directional light for sun
    private sunLight: THREE.DirectionalLight;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        
        // Create sky dome
        const skyGeometry = new THREE.SphereGeometry(900, 32, 32);
        // Make it render on the inside
        skyGeometry.scale(-1, 1, 1);
        
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: this.skyColors.day,
            side: THREE.BackSide
        });
        
        this.skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.skyDome);
        
        // Create square sun (larger size)
        const sunGeometry = new THREE.BoxGeometry(80, 80, 5);
        const sunMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff80,
            emissive: 0xffff00,
            emissiveIntensity: 1
        });
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sun);
        
        // Create square moon (larger size)
        const moonGeometry = new THREE.BoxGeometry(60, 60, 5);
        const moonMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            emissive: 0x555555,
            emissiveIntensity: 0.8
        });
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        this.scene.add(this.moon);
        
        // Create directional light for sun
        this.sunLight = new THREE.DirectionalLight(0xffffff, this.sunlightIntensity.day);
        this.sunLight.castShadow = true;
        
        // Configure shadow properties
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        
        this.scene.add(this.sunLight);
        
        // Set initial positions
        this.updateCelestialPositions();
    }
    
    public update(deltaTime: number): void {
        // Update time of day (complete cycle in dayDuration seconds)
        this.timeOfDay += deltaTime / this.dayDuration;
        
        // Keep time of day between 0 and 1
        if (this.timeOfDay >= 1) {
            this.timeOfDay -= 1;
            this.dayCount++;
        }
        
        // Update positions of sun and moon
        this.updateCelestialPositions();
        
        // Update sky color
        this.updateSkyColor();
        
        // Update sunlight intensity and direction
        this.updateLighting();
    }
    
    private updateCelestialPositions(): void {
        // Calculate sun position (circular path)
        const sunAngle = this.timeOfDay * Math.PI * 2;
        const sunRadius = 800; // Distance from center
        
        this.sun.position.x = Math.cos(sunAngle) * sunRadius;
        this.sun.position.y = Math.sin(sunAngle) * sunRadius;
        this.sun.position.z = 0;
        
        // Make sun always face the center
        this.sun.lookAt(0, 0, 0);
        
        // Moon is opposite to sun
        this.moon.position.x = Math.cos(sunAngle + Math.PI) * sunRadius;
        this.moon.position.y = Math.sin(sunAngle + Math.PI) * sunRadius;
        this.moon.position.z = 0;
        
        // Make moon always face the center
        this.moon.lookAt(0, 0, 0);
        
        // Update sunlight direction
        this.sunLight.position.copy(this.sun.position);
        this.sunLight.position.normalize();
    }
    
    private updateSkyColor(): void {
        let skyColor = new THREE.Color();
        
        // Improved gradient sky color system
        if (this.timeOfDay < 0.05) { // Deep night to predawn (0.0 - 0.05)
            const t = this.timeOfDay / 0.05;
            skyColor.copy(this.skyColors.night).lerp(this.skyColors.predawn, t);
        } else if (this.timeOfDay < 0.1) { // Predawn to dawn (0.05 - 0.1)
            const t = (this.timeOfDay - 0.05) / 0.05;
            skyColor.copy(this.skyColors.predawn).lerp(this.skyColors.dawn, t);
        } else if (this.timeOfDay < 0.2) { // Dawn to morning (0.1 - 0.2)
            const t = (this.timeOfDay - 0.1) / 0.1;
            skyColor.copy(this.skyColors.dawn).lerp(this.skyColors.morning, t);
        } else if (this.timeOfDay < 0.3) { // Morning to day (0.2 - 0.3)
            const t = (this.timeOfDay - 0.2) / 0.1;
            skyColor.copy(this.skyColors.morning).lerp(this.skyColors.day, t);
        } else if (this.timeOfDay < 0.4) { // Day (0.3 - 0.4)
            skyColor.copy(this.skyColors.day);
        } else if (this.timeOfDay < 0.45) { // Day to afternoon (0.4 - 0.45)
            const t = (this.timeOfDay - 0.4) / 0.05;
            skyColor.copy(this.skyColors.day).lerp(this.skyColors.afternoon, t);
        } else if (this.timeOfDay < 0.5) { // Afternoon to dusk (0.45 - 0.5)
            const t = (this.timeOfDay - 0.45) / 0.05;
            skyColor.copy(this.skyColors.day).lerp(this.skyColors.dusk, t);
        } else if (this.timeOfDay < 0.6) { // Dusk to postdusk (0.5 - 0.6)
            const t = (this.timeOfDay - 0.5) / 0.1;
            skyColor.copy(this.skyColors.dusk).lerp(this.skyColors.postdusk, t);
        } else if (this.timeOfDay < 0.7) { // Postdusk to night (0.6 - 0.7)
            const t = (this.timeOfDay - 0.6) / 0.1;
            skyColor.copy(this.skyColors.postdusk).lerp(this.skyColors.night, t);
        } else if (this.timeOfDay < 0.9) { // Full night (0.7 - 0.9)
            skyColor.copy(this.skyColors.night);
        } else { // Night to predawn transition (0.9 - 1.0)
            const t = (this.timeOfDay - 0.9) / 0.1;
            skyColor.copy(this.skyColors.night).lerp(this.skyColors.predawn, t);
        }
        
        // Update sky dome color
        (this.skyDome.material as THREE.MeshBasicMaterial).color = skyColor;
    }
    
    private updateLighting(): void {
        // Update sunlight intensity based on time of day
        let intensity = 0;
        
        if (this.timeOfDay < 0.1) { // Night to dawn
            const t = this.timeOfDay / 0.1;
            intensity = this.sunlightIntensity.night + (this.sunlightIntensity.dawn - this.sunlightIntensity.night) * t;
        } else if (this.timeOfDay < 0.15) { // Dawn to day
            const t = (this.timeOfDay - 0.1) / 0.05;
            intensity = this.sunlightIntensity.dawn + (this.sunlightIntensity.day - this.sunlightIntensity.dawn) * t;
        } else if (this.timeOfDay < 0.4) { // Day
            intensity = this.sunlightIntensity.day;
        } else if (this.timeOfDay < 0.45) { // Day to dusk
            const t = (this.timeOfDay - 0.4) / 0.05;
            intensity = this.sunlightIntensity.day + (this.sunlightIntensity.dusk - this.sunlightIntensity.day) * t;
        } else if (this.timeOfDay < 0.5) { // Dusk to night
            const t = (this.timeOfDay - 0.45) / 0.05;
            intensity = this.sunlightIntensity.dusk + (this.sunlightIntensity.night - this.sunlightIntensity.dusk) * t;
        } else { // Night
            intensity = this.sunlightIntensity.night;
        }
        
        // Update sunlight intensity
        this.sunLight.intensity = intensity;
    }

    public getTimeOfDay(): number {
        return this.timeOfDay;
    }

    public getFormattedTime(): string {
        // Convert timeOfDay (0-1) to hours and minutes (24-hour format)
        const totalMinutes = Math.floor(this.timeOfDay * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        // Format as HH:MM
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    public getDayCount(): number {
        return this.dayCount;
    }
}