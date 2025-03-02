import { BlockType } from '../world/Block';

// Enum for item types
export enum ItemType {
    BLOCK = 'block',
    TOOL = 'tool',
}

// Enum for tool types
export enum ToolType {
    NONE = 'none',
    WOODEN_PICKAXE = 'wooden_pickaxe',
    STONE_PICKAXE = 'stone_pickaxe',
    IRON_PICKAXE = 'iron_pickaxe',
    DIAMOND_PICKAXE = 'diamond_pickaxe',
    WOODEN_AXE = 'wooden_axe',
    STONE_AXE = 'stone_axe',
    IRON_AXE = 'iron_axe',
    DIAMOND_AXE = 'diamond_axe',
    WOODEN_SHOVEL = 'wooden_shovel',
    STONE_SHOVEL = 'stone_shovel',
    IRON_SHOVEL = 'iron_shovel',
    DIAMOND_SHOVEL = 'diamond_shovel',
    WOODEN_SWORD = 'wooden_sword',
    STONE_SWORD = 'stone_sword',
    IRON_SWORD = 'iron_sword',
    DIAMOND_SWORD = 'diamond_sword',
}

// Interface for inventory items
export interface InventoryItem {
    type: ItemType;
    count: number;
    data: BlockType | ToolType;
    durability?: number;
    maxDurability?: number;
}

// Mining speeds based on tool type and block material
export const MINING_SPEED_MULTIPLIERS: Record<ToolType, Record<string, number>> = {
    [ToolType.NONE]: { 'all': 1.0 },
    [ToolType.WOODEN_PICKAXE]: { 'stone': 2.0, 'ore': 2.0, 'default': 1.0 },
    [ToolType.STONE_PICKAXE]: { 'stone': 4.0, 'ore': 4.0, 'default': 1.0 },
    [ToolType.IRON_PICKAXE]: { 'stone': 6.0, 'ore': 6.0, 'default': 1.0 },
    [ToolType.DIAMOND_PICKAXE]: { 'stone': 8.0, 'ore': 8.0, 'default': 1.5 },
    [ToolType.WOODEN_AXE]: { 'wood': 2.0, 'default': 1.0 },
    [ToolType.STONE_AXE]: { 'wood': 4.0, 'default': 1.0 },
    [ToolType.IRON_AXE]: { 'wood': 6.0, 'default': 1.0 },
    [ToolType.DIAMOND_AXE]: { 'wood': 8.0, 'default': 1.5 },
    [ToolType.WOODEN_SHOVEL]: { 'dirt': 2.0, 'gravel': 2.0, 'sand': 2.0, 'default': 1.0 },
    [ToolType.STONE_SHOVEL]: { 'dirt': 4.0, 'gravel': 4.0, 'sand': 4.0, 'default': 1.0 },
    [ToolType.IRON_SHOVEL]: { 'dirt': 6.0, 'gravel': 6.0, 'sand': 6.0, 'default': 1.0 },
    [ToolType.DIAMOND_SHOVEL]: { 'dirt': 8.0, 'gravel': 8.0, 'sand': 8.0, 'default': 1.5 },
    [ToolType.WOODEN_SWORD]: { 'all': 1.0 },
    [ToolType.STONE_SWORD]: { 'all': 1.0 },
    [ToolType.IRON_SWORD]: { 'all': 1.0 },
    [ToolType.DIAMOND_SWORD]: { 'all': 1.0 },
};

// Block material types for mining speed calculations
export const BLOCK_MATERIALS: Record<BlockType, string> = {
    [BlockType.AIR]: 'air',
    [BlockType.GRASS]: 'dirt',
    [BlockType.DIRT]: 'dirt',
    [BlockType.STONE]: 'stone',
    [BlockType.WOOD]: 'wood',
    [BlockType.LEAVES]: 'leaves',
    [BlockType.WATER]: 'water',
    [BlockType.SAND]: 'sand',
    [BlockType.BEDROCK]: 'bedrock',
    [BlockType.GRAVEL]: 'gravel',
    [BlockType.SNOW]: 'snow',
    [BlockType.CLAY]: 'dirt',
    [BlockType.COAL_ORE]: 'ore',
    [BlockType.IRON_ORE]: 'ore',
    [BlockType.GOLD_ORE]: 'ore',
    [BlockType.SANDSTONE]: 'stone',
};

