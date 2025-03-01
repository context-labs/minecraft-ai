import * as fs from 'fs';
import * as path from 'path';

// This script generates a simple texture atlas for development
// In a real game, you would use proper textures

export async function generateTextureAtlas() {
    console.log('Generating texture atlas...');
    
    try {
        // Define colors for different block types
        const colors = [
            [123, 172, 81],   // 0: Grass top (green)
            [140, 140, 140],  // 1: Stone (gray)
            [134, 96, 67],    // 2: Dirt (brown)
            [110, 156, 78],   // 3: Grass side (light green)
            [110, 85, 48],    // 4: Wood side (brown)
            [167, 125, 76],   // 5: Wood top (light brown)
            [58, 94, 37],     // 6: Leaves (dark green)
            [47, 92, 170],    // 7: Water (blue)
            [219, 206, 142],  // 8: Sand (tan)
            [51, 51, 51]      // 9: Bedrock (dark gray)
        ];
        
        // Create a 256x256 image with 16x16 textures
        const width = 256;
        const height = 256;
        const textureSize = 16;
        const texturesPerRow = width / textureSize;
        
        // Create a canvas in memory using HTML
        const html = `
        <!DOCTYPE html>
        <html>
        <body>
            <canvas id="canvas" width="${width}" height="${height}"></canvas>
            <script>
                const canvas = document.getElementById('canvas');
                const ctx = canvas.getContext('2d');
                
                // Fill with black background
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, ${width}, ${height});
                
                // Define colors
                const colors = ${JSON.stringify(colors)};
                const textureSize = ${textureSize};
                const texturesPerRow = ${texturesPerRow};
                
                // Draw each texture
                for (let i = 0; i < colors.length; i++) {
                    const row = Math.floor(i / texturesPerRow);
                    const col = i % texturesPerRow;
                    const color = colors[i];
                    
                    // Fill with base color
                    ctx.fillStyle = \`rgb(\${color[0]}, \${color[1]}, \${color[2]})\`;
                    ctx.fillRect(
                        col * textureSize,
                        row * textureSize,
                        textureSize,
                        textureSize
                    );
                    
                    // Add texture details
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                    
                    // Different patterns for different blocks
                    switch (i) {
                        case 0: // Grass top
                            for (let j = 0; j < 5; j++) {
                                const x = col * textureSize + Math.random() * textureSize;
                                const y = row * textureSize + Math.random() * textureSize;
                                ctx.fillRect(x, y, 2, 2);
                            }
                            break;
                        case 1: // Stone
                            ctx.fillRect(
                                col * textureSize + 4,
                                row * textureSize + 4,
                                8,
                                8
                            );
                            break;
                        case 3: // Grass side
                            ctx.fillRect(
                                col * textureSize,
                                row * textureSize,
                                textureSize,
                                4
                            );
                            break;
                        case 4: // Wood side
                            for (let j = 0; j < 4; j++) {
                                ctx.fillRect(
                                    col * textureSize + j * 4,
                                    row * textureSize,
                                    2,
                                    textureSize
                                );
                            }
                            break;
                        case 6: // Leaves
                            for (let j = 0; j < 8; j++) {
                                const x = col * textureSize + Math.random() * textureSize;
                                const y = row * textureSize + Math.random() * textureSize;
                                ctx.fillRect(x, y, 3, 3);
                            }
                            break;
                    }
                }
                
                // Output the PNG data
                console.log(canvas.toDataURL('image/png').split(',')[1]);
            </script>
        </body>
        </html>
        `;
        
        // Create a temporary HTML file
        const tempHtmlPath = path.join(process.cwd(), 'temp-atlas-generator.html');
        fs.writeFileSync(tempHtmlPath, html);
        
        // Use Bun to run the HTML file and capture the output
        const proc = Bun.spawn(['bun', 'run', 'browser', tempHtmlPath]);
        const output = await new Response(proc.stdout).text();
        
        // Clean up the temporary file
        fs.unlinkSync(tempHtmlPath);
        
        // Extract the base64 PNG data
        const base64Data = output.trim();
        
        // Create a simpler fallback if the browser approach fails
        if (!base64Data || base64Data.length < 100) {
            console.log("Browser approach failed, using fallback method");
            return generateFallbackTextureAtlas();
        }
        
        // Decode the base64 data
        const pngData = Buffer.from(base64Data, 'base64');
        
        // Create the output directory if it doesn't exist
        const outputPath = path.join(process.cwd(), 'public', 'textures', 'atlas.png');
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write the PNG file
        fs.writeFileSync(outputPath, pngData);
        
        console.log(`Texture atlas created at: ${outputPath}`);
    } catch (error) {
        console.error('Error creating texture atlas:', error);
        // Use fallback method if the main method fails
        await generateFallbackTextureAtlas();
    }
}

