import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';

class Paint3D {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.isDrawing = false;
        this.currentColor = '#ff0000';
        this.brushSize = 5;
        this.points = [];
        this.lines = [];
        this.currentLine = null;
        this.drawingPlane = null;
        this.currentSide = 'front';
        this.moveSpeed = 0.1;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        };
        this.isCameraLocked = false;
        this.isRotating = false;
        this.currentTool = 'brush';
        this.history = [];
        this.historyIndex = -1;
        this.startPoint = null;
        this.tempLine = null;

        this.init();
        this.setupEventListeners();
        this.animate();
    }

    init() {
        // Настройка рендерера
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x1a1a1a);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Настройка камеры
        this.camera.position.set(0, 3, 5);

        // Добавление освещения
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Основной источник света
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(2, 3, 2);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 10;
        mainLight.shadow.camera.left = -3;
        mainLight.shadow.camera.right = 3;
        mainLight.shadow.camera.top = 3;
        mainLight.shadow.camera.bottom = -3;
        this.scene.add(mainLight);

        // Дополнительный источник света
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-2, 2, -2);
        fillLight.castShadow = true;
        this.scene.add(fillLight);

        // Создание реалистичного листа для рисования
        const planeGeometry = new THREE.PlaneGeometry(4, 4);
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: 0xf8f8f8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            roughness: 0.3,
            metalness: 0.1,
            envMapIntensity: 1.0
        });
        this.drawingPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.drawingPlane.receiveShadow = true;
        this.drawingPlane.position.y = 2;
        this.scene.add(this.drawingPlane);

        // Добавление фона
        const roomGeometry = new THREE.BoxGeometry(20, 20, 20);
        const roomMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            side: THREE.BackSide,
            roughness: 1,
            metalness: 0
        });
        const room = new THREE.Mesh(roomGeometry, roomMaterial);
        this.scene.add(room);

        // Добавление сетки для ориентации
        const gridHelper = new THREE.GridHelper(10, 10);
        gridHelper.position.y = 0;
        this.scene.add(gridHelper);

        // Настройка контролов
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false;
        this.controls.enableZoom = true;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 10;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.enableRotate = true;
        
        // Настройка для мобильных устройств
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        
        // Улучшенная поддержка сенсорных устройств
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 0.5;
        this.controls.enablePinch = true;
        this.controls.enableMultiTouch = true;
    }

    setupEventListeners() {
        // Обработка изменения цвета
        document.getElementById('color-picker').addEventListener('input', (e) => {
            this.currentColor = e.target.value;
        });

        // Обработка изменения размера кисти
        document.getElementById('size-slider').addEventListener('input', (e) => {
            this.brushSize = e.target.value;
        });

        // Обработка выбора цвета из пресетов
        const colorPresets = document.querySelectorAll('.color-preset');
        colorPresets.forEach(preset => {
            preset.addEventListener('click', () => {
                this.currentColor = preset.dataset.color;
                document.getElementById('color-picker').value = this.currentColor;
                colorPresets.forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        // Обработка инструментов
        const tools = ['brush', 'eraser', 'spray', 'line', 'circle', 'rectangle'];
        tools.forEach(tool => {
            document.getElementById(`${tool}-tool`).addEventListener('click', () => {
                this.currentTool = tool;
                document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
                document.getElementById(`${tool}-tool`).classList.add('active');
            });
        });

        // Обработка очистки холста
        document.getElementById('clear-canvas').addEventListener('click', () => {
            this.clearCanvas();
        });

        // Обработка отмены/повтора
        document.getElementById('undo').addEventListener('click', () => {
            this.undo();
        });
        document.getElementById('redo').addEventListener('click', () => {
            this.redo();
        });

        // Обработка сохранения
        document.getElementById('save-image').addEventListener('click', () => {
            this.saveImage();
        });

        // Обработка сброса камеры
        document.getElementById('reset-camera').addEventListener('click', () => {
            this.camera.position.set(0, 3, 5);
            this.camera.lookAt(0, 0, 0);
        });

        // Обработка блокировки камеры
        const lockCameraButton = document.getElementById('lock-camera');
        lockCameraButton.addEventListener('click', () => {
            this.isCameraLocked = !this.isCameraLocked;
            this.controls.enabled = !this.isCameraLocked;
            lockCameraButton.classList.toggle('active');
            lockCameraButton.textContent = this.isCameraLocked ? 'Разблокировать камеру' : 'Блокировка камеры';
        });

        // Обработка инструкции
        const instructionsButton = document.getElementById('instructions-button');
        const instructions = document.getElementById('instructions');
        const closeInstructions = document.getElementById('close-instructions');

        instructionsButton.addEventListener('click', () => {
            instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
        });

        closeInstructions.addEventListener('click', () => {
            instructions.style.display = 'none';
        });

        // Отслеживание вращения камеры
        this.controls.addEventListener('start', () => {
            this.isRotating = true;
            if (this.isDrawing) {
                this.stopDrawing();
            }
        });

        this.controls.addEventListener('end', () => {
            this.isRotating = false;
        });

        // Обработка рисования
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !this.isRotating) {
                this.startDrawing(e);
            }
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (!this.isRotating) {
                this.draw(e);
            }
        });

        this.renderer.domElement.addEventListener('mouseup', () => {
            if (this.isDrawing) {
                this.stopDrawing();
            }
        });

        this.renderer.domElement.addEventListener('mouseleave', () => {
            if (this.isDrawing) {
                this.stopDrawing();
            }
        });

        // Обработка рисования для сенсорных устройств
        this.renderer.domElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && !this.isRotating) {
                this.startDrawing(e.touches[0]);
            }
        }, { passive: false });

        this.renderer.domElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && !this.isRotating) {
                this.draw(e.touches[0]);
            }
        }, { passive: false });

        this.renderer.domElement.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.isDrawing) {
                this.stopDrawing();
            }
        }, { passive: false });

        // Перетаскивание меню для сенсорных устройств
        const toolbarHeader = document.getElementById('toolbar-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        toolbarHeader.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd, { passive: false });

        function dragStart(e) {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }

            if (e.target === toolbarHeader || e.target === document.getElementById('toolbar-title')) {
                isDragging = true;
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();

                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                if (!isCollapsed) {
                    setTranslate(currentX, currentY, toolbar);
                }
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        }

        // Адаптация размера холста для мобильных устройств
        function handleResize() {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        window.addEventListener('resize', handleResize.bind(this));
        handleResize.call(this);
    }

    startDrawing(event) {
        this.isDrawing = true;
        this.points = [];
        const point = this.getIntersectionPoint(event);
        if (point) {
            this.startPoint = point;
            this.points.push(point);

            if (this.currentTool === 'brush' || this.currentTool === 'eraser' || this.currentTool === 'spray') {
                const geometry = new THREE.BufferGeometry();
                const material = new THREE.LineBasicMaterial({
                    color: this.currentTool === 'eraser' ? 0x1a1a1a : this.currentColor,
                    linewidth: this.brushSize
                });
                this.currentLine = new THREE.Line(geometry, material);
                this.currentLine.userData.side = this.currentSide;
                this.scene.add(this.currentLine);
                this.lines.push(this.currentLine);
            }
        }
    }

    draw(event) {
        if (!this.isDrawing) return;
        
        const point = this.getIntersectionPoint(event);
        if (!point) return;

        switch(this.currentTool) {
            case 'brush':
            case 'eraser':
                this.points.push(point);
                if (this.currentLine && this.points.length > 1) {
                    this.currentLine.geometry.setFromPoints(this.points);
                    this.currentLine.geometry.attributes.position.needsUpdate = true;
                }
                break;

            case 'spray':
                this.createSprayPoint(point);
                break;

            case 'line':
                if (this.tempLine) {
                    this.scene.remove(this.tempLine);
                }
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([this.startPoint, point]);
                const lineMaterial = new THREE.LineBasicMaterial({ color: this.currentColor });
                this.tempLine = new THREE.Line(lineGeometry, lineMaterial);
                this.scene.add(this.tempLine);
                break;

            case 'circle':
                if (this.tempLine) {
                    this.scene.remove(this.tempLine);
                }
                const radius = this.startPoint.distanceTo(point);
                const circleGeometry = new THREE.BufferGeometry();
                const circlePoints = [];
                for (let i = 0; i <= 64; i++) {
                    const angle = (i / 64) * Math.PI * 2;
                    const x = this.startPoint.x + Math.cos(angle) * radius;
                    const z = this.startPoint.z + Math.sin(angle) * radius;
                    circlePoints.push(new THREE.Vector3(x, this.startPoint.y, z));
                }
                circleGeometry.setFromPoints(circlePoints);
                const circleMaterial = new THREE.LineBasicMaterial({ color: this.currentColor });
                this.tempLine = new THREE.Line(circleGeometry, circleMaterial);
                this.scene.add(this.tempLine);
                break;

            case 'rectangle':
                if (this.tempLine) {
                    this.scene.remove(this.tempLine);
                }
                const rectPoints = [
                    this.startPoint,
                    new THREE.Vector3(point.x, this.startPoint.y, this.startPoint.z),
                    point,
                    new THREE.Vector3(this.startPoint.x, this.startPoint.y, point.z),
                    this.startPoint
                ];
                const rectGeometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
                const rectMaterial = new THREE.LineBasicMaterial({ color: this.currentColor });
                this.tempLine = new THREE.Line(rectGeometry, rectMaterial);
                this.scene.add(this.tempLine);
                break;
        }
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.tempLine) {
            this.lines.push(this.tempLine);
            this.tempLine = null;
        }

        if (this.currentLine) {
            this.currentLine = null;
        }

        this.startPoint = null;
        this.saveToHistory();
    }

    getIntersectionPoint(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        let x, y;

        if (event.touches) {
            x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
            y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
        } else {
            x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(x, y);
        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObject(this.drawingPlane);
        return intersects.length > 0 ? intersects[0].point : null;
    }

    createSprayPoint(point) {
        const sprayCount = 10;
        const sprayRadius = this.brushSize / 10;
        const planeSize = 4; // Размер плоскости (4x4)
        const halfSize = planeSize / 2;
        
        for (let i = 0; i < sprayCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * sprayRadius;
            let x = point.x + Math.cos(angle) * radius;
            let z = point.z + Math.sin(angle) * radius;
            
            // Ограничиваем координаты границами плоскости
            x = Math.max(-halfSize, Math.min(halfSize, x));
            z = Math.max(-halfSize, Math.min(halfSize, z));
            
            const sprayPoint = new THREE.Vector3(x, point.y, z);
            const geometry = new THREE.BufferGeometry().setFromPoints([sprayPoint]);
            const material = new THREE.PointsMaterial({
                color: this.currentColor,
                size: this.brushSize / 5
            });
            const spray = new THREE.Points(geometry, material);
            this.scene.add(spray);
            this.lines.push(spray);
        }
    }

    clearCanvas() {
        this.lines.forEach(line => this.scene.remove(line));
        this.lines = [];
        this.saveToHistory();
    }

    saveToHistory() {
        // Удаляем все действия после текущего индекса
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Сохраняем текущее состояние
        const state = this.lines.map(line => ({
            geometry: line.geometry.clone(),
            material: line.material.clone(),
            side: line.userData.side
        }));
        
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    restoreState(state) {
        // Удаляем все текущие линии
        this.lines.forEach(line => this.scene.remove(line));
        this.lines = [];

        // Восстанавливаем состояние
        if (state && state.length > 0) {
            state.forEach(lineData => {
                const line = new THREE.Line(lineData.geometry, lineData.material);
                line.userData.side = lineData.side;
                this.scene.add(line);
                this.lines.push(line);
            });
        }
    }

    saveImage() {
        const link = document.createElement('a');
        link.download = '3d-paint.png';
        link.href = this.renderer.domElement.toDataURL();
        link.click();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

// Инициализация приложения
new Paint3D(); 