// Tool durability values
export const TOOL_DURABILITY: Record<ToolType, number> = {
    [ToolType.NONE]: Infinity,
    [ToolType.WOODEN_PICKAXE]: 60,
    [ToolType.STONE_PICKAXE]: 132,
    [ToolType.IRON_PICKAXE]: 251,
    [ToolType.DIAMOND_PICKAXE]: 1562,
    [ToolType.WOODEN_AXE]: 60,
    [ToolType.STONE_AXE]: 132,
    [ToolType.IRON_AXE]: 251,
    [ToolType.DIAMOND_AXE]: 1562,
    [ToolType.WOODEN_SHOVEL]: 60,
    [ToolType.STONE_SHOVEL]: 132,
    [ToolType.IRON_SHOVEL]: 251,
    [ToolType.DIAMOND_SHOVEL]: 1562,
    [ToolType.WOODEN_SWORD]: 60,
    [ToolType.STONE_SWORD]: 132,
    [ToolType.IRON_SWORD]: 251,
    [ToolType.DIAMOND_SWORD]: 1562,
};

export class Inventory {
    // The main inventory slots (36 slots like in Minecraft)
    private slots: (InventoryItem | null)[] = Array(36).fill(null);
    
    // The hotbar is the first 9 slots of the inventory
    private hotbarSize: number = 9;
    
    // Currently selected hotbar slot index
    private selectedSlot: number = 0;
    
    // Main inventory UI element
    private inventoryUI: HTMLElement | null = null;
    
    // Hotbar UI element
    private hotbarUI: HTMLElement | null = null;
    
    // Is inventory open
    private isInventoryOpen: boolean = false;
    
    constructor() {
        // Default starting inventory
        this.addItemToInventory({
            type: ItemType.TOOL,
            count: 1,
            data: ToolType.WOODEN_PICKAXE,
            durability: TOOL_DURABILITY[ToolType.WOODEN_PICKAXE],
            maxDurability: TOOL_DURABILITY[ToolType.WOODEN_PICKAXE]
        });
        
        this.addItemToInventory({
            type: ItemType.TOOL,
            count: 1,
            data: ToolType.WOODEN_AXE,
            durability: TOOL_DURABILITY[ToolType.WOODEN_AXE],
            maxDurability: TOOL_DURABILITY[ToolType.WOODEN_AXE]
        });
        
        this.addItemToInventory({
            type: ItemType.TOOL,
            count: 1,
            data: ToolType.WOODEN_SHOVEL,
            durability: TOOL_DURABILITY[ToolType.WOODEN_SHOVEL],
            maxDurability: TOOL_DURABILITY[ToolType.WOODEN_SHOVEL]
        });
        
        this.addItemToInventory({
            type: ItemType.TOOL,
            count: 1,
            data: ToolType.WOODEN_SWORD,
            durability: TOOL_DURABILITY[ToolType.WOODEN_SWORD],
            maxDurability: TOOL_DURABILITY[ToolType.WOODEN_SWORD]
        });
        
        // Add some initial blocks
        this.addItemToInventory({
            type: ItemType.BLOCK,
            count: 64,
            data: BlockType.DIRT
        });
        
        this.addItemToInventory({
            type: ItemType.BLOCK,
            count: 64,
            data: BlockType.STONE
        });
    }
    
    // Initialize the inventory UI
    public init(): void {
        this.createInventoryUI();
        this.createHotbarUI();
        this.updateHotbarUI();
        this.setupEventListeners();
    }
    
