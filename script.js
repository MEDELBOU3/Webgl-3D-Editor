 

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

     // Add to setupAdditionalEventListeners
     document.getElementById('videoLoader').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            addVideoToScene(file);
        }
    });
    
    document.getElementById('createShot').addEventListener('click', createShot);
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
                cameraRotation: camera.rotation.clone(),
            });
        }
    
        controls.update();
    
        // Update display info
        const fpsElement = document.getElementById('fps');
        const objectsElement = document.getElementById('objects');
        const polygonsElement = document.getElementById('polygons');
    
        const fps = Math.round(1 / clock.getDelta());
        const objects = scene.children.length;
        const polygons = renderer.info.render.triangles;
    
        fpsElement.textContent = `FPS: ${fps}`;
        objectsElement.textContent = `Objects: ${objects}`;
        polygonsElement.textContent = `Polygons: ${polygons}`;
    
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







// Timeline class to manage animation states
class Timeline {
 constructor() {
     this.keyframes = new Map(); // Map of time -> state
     this.currentTime = 0;
     this.duration = 10; // Default 10 seconds
     this.isPlaying = false;
     this.fps = 60;
     this.selectedKeyframe = null;
     this.isDragging = false;
     this.isPlaying = false;
     this.fps = 60;
     //display and disappears the timeline
     this.isVisible = false; 
     this.createToggleButton(); 

     // Create timeline  & keyframe UI
     this.createUI();
     this.createKeyframeMarkers();

     // Initially hide the timeline
    document.getElementById('timeline-container').style.display = 'none';
 }

 createToggleButton() {
     const button = document.createElement('button');
     button.id = 'timeline-toggle';
     button.innerHTML = `
         <style>
             #timeline-toggle {
                 position: fixed;
                 bottom: 20px;
                 right: 20px;
                 width: 50px;
                 height: 50px;
                 border-radius: 50%;
                 background: #444;
                 border: none;
                 color: white;
                 cursor: pointer;
                 font-size: 20px;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 transition: background-color 0.3s, transform 0.3s;
                 z-index: 1000;
             }

             #timeline-toggle:hover {
                 background: #555;
                 transform: scale(1.1);
             }

             #timeline-toggle.active {
                 background: #666;
             }
         </style>
         <span><i class="fa-solid fa-timeline"></i></span>
     `;

     document.body.appendChild(button);

     button.addEventListener('click', () => this.toggleTimeline());
 }

 createUI() {
     const container = document.createElement('div');
     container.id = 'timeline-container';
     container.innerHTML = `
     <style>

         #timeline-container {
             position: fixed;
             bottom: 0;
             left: 0;
             right: 0;
             height: 150px;
             margin: 0 auto;
             width: 100%;
             background: #2a2a2a;
             padding: 10px;
             font-family: Arial, sans-serif;
             color: #fff;
             user-select: none;
             z-index: 999;
         }
         /* Add animation keyframes */
         @keyframes slideUp {
             from {
                 transform: translateY(100%);
                 opacity: 0;
             }
             to {
                 transform: translateY(0);
                 opacity: 1;
             }
         }

         @keyframes slideDown {
             from {
                 transform: translateY(0);
                 opacity: 1;
             }
             to {
                 transform: translateY(100%);
                 opacity: 0;
             }
         }
         .timeline-controls {
             display: flex;
             align-items: center;
             gap: 10px;
             margin-bottom: 10px;
         }

         .timeline-button {
             background: #444;
             border: none;
             color: white;
             padding: 5px 15px;
             border-radius: 4px;
             cursor: pointer;
             transition: background 0.2s;
         }

         .timeline-button:hover {
             background: #555;
         }

         .timeline-button.active {
             background: #666;
         }

         #timeline-track {
             position: relative;
             height: 60px;
             background: #333;
             border-radius: 4px;
             margin-bottom: 10px;
         }

         #timeline-playhead {
             position: absolute;
             top: 0;
             width: 2px;
             height: 100%;
             background: red;
             pointer-events: none;
         }

         .keyframe-marker {
             position: absolute;
             width: 12px;
             height: 12px;
             background: #ffbb00;
             border-radius: 50%;
             top: 50%;
             transform: translate(-50%, -50%);
             cursor: pointer;
             z-index: 1;
         }

         .keyframe-marker.selected {
             border: 2px solid #fff;
         }

         #timeline-time-markers {
             position: relative;
             height: 20px;
             display: flex;
             justify-content: space-between;
             padding: 0 10px;
         }

         .time-marker {
             position: absolute;
             transform: translateX(-50%);
             color: #888;
             font-size: 12px;
         }

         #timeline-properties {
             position: absolute;
             background: #444;
             padding: 10px;
             border-radius: 4px;
             display: none;
         }
     </style>
     <span><i class="fa-solid fa-timeline"></i></span>
     <div class="timeline-controls">
         <button class="timeline-button" id="timeline-play">▶</button>
         <button class="timeline-button" id="timeline-stop">■</button>
         <button class="timeline-button" id="timeline-add-keyframe">+ Keyframe</button>
         <span id="timeline-current-time">0:00</span>
         <input type="number" id="timeline-duration" min="1" max="300" value="10" style="width: 60px">
         <span>seconds</span>
     </div>
     <div id="timeline-track">
         <div id="timeline-playhead"></div>
     </div>
     <div id="timeline-time-markers"></div>
     <div id="timeline-properties"></div>
    `;

    document.body.appendChild(container);
    this.setupEventListeners();
    this.createTimeMarkers();

    
     
 }

