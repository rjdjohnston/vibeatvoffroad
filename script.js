// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0000ff); // Blue background (fallback)
document.body.appendChild(renderer.domElement);

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -15.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 20;

// Materials
const groundMaterial = new CANNON.Material('ground');
const vehicleMaterial = new CANNON.Material('vehicle');
const assetMaterial = new CANNON.Material('asset');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, vehicleMaterial, {
    friction: 1.0,
    restitution: 0.05
});
const assetContactMaterial = new CANNON.ContactMaterial(vehicleMaterial, assetMaterial, {
    friction: 0.8,
    restitution: 0.1
});
world.addContactMaterial(contactMaterial);
world.addContactMaterial(assetContactMaterial);

// Lighting
const ambientLight = new THREE.AmbientLight(0x505050);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

// Loaders
const textureLoader = new THREE.TextureLoader();

// Background (Desert Image JPG)
let skybox;
console.log('Starting skybox load...');
textureLoader.load(
    'assets/desert_image.jpg',
    (texture) => {
        const geometry = new THREE.SphereGeometry(2000, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
            depthWrite: false
        });
        skybox = new THREE.Mesh(geometry, material);
        skybox.position.set(0, 0, 0);
        scene.add(skybox);
        console.log('Desert skybox loaded at:', skybox.position, 'Scale:', skybox.scale);
        console.log('Scene children after adding skybox:', scene.children.length);
    },
    (progress) => console.log('Loading skybox progress:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('Skybox loading failed:', error)
);

// Base terrain
const terrainSize = 700;
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
terrainMesh.position.set(0, 0, 0);
scene.add(terrainMesh);

// Physics terrain
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
groundBody.position.set(0, 0, 0);
world.addBody(groundBody);

// Race Track Material
const trackMaterial = new THREE.MeshPhongMaterial({ color: 0xE69138 });
trackMaterial.needsUpdate = true;

// Simple Oval Track (500x500, 40 wide)
const trackGeometry = new THREE.RingGeometry(210, 250, 32, 1, 0, 2 * Math.PI);
const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
trackMesh.rotation.x = -Math.PI / 2;
trackMesh.position.set(0, 0.1, 0);
scene.add(trackMesh);

// Physics Oval Track
const trackVertices = [
    new CANNON.Vec3(-250, 0, -210),
    new CANNON.Vec3(250, 0, -210),
    new CANNON.Vec3(250, 0, 210),
    new CANNON.Vec3(-250, 0, 210),
    new CANNON.Vec3(-210, 0, -210),
    new CANNON.Vec3(210, 0, -210),
    new CANNON.Vec3(210, 0, 210),
    new CANNON.Vec3(-210, 0, 210)
];
const trackFaces = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0]
];
const trackShape = new CANNON.ConvexPolyhedron(trackVertices, trackFaces);
const trackBody = new CANNON.Body({ mass: 0, material: groundMaterial });
trackBody.addShape(trackShape);
trackBody.position.set(0, 0.1, 0);
world.addBody(trackBody);

// Original Jump (Number 4)
const jumpGeometry = new THREE.BoxGeometry(20, 5, 40);
const jumpMesh = new THREE.Mesh(jumpGeometry, trackMaterial);
jumpMesh.rotation.x = -Math.PI / 6;
jumpMesh.position.set(220, 2.5, -50);
scene.add(jumpMesh);

const jumpShape = new CANNON.Box(new CANNON.Vec3(10, 2.5, 20));
const jumpBody = new CANNON.Body({ mass: 0, material: groundMaterial });
jumpBody.addShape(jumpShape);
jumpBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 6);
jumpBody.position.set(220, 2.5, -50);
world.addBody(jumpBody);

// Medium Jump (Top, Number 1)
const mediumJumpGeometry = new THREE.BoxGeometry(18, 4, 35);
const mediumJumpMesh = new THREE.Mesh(mediumJumpGeometry, trackMaterial);
mediumJumpMesh.rotation.x = -Math.PI / 6;
mediumJumpMesh.rotation.y = Math.PI;
mediumJumpMesh.position.set(0, 2, 230);
scene.add(mediumJumpMesh);