    // Create the main inventory UI
    private createInventoryUI(): void {
        // Create inventory container
        this.inventoryUI = document.createElement('div');
        this.inventoryUI.id = 'inventory';
        this.inventoryUI.style.display = 'none';
        
        // Create crafting area
        const craftingArea = document.createElement('div');
        craftingArea.className = 'crafting-area';
        this.inventoryUI.appendChild(craftingArea);
        
        // Create crafting grid (2x2)
        const craftingGrid = document.createElement('div');
        craftingGrid.className = 'crafting-grid';
        for (let i = 0; i < 4; i++) {
            const slot = document.createElement('div');
            slot.className = 'crafting-slot';
            craftingGrid.appendChild(slot);
        }
        craftingArea.appendChild(craftingGrid);
        
        // Create arrow
        const craftingArrow = document.createElement('div');
        craftingArrow.className = 'crafting-arrow';
        craftingArea.appendChild(craftingArrow);
        
        // Create result slot
        const resultSlot = document.createElement('div');
        resultSlot.className = 'result-slot';
        craftingArea.appendChild(resultSlot);
        
        // Create inventory slots
        const inventorySlots = document.createElement('div');
        inventorySlots.className = 'inventory-slots';
        
        // Create 3 rows of 9 slots (excluding hotbar)
        for (let i = this.hotbarSize; i < 36; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotIndex = i.toString();
            inventorySlots.appendChild(slot);
        }
        
        this.inventoryUI.appendChild(inventorySlots);
        
        // Create hotbar (shown in inventory)
        const hotbarInInventory = document.createElement('div');
        hotbarInInventory.className = 'hotbar-in-inventory';
        
        // Create 9 slots for hotbar
        for (let i = 0; i < this.hotbarSize; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotIndex = i.toString();
            hotbarInInventory.appendChild(slot);
        }
        
        this.inventoryUI.appendChild(hotbarInInventory);
        
        // Check if UI container exists
        const uiContainer = document.getElementById('ui');
        console.log('UI container exists:', !!uiContainer);
        
        // Add to UI
        if (uiContainer) {
            uiContainer.appendChild(this.inventoryUI);
            console.log('Added inventory UI to the UI container');
        } else {
            console.error('UI container not found, creating one');
            const newUiContainer = document.createElement('div');
            newUiContainer.id = 'ui';
            document.body.appendChild(newUiContainer);
            newUiContainer.appendChild(this.inventoryUI);
        }
    }
    
    // Create the hotbar UI
    private createHotbarUI(): void {
        // Look for existing hotbar
        this.hotbarUI = document.getElementById('hotbar');
        
        // Clear existing hotbar if it exists
        if (this.hotbarUI) {
            this.hotbarUI.innerHTML = '';
        } else {
            // Create new hotbar if it doesn't exist
            this.hotbarUI = document.createElement('div');
            this.hotbarUI.id = 'hotbar';
            
            // Check if UI container exists
            const uiContainer = document.getElementById('ui');
            console.log('UI container exists for hotbar:', !!uiContainer);
            
            if (uiContainer) {
                uiContainer.appendChild(this.hotbarUI);
                console.log('Added hotbar UI to the UI container');
            } else {
                console.error('UI container not found for hotbar, creating one');
                const newUiContainer = document.createElement('div');
                newUiContainer.id = 'ui';
                document.body.appendChild(newUiContainer);
                newUiContainer.appendChild(this.hotbarUI);
            }
        }
        
        // Create hotbar slots
        for (let i = 0; i < this.hotbarSize; i++) {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot';
            slot.dataset.slotIndex = i.toString();
            if (i === this.selectedSlot) {
                slot.classList.add('selected');
            }
            this.hotbarUI.appendChild(slot);
        }
    }
    
    // Update the hotbar UI to reflect current inventory
    public updateHotbarUI(): void {
        if (!this.hotbarUI) return;
        
        // Update each hotbar slot
        for (let i = 0; i < this.hotbarSize; i++) {
            const slot = this.hotbarUI.children[i] as HTMLElement;
            const item = this.slots[i];
            
            // Clear slot
            slot.innerHTML = '';
            
            // Add item to slot if it exists
            if (item) {
                const itemElement = document.createElement('div');
                itemElement.className = 'item';
                
                // Set background image based on item type and data
                if (item.type === ItemType.BLOCK) {
                    itemElement.className += ` block-${BlockType[item.data as BlockType].toLowerCase()}`;
                } else if (item.type === ItemType.TOOL) {
                    itemElement.className += ` tool-${item.data}`;
                }
                
                // Add count if more than 1
                if (item.count > 1) {
                    const countElement = document.createElement('div');
                    countElement.className = 'item-count';
                    countElement.textContent = item.count.toString();
                    itemElement.appendChild(countElement);
                }
                
                // Add durability bar for tools
                if (item.type === ItemType.TOOL && item.durability !== undefined && item.maxDurability !== undefined) {
                    const durabilityPercent = (item.durability / item.maxDurability) * 100;
                    const durabilityBar = document.createElement('div');
                    durabilityBar.className = 'durability-bar';
                    
                    const durabilityFill = document.createElement('div');
                    durabilityFill.className = 'durability-fill';
                    durabilityFill.style.width = `${durabilityPercent}%`;
                    
                    // Color based on durability percentage
                    if (durabilityPercent > 75) {
                        durabilityFill.style.backgroundColor = '#00c853';
                    } else if (durabilityPercent > 50) {
                        durabilityFill.style.backgroundColor = '#ffd600';
                    } else if (durabilityPercent > 25) {
                        durabilityFill.style.backgroundColor = '#ff9100';
                    } else {
                        durabilityFill.style.backgroundColor = '#ff3d00';
                    }
                    
                    durabilityBar.appendChild(durabilityFill);
                    itemElement.appendChild(durabilityBar);
                }
                
                slot.appendChild(itemElement);
            }
        }
        
        // Update selection
        Array.from(this.hotbarUI.children).forEach((slot, index) => {
            if (index === this.selectedSlot) {
                slot.classList.add('selected');
            } else {
                slot.classList.remove('selected');
            }
        });
    }
    