 toggleTimeline() {
     this.isVisible = !this.isVisible;
     const container = document.getElementById('timeline-container');
     const toggleButton = document.getElementById('timeline-toggle');
     
     if (this.isVisible) {
         container.style.display = 'block';
         toggleButton.classList.add('active');
         // Add animation for showing
         container.style.animation = 'slideUp 0.3s ease-out';
     } else {
         // Add animation for hiding
         container.style.animation = 'slideDown 0.3s ease-out';
         container.addEventListener('animationend', () => {
             if (!this.isVisible) {
                 container.style.display = 'none';
             }
         }, { once: true });
         toggleButton.classList.remove('active');
     }
 }

 createTimeMarkers() {
     const markers = document.getElementById('timeline-time-markers');
     markers.innerHTML = '';
     const steps = 10;
     for (let i = 0; i <= steps; i++) {
         const marker = document.createElement('div');
         marker.className = 'time-marker';
         marker.style.left = `${(i / steps) * 100}%`;
         marker.textContent = this.formatTime((i / steps) * this.duration);
         markers.appendChild(marker);
     }
 }

 createKeyframeMarkers() {
     const track = document.getElementById('timeline-track');
     this.keyframes.forEach((state, time) => {
         const marker = document.createElement('div');
         marker.className = 'keyframe-marker';
         marker.style.left = `${(time / this.duration) * 100}%`;
         marker.dataset.time = time;
         track.appendChild(marker);
     });
 }

 setupEventListeners() {
     document.getElementById('timeline-play').onclick = () => this.togglePlay();
     document.getElementById('timeline-stop').onclick = () => this.stop();
     document.getElementById('timeline-add-keyframe').onclick = () => this.addKeyframe();
     
     const track = document.getElementById('timeline-track');
     
     // Track clicking and dragging
     track.addEventListener('mousedown', (e) => {
         if (e.target.classList.contains('keyframe-marker')) {
             this.startDraggingKeyframe(e);
         } else {
             this.seek(this.getTimeFromPosition(e));
         }
     });

     document.addEventListener('mousemove', (e) => {
         if (this.isDragging) {
             this.dragKeyframe(e);
         }
     });

     document.addEventListener('mouseup', () => {
         this.isDragging = false;
     });

     // Duration input
     document.getElementById('timeline-duration').addEventListener('change', (e) => {
         this.duration = Number(e.target.value);
         this.createTimeMarkers();
         this.updateUI();
     });

     // Keyboard shortcuts
     document.addEventListener('keydown', (e) => {
         if (e.code === 'Space') {
             this.togglePlay();
         }
         if (e.code === 'Delete' && this.selectedKeyframe) {
             this.deleteSelectedKeyframe();
         }
     });
 }

 startDraggingKeyframe(e) {
     this.isDragging = true;
     this.selectedKeyframe = e.target;
     document.querySelectorAll('.keyframe-marker').forEach(marker => {
         marker.classList.remove('selected');
     });
     this.selectedKeyframe.classList.add('selected');
     this.showKeyframeProperties();
 }

