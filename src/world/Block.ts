export enum BlockType {
    AIR = 0,
    GRASS = 1,
    DIRT = 2,
    STONE = 3,
    WOOD = 4,
    LEAVES = 5,
    WATER = 6,
    SAND = 7,
    BEDROCK = 8,
    GRAVEL = 9,
    SNOW = 10,
    CLAY = 11,
    COAL_ORE = 12,
    IRON_ORE = 13,
    GOLD_ORE = 14,
    SANDSTONE = 15
}

export interface BlockData {
    type: BlockType;
    transparent: boolean;
    solid: boolean;
    liquid: boolean;
    texture: {
        top: number;
        bottom: number;
        left: number;
        right: number;
        front: number;
        back: number;
    };
}

export class Block {
    private static readonly BLOCKS: Record<BlockType, BlockData> = {
        [BlockType.AIR]: {
            type: BlockType.AIR,
            transparent: true,
            solid: false,
            liquid: false,
            texture: {
                top: -1,
                bottom: -1,
                left: -1,
                right: -1,
                front: -1,
                back: -1
            }
        },
        [BlockType.GRASS]: {
            type: BlockType.GRASS,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 0, // Grass top
                bottom: 2, // Dirt
                left: 3, // Grass side
                right: 3, // Grass side
                front: 3, // Grass side
                back: 3 // Grass side
            }
        },
        [BlockType.DIRT]: {
            type: BlockType.DIRT,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 2,
                bottom: 2,
                left: 2,
                right: 2,
                front: 2,
                back: 2
            }
        },
        [BlockType.STONE]: {
            type: BlockType.STONE,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 1,
                bottom: 1,
                left: 1,
                right: 1,
                front: 1,
                back: 1
            }
        },
        [BlockType.WOOD]: {
            type: BlockType.WOOD,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 5, // Wood top
                bottom: 5, // Wood top
                left: 4, // Wood side
                right: 4, // Wood side
                front: 4, // Wood side
                back: 4 // Wood side
            }
        },
        [BlockType.LEAVES]: {
            type: BlockType.LEAVES,
            transparent: true,
            solid: true,
            liquid: false,
            texture: {
                top: 6,
                bottom: 6,
                left: 6,
                right: 6,
                front: 6,
                back: 6
            }
        },
        [BlockType.WATER]: {
            type: BlockType.WATER,
            transparent: true,
            solid: false,
            liquid: true,
            texture: {
                top: 7,
                bottom: 7,
                left: 7,
                right: 7,
                front: 7,
                back: 7
            }
        },
        [BlockType.SAND]: {
            type: BlockType.SAND,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 8,
                bottom: 8,
                left: 8,
                right: 8,
                front: 8,
                back: 8
            }
        },
        [BlockType.BEDROCK]: {
            type: BlockType.BEDROCK,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 9,
                bottom: 9,
                left: 9,
                right: 9,
                front: 9,
                back: 9
            }
        },
        [BlockType.GRAVEL]: {
            type: BlockType.GRAVEL,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
                front: 10,
                back: 10
            }
        },
        [BlockType.SNOW]: {
            type: BlockType.SNOW,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 11,
                bottom: 11,
                left: 11,
                right: 11,
                front: 11,
                back: 11
            }
        },
        [BlockType.CLAY]: {
            type: BlockType.CLAY,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 12,
                bottom: 12,
                left: 12,
                right: 12,
                front: 12,
                back: 12
            }
        },
        [BlockType.COAL_ORE]: {
            type: BlockType.COAL_ORE,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 13,
                bottom: 13,
                left: 13,
                right: 13,
                front: 13,
                back: 13
            }
        },
        [BlockType.IRON_ORE]: {
            type: BlockType.IRON_ORE,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 14,
                bottom: 14,
                left: 14,
                right: 14,
                front: 14,
                back: 14
            }
        },
        [BlockType.GOLD_ORE]: {
            type: BlockType.GOLD_ORE,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 15,
                bottom: 15,
                left: 15,
                right: 15,
                front: 15,
                back: 15
            }
        },
        [BlockType.SANDSTONE]: {
            type: BlockType.SANDSTONE,
            transparent: false,
            solid: true,
            liquid: false,
            texture: {
                top: 16,
                bottom: 16,
                left: 16,
                right: 16,
                front: 16,
                back: 16
            }
        }
    };

    public static getBlockData(type: BlockType): BlockData {
        return Block.BLOCKS[type];
    }

    public static isTransparent(type: BlockType): boolean {
        if (type === BlockType.AIR) {
            return true;
        }
        return Block.BLOCKS[type].transparent;
    }

    public static isSolid(type: BlockType): boolean {
        return Block.BLOCKS[type].solid;
    }

    public static isLiquid(type: BlockType): boolean {
        return Block.BLOCKS[type].liquid;
    }

    public static isAir(type: BlockType): boolean {
        return type === BlockType.AIR;
    }
} 