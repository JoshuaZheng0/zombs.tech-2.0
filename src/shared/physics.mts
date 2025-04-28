import * as RAPIER from '@dimforge/rapier3d-compat';
import { Entity } from './entity.js';
import { PositionComponent, WASDComponent, JumpComponent, AngleComponent } from './interface.js';
import { World } from './world.js';
import { wallMap } from './wall_map.js';

export class PhysicsSystem {
  private world: RAPIER.World;
  private rigidBodies: Map<number, RAPIER.RigidBody> = new Map();
  private colliders: Map<number, RAPIER.Collider> = new Map();
  private playerBody: RAPIER.RigidBody | null = null;
  private playerCollider: RAPIER.Collider | null = null;
  private groundCollider: RAPIER.Collider | null = null;
  private gameWorld: World;
  private wallColliders: RAPIER.Collider[] = [];
  private borderColliders: RAPIER.Collider[] = [];
  private characterController: RAPIER.KinematicCharacterController | null = null;

  constructor(gameWorld: World) {
    this.gameWorld = gameWorld;
    // Initialize Rapier physics world with gravity
    this.world = new RAPIER.World({ x: 0.0, y: -80, z: 0.0 });
    // Create ground collider
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.1, 50.0);
    this.groundCollider = this.world.createCollider(groundColliderDesc);
    // Create walls and borders
    this.createWallColliders();
    this.createBorderColliders();
  }

  private createWallColliders(): void {
    const width = wallMap.length;
    const height = wallMap[0].length;

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < height; z++) {
        if (wallMap[x][z] === 1) {
          const worldX = x - 50;
          const worldZ = z - 50;
          const wallHeight = Math.random() * 1.5 + 4.5;

          const wallColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, wallHeight / 2, 0.5);
          wallColliderDesc.setTranslation(worldX, wallHeight / 2, worldZ);

          const wallCollider = this.world.createCollider(wallColliderDesc);
          this.wallColliders.push(wallCollider);
        }
      }
    }
  }

  private createBorderColliders(): void {
    const borderHeight = 10.0;
    const borderThickness = 1.0;
    const minX = -50;
    const maxX = 50;
    const minZ = -50;
    const maxZ = 50;

    const north = RAPIER.ColliderDesc.cuboid((maxX - minX) / 2, borderHeight / 2, borderThickness / 2);
    north.setTranslation(0, borderHeight / 2, maxZ + borderThickness / 2);
    this.borderColliders.push(this.world.createCollider(north));

    const south = RAPIER.ColliderDesc.cuboid((maxX - minX) / 2, borderHeight / 2, borderThickness / 2);
    south.setTranslation(0, borderHeight / 2, minZ - borderThickness / 2);
    this.borderColliders.push(this.world.createCollider(south));

    const east = RAPIER.ColliderDesc.cuboid(borderThickness / 2, borderHeight / 2, (maxZ - minZ) / 2);
    east.setTranslation(maxX + borderThickness / 2, borderHeight / 2, 0);
    this.borderColliders.push(this.world.createCollider(east));

    const west = RAPIER.ColliderDesc.cuboid(borderThickness / 2, borderHeight / 2, (maxZ - minZ) / 2);
    west.setTranslation(minX - borderThickness / 2, borderHeight / 2, 0);
    this.borderColliders.push(this.world.createCollider(west));
  }

  initPlayer(player: Entity): void {
    const position = player.getComponent(PositionComponent);
    if (!position) return;

    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .lockRotations();

    this.playerBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 1.0);
    this.playerCollider = this.world.createCollider(colliderDesc, this.playerBody);

    this.characterController = this.world.createCharacterController(0.01);

    this.rigidBodies.set(player.id, this.playerBody);
    this.colliders.set(player.id, this.playerCollider);
  }

  update(): void {
    this.world.step();

    if (this.playerBody) {
      const player = this.gameWorld.getEntityById(1);
      if (player) {
        const position = player.getComponent(PositionComponent);
        if (position) {
          const translation = this.playerBody.translation();
          position.x = translation.x;
          position.y = translation.y;
          position.z = translation.z;
        }
      }
    }

    for (let i = 2; i <= 10; i++) {
      const enemy = this.gameWorld.getEntityById(i);
      if (enemy) {
        const rigidBody = this.rigidBodies.get(i);
        if (rigidBody) {
          const position = enemy.getComponent(PositionComponent);
          if (position) {
            const translation = rigidBody.translation();
            position.x = translation.x;
            position.y = translation.y;
            position.z = translation.z;
          }
        }
      }
    }
  }

  applyPlayerMovement(player: Entity, _deltaTime: number): void {
    if (!this.playerBody || !this.playerCollider || !this.characterController) return;

    const wasd = player.getComponent(WASDComponent);
    const jump = player.getComponent(JumpComponent);
    const position = player.getComponent(PositionComponent);
    const angle = player.getComponent(AngleComponent);

    if (!wasd || !position || !angle) return;

    const moveSpeed = this.gameWorld.gameState.moveSpeed;
    let moveX = 0;
    let moveZ = 0;

    const forwardX = Math.sin(angle.yaw);
    const forwardZ = Math.cos(angle.yaw);
    const rightX = Math.sin(angle.yaw + Math.PI / 2);
    const rightZ = Math.cos(angle.yaw + Math.PI / 2);

    if (wasd.forward) {
      moveX -= forwardX * moveSpeed * _deltaTime;
      moveZ -= forwardZ * moveSpeed * _deltaTime;
    }
    if (wasd.backward) {
      moveX += forwardX * moveSpeed * _deltaTime;
      moveZ += forwardZ * moveSpeed * _deltaTime;
    }
    if (wasd.left) {
      moveX -= rightX * moveSpeed * _deltaTime;
      moveZ -= rightZ * moveSpeed * _deltaTime;
    }
    if (wasd.right) {
      moveX += rightX * moveSpeed * _deltaTime;
      moveZ += rightZ * moveSpeed * _deltaTime;
    }

    const isOnGround = this.playerBody.translation().y <= 1.61;

    if (jump && jump.jump && isOnGround) {
      const jumpForce = this.gameWorld.gameState.jumpForce * 2 * _deltaTime;
      this.playerBody.applyImpulse({ x: 0, y: jumpForce, z: 0 }, true);
      jump.jump = false;
    }

    const currentVelocity = this.playerBody.linvel();
    this.playerBody.setLinvel({
      x: moveX,
      y: currentVelocity.y,
      z: moveZ
    }, true);

    this.characterController.computeColliderMovement(
      this.playerCollider,
      { x: 0, y: 0, z: 0 }
    );
  }

  cleanup(): void {
    for (const [_id, rigidBody] of this.rigidBodies) {
      this.world.removeRigidBody(rigidBody);
    }

    for (const [_id, collider] of this.colliders) {
      this.world.removeCollider(collider, true);
    }

    for (const collider of this.wallColliders) {
      this.world.removeCollider(collider, true);
    }

    for (const collider of this.borderColliders) {
      this.world.removeCollider(collider, true);
    }

    if (this.groundCollider) {
      this.world.removeCollider(this.groundCollider, true);
    }

    if (this.characterController) {
      this.world.removeCharacterController(this.characterController);
    }
  }
}