const mediumJumpShape = new CANNON.Box(new CANNON.Vec3(9, 2, 17.5));
const mediumJumpBody = new CANNON.Body({ mass: 0, material: groundMaterial });
mediumJumpBody.addShape(mediumJumpShape);
mediumJumpBody.quaternion.setFromEuler(-Math.PI / 6, Math.PI, 0, 'XYZ');
mediumJumpBody.position.set(0, 2, 230);
world.addBody(mediumJumpBody);

// New Large Jump (Bottom, Number 3)
const largeJumpGeometry = new THREE.BoxGeometry(20, 5, 40);
const largeJumpMesh = new THREE.Mesh(largeJumpGeometry, trackMaterial);
largeJumpMesh.rotation.x = -Math.PI / 6;
largeJumpMesh.rotation.y = 0;
largeJumpMesh.position.set(0, 2.5, -230);
scene.add(largeJumpMesh);

const largeJumpShape = new CANNON.Box(new CANNON.Vec3(10, 2.5, 20));
const largeJumpBody = new CANNON.Body({ mass: 0, material: groundMaterial });
largeJumpBody.addShape(largeJumpShape);
largeJumpBody.quaternion.setFromEuler(-Math.PI / 6, 0, 0, 'XYZ');
largeJumpBody.position.set(0, 2.5, -230);
world.addBody(largeJumpBody);

// Add numbers to jumps
const fontLoader = new THREE.FontLoader();
fontLoader.load(
    'https://unpkg.com/three@0.134.0/examples/fonts/helvetiker_regular.typeface.json',
    (font) => {
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // Number 4 for Original Jump
        const originalTextGeometry = new THREE.TextGeometry('4', {
            font: font,
            size: 5,
            height: 0.5,
        });
        const originalTextMesh = new THREE.Mesh(originalTextGeometry, textMaterial);
        originalTextMesh.position.set(215, 7, -50);
        originalTextMesh.rotation.y = 0;
        scene.add(originalTextMesh);

        // Number 1 for Medium Jump
        const mediumTextGeometry = new THREE.TextGeometry('1', {
            font: font,
            size: 5,
            height: 0.5,
        });
        const mediumTextMesh = new THREE.Mesh(mediumTextGeometry, textMaterial);
        mediumTextMesh.position.set(-5, 6, 230);
        mediumTextMesh.rotation.y = Math.PI;
        scene.add(mediumTextMesh);

        // Number 3 for New Large Jump
        const largeTextGeometry = new THREE.TextGeometry('3', {
            font: font,
            size: 5,
            height: 0.5,
        });
        const largeTextMesh = new THREE.Mesh(largeTextGeometry, textMaterial);
        largeTextMesh.position.set(-5, 7, -230);
        largeTextMesh.rotation.y = 0;
        scene.add(largeTextMesh);

        console.log('Jump numbers added successfully');
    },
    (progress) => console.log('Font loading progress:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('Font loading failed:', error)
);

// Start/Finish Line
const lineGeometry = new THREE.PlaneGeometry(40, 2);
const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
lineMesh.rotation.x = -Math.PI / 2;
lineMesh.position.set(230, 0.21, 0);
scene.add(lineMesh);

// ATV physics
const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 1));
const chassisBody = new CANNON.Body({ mass: 50, material: vehicleMaterial });
chassisBody.addShape(chassisShape);
chassisBody.position.set(230, 0.6, 0);
chassisBody.velocity.set(0, 0, 0);
chassisBody.angularVelocity.set(0, 0, 0);
chassisBody.quaternion.set(0, 0, 0, 1);
chassisBody.linearDamping = 0.9;
chassisBody.angularDamping = 0.9;
world.addBody(chassisBody);

