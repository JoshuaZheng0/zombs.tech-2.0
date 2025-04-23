export class Entity {
  id: number;
  components: Map<any, any> = new Map(); // Store components by their class constructor
  
  constructor(id: number) {
    this.id = id;
  }
  
  // Add a component to the entity
  addComponent<T>(component: T): void {
    const componentClass = (component as any).constructor; // Get the constructor of the component
    this.components.set(componentClass, component);
  }
  
  // Get a component from the entity
  getComponent<T>(componentClass: { new (...args: any[]): T }): T | undefined {
    return this.components.get(componentClass); // Retrieve component by its constructor
  }
  
  // Check if a component exists on the entity
  hasComponent<T>(componentClass: { new (): T }): boolean {
    return this.components.has(componentClass); // Check if the component class exists
  }
  
  // Remove a component from the entity
  removeComponent<T>(componentClass: { new (): T }): void {
    if (this.components.has(componentClass)) {
      this.components.delete(componentClass); // Delete by constructor
    } else {
      console.warn(`Component ${componentClass.name} not found on entity ${this.id}`);
    }
  }
  
  // Get all components of the entity
  getAllComponents(): Map<any, any> {
    return this.components;
  }
  
  // Check if the entity has any components
  hasAnyComponents(): boolean {
    return this.components.size > 0;
  }
  
  // Check if the entity has all specified components
  hasAllComponents(...componentClasses: { new (...args: any[]): any }[]): boolean {
    return componentClasses.every(componentClass => this.hasComponent(componentClass));
  }
}
