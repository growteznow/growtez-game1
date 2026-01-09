/**
 * Crystal Quest - 3D Adventure Game
 * Built with Three.js
 * Optimized for Mobile + Smooth Physics
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ============================================
// Device Detection & Performance Config
// ============================================
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
const isLowPerf = isMobile || navigator.hardwareConcurrency <= 4;

// ============================================
// Game Configuration
// ============================================
const CONFIG = {
    player: {
        maxSpeed: isMobile ? 0.18 : 0.2,
        acceleration: 0.015,
        friction: 0.92,
        size: 0.5,
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.5
    },
    crystal: {
        count: isMobile ? 8 : 10,
        size: 0.4,
        rotationSpeed: 0.02,
        floatSpeed: 0.003,
        floatAmount: 0.3
    },
    obstacle: {
        count: isMobile ? 4 : 5,
        speed: 0.01
    },
    platform: {
        radius: 15,
        segments: isMobile ? 32 : 64
    },
    camera: {
        distance: isMobile ? 14 : 12,
        height: isMobile ? 10 : 8,
        smoothing: 0.08
    },
    graphics: {
        pixelRatio: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2),
        shadowMapSize: isMobile ? 1024 : 2048,
        starCount: isMobile ? 800 : 2000,
        bloomStrength: isMobile ? 0.3 : 0.5,
        enableShadows: !isLowPerf
    }
};

// ============================================
// Game State
// ============================================
class GameState {
    constructor() {
        this.score = 0;
        this.totalCrystals = CONFIG.crystal.count;
        this.isPlaying = false;
        this.isGameOver = false;
        this.crystals = [];
        this.obstacles = [];
        this.particles = [];
    }

    reset() {
        this.score = 0;
        this.isPlaying = false;
        this.isGameOver = false;
    }
}

// ============================================
// Input Handler (Keyboard + Touch)
// ============================================
class InputHandler {
    constructor(gameContainer) {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        // Touch joystick state
        this.touch = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            joystickRadius: 60
        };

        this.gameContainer = gameContainer;
        this.setupListeners();

        if (isMobile) {
            this.createVirtualJoystick();
        }
    }

    setupListeners() {
        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKey(e, true));
        document.addEventListener('keyup', (e) => this.handleKey(e, false));

        // Touch events for virtual joystick
        if (isMobile) {
            document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        }
    }

    createVirtualJoystick() {
        // Joystick container
        this.joystickContainer = document.createElement('div');
        this.joystickContainer.id = 'joystick-container';
        this.joystickContainer.innerHTML = `
            <div class="joystick-base">
                <div class="joystick-handle"></div>
            </div>
        `;
        document.body.appendChild(this.joystickContainer);

        this.joystickBase = this.joystickContainer.querySelector('.joystick-base');
        this.joystickHandle = this.joystickContainer.querySelector('.joystick-handle');
    }

    handleTouchStart(event) {
        if (!game || !game.state.isPlaying) return;

        const touch = event.touches[0];

        // Only activate if touch is on the left half of screen
        if (touch.clientX < window.innerWidth * 0.6) {
            event.preventDefault();
            this.touch.active = true;
            this.touch.startX = touch.clientX;
            this.touch.startY = touch.clientY;
            this.touch.currentX = touch.clientX;
            this.touch.currentY = touch.clientY;

            // Position joystick at touch location
            if (this.joystickBase) {
                this.joystickContainer.style.opacity = '1';
                this.joystickBase.style.left = `${touch.clientX - 50}px`;
                this.joystickBase.style.top = `${touch.clientY - 50}px`;
                this.joystickHandle.style.transform = 'translate(-50%, -50%)';
            }
        }
    }

    handleTouchMove(event) {
        if (!this.touch.active) return;
        event.preventDefault();

        const touch = event.touches[0];
        this.touch.currentX = touch.clientX;
        this.touch.currentY = touch.clientY;

        // Calculate joystick offset
        let dx = this.touch.currentX - this.touch.startX;
        let dy = this.touch.currentY - this.touch.startY;

        // Clamp to joystick radius
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > this.touch.joystickRadius) {
            dx = (dx / distance) * this.touch.joystickRadius;
            dy = (dy / distance) * this.touch.joystickRadius;
        }

        // Update joystick visual
        if (this.joystickHandle) {
            this.joystickHandle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
    }

    handleTouchEnd(event) {
        this.touch.active = false;
        this.touch.currentX = this.touch.startX;
        this.touch.currentY = this.touch.startY;

        // Reset joystick visual
        if (this.joystickHandle) {
            this.joystickHandle.style.transform = 'translate(-50%, -50%)';
        }
        if (this.joystickContainer) {
            this.joystickContainer.style.opacity = '0.7';
        }
    }

    handleKey(event, isPressed) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = isPressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = isPressed;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = isPressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = isPressed;
                break;
            case 'KeyR':
                if (isPressed) game.restart();
                break;
        }
    }

    getMovementVector() {
        const vector = new THREE.Vector3();

        // Keyboard input
        if (this.keys.forward) vector.z -= 1;
        if (this.keys.backward) vector.z += 1;
        if (this.keys.left) vector.x -= 1;
        if (this.keys.right) vector.x += 1;

        // Touch joystick input
        if (this.touch.active) {
            const dx = this.touch.currentX - this.touch.startX;
            const dy = this.touch.currentY - this.touch.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 10) { // Dead zone
                const normalizedDist = Math.min(distance / this.touch.joystickRadius, 1);
                vector.x = (dx / distance) * normalizedDist;
                vector.z = (dy / distance) * normalizedDist;
            }
        }

        // Normalize only if keyboard (touch already normalized)
        if (!this.touch.active && vector.length() > 0) {
            vector.normalize();
        }

        return vector;
    }

    showJoystick() {
        if (this.joystickContainer) {
            this.joystickContainer.classList.add('visible');
        }
    }

    hideJoystick() {
        if (this.joystickContainer) {
            this.joystickContainer.classList.remove('visible');
        }
    }
}

// ============================================
// Particle System (Optimized)
// ============================================
class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.maxParticles = isMobile ? 3 : 5;
    }

    createCollectionEffect(position, color = 0x00f5ff) {
        // Limit active particles for performance
        if (this.particles.length >= this.maxParticles) {
            const oldest = this.particles.shift();
            this.scene.remove(oldest.mesh);
            oldest.mesh.geometry.dispose();
            oldest.mesh.material.dispose();
        }

        const particleCount = isMobile ? 12 : 20;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                Math.random() * 0.2 + 0.1,
                (Math.random() - 0.5) * 0.3
            ));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: color,
            size: isMobile ? 0.2 : 0.15,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.particles.push({
            mesh: points,
            velocities: velocities,
            life: 1.0
        });
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const positions = particle.mesh.geometry.attributes.position.array;

            for (let j = 0; j < positions.length / 3; j++) {
                positions[j * 3] += particle.velocities[j].x;
                positions[j * 3 + 1] += particle.velocities[j].y;
                positions[j * 3 + 2] += particle.velocities[j].z;
                particle.velocities[j].y -= 0.005;
            }

            particle.mesh.geometry.attributes.position.needsUpdate = true;
            particle.life -= 0.03;
            particle.mesh.material.opacity = particle.life;

            if (particle.life <= 0) {
                this.scene.remove(particle.mesh);
                particle.mesh.geometry.dispose();
                particle.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
}

// ============================================
// Main Game Class
// ============================================
class CrystalQuestGame {
    constructor() {
        this.state = new GameState();
        this.clock = new THREE.Clock();

        // Smooth physics velocity
        this.velocity = new THREE.Vector3();

        // Delta time for frame-rate independence
        this.lastTime = performance.now();

        this.init();
        this.input = new InputHandler(document.getElementById('game-container'));
        this.setupEventListeners();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            isMobile ? 65 : 60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, CONFIG.camera.height, CONFIG.camera.distance);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: !isMobile,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(CONFIG.graphics.pixelRatio);

        if (CONFIG.graphics.enableShadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        // Post-processing (simplified for mobile)
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            CONFIG.graphics.bloomStrength,
            0.4,
            0.85
        );
        this.composer.addPass(bloomPass);
        this.bloomPass = bloomPass;

        // Particle System
        this.particleSystem = new ParticleSystem(this.scene);

        // Create game elements
        this.createLighting();
        this.createEnvironment();
        this.createPlayer();
        this.createCrystals();
        this.createObstacles();
        this.createStarfield();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Prevent context menu on long press
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    createLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404080, isMobile ? 0.7 : 0.5);
        this.scene.add(ambient);

        // Main directional light
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(10, 20, 10);

        if (CONFIG.graphics.enableShadows) {
            directional.castShadow = true;
            directional.shadow.mapSize.width = CONFIG.graphics.shadowMapSize;
            directional.shadow.mapSize.height = CONFIG.graphics.shadowMapSize;
            directional.shadow.camera.near = 0.5;
            directional.shadow.camera.far = 50;
            directional.shadow.camera.left = -20;
            directional.shadow.camera.right = 20;
            directional.shadow.camera.top = 20;
            directional.shadow.camera.bottom = -20;
        }
        this.scene.add(directional);

        // Colored point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0x00f5ff, isMobile ? 1.5 : 2, 30);
        pointLight1.position.set(-10, 5, -10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00ff, isMobile ? 1.5 : 2, 30);
        pointLight2.position.set(10, 5, 10);
        this.scene.add(pointLight2);

        // Hemisphere light
        const hemi = new THREE.HemisphereLight(0x00f5ff, 0xff00ff, 0.3);
        this.scene.add(hemi);
    }

    createEnvironment() {
        // Main platform
        const platformGeometry = new THREE.CylinderGeometry(
            CONFIG.platform.radius,
            CONFIG.platform.radius * 0.9,
            1,
            CONFIG.platform.segments
        );

        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a3a,
            roughness: 0.7,
            metalness: 0.3,
            emissive: 0x0a0a2a,
            emissiveIntensity: 0.2
        });

        this.platform = new THREE.Mesh(platformGeometry, platformMaterial);
        this.platform.position.y = -0.5;
        if (CONFIG.graphics.enableShadows) {
            this.platform.receiveShadow = true;
        }
        this.scene.add(this.platform);

        // Platform glow ring
        const ringGeometry = new THREE.TorusGeometry(CONFIG.platform.radius, 0.1, 16, isMobile ? 50 : 100);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f5ff,
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0;
        this.scene.add(ring);

        // Inner decorative rings (fewer on mobile)
        const ringCount = isMobile ? 2 : 3;
        for (let i = 1; i <= ringCount; i++) {
            const innerRing = new THREE.Mesh(
                new THREE.TorusGeometry(CONFIG.platform.radius * (i * 0.3), 0.05, 8, isMobile ? 30 : 50),
                new THREE.MeshBasicMaterial({
                    color: i % 2 === 0 ? 0xff00ff : 0x00f5ff,
                    transparent: true,
                    opacity: 0.3
                })
            );
            innerRing.rotation.x = Math.PI / 2;
            innerRing.position.y = 0.01;
            this.scene.add(innerRing);
        }
    }

    createPlayer() {
        // Player mesh - glowing icosahedron
        const geometry = new THREE.IcosahedronGeometry(CONFIG.player.size, isMobile ? 0 : 1);
        const material = new THREE.MeshPhongMaterial({
            color: CONFIG.player.color,
            emissive: CONFIG.player.emissive,
            emissiveIntensity: CONFIG.player.emissiveIntensity,
            shininess: 100,
            transparent: true,
            opacity: 0.9
        });

        this.player = new THREE.Mesh(geometry, material);
        this.player.position.y = CONFIG.player.size;
        if (CONFIG.graphics.enableShadows) {
            this.player.castShadow = true;
        }
        this.scene.add(this.player);

        // Player glow
        const glowGeometry = new THREE.IcosahedronGeometry(CONFIG.player.size * 1.3, 0);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: CONFIG.player.color,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        this.playerGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.player.add(this.playerGlow);

        // Player point light
        const playerLight = new THREE.PointLight(CONFIG.player.color, 1, 5);
        playerLight.position.y = 0;
        this.player.add(playerLight);
    }

    createCrystals() {
        this.state.crystals = [];
        const crystalGeometry = new THREE.OctahedronGeometry(CONFIG.crystal.size, 0);

        for (let i = 0; i < CONFIG.crystal.count; i++) {
            const angle = (i / CONFIG.crystal.count) * Math.PI * 2 + Math.random() * 0.5;
            const radius = 3 + Math.random() * (CONFIG.platform.radius - 5);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const hue = (i / CONFIG.crystal.count);
            const color = new THREE.Color().setHSL(0.5 + hue * 0.3, 1, 0.5);

            const material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                shininess: 100,
                transparent: true,
                opacity: 0.9
            });

            const crystal = new THREE.Mesh(crystalGeometry, material);
            crystal.position.set(x, 1 + Math.random() * 0.5, z);
            if (CONFIG.graphics.enableShadows) {
                crystal.castShadow = true;
            }

            crystal.userData.initialY = crystal.position.y;
            crystal.userData.floatOffset = Math.random() * Math.PI * 2;
            crystal.userData.collected = false;

            // Crystal glow (simplified)
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
            });
            const glow = new THREE.Mesh(
                new THREE.OctahedronGeometry(CONFIG.crystal.size * 1.5, 0),
                glowMaterial
            );
            crystal.add(glow);

            // Point light only on desktop
            if (!isMobile) {
                const light = new THREE.PointLight(color, 0.5, 3);
                crystal.add(light);
            }

            this.scene.add(crystal);
            this.state.crystals.push(crystal);
        }
    }

    createObstacles() {
        this.state.obstacles = [];

        for (let i = 0; i < CONFIG.obstacle.count; i++) {
            const angle = (i / CONFIG.obstacle.count) * Math.PI * 2;
            const radius = 5 + Math.random() * 5;

            const geometry = new THREE.BoxGeometry(0.5, 2, 2);
            const material = new THREE.MeshLambertMaterial({
                color: 0xff3366,
                emissive: 0xff0044,
                emissiveIntensity: 0.3
            });

            const obstacle = new THREE.Mesh(geometry, material);
            obstacle.position.set(
                Math.cos(angle) * radius,
                1,
                Math.sin(angle) * radius
            );
            if (CONFIG.graphics.enableShadows) {
                obstacle.castShadow = true;
            }

            obstacle.userData.orbitRadius = radius;
            obstacle.userData.orbitAngle = angle;
            obstacle.userData.orbitSpeed = 0.005 + Math.random() * 0.01;
            obstacle.userData.direction = i % 2 === 0 ? 1 : -1;

            this.scene.add(obstacle);
            this.state.obstacles.push(obstacle);
        }
    }

    createStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = CONFIG.graphics.starCount;
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const radius = 50 + Math.random() * 150;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.cos(phi);
            positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: isMobile ? 0.8 : 0.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.starfield = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starfield);
    }

    setupEventListeners() {
        // Start button
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });

        // Touch start for mobile
        document.getElementById('start-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.startGame();
        });

        // Restart buttons
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restart();
        });
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.restart();
        });
    }

    startGame() {
        // Hide start screen
        document.getElementById('start-screen').classList.add('hidden');

        // Show HUD
        document.getElementById('hud').classList.add('visible');

        // Show appropriate controls
        if (isMobile) {
            document.getElementById('controls-info').style.display = 'none';
            this.input.showJoystick();
        } else {
            document.getElementById('controls-info').classList.add('visible');
        }

        // Start playing
        this.state.isPlaying = true;

        // Start animation loop
        this.animate();
    }

    restart() {
        // Reset game state
        this.state.reset();

        // Reset velocity
        this.velocity.set(0, 0, 0);

        // Reset player position
        this.player.position.set(0, CONFIG.player.size, 0);

        // Reset crystals
        this.scene.children = this.scene.children.filter(
            child => !this.state.crystals.includes(child)
        );
        this.state.crystals = [];
        this.createCrystals();

        // Reset obstacles
        this.state.obstacles.forEach(obstacle => {
            const angle = obstacle.userData.orbitAngle;
            const radius = obstacle.userData.orbitRadius;
            obstacle.position.set(
                Math.cos(angle) * radius,
                1,
                Math.sin(angle) * radius
            );
        });

        // Update UI
        this.updateScore();
        document.getElementById('game-message').classList.add('hidden');
        document.getElementById('hud').classList.add('visible');

        if (isMobile) {
            this.input.showJoystick();
        } else {
            document.getElementById('controls-info').classList.add('visible');
        }

        // Resume playing
        this.state.isPlaying = true;
        this.state.isGameOver = false;

        // Restart animation loop
        this.animate();
    }

    updatePlayer(deltaTime) {
        if (!this.state.isPlaying) return;

        const input = this.input.getMovementVector();

        // Apply acceleration based on input
        if (input.length() > 0) {
            this.velocity.x += input.x * CONFIG.player.acceleration * deltaTime;
            this.velocity.z += input.z * CONFIG.player.acceleration * deltaTime;
        }

        // Apply friction for smooth deceleration
        this.velocity.x *= CONFIG.player.friction;
        this.velocity.z *= CONFIG.player.friction;

        // Clamp to max speed
        const speed = this.velocity.length();
        if (speed > CONFIG.player.maxSpeed) {
            this.velocity.multiplyScalar(CONFIG.player.maxSpeed / speed);
        }

        // Apply velocity to position
        this.player.position.x += this.velocity.x * deltaTime;
        this.player.position.z += this.velocity.z * deltaTime;

        // Smooth rotation based on velocity
        if (speed > 0.001) {
            this.player.rotation.x += this.velocity.z * 0.15;
            this.player.rotation.z -= this.velocity.x * 0.15;
        }

        // Keep player on platform with smooth boundary
        const distFromCenter = Math.sqrt(
            this.player.position.x ** 2 +
            this.player.position.z ** 2
        );

        const boundary = CONFIG.platform.radius - 1;
        if (distFromCenter > boundary) {
            const angle = Math.atan2(this.player.position.z, this.player.position.x);
            this.player.position.x = Math.cos(angle) * boundary;
            this.player.position.z = Math.sin(angle) * boundary;

            // Dampen velocity when hitting boundary
            this.velocity.multiplyScalar(0.5);
        }

        // Floating animation
        this.player.position.y = CONFIG.player.size + Math.sin(Date.now() * 0.003) * 0.1;

        // Pulse glow
        if (this.playerGlow) {
            this.playerGlow.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.1);
        }
    }

    updateCamera() {
        // Smooth camera follow
        const targetX = this.player.position.x;
        const targetZ = this.player.position.z + CONFIG.camera.distance;
        const targetY = CONFIG.camera.height;

        this.camera.position.x += (targetX - this.camera.position.x) * CONFIG.camera.smoothing;
        this.camera.position.z += (targetZ - this.camera.position.z) * CONFIG.camera.smoothing;
        this.camera.position.y += (targetY - this.camera.position.y) * CONFIG.camera.smoothing;

        this.camera.lookAt(this.player.position);
    }

    updateCrystals(time) {
        this.state.crystals.forEach((crystal, index) => {
            if (crystal.userData.collected) return;

            // Rotation
            crystal.rotation.y += CONFIG.crystal.rotationSpeed;
            crystal.rotation.x += CONFIG.crystal.rotationSpeed * 0.5;

            // Floating animation
            const floatY = Math.sin(time * CONFIG.crystal.floatSpeed + crystal.userData.floatOffset) * CONFIG.crystal.floatAmount;
            crystal.position.y = crystal.userData.initialY + floatY;

            // Check collision with player (slightly larger hitbox on mobile for easier collection)
            const collisionRadius = isMobile ? 1.2 : 1.0;
            const distance = this.player.position.distanceTo(crystal.position);
            if (distance < (CONFIG.player.size + CONFIG.crystal.size) * collisionRadius) {
                this.collectCrystal(crystal, index);
            }
        });
    }

    collectCrystal(crystal, index) {
        // Create particle effect
        this.particleSystem.createCollectionEffect(
            crystal.position.clone(),
            crystal.material.color.getHex()
        );

        // Remove crystal
        crystal.userData.collected = true;
        this.scene.remove(crystal);

        // Update score
        this.state.score++;
        this.updateScore();

        // Haptic feedback on mobile
        if (isMobile && navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Check win condition
        if (this.state.score >= this.state.totalCrystals) {
            this.gameWin();
        }
    }

    updateObstacles(time) {
        this.state.obstacles.forEach(obstacle => {
            // Orbit movement
            obstacle.userData.orbitAngle += obstacle.userData.orbitSpeed * obstacle.userData.direction;

            obstacle.position.x = Math.cos(obstacle.userData.orbitAngle) * obstacle.userData.orbitRadius;
            obstacle.position.z = Math.sin(obstacle.userData.orbitAngle) * obstacle.userData.orbitRadius;

            // Face center
            obstacle.rotation.y = obstacle.userData.orbitAngle + Math.PI / 2;

            // Check collision with player
            const distance = this.player.position.distanceTo(obstacle.position);
            if (distance < CONFIG.player.size + 0.8) {
                this.gameOver();
            }
        });
    }

    updateScore() {
        document.getElementById('score').textContent = this.state.score;
        document.querySelector('.score-total').textContent = `/ ${this.state.totalCrystals}`;
    }

    gameWin() {
        this.state.isPlaying = false;
        this.state.isGameOver = true;

        if (isMobile && navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }

        document.getElementById('message-title').textContent = '🎉 Victory!';
        document.getElementById('message-text').textContent = 'You collected all the crystals! Amazing!';
        document.getElementById('game-message').classList.remove('hidden');
        document.getElementById('controls-info').classList.remove('visible');
        this.input.hideJoystick();
    }

    gameOver() {
        this.state.isPlaying = false;
        this.state.isGameOver = true;

        if (isMobile && navigator.vibrate) {
            navigator.vibrate(200);
        }

        document.getElementById('message-title').textContent = '💥 Game Over';
        document.getElementById('message-text').textContent = 'You hit an obstacle! Try again!';
        document.getElementById('game-message').classList.remove('hidden');
        document.getElementById('controls-info').classList.remove('visible');
        this.input.hideJoystick();
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (this.state.isGameOver) return;

        requestAnimationFrame(() => this.animate());

        // Calculate delta time for frame-rate independent movement
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 16.67, 3); // Cap at 3x normal frame
        this.lastTime = currentTime;

        const time = Date.now();

        // Update game elements
        this.updatePlayer(deltaTime);
        this.updateCamera();
        this.updateCrystals(time);
        this.updateObstacles(time);
        this.particleSystem.update();

        // Rotate starfield slowly
        if (this.starfield) {
            this.starfield.rotation.y += 0.0001;
        }

        // Render with post-processing
        this.composer.render();
    }
}

// ============================================
// Initialize Game
// ============================================
let game;

// Wait for DOM and hide loading screen
window.addEventListener('DOMContentLoaded', () => {
    // Create game instance
    game = new CrystalQuestGame();

    // Hide loading screen after a delay
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 2500);
});
