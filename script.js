// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000); // Increased far plane
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// Materials for friction
const groundMaterial = new CANNON.Material('ground');
const vehicleMaterial = new CANNON.Material('vehicle');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, vehicleMaterial, {
    friction: 0.9, // Higher friction for grip
    restitution: 0.1 // Slight bounce
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

// Terrain (much larger with dirt texture)
const terrainSize = 1000; // 10x larger
const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize);
const dirtTexture = textureLoader.load(
    'textures/dirt.jpg',
    (texture) => console.log('Texture loaded successfully:', texture),
    undefined,
    (error) => console.error('Texture loading failed:', error)
);
dirtTexture.wrapS = dirtTexture.wrapT = THREE.RepeatWrapping;
dirtTexture.repeat.set(5, 5); // Increased tiling for larger terrain
const terrainMaterial = new THREE.MeshPhongMaterial({ map: dirtTexture });
const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrainMesh.rotation.x = -Math.PI / 2;
scene.add(terrainMesh);

// Physics terrain (flat plane, infinite in Cannon.js)
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

// ATV physics (chassis and wheels)
const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 1)); // Original height
const chassisBody = new CANNON.Body({ mass: 50, material: vehicleMaterial });
chassisBody.addShape(chassisShape, new CANNON.Vec3(0, -0.1, 0)); // Slightly raised center of mass
chassisBody.position.set(0, 3, 0); // Higher start for bounce
chassisBody.linearDamping = 0.4;
chassisBody.angularDamping = 0.7; // Reduced for slight tipping
world.addBody(chassisBody);

// Wheels (wider base for stability)
const wheelShape = new CANNON.Sphere(0.5);
const wheelBodies = [];
const wheelConstraints = [];
const wheelPositions = [
    new CANNON.Vec3(-1.2, -0.40, -1),  // Front-left (wider, raised)
    new CANNON.Vec3(1.2, -0.40, -1),   // Front-right (wider, raised)
    new CANNON.Vec3(-1.2, -0.40, 1),   // Rear-left (wider, raised)
    new CANNON.Vec3(1.2, -0.40, 1)     // Rear-right (wider, raised)
];

wheelPositions.forEach((pos, index) => {
    const wheelBody = new CANNON.Body({ mass: 0.5, material: vehicleMaterial });
    wheelBody.addShape(wheelShape);
    wheelBody.position.copy(chassisBody.position).vadd(pos);
    world.addBody(wheelBody);
    wheelBodies.push(wheelBody);

    // Hinge constraint for wheel rotation
    const constraint = new CANNON.HingeConstraint(chassisBody, wheelBody, {
        pivotA: pos,
        pivotB: new CANNON.Vec3(0, 0, 0),
        axisA: new CANNON.Vec3(1, 0, 0), // Rotate around x-axis
        axisB: new CANNON.Vec3(1, 0, 0)
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
        atvMesh.position.y += 1.7; // Your favorite offset
        atvMesh.quaternion.set(0, 0, 0, 1); // Ensure upright
        chassisBody.quaternion.copy(atvMesh.quaternion); // Sync physics
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

// Camera setup (initial position behind ATV)
camera.position.set(0, 10, -10); // Behind ATV’s back
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
function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);

    // Controls
    const speed = 100; // Your preferred value
    const turnSpeed = 1.75; // Your preferred value
    const localDirection = new CANNON.Vec3(0, 0, -1); // Local forward (front of ATV)
    const worldDirection = chassisBody.quaternion.vmult(localDirection);
    worldDirection.y = 0;
    worldDirection.normalize();

    if (controls.forward) { // W moves away from camera (back visible)
        chassisBody.applyForce(worldDirection.scale(-speed * 10), chassisBody.position);
    } else if (controls.backward) { // S moves toward camera (front visible)
        chassisBody.applyForce(worldDirection.scale(speed * 10), chassisBody.position);
    }

    if (controls.left) {
        chassisBody.angularVelocity.y = turnSpeed;
    } else if (controls.right) {
        chassisBody.angularVelocity.y = -turnSpeed;
    } else {
        chassisBody.angularVelocity.y *= 0.9; // Dampen when released
    }

    if (atvMesh) {
        atvMesh.position.copy(chassisBody.position);
        atvMesh.position.y += 1.7; // Your favorite offset
        atvMesh.quaternion.copy(chassisBody.quaternion);

        // Dust particles (tighter timing and lower position)
        const velocityMagnitude = Math.sqrt(chassisBody.velocity.x ** 2 + chassisBody.velocity.z ** 2);
        const positions = dustParticles.geometry.attributes.position.array;
        if (velocityMagnitude > 0.5) { // Lower threshold for quicker start
            for (let i = 0; i < particleCount; i++) {
                const idx = i * 3;
                if (positions[idx + 1] < -0.4 || Math.random() < 0.2) { // Respawn faster, lower bound
                    positions[idx] = atvMesh.position.x + (Math.random() - 0.5) * 4; // Spread horizontally
                    positions[idx + 1] = 0 + Math.random() * 0.4; // Just above ground (y = 0 to 0.4)
                    positions[idx + 2] = atvMesh.position.z + (Math.random() - 0.5) * 1; // Closer to ATV
                } else {
                    positions[idx + 1] -= 0.05; // Fall
                    positions[idx] += (Math.random() - 0.5) * 0.1; // Drift
                    positions[idx + 2] += (Math.random() - 0.5) * 0.1;
                }
            }
        } else { // Reset quickly when stopped
            for (let i = 0; i < particleCount * 3; i += 3) {
                positions[i + 1] -= 0.1; // Fall faster when stopped
                if (positions[i + 1] < -0.4) positions[i + 1] = -0.4; // Clamp to ground
            }
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;

        // Speedometer
        const speedDisplay = (velocityMagnitude * 3.6).toFixed(1); // Convert to "km/h"
        speedometer.textContent = `Speed: ${speedDisplay} km/h`;

        // Camera follow (behind ATV’s back)
        const cameraOffset = new THREE.Vector3(0, 5, -10); // Up 5, behind 10
        const atvPosition = new THREE.Vector3().copy(atvMesh.position);
        const atvQuaternion = new THREE.Quaternion().copy(atvMesh.quaternion);
        cameraOffset.applyQuaternion(atvQuaternion);
        const targetCameraPosition = atvPosition.add(cameraOffset);

        camera.position.lerp(targetCameraPosition, 0.1);
        camera.lookAt(atvMesh.position);
    }

    // Reset if ATV falls too far
    if (chassisBody.position.y < -10) {
        chassisBody.position.set(0, 3, 0);
        chassisBody.velocity.set(0, 0, 0);
        chassisBody.angularVelocity.set(0, 0, 0);
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