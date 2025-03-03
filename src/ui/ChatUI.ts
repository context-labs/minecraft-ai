import { NetworkManager } from '../core/NetworkManager';
import type { ChatMessage } from '../core/NetworkManager';

export class ChatUI {
    private container: HTMLElement;
    private messagesContainer: HTMLElement;
    private inputContainer: HTMLElement;
    private input: HTMLInputElement;
    private networkManager: NetworkManager;
    private isVisible: boolean = false;
    private messageTimeout: number | null = null;
    private hideDelay: number = 5000; // 5 seconds
    
    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager;
        
        // Create chat UI
        this.container = document.createElement('div');
        this.container.className = 'chat-container';
        this.container.style.position = 'absolute';
        this.container.style.bottom = '10px';
        this.container.style.left = '10px';
        this.container.style.width = '400px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.borderRadius = '5px';
        this.container.style.padding = '10px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.fontSize = '14px';
        this.container.style.zIndex = '100';
        this.container.style.display = 'none';
        
        // Create messages container
        this.messagesContainer = document.createElement('div');
        this.messagesContainer.className = 'chat-messages';
        this.messagesContainer.style.maxHeight = '200px';
        this.messagesContainer.style.overflowY = 'auto';
        this.messagesContainer.style.marginBottom = '10px';
        
        // Create input container
        this.inputContainer = document.createElement('div');
        this.inputContainer.className = 'chat-input-container';
        this.inputContainer.style.display = 'flex';
        
        // Create input
        this.input = document.createElement('input');
        this.input.className = 'chat-input';
        this.input.style.flex = '1';
        this.input.style.padding = '5px';
        this.input.style.borderRadius = '3px';
        this.input.style.border = 'none';
        this.input.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        this.input.style.color = 'white';
        this.input.placeholder = 'Press T to chat...';
        
        // Add input to input container
        this.inputContainer.appendChild(this.input);
        
        // Add elements to container
        this.container.appendChild(this.messagesContainer);
        this.container.appendChild(this.inputContainer);
        
        // Add container to document
        document.body.appendChild(this.container);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Subscribe to chat messages
        this.networkManager.addChatListener(this.onChatMessage.bind(this));
    }
    
    private setupEventListeners(): void {
        // Listen for T key to open chat
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 't' && !this.isInputFocused()) {
                event.preventDefault();
                this.showChat();
                this.input.focus();
            }
            
            // Listen for Escape key to close chat
            if (event.key === 'Escape' && this.isInputFocused()) {
                event.preventDefault();
                this.hideChat();
                this.input.blur();
            }
            
            // Listen for Enter key to send message
            if (event.key === 'Enter' && this.isInputFocused()) {
                event.preventDefault();
                this.sendMessage();
            }
        });
        
        // Listen for input focus changes
        this.input.addEventListener('focus', () => {
            // Clear any hide timeout
            if (this.messageTimeout !== null) {
                clearTimeout(this.messageTimeout);
                this.messageTimeout = null;
            }
        });
        
        this.input.addEventListener('blur', () => {
            // Hide chat after delay
            this.startHideTimeout();
        });
    }
    
    private isInputFocused(): boolean {
        return document.activeElement === this.input;
    }
    
    private showChat(): void {
        this.container.style.display = 'block';
        this.isVisible = true;
        
        // Clear any hide timeout
        if (this.messageTimeout !== null) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }
    }
    
    private hideChat(): void {
        if (!this.isInputFocused() && this.input.value === '') {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }
    
    private startHideTimeout(): void {
        // Clear any existing timeout
        if (this.messageTimeout !== null) {
            clearTimeout(this.messageTimeout);
        }
        
        // Set new timeout to hide chat
        this.messageTimeout = window.setTimeout(() => {
            this.hideChat();
            this.messageTimeout = null;
        }, this.hideDelay);
    }
    
    private sendMessage(): void {
        const message = this.input.value.trim();
        
        if (message !== '') {
            // Send message to server
            this.networkManager.sendChatMessage(message);
            
            // Clear input
            this.input.value = '';
        }
        
        // Blur input
        this.input.blur();
    }
    
    private onChatMessage(message: ChatMessage): void {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.style.marginBottom = '5px';
        messageElement.style.wordBreak = 'break-word';
        
        // Format timestamp
        const date = new Date(message.timestamp);
        const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        // Set message content
        messageElement.innerHTML = `<span style="color: #aaa;">[${time}]</span> <span style="color: #ff9;">${message.player.username}:</span> ${this.escapeHTML(message.message)}`;
        
        // Add message to container
        this.messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        
        // Show chat
        this.showChat();
        
        // Start hide timeout if input is not focused
        if (!this.isInputFocused()) {
            this.startHideTimeout();
        }
    }
    
    private escapeHTML(html: string): string {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    public update(): void {
        // Update chat UI as needed
    }
} 