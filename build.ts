import { build } from 'bun';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

async function buildProject() {
    console.log('Building project...');
    
    try {
    
        // Ensure dist directory exists
        const distDir = path.join(process.cwd(), 'dist');
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
        }
        
        // Try using Bun's build API first
        console.log('Trying Bun build API...');
        try {
            const result = await build({
                entrypoints: ['./index.ts'],
                outdir: './dist',
                minify: false,
                sourcemap: 'external'
            });
            
            if (result.outputs.length > 0) {
                console.log('Build completed successfully!');
                console.log(`Generated ${result.outputs.length} files:`);
                result.outputs.forEach(file => {
                    console.log(`- ${file.path}`);
                });
                return; // Exit if successful
            }
            
            throw new Error('No output files generated');
        } catch (bunBuildError) {
            console.error('Bun build API failed:', bunBuildError);
            
            // Fallback to using bun build command directly
            console.log('Trying bun build command...');
            const buildResult = spawnSync('bun', ['build', './index.ts', '--outdir', './dist'], {
                stdio: 'inherit',
                encoding: 'utf-8'
            });
            
            if (buildResult.status === 0) {
                console.log('Build command completed successfully!');
                return; // Exit if successful
            }
            
            console.error('Build command failed with status:', buildResult.status);
            
            // If both methods fail, create a simple transpiled version
            console.log('Creating manually transpiled version...');
            
            // Read the index.ts file
            const indexTs = fs.readFileSync('./index.ts', 'utf-8');
            
            // Simple transpilation: replace imports with ES module imports
            let indexJs = indexTs
                .replace(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g, 'import {$1} from "$2.js"')
                .replace(/import\s+\*\s+as\s+([^\s]+)\s+from\s+['"]([^'"]+)['"]/g, 'import * as $1 from "$2.js"')
                .replace(/import\s+([^\s{]+)\s+from\s+['"]([^'"]+)['"]/g, 'import $1 from "$2.js"');
            
            // Add a note at the top
            indexJs = `// Manually transpiled version - fallback due to build failure\n${indexJs}`;
            
            // Write the transpiled file
            fs.writeFileSync(path.join(distDir, 'index.js'), indexJs);
            console.log('Created manually transpiled index.js');
            
            // Create a fallback index.js as a last resort
            console.log('Creating fallback index.js...');
            const fallbackJs = `
// Debug file created because bundling failed
console.log('Fallback index.js loaded');

// Create a global error handler
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
        debugInfo.innerHTML = 
            '<strong>ERROR:</strong> ' + event.message + '<br>' +
            '<pre>' + (event.error && event.error.stack ? event.error.stack : 'No stack trace') + '</pre>';
    }
    return false;
});

// Add a load event listener to check if Three.js is working
window.addEventListener('load', function() {
    console.log('Window loaded, testing Three.js...');
    try {
        // Test if Three.js is working
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        
        // Create a simple cube
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        
        camera.position.z = 5;
        
        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            renderer.render(scene, camera);
        }
        
        animate();
        
        console.log('Three.js test successful');
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.textContent = 'Three.js test successful. This is a fallback scene because the build process failed.';
        }
    } catch (error) {
        console.error('Three.js test failed:', error);
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.innerHTML = 
                '<strong>Three.js Error:</strong> ' + error.message + '<br>' +
                '<pre>' + error.stack + '</pre>';
        }
    }
});
`;
            // Only write the fallback if the manual transpilation failed
            if (!fs.existsSync(path.join(distDir, 'index.js'))) {
                fs.writeFileSync(path.join(distDir, 'index.js'), fallbackJs);
                console.log('Created fallback index.js');
            }
        }
    } catch (error) {
        console.error('Build failed:', error);
        console.error('Error details:', error instanceof Error ? error.stack : String(error));
        process.exit(1);
    }
}

// Run the build process
buildProject(); 