 dragKeyframe(e) {
     if (!this.isDragging || !this.selectedKeyframe) return;
     
     const track = document.getElementById('timeline-track');
     const rect = track.getBoundingClientRect();
     const x = e.clientX - rect.left;
     const newTime = this.getTimeFromPosition(e);
     
     // Update keyframe position
     this.selectedKeyframe.style.left = `${(newTime / this.duration) * 100}%`;
     
     // Update keyframe data
     const oldTime = Number(this.selectedKeyframe.dataset.time);
     const state = this.keyframes.get(oldTime);
     this.keyframes.delete(oldTime);
     this.keyframes.set(newTime, state);
     this.selectedKeyframe.dataset.time = newTime;
     
     this.updateUI();
 }

 showKeyframeProperties() {
     if (!this.selectedKeyframe) return;
     
     const properties = document.getElementById('timeline-properties');
     const time = Number(this.selectedKeyframe.dataset.time);
     const state = this.keyframes.get(time);
     
     properties.style.display = 'block';
     properties.style.left = `${this.selectedKeyframe.offsetLeft}px`;
     properties.style.top = `${this.selectedKeyframe.offsetTop - 100}px`;
     
     properties.innerHTML = `
         <div>Time: ${this.formatTime(time)}</div>
         <div>Position: ${state.position.toArray().map(v => v.toFixed(2)).join(', ')}</div>
         <div>Rotation: ${state.rotation.toArray().map(v => (v * 180 / Math.PI).toFixed(2)).join(', ')}°</div>
         <div>Scale: ${state.scale.toArray().map(v => v.toFixed(2)).join(', ')}</div>
     `;
 }

 togglePlay() {
     this.isPlaying = !this.isPlaying;
     const playButton = document.getElementById('timeline-play');
     playButton.textContent = this.isPlaying ? '❚❚' : '▶';
     playButton.classList.toggle('active');
     
     if (this.isPlaying) {
         this.animate();
     }
 }

 stop() {
     this.isPlaying = false;
     this.currentTime = 0;
     this.updateUI();
     document.getElementById('timeline-play').textContent = '▶';
     document.getElementById('timeline-play').classList.remove('active');
 }

 getTimeFromPosition(e) {
     const track = document.getElementById('timeline-track');
     const rect = track.getBoundingClientRect();
     const x = e.clientX - rect.left;
     return Math.max(0, Math.min(this.duration, (x / rect.width) * this.duration));
 }

 addKeyframe() {
     if (!selectedObject) return;

     const state = {
         position: selectedObject.position.clone(),
         rotation: selectedObject.rotation.clone(),
         scale: selectedObject.scale.clone(),
         objectId: selectedObject.id
     };

     this.keyframes.set(this.currentTime, state);
     this.createKeyframeMarkers();
     this.updateUI();
 }

 deleteSelectedKeyframe() {
     if (!this.selectedKeyframe) return;
     
     const time = Number(this.selectedKeyframe.dataset.time);
     this.keyframes.delete(time);
     this.selectedKeyframe.remove();
     this.selectedKeyframe = null;
     document.getElementById('timeline-properties').style.display = 'none';
     this.updateUI();
 }

 // ... (keep the previous animation and interpolation methods)

 updateUI() {
     const playhead = document.getElementById('timeline-playhead');
     const timeDisplay = document.getElementById('timeline-current-time');
     
     playhead.style.left = `${(this.currentTime / this.duration) * 100}%`;
     timeDisplay.textContent = this.formatTime(this.currentTime);
 }

 formatTime(seconds) {
     const minutes = Math.floor(seconds / 60);
     const remainingSeconds = Math.floor(seconds % 60);
     const milliseconds = Math.floor((seconds % 1) * 100);
     return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
 }
}

// Video-related variables
let videoTextures = new Map(); // Store video textures
let videoMaterials = new Map(); // Store video materials
let currentVideoTime = 0;
let timelineActive = false;

// Shot management
let shots = [];
let currentShot = null;