// Wheels physics
const wheelShape = new CANNON.Sphere(0.5);
const wheelBodies = [];
const wheelConstraints = [];
const wheelPositions = [
    new CANNON.Vec3(-1.5, -0.5, -1), // Front left
    new CANNON.Vec3(1.5, -0.5, -1),  // Front right
    new CANNON.Vec3(-1.5, -0.5, 1),  // Rear left
    new CANNON.Vec3(1.5, -0.5, 1)    // Rear right
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

// Step physics once to settle ATV
world.step(1 / 60);

// Load ATV model
let atvMesh;
let wheelMeshes = {
    frontLeft: null,
    frontRight: null,
    rearLeft: null,
    rearRight: null
};
const gltfLoader = new THREE.GLTFLoader();
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

        // Identify wheel meshes by position relative to chassis (after scaling)
        atvMesh.traverse((node) => {
            if (node.isMesh) {
                const localPos = node.position.clone().multiplyScalar(0.1); // Apply scale factor
                // Assuming wheels are at roughly these positions relative to chassis center
                if (Math.abs(localPos.x + 1.5) < 0.5 && Math.abs(localPos.z + 1) < 0.5) wheelMeshes.frontLeft = node;
                if (Math.abs(localPos.x - 1.5) < 0.5 && Math.abs(localPos.z + 1) < 0.5) wheelMeshes.frontRight = node;
                if (Math.abs(localPos.x + 1.5) < 0.5 && Math.abs(localPos.z - 1) < 0.5) wheelMeshes.rearLeft = node;
                if (Math.abs(localPos.x - 1.5) < 0.5 && Math.abs(localPos.z - 1) < 0.5) wheelMeshes.rearRight = node;
            }
        });
        console.log('Wheel meshes identified:', wheelMeshes);
    },
    (progress) => console.log('Loading ATV:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('ATV loading failed:', error)
);

