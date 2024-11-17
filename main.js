     //Variables
let scene, camera, renderer, controls, transformControls, orbitControls;
let currentMode = 'translate';
let selectedObject = null;
let copiedObject = null;
let cameras = [];
let currentCameraIndex = 0;
let undoStack = [];
let redoStack = [];

let recording = false;
let recordedFrames = [];
let raycaster;
let mouse;
let clock;
let animations = [];
let lights = [];
let disposables = new Set(); // For proper memory management

// Loaders
let hdriTexture = null;
let hdriBackground = null;
let textureLoader;
let gltfLoader;
let rgbeLoader;

function init() {
    // Initialize core components
    initScene();
    initCamera();
    initRenderer();
    initLoaders();
    initControls();
    initLighting();
    initEventListeners();
    initHelpers();

    // Start animation loop
    clock = new THREE.Clock();
    animate();

    // Initialize raycaster and mouse
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
}

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(1000, 1000, 0x333333, 0x333333);
    scene.add(gridHelper);
}

function initCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameras.push(camera);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.getElementById('container').appendChild(renderer.domElement);
}

function initLoaders() {
    textureLoader = new THREE.TextureLoader();
    gltfLoader = new GLTFLoader();
    rgbeLoader = new RGBELoader();
    rgbeLoader.setDataType(THREE.FloatType);
}

function cleanupObject(object) {
    if (!object) return;

    // Recursively cleanup children
    if (object.children) {
        object.children.forEach(child => cleanupObject(child));
    }

    // Dispose geometries
    if (object.geometry) {
        object.geometry.dispose();
    }

    // Dispose materials
    if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach(material => disposeMaterial(material));
        } else {
            disposeMaterial(object.material);
        }
    }
}

function disposeMaterial(material) {
    if (!material) return;

    // Dispose textures
    Object.keys(material).forEach(key => {
        if (material[key] && material[key].isTexture) {
            material[key].dispose();
        }
    });

    material.dispose();
}

function createLight(type, color = 0xffffff) {
    let light, helper;
    
    switch(type) {
        case 'ambient':
            light = new THREE.AmbientLight(color, 0.5);
            const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8);
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: color });
            helper = new THREE.Mesh(sphereGeometry, sphereMaterial);
            light.add(helper);
            break;

        case 'point':
            light = new THREE.PointLight(color, 1, 20);
            light.position.set(0, 2, 0);
            light.castShadow = true;
            helper = new THREE.PointLightHelper(light, 0.5);
            
            const pointLightGeometry = new THREE.IcosahedronGeometry(0.2, 2);
            const pointLightMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            const bulb = new THREE.Mesh(pointLightGeometry, pointLightMaterial);
            light.add(bulb);
            break;

        case 'spot':
            light = new THREE.SpotLight(color, 1);
            light.position.set(0, 5, 0);
            light.angle = Math.PI / 6;
            light.penumbra = 0.3;
            light.castShadow = true;
            helper = new THREE.SpotLightHelper(light);
            break;
    }

    if (light) {
        scene.add(light);
        if (helper) scene.add(helper);
        lights.push({ light, helper });
        updateHierarchy();
    }

    return light;
}

// Animation and Recording System
class AnimationManager {
    constructor() {
        this.animations = new Map();
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
    }

    addAnimation(object, properties, duration, easing = 'linear') {
        const animation = {
            object,
            startState: this.captureState(object),
            endState: { ...properties },
            duration,
            easing,
            startTime: this.currentTime
        };

        if (!this.animations.has(object.uuid)) {
            this.animations.set(object.uuid, []);
        }
        this.animations.get(object.uuid).push(animation);
        this.duration = Math.max(this.duration, this.currentTime + duration);
    }

    captureState(object) {
        return {
            position: object.position.clone(),
            rotation: object.rotation.clone(),
            scale: object.scale.clone()
        };
    }