    // Update the full inventory UI
    private updateInventoryUI(): void {
        if (!this.inventoryUI || !this.isInventoryOpen) return;
        
        // Update each inventory slot
        const inventorySlots = this.inventoryUI.querySelectorAll('.inventory-slot');
        inventorySlots.forEach((slotElement) => {
            const slot = slotElement as HTMLElement;
            const slotIndex = parseInt(slot.dataset.slotIndex || '0');
            const item = this.slots[slotIndex];
            
            // Clear slot
            slot.innerHTML = '';
            
            // Add item to slot if it exists
            if (item) {
                const itemElement = document.createElement('div');
                itemElement.className = 'item';
                
                // Set background image based on item type and data
                if (item.type === ItemType.BLOCK) {
                    itemElement.className += ` block-${BlockType[item.data as BlockType].toLowerCase()}`;
                } else if (item.type === ItemType.TOOL) {
                    itemElement.className += ` tool-${item.data}`;
                }
                
                // Add count if more than 1
                if (item.count > 1) {
                    const countElement = document.createElement('div');
                    countElement.className = 'item-count';
                    countElement.textContent = item.count.toString();
                    itemElement.appendChild(countElement);
                }
                
                // Add durability bar for tools
                if (item.type === ItemType.TOOL && item.durability !== undefined && item.maxDurability !== undefined) {
                    const durabilityPercent = (item.durability / item.maxDurability) * 100;
                    const durabilityBar = document.createElement('div');
                    durabilityBar.className = 'durability-bar';
                    
                    const durabilityFill = document.createElement('div');
                    durabilityFill.className = 'durability-fill';
                    durabilityFill.style.width = `${durabilityPercent}%`;
                    
                    // Color based on durability percentage
                    if (durabilityPercent > 75) {
                        durabilityFill.style.backgroundColor = '#00c853';
                    } else if (durabilityPercent > 50) {
                        durabilityFill.style.backgroundColor = '#ffd600';
                    } else if (durabilityPercent > 25) {
                        durabilityFill.style.backgroundColor = '#ff9100';
                    } else {
                        durabilityFill.style.backgroundColor = '#ff3d00';
                    }
                    
                    durabilityBar.appendChild(durabilityFill);
                    itemElement.appendChild(durabilityBar);
                }
                
                slot.appendChild(itemElement);
            }
        });
    }
    
    // Toggle the inventory UI
    public toggleInventory(): void {
        console.log('toggleInventory called, UI element exists:', !!this.inventoryUI);
        
        if (!this.inventoryUI) {
            console.error('Inventory UI element not found!');
            return;
        }
        
        this.isInventoryOpen = !this.isInventoryOpen;
        console.log('Toggling inventory, new state:', this.isInventoryOpen);
        
        this.inventoryUI.style.display = this.isInventoryOpen ? 'flex' : 'none';
        
        if (this.isInventoryOpen) {
            this.updateInventoryUI();
        }
    }
    
    // Get the currently selected item
    public getSelectedItem(): InventoryItem | null {
        return this.slots[this.selectedSlot];
    }
    
    // Set the selected hotbar slot
    public setSelectedSlot(slot: number): void {
        if (slot >= 0 && slot < this.hotbarSize) {
            this.selectedSlot = slot;
            this.updateHotbarUI();
        }
    }
    
    // Get the selected hotbar slot
    public getSelectedSlot(): number {
        return this.selectedSlot;
    }
    
