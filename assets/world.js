(function () {
    'use strict';

    // =================================================================================
    // --- CONFIG & CONSTANTS ---
    // =================================================================================

    const LERP_FACTOR = 0.08; // Camera smoothing factor

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
    let playerNodeId = null;
    let activeBriefingNodeId = null;
    let camera = { x: 0, y: 0 };
    let targetCamera = { x: 0, y: 0 };
    let scrollingDirection = 0; // -1 for up, 1 for down, 0 for none

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
        updateCamera();
        updatePanelScroll();
        requestAnimationFrame(loop);
    }

    function updatePanelScroll() {
        if (!eventPanelOverlay.classList.contains('visible') || scrollingDirection === 0) {
            return;
        }
        const contentScroller = eventPanelOverlay.querySelector('.event-panel');
        const scrollAmount = 10; // Adjust for desired speed
        contentScroller.scrollBy(0, scrollingDirection * scrollAmount);
    }

    function updateCamera() {
        if (eventPanelOverlay.classList.contains('visible')) return;

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

    // =================================================================================
    // --- DATA LOADING & PARSING ---
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

        // If no edges were manually defined, create them linearly
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
        eventPanelOverlay.querySelector('.event-panel-close').addEventListener('click', closeDetailPanel);
        eventPanelOverlay.addEventListener('click', (e) => {
            if (window.getSelection().toString().length > 0) {
                return;
            }
            if (!e.target.classList.contains('event-panel-close')) {
                closeDetailPanel();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                return; 
            }

            const key = e.key.toLowerCase();

            if (eventPanelOverlay.classList.contains('visible')) {
                let handled = true;
                switch (key) {
                    case 'e':
                    case 'escape':
                        closeDetailPanel();
                        break;
                    case 'w':
                        scrollingDirection = -1;
                        break;
                    case 's':
                        scrollingDirection = 1;
                        break;
                    default:
                        handled = false;
                        break;
                }
                if (handled) e.preventDefault();
                return;
            }

            switch (key) {
                case 'e':
                    handleInteraction();
                    break;
                case 'escape':
                    hideBriefingFloat();
                    break;
                case 'a':
                    moveHorizontal('left');
                    break;
                case 'd':
                    moveHorizontal('right');
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if ((key === 'w' && scrollingDirection === -1) || (key === 's' && scrollingDirection === 1)) {
                scrollingDirection = 0;
            }
        });

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
            if (node.portal) nodeEl.classList.add('portal-node'); // Add portal class
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;
            nodeEl.dataset.id = node.id;
            nodeEl.innerHTML = `<div class="map-node-label">${node.label || node.id}</div>`;
            nodeEl.addEventListener('click', () => onNodeClick(node.id));
            mapContainer.appendChild(nodeEl);
        }
        
        world.appendChild(mapContainer);
        world.appendChild(briefingFloatElement);
    }
    
    function setupInitialState() {
        if (!mapData.nodes || mapData.nodes.length === 0) throw new Error("Map data contains no nodes.");
        const startNode = mapData.nodes[0];
        if (typeof startNode.x !== 'number' || typeof startNode.y !== 'number') throw new Error(`Start node '${startNode.id}' has invalid coordinates.`);
        
        playerNodeId = startNode.id;
        camera.x = targetCamera.x = startNode.x;
        camera.y = targetCamera.y = startNode.y;
        
        updatePlayerMarker();
        updateInteractionHints('default');
        setTimeout(() => showBriefingFloat(playerNodeId), 500);
    }

    // =================================================================================
    // --- UI STATE & INTERACTIONS ---
    // =================================================================================

    function updateInteractionHints(state) {
        let hints = [];
        const node = activeBriefingNodeId ? mapData.nodes.find(n => n.id === activeBriefingNodeId) : null;

        switch (state) {
            case 'briefing':
                if (node) {
                    hints.push(node.portal ? '[E] Enter Portal' : '[E] View Details');
                }
                hints.push('[A/D] To Move');
                break;
            case 'panel':
                hints.push('[W/S] Scroll');
                hints.push('[E] Close');
                break;
            case 'moving':
                // No hints during transition
                break;
            default:
                hints.push('[Click Node] or [A/D] To Move');
                break;
        }

        if (hints.length) {
            interactionPrompt.innerHTML = hints.map(h => `<span>${h}</span>`).join('');
            interactionPrompt.classList.add('visible');
        } else {
            interactionPrompt.classList.remove('visible');
        }
    }
    function onNodeClick(nodeId) {
        const targetNode = mapData.nodes.find(n => n.id === nodeId);
        if (!targetNode) return;

        if (nodeId === playerNodeId) {
            handleInteraction();
        } else {
            playerNodeId = nodeId;
            if (typeof targetNode.x === 'number' && typeof targetNode.y === 'number') {
                targetCamera.x = targetNode.x;
                targetCamera.y = targetNode.y;
            } else {
                console.error(`Clicked node '${nodeId}' has invalid coordinates! Halting camera.`);
                return;
            }
            
            updatePlayerMarker();
            hideBriefingFloat();
            setTimeout(() => showBriefingFloat(nodeId), 400);
        }
    }

    function showBriefingFloat(nodeId) {
        hideBriefingFloat();
        
        const node = mapData.nodes.find(n => n.id === nodeId);
        const content = contentMap.get(nodeId);
        if (!node || !content) return;
        
        activeBriefingNodeId = nodeId;

        briefingFloatElement.querySelector('.briefing-title').textContent = content.title || node.label;
        briefingFloatElement.querySelector('.briefing-image').style.backgroundImage = content.firstImage ? `url(${content.firstImage})` : 'none';
        briefingFloatElement.onclick = handleInteraction;
        briefingFloatElement.style.cursor = 'pointer';

        briefingFloatElement.style.left = `${node.x}px`;
        briefingFloatElement.style.top = `${node.y - 30}px`;
        briefingFloatElement.classList.add('visible');
        
        updateInteractionHints('briefing');
    }

    function hideBriefingFloat() {
        if (activeBriefingNodeId) {
            briefingFloatElement.classList.remove('visible');
            briefingFloatElement.onclick = null;
            briefingFloatElement.style.cursor = 'default';
            activeBriefingNodeId = null;
            updateInteractionHints('moving'); // Use 'moving' state during transition
        }
    }

    function openDetailPanel() {
        const content = contentMap.get(playerNodeId);
        if (!content) return;
        
        eventPanelOverlay.querySelector('.event-panel-content').innerHTML = content.fullHtml;
        eventPanelOverlay.classList.add('visible');
        updateInteractionHints('panel');
    }
    
    function closeDetailPanel() {
        scrollingDirection = 0; // Stop scrolling when panel closes
        eventPanelOverlay.classList.remove('visible');
        showBriefingFloat(playerNodeId);
    }
    
    function handleInteraction() {
        if (!activeBriefingNodeId) return;
        const node = mapData.nodes.find(n => n.id === activeBriefingNodeId);
        if (!node) return;

        if (node.portal) {
            document.body.classList.add('fade-out');
            setTimeout(() => { window.location.href = node.portal; }, 400);
        } else {
            hideBriefingFloat();
            openDetailPanel();
        }
    }
    
    function moveHorizontal(direction) {
        if (!playerNodeId) return;

        const currentIndex = mapData.nodes.findIndex(n => n.id === playerNodeId);
        if (currentIndex === -1) return;

        let targetIndex = -1;
        if (direction === 'left') {
            targetIndex = currentIndex - 1;
        } else if (direction === 'right') {
            targetIndex = currentIndex + 1;
        }

        if (targetIndex >= 0 && targetIndex < mapData.nodes.length) {
            const targetNode = mapData.nodes[targetIndex];
            onNodeClick(targetNode.id);
        }
    }

    function updatePlayerMarker() {
        document.querySelectorAll('.map-node').forEach(el => {
            el.classList.toggle('current', el.dataset.id === playerNodeId);
        });
    }

    // --- Kick it off ---
    init();

})();