    update(deltaTime) {
        if (!this.isPlaying) return;

        this.currentTime += deltaTime;

        this.animations.forEach((objectAnimations, uuid) => {
            objectAnimations.forEach(animation => {
                const progress = Math.min(
                    (this.currentTime - animation.startTime) / animation.duration,
                    1
                );

                if (progress < 1) {
                    this.interpolateProperties(
                        animation.object,
                        animation.startState,
                        animation.endState,
                        this.getEasingValue(progress, animation.easing)
                    );
                }
            });
        });

        if (this.currentTime >= this.duration) {
            this.stop();
        }
    }

    interpolateProperties(object, start, end, t) {
        if (end.position) {
            object.position.lerpVectors(start.position, end.position, t);
        }
        if (end.rotation) {
            object.rotation.x = THREE.MathUtils.lerp(start.rotation.x, end.rotation.x, t);
            object.rotation.y = THREE.MathUtils.lerp(start.rotation.y, end.rotation.y, t);
            object.rotation.z = THREE.MathUtils.lerp(start.rotation.z, end.rotation.z, t);
        }
        if (end.scale) {
            object.scale.lerpVectors(start.scale, end.scale, t);
        }
    }

    getEasingValue(t, easingName) {
        switch (easingName) {
            case 'easeInQuad': return t * t;
            case 'easeOutQuad': return t * (2 - t);
            case 'easeInOutQuad': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            default: return t;
        }
    }

    play() {
        this.isPlaying = true;
        this.currentTime = 0;
    }

    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
    }

    clear() {
        this.animations.clear();
        this.duration = 0;
        this.currentTime = 0;
        this.isPlaying = false;
    }
}

// Enhanced Material Management
class MaterialManager {
    constructor() {
        this.materials = new Map();
        this.presets = this.initializePresets();
    }

    initializePresets() {
        return {
            standard: {
                type: 'MeshStandardMaterial',
                properties: {
                    roughness: 0.7,
                    metalness: 0.3
                }
            },
            physical: {
                type: 'MeshPhysicalMaterial',
                properties: {
                    roughness: 0.5,
                    metalness: 0.5,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                }
            },
            glass: {
                type: 'MeshPhysicalMaterial',
                properties: {
                    roughness: 0,
                    transmission: 1,
                    thickness: 0.5,
                    transparent: true,
                    opacity: 0.5
                }
            },
            emissive: {
                type: 'MeshStandardMaterial',
                properties: {
                    emissive: 0xffffff,
                    emissiveIntensity: 1
                }
            }
        };
    }

    createMaterial(preset) {
        const config = this.presets[preset];
        if (!config) return null;

        let material;
        switch (config.type) {
            case 'MeshStandardMaterial':
                material = new THREE.MeshStandardMaterial();
                break;
            case 'MeshPhysicalMaterial':
                material = new THREE.MeshPhysicalMaterial();
                break;
            default:
                material = new THREE.MeshStandardMaterial();
        }

        Object.assign(material, config.properties);
        this.materials.set(material.uuid, material);
        return material;
    }

    updateMaterial(material, properties) {
        if (!material) return;
        Object.assign(material, properties);
        material.needsUpdate = true;
    }

    disposeMaterial(material) {
        if (!material) return;
        
        // Dispose textures
        for (const prop in material) {
            if (material[prop] && material[prop].isTexture) {
                material[prop].dispose();
            }
        }

        material.dispose();
        this.materials.delete(material.uuid);
    }
}

// Scene Hierarchy Management
class SceneHierarchy {
    constructor(scene) {
        this.scene = scene;
        this.selectedObject = null;
        this.hierarchyElement = document.getElementById('hierarchy');
    }

    updateHierarchy() {
        while (this.hierarchyElement.firstChild) {
            this.hierarchyElement.removeChild(this.hierarchyElement.firstChild);
        }
        this.buildHierarchyForObject(this.scene, this.hierarchyElement, 0);
    }