// Load and place survival assets
gltfLoader.load(
    'assets/survival/scene.gltf',
    (gltf) => {
        console.log('Survival GLTF loaded:', gltf);
        const assets = gltf.scene;

        const tireMesh = assets.getObjectByName('opon_Material002_0');
        const barrelMesh = assets.getObjectByName('Cylinder003_Material003_0');
        const cubeMesh = assets.getObjectByName('Cube057_DefaultMaterial_0');

        if (!tireMesh || !barrelMesh || !cubeMesh) {
            console.error('One or more meshes not found:', { tireMesh, barrelMesh, cubeMesh });
            return;
        }

        assets.traverse((node) => {
            if (node.isMesh && node.material) {
                node.material.emissive = new THREE.Color(0x202020);
                node.material.emissiveIntensity = 0.5;
                console.log(`Material for ${node.name}:`, node.material);
            }
        });

        for (let i = 0; i < 10; i++) {
            const tireClone = tireMesh.clone();
            tireClone.position.set(
                (Math.random() - 0.5) * 600,
                0,
                (Math.random() - 0.5) * 600
            );
            tireClone.scale.set(5, 5, 5);
            if (Math.abs(tireClone.position.x) > 250 || Math.abs(tireClone.position.z) > 250) {
                scene.add(tireClone);
                const tireBody = new CANNON.Body({ mass: 0, material: assetMaterial });
                tireBody.addShape(new CANNON.Box(new CANNON.Vec3(0.37, 0.37, 0.16)));
                tireBody.position.copy(tireClone.position);
                world.addBody(tireBody);
                console.log('Tire placed at:', tireClone.position);
            }

            const barrelClone = barrelMesh.clone();
            barrelClone.position.set(
                (Math.random() - 0.5) * 600,
                0,
                (Math.random() - 0.5) * 600
            );
            barrelClone.scale.set(5, 5, 5);
            if (Math.abs(barrelClone.position.x) > 250 || Math.abs(barrelClone.position.z) > 250) {
                scene.add(barrelClone);
                const barrelBody = new CANNON.Body({ mass: 0, material: assetMaterial });
                barrelBody.addShape(new CANNON.Box(new CANNON.Vec3(0.27, 0.27, 0.44)));
                barrelBody.position.copy(barrelClone.position);
                world.addBody(barrelBody);
                console.log('Barrel placed at:', barrelClone.position);
            }
        }

        for (let i = 0; i < 5; i++) {
            const barrelClone = barrelMesh.clone();
            barrelClone.position.set(
                (Math.random() - 0.5) * 300,
                0,
                (Math.random() - 0.5) * 300
            );
            barrelClone.scale.set(5, 5, 5);
            const distX = Math.abs(barrelClone.position.x);
            const distZ = Math.abs(barrelClone.position.z);
            if ((distX > 125 && distX < 250) || (distZ > 125 && distZ < 250)) {
                scene.add(barrelClone);
                const barrelBody = new CANNON.Body({ mass: 0, material: assetMaterial });
                barrelBody.addShape(new CANNON.Box(new CANNON.Vec3(0.27, 0.27, 0.44)));
                barrelBody.position.copy(barrelClone.position);
                world.addBody(barrelBody);
                console.log('Extra barrel placed near track at:', barrelClone.position);
            }
        }

        const trackAssets = [
            { mesh: tireMesh, pos: new THREE.Vector3(210, 0.1, 100), size: new CANNON.Vec3(0.37, 0.37, 0.16) },
            { mesh: barrelMesh, pos: new THREE.Vector3(250, 0.1, -100), size: new CANNON.Vec3(0.27, 0.27, 0.44) },
            { mesh: cubeMesh, pos: new THREE.Vector3(-230, 0.1, 50), size: new CANNON.Vec3(1.99, 0.79, 0.78) }
        ];
        trackAssets.forEach(asset => {
            const clone = asset.mesh.clone();
            clone.position.copy(asset.pos);
            clone.scale.set(5, 5, 5);
            scene.add(clone);
            const body = new CANNON.Body({ mass: 0, material: assetMaterial });
            body.addShape(new CANNON.Box(asset.size));
            body.position.copy(clone.position);
            world.addBody(body);
            console.log(`${asset.mesh.name} placed on track at:`, clone.position);
        });

        console.log('Survival assets loaded and placed');
    },
    (progress) => console.log('Loading survival assets:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('Survival assets loading failed:', error)
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
camera.position.set(230, 10, -30);
camera.lookAt(230, 0, 0);

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
let wheelRotationX = 0; // Cumulative rotation for rolling
const wheelRadius = 0.5; // Matches physics wheel size
function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);

    // Controls
    const speed = 1200;
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

    // Cap angular velocity
    const maxAngular = 5;
    chassisBody.angularVelocity.x = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.x));
    chassisBody.angularVelocity.y = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.y));
    chassisBody.angularVelocity.z = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.z));

    if (atvMesh) {
        atvMesh.position.copy(chassisBody.position);
        atvMesh.position.y += 1.7;
        atvMesh.quaternion.copy(chassisBody.quaternion);

        // Wheel rotation
        const velocityMagnitude = Math.sqrt(chassisBody.velocity.x ** 2 + chassisBody.velocity.z ** 2);
        const rollSpeed = velocityMagnitude / wheelRadius; // Angular velocity in radians/sec
        const deltaTime = 1 / 60; // Fixed timestep
        wheelRotationX += rollSpeed * deltaTime * (controls.forward ? 1 : controls.backward ? -1 : 0);

        const steeringAngle = controls.left ? -Math.PI / 6 : controls.right ? Math.PI / 6 : 0; // Max 30 degrees

        if (wheelMeshes.frontLeft) {
            wheelMeshes.frontLeft.rotation.set(wheelRotationX, steeringAngle, 0, 'XYZ');
        }
        if (wheelMeshes.frontRight) {
            wheelMeshes.frontRight.rotation.set(wheelRotationX, steeringAngle, 0, 'XYZ');
        }
        if (wheelMeshes.rearLeft) {
            wheelMeshes.rearLeft.rotation.set(wheelRotationX, 0, 0, 'XYZ');
        }
        if (wheelMeshes.rearRight) {
            wheelMeshes.rearRight.rotation.set(wheelRotationX, 0, 0, 'XYZ');
        }

        // Dust particles
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

        // Update skybox position
        if (skybox) {
            skybox.position.copy(camera.position);
        }
    }

    // Reset if needed
    if (chassisBody.position.y < -10 || chassisBody.position.y > 50) {
        chassisBody.position.set(230, 0.6, 0);
        chassisBody.velocity.set(0, 0, 0);
        chassisBody.angularVelocity.set(0, 0, 0);
        chassisBody.quaternion.set(0, 0, 0, 1);
        settled = false;
        chassisBody.linearDamping = 0.9;
        chassisBody.angularDamping = 0.9;
        console.log('ATV reset to starting position');
    }

    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});