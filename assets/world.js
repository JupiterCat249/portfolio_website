(function () {
    'use strict';

    // =================================================================================
    // --- CONFIG & CONSTANTS ---
    // =================================================================================

    const LERP_FACTOR = 0.08; // Camera smoothing factor
    const MOVE_SPEED = 5;
    const PROXIMITY_THRESHOLD = 200; // How close to be to see the briefing float

    // =================================================================================
    // --- DOM ELEMENTS ---
    // =================================================================================

    const world = document.getElementById('world');
    const backgroundContentLayer = document.getElementById('background-content-layer');
    const interactionPrompt = document.getElementById('interactionPrompt');
    const movementPrompt = document.getElementById('movementPrompt');
    const backHomeButton = document.getElementById('backHome');
    let briefingFloatElement = null; // To be created
    let eventPanelOverlay = null; // To be created

    // =================================================================================
    // --- STATE ---
    // =================================================================================

    let mapData = { nodes: [], edges: [] };
    let contentMap = new Map();
    let activeBriefingNodeId = null;
    let camera = { x: 0, y: 0 };
    let targetCamera = { x: 0, y: 0 };
    const keysDown = {};
    let scrollingDirection = 0; // -1 for up, 1 for down, 0 for none
    let proximateNodeId = null;
    
    let isPointerDown = false;
    let hasDragged = false;
    let dragStart = { x: 0, y: 0 };
    let cameraStart = { x: 0, y: 0 };

    // =================================================================================
    // --- INITIALIZATION ---
    // =================================================================================

    async function init() {
        try {
            createUiElements();
            attachEventListeners();

            const mdPath = getMdPath();
            const text = await fetch(mdPath).then(res => {
                if (!res.ok) throw new Error(`Failed to fetch ${mdPath}`);
                return res.text();
            });

            const parsed = parseFullMd(text);
            mapData = parsed.mapData;
            contentMap = parsed.contentMap;
            
            if (parsed.background) {
                applyBackground(parsed.background);
            }

            renderMapDOM();
            setupInitialState();
            loop();
            setInterval(updateProximity, 100); // Optimize proximity check for performance

        } catch (err) {
            console.error("Fatal error during initialization:", err);
            world.innerHTML = `<p style="color:red; text-align:center; padding: 50vh 20px;">Fatal Error. Check console (F12).</p>`;
        }
    }

    // =================================================================================
    // --- CORE GAME LOOP ---
    // =================================================================================

    function loop() {
        updateTargetFromKeys();
        updateCamera();
        updatePanelScroll();
        requestAnimationFrame(loop);
    }

    function updateTargetFromKeys() {
        if (isPointerDown) return; // Don't move with keys while dragging

        if (keysDown['w']) targetCamera.y -= MOVE_SPEED;
        if (keysDown['s']) targetCamera.y += MOVE_SPEED;
        if (keysDown['a']) targetCamera.x -= MOVE_SPEED;
        if (keysDown['d']) targetCamera.x += MOVE_SPEED;
    }

    function updateCamera() {
        let dx = targetCamera.x - camera.x;
        let dy = targetCamera.y - camera.y;

        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            camera.x = targetCamera.x;
            camera.y = targetCamera.y;
        } else {
            camera.x += dx * LERP_FACTOR;
            camera.y += dy * LERP_FACTOR;
        }

        if (isNaN(camera.x) || isNaN(camera.y)) {
            console.error("FATAL: Camera coordinates became NaN. Halting camera.");
            return;
        }

        world.style.transform = `translate(${-camera.x}px, ${-camera.y}px)`;
        
        // --- Performance Optimization ---
        // Only update background position if camera has moved significantly
        const bgX = -camera.x * 0.3;
        const bgY = -camera.y * 0.3;
        const currentBgPos = backgroundContentLayer.style.backgroundPosition.split(' ');
        const currentBgX = parseFloat(currentBgPos[0]);
        const currentBgY = parseFloat(currentBgPos[1]);

        if (Math.abs(bgX - currentBgX) > 1 || Math.abs(bgY - currentBgY) > 1) {
             backgroundContentLayer.style.backgroundPosition = `${bgX}px ${bgY}px`;
        }
    }

    function updatePanelScroll() {
        if (!eventPanelOverlay.classList.contains('visible') || scrollingDirection === 0) return;
        const contentScroller = eventPanelOverlay.querySelector('.event-panel');
        const scrollAmount = 10;
        contentScroller.scrollBy(0, scrollingDirection * scrollAmount);
    }

    // =================================================================================
    // --- DATA LOADING & PARSING (unchanged) ---
    // ... (keeping all parsing functions as they were)
    // =================================================================================
    
    function getMdPath() {
        return window.location.pathname.includes('project-CC.html')
            ? 'content/project-CC.md'
            : 'content/index.md';
    }

    function parseFullMd(text) {
        const backgroundMatch = text.match(/^@background:\s*(.*)/m);
        const background = backgroundMatch ? backgroundMatch[1].trim() : null;

        const mapData = parseMap(text);
        const contentMap = new Map();
        const sections = text.split(/\n(?=##\s)/g);

        for (const section of sections) {
            if (!section.startsWith('## ')) continue;
            const lines = section.substring(3).split('\n');
            const id = lines.shift().trim();
            if (!id) continue;
            contentMap.set(id, parseSectionContent(lines.join('\n')));
        }
        return { mapData, contentMap, background };
    }

    function parseMap(text) {
        const mapBlockMatch = text.match(/@map\r?\n---\r?\n([\s\S]+?)\r?\n---/);
        if (!mapBlockMatch) return { nodes: [], edges: [] };
        const lines = mapBlockMatch[1].split('\n');
        const map = { nodes: [], edges: [] };
        let currentSection = null;
        let currentNode = null;
        let hasManualEdges = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === 'nodes:') { currentSection = 'nodes'; continue; }
            if (trimmed === 'edges:') { 
                currentSection = 'edges';
                hasManualEdges = true; 
                continue; 
            }
            if (!currentSection || !trimmed) continue;

            if (currentSection === 'nodes') {
                if (trimmed.startsWith('- id:')) {
                    currentNode = { id: trimmed.substring(6).trim() };
                    map.nodes.push(currentNode);
                } else if (currentNode) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim();
                    if (key && value != null) {
                        if (key === 'x' || key === 'y') {
                            const val = parseInt(value, 10);
                            currentNode[key] = isNaN(val) ? 0 : val;
                        } else {
                            currentNode[key] = value.replace(/"/g, '');
                        }
                    }
                }
            } else if (currentSection === 'edges') {
                 const fromMatch = line.match(/- from:\s*(.*)/);
                 const toMatch = line.match(/to:\s*(.*)/);
                 if (fromMatch) {
                     map.edges.push({ from: fromMatch[1].trim() });
                 } else if (toMatch && map.edges.length > 0) {
                     map.edges[map.edges.length - 1].to = toMatch[1].trim();
                 }
            }
        }

        if (!hasManualEdges && map.nodes.length > 1) {
            for (let i = 0; i < map.nodes.length - 1; i++) {
                map.edges.push({ from: map.nodes[i].id, to: map.nodes[i+1].id });
            }
        }

        return map;
    }

    function parseSectionContent(md) {
        let title = '';
        let firstImage = null;
        let fullHtml = '';
        const lines = md.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('### ')) {
                const text = escapeHtml(trimmed.substring(4));
                if (!title) title = text;
                fullHtml += `<h3>${text}</h3>`;
            } else if (trimmed.startsWith('![')) {
                const imgMatch = trimmed.match(/^!\[(.*)\]\s*\((.*)\)\r?$/);
                if (imgMatch) {
                    const src = escapeHtml(imgMatch[2]);
                    const cacheBustedSrc = `${src}?v=${Date.now()}`;
                    if (!firstImage) firstImage = cacheBustedSrc;
                    fullHtml += `<img src="${cacheBustedSrc}" alt="${escapeHtml(imgMatch[1])}">`;
                }
            } else {
                fullHtml += `<p>${escapeHtml(trimmed)}</p>`;
            }
        }
        return { title, firstImage, fullHtml };
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }

    // =================================================================================
    // --- DOM & EVENT SETUP ---
    // =================================================================================

    function createUiElements() {
        briefingFloatElement = document.createElement('div');
        briefingFloatElement.id = 'briefing-float';
        briefingFloatElement.innerHTML = `
            <div class="briefing-image"></div>
            <div class="briefing-title"></div>`;
        
        briefingFloatElement.addEventListener('click', (e) => {
            e.stopPropagation();
            handleInteraction();
        });
        briefingFloatElement.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleInteraction();
        });

        world.appendChild(briefingFloatElement);

        eventPanelOverlay = document.createElement('div');
        eventPanelOverlay.id = 'event-panel-overlay';
        eventPanelOverlay.innerHTML = `
            <div class="event-panel">
                <div class="event-panel-content"></div>
                <button class="event-panel-close">&times;</button>
            </div>`;
        document.body.appendChild(eventPanelOverlay);
    }

    function attachEventListeners() {
        // Panel Closing
        eventPanelOverlay.querySelector('.event-panel-close').addEventListener('click', closeDetailPanel);
        eventPanelOverlay.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the click from bubbling up and moving the camera
            // Don't close if user is selecting text or clicking the dedicated close button.
            if (window.getSelection().toString().length > 0 || e.target.closest('.event-panel-close')) {
                return;
            }
            closeDetailPanel();
        });

        eventPanelOverlay.addEventListener('touchend', (e) => {
            e.stopPropagation(); // Prevent the touch from bubbling up and moving the camera
            // Don't close if user is selecting text or clicking the dedicated close button.
            if (window.getSelection().toString().length > 0 || e.target.closest('.event-panel-close')) {
                return;
            }
            closeDetailPanel();
        });

        // Keyboard Input
        document.addEventListener('keydown', (e) => {
            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            const key = e.key.toLowerCase();
            if (eventPanelOverlay.classList.contains('visible')) {
                if (key === 'w') scrollingDirection = -1;
                if (key === 's') scrollingDirection = 1;
                if (key === 'e' || key === 'escape') closeDetailPanel();
                if (['w', 's', 'e', 'escape'].includes(key)) e.preventDefault();
                return;
            }
            if (['w', 'a', 's', 'd'].includes(key)) {
                keysDown[key] = true;
                e.preventDefault();
            }
            if (key === 'e') handleInteraction();
            if (key === 'escape') hideBriefingFloat();
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) keysDown[key] = false;
            if (scrollingDirection !== 0 && (key === 'w' || key === 's')) scrollingDirection = 0;
        });
        
        // Mouse and Touch Input
        function onPointerDown(e) {
            if (e.target.closest('.event-panel') || e.target.closest('.briefing-float')) return;
            e.preventDefault();

            isPointerDown = true;
            hasDragged = false;
            const coords = e.touches ? e.touches[0] : e;
            dragStart.x = coords.clientX;
            dragStart.y = coords.clientY;
            // For direct manipulation, we drag from the CURRENT camera position, not the target.
            cameraStart.x = camera.x;
            cameraStart.y = camera.y;
            document.body.style.cursor = 'grabbing';
        }

        function onPointerMove(e) {
            if (!isPointerDown) return;
            e.preventDefault();
            
            const coords = e.touches ? e.touches[0] : e;
            const dx = coords.clientX - dragStart.x;
            const dy = coords.clientY - dragStart.y;

            // Drag deadzone to prevent tiny jitters
            if (Math.hypot(dx, dy) < 2 && !hasDragged) {
                return;
            }
            hasDragged = true;

            // --- Direct Manipulation Camera Model for Dragging ---
            // Bypass LERP for a 1:1, responsive feel.
            camera.x = cameraStart.x - dx;
            camera.y = cameraStart.y - dy;
            // Keep target in sync so other movements don't jump.
            targetCamera.x = camera.x;
            targetCamera.y = camera.y;
        }

        function onPointerUp(e) {
            if (!isPointerDown) return;
            isPointerDown = false;
            document.body.style.cursor = 'default';
            
            // Handle point-and-click (if it wasn't a drag)
            if (!hasDragged) {
                const screenX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
                const screenY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
                if (screenX === undefined || screenY === undefined) return;

                // This is a click-to-move action, so we set the TARGET camera and let it glide.
                targetCamera.x = (screenX - window.innerWidth / 2) + camera.x;
                targetCamera.y = (screenY - window.innerHeight / 2) + camera.y;
            }
        }

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('mouseup', onPointerUp);
        document.addEventListener('touchstart', onPointerDown, { passive: false });
        document.addEventListener('touchmove', onPointerMove, { passive: false });
        document.addEventListener('touchend', onPointerUp);

        if (backHomeButton) {
            backHomeButton.addEventListener('click', () => {
                document.body.classList.add('fade-out');
                setTimeout(() => { window.location.href = 'index.html'; }, 400);
            });
        }
    }

    function applyBackground(bgUrl) {
        const contentLayer = document.getElementById('background-content-layer');
        if (contentLayer) {
            const cacheBustedUrl = `${bgUrl}?v=${Date.now()}`;
            contentLayer.style.backgroundImage = `url(${cacheBustedUrl})`;
        }
    }

    function renderMapDOM() {
        world.innerHTML = '';
        const mapContainer = document.createElement('div');
        mapContainer.className = 'map-container';
        
        for (const edge of mapData.edges) {
            const fromNode = mapData.nodes.find(n => n.id === edge.from);
            const toNode = mapData.nodes.find(n => n.id === edge.to);
            if (fromNode && toNode) {
                const line = document.createElement('div');
                line.className = 'map-edge';
                const dx = toNode.x - fromNode.x;
                const dy = toNode.y - fromNode.y;
                line.style.width = `${Math.hypot(dx, dy)}px`;
                line.style.left = `${fromNode.x}px`;
                line.style.top = `${fromNode.y}px`;
                line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
                mapContainer.appendChild(line);
            }
        }
        
        for (const node of mapData.nodes) {
            const nodeEl = document.createElement('div');
            nodeEl.className = 'map-node';
            if (node.portal) nodeEl.classList.add('portal-node');
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;
            nodeEl.dataset.id = node.id;
            nodeEl.innerHTML = `<div class="map-node-label">${node.label || node.id}</div>`;
            nodeEl.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent click from bubbling to the document
                targetCamera.x = node.x;
                targetCamera.y = node.y;
            });
            mapContainer.appendChild(nodeEl);
        }
        
        world.appendChild(mapContainer);
        world.appendChild(briefingFloatElement);
    }
    
    function setupInitialState() {
        if (!mapData.nodes || mapData.nodes.length === 0) throw new Error("Map data contains no nodes.");
        const startNode = mapData.nodes[0];
        if (typeof startNode.x !== 'number' || typeof startNode.y !== 'number') throw new Error(`Start node '${startNode.id}' has invalid coordinates.`);
        
        camera.x = targetCamera.x = startNode.x;
        camera.y = targetCamera.y = startNode.y;

        showMovementHint(true);
        showInteractionHint(null);
        
        // We don't show hints or popups initially in free-roam mode
    }

    // =================================================================================
    // --- UI STATE & INTERACTIONS ---
    // =================================================================================

    function updateProximity() {
        if (eventPanelOverlay.classList.contains('visible')) return; // Don't check when panel is open

        if (!mapData.nodes || mapData.nodes.length === 0) return;

        let closestNode = null;
        let minDistance = Infinity;

        for (const node of mapData.nodes) {
            const distance = Math.hypot(camera.x - node.x, camera.y - node.y);
            if (distance < minDistance) {
                minDistance = distance;
                closestNode = node;
            }
        }

        // Check if any node is in proximity
        if (closestNode && minDistance < PROXIMITY_THRESHOLD) {
            if (proximateNodeId !== closestNode.id) {
                showBriefingFloat(closestNode);
                const actionText = closestNode.portal ? 'Enter' : 'View Details';
                showInteractionHint(`[E] ${actionText}`);
                proximateNodeId = closestNode.id;
            }
        } else if (proximateNodeId) {
            hideBriefingFloat();
            showInteractionHint(null);
            proximateNodeId = null;
        }
    }

    function showMovementHint(visible) {
        if (!movementPrompt) return;
        movementPrompt.textContent = visible ? '[WASD] Move / Drag to Pan' : '';
    }

    function showInteractionHint(text) {
        if (!interactionPrompt) return;
        interactionPrompt.textContent = text || '';
    }

    function showBriefingFloat(node) {
        const content = contentMap.get(node.id) || {};
        const imageDiv = briefingFloatElement.querySelector('.briefing-image');
        const titleDiv = briefingFloatElement.querySelector('.briefing-title');
        
        titleDiv.textContent = node.label || node.id;
        
        if (content.firstImage) {
            const cacheBustedUrl = `${content.firstImage.split('?')[0]}?v=${Date.now()}`;
            imageDiv.style.backgroundImage = `url(${cacheBustedUrl})`;
            imageDiv.style.display = 'block';
        } else {
            imageDiv.style.display = 'none';
        }

        // --- Final attempt: Manual pixel calculation --- 

        // 1. Render off-screen to measure dimensions
        briefingFloatElement.style.transition = 'none';
        briefingFloatElement.style.opacity = '0';
        briefingFloatElement.style.transform = 'scale(0.95)'; // Keep the scale for animation
        briefingFloatElement.style.top = '-9999px';
        briefingFloatElement.style.left = '-9999px';
        
        // Force browser to render and give us dimensions
        void briefingFloatElement.offsetWidth;
        const floatWidth = briefingFloatElement.offsetWidth;
        const floatHeight = briefingFloatElement.offsetHeight;

        // 2. Calculate the correct top-left position
        const targetLeft = node.x - (floatWidth / 2);
        const targetTop = node.y - floatHeight - 30; // 30px margin above the node

        // 3. Set initial state for animation at the correct coordinates
        briefingFloatElement.style.left = `${targetLeft}px`;
        briefingFloatElement.style.top = `${targetTop + 20}px`; // Start 20px lower for animation

        // 4. Force reflow again and then start the animation
        void briefingFloatElement.offsetWidth;
        briefingFloatElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease, top 0.3s ease';
        briefingFloatElement.style.opacity = '1';
        briefingFloatElement.style.transform = 'scale(1)';
        briefingFloatElement.style.top = `${targetTop}px`;
        briefingFloatElement.style.pointerEvents = 'auto'; // Make it clickable
    }

    function hideBriefingFloat() {
        briefingFloatElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease, top 0.3s ease';
        briefingFloatElement.style.opacity = '0';
        briefingFloatElement.style.transform = 'scale(0.95)';
        // Get current top and move it down
        const currentTop = parseFloat(briefingFloatElement.style.top || 0);
        briefingFloatElement.style.top = `${currentTop + 20}px`;
        briefingFloatElement.style.pointerEvents = 'none';
        proximateNodeId = null;
    }

    function openDetailPanel(nodeId) {
        const content = contentMap.get(nodeId);
        if (!content) return;

        const contentEl = eventPanelOverlay.querySelector('.event-panel-content');
        contentEl.innerHTML = content.fullHtml;
        eventPanelOverlay.classList.add('visible');
        eventPanelOverlay.querySelector('.event-panel').scrollTop = 0;

        // Update hints when panel opens
        showMovementHint(false);
        showInteractionHint('[E] Close');
    }

    function closeDetailPanel() {
        scrollingDirection = 0; // Still need this to stop scroll
        eventPanelOverlay.classList.remove('visible');

        // Restore hints when panel closes
        showMovementHint(true);
        showInteractionHint(null); // Proximity check will show the correct hint on the next frame
    }

    function handleInteraction() {
        if (!proximateNodeId) return;

        const node = mapData.nodes.find(n => n.id === proximateNodeId);
        if (node && node.portal) {
             document.body.classList.add('fade-out');
             setTimeout(() => { window.location.href = node.portal; }, 400);
        } else {
            openDetailPanel(proximateNodeId);
        }
    }
    
    // --- Kick it off ---
    init();

})();