    buildHierarchyForObject(object, parentElement, level) {
        const item = document.createElement('div');
        item.style.marginLeft = `${level * 20}px`;
        item.classList.add('hierarchy-item');
        
        if (object === this.selectedObject) {
            item.classList.add('selected');
        }

        const name = object.name || object.type;
        item.textContent = name;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectObject(object);
        });

        parentElement.appendChild(item);

        object.children.forEach(child => {
            this.buildHierarchyForObject(child, parentElement, level + 1);
        });
    }

    selectObject(object) {
        this.selectedObject = object;
        this.updateHierarchy();
        if (transformControls) {
            transformControls.attach(object);
        }
        this.updateObjectProperties();
    }

    updateObjectProperties() {
        if (!this.selectedObject) return;
        
        const propertiesPanel = document.getElementById('properties');
        propertiesPanel.innerHTML = '';

        this.addPropertyControls(propertiesPanel, 'position');
        this.addPropertyControls(propertiesPanel, 'rotation');
        this.addPropertyControls(propertiesPanel, 'scale');

        if (this.selectedObject.material) {
            this.addMaterialControls(propertiesPanel);
        }
    }
}

// Advanced Camera System
class CameraManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.cameras = new Map();
        this.activeCamera = null;
        this.cameraHelpers = new Map();
    }

    createCamera(type, name, params = {}) {
        let camera;
        const defaultParams = {
            fov: 75,
            aspect: window.innerWidth / window.innerHeight,
            near: 0.1,
            far: 1000,
            position: new THREE.Vector3(0, 5, 10),
            lookAt: new THREE.Vector3(0, 0, 0)
        };

        const finalParams = { ...defaultParams, ...params };

        switch (type) {
            case 'perspective':
                camera = new THREE.PerspectiveCamera(
                    finalParams.fov,
                    finalParams.aspect,
                    finalParams.near,
                    finalParams.far
                );
                break;

            case 'orthographic':
                const width = window.innerWidth;
                const height = window.innerHeight;
                camera = new THREE.OrthographicCamera(
                    width / -2, width / 2,
                    height / 2, height / -2,
                    finalParams.near,
                    finalParams.far
                );
                break;

            default:
                throw new Error(`Unsupported camera type: ${type}`);
        }

        camera.position.copy(finalParams.position);
        camera.lookAt(finalParams.lookAt);
        camera.name = name;

        // Create camera helper
        const helper = new THREE.CameraHelper(camera);
        helper.visible = false;
        this.scene.add(helper);

        this.cameras.set(name, camera);
        this.cameraHelpers.set(name, helper);

        if (!this.activeCamera) {
            this.setActiveCamera(name);
        }

        return camera;
    }

    setActiveCamera(name) {
        const camera = this.cameras.get(name);
        if (!camera) throw new Error(`Camera ${name} not found`);

        this.activeCamera = camera;
        
        // Update helpers visibility
        this.cameraHelpers.forEach((helper, cameraName) => {
            helper.visible = (cameraName !== name);
        });

        // Update controls if they exist
        if (window.orbitControls) {
            orbitControls.object = camera;
            orbitControls.update();
        }

        return camera;
    }

    updateCameraAspect(width, height) {
        this.cameras.forEach(camera => {
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            } else if (camera instanceof THREE.OrthographicCamera) {
                camera.left = width / -2;
                camera.right = width / 2;
                camera.top = height / 2;
                camera.bottom = height / -2;
                camera.updateProjectionMatrix();
            }
        });
    }
}

