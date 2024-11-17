    let  scene, camera, renderer, controls, transformControls, orbitControls;

       let currentMode = 'translate';
        let selectedObject = null;
        let copiedObject = null;
        let cameras = [];
        let currentCameraIndex = 0;
        let undoStack = [];
        let redoStack = [];
        
       
        let recording = false;
        let recordedFrames = [];
        let raycaster = new THREE.Raycaster();
        let mouse = new THREE.Vector2();
        let clock = new THREE.Clock();
        let animations = [];

        // إضافة متغيرات جديدة
        let hdriTexture = null;
        let hdriBackground = null;
        let textureLoader = new THREE.TextureLoader();
        let gltfLoader = new THREE.GLTFLoader();
        
        let rgbeLoader = new THREE.RGBELoader();
        

        init();
        animate();

        function init() {
            // إعداد المشهد
            scene = new THREE.Scene();
            
            scene.background = new THREE.Color(0x222222);

            // إعداد مستوى أرضي
            const gridHelper = new THREE.GridHelper(1000, 1000, 0x333333, 0x333333);
            scene.add(gridHelper);

            // إعداد الكاميرا
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(5, 5, 5);
            camera.lookAt(0, 0, 0);

            // إعداد المحرك
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            document.getElementById('container').appendChild(renderer.domElement);

            // إعداد الإضاءة الافتراضية
            setupDefaultLighting();

            // إعداد أدوات التحكم
            setupControls();

            // إعداد مستمعي الأحداث
            setupEventListeners();
            // إضافة مستمعي الأحداث الجديدة
            setupAdditionalEventListeners();
            
            // إعداد HDRI الافتراضي
            loadDefaultHDRI();

            // Initialize material presets
             initializeMaterialPresets();

            // تحديث الحجم عند تغيير حجم النافذة
            window.addEventListener('resize', onWindowResize, false);
        }
        
        function setupEventListeners() {
            // أزرار الأدوات
            document.getElementById('addCube').addEventListener('click', () => addGeometry('cube'));
            document.getElementById('addSphere').addEventListener('click', () => addGeometry('sphere'));
            document.getElementById('addCylinder').addEventListener('click', () => addGeometry('cylinder'));
            document.getElementById('addPlane').addEventListener('click', () => addGeometry('plane'));
            document.getElementById('addTorus').addEventListener('click', () => addGeometry('torus'));

            // أزرار الإضاءة
            document.getElementById('addPointLight').addEventListener('click', () => addLight('point'));
            document.getElementById('addSpotLight').addEventListener('click', () => addLight('spot'));
            document.getElementById('addAmbientLight').addEventListener('click', () => addLight('ambient'));

            // أزرار التحويل
            document.getElementById('translate').addEventListener('click', () => setTransformMode('translate'));
            document.getElementById('rotate').addEventListener('click', () => setTransformMode('rotate'));
            document.getElementById('scale').addEventListener('click', () => setTransformMode('scale'));

            // أزرار التسجيل
            document.getElementById('startRecord').addEventListener('click', startRecording);
            document.getElementById('stopRecord').addEventListener('click', stopRecording);
            document.getElementById('playRecord').addEventListener('click', playRecording);


            // مستمع النقر على المشهد
            renderer.domElement.addEventListener('click', onMouseClick);
        }

        function setupAdditionalEventListeners() {
            // مستمعي أحداث HDRI
            document.getElementById('hdriSelect').addEventListener('change', handleHDRIChange);
            document.getElementById('customHdri').addEventListener('change', handleCustomHDRI);

            // Files Events Listeners
            document.getElementById('copyObject').addEventListener('click', copySelectedObject);
            document.getElementById('pasteObject').addEventListener('click', pasteObject);
            document.getElementById('deleteObject').addEventListener('click', deleteSelectedObject);
            document.getElementById('undo').addEventListener('click', undo);
            document.getElementById('redo').addEventListener('click', redo);
            document.getElementById('glbLoader').addEventListener('change', loadGLBModel);
            document.getElementById('textureLoader').addEventListener('change', loadTexture);

            // Camera Events Listeners
            document.getElementById('addCamera').addEventListener('click', addCamera);
            document.getElementById('switchCamera').addEventListener('click', switchCamera);
            document.getElementById('cameraSelect').addEventListener('change', changeCameraType);
        }

        // Material Presets Library
        function initializeMaterialPresets() {
            // Material Presets Library
            const MaterialPresets = {
                // Metals
                chrome: {
                    type: 'physical',
                    color: 0xffffff,
                    metalness: 1.0,
                    roughness: 0.1,
                    envMapIntensity: 1.0,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                },
                brushedMetal: {
                    type: 'physical',
                    color: 0x888888,
                    metalness: 0.9,
                    roughness: 0.4,
                    envMapIntensity: 0.8,
                    clearcoat: 0.3
                },
                // Glass
                clearGlass: {
                    type: 'physical',
                    color: 0xffffff,
                    metalness: 0,
                    roughness: 0,
                    transmission: 1.0,
                    thickness: 0.5,
                    envMapIntensity: 1.0,
                    clearcoat: 1.0,
                    transparent: true,
                    opacity: 0.3
                },
                // Wood
                polishedWood: {
                    type: 'physical',
                    color: 0x663300,
                    metalness: 0,
                    roughness: 0.3,
                    clearcoat: 0.3,
                    clearcoatRoughness: 0.2
                }
                // Add more presets as needed
            };
        
            window.MaterialPresets = MaterialPresets; // Make it globally accessible
        }
        

        function createAdvancedMaterial(presetName) {
            const preset = MaterialPresets[presetName];
            let material;
        
            switch(preset.type) {
                case 'physical':
                    material = new THREE.MeshPhysicalMaterial();
                    break;
                case 'toon':
                    material = new THREE.MeshToonMaterial();
                    break;
                default:
                    material = new THREE.MeshStandardMaterial();
            }
        
            // Apply preset properties
            Object.keys(preset).forEach(key => {
                if (key !== 'type') {
                    material[key] = preset[key];
                }
            });
        
            // Set environment map if available
            if (hdriTexture) {
                material.envMap = hdriTexture;
            }
        
            return material;
        }

        function applyMaterialPreset(object, presetName) {
            if (!object) return;
            
            const material = createAdvancedMaterial(presetName);
            
            if (object.material) {
                // Dispose of old material to free memory
                object.material.dispose();
            }
            
            object.material = material;
            object.material.needsUpdate = true;
        }
        
        // Add this function to create the material preset UI
        function createMaterialPresetUI() {
            const container = document.getElementById('material-presets');
            
            Object.keys(MaterialPresets).forEach(presetName => {
                const button = document.createElement('button');
                button.textContent = presetName.replace(/([A-Z])/g, ' $1').trim(); // Add spaces before capital letters
                button.onclick = () => {
                    if (selectedObject) {
                        applyMaterialPreset(selectedObject, presetName);
                        updateMaterialEditor();
                    }
                };
                container.appendChild(button);
            });
        }

        function loadDefaultHDRI() {
            rgbeLoader.load('path_to_default_hdri.hdr', (texture) => {
                hdriTexture = texture;
                hdriTexture.mapping = THREE.EquirectangularReflectionMapping;
                scene.background = hdriTexture;
                scene.environment = hdriTexture;
            });
        }

        function handleHDRIChange(event) {
            const hdriPath = `path_to_${event.target.value}_hdri.hdr`;
            rgbeLoader.load(hdriPath, (texture) => {
                hdriTexture = texture;
                hdriTexture.mapping = THREE.EquirectangularReflectionMapping;
                scene.background = hdriTexture;
                scene.environment = hdriTexture;
            });
        }

        function handleCustomHDRI(event) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                rgbeLoader.load(e.target.result, (texture) => {
                    hdriTexture = texture;
                    hdriTexture.mapping = THREE.EquirectangularReflectionMapping;
                    scene.background = hdriTexture;
                    scene.environment = hdriTexture;
                });
            };
            reader.readAsDataURL(file);
        }

        function copySelectedObject() {
            if (!selectedObject) return;
            copiedObject = selectedObject.clone();
        }

        function pasteObject() {
            if (!copiedObject) return;
            const newObject = copiedObject.clone();
            newObject.position.add(new THREE.Vector3(1, 0, 1));
            scene.add(newObject);
            setSelectedObject(newObject);
            updateHierarchy();
            addToUndoStack();
        }

        function deleteSelectedObject() {
            if (!selectedObject) return;
            scene.remove(selectedObject);
            selectedObject = null;
            transformControls.detach();
            updateHierarchy();
            addToUndoStack();
        }

        function loadGLBModel(event) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                gltfLoader.load(e.target.result, (gltf) => {
                    const model = gltf.scene;    
                    scene.add(model);
                    setSelectedObject(model);
                    updateHierarchy();
                    addToUndoStack();
                });
            };
            
            reader.readAsDataURL(file);
        }

        
        
        

        function loadTexture(event) {
            if (!selectedObject || !selectedObject.material) return;
            
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                const texture = textureLoader.load(e.target.result);
                selectedObject.material.map = texture;
                selectedObject.material.needsUpdate = true;
            };
            reader.readAsDataURL(file);
        }

       

        function switchCamera() {
            if (cameras.length === 0) return;
            currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
            camera = cameras[currentCameraIndex];
            transformControls.camera = camera;
            controls.object = camera;
        }

        function changeCameraType(event) {
            const type = event.target.value;
            const aspect = window.innerWidth / window.innerHeight;
            
            if (type === 'orthographic') {
                camera = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 1000);
            } else {
                camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
            }
            
            camera.position.set(5, 5, 5);
            camera.lookAt(0, 0, 0);
            transformControls.camera = camera;
            controls.object = camera;
        }

        function addToUndoStack() {
            undoStack.push(scene.clone());
            redoStack = [];
        }

        function undo() {
            if (undoStack.length === 0) return;
            redoStack.push(scene.clone());
            scene = undoStack.pop();
            updateHierarchy();
        }

        function redo() {
            if (redoStack.length === 0) return;
            undoStack.push(scene.clone());
            scene = redoStack.pop();
            updateHierarchy();
        }

        function initCameraControls() {
            // Replace the basic OrbitControls initialization with enhanced controls
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.05;
            orbitControls.screenSpacePanning = true;
            
            transformControls = new TransformControls(camera, renderer.domElement);
            transformControls.addEventListener('dragging-changed', function(event) {
                orbitControls.enabled = !event.value;
            });
            
            scene.add(transformControls);
        }

        function setupDefaultLighting() {
            const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
            ambientLight.position.set(5, 5, 5);
            scene.add(ambientLight);
        
              // Hemisphere Light for better sky/ground lighting
               const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
               scene.add(hemisphereLight);

            // Main Directional Light (sun-like)
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 5, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 500;
            directionalLight.shadow.camera.left = -10;
            directionalLight.shadow.camera.right = 10;
            directionalLight.shadow.camera.top = 10;
            directionalLight.shadow.camera.bottom = -10;
            directionalLight.shadow.bias = -0.0001;
    
            
            scene.add(directionalLight);
        }
        
        function setupControls() {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
        
            transformControls = new THREE.TransformControls(camera, renderer.domElement);
            transformControls.addEventListener('dragging-changed', function(event) {
                controls.enabled = !event.value;
            });
            scene.add(transformControls);
        }
        

        
        function addGeometry(type) {
            let geometry, material, mesh;
        
            const materials = new THREE.MeshStandardMaterial({
                color: 0x888888,
                metalness: 0.8,
                roughness: 0.8,
            });
        
            switch(type) {
                case 'cube':
                    geometry = new THREE.BoxGeometry(1, 1, 1);
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(0.5, 32, 32);
                    break;
                case 'cylinder':
                    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
                    break;
                case 'plane':
                    geometry = new THREE.PlaneGeometry(1, 1);
                    break;
                case 'torus':
                    geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
                    break;
            }
        
            
            mesh = new THREE.Mesh(geometry, materials);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            setSelectedObject(mesh);
            updateHierarchy();
        }
        

      
        function setTransformMode(mode) {
            if (transformControls.object) {
                transformControls.setMode(mode);
                document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
                document.getElementById(mode).classList.add('active');
            }
        }

        function setSelectedObject(object) {
            selectedObject = object;
            transformControls.attach(object);
            updateProperties();
            updateMaterialEditor();
        }

        function updateProperties() {
            if (!selectedObject) return;

            document.getElementById('posX').value = selectedObject.position.x.toFixed(3);
            document.getElementById('posY').value = selectedObject.position.y.toFixed(3);
            document.getElementById('posZ').value = selectedObject.position.z.toFixed(3);

            document.getElementById('rotX').value = selectedObject.rotation.x.toFixed(3);
            document.getElementById('rotY').value = selectedObject.rotation.y.toFixed(3);
            document.getElementById('rotZ').value = selectedObject.rotation.z.toFixed(3);

            document.getElementById('scaleX').value = selectedObject.scale.x.toFixed(3);
            document.getElementById('scaleY').value = selectedObject.scale.y.toFixed(3);
            document.getElementById('scaleZ').value = selectedObject.scale.z.toFixed(3);
        }

       
        function updateHierarchy() {
            const container = document.getElementById('hierarchy-content');
            container.innerHTML = '';
            
            scene.traverse(object => {
                if (object.type === 'Mesh' || object.type.includes('Light')) {
                    const div = document.createElement('div');
                    div.className = 'hierarchy-item';
                    div.textContent = `${object.type} ${object.id}`;
                    div.onclick = () => setSelectedObject(object);
                    container.appendChild(div);
                }
            });
        }

        function onMouseClick(event) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);

            if (intersects.length > 0) {
                setSelectedObject(intersects[0].object);
            }
        }

        function startRecording() {
            recording = true;
            recordedFrames = [];
            document.getElementById('startRecord').classList.add('active');
        }

        function stopRecording() {
            recording = false;
            document.getElementById('startRecord').classList.remove('active');
        }

        function playRecording() {
            if (recordedFrames.length === 0) return;

            let frameIndex = 0;
            const playInterval = setInterval(() => {
                if (frameIndex >= recordedFrames.length) {
                    clearInterval(playInterval);
                    return;
                }

                const frame = recordedFrames[frameIndex];
                camera.position.copy(frame.cameraPosition);
                camera.rotation.copy(frame.cameraRotation);
                frameIndex++;
            }, 1000 / 60);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);

            if (recording) {
                recordedFrames.push({
                    cameraPosition: camera.position.clone(),
                    cameraRotation: camera.rotation.clone()
                });
            }

            controls.update();
            
            // تحديث معلومات العرض
            const info = document.getElementById('viewport-info');
            info.textContent = `
                FPS: ${Math.round(1 / clock.getDelta())}
                Objects: ${scene.children.length}
                Polygons: ${renderer.info.render.triangles}
            `;
  
           
            renderer.render(scene, camera);
        }

        const lights = [];
        function createCamera(type = 'perspective', fov = 75) {
            const aspect = window.innerWidth / window.innerHeight;
            let newCamera;
            
            if (type === 'orthographic') {
                const frustumSize = 10;
                newCamera = new THREE.OrthographicCamera(
                    -frustumSize * aspect, frustumSize * aspect,
                    frustumSize, -frustumSize,
                    0.1, 1000
                );
            } else {
                newCamera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
            }
        
            // إضافة helper للكاميرا
            const cameraHelper = new THREE.CameraHelper(newCamera);
            scene.add(cameraHelper);
            
            // إضافة أدوات تحكم خاصة بالكاميرا
            const cameraControls = new THREE.TransformControls(camera, renderer.domElement);
            cameraControls.attach(newCamera);
            
            return {
                camera: newCamera,
                helper: cameraHelper,
                controls: cameraControls
            };
        }
        
        function addCamera() {
            const cameraObj = createCamera();
            const newCamera = cameraObj.camera;
            newCamera.position.set(5, 5, 5);
            newCamera.lookAt(0, 0, 0);
            
            cameras.push({
                camera: newCamera,
                helper: cameraObj.helper,
                controls: cameraObj.controls
            });
            
            scene.add(newCamera);
            scene.add(cameraObj.controls);
            updateHierarchy();
        }


        function createLight(type, color = 0xffffff) {
            let light, helper;
            
            switch(type) {
                case 'ambient':
                    light = new THREE.AmbientLight(color, 0.5);
                    // Create a visual representation for ambient light
                    const sphere = new THREE.SphereGeometry(0.2, 8, 8);
                    const material = new THREE.MeshBasicMaterial({ color: color });
                    helper = new THREE.Mesh(sphere, material);
                    light.add(helper);
                break;
                case 'point':
                    light = new THREE.PointLight(color, 1, 100);
                    helper = new THREE.PointLightHelper(light, 0.5);
                break;
                    
                case 'spot':
                    light = new THREE.SpotLight(color, 1);
                    light.angle = Math.PI / 4;
                    light.penumbra = 0.1;
                    helper = new THREE.SpotLightHelper(light);
                break;
                    
                case 'directional':
                    light = new THREE.DirectionalLight(color, 1);
                    helper = new THREE.DirectionalLightHelper(light, 1);
                break;
                
                case 'area':
                    light = new THREE.RectAreaLight(color, 1, 10, 10);
                    helper = new THREE.RectAreaLightHelper(light);
                break;
            }
            
              // إضافة خصائص متقدمة
              light.castShadow = true;
              light.shadow.mapSize.width = 2048;
              light.shadow.mapSize.height = 2048;
              
              // إضافة rays للإضاءة
              const rayGeometry = new THREE.CylinderGeometry(0, 0.1, 1, 8);
              const rayMaterial = new THREE.MeshBasicMaterial({
                  color: color,
                  transparent: true,
                  opacity: 0.3
              });
              const rays = new THREE.Mesh(rayGeometry, rayMaterial);
              rays.scale.y = light.distance || 10;
              
              light.rays = rays;
              light.add(rays);
              
              return { light, helper };
        }
        
       // Add this function to handle light creation and addition to scene
       function addLight(type) {
        const { light, helper } = createLight(type);
        light.position.set(0, 5, 0);
        scene.add(light);
        scene.add(helper);
        
        // إضافة أدوات تحكم للإضاءة
        const lightControls = new THREE.TransformControls(camera, renderer.domElement);
        lightControls.attach(light);
        scene.add(lightControls);
        
        // إضافة GUI للتحكم في خصائص الإضاءة
        addLightControls(light);
        
        setSelectedObject(light);
        updateHierarchy();
       }

        // Add light controls to GUI
        function addLightControls(light) {
            const lightFolder = gui.addFolder(`Light ${light.id}`);
            
            lightFolder.addColor(light, 'color');
            lightFolder.add(light, 'intensity', 0, 10);
            
            if (light.distance) {
                lightFolder.add(light, 'distance', 0, 100).onChange(() => {
                    light.rays.scale.y = light.distance;
                });
            }
            
            if (light.angle) {
                lightFolder.add(light, 'angle', 0, Math.PI / 2);
            }
            
            if (light.penumbra) {
                lightFolder.add(light, 'penumbra', 0, 1);
            }
            
            lightFolder.open();
        }

        

        function createMaterial(type = 'standard') {
            let material;
            
            switch(type) {
                case 'standard':
                    material = new THREE.MeshStandardMaterial({
                        color: 0xcccccc,
                        metalness: 0.5,
                        roughness: 0.5,
                        envMap: hdriTexture
                    });
                    break;
                    
                case 'physical':
                    material = new THREE.MeshPhysicalMaterial({
                        color: 0xcccccc,
                        metalness: 0.5,
                        roughness: 0.5,
                        clearcoat: 0.3,
                        clearcoatRoughness: 0.25,
                        envMap: hdriTexture
                    });
                    break;
            }
            
            return material;
        }
        
        //Material Editor
        function updateMaterialEditor() {
            if (!selectedObject || !selectedObject.material) return;
            
            const material = selectedObject.material;
            const materialFolder = gui.addFolder('Material');
            
            // Add basic properties
            materialFolder.addColor(material, 'color');
            
            if (material.metalness !== undefined) materialFolder.add(material, 'metalness', 0, 1);
            if (material.roughness !== undefined) materialFolder.add(material, 'roughness', 0, 1);
            if (material.transmission !== undefined) materialFolder.add(material, 'transmission', 0, 1);
            if (material.clearcoat !== undefined) materialFolder.add(material, 'clearcoat', 0, 1);
            if (material.clearcoatRoughness !== undefined) materialFolder.add(material, 'clearcoatRoughness', 0, 1);
            if (material.sheen !== undefined) materialFolder.add(material, 'sheen', 0, 1);
            if (material.sheenRoughness !== undefined) materialFolder.add(material, 'sheenRoughness', 0, 1);
            if (material.opacity !== undefined) materialFolder.add(material, 'opacity', 0, 1);
            if (material.ior !== undefined) materialFolder.add(material, 'ior', 1, 2.333);
            
            materialFolder.open();
        }
      
        
        function addMaterialMaps(material, folder) {
            const mapTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];
            
            mapTypes.forEach(mapType => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    
                    reader.onload = function(event) {
                        const texture = textureLoader.load(event.target.result);
                        material[mapType] = texture;
                        material.needsUpdate = true;
                    };
                    
                    reader.readAsDataURL(file);
                };
                
                folder.add({ [mapType]: () => input.click() }, mapType);
            });
        }

        //<--New tools--->
        let subdivisionLevel = 0;
        sculptMode = false;
        let sculptBrushSize = 0.2;
        let sculptBrushStrength = 0.5;
        let sculptDeformation = new THREE.Vector3();
        let vertexSelected = null;
        let modifierMode = 'none';
        let symmetryEnabled = false;
        let symmetryAxis = 'x';
        let brushFalloff = 'smooth'; // smooth, linear, constant

        // Add sculpting functions
        function initSculpting() {
            const sculptFolder = gui.addFolder('Sculpt Tools');
            sculptFolder.add({ sculptMode: false }, 'sculptMode').onChange(value => {
                sculptMode = value;
            });
            sculptFolder.add({ brushSize: sculptBrushSize }, 'brushSize', 0.1, 1).onChange(value => {
                sculptBrushSize = value;
            });
            sculptFolder.add({ brushStrength: sculptBrushStrength }, 'brushStrength', 0.1, 1).onChange(value => {
                sculptBrushStrength = value;
            });
        }

        function applySculpting(intersection) {
            if (!sculptMode || !selectedObject) return;
            
            const position = intersection.point;
            const normal = intersection.face.normal;
            const vertices = selectedObject.geometry.vertices;
            
            for (let i = 0; i < vertices.length; i++) {
                const distance = position.distanceTo(vertices[i]);
                if (distance < sculptBrushSize) {
                    const influence = 1 - (distance / sculptBrushSize);
                    vertices[i].add(normal.multiplyScalar(sculptBrushStrength * influence));
                }
            }
            
            selectedObject.geometry.verticesNeedUpdate = true;
            selectedObject.geometry.computeVertexNormals();
        }

        // حفظ الحالة للتراجع
        function saveState(mesh) {
            if (undoStack.length >= 20) undoStack.shift(); // حد أقصى 20 خطوة
            undoStack.push({
                positions: mesh.geometry.attributes.position.array.slice(),
                normals: mesh.geometry.attributes.normal.array.slice()
            });
            redoStack = []; // مسح redo عند كل تعديل جديد
        }

        // دالة إنشاء شبكة قابلة للتقسيم
        function createSubdivisionMesh(geometry) {
            const modifier = new THREE.SubdivisionModifier();
            
            const smoothGeometry = geometry.clone();
            // تحويل الهندسة إلى BufferGeometry إذا لم تكن كذلك
            if (!(smoothGeometry instanceof THREE.BufferGeometry)) {
                smoothGeometry = new THREE.BufferGeometry().fromGeometry(smoothGeometry);
            }
            
            // إضافة خاصية للتتبع النقاط الأصلية
            smoothGeometry.originalPositions = smoothGeometry.attributes.position.array.slice();
            
            return new THREE.Mesh(
                smoothGeometry,
                new THREE.MeshStandardMaterial({
                    color: 0xcccccc,
                    wireframe: false,
                    flatShading: false
                })
            );
        }

        //na7t
        function applySculpting(mesh, point, normal, mode) {
            saveState(mesh);
            
            const positions = mesh.geometry.attributes.position;
            const normals = mesh.geometry.attributes.normal;
            const vertices = [];
            
            // دالة تأثير محسنة
            function getFalloff(distance) {
                const normalized = Math.min(1, distance / sculptBrushSize);
                switch(brushFalloff) {
                    case 'smooth':
                        return Math.cos(normalized * Math.PI) * 0.5 + 0.5;
                    case 'linear':
                        return 1 - normalized;
                    case 'constant':
                        return distance < sculptBrushSize ? 1 : 0;
                    default:
                        return 1 - normalized;
                }
            }
            
            // تجميع النقاط المتأثرة للمعالجة الجماعية
            for (let i = 0; i < positions.count; i++) {
                const vertex = new THREE.Vector3();
                vertex.fromBufferAttribute(positions, i);
                
                const distance = point.distanceTo(vertex);
                if (distance < sculptBrushSize) {
                    vertices.push({
                        index: i,
                        vertex: vertex,
                        distance: distance,
                        normal: new THREE.Vector3().fromBufferAttribute(normals, i)
                    });
                }
                
                // إضافة النقاط المتناظرة إذا كان التناظر مفعل
                if (symmetryEnabled) {
                    const symmetricVertex = vertex.clone();
                    symmetricVertex[symmetryAxis] *= -1;
                    
                    const symmetricDistance = point.distanceTo(symmetricVertex);
                    if (symmetricDistance < sculptBrushSize) {
                        vertices.push({
                            index: i,
                            vertex: symmetricVertex,
                            distance: symmetricDistance,
                            normal: new THREE.Vector3().fromBufferAttribute(normals, i)
                        });
                    }
                }
            }
            
            // تطبيق التأثير على كل النقاط المجمعة
            vertices.forEach(vertexData => {
                const influence = getFalloff(vertexData.distance) * sculptBrushStrength;
                
                switch(mode) {
                    case 'sculpt':
                        vertexData.vertex.add(
                            vertexData.normal.multiplyScalar(influence)
                        );
                        break;
                        
                    case 'smooth':
                        const neighbors = findNeighborVertices(mesh, vertexData.index);
                        const avgPosition = calculateAveragePosition(mesh, neighbors);
                        vertexData.vertex.lerp(avgPosition, influence);
                        break;
                        
                    case 'inflate':
                        vertexData.vertex.add(normal.multiplyScalar(influence));
                        break;
                        
                    case 'pinch':
                        const toCenter = point.clone().sub(vertexData.vertex);
                        vertexData.vertex.add(toCenter.multiplyScalar(influence));
                        break;
                        
                    case 'flatten':
                        const projectedPoint = projectOnPlane(vertexData.vertex, point, normal);
                        vertexData.vertex.lerp(projectedPoint, influence);
                        break;
                }
                
                positions.setXYZ(
                    vertexData.index,
                    vertexData.vertex.x,
                    vertexData.vertex.y,
                    vertexData.vertex.z
                );
            });
            
            positions.needsUpdate = true;
            mesh.geometry.computeVertexNormals();
        }
        
        // دالة مساعدة لإسقاط نقطة على مستوى
        function projectOnPlane(point, planePoint, planeNormal) {
            const vec = new THREE.Vector3();
            vec.subVectors(point, planePoint);
            const dist = vec.dot(planeNormal);
            return point.clone().sub(planeNormal.multiplyScalar(dist));
        }

        // دالة لحساب متوسط موقع النقاط المجاورة
        function calculateAveragePosition(mesh, vertices) {
            const positions = mesh.geometry.attributes.position;
            const avg = new THREE.Vector3();
            let count = 0;
            
            vertices.forEach(idx => {
                const vertex = new THREE.Vector3();
                vertex.fromBufferAttribute(positions, idx);
                avg.add(vertex);
                count++;
            });
            
            return count > 0 ? avg.divideScalar(count) : avg;
        }

        // إضافة وظائف التراجع وإعادة التنفيذ
        function undo(mesh) {
            if (undoStack.length === 0) return;
            
            const state = undoStack.pop();
            redoStack.push({
                positions: mesh.geometry.attributes.position.array.slice(),
                normals: mesh.geometry.attributes.normal.array.slice()
            });
            
            mesh.geometry.attributes.position.array.set(state.positions);
            mesh.geometry.attributes.normal.array.set(state.normals);
            mesh.geometry.attributes.position.needsUpdate = true;
            mesh.geometry.attributes.normal.needsUpdate = true;
        }

        function redo(mesh) {
            if (redoStack.length === 0) return;
            
            const state = redoStack.pop();
            undoStack.push({
                positions: mesh.geometry.attributes.position.array.slice(),
                normals: mesh.geometry.attributes.normal.array.slice()
            });
            
            mesh.geometry.attributes.position.array.set(state.positions);
            mesh.geometry.attributes.normal.array.set(state.normals);
            mesh.geometry.attributes.position.needsUpdate = true;
            mesh.geometry.attributes.normal.needsUpdate = true;
        }
        
        // دالة تطبيق التقسيم الفرعي
        function applySubdivision(mesh, level) {
            const modifier = new THREE.SubdivisionModifier(level);
            const smoothGeometry = modifier.modify(mesh.geometry);
            
            // تحديث الشبكة مع الحفاظ على المواد والخصائص
            mesh.geometry.dispose();
            mesh.geometry = smoothGeometry;
            
            // إعادة حساب المعايير
            mesh.geometry.computeVertexNormals();
            mesh.geometry.computeBoundingSphere();
            
            return mesh;
        }



        // دالة للعثور على النقاط المجاورة
        function findNeighborVertices(mesh, vertexIndex) {
            const geometry = mesh.geometry;
            const positions = geometry.attributes.position;
            const neighbors = [];
            
            // باستخدام مصفوفة الأوجه للعثور على النقاط المتصلة
            const faces = geometry.index;
            for (let i = 0; i < faces.count; i += 3) {
                const face = [faces.getX(i), faces.getX(i + 1), faces.getX(i + 2)];
                
                if (face.includes(vertexIndex)) {
                    face.forEach(idx => {
                        if (idx !== vertexIndex && !neighbors.includes(idx)) {
                            neighbors.push(idx);
                        }
                    });
                }
            }
            
            return neighbors;
        }



        // إضافة مستمعي الأحداث للأدوات الجديدة
        function setupSculptingTools() {
            document.getElementById('subdivide').addEventListener('click', () => {
                if (selectedObject) {
                    subdivisionLevel++;
                    selectedObject = applySubdivision(selectedObject, subdivisionLevel);
                }
            });
            
            document.getElementById('sculpt').addEventListener('click', () => {
                modifierMode = 'sculpt';
                sculptMode = true;
                updateCursor();
            });
            
            document.getElementById('smooth').addEventListener('click', () => {
                modifierMode = 'smooth';
                sculptMode = true;
                updateCursor();
            });
            
            document.getElementById('inflate').addEventListener('click', () => {
                modifierMode = 'inflate';
                sculptMode = true;
                updateCursor();
            });
            
            // مستمع لحجم الفرشاة وقوتها
            document.getElementById('brushSize').addEventListener('input', (e) => {
                sculptBrushSize = parseFloat(e.target.value);
                updateCursor();
            });
            
            document.getElementById('brushStrength').addEventListener('input', (e) => {
                sculptBrushStrength = parseFloat(e.target.value);
            });
        
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'z') {
                        e.preventDefault();
                        if (e.shiftKey) {
                            redo(selectedObject);
                        } else {
                            undo(selectedObject);
                        }
                    }
                }
            });
            
            // إضافة أدوات جديدة
            document.getElementById('symmetry').addEventListener('change', (e) => {
                symmetryEnabled = e.target.checked;
            });
            
            document.getElementById('symmetryAxis').addEventListener('change', (e) => {
                symmetryAxis = e.target.value; // 'x', 'y', أو 'z'
            });
            
            document.getElementById('brushFalloff').addEventListener('change', (e) => {
                brushFalloff = e.target.value;
            });
        }

        // تحديث مؤشر النحت
        function updateCursor() {
            if (!sculptMode) return;
            
            // إنشاء مؤشر مرئي لحجم الفرشاة
            if (!window.sculptureCursor) {
                const cursorGeo = new THREE.RingGeometry(0, 1, 32);
                const cursorMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.5,
                    side: THREE.DoubleSide
                });
                window.sculptureCursor = new THREE.Mesh(cursorGeo, cursorMat);
                scene.add(window.sculptureCursor);
            }
            
            window.sculptureCursor.scale.set(
                sculptBrushSize,
                sculptBrushSize,
                sculptBrushSize
            );
        }
        
        // تحديث موقع المؤشر
        function updateCursorPosition(intersect) {
            if (window.sculptureCursor && intersect) {
                window.sculptureCursor.position.copy(intersect.point);
                window.sculptureCursor.lookAt(
                    intersect.point.clone().add(intersect.face.normal)
                );
            }
        }
        
        // تحديث مستمع الماوس للنحت
        renderer.domElement.addEventListener('mousemove', (event) => {
            if (sculptMode && selectedObject) {
                mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObject(selectedObject);
                
                if (intersects.length > 0) {
                    updateCursorPosition(intersects[0]);
                    
                    if (event.buttons === 1) { // زر الماوس الأيسر مضغوط
                        applySculpting(
                            selectedObject,
                            intersects[0].point,
                            intersects[0].face.normal,
                            modifierMode
                        );
                    }
                }
            }
        });


        function enhanceUndoRedoSystem() {
            const maxStackSize = 20;
        
            function addToUndoStack() {
                const sceneState = {
                    objects: scene.children.map(obj => ({
                        uuid: obj.uuid,
                        position: obj.position.clone(),
                        rotation: obj.rotation.clone(),
                        scale: obj.scale.clone()
                    }))
                };
                
                undoStack.push(sceneState);
                if (undoStack.length > maxStackSize) undoStack.shift();
                redoStack = [];
            }
        
            function applyState(state) {
                state.objects.forEach(objState => {
                    const obj = scene.getObjectByProperty('uuid', objState.uuid);
                    if (obj) {
                        obj.position.copy(objState.position);
                        obj.rotation.copy(objState.rotation);
                        obj.scale.copy(objState.scale);
                    }
                });
            }
        }

        function setupToolEventListeners() {
            // Subdivision
            document.getElementById('subdivide').addEventListener('click', () => {
                if (selectedObject && selectedObject.geometry) {
                    const modifier = new THREE.SubdivisionModifier(subdivisionLevel);
                    selectedObject.geometry = modifier.modify(selectedObject.geometry);
                    selectedObject.geometry.computeVertexNormals();
                }
            });
        
            // Material tools
            document.getElementById('materialType').addEventListener('change', (event) => {
                if (selectedObject) {
                    selectedObject.material = createMaterial(event.target.value);
                    updateMaterialEditor();
                }
            });
        
            // Light tools
            const lightControls = document.querySelectorAll('.light-control');
            lightControls.forEach(control => {
                control.addEventListener('input', (event) => {
                    if (selectedObject && selectedObject.isLight) {
                        selectedObject[event.target.name] = event.target.value;
                        selectedObject.helper?.update();
                    }
                });
            });
        }