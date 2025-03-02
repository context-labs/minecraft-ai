import { serve } from 'bun';
import { join } from 'path';
import { readFileSync } from 'fs';
import * as http from 'http';
import express from 'express';

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

const app = express();
const DEFAULT_PORT = 3000;
const MAX_PORT_ATTEMPTS = 10;

function startServer(port: number, attempt: number = 0): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Server started on port ${port}`);
      resolve(server);
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${port} is in use, trying port ${port + 1}...`);
        
        if (attempt < MAX_PORT_ATTEMPTS) {
          // Try the next port
          server.close();
          startServer(port + 1, attempt + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts`));
        }
      } else {
        reject(error);
      }
    });
  });
}

// Try to start server with port fallback
async function startServerWithFallback(initialPort: number, maxAttempts: number = 10) {
  let currentPort = initialPort;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const server = serve({
        port: currentPort,
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
      
      console.log(`Server started successfully on port ${currentPort}`);
      return server;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        attempts++;
        currentPort++;
        console.log(`Port ${currentPort-1} is in use, trying port ${currentPort}...`);
      } else {
        // If it's not a port-in-use error, rethrow it
        console.error('Server error:', error);
        throw error;
      }
    }
  }
  
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

// Use the function instead of direct serve call
startServerWithFallback(3000)
  .catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  }); 