// Enhanced Event Handler System
class EventManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.handlers = new Map();
        this.selectedObject = null;
        this.hoveredObject = null;
        this.isDragging = false;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    addHandler(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType).add(handler);
    }

    removeHandler(eventType, handler) {
        if (this.handlers.has(eventType)) {
            this.handlers.get(eventType).delete(handler);
        }
    }

    updateRaycaster(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
    }

    findIntersectedObject(event) {
        this.updateRaycaster(event);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        return intersects.length > 0 ? intersects[0].object : null;
    }

    onMouseDown(event) {
        this.isDragging = true;
        const intersectedObject = this.findIntersectedObject(event);
        
        if (intersectedObject) {
            this.selectedObject = intersectedObject;
            this.handlers.get('select')?.forEach(handler => 
                handler(this.selectedObject, event)
            );
        } else {
            this.selectedObject = null;
        }
    }

    onMouseMove(event) {
        const intersectedObject = this.findIntersectedObject(event);

        if (intersectedObject !== this.hoveredObject) {
            if (this.hoveredObject) {
                this.handlers.get('mouseout')?.forEach(handler => 
                    handler(this.hoveredObject, event)
                );
            }
            if (intersectedObject) {
                this.handlers.get('mouseover')?.forEach(handler => 
                    handler(intersectedObject, event)
                );
            }
            this.hoveredObject = intersectedObject;
        }

        if (this.isDragging && this.selectedObject) {
            this.handlers.get('drag')?.forEach(handler => 
                handler(this.selectedObject, event)
            );
        }
    }

    onMouseUp(event) {
        if (this.isDragging && this.selectedObject) {
            this.handlers.get('dragend')?.forEach(handler => 
                handler(this.selectedObject, event)
            );
        }
        this.isDragging = false;
    }

    onDoubleClick(event) {
        const intersectedObject = this.findIntersectedObject(event);
        if (intersectedObject) {
            this.handlers.get('dblclick')?.forEach(handler => 
                handler(intersectedObject, event)
            );
        }
    }

    onKeyDown(event) {
        this.handlers.get('keydown')?.forEach(handler => 
            handler(event)
        );
    }

    onKeyUp(event) {
        this.handlers.get('keyup')?.forEach(handler => 
            handler(event)
        );
    }
}

// Performance Optimization Manager
class PerformanceManager {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.stats = new Stats();
        this.levels = ['high', 'medium', 'low'];
        this.currentLevel = 'high';
        
        this.initializeStats();
    }

    initializeStats() {
        document.body.appendChild(this.stats.dom);
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.top = '0px';
        this.stats.dom.style.left = '0px';
    }

    setQualityLevel(level) {
        this.currentLevel = level;
        
        switch(level) {
            case 'low':
                this.renderer.setPixelRatio(1);
                this.renderer.shadowMap.enabled = false;
                break;
                
            case 'medium':
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFShadowMap;
                break;
                
            case 'high':
                this.renderer.setPixelRatio(window.devicePixelRatio);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                break;
        }

        this.updateSceneQuality(level);
    }

    updateSceneQuality(level) {
        this.scene.traverse(object => {
            if (object.isMesh) {
                switch(level) {
                    case 'low':
                        object.geometry = this.simplifyGeometry(object.geometry);
                        break;
                    case 'medium':
                        // Apply medium quality settings
                        break;
                    case 'high':
                        // Apply high quality settings
                        break;
                }
            }
        });
    }

    simplifyGeometry(geometry) {
        // Implement geometry simplification logic here
        return geometry;
    }

    update() {
        this.stats.update();
    }
}

// Object Transformation and Manipulation System
class TransformationManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.transformControls = new THREE.TransformControls(camera, renderer.domElement);
        this.selectedObject = null;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySteps = 50;

        this.initializeTransformControls();
    }

    initializeTransformControls() {
        this.scene.add(this.transformControls);
        
        this.transformControls.addEventListener('dragging-changed', event => {
            if (window.orbitControls) {
                orbitControls.enabled = !event.value;
            }
        });

        this.transformControls.addEventListener('objectChange', () => {
            if (this.selectedObject) {
                this.recordState();
            }
        });
    }

    setTransformMode(mode) {
        this.transformControls.setMode(mode); // 'translate', 'rotate', 'scale'
    }

    setSpace(space) {
        this.transformControls.setSpace(space); // 'local', 'world'
    }

    selectObject(object) {
        this.selectedObject = object;
        this.transformControls.attach(object);
        this.recordState();
    }

    deselectObject() {
        this.selectedObject = null;
        this.transformControls.detach();
    }

    recordState() {
        if (!this.selectedObject) return;

        const state = {
            position: this.selectedObject.position.clone(),
            rotation: this.selectedObject.rotation.clone(),
            scale: this.selectedObject.scale.clone()
        };

        // Remove future states if we're in the middle of the history
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Add new state
        this.history.push(state);
        this.historyIndex++;

        // Limit history size
        if (this.history.length > this.maxHistorySteps) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.applyState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.applyState(this.history[this.historyIndex]);
        }
    }

    applyState(state) {
        if (!this.selectedObject || !state) return;

        this.selectedObject.position.copy(state.position);
        this.selectedObject.rotation.copy(state.rotation);
        this.selectedObject.scale.copy(state.scale);
    }
}