function addVideoToScene(file) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.load();
    video.loop = true;
    
    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    
    // Create material with video texture
    const videoMaterial = new THREE.MeshBasicMaterial({
        map: videoTexture,
        side: THREE.DoubleSide
    });
    
    // Create plane geometry for video
    const aspectRatio = 16 / 9; // Default aspect ratio
    const videoPlane = new THREE.PlaneGeometry(aspectRatio * 2, 2);
    const videoMesh = new THREE.Mesh(videoPlane, videoMaterial);
    
    // Store references
    const videoId = 'video_' + Date.now();
    videoTextures.set(videoId, videoTexture);
    videoMaterials.set(videoId, videoMaterial);
    
    // Add to scene
    scene.add(videoMesh);
    setSelectedObject(videoMesh);
    updateHierarchy();
    
    // Create timeline control for this video
    createVideoTimeline(video, videoId);
    
    return { mesh: videoMesh, video: video, id: videoId };
}

function createVideoTimeline(video, videoId) {
    const timeline = document.createElement('div');
    timeline.className = 'video-timeline';
    timeline.innerHTML = `
        <div class="timeline-header">
            <span>Video: ${videoId}</span>
            <button onclick="playPauseVideo('${videoId}')">Play/Pause</button>
        </div>
        <input type="range" min="0" max="100" value="0" 
               class="timeline-slider" id="timeline_${videoId}"
               onInput="updateVideoTime('${videoId}', this.value)">
        <div class="timeline-info">
            <span id="currentTime_${videoId}">0:00</span> / 
            <span id="totalTime_${videoId}">0:00</span>
        </div>
    `;
    
    document.getElementById('timeline-container').appendChild(timeline);
    
    // Update timeline when video loads
    video.addEventListener('loadedmetadata', () => {
        const slider = document.getElementById(`timeline_${videoId}`);
        document.getElementById(`totalTime_${videoId}`).textContent = 
            formatTime(video.duration);
    });
    
    // Update timeline during playback
    video.addEventListener('timeupdate', () => {
        const slider = document.getElementById(`timeline_${videoId}`);
        const currentTimeDisplay = document.getElementById(`currentTime_${videoId}`);
        slider.value = (video.currentTime / video.duration) * 100;
        currentTimeDisplay.textContent = formatTime(video.currentTime);
    });
}

function updateVideoTime(videoId, value) {
    const video = videoTextures.get(videoId).image;
    video.currentTime = (value / 100) * video.duration;
}

function playPauseVideo(videoId) {
    const video = videoTextures.get(videoId).image;
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Shot management functions
function createShot() {
    const shot = {
        id: 'shot_' + Date.now(),
        startTime: currentVideoTime,
        duration: 5, // Default duration in seconds
        cameraPosition: camera.position.clone(),
        cameraRotation: camera.rotation.clone(),
        selectedObjects: selectedObject ? [selectedObject.uuid] : []
    };
    
    shots.push(shot);
    updateShotsList();
    return shot;
}

function updateShotsList() {
    const container = document.getElementById('shots-container');
    container.innerHTML = '';
    
    shots.forEach(shot => {
        const shotElement = document.createElement('div');
        shotElement.className = 'shot-item';
        shotElement.innerHTML = `
            <div class="shot-content" style=" background-color: #444; width: 250px; padding: 5px; " >
               <span>Shot ${shot.id}</span>
               <span style="color: red; background: #222; padding: 4px;">${formatTime(shot.startTime)} - ${formatTime(shot.startTime + shot.duration)}</span>
               <button style=" background-color: #808000; border: none; padding: 4px 6px; color: #fff;" onclick="activateShot('${shot.id}')">Activate</button>
               <button style=" background-color: #808000; border: none; padding: 4px 6px; color: #fff;"  onclick="deleteShot('${shot.id}')">Delete</button>
            </div>
        `;
        container.appendChild(shotElement);
    });
}

function activateShot(shotId) {
    currentShot = shots.find(shot => shot.id === shotId);
    if (currentShot) {
        camera.position.copy(currentShot.cameraPosition);
        camera.rotation.copy(currentShot.cameraRotation);
        
        // Restore selected objects
        currentShot.selectedObjects.forEach(uuid => {
            const object = scene.getObjectByProperty('uuid', uuid);
            if (object) setSelectedObject(object);
        });
    }
}

function deleteShot(shotId) {
    shots = shots.filter(shot => shot.id !== shotId);
    updateShotsList();
}

// Initialize timeline
const timeline = new Timeline();

