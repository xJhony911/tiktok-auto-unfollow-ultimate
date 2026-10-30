// ==UserScript==
// @name         TikTok Auto-Unfollow Ultimate
// @namespace    https://github.com/xjhony911/tiktok-auto-unfollow-ultimate
// @version      1.1.0
// @description  Suite definitiva para TikTok Web con v1.0: efectos de sonido personalizables con volumen, silenciador, UI arrastrable por pestañas, Whitelist, detector de Captcha y modo Anti-Sleep.
// @author       xjhony911
// @match        https://www.tiktok.com/@*
// @icon         https://www.tiktok.com/favicon.ico
// @updateURL    https://raw.githubusercontent.com/xjhony911/tiktok-auto-unfollow-ultimate/main/tiktok-auto-unfollow.user.js
// @downloadURL  https://raw.githubusercontent.com/xjhony911/tiktok-auto-unfollow-ultimate/main/tiktok-auto-unfollow.user.js
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;

    function leerJSON(raw) { try { return JSON.parse(raw); } catch { return {}; } }

    const VERSION = '1.1.0';

    // ==========================================
    // 1. PERFILES PREDETERMINADOS (PRESETS)
    // ==========================================
    const PRESETS = {
        lento:  { nombre: '🐢 Lento (Pausado)', limiteTanda: 100, descansoMin: 30, delayMin: 2500, delayMax: 4500, pausaRecarga: 15 },
        medio:  { nombre: '🚶 Medio (Equilibrado)',  limiteTanda: 180, descansoMin: 15, delayMin: 1600, delayMax: 3000, pausaRecarga: 12 },
        rapido: { nombre: '🏃 Rápido (Turbo)',       limiteTanda: 250, descansoMin: 8,  delayMin: 1100, delayMax: 2100, pausaRecarga: 8  },
        veloz:  { nombre: '⚡ Veloz (Overclock 2x)', limiteTanda: 320, descansoMin: 4,  delayMin: 850,  delayMax: 1600, pausaRecarga: 6  },
        custom: { nombre: '⚙️ Personalizado',        limiteTanda: 200, descansoMin: 10, delayMin: 1200, delayMax: 2200, pausaRecarga: 8  }
    };

    // ==========================================
    // 2. ESTADO PERSISTENTE Y CONFIGURACIÓN
    // ==========================================
    const defaultConfig = {
        presetActivo: 'lento',
        ...PRESETS.lento,
        ignorarAmigos: false,
        ignorarVerificados: false,
        autoStopShadowban: true,
        whitelist: '',
        soundMuted: false,
        soundVolume: 50, // Porcentaje 0 - 100
        panelMinimizado: false,
        posX: null,
        posY: null
    };

    let config = Object.assign({}, defaultConfig, leerJSON(localStorage.getItem('tt_ult_config') || '{}'));
    let contadorTanda = parseInt(localStorage.getItem('tt_tanda_count') || '0', 10);
    let totalHoy = parseInt(localStorage.getItem('tt_total_hoy') || '0', 10);
    let activo = false; // Inicio manual en cada carga.
    let historialUnfollows = leerJSON(localStorage.getItem('tt_unfollow_history') || '[]');
    if (!Array.isArray(historialUnfollows)) historialUnfollows = [];
    let ultimoConteoPerfil = parseInt(localStorage.getItem('tt_last_profile_count') || '0', 10);
    let inicioSesionMs = parseInt(sessionStorage.getItem('tt_session_start') || Date.now().toString(), 10);
    sessionStorage.setItem('tt_session_start', inicioSesionMs.toString());

    let isLoopRunning = false;
    let isReloading = false;
    let saltarDescanso = false;

    const guardarConfig = () => localStorage.setItem('tt_ult_config', JSON.stringify(config));
    const esperar = (ms) => new Promise(res => setTimeout(res, ms));
    const tiempoAleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    function recargaSegura() {
        if (isReloading) return;
        isReloading = true;
        reproducirSonido('recarga');
        setTimeout(() => location.reload(), 600);
    }

    // ==========================================
    // 3. SINTETIZADOR DE EFECTOS DE SONIDO (SFX)
    // ==========================================
    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function reproducirSonido(tipo) {
        if (config.soundMuted) return;
        try {
            const ctx = getAudioContext();
            const masterGain = ctx.createGain();
            const vol = (config.soundVolume / 100) * 0.15; // Factor de escala seguro para los oídos
            masterGain.gain.setValueAtTime(vol, ctx.currentTime);
            masterGain.connect(ctx.destination);

            const osc = ctx.createOscillator();
            osc.connect(masterGain);

            const ahora = ctx.currentTime;

            if (tipo === 'unfollow') {
                // Tono corto y alegre (Ping agudo)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ahora); // D5
                osc.frequency.exponentialRampToValueAtTime(880, ahora + 0.08); // A5
                osc.start(ahora);
                osc.stop(ahora + 0.1);
            } else if (tipo === 'alerta') {
                // Tono grave de advertencia (Captcha / Error)
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, ahora);
                osc.frequency.linearRampToValueAtTime(120, ahora + 0.25);
                osc.start(ahora);
                osc.stop(ahora + 0.28);
            } else if (tipo === 'recarga') {
                // Tono ascendente de transición
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, ahora);
                osc.frequency.exponentialRampToValueAtTime(600, ahora + 0.2);
                osc.start(ahora);
                osc.stop(ahora + 0.22);
            } else if (tipo === 'descanso') {
                // Tono doble de aviso de tanda
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ahora);
                osc.frequency.setValueAtTime(659.25, ahora + 0.12);
                osc.start(ahora);
                osc.stop(ahora + 0.25);
            }
        } catch (e) {}
    }

    // Modo Anti-Suspensión (Audio inaudible de fondo)
    function activarAntiSuspension() {
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.00001;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
        } catch (e) {}
    }
    // Sin audio inaudible permanente: se pausa al ocultar la pestaña.

    // ==========================================
    // 4. INTERFAZ GRÁFICA DE USUARIO (GUI)
    // ==========================================
    const estilos = document.createElement('style');
    estilos.innerHTML = `
        #tt-ult-panel {
            position: fixed; bottom: 20px; right: 20px; z-index: 999999;
            background: #111111; color: #f1f1f1; width: 315px;
            border-radius: 12px; font-family: 'Segoe UI', system-ui, sans-serif;
            border: 2px solid #25f4ee; box-shadow: 0 10px 30px rgba(0,0,0,0.85);
            overflow: hidden; font-size: 12px; user-select: none;
        }
        .tt-header {
            background: linear-gradient(90deg, #1a1a1a, #242424); padding: 10px 14px;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #333; cursor: move;
        }
        .tt-title { font-weight: 800; color: #25f4ee; font-size: 13px; display: flex; align-items: center; gap: 6px; }
        .tt-badge { background: #25f4ee22; color: #25f4ee; border: 1px solid #25f4ee66; padding: 1px 5px; border-radius: 4px; font-size: 10px; }
        .tt-header-btns span { cursor: pointer; padding: 2px 6px; border-radius: 4px; color: #aaa; font-weight: bold; }
        .tt-header-btns span:hover { background: #333; color: #fff; }
        .tt-tabs { display: flex; background: #181818; border-bottom: 1px solid #2c2c2c; }
        .tt-tab {
            flex: 1; text-align: center; padding: 7px 0; cursor: pointer;
            color: #888; font-weight: 600; font-size: 11px; border-bottom: 2px solid transparent; transition: 0.15s;
        }
        .tt-tab.active { color: #25f4ee; border-bottom-color: #25f4ee; background: #1f1f1f; }
        .tt-body { padding: 12px 14px; }
        .tt-body.hidden, .tt-tabs.hidden { display: none; }
        .tt-tab-content { display: none; }
        .tt-tab-content.active { display: block; }
        .tt-stats-card {
            background: #1a1a1a; padding: 10px; border-radius: 8px;
            margin-bottom: 10px; border-left: 3px solid #fe2c55;
        }
        .tt-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
        .tt-stat-box { background: #222; padding: 6px 8px; border-radius: 5px; }
        .tt-stat-label { font-size: 10px; color: #999; display: block; }
        .tt-stat-val { font-size: 13px; font-weight: 700; color: #fff; }
        .tt-progress-bg { width: 100%; height: 6px; background: #2a2a2a; border-radius: 3px; overflow: hidden; }
        .tt-progress-bar { height: 100%; background: linear-gradient(90deg, #25f4ee, #fe2c55); width: 0%; transition: width 0.3s; }
        .tt-timer { color: #ffcc00; font-weight: 700; margin: 8px 0; display: block; text-align: center; font-size: 12px; }
        .tt-form-group { margin-bottom: 8px; }
        .tt-form-group label { display: block; color: #bbb; font-size: 11px; margin-bottom: 3px; }
        .tt-select, .tt-input, .tt-textarea {
            width: 100%; background: #1e1e1e; color: #fff; border: 1px solid #383838;
            padding: 5px 8px; border-radius: 5px; font-size: 12px; box-sizing: border-box;
        }
        .tt-textarea { height: 55px; resize: none; font-family: monospace; font-size: 11px; }
        .tt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .tt-checkbox { display: flex; align-items: center; gap: 6px; margin: 6px 0; cursor: pointer; color: #ddd; font-size: 11px; }
        .tt-btn {
            width: 100%; border: none; padding: 8px 10px; border-radius: 6px;
            cursor: pointer; font-weight: 700; font-size: 12px; margin-bottom: 6px; transition: 0.2s;
        }
        .tt-btn:hover { filter: brightness(1.1); }
        .tt-btn-sec { background: #222; color: #25f4ee; border: 1px solid #25f4ee; font-size: 11px; padding: 6px; }
        .tt-log-box {
            background: #0b0b0b; border: 1px solid #282828; border-radius: 6px;
            height: 140px; overflow-y: auto; padding: 6px 8px; font-family: monospace;
            font-size: 10.5px; color: #ccc; margin-bottom: 8px; line-height: 1.4;
        }
        .tt-log-entry { border-bottom: 1px solid #1a1a1a; padding: 2px 0; }
        .tt-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; color: #666; font-size: 10px; }
        .tt-link-btn { background: none; border: none; color: #888; font-size: 10px; cursor: pointer; text-decoration: underline; padding: 0; }
        .tt-link-btn:hover { color: #fff; }
    `;
    document.head.appendChild(estilos);

    const panel = document.createElement('div');
    panel.id = 'tt-ult-panel';
    if (config.posX !== null && config.posY !== null) {
        panel.style.left = `${config.posX}px`;
        panel.style.top = `${config.posY}px`;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
    }

    panel.innerHTML = `
        <div class="tt-header" id="tt-drag-header" title="Arrastra para mover el panel">
            <span class="tt-title">⚡ TikTok Unfollow <span class="tt-badge">v${VERSION}</span></span>
            <div class="tt-header-btns">
                <span id="tt-min-btn" title="Minimizar/Maximizar">${config.panelMinimizado ? '➕' : '➖'}</span>
            </div>
        </div>

        <div class="tt-tabs ${config.panelMinimizado ? 'hidden' : ''}" id="tt-tabs-bar">
            <div class="tt-tab active" data-tab="tab-main">📊 Control</div>
            <div class="tt-tab" data-tab="tab-filters">🛡️ Filtros</div>
            <div class="tt-tab" data-tab="tab-audio">🔊 Audio</div>
            <div class="tt-tab" data-tab="tab-logs">📜 Logs</div>
        </div>

        <div class="tt-body ${config.panelMinimizado ? 'hidden' : ''}" id="tt-body-wrap">
            <!-- PESTAÑA 1: CONTROL PRINCIPAL -->
            <div class="tt-tab-content active" id="tab-main">
                <div class="tt-stats-card">
                    <div class="tt-stats-grid">
                        <div class="tt-stat-box">
                            <span class="tt-stat-label">Tanda Actual</span>
                            <span class="tt-stat-val" id="ui-tanda">${contadorTanda} / ${config.limiteTanda}</span>
                        </div>
                        <div class="tt-stat-box">
                            <span class="tt-stat-label">Cambios UI (acumulados)</span>
                            <span class="tt-stat-val" style="color:#fe2c55;" id="ui-total">${totalHoy}</span>
                        </div>
                        <div class="tt-stat-box">
                            <span class="tt-stat-label">Velocidad Media</span>
                            <span class="tt-stat-val" style="color:#00ff88;" id="ui-rate">-- /h</span>
                        </div>
                        <div class="tt-stat-box">
                            <span class="tt-stat-label">ETA orientativa</span>
                            <span class="tt-stat-val" style="color:#25f4ee;" id="ui-eta">Calculando...</span>
                        </div>
                    </div>
                    <div class="tt-progress-bg">
                        <div class="tt-progress-bar" id="ui-prog-bar"></div>
                    </div>
                </div>

                <span class="tt-timer" id="tt-timer">Estado: Iniciando...</span>

                <div class="tt-form-group">
                    <label>Perfil de Velocidad:</label>
                    <select id="tt-preset-select" class="tt-select">
                        <option value="lento" ${config.presetActivo === 'lento' ? 'selected' : ''}>${PRESETS.lento.nombre}</option>
                        <option value="medio" ${config.presetActivo === 'medio' ? 'selected' : ''}>${PRESETS.medio.nombre}</option>
                        <option value="rapido" ${config.presetActivo === 'rapido' ? 'selected' : ''}>${PRESETS.rapido.nombre}</option>
                        <option value="veloz" ${config.presetActivo === 'veloz' ? 'selected' : ''}>${PRESETS.veloz.nombre}</option>
                        <option value="custom" ${config.presetActivo === 'custom' ? 'selected' : ''}>${PRESETS.custom.nombre}</option>
                    </select>
                </div>

                <button id="tt-toggle" class="tt-btn" style="background:${activo ? '#fe2c55' : '#00ff88'}; color:${activo ? '#fff' : '#000'};">
                    ${activo ? '⏸ Pausar (Alt+P)' : '▶ Iniciar / Reanudar (Alt+P)'}
                </button>
                <button id="tt-skip" class="tt-btn tt-btn-sec">
                    ⚡ Saltarse enfriamiento / Reset tanda
                </button>
            </div>

            <!-- PESTAÑA 2: FILTROS Y SEGURIDAD -->
            <div class="tt-tab-content" id="tab-filters">
                <label class="tt-checkbox">
                    <input type="checkbox" id="chk-amigos" ${config.ignorarAmigos ? 'checked' : ''}>
                    🤝 Conservar "Amigos" (Seguimiento mutuo)
                </label>
                <label class="tt-checkbox">
                    <input type="checkbox" id="chk-verificados" ${config.ignorarVerificados ? 'checked' : ''}>
                    ☑️ Conservar cuentas Verificadas (Check Azul)
                </label>
                <label class="tt-checkbox">
                    <input type="checkbox" id="chk-shadowban" ${config.autoStopShadowban ? 'checked' : ''}>
                    🛡️ Auto-Enfriar si TikTok ignora los clics
                </label>

                <div class="tt-form-group" style="margin-top:10px;">
                    <label>Lista Blanca / Whitelist (usuarios separados por coma):</label>
                    <textarea id="inp-whitelist" class="tt-textarea" placeholder="ej: brawlstars, segaofficial, arii">${String(config.whitelist).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textarea>
                </div>
            </div>

            <!-- PESTAÑA 3: AUDIO Y EFECTOS SONOROS -->
            <div class="tt-tab-content" id="tab-audio">
                <label class="tt-checkbox" style="margin-bottom: 12px; font-weight: bold; color: #25f4ee;">
                    <input type="checkbox" id="chk-mute" ${config.soundMuted ? 'checked' : ''}>
                    🔇 Silenciar todos los sonidos (Mute)
                </label>

                <div class="tt-form-group">
                    <label>Volumen de efectos: <b id="lbl-vol" style="color:#00ff88;">${config.soundVolume}%</b></label>
                    <input type="range" id="rng-vol" min="0" max="100" value="${config.soundVolume}" style="width:100%; cursor:pointer; accent-color:#00ff88;">
                </div>

                <div style="background:#1a1a1a; padding:8px; border-radius:6px; margin-top:10px;">
                    <span style="font-size:10px; color:#888; display:block; margin-bottom:6px;">Prueba los sonidos de cada situación:</span>
                    <div class="tt-grid">
                        <button class="tt-btn tt-btn-sec" id="test-sfx-unfollow" style="font-size:10px; padding:4px;">✨ Unfollow</button>
                        <button class="tt-btn tt-btn-sec" id="test-sfx-descanso" style="font-size:10px; padding:4px;">⏳ Tanda/Espera</button>
                        <button class="tt-btn tt-btn-sec" id="test-sfx-alerta" style="font-size:10px; padding:4px;">⚠️ Alerta/Captcha</button>
                        <button class="tt-btn tt-btn-sec" id="test-sfx-recarga" style="font-size:10px; padding:4px;">🔄 Recarga</button>
                    </div>
                </div>
            </div>

            <!-- PESTAÑA 4: LOGS Y EXPORTACIÓN CSV -->
            <div class="tt-tab-content" id="tab-logs">
                <div class="tt-log-box" id="tt-log-container"></div>
                <div class="tt-grid">
                    <button id="tt-export-csv" class="tt-btn tt-btn-sec">📥 Exportar CSV (${historialUnfollows.length})</button>
                    <button id="tt-clear-logs" class="tt-btn tt-btn-sec" style="color:#fe2c55; border-color:#fe2c55;">🗑️ Borrar Historial</button>
                </div>
            </div>

            <div class="tt-footer">
                <button id="tt-reset-total" class="tt-link-btn">Resetear contador hoy</button>
                <span>Alt+P: Pausa | Alt+H: Ocultar</span>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // ==========================================
    // 5. FUNCIONES DE UI, LOGS Y ESTADÍSTICAS
    // ==========================================
    function agregarLog(mensaje) {
        const hora = new Date().toLocaleTimeString('es-EC', { hour12: false });
        const caja = document.getElementById('tt-log-container');
        if (caja) {
            const div = document.createElement('div');
            div.className = 'tt-log-entry';
            div.textContent = `[${hora}] ${mensaje.replace(/<[^>]*>/g, '')}`;
            caja.prepend(div);
        }
    }

    function obtenerTotalSiguiendoPerfil() {
        const el = document.querySelector('[data-e2e="following-count"]');
        if (el) {
            const texto = el.innerText.replace(/,/g, '').trim();
            const num = parseInt(texto, 10);
            if (!isNaN(num)) return num;
        }
        return null;
    }

    function actualizarEstadisticasUI() {
        document.getElementById('ui-tanda').innerText = `${contadorTanda} / ${config.limiteTanda}`;
        document.getElementById('ui-total').innerText = totalHoy;
        const pct = Math.min(100, Math.round((contadorTanda / config.limiteTanda) * 100));
        document.getElementById('ui-prog-bar').style.width = `${pct}%`;

        const horasTranscurridas = Math.max(0.02, (Date.now() - inicioSesionMs) / 3600000);
        const tasaHora = totalHoy > 0 ? Math.round(totalHoy / horasTranscurridas) : 700;
        document.getElementById('ui-rate').innerText = `~${tasaHora} /h`;

        const restantesPerfil = obtenerTotalSiguiendoPerfil();
        if (restantesPerfil !== null && tasaHora > 0) {
            const horasRestantes = restantesPerfil / tasaHora;
            const h = Math.floor(horasRestantes);
            const m = Math.round((horasRestantes - h) * 60);
            document.getElementById('ui-eta').innerText = `${h}h ${m}m`;
        }
    }

    historialUnfollows.slice(-30).forEach(item => {
        agregarLog(`Unfollow: <b style="color:#25f4ee;">@${item.user}</b>`);
    });
    actualizarEstadisticasUI();

    // Pestañas
    document.querySelectorAll('.tt-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tt-tab, .tt-tab-content').forEach(el => el.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Arrastrar Panel (Draggable)
    let arrastrando = false, offsetX = 0, offsetY = 0;
    const header = document.getElementById('tt-drag-header');
    header.addEventListener('mousedown', (e) => {
        if (e.target.id === 'tt-min-btn') return;
        arrastrando = true;
        offsetX = e.clientX - panel.getBoundingClientRect().left;
        offsetY = e.clientY - panel.getBoundingClientRect().top;
    });
    document.addEventListener('mousemove', (e) => {
        if (!arrastrando) return;
        const x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - offsetX));
        const y = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - offsetY));
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
        config.posX = x;
        config.posY = y;
    });
    document.addEventListener('mouseup', () => {
        if (arrastrando) { arrastrando = false; guardarConfig(); }
    });

    // Minimizar
    document.getElementById('tt-min-btn').addEventListener('click', () => {
        config.panelMinimizado = !config.panelMinimizado;
        guardarConfig();
        document.getElementById('tt-body-wrap').classList.toggle('hidden', config.panelMinimizado);
        document.getElementById('tt-tabs-bar').classList.toggle('hidden', config.panelMinimizado);
        document.getElementById('tt-min-btn').innerText = config.panelMinimizado ? '➕' : '➖';
    });

    // Selector de Presets
    document.getElementById('tt-preset-select').addEventListener('change', (e) => {
        const sel = e.target.value;
        config.presetActivo = sel;
        if (PRESETS[sel]) Object.assign(config, PRESETS[sel]);
        guardarConfig();
        actualizarEstadisticasUI();
    });

    // Filtros y Audio
    document.getElementById('chk-amigos').addEventListener('change', e => { config.ignorarAmigos = e.target.checked; guardarConfig(); });
    document.getElementById('chk-verificados').addEventListener('change', e => { config.ignorarVerificados = e.target.checked; guardarConfig(); });
    document.getElementById('chk-shadowban').addEventListener('change', e => { config.autoStopShadowban = e.target.checked; guardarConfig(); });
    document.getElementById('inp-whitelist').addEventListener('input', e => { config.whitelist = e.target.value; guardarConfig(); });

    // Controles de Audio GUI
    document.getElementById('chk-mute').addEventListener('change', e => {
        config.soundMuted = e.target.checked;
        guardarConfig();
    });
    document.getElementById('rng-vol').addEventListener('input', e => {
        config.soundVolume = parseInt(e.target.value, 10);
        document.getElementById('lbl-vol').innerText = `${config.soundVolume}%`;
        guardarConfig();
    });

    // Botones de prueba de sonido
    document.getElementById('test-sfx-unfollow').addEventListener('click', () => reproducirSonido('unfollow'));
    document.getElementById('test-sfx-descanso').addEventListener('click', () => reproducirSonido('descanso'));
    document.getElementById('test-sfx-alerta').addEventListener('click', () => reproducirSonido('alerta'));
    document.getElementById('test-sfx-recarga').addEventListener('click', () => reproducirSonido('recarga'));

    // Pausar / Reanudar
    const toggleScript = () => {
        activo = !activo;
        localStorage.setItem('tt_unfollow_active', activo ? 'true' : 'false');
        const btn = document.getElementById('tt-toggle');
        btn.innerText = activo ? '⏸ Pausar (Alt+P)' : '▶ Iniciar / Reanudar (Alt+P)';
        btn.style.background = activo ? '#fe2c55' : '#00ff88';
        btn.style.color = activo ? '#fff' : '#000';
        if (activo && !isLoopRunning) buclePrincipal();
        else if (!activo) document.getElementById('tt-timer').innerText = "Estado: En pausa manual.";
    };
    document.getElementById('tt-toggle').addEventListener('click', toggleScript);

    // Hotkeys (Alt+P, Alt+H)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); toggleScript(); }
        if (e.altKey && e.key.toLowerCase() === 'h') {
            e.preventDefault();
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    });

    // Saltar enfriamiento
    document.getElementById('tt-skip').addEventListener('click', () => {
        contadorTanda = 0;
        localStorage.setItem('tt_tanda_count', '0');
        saltarDescanso = true;
        reproducirSonido('descanso');
        actualizarEstadisticasUI();
        document.getElementById('tt-timer').innerText = "⚡ ¡Enfriamiento saltado!";
    });

    // Resetear contador hoy
    document.getElementById('tt-reset-total').addEventListener('click', () => {
        totalHoy = 0; contadorTanda = 0;
        inicioSesionMs = Date.now();
        localStorage.setItem('tt_total_hoy', '0');
        localStorage.setItem('tt_tanda_count', '0');
        sessionStorage.setItem('tt_session_start', inicioSesionMs.toString());
        actualizarEstadisticasUI();
    });

    // Exportar CSV y Limpiar Historial
    document.getElementById('tt-export-csv').addEventListener('click', () => {
        if (historialUnfollows.length === 0) return alert('Aún no hay cuentas en el historial.');
        let csv = 'Usuario,Fecha_Hora\n' + historialUnfollows.map(i => `"${i.user}","${i.time}"`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiktok_unfollows_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    document.getElementById('tt-clear-logs').addEventListener('click', () => {
        historialUnfollows = [];
        localStorage.setItem('tt_unfollow_history', '[]');
        document.getElementById('tt-log-container').innerHTML = '';
        document.getElementById('tt-export-csv').innerText = '📥 Exportar CSV (0)';
    });

    // ==========================================
    // 6. DETECTOR DE CAPTCHA Y EXTRACCIÓN DOM
    // ==========================================
    function hayCaptchaActivo() {
        return !!(document.querySelector('#captcha-verify-image') ||
                  document.querySelector('[class*="captcha"]') ||
                  document.querySelector('iframe[src*="captcha"]'));
    }

    function extraerDatosFila(boton) {
        let contenedor = boton.parentElement;
        for (let i = 0; i < 4 && contenedor; i++) {
            const enlace = contenedor.querySelector('a[href*="/@"]');
            if (enlace) {
                const match = enlace.getAttribute('href').match(/\/@([^/?]+)/);
                const username = match ? match[1].toLowerCase() : 'desconocido';
                const tieneCheckAzul = !!contenedor.querySelector('svg circle[fill="#20D5EC"], svg path[fill="#20D5EC"]');
                return { username, tieneCheckAzul };
            }
            contenedor = contenedor.parentElement;
        }
        return { username: 'usuario', tieneCheckAzul: false };
    }

    function buscarBotonesValidos() {
        const modal = document.querySelector('[data-e2e="follow-info-popup"]');
        if (!modal) return [];
        const blanca = String(config.whitelist).split(',').map(x => x.trim().replace(/^@/, '').toLowerCase());
        return [...modal.querySelectorAll('button[data-e2e="follow-button"]')].filter(btn => {
            const t = btn.textContent.trim();
            if (!/^(Siguiendo|Following|Amigos|Friends)$/.test(t) || btn.disabled) return false;
            if (config.ignorarAmigos && /^(Amigos|Friends)$/.test(t)) return false;
            const {username, tieneCheckAzul} = extraerDatosFila(btn);
            if (['usuario','desconocido'].includes(username) || blanca.includes(username)) return false;
            if (config.ignorarVerificados && tieneCheckAzul) return false;
            btn.dataset.ttUser = username;
            return true;
        });
    }

    function cerrarModal() {
        const btnCerrar = document.querySelector('[data-e2e="follow-info-popup"] [aria-label="Close"]') ||
                          Array.from(document.querySelectorAll('button, div, svg')).find(el => el.getAttribute('aria-label') === 'Close' || el.innerText === '✕');
        if (btnCerrar) btnCerrar.click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    }

    // ==========================================
    // 7. BUCLE PRINCIPAL (V1.0 CON SONIDOS)
    // ==========================================
    // One live DOM target per iteration. Never replay a stale array after React updates.
    async function buclePrincipal() {
        if (isLoopRunning) return;
        isLoopRunning = true;
        const visitados = new Set();
        const ruta = location.pathname;
        let vacios = 0;
        const estado = texto => { document.getElementById('tt-timer').textContent = texto; };
        const parar = texto => { activo = false; estado(texto); agregarLog(texto); };
        try {
            if (!navigator.locks) { parar('Este navegador no permite bloquear ejecuciones duplicadas.'); return; }
            await navigator.locks.request('tt-unfollow-run', {ifAvailable:true}, async lock => {
                if (!lock) { parar('Ya hay otra pestaña ejecutando el script.'); return; }
                const modal = document.querySelector('[data-e2e="follow-info-popup"]');
                if (!modal || !confirm('Abre la pestaña Siguiendo de TU perfil. ¿Iniciar una tanda en esa lista?')) {
                    parar('Abre tu lista Siguiendo y pulsa Iniciar.'); return;
                }
                const lista = modal.querySelector('[class*="DivUserListContainer"]');
                if (!lista) { parar('Lista no reconocida; no se hicieron clics.'); return; }
                contadorTanda = 0;
                while (activo) {
                    if (document.hidden || location.pathname !== ruta || !modal.isConnected) {
                        parar('Pausa: pestaña oculta, navegación o lista cerrada.'); break;
                    }
                    if (hayCaptchaActivo()) { parar('Pausa: verificación detectada.'); break; }
                    if (contadorTanda >= config.limiteTanda) { parar('Tanda terminada. Verifica los cambios antes de continuar.'); break; }
                    const boton = buscarBotonesValidos().find(b => !visitados.has(b.dataset.ttUser));
                    if (!boton) {
                        // A one-row response is not proof that the account has only one following.
                        // Trigger the list's lazy loading without reloading the whole profile.
                        estado('Esperando más filas de la lista…');
                        lista.scrollTop = Math.max(0, lista.scrollHeight - lista.clientHeight - 1);
                        lista.dispatchEvent(new Event('scroll', {bubbles:true}));
                        lista.scrollTop = lista.scrollHeight;
                        lista.dispatchEvent(new Event('scroll', {bubbles:true}));
                        await esperar(2000);
                        if (++vacios >= 5) { parar('No llegaron más cuentas. Lista agotada o carga detenida; revisa TikTok.'); break; }
                        continue;
                    }
                    vacios = 0;
                    const user = boton.dataset.ttUser;
                    visitados.add(user);
                    boton.scrollIntoView({block:'center'});
                    await esperar(250);
                    if (!activo || document.hidden || !boton.isConnected || location.pathname !== ruta) break;
                    if (!buscarBotonesValidos().includes(boton)) continue;
                    boton.click();
                    let cambio = false;
                    for (let n=0; n<20 && activo; n++) {
                        await esperar(250);
                        if (boton.isConnected && /^(Seguir|Follow|Seguir también|Follow back)$/.test(boton.textContent.trim())) {
                            cambio = true; break;
                        }
                        if (hayCaptchaActivo() || !modal.isConnected) break;
                    }
                    if (!activo) break;
                    if (!cambio) { parar('Resultado sin confirmar. Revisa avisos o confirmaciones de TikTok.'); break; }
                    contadorTanda++; totalHoy++;
                    historialUnfollows.push({user, time:new Date().toISOString(), status:'ui-observed'});
                    historialUnfollows = historialUnfollows.slice(-5000);
                    localStorage.setItem('tt_unfollow_history', JSON.stringify(historialUnfollows));
                    localStorage.setItem('tt_total_hoy', String(totalHoy));
                    agregarLog(`Cambio visual: @${user}. Pendiente de verificar al recargar.`);
                    actualizarEstadisticasUI();
                    reproducirSonido('unfollow');
                    estado(`Cambios visuales: ${contadorTanda}. No recargues durante la tanda.`);
                    const fin = Date.now() + Math.max(5000, Number(config.delayMin) || 5000);
                    while (activo && Date.now() < fin) await esperar(200);
                }
            });
        } catch (e) { parar(`Pausa por error: ${e.message}`); }
        finally {
            activo = false; isLoopRunning = false;
            localStorage.setItem('tt_unfollow_active', 'false');
            const btn = document.getElementById('tt-toggle');
            btn.textContent = '▶ Iniciar otra tanda (Alt+P)';
            btn.style.background = '#00ff88'; btn.style.color = '#000';
        }
    }

    document.getElementById('tt-skip').hidden = true;
    document.getElementById('chk-shadowban').closest('label').hidden = true;
    document.getElementById('tt-timer').textContent = 'Abre tu lista Siguiendo. Inicio manual.';
})();
