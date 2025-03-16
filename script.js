// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 20;

// Materials for friction
const groundMaterial = new CANNON.Material('ground');
const vehicleMaterial = new CANNON.Material('vehicle');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, vehicleMaterial, {
    friction: 1.0, // Increased friction
    restitution: 0.05
});
world.addContactMaterial(contactMaterial);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

// Loaders
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new THREE.GLTFLoader();

// Base terrain (flat with dirt texture)
const terrainSize = 1000;
const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize);
const dirtTexture = textureLoader.load(
    'textures/dirt.jpg',
    (texture) => console.log('Texture loaded successfully:', texture),
    undefined,
    (error) => console.error('Texture loading failed:', error)
);
dirtTexture.wrapS = dirtTexture.wrapT = THREE.RepeatWrapping;
dirtTexture.repeat.set(5, 5);
const terrainMaterial = new THREE.MeshPhongMaterial({ map: dirtTexture });
const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrainMesh.rotation.x = -Math.PI / 2;
scene.add(terrainMesh);

// Physics terrain (flat plane)
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
groundBody.position.set(0, 0, 0);
world.addBody(groundBody);

// Hill (simple cone mesh)
const hillRadius = 50;
const hillHeight = 10;
const hillGeometry = new THREE.ConeGeometry(hillRadius, hillHeight, 32);
const hillMesh = new THREE.Mesh(hillGeometry, terrainMaterial.clone());
hillMesh.position.set(0, hillHeight / 2, 50);
console.log('Hill mesh position:', hillMesh.position);
scene.add(hillMesh);

// Physics hill (adjusted trapezoid ramp facing -z)
const hillVertices = [
    new CANNON.Vec3(-hillRadius, 0, -hillRadius), // 0: Bottom near left
    new CANNON.Vec3(hillRadius, 0, -hillRadius),  // 1: Bottom near right
    new CANNON.Vec3(hillRadius, 0, hillRadius),   // 2: Bottom far right
    new CANNON.Vec3(-hillRadius, 0, hillRadius),  // 3: Bottom far left
    new CANNON.Vec3(-10, hillHeight, -10),        // 4: Top near left (narrower)
    new CANNON.Vec3(10, hillHeight, -10),         // 5: Top near right
    new CANNON.Vec3(10, hillHeight, hillRadius / 2), // 6: Top far right (shorter)
    new CANNON.Vec3(-10, hillHeight, hillRadius / 2) // 7: Top far left
];
const hillFaces = [
    [0, 4, 5, 1], // Near slope (CCW)
    [1, 5, 6, 2], // Right face (CCW)
    [2, 6, 7, 3], // Far face (CCW)
    [3, 7, 4, 0], // Left face (CCW)
    [0, 1, 2, 3], // Bottom (CCW)
    [7, 6, 5, 4]  // Top (CCW)
];
const hillShape = new CANNON.ConvexPolyhedron(hillVertices, hillFaces);
const hillBody = new CANNON.Body({ mass: 0, material: groundMaterial });
hillBody.addShape(hillShape);
hillBody.position.set(0, 0, 50);
world.addBody(hillBody);

// ATV physics (chassis and wheels)
const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 1));
const chassisBody = new CANNON.Body({ mass: 50, material: vehicleMaterial });
chassisBody.addShape(chassisShape);
world.addBody(chassisBody);
chassisBody.position.set(0, 5, -20);
chassisBody.velocity.set(0, 0, 0);
chassisBody.angularVelocity.set(0, 0, 0);
chassisBody.quaternion.set(0, 0, 0, 1);
chassisBody.linearDamping = 0.9; // High initially
chassisBody.angularDamping = 0.9;

// Wheels (wider base)
const wheelShape = new CANNON.Sphere(0.5);
const wheelBodies = [];
const wheelConstraints = [];
const wheelPositions = [
    new CANNON.Vec3(-1.5, -0.5, -1), // Wider x
    new CANNON.Vec3(1.5, -0.5, -1),
    new CANNON.Vec3(-1.5, -0.5, 1),
    new CANNON.Vec3(1.5, -0.5, 1)
];

wheelPositions.forEach((pos, index) => {
    const wheelBody = new CANNON.Body({ mass: 2, material: vehicleMaterial });
    wheelBody.addShape(wheelShape);
    wheelBody.position.copy(chassisBody.position).vadd(pos);
    wheelBody.velocity.set(0, 0, 0);
    wheelBody.angularVelocity.set(0, 0, 0);
    world.addBody(wheelBody);
    wheelBodies.push(wheelBody);

    const constraint = new CANNON.HingeConstraint(chassisBody, wheelBody, {
        pivotA: pos,
        pivotB: new CANNON.Vec3(0, 0, 0),
        axisA: new CANNON.Vec3(1, 0, 0),
        axisB: new CANNON.Vec3(1, 0, 0),
        maxForce: 1e6
    });
    world.addConstraint(constraint);
    wheelConstraints.push(constraint);
});

// Load ATV model
let atvMesh;
gltfLoader.load(
    'models/atv/scene.gltf',
    (gltf) => {
        atvMesh = gltf.scene;
        atvMesh.scale.set(0.1, 0.1, 0.1);
        scene.add(atvMesh);
        atvMesh.position.copy(chassisBody.position);
        atvMesh.position.y += 1.7;
        atvMesh.quaternion.set(0, 0, 0, 1);
        chassisBody.quaternion.copy(atvMesh.quaternion);
        console.log('ATV loaded successfully');
    },
    (progress) => console.log('Loading ATV:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('ATV loading failed:', error)
);

// Dust particles
const particleGeometry = new THREE.BufferGeometry();
const particleCount = 200;
const posArray = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i++) posArray[i] = 0;
particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particleMaterial = new THREE.PointsMaterial({ color: 0x654321, size: 0.2, transparent: true, opacity: 0.8 });
const dustParticles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(dustParticles);

