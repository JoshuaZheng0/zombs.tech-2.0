import { Entity } from './entity';  // Import the Entity class

export class World {
    private entities: Map<number, Entity> = new Map(); // Stores all entities by their ID
// Game state
    gameState = {
  health: 100,
  score: 0,
  wave: 1,
  zombiesKilled: 0,
  zombiesInWave: 5, // Initial zombies in wave 1
  gameOver: false,
  lastShot: 0,
  shootCooldown: 130,
  moveSpeed: 0.2,
  jumpForce: 0.25,
  gravity: 0.02,
  verticalVelocity: 0,
  // Ability cooldowns and states
  abilities: {
    dash: {
      cooldown: 6000,
      lastUsed: 0,
      distance: 10,
      duration: 200
    },
    updraft: {
      cooldown: 8000,
      lastUsed: 0,
      force: 0.35
    }
  }
};

    // Add an entity to the world
    addEntity(entity: Entity): void {
        this.entities.set(entity.id, entity); // Store the entity by its ID
    }

    // Remove an entity from the world
    removeEntity(entity: Entity): void {
        this.entities.delete(entity.id); // Delete entity by its ID
    }

    // Get an entity by its ID
    getEntityById(id: number): Entity | undefined {
        return this.entities.get(id); // Retrieve the entity by its ID
    }

    // Get all entities with a specific component
    getEntitiesWithComponent<T>(componentClass: { new(...args: any[]): T }): Entity[] {
        const result: Entity[] = [];
        for (let entity of this.entities.values()) {
            if (entity.hasComponent(componentClass)) {
                result.push(entity); // Add entity if it has the specified component
            }
        }
        return result;
    }

    // Get all entities that have any of the specified components
    getEntitiesWithAnyComponent<T>(...componentClasses: { new(...args: any[]): T }[]): Entity[] {
        const result: Entity[] = [];
        for (let entity of this.entities.values()) {
            if (componentClasses.some(componentClass => entity.hasComponent(componentClass))) {
                result.push(entity); // Add entity if it has any of the specified components
            }
        }
        return result;
    }

    // Get all entities that have all of the specified components
    getEntitiesWithAllComponents(...componentClasses: { new(...args: any[]): any }[]): Entity[] {
        const result: Entity[] = [];
        for (let entity of this.entities.values()) {
            if (entity.hasAllComponents(...componentClasses)) {
                result.push(entity); // Add entity if it has all of the specified components
            }
        }
        return result;
    }

    // Remove all entities with a specific component
    removeEntitiesWithComponent<T>(componentClass: { new(...args: any[]): T }): void {
        for (let entity of this.entities.values()) {
            if (entity.hasComponent(componentClass)) {
                this.removeEntity(entity); // Remove entities that have the specified component
            }
        }
    }


    // Find an available entity ID between 1 and 9
    getAvailableEntityId(): number | null {
        for (let id = 1; id <= 9; id++) {
            if (!this.entities.has(id)) {
                return id;
            }
        }
        return null; // All IDs between 1–9 are taken
    }

}
