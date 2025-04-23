import * as THREE from 'three';

export class PositionComponent {
    constructor(public x: number = 0, public y: number = 1.6, public z: number = 0) {}
    toString(): string {
        return `pos(${this.x}, ${this.y}, ${this.z})`;
    }
}

export class WASDComponent {
    constructor(public forward = false, public backward = false, public left = false, public right = false) {}
    toString(): string {
        return `wasd(f:${+this.forward}, b:${+this.backward}, l:${+this.left}, r:${+this.right})`;
    }
}

export class JumpComponent {
    constructor(public jump = false) {}
    toString(): string {
        return `jump(${+this.jump})`;
    }
}

export class FiringComponent {
    constructor(public firing = false) {}
    toString(): string {
        return `fire(${+this.firing})`;
    }
}

export class AngleComponent {
    constructor(public pitch = 0, public yaw = 0) {}
    toString(): string {
        return `angle(${this.pitch}, ${this.yaw})`;
    }
}

export class QuantizedAngleComponent {
    constructor(public qpitch = 127, public qyaw = 0) {}
    toString(): string {
        return `qangle(${this.qpitch}, ${this.qyaw})`;
    }
}

export class DeltaTimeComponent {
    constructor(public deltaTime = 0) {}
    toString(): string {
        return `dt(${this.deltaTime.toFixed(3)})`;
    }
}

export class MeshComponent {
    constructor(public mesh: THREE.Mesh) {}
    toString(): string {
        const [x, y, z] = this.mesh.position.toArray().map(n => n.toFixed(1));
        return `mesh(${x}, ${y}, ${z})`;
    }
}

export class AliveComponent {
    constructor(public alive = true) {}
    toString(): string {
        return `alive(${+this.alive})`;
    }
}

export class HitDetectionComponent {
    constructor(public hitDetection = false) {}
    toString(): string {
        return `hit(${+this.hitDetection})`;
    }
}

export class HealthComponent {
    constructor(public health = 100) {}
    toString(): string {
        return `hp(${this.health})`;
    }
}

export class KillsComponent {
    constructor(public kills = 0) {}
    toString(): string {
        return `kills(${this.kills})`;
    }
}

export class AngleChangedComponent {
    constructor(public angleChanged: boolean = false) {}

    toString(): string {
        return `AngleChangedComponent(angleChanged: ${this.angleChanged})`;
    }
}

export class HealthChangedComponent {
    constructor(public healthChanged: boolean = false) {}

    toString(): string {
        return `HealthChangedComponent(healthChanged: ${this.healthChanged})`;
    }
}

export class KillsChangedComponent {
    constructor(public killsChanged: boolean = false) {}

    toString(): string {
        return `KillsChangedComponent(killsChanged: ${this.killsChanged})`;
    }
}

export class WebSocketComponent {
    constructor(public socket: any) {}
  
    toString(): string {
      return `WebSocketComponent(protocol: ${this.socket.protocol}, readyState: ${this.socket.readyState})`;
    }
  }

  export class PositionChangedComponent {
    constructor(public positionChanged: boolean = false) {}

    toString(): string {
        return `PositionChangedComponent(positionChanged: ${this.positionChanged})`;
    }
}

