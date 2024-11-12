     let scene, camera, renderer, controls, transformControls;
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
            const gridHelper = new THREE.GridHelper(20, 20);
            scene.add(gridHelper);

            // إعداد الكاميرا
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(5, 5, 5);

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

        function addCamera() {
            const newCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            newCamera.position.set(5, 5, 5);
            newCamera.lookAt(0, 0, 0);
            cameras.push(newCamera);
            scene.add(newCamera);
            updateHierarchy();
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

        function setupDefaultLighting() {
            const ambientLight = new THREE.AmbientLight(0x404040);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 5, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
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
                color: 0xcccccc,
                metalness: 0.5,
                roughness: 0.5,
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

        function addLight(type) {
            let light;
            switch(type) {
                case 'point':
                    light = new THREE.PointLight(0xffffff, 1, 100);
                    light.position.set(0, 5, 0);
                    break;
                case 'spot':
                    light = new THREE.SpotLight(0xffffff, 1);
                    light.position.set(0, 5, 0);
                    light.angle = Math.PI / 4;
                    light.penumbra = 0.1;
                    break;
                case 'ambient':
                    light = new THREE.AmbientLight(0x404040);
                    break;
            }
            
            if (light) {
                scene.add(light);
                if (type !== 'ambient') {
                    const helper = new THREE.PointLightHelper(light, 0.5);
                    scene.add(helper);
                }
                setSelectedObject(light);
                updateHierarchy();
            }
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

        function updateMaterialEditor() {
            if (!selectedObject || !selectedObject.material) return;

            const material = selectedObject.material;
            document.getElementById('materialColor').value = '#' + material.color.getHexString();
            document.getElementById('materialMetalness').value = material.metalness;
            document.getElementById('materialRoughness').value = material.roughness;
            document.getElementById('materialOpacity').value = material.opacity;
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