// Speedometer UI
const speedometer = document.createElement('div');
speedometer.style.position = 'absolute';
speedometer.style.top = '10px';
speedometer.style.left = '10px';
speedometer.style.color = 'white';
speedometer.style.fontSize = '20px';
speedometer.style.background = 'rgba(0, 0, 0, 0.5)';
speedometer.style.padding = '5px';
document.body.appendChild(speedometer);

// Camera setup
camera.position.set(0, 10, -30);
camera.lookAt(0, 0, 0);

// Keyboard controls
const controls = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w': controls.forward = true; break;
        case 's': controls.backward = true; break;
        case 'a': controls.left = true; break;
        case 'd': controls.right = true; break;
    }
});
document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w': controls.forward = false; break;
        case 's': controls.backward = false; break;
        case 'a': controls.left = false; break;
        case 'd': controls.right = false; break;
    }
});

// Animation loop
let settled = false;
function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);

    // Controls
    const speed = 700; // Reduced for control
    const turnSpeed = 1.75;
    const localDirection = new CANNON.Vec3(0, 0, -1);
    const worldDirection = chassisBody.quaternion.vmult(localDirection);
    worldDirection.y = 0;
    worldDirection.normalize();

    if (controls.forward) {
        chassisBody.applyForce(worldDirection.scale(-speed * 5), chassisBody.position);
    } else if (controls.backward) {
        chassisBody.applyForce(worldDirection.scale(speed * 5), chassisBody.position);
    }

    if (controls.left) {
        chassisBody.angularVelocity.y = turnSpeed;
    } else if (controls.right) {
        chassisBody.angularVelocity.y = -turnSpeed;
    } else {
        chassisBody.angularVelocity.y *= 0.9;
    }

    // Fade damping after landing
    if (chassisBody.position.y <= 0.5 && !settled) {
        settled = true;
        chassisBody.linearDamping = 0.5;
        chassisBody.angularDamping = 0.5;
    }

    // Cap angular velocity during jump
    const maxAngular = 5;
    chassisBody.angularVelocity.x = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.x));
    chassisBody.angularVelocity.y = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.y));
    chassisBody.angularVelocity.z = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.z));

    if (atvMesh) {
        atvMesh.position.copy(chassisBody.position);
        atvMesh.position.y += 1.7;
        atvMesh.quaternion.copy(chassisBody.quaternion);

        // Dust particles
        const velocityMagnitude = Math.sqrt(chassisBody.velocity.x ** 2 + chassisBody.velocity.z ** 2);
        const positions = dustParticles.geometry.attributes.position.array;
        if (velocityMagnitude > 0.5) {
            for (let i = 0; i < particleCount; i++) {
                const idx = i * 3;
                if (positions[idx + 1] < -0.4 || Math.random() < 0.2) {
                    positions[idx] = atvMesh.position.x + (Math.random() - 0.5) * 4;
                    positions[idx + 1] = 0 + Math.random() * 0.4;
                    positions[idx + 2] = atvMesh.position.z + (Math.random() - 0.5) * 1;
                } else {
                    positions[idx + 1] -= 0.05;
                    positions[idx] += (Math.random() - 0.5) * 0.1;
                    positions[idx + 2] += (Math.random() - 0.5) * 0.1;
                }
            }
        } else {
            for (let i = 0; i < particleCount * 3; i += 3) {
                positions[i + 1] -= 0.1;
                if (positions[i + 1] < -0.4) positions[i + 1] = -0.4;
            }
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;

        // Speedometer
        const speedDisplay = (velocityMagnitude * 3.6).toFixed(1);
        speedometer.textContent = `Speed: ${speedDisplay} km/h`;

        // Camera follow
        const cameraOffset = new THREE.Vector3(0, 5, -10);
        const atvPosition = new THREE.Vector3().copy(atvMesh.position);
        const atvQuaternion = new THREE.Quaternion().copy(atvMesh.quaternion);
        cameraOffset.applyQuaternion(atvQuaternion);
        const targetCameraPosition = atvPosition.add(cameraOffset);
        camera.position.lerp(targetCameraPosition, 0.05);
        camera.lookAt(atvMesh.position);
    }

    // Reset if ATV falls too far or flies too high
    if (chassisBody.position.y < -10 || chassisBody.position.y > 50) {
        chassisBody.position.set(0, 5, -20);
        chassisBody.velocity.set(0, 0, 0);
        chassisBody.angularVelocity.set(0, 0, 0);
        chassisBody.quaternion.set(0, 0, 0, 1);
        settled = false;
        chassisBody.linearDamping = 0.9;
        chassisBody.angularDamping = 0.9;
        console.log('ATV reset to starting position');
    }

    // Debug positions
    console.log('ATV body position:', chassisBody.position);
    if (atvMesh) console.log('ATV mesh position:', atvMesh.position);
    console.log('ATV velocity:', chassisBody.velocity);
    console.log('ATV quaternion:', chassisBody.quaternion);
    console.log('ATV angular velocity:', chassisBody.angularVelocity);
    console.log('World direction:', worldDirection);
    console.log('Camera position:', camera.position);
    console.log('Rendering');

    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});