    // Add an item to the inventory
    public addItemToInventory(item: InventoryItem): boolean {
        // First try to stack with existing items of same type
        if (item.type === ItemType.BLOCK) {
            // Find existing stack of same block type
            for (let i = 0; i < this.slots.length; i++) {
                const slot = this.slots[i];
                if (slot && 
                    slot.type === ItemType.BLOCK && 
                    slot.data === item.data && 
                    slot.count < 64) {
                    
                    // Calculate how many can be added to this stack
                    const canAdd = Math.min(64 - slot.count, item.count);
                    slot.count += canAdd;
                    item.count -= canAdd;
                    
                    // If all items were added, return true
                    if (item.count === 0) {
                        this.updateHotbarUI();
                        if (this.isInventoryOpen) this.updateInventoryUI();
                        return true;
                    }
                }
            }
        }
        
        // If we still have items to add, find an empty slot
        if (item.count > 0) {
            for (let i = 0; i < this.slots.length; i++) {
                if (this.slots[i] === null) {
                    this.slots[i] = { ...item };
                    this.updateHotbarUI();
                    if (this.isInventoryOpen) this.updateInventoryUI();
                    return true;
                }
            }
        }
        
        // Inventory is full
        return false;
    }
    
    // Remove an item from the inventory
    public removeItemFromSlot(slotIndex: number, count: number = 1): InventoryItem | null {
        if (slotIndex < 0 || slotIndex >= this.slots.length) return null;
        
        const item = this.slots[slotIndex];
        if (!item) return null;
        
        // If we're removing all or more than what's in the slot
        if (count >= item.count) {
            const removedItem = { ...item };
            this.slots[slotIndex] = null;
            this.updateHotbarUI();
            if (this.isInventoryOpen) this.updateInventoryUI();
            return removedItem;
        } else {
            // Just remove some of the items
            item.count -= count;
            this.updateHotbarUI();
            if (this.isInventoryOpen) this.updateInventoryUI();
            return {
                ...item,
                count: count
            };
        }
    }
    
    // Reduce tool durability when used
    public reduceDurability(amount: number = 1): void {
        const item = this.getSelectedItem();
        if (item && item.type === ItemType.TOOL && item.durability !== undefined) {
            item.durability -= amount;
            
            // Break the tool if durability reaches 0
            if (item.durability <= 0) {
                this.slots[this.selectedSlot] = null;
            }
            
            this.updateHotbarUI();
            if (this.isInventoryOpen) this.updateInventoryUI();
        }
    }
    
    // Get mining speed multiplier for current tool against a block type
    public getMiningSpeedMultiplier(blockType: BlockType): number {
        const item = this.getSelectedItem();
        if (!item || item.type !== ItemType.TOOL) {
            return 1.0; // No tool, base speed
        }
        
        const toolType = item.data as ToolType;
        const blockMaterial = BLOCK_MATERIALS[blockType];
        const toolMultipliers = MINING_SPEED_MULTIPLIERS[toolType];
        
        // Return the specific multiplier for this material if it exists
        if (toolMultipliers[blockMaterial]) {
            return toolMultipliers[blockMaterial];
        }
        
        // Otherwise return the default multiplier for this tool
        return toolMultipliers['default'] || 1.0;
    }
    
    // Setup event listeners for inventory interaction
    private setupEventListeners(): void {
        // Toggle inventory on 'E' keypress
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyE') {
                console.log('E key detected in Inventory event listener');
                event.preventDefault(); // Prevent the event from being handled again
                this.toggleInventory();
            }
        });
        
        // Handle hotbar selection with number keys
        document.addEventListener('keydown', (event) => {
            // Number keys 1-9
            if (event.code.startsWith('Digit') && !isNaN(parseInt(event.code.charAt(5)))) {
                const digit = parseInt(event.code.charAt(5));
                if (digit >= 1 && digit <= this.hotbarSize) {
                    this.setSelectedSlot(digit - 1);
                }
            }
        });
        
        // Handle mouse wheel for hotbar selection
        document.addEventListener('wheel', (event) => {
            if (event.deltaY > 0) {
                // Scroll down, move right in hotbar
                this.setSelectedSlot((this.selectedSlot + 1) % this.hotbarSize);
            } else if (event.deltaY < 0) {
                // Scroll up, move left in hotbar
                this.setSelectedSlot((this.selectedSlot - 1 + this.hotbarSize) % this.hotbarSize);
            }
        });
    }
    
    // Check if inventory is open
    public isOpen(): boolean {
        return this.isInventoryOpen;
    }
} 