// Fallback method that creates a simple valid PNG
async function generateFallbackTextureAtlas() {
    try {
        // Create a simple valid PNG file with colored blocks
        const width = 256;
        const height = 256;
        const textureSize = 16;
        const data = new Uint8Array(width * height * 4);
        
        // Fill with black background
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 0;       // R
            data[i + 1] = 0;   // G
            data[i + 2] = 0;   // B
            data[i + 3] = 255; // A
        }
        
        // Define colors for different block types
        const colors = [
            [123, 172, 81],   // 0: Grass top (green)
            [140, 140, 140],  // 1: Stone (gray)
            [134, 96, 67],    // 2: Dirt (brown)
            [110, 156, 78],   // 3: Grass side (light green)
            [110, 85, 48],    // 4: Wood side (brown)
            [167, 125, 76],   // 5: Wood top (light brown)
            [58, 94, 37],     // 6: Leaves (dark green)
            [47, 92, 170],    // 7: Water (blue)
            [219, 206, 142],  // 8: Sand (tan)
            [51, 51, 51]      // 9: Bedrock (dark gray)
        ];
        
        // Draw colored squares for each block type
        for (let i = 0; i < colors.length; i++) {
            const row = Math.floor(i / (width / textureSize));
            const col = i % (width / textureSize);
            const color = colors[i];
            
            for (let y = 0; y < textureSize; y++) {
                for (let x = 0; x < textureSize; x++) {
                    const pixelX = col * textureSize + x;
                    const pixelY = row * textureSize + y;
                    const index = (pixelY * width + pixelX) * 4;
                    
                    data[index] = color[0];     // R
                    data[index + 1] = color[1]; // G
                    data[index + 2] = color[2]; // B
                    data[index + 3] = 255;      // A
                }
            }
        }
        
        // Create the output directory if it doesn't exist
        const outputPath = path.join(process.cwd(), 'public', 'textures', 'atlas.png');
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write the data to a file
        fs.writeFileSync(outputPath, createPNG(width, height, data));
        
        console.log(`Fallback texture atlas created at: ${outputPath}`);
    } catch (error) {
        console.error('Error creating fallback texture atlas:', error);
    }
}

// Function to create a simple PNG file
function createPNG(width: number, height: number, data: Uint8Array): Buffer {
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR chunk
    const IHDR = Buffer.alloc(25);
    IHDR.writeUInt32BE(13, 0);                // Length
    IHDR.write('IHDR', 4);                    // Chunk type
    IHDR.writeUInt32BE(width, 8);            // Width
    IHDR.writeUInt32BE(height, 12);          // Height
    IHDR.writeUInt8(8, 16);                  // Bit depth
    IHDR.writeUInt8(6, 17);                  // Color type (RGBA)
    IHDR.writeUInt8(0, 18);                  // Compression method
    IHDR.writeUInt8(0, 19);                  // Filter method
    IHDR.writeUInt8(0, 20);                  // Interlace method
    
    // Calculate CRC for IHDR
    const crc = calculateCRC(IHDR.subarray(4, 21));
    IHDR.writeUInt32BE(crc, 21);
    
    // IDAT chunk (simple uncompressed data for demonstration)
    // In a real implementation, you would use proper compression
    const IDAT = Buffer.alloc(12 + data.length);
    IDAT.writeUInt32BE(data.length, 0);      // Length
    IDAT.write('IDAT', 4);                    // Chunk type
    Buffer.from(data).copy(IDAT, 8);          // Data
    
    // Calculate CRC for IDAT
    const idatCrc = calculateCRC(Buffer.concat([
        Buffer.from('IDAT'),
        Buffer.from(data)
    ]));
    IDAT.writeUInt32BE(idatCrc, 8 + data.length);
    
    // IEND chunk
    const IEND = Buffer.from([
        0x00, 0x00, 0x00, 0x00,              // Length
        0x49, 0x45, 0x4E, 0x44,              // 'IEND'
        0xAE, 0x42, 0x60, 0x82               // CRC
    ]);
    
    // Combine all chunks
    return Buffer.concat([signature, IHDR, IDAT, IEND]);
}

// Simple CRC calculation for PNG chunks
function calculateCRC(data: Buffer | Uint8Array): number {
    let crc = 0xFFFFFFFF;
    const crcTable: number[] = [];
    
    // Generate CRC table
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xEDB88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }
        crcTable[n] = c;
    }
    
    // Calculate CRC
    for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    
    return crc ^ 0xFFFFFFFF;
}

// Run the generator if this file is executed directly
if (import.meta.url === Bun.main) {
    generateTextureAtlas().catch(console.error);
} 