// Scene Export/Import System
class SceneSerializer {
    constructor(scene) {
        this.scene = scene;
    }

    exportScene() {
        const sceneData = {
            metadata: {
                version: 1.0,
                type: 'Scene',
                generator: 'SceneSerializer'
            },
            objects: [],
            materials: [],
            textures: []
        };

        const materialsMap = new Map();
        const texturesMap = new Map();

        this.scene.traverse(object => {
            if (object.type === 'Scene') return;

            const objectData = {
                uuid: object.uuid,
                type: object.type,
                name: object.name,
                position: object.position.toArray(),
                rotation: object.rotation.toArray(),
                scale: object.scale.toArray(),
                visible: object.visible,
                userData: object.userData
            };

            if (object.isMesh) {
                objectData.geometry = this.serializeGeometry(object.geometry);
                if (object.material) {
                    const materialIndex = this.serializeMaterial(
                        object.material, 
                        materialsMap, 
                        texturesMap,
                        sceneData
                    );
                    objectData.materialIndex = materialIndex;
                }
            }

            sceneData.objects.push(objectData);
        });

        return JSON.stringify(sceneData, null, 2);
    }

    serializeGeometry(geometry) {
        return {
            type: geometry.type,
            parameters: geometry.parameters,
            attributes: {
                position: Array.from(geometry.attributes.position.array),
                normal: geometry.attributes.normal ? 
                    Array.from(geometry.attributes.normal.array) : undefined,
                uv: geometry.attributes.uv ? 
                    Array.from(geometry.attributes.uv.array) : undefined
            }
        };
    }

    serializeMaterial(material, materialsMap, texturesMap, sceneData) {
        if (materialsMap.has(material.uuid)) {
            return materialsMap.get(material.uuid);
        }

        const materialData = {
            uuid: material.uuid,
            type: material.type,
            color: material.color?.getHex(),
            roughness: material.roughness,
            metalness: material.metalness,
            emissive: material.emissive?.getHex(),
            emissiveIntensity: material.emissiveIntensity,
            opacity: material.opacity,
            transparent: material.transparent,
            side: material.side
        };

        const materialIndex = sceneData.materials.length;
        materialsMap.set(material.uuid, materialIndex);
        sceneData.materials.push(materialData);

        // Handle textures
        if (material.map) {
            materialData.mapIndex = this.serializeTexture(
                material.map, 
                texturesMap, 
                sceneData
            );
        }

        return materialIndex;
    }

    serializeTexture(texture, texturesMap, sceneData) {
        if (texturesMap.has(texture.uuid)) {
            return texturesMap.get(texture.uuid);
        }

        const textureData = {
            uuid: texture.uuid,
            name: texture.name,
            image: texture.source.data.src,
            repeat: texture.repeat.toArray(),
            offset: texture.offset.toArray(),
            wrap: [texture.wrapS, texture.wrapT],
            minFilter: texture.minFilter,
            magFilter: texture.magFilter
        };

        const textureIndex = sceneData.textures.length;
        texturesMap.set(texture.uuid, textureIndex);
        sceneData.textures.push(textureData);

        return textureIndex;
    }

