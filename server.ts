import { serve } from 'bun';
import { join } from 'path';
import { readFileSync } from 'fs';

// Define content types
const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Create server
const server = serve({
    port: 3000,
    fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname;
        
        // Default to index.html for root path
        if (path === '/') {
            path = '/index.html';
        }
        
        try {
            // Determine file path
            let filePath: string;
            
            if (path.startsWith('/dist/')) {
                // Serve from dist directory
                filePath = join(process.cwd(), path);
            } else if (path === '/index.html') {
                // Serve index.html from root
                filePath = join(process.cwd(), 'index.html');
            } else if (path.startsWith('/textures/')) {
                // Serve textures from public directory
                filePath = join(process.cwd(), 'public', path);
            } else {
                // Serve other static files from public directory
                filePath = join(process.cwd(), 'public', path);
            }
            
            // Read file
            const file = readFileSync(filePath);
            
            // Determine content type
            const ext = path.substring(path.lastIndexOf('.'));
            const contentType = contentTypes[ext] || 'application/octet-stream';
            
            // Return response
            return new Response(file, {
                headers: {
                    'Content-Type': contentType
                }
            });
        } catch (error) {
            // Return 404 for file not found
            return new Response('Not Found', {
                status: 404
            });
        }
    }
});

console.log(`Server running at http://localhost:${server.port}`); 