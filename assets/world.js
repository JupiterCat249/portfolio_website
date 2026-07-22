(function () {
    'use strict';

    // =================================================================================
    // --- CONFIG & CONSTANTS ---
    // =================================================================================

    const LERP_FACTOR = 0.08; // Camera smoothing factor
    const MOVE_SPEED = 5;

    // =================================================================================
    // --- DOM ELEMENTS ---
    // =================================================================================

    const world = document.getElementById('world');
    const backgroundContentLayer = document.getElementById('background-content-layer');
    const interactionPrompt = document.getElementById('interactionPrompt');
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
        if (backgroundContentLayer) {
            const parallaxFactor = 0.3;
            backgroundContentLayer.style.backgroundPosition = `${-camera.x * parallaxFactor}px ${-camera.y * parallaxFactor}px`;
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
            if (window.getSelection().toString().length > 0) return;
            if (e.target === eventPanelOverlay) closeDetailPanel(); // Only close if clicking the overlay itself
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
            if (e.target.closest('.event-panel')) return; // Ignore clicks inside the panel
            e.preventDefault(); // Prevent default touch actions

            isPointerDown = true;
            hasDragged = false;
            const coords = e.touches ? e.touches[0] : e;
            dragStart.x = coords.clientX;
            dragStart.y = coords.clientY;
            cameraStart.x = targetCamera.x; // Drag from the target position
            cameraStart.y = targetCamera.y;
            document.body.style.cursor = 'grabbing';
        }

        function onPointerMove(e) {
            if (!isPointerDown) return;
            e.preventDefault(); // Prevent default touch actions
            hasDragged = true;
            const coords = e.touches ? e.touches[0] : e;
            const dx = coords.clientX - dragStart.x;
            const dy = coords.clientY - dragStart.y;
            targetCamera.x = cameraStart.x - dx;
            targetCamera.y = cameraStart.y - dy;
        }

        function onPointerUp(e) {
            if (!isPointerDown) return;
            isPointerDown = false;
            document.body.style.cursor = 'default';
            if (!hasDragged) {
                // This was a click, not a drag
                const screenX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
                const screenY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
                if (screenX === undefined || screenY === undefined) return;

                const worldX = (screenX - window.innerWidth / 2) + camera.x;
                const worldY = (screenY - window.innerHeight / 2) + camera.y;
                targetCamera.x = worldX;
                targetCamera.y = worldY;
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
        
        // We don't show hints or popups initially in free-roam mode
    }

    // =================================================================================
    // --- UI STATE & INTERACTIONS ---
    // =================================================================================

    // All interaction hint, popup, and panel logic is deprecated for now
    // and will be replaced by the proximity-based system.
    function updateInteractionHints(state) { return; }
    function showBriefingFloat(nodeId) { return; }
    function hideBriefingFloat() { return; }
    function openDetailPanel() { return; }
    function closeDetailPanel() {
        scrollingDirection = 0; // Still need this to stop scroll
        eventPanelOverlay.classList.remove('visible');
    }
    function handleInteraction() { return; }
    
    // --- Kick it off ---
    init();

})();