import { Engine } from './src/core/Engine';

// Create and start the game engine
const engine = new Engine();
engine.start();

// Add event listener for window load
window.addEventListener('load', () => {
    // Display instructions
    const instructions = document.createElement('div');
    instructions.style.position = 'absolute';
    instructions.style.top = '50%';
    instructions.style.left = '50%';
    instructions.style.transform = 'translate(-50%, -50%)';
    instructions.style.color = 'white';
    instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    instructions.style.padding = '20px';
    instructions.style.borderRadius = '5px';
    instructions.style.textAlign = 'center';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.zIndex = '1000';
    instructions.innerHTML = `
        <h2>Minecraft Clone</h2>
        <p>Click anywhere to start</p>
        <p>WASD to move, Space to jump</p>
        <p>Left click to break blocks</p>
        <p>Right click to place blocks</p>
        <p>1-6 to select blocks, or scroll wheel</p>
        <p>ESC to release mouse</p>
    `;
    document.body.appendChild(instructions);
    
    // Remove instructions on click
    document.addEventListener('click', () => {
        if (instructions.parentNode) {
            instructions.parentNode.removeChild(instructions);
        }
    }, { once: true });
});