    async importScene(jsonData) {
        const sceneData = JSON.parse(jsonData);
        
        // Clear existing scene
        while(this.scene.children.length > 0) { 
            this.scene.remove(this.scene.children[0]); 
        }

        // Create materials and textures first
        const materials = await this.createMaterials(sceneData);

        // Create and add objects
        for (const objectData of sceneData.objects) {
            const object = await this.createObject(objectData, materials);
            if (object) {
                this.scene.add(object);
            }
        }

        return this.scene;
    }

    async createMaterials(sceneData) {
        const materials = [];
        const textures = new Map();

        // Create textures first
        for (const textureData of sceneData.textures) {
            const texture = await this.createTexture(textureData);
            textures.set(textureData.uuid, texture);
        }

        // Create materials
        for (const materialData of sceneData.materials) {
            const material = this.createMaterial(materialData, textures);
            materials.push(material);
        }

        return materials;
    }

    async createTexture(textureData) {
        return new Promise((resolve) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(textureData.image, (texture) => {
                texture.uuid = textureData.uuid;
                texture.name = textureData.name;
                texture.repeat.fromArray(textureData.repeat);
                texture.offset.fromArray(textureData.offset);
                texture.wrapS = textureData.wrap[0];
                texture.wrapT = textureData.wrap[1];
                texture.minFilter = textureData.minFilter;
                texture.magFilter = textureData.magFilter;
                resolve(texture);
            });
        });
    }

    createMaterial(materialData, textures) {
        let material;

        switch(materialData.type) {
            case 'MeshStandardMaterial':
                material = new THREE.MeshStandardMaterial();
                break;
            case 'MeshPhysicalMaterial':
                material = new THREE.MeshPhysicalMaterial();
                break;
            default:
                material = new THREE.MeshBasicMaterial();
        }

        // Apply material properties
        if (materialData.color !== undefined) {
            material.color.setHex(materialData.color);
        }
        if (materialData.emissive !== undefined) {
            material.emissive.setHex(materialData.emissive);
        }

        Object.assign(material, {
            roughness: materialData.roughness,
            metalness: materialData.metalness,
            emissiveIntensity: materialData.emissiveIntensity,
            opacity: materialData.opacity,
            transparent: materialData.transparent,
            side: materialData.side
        });

        // Apply textures
        if (materialData.mapIndex !== undefined) {
            material.map = textures.get(materialData.mapIndex);
        }

        material.uuid = materialData.uuid;
        material.needsUpdate = true;

        return material;
    }

    async createObject(objectData, materials) {
        let object;

        if (objectData.type === 'Mesh') {
            const geometry = this.recreateGeometry(objectData.geometry);
            const material = materials[objectData.materialIndex];
            object = new THREE.Mesh(geometry, material);
        }
        // Add other object types as needed

        if (object) {
            object.uuid = objectData.uuid;
            object.name = objectData.name;
            object.position.fromArray(objectData.position);
            object.rotation.fromArray(objectData.rotation);
            object.scale.fromArray(objectData.scale);
            object.visible = objectData.visible;
            object.userData = objectData.userData;
        }

        return object;
    }

    recreateGeometry(geometryData) {
        let geometry;

        switch(geometryData.type) {
            case 'BoxGeometry':
            case 'SphereGeometry':
            case 'PlaneGeometry':
                geometry = new THREE[geometryData.type](...Object.values(geometryData.parameters));
                break;
            default:
                geometry = new THREE.BufferGeometry();
                // Recreate attributes
                if (geometryData.attributes.position) {
                    geometry.setAttribute('position', 
                        new THREE.Float32BufferAttribute(geometryData.attributes.position, 3));
                }
                if (geometryData.attributes.normal) {
                    geometry.setAttribute('normal',
                        new THREE.Float32BufferAttribute(geometryData.attributes.normal, 3));
                }
                if (geometryData.attributes.uv) {
                    geometry.setAttribute('uv',
                        new THREE.Float32BufferAttribute(geometryData.attributes.uv, 2));
                }
        }

        return geometry;
    }
}
