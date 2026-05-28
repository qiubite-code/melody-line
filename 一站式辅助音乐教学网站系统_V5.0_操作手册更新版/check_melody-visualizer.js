
    const $ = (id) => document.getElementById(id);
    const canvas = $('canvas');
    const ctx = canvas.getContext('2d');
    const scroller = $('scroller');
    const audioEl = $('audio');
    const stageAudioEl = $('stageAudio');
    const stageAudioMount = $('stageAudioMount');
    const audioHome = $('audioHome');
    const recordingState = $('recordingState');
    const recordingDownload = $('recordingDownload');
    const stagePlayPauseBtn = $('stagePlayPause');
    const stageSeek = $('stageSeek');
    const stageAudioTime = $('stageAudioTime');
    const stageAudioState = $('stageAudioState');
    const hideNoteNamesToggle = $('hideNoteNamesToggle');
    const comparisonCanvas = $('comparisonCanvas');
    const comparisonCtx = comparisonCanvas ? comparisonCanvas.getContext('2d') : null;
    const segmentList = $('segmentList');
    const playAllSegmentsBtn = $('playAllSegments');
    const stopAllSegmentsBtn = $('stopAllSegments');

    const startMicBtn = $('startMic');
    const stopMicBtn = $('stopMic');
    const pauseRecordingBtn = $('pauseRecording');
    const stageStartRecordingBtn = $('stageStartRecording');
    const stagePauseRecordingBtn = $('stagePauseRecording');
    const stageStopRecordingBtn = $('stageStopRecording');
    const countInOverlay = $('countInOverlay');
    const countInNumber = $('countInNumber');
    const countInText = $('countInText');
    const clearBtn = $('clear');
    const saveBtn = $('save');
    const audioFile = $('audioFile');
    const statusEl = $('status');
    const openManualBtn = $('openManual');
    const openManualFloatBtn = $('openManualFloat');
    const manualOverlay = $('manualOverlay');
    const closeManualBtn = $('closeManual');
    const generateNotationBtn = $('generateNotation');
    const exportNotationBtn = $('exportNotation');
    const startMetroBtn = $('startMetro');
    const stopMetroBtn = $('stopMetro');
    const metroIndicator = $('metroIndicator');
    const notationPanel = $('notationPanel');
    const notationOutput = $('jianpuOutput');
    const notationSummary = $('notationSummary');
    const notationScroller = $('notationScroller');
    const notationCanvas = $('notationCanvas');
    const notationCtx = notationCanvas ? notationCanvas.getContext('2d') : null;

    const controls = {
      silence: $('silence'),
      smooth: $('smooth'),
      speed: $('speed'),
      minFreq: $('minFreq'),
      maxFreq: $('maxFreq'),
      phraseGap: $('phraseGap'),
      dots: $('dots'),
      steadyMode: $('steadyMode'),
      pitchLock: $('pitchLock'),
      pitchSnap: $('pitchSnap'),
      autoScroll: $('autoScroll'),
      colorMode: $('colorMode'),
      noteLabels: $('noteLabels'),
      notationMode: $('notationMode'),
      keyRoot: $('keyRoot'),
      keyAccidentalSystem: $('keyAccidentalSystem'),
      modeType: $('modeType'),
      timeSigPreset: $('timeSigPreset'),
      timeTop: $('timeTop'),
      timeBottom: $('timeBottom'),
      tempoText: $('tempoText'),
      bpm: $('bpm'),
      metroSound: $('metroSound'),
      metroVolume: $('metroVolume')
    };

    const readout = {
      pitch: $('pitchReadout'),
      note: $('noteReadout'),
      volume: $('volumeReadout'),
      phrase: $('phraseReadout')
    };



    function syncHideNoteNamesToggle() {
      if (!hideNoteNamesToggle || !controls || !controls.noteLabels) return;
      hideNoteNamesToggle.checked = !controls.noteLabels.checked;
    }

    function setMelodyNoteLabelsVisible(visible) {
      if (controls && controls.noteLabels) controls.noteLabels.checked = !!visible;
      syncHideNoteNamesToggle();
      draw();
      if (notationEvents.length) renderNotation(notationEvents);
    }

    let audioCtx = null;
    let analyser = null;
    let timeBuffer = null;
    let micStream = null;
    let micSource = null;
    let fileSource = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordedBlobUrl = '';
    let discardNextRecording = false;
    let playbackCursorOnly = false;
    let rafId = null;
    let mode = 'idle';
    let running = false;
    let recordingStatus = 'idle';
    let countInToken = 0;
    let totalPausedDuration = 0;
    let recordingPauseStartedAt = 0;

    let points = [];
    let importedTracePoints = [];
    let recordedTracePoints = [];
    let audioSegments = [];
    let currentSegmentId = null;
    let segmentPlayers = [];
    const SEGMENT_COLORS = ['rgba(125,211,252,.92)','rgba(250,204,21,.92)','rgba(167,243,208,.92)','rgba(216,180,254,.92)','rgba(251,146,60,.92)','rgba(248,113,113,.92)'];
    let phraseMarkers = [];
    let restMarkers = [];
    let phraseIndex = 1;
    let startAudioTime = 0;
    let lastFrameWallTime = 0;
    let lastAcceptedT = 0;
    let lastVoicedT = 0;
    let silenceStartT = null;
    let restMarkerArmed = true;
    let previousPitch = null;
    let previousPoint = null;
    let pitchHistory = [];
    let pendingPitch = null;
    let pendingPitchCount = 0;
    let visualPitchState = null;
    let lastGoodPitchTime = 0;
    let virtualWidth = 1200;
    let canvasHeight = 520;
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let notationEvents = [];
    let notationCanvasHeight = 260;
    let syncingNotationScroll = false;
    let metronomeTimer = null;
    let metronomeBeat = 0;
    let stageSeekDragging = false;
    let stageAudioSyncing = false;
    let lastRmsForPitch = 0;
    let frameRmsRiseRatio = 1;
    let onsetGuardUntil = 0;

    const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const SOLFEGE = ['Do', 'Di', 'Re', 'Ri', 'Mi', 'Fa', 'Fi', 'Sol', 'Si', 'La', 'Li', 'Ti'];
    // 钢琴十二平均律标准：A4 = 440Hz；C4 = 60号 MIDI ≈ 261.63Hz。
    // 后续音名、Y轴刻度、简谱/五线谱转写均以此为唯一标准，避免 C4 被显示成 C3。
    const PIANO_A4_HZ = 440;
    const PIANO_A4_MIDI = 69;
    const PIANO_C4_MIDI = 60;
    const PIANO_C4_HZ = 261.6255653005986;

    function setStatus(html) {
      statusEl.innerHTML = html;
    }

    function mountSingleAudioPlayer() {
      // 只保留一个真实 audio 元素。
      // 它从功能区挂载到观察区，避免两个播放器同时加载同一音频造成卡顿。
      if (audioEl && stageAudioMount && audioEl.parentElement !== stageAudioMount) {
        stageAudioMount.appendChild(audioEl);
      } else if (audioEl && audioHome && !stageAudioMount && audioEl.parentElement !== audioHome) {
        audioHome.appendChild(audioEl);
      }
    }

    mountSingleAudioPlayer();



    function segmentColor(i){ return SEGMENT_COLORS[i % SEGMENT_COLORS.length]; }
    function addAudioSegment({name, type, url, trace=[]}) {
      const id = 'seg_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      audioSegments.push({ id, name: name || '音频片段', type: type || 'file', url, trace: trace.slice ? trace.slice() : [] });
      currentSegmentId = id;
      renderSegmentList();
      return id;
    }
    function updateCurrentSegmentTrace() {
      if (!currentSegmentId || !points || !points.length) return;
      const seg = audioSegments.find(s => s.id === currentSegmentId);
      if (!seg) return;
      seg.trace = points.map(p => ({t:p.t, x:p.x, y:p.y, pitch:p.pitch, rms:p.rms}));
      renderSegmentList(false);
    }
    function renderSegmentList(updateEmpty = true) {
      if (!segmentList) return;
      if (!audioSegments.length) {
        segmentList.innerHTML = '<span class="empty-segment-tip">可导入或录制多段音频，生成的旋律线会叠加显示在同一个观察区。</span>';
        return;
      }
      segmentList.innerHTML = audioSegments.map((s,i)=>`<div class="segment-row" data-id="${s.id}">
        <span class="segment-color" style="background:${segmentColor(i)}"></span>
        <span class="segment-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
        <span class="segment-type">${s.type==='recording'?'录音':'导入'} · ${s.trace&&s.trace.length?s.trace.length+'点':'未分析'}</span>
        <button type="button" data-action="play">播放</button>
        <button type="button" data-action="remove">删除</button>
      </div>`).join('');
    }
    function stopSegmentPlayers(){ segmentPlayers.forEach(a=>{try{a.pause(); a.currentTime=0;}catch(e){}}); segmentPlayers=[]; }
    async function playSegment(id){
      const seg=audioSegments.find(s=>s.id===id); if(!seg||!seg.url) return;
      stopFilePlayback(); stopSegmentPlayers();
      audioEl.dataset.sourceMode = seg.type==='recording'?'recording':'file';
      audioEl.dataset.url = seg.url; audioEl.src = seg.url; audioEl.load(); currentSegmentId = seg.id;
      try { await audioEl.play(); } catch(e) { console.warn(e); }
      updateStagePlaybackUI(); draw();
    }
    async function playAllSegments(){
      stopFilePlayback(); stopSegmentPlayers();
      const startAt = 0;
      audioSegments.forEach(seg=>{ if(!seg.url) return; const a=new Audio(seg.url); a.currentTime=startAt; segmentPlayers.push(a); });
      try { await Promise.all(segmentPlayers.map(a=>a.play().catch(()=>{}))); } catch(e) {}
      setStatus('<span class="pill">同时播放</span>已同时播放多段导入/录音音频。旋律线在同一观察区叠加显示。');
    }
    if (segmentList) segmentList.addEventListener('click', e=>{
      const row=e.target.closest('.segment-row'); if(!row) return; const action=e.target.dataset.action; if(action==='play') playSegment(row.dataset.id); if(action==='remove'){audioSegments=audioSegments.filter(s=>s.id!==row.dataset.id); renderSegmentList(); draw();}
    });
    if (playAllSegmentsBtn) playAllSegmentsBtn.addEventListener('click', playAllSegments);
    if (stopAllSegmentsBtn) stopAllSegmentsBtn.addEventListener('click', ()=>{stopSegmentPlayers(); if(audioEl&&!audioEl.paused) audioEl.pause();});

    function formatAudioClock(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
      const total = Math.floor(seconds);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }


    function syncStageAudioElement({ hard = false, mirrorPlayState = true } = {}) {
      // 单播放器版：观察区直接使用同一个 audioEl，不再复制 src 到第二个 audio，避免上传音频播放卡顿。
      return;
    }

    async function playFromStageAudio() {
      if (!stageAudioEl || !audioEl || !audioEl.src) return;
      if (stageAudioSyncing) return;
      try {
        if (Number.isFinite(stageAudioEl.currentTime)) audioEl.currentTime = stageAudioEl.currentTime;
        // 立即暂停观察区 audio，避免双播放器同时解码；真正发声和播放进度由功能区 audioEl 承担。
        try { stageAudioEl.pause(); } catch (e) {}
        await audioEl.play();
      } catch (err) {
        console.warn('Stage audio play failed:', err);
        setStatus('<span class="pill">播放提示</span>浏览器阻止了观察区播放器播放，请再点击一次播放按钮或使用功能区播放器。');
      } finally {
        syncStageAudioElement({ hard: true });
        updateStagePlaybackUI();
      }
    }

    function pauseFromStageAudio() {
      if (!stageAudioEl || !audioEl || stageAudioSyncing) return;
      if (!audioEl.paused) audioEl.pause();
      syncStageAudioElement({ hard: true });
      updateStagePlaybackUI();
    }

    function seekFromStageAudio() {
      if (!stageAudioEl || !audioEl || !audioEl.src || stageAudioSyncing) return;
      if (Number.isFinite(stageAudioEl.currentTime)) {
        audioEl.currentTime = stageAudioEl.currentTime;
        activateAudioPlaybackMode();
        playbackCursorOnly = hasSavedMelodyTrace();
        draw();
        scrollCursorIntoView(audioEl.currentTime || 0);
        updateStagePlaybackUI();
      }
    }


    function forceStagePlaybackSync() {
      // 观察区播放器不是第二个音频源，而是功能区播放器的同步控制面板。
      // 所有播放、暂停、拖动都直接操作同一个 audioEl，保证声音、进度、黄色光标完全一致。
      updateStagePlaybackUI();
      syncStageAudioElement({ hard: true });
      if (isAudioPlaybackMode && typeof isAudioPlaybackMode === 'function' && isAudioPlaybackMode()) {
        draw();
        scrollCursorIntoView(audioEl.currentTime || 0);
      }
    }

    function updateStagePlaybackUI() {
      if (!stageAudioTime || !stageAudioState) return;
      mountSingleAudioPlayer();
      const hasAudio = !!(audioEl && audioEl.src);
      const duration = hasAudio && Number.isFinite(audioEl.duration) ? audioEl.duration : 0;
      const current = hasAudio ? (audioEl.currentTime || 0) : 0;
      const canSeek = hasAudio && duration > 0;

      if (stagePlayPauseBtn) stagePlayPauseBtn.disabled = !hasAudio;
      if (stageSeek) {
        stageSeek.disabled = !canSeek;
        if (!stageSeekDragging) {
          stageSeek.value = canSeek ? String(Math.max(0, Math.min(1000, Math.round((current / duration) * 1000)))) : '0';
        }
      }
      stageAudioTime.textContent = formatAudioClock(current) + ' / ' + formatAudioClock(duration);

      // 取消第二个 audio 元素的同步加载；这里只更新文字状态，实际播放由唯一 audioEl 完成。
      stageAudioState.classList.toggle('playing', hasAudio && !audioEl.paused && !audioEl.ended);
      if (!hasAudio) {
        if (stagePlayPauseBtn) stagePlayPauseBtn.textContent = '▶️ 播放';
        stageAudioState.textContent = '暂无音频';
      } else if (!audioEl.paused && !audioEl.ended) {
        if (stagePlayPauseBtn) stagePlayPauseBtn.textContent = '⏸️ 暂停';
        stageAudioState.textContent = '播放中';
      } else if (audioEl.ended) {
        if (stagePlayPauseBtn) stagePlayPauseBtn.textContent = '▶️ 重播';
        stageAudioState.textContent = '播放结束';
      } else {
        if (stagePlayPauseBtn) stagePlayPauseBtn.textContent = '▶️ 播放';
        stageAudioState.textContent = audioEl.dataset.sourceMode === 'recording' ? '录音就绪' : '音频就绪';
      }
    }
    async function toggleStagePlayback() {
      if (!audioEl || !audioEl.src) return;
      try {
        if (audioEl.paused || audioEl.ended) {
          if (audioEl.ended) audioEl.currentTime = 0;
          await audioEl.play();
        } else {
          audioEl.pause();
        }
      } catch (err) {
        console.warn('Stage playback failed:', err);
        setStatus('<span class="pill">播放提示</span>浏览器阻止了自动播放，请先点击功能区或观察区的播放按钮。');
      } finally {
        updateStagePlaybackUI();
      }
    }

    function getAudioSourceMode() {
      return audioEl && audioEl.dataset ? (audioEl.dataset.sourceMode || 'file') : 'file';
    }

    function activateAudioPlaybackMode() {
      const sourceMode = getAudioSourceMode();
      mode = sourceMode === 'recording' ? 'recording' : 'file';
      playbackCursorOnly = hasSavedMelodyTrace();
    }

    function seekStagePlaybackFromSlider({ previewOnly = false } = {}) {
      if (!audioEl || !audioEl.src || !Number.isFinite(audioEl.duration) || audioEl.duration <= 0) return;
      const ratio = Math.max(0, Math.min(1, Number(stageSeek.value || 0) / 1000));
      const targetTime = ratio * audioEl.duration;
      activateAudioPlaybackMode();
      // 修复观察区播放器：拖动进度条时直接写入 audio.currentTime，而不是只预览文字。
      // 这样功能区播放器、观察区进度条、黄色播放光标会同步到同一时间点。
      if (!previewOnly) audioEl.currentTime = targetTime;
      if (stageAudioTime) stageAudioTime.textContent = formatAudioClock(targetTime) + ' / ' + formatAudioClock(audioEl.duration);
      draw();
      scrollCursorIntoView(targetTime);
      updateStagePlaybackUI();
    }

    function updateControlLabels() {
      $('silenceValue').textContent = Number(controls.silence.value).toFixed(3);
      $('smoothValue').textContent = Number(controls.smooth.value).toFixed(2);
      $('speedValue').textContent = controls.speed.value;
      $('minFreqValue').textContent = controls.minFreq.value;
      $('maxFreqValue').textContent = controls.maxFreq.value;
      $('phraseValue').textContent = Number(controls.phraseGap.value).toFixed(2);
      if ($('bpmValue') && controls.bpm) $('bpmValue').textContent = Math.round(Number(controls.bpm.value || 92));
      if ($('metroVolumeValue') && controls.metroVolume) $('metroVolumeValue').textContent = Math.round(Number(controls.metroVolume.value || 0.6) * 100) + '%';
    }

    function getSelectedOption(selectEl) {
      return selectEl && selectEl.selectedOptions && selectEl.selectedOptions.length ? selectEl.selectedOptions[0] : null;
    }

    function getTimeSignature() {
      const top = clamp(parseInt(controls.timeTop ? controls.timeTop.value : 4, 10) || 4, 1, 16);
      const bottomRaw = parseInt(controls.timeBottom ? controls.timeBottom.value : 4, 10) || 4;
      const allowed = [1, 2, 4, 8, 16, 32];
      const bottom = allowed.includes(bottomRaw) ? bottomRaw : 4;
      return { top, bottom, label: top + '/' + bottom };
    }

    function getTempoInfo() {
      const bpm = clamp(Math.round(Number(controls.bpm ? controls.bpm.value : 92) || 92), 40, 220);
      const opt = getSelectedOption(controls.tempoText);
      const tempoName = opt ? opt.textContent.replace(/\s*\d*$/, '') : 'Moderato 中板';
      return { bpm, label: tempoName === '自定义' ? '自定义速度' : tempoName };
    }

    function getKeyInfo() {
      const opt = getSelectedOption(controls.keyRoot);
      const keyName = opt ? (opt.dataset.key || opt.textContent.split('/')[0].trim()) : 'C';
      const pc = Number(controls.keyRoot ? controls.keyRoot.value : 0);
      let sig = opt ? Number(opt.dataset.sig || 0) : 0;
      const accidentalMode = controls.keyAccidentalSystem ? controls.keyAccidentalSystem.value : 'auto';
      if (accidentalMode === 'none') sig = 0;
      if (accidentalMode === 'sharp' && sig < 0) sig = Math.abs(sig);
      if (accidentalMode === 'flat' && sig > 0) sig = -Math.abs(sig);
      if (accidentalMode === 'sharp' && sig === 0 && pc !== 0) sig = 1;
      if (accidentalMode === 'flat' && sig === 0 && pc !== 0) sig = -1;
      const modeOpt = getSelectedOption(controls.modeType);
      const modeLabel = modeOpt ? modeOpt.textContent : '大调';
      const accidentalLabel = accidentalMode === 'none' ? '无升降' : sig > 0 ? sig + ' 个升号' : sig < 0 ? Math.abs(sig) + ' 个降号' : '无升降';
      return { pc, keyName, sig, modeLabel, accidentalMode, accidentalLabel };
    }

    function applyTimeSignaturePreset() {
      if (!controls.timeSigPreset || controls.timeSigPreset.value === 'custom') return;
      const [top, bottom] = controls.timeSigPreset.value.split('/').map(Number);
      if (controls.timeTop) controls.timeTop.value = top;
      if (controls.timeBottom) controls.timeBottom.value = bottom;
      updateControlLabels();
      draw();
      if (notationEvents.length) renderNotation(notationEvents);
      if (metronomeTimer) restartMetronome();
    }

    function applyTempoPreset() {
      if (!controls.tempoText || !controls.bpm || controls.tempoText.value === 'custom') return;
      controls.bpm.value = controls.tempoText.value;
      updateControlLabels();
      draw();
      if (notationEvents.length) renderNotation(notationEvents);
      if (metronomeTimer) restartMetronome();
    }

    Object.values(controls).filter(Boolean).forEach(el => {
      const refresh = () => {
        updateControlLabels();
        draw();
        if (notationEvents.length) renderNotation(notationEvents);
      };
      el.addEventListener('input', refresh);
      el.addEventListener('change', refresh);
    });
    updateControlLabels();

      syncHideNoteNamesToggle();
      if (hideNoteNamesToggle) {
        hideNoteNamesToggle.addEventListener('change', () => {
          setMelodyNoteLabelsVisible(!hideNoteNamesToggle.checked);
        });
      }
      if (controls.noteLabels) {
        controls.noteLabels.addEventListener('change', syncHideNoteNamesToggle);
        controls.noteLabels.addEventListener('input', syncHideNoteNamesToggle);
      }

    if (controls.timeSigPreset) controls.timeSigPreset.addEventListener('change', applyTimeSignaturePreset);
    if (controls.tempoText) controls.tempoText.addEventListener('change', applyTempoPreset);
    if (controls.timeTop) controls.timeTop.addEventListener('input', () => { if (controls.timeSigPreset) controls.timeSigPreset.value = 'custom'; if (metronomeTimer) restartMetronome(); });
    if (controls.timeBottom) controls.timeBottom.addEventListener('input', () => { if (controls.timeSigPreset) controls.timeSigPreset.value = 'custom'; if (metronomeTimer) restartMetronome(); });
    if (controls.bpm) controls.bpm.addEventListener('input', () => {
      if (controls.tempoText) controls.tempoText.value = 'custom';
      updateControlLabels();
    updateStagePlaybackUI();
      if (metronomeTimer) restartMetronome();
    });

    function ensureCanvasSize() {
      canvasHeight = Math.max(460, Math.min(600, scroller.clientHeight || 560));
      virtualWidth = Math.max(virtualWidth, scroller.clientWidth || 1200);
      canvas.style.width = virtualWidth + 'px';
      canvas.style.height = canvasHeight + 'px';
      canvas.width = Math.floor(virtualWidth * dpr);
      canvas.height = Math.floor(canvasHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    window.addEventListener('resize', () => {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      ensureCanvasSize();
    });

    // 横向滚动时重绘左侧音高轴，使 Y 轴刻度始终贴在当前视口左侧，便于课堂观察。
    scroller.addEventListener('scroll', () => {
      draw();
      if (notationScroller && !syncingNotationScroll) {
        syncingNotationScroll = true;
        notationScroller.scrollLeft = scroller.scrollLeft;
        syncingNotationScroll = false;
      }
    });
    if (notationScroller) {
      notationScroller.addEventListener('scroll', () => {
        if (syncingNotationScroll) return;
        syncingNotationScroll = true;
        scroller.scrollLeft = notationScroller.scrollLeft;
        syncingNotationScroll = false;
      });
    }


    function isAudioPlaybackMode() {
      return mode === 'file' || mode === 'recording';
    }

    function scrollToObservation() {
      const target = document.getElementById('observationArea') || scroller;
      if (!target || !target.scrollIntoView) return;
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }

    function updateRecordingState(text, kind = '') {
      if (!recordingState) return;
      recordingState.textContent = text;
      recordingState.classList.remove('recording', 'ready');
      if (kind) recordingState.classList.add(kind);
    }

    function updateRecordedDownload(blob, url) {
      if (!recordingDownload) return;
      if (!blob || !url) {
        recordingDownload.style.display = 'none';
        recordingDownload.removeAttribute('href');
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      recordingDownload.href = url;
      recordingDownload.download = 'melody-recording-' + stamp + '.webm';
      recordingDownload.style.display = 'inline-flex';
    }

    function getSupportedRecorderMime() {
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        ''
      ];
      if (!window.MediaRecorder) return '';
      for (const type of candidates) {
        if (!type || MediaRecorder.isTypeSupported(type)) return type;
      }
      return '';
    }


    function delay(ms) {
      return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    function getMicElapsedTime() {
      if (!audioCtx || mode !== 'mic') return 0;
      let pausedExtra = 0;
      if (recordingStatus === 'paused' && recordingPauseStartedAt) {
        pausedExtra = Math.max(0, audioCtx.currentTime - recordingPauseStartedAt);
      }
      return Math.max(0, audioCtx.currentTime - startAudioTime - totalPausedDuration - pausedExtra);
    }

    function updateRecordingControls() {
      const isIdle = recordingStatus === 'idle';
      const isCountIn = recordingStatus === 'countIn';
      const isRecording = recordingStatus === 'recording';
      const isPaused = recordingStatus === 'paused';
      const isFinishing = recordingStatus === 'finishing';

      const startText = isPaused ? '▶️ 继续录音' : isCountIn ? '⏳ 预备拍中' : '● 开始录音';
      const pauseText = 'Ⅱ 暂停录音';
      const stopText = isFinishing ? '⏳ 生成录音' : '■ 结束录音';

      [startMicBtn, stageStartRecordingBtn].filter(Boolean).forEach(btn => {
        btn.textContent = startText;
        btn.disabled = isRecording || isCountIn || isFinishing;
      });
      [pauseRecordingBtn, stagePauseRecordingBtn].filter(Boolean).forEach(btn => {
        btn.textContent = pauseText;
        btn.disabled = !isRecording || isFinishing;
      });
      [stopMicBtn, stageStopRecordingBtn].filter(Boolean).forEach(btn => {
        btn.textContent = stopText;
        btn.disabled = isIdle || isFinishing;
      });
    }

    function showCountIn(number, text) {
      if (!countInOverlay) return;
      if (countInNumber) countInNumber.textContent = String(number);
      if (countInText) countInText.textContent = text || '听到一小节提示音后开始演唱';
      countInOverlay.classList.add('show');
    }

    function hideCountIn() {
      if (countInOverlay) countInOverlay.classList.remove('show');
    }

    async function playRecordingCountIn() {
      const token = ++countInToken;
      const sig = getTimeSignature();
      const tempo = getTempoInfo();
      const beatMs = Math.max(120, (60000 / tempo.bpm) * (4 / sig.bottom));
      recordingStatus = 'countIn';
      updateRecordingControls();
      updateRecordingState('预备拍中');
      scrollToObservation();
      setStatus('<span class="pill">预备拍</span>系统将播放 ' + sig.label + ' 的一小节提示音；听完后自动开始录音。');

      for (let beat = 1; beat <= sig.top; beat++) {
        if (token !== countInToken || recordingStatus !== 'countIn') {
          hideCountIn();
          return false;
        }
        const remaining = sig.top - beat + 1;
        showCountIn(remaining, '第 ' + beat + ' / ' + sig.top + ' 拍 · 听完后进入第一小节');
        playMetronomeClick(beat === 1);
        await delay(beatMs);
      }

      if (token !== countInToken || recordingStatus !== 'countIn') {
        hideCountIn();
        return false;
      }
      hideCountIn();
      return true;
    }

    function startMicRecorder(stream) {
      recordedChunks = [];
      discardNextRecording = false;
      updateRecordedDownload(null, null);
      if (!window.MediaRecorder || !stream) {
        updateRecordingState('浏览器不支持录音');
        return;
      }
      try {
        const mimeType = getSupportedRecorderMime();
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) recordedChunks.push(event.data);
        };
        mediaRecorder.onstop = () => {
          const chunks = recordedChunks.slice();
          recordedChunks = [];
          mediaRecorder = null;
          if (discardNextRecording) {
            discardNextRecording = false;
            recordingStatus = 'idle';
            updateRecordingControls();
            updateRecordingState('录音未保存');
            return;
          }
          if (!chunks.length) {
            recordingStatus = 'idle';
            updateRecordingControls();
            updateRecordingState('暂无录音');
            return;
          }
          const type = chunks[0].type || 'audio/webm';
          const blob = new Blob(chunks, { type });
          if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
          recordedBlobUrl = URL.createObjectURL(blob);
          const recTraceForSegment = (points && points.length) ? points.map(p => ({t:p.t, x:p.x, y:p.y, pitch:p.pitch, rms:p.rms})) : [];
          addAudioSegment({name:'录音 ' + new Date().toLocaleTimeString(), type:'recording', url:recordedBlobUrl, trace:recTraceForSegment});
          const oldUrl = audioEl.dataset.url;
          if (oldUrl && oldUrl !== recordedBlobUrl) URL.revokeObjectURL(oldUrl);
          audioEl.dataset.url = recordedBlobUrl;
          audioEl.dataset.sourceMode = 'recording';
          audioEl.dataset.hasMelodyTrace = points.length ? 'true' : 'false';
          audioEl.src = recordedBlobUrl;
          audioEl.load();
          updateStagePlaybackUI();
          mode = 'recording';
          playbackCursorOnly = points.length > 0;
          prepareAudioElementPlayback();
          recordingStatus = 'idle';
          updateRecordingControls();
          updateRecordingState('录音已生成', 'ready');
          updateRecordedDownload(blob, recordedBlobUrl);
          draw();
          setStatus('<span class="pill">录音已生成</span>已保留本次演唱的完整旋律线。重新播放录音时不会清空线条，只用黄色光标跟随播放位置。');
        };
        mediaRecorder.start(250);
        updateRecordingState('录音中', 'recording');
      } catch (err) {
        updateRecordingState('录音不可用');
        console.warn('MediaRecorder start failed:', err);
      }
    }

    function stopMicRecorder({ discard = false } = {}) {
      discardNextRecording = !!discard;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop(); } catch (e) { console.warn(e); }
      }
    }

    function prepareAudioElementPlayback() {
      if (!audioCtx || !analyser || !audioEl.src) return;
      if (!fileSource) {
        fileSource = audioCtx.createMediaElementSource(audioEl);
      }
      try { fileSource.disconnect(); } catch (e) {}
      try { analyser.disconnect(); } catch (e) {}
      fileSource.connect(analyser);
      analyser.connect(audioCtx.destination);
    }

    function getCursorTime() {
      if (isAudioPlaybackMode() && audioEl && audioEl.src) return audioEl.currentTime || 0;
      if (mode === 'mic' && audioCtx && (running || recordingStatus === 'paused')) return getMicElapsedTime();
      return null;
    }

    function cursorXFromTime(t) {
      const pxPerSec = Number(controls.speed.value || 95);
      return 48 + Math.max(0, t || 0) * pxPerSec;
    }

    function scrollCursorIntoView(t = getCursorTime()) {
      if (t === null || !controls.autoScroll || !controls.autoScroll.checked) return;
      const x = cursorXFromTime(t);
      growCanvasIfNeeded(x + 260);
      const left = scroller.scrollLeft;
      const right = left + scroller.clientWidth;
      if (x > right - 160 || x < left + 120) {
        scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * 0.58);
      }
    }

    function hasSavedMelodyTrace() {
      return audioEl && audioEl.dataset && audioEl.dataset.hasMelodyTrace === 'true' && points.length > 0;
    }

    function setMelodyTraceSaved(saved) {
      if (audioEl && audioEl.dataset) audioEl.dataset.hasMelodyTrace = saved ? 'true' : 'false';
      playbackCursorOnly = !!saved;
    }

    function resetAnalysisState({keepWidth = false} = {}) {
      setMelodyTraceSaved(false);
      points = [];
      phraseMarkers = [];
      restMarkers = [];
      phraseIndex = 1;
      lastAcceptedT = 0;
      lastVoicedT = 0;
      silenceStartT = null;
      restMarkerArmed = true;
      previousPitch = null;
      previousPoint = null;
      pitchHistory = [];
      pendingPitch = null;
      pendingPitchCount = 0;
      visualPitchState = null;
      lastGoodPitchTime = 0;
      lastRmsForPitch = 0;
      frameRmsRiseRatio = 1;
      onsetGuardUntil = 0;
      if (!keepWidth) virtualWidth = Math.max(1200, scroller.clientWidth || 1200);
      readout.pitch.textContent = '—';
      readout.note.textContent = '—';
      readout.volume.textContent = '0.000';
      readout.phrase.textContent = '第 1 句';
      notationEvents = [];
      if (notationOutput) notationOutput.textContent = '暂无谱例。请先录音或上传音频，再生成谱例。';
      if (notationSummary) notationSummary.textContent = '旋律线已清空。重新录入或播放后，可再次生成简谱 / 五线谱。';
      ensureCanvasSize();
      renderEmptyNotation();
      drawComparisonPanel();
    }

    async function ensureAudioContext() {
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        // 低延迟稳定版：8192 点足够覆盖人声/钢琴常用音区，同时避免 16384+多算法导致播放卡顿。
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0.0;
        timeBuffer = new Float32Array(analyser.fftSize);
      }
    }

    function disconnectNode(node) {
      try { if (node) node.disconnect(); } catch (e) {}
    }

    function disconnectCurrentSources() {
      disconnectNode(micSource);
      micSource = null;
      disconnectNode(fileSource);
      try { if (analyser) analyser.disconnect(); } catch (e) {}
    }

    async function startMic() {
      if (recordingStatus === 'paused') {
        resumeRecording();
        return;
      }
      if (recordingStatus === 'recording' || recordingStatus === 'countIn' || recordingStatus === 'finishing') return;
      try {
        await ensureAudioContext();
        stopFilePlayback();
        disconnectCurrentSources();
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 48000,
            sampleSize: 16,
            latency: 0.02
          }
        });
        micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(analyser);
        mode = 'mic';
        recordedTracePoints = [];
        drawComparisonPanel();
        running = false;
        totalPausedDuration = 0;
        recordingPauseStartedAt = 0;
        resetAnalysisState();
        scrollToObservation();

        const ok = await playRecordingCountIn();
        if (!ok) {
          stopMic({ discardRecording: true });
          return;
        }

        mode = 'mic';
        recordingStatus = 'recording';
        startAudioTime = audioCtx.currentTime;
        lastFrameWallTime = 0;
        lastAcceptedT = 0;
        running = true;
        startMicRecorder(micStream);
        updateRecordingControls();
        updateRecordingState('录音中', 'recording');
        setStatus('<span class="pill">录音中</span>已进入第一小节，系统正在实时拾音、绘制旋律线并同步录音。可随时暂停或结束录音。');
        loop();
      } catch (err) {
        recordingStatus = 'idle';
        updateRecordingControls();
        hideCountIn();
        setStatus('<span class="pill" style="background:rgba(251,113,133,.18);color:#fecdd3;border-color:rgba(251,113,133,.32)">无法开始录音</span>' + escapeHtml(err.message || String(err)) + '。请确认浏览器权限，并使用 HTTPS 或 localhost 打开。');
      }
    }

    function pauseRecording() {
      if (recordingStatus !== 'recording' || mode !== 'mic') return;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      recordingPauseStartedAt = audioCtx ? audioCtx.currentTime : 0;
      recordingStatus = 'paused';
      try {
        if (mediaRecorder && mediaRecorder.state === 'recording' && mediaRecorder.pause) mediaRecorder.pause();
      } catch (e) { console.warn(e); }
      updateRecordingControls();
      updateRecordingState('已暂停');
      draw();
      setStatus('<span class="pill">录音已暂停</span>旋律线已保留。点击“继续录音”后会接着同一次录音继续绘制。');
    }

    function resumeRecording() {
      if (recordingStatus !== 'paused' || mode !== 'mic') return;
      if (audioCtx && recordingPauseStartedAt) {
        totalPausedDuration += Math.max(0, audioCtx.currentTime - recordingPauseStartedAt);
      }
      recordingPauseStartedAt = 0;
      recordingStatus = 'recording';
      running = true;
      lastFrameWallTime = 0;
      try {
        if (mediaRecorder && mediaRecorder.state === 'paused' && mediaRecorder.resume) mediaRecorder.resume();
      } catch (e) { console.warn(e); }
      updateRecordingControls();
      updateRecordingState('录音中', 'recording');
      scrollToObservation();
      setStatus('<span class="pill">继续录音</span>已从暂停处继续录音，时间轴会接续前面的旋律线。');
      loop();
    }

    function finishRecording() {
      if (recordingStatus === 'idle') return;
      if (recordingStatus === 'countIn') countInToken += 1;
      hideCountIn();
      recordingStatus = 'finishing';
      updateRecordingControls();
      stopMic({ discardRecording: false });
    }

    function stopMic({ discardRecording = false } = {}) {
      const wasMic = mode === 'mic' || recordingStatus === 'countIn' || recordingStatus === 'recording' || recordingStatus === 'paused' || recordingStatus === 'finishing';
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      hideCountIn();
      if (wasMic) stopMicRecorder({ discard: discardRecording });
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      micStream = null;
      disconnectNode(micSource);
      micSource = null;
      mode = 'idle';
      totalPausedDuration = 0;
      recordingPauseStartedAt = 0;
      if (discardRecording) {
        recordingStatus = 'idle';
        updateRecordingControls();
        updateRecordingState('录音未保存');
      } else {
        recordingStatus = 'finishing';
        updateRecordingControls();
        setStatus('<span class="pill">结束录音</span>正在生成录音。旋律线会保留，稍后可拖动播放器并让光标跟随回放。');
      }
    }

    function stopFilePlayback() {
      if (!audioEl.paused) audioEl.pause();
    }

    async function handleFile(file) {
      if (!file) return;
      await ensureAudioContext();
      stopMic({ discardRecording: true });
      disconnectCurrentSources();
      const oldUrl = audioEl.dataset.url;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(file);
      addAudioSegment({name:file.name, type:'file', url, trace:[]});
      audioEl.dataset.url = url;
      audioEl.dataset.sourceMode = 'file';
      audioEl.dataset.hasMelodyTrace = 'false';
      playbackCursorOnly = false;
      audioEl.src = url;
      audioEl.load();
      syncStageAudioElement({ hard: true, mirrorPlayState: false });
      updateStagePlaybackUI();
      mode = 'file';
      importedTracePoints = [];
      prepareAudioElementPlayback();
      resetAnalysisState();
      updateRecordingState('已载入音频');
      scrollToObservation();
      setStatus('<span class="pill">已载入音频</span>' + escapeHtml(file.name) + '。页面已跳转至观察区；点击观察区唯一播放器播放后，可拖动时间条，黄色光标会实时跟进。');
    }

    audioFile.addEventListener('change', (e) => { const files = Array.from(e.target.files || []); if (!files.length) return; files.forEach((f, idx) => { if (idx === 0) handleFile(f); else { const url = URL.createObjectURL(f); addAudioSegment({name:f.name, type:'file', url, trace:[]}); } }); });

    audioEl.addEventListener('loadedmetadata', () => {
      mountSingleAudioPlayer();
      updateStagePlaybackUI();
      draw();
    });

    audioEl.addEventListener('durationchange', updateStagePlaybackUI);
    audioEl.addEventListener('canplay', updateStagePlaybackUI);

    audioEl.addEventListener('play', async () => {
      try {
        mountSingleAudioPlayer();
        await ensureAudioContext();
        activateAudioPlaybackMode();
        prepareAudioElementPlayback();
        running = true;
        lastFrameWallTime = 0;
        scrollToObservation();
        draw();
        scrollCursorIntoView(audioEl.currentTime || 0);
        updateStagePlaybackUI();
        loop();
        if (playbackCursorOnly) {
          setStatus('<span class="pill">播放跟随中</span>完整旋律线已保留，重新播放或拖动进度时只移动黄色光标，方便对照听辨。');
        } else {
          setStatus('<span class="pill">播放观测中</span>系统将继续保留已绘制线条，并从播放器当前进度向后补充观测；黄色光标实时跟进播放位置。');
        }
      } catch (err) {
        console.warn('Audio play handler failed:', err);
        updateStagePlaybackUI();
        setStatus('<span class="pill">播放提示</span>音频已开始播放，但音频分析连接失败。可暂停后重试，或刷新页面重新载入音频。');
      }
    });

    audioEl.addEventListener('pause', () => {
      updateStagePlaybackUI();
      if (isAudioPlaybackMode()) {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        draw();
        if (!audioEl.ended) setStatus('<span class="pill">音频已暂停</span>当前线条和播放光标已保留，可拖动进度、继续播放或保存图片。');
      }
    });

    audioEl.addEventListener('seeking', () => {
      activateAudioPlaybackMode();
      playbackCursorOnly = hasSavedMelodyTrace();
      draw();
      scrollCursorIntoView(audioEl.currentTime || 0);
      updateStagePlaybackUI();
    });

    audioEl.addEventListener('seeked', () => {
      activateAudioPlaybackMode();
      playbackCursorOnly = hasSavedMelodyTrace();
      draw();
      scrollToObservation();
      scrollCursorIntoView(audioEl.currentTime || 0);
      updateStagePlaybackUI();
      setStatus('<span class="pill">已定位播放处</span>旋律线保持不变，黄色光标已移动到当前播放位置。继续播放即可跟随观察。');
    });

    audioEl.addEventListener('loadedmetadata', forceStagePlaybackSync);
    audioEl.addEventListener('durationchange', forceStagePlaybackSync);
    audioEl.addEventListener('play', forceStagePlaybackSync);
    audioEl.addEventListener('pause', forceStagePlaybackSync);
    audioEl.addEventListener('seeking', forceStagePlaybackSync);
    audioEl.addEventListener('seeked', forceStagePlaybackSync);

    audioEl.addEventListener('timeupdate', () => {
      syncStageAudioElement({ hard: false });
      updateStagePlaybackUI();
      if (isAudioPlaybackMode()) {
        draw();
        scrollCursorIntoView(audioEl.currentTime || 0);
      }
    });

    audioEl.addEventListener('ended', () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (points.length) setMelodyTraceSaved(true);
      updateStagePlaybackUI();
      syncStageAudioElement({ hard: true });
      draw();
      setStatus('<span class="pill">播放结束</span>完整旋律线已保留。重新播放或拖动进度时，黄色光标会在原有线条上跟随移动。');
    });

    function loop(now = performance.now()) {
      if (!running || !analyser) return;
      rafId = requestAnimationFrame(loop);
      if (now - lastFrameWallTime < 52) return;
      lastFrameWallTime = now;
      const t = isAudioPlaybackMode() ? audioEl.currentTime : getMicElapsedTime();
      if (playbackCursorOnly && isAudioPlaybackMode()) {
        scrollCursorIntoView(t);
        draw();
        return;
      }
      analyzeFrame(t);
      scrollCursorIntoView(t);
      draw();
    }

    function getDisplayPitchRange() {
      const minFreq = Math.min(Number(controls.minFreq.value), Number(controls.maxFreq.value) - 20);
      const maxFreq = Math.max(Number(controls.maxFreq.value), minFreq + 20);
      return { minFreq, maxFreq };
    }

    function getAnalysisPitchRange(displayMinFreq, displayMaxFreq) {
      // 尖峰修复版：识别范围比显示范围略宽，但不再默认放到 4k/5k。
      // 截图中的 B7/4kHz 竖直尖峰多来自起音瞬态、喷麦或辅音噪声，而非真实旋律。
      // 对中小学课堂常见人声、钢琴、笛子、小提琴旋律，25—2800Hz 已覆盖 C1 到 F7 以上。
      const minFreq = Math.max(25, Math.min(displayMinFreq * 0.65, 45));
      const maxFreq = Math.min(2800, Math.max(displayMaxFreq * 1.18, 1800));
      return { minFreq, maxFreq };
    }

    function analyzeFrame(t) {
      if (!analyser || t < lastAcceptedT - 0.05) return;
      lastAcceptedT = t;
      analyser.getFloatTimeDomainData(timeBuffer);
      const rms = computeRMS(timeBuffer);
      frameRmsRiseRatio = lastRmsForPitch > 0.000001 ? rms / Math.max(0.000001, lastRmsForPitch) : 1;
      const silenceThreshold = Math.max(Number(controls.silence.value), 0.006);
      const phraseGap = Number(controls.phraseGap.value);
      const pxPerSec = Number(controls.speed.value);
      const displayRange = getDisplayPitchRange();
      const analysisRange = getAnalysisPitchRange(displayRange.minFreq, displayRange.maxFreq);
      const minFreq = displayRange.minFreq;
      const maxFreq = displayRange.maxFreq;
      const x = 48 + t * pxPerSec;
      growCanvasIfNeeded(x + 220);
      readout.volume.textContent = rms.toFixed(3);

      if (rms < silenceThreshold) {
        if (silenceStartT === null) {
          silenceStartT = t;
          restMarkerArmed = true;
        }
        const silenceLen = t - silenceStartT;
        if (silenceLen > 0.18 && restMarkerArmed && points.length) {
          restMarkers.push({ x, label: silenceLen > phraseGap ? '乐句停顿' : '休止 / 换气' });
          restMarkerArmed = false;
          draw();
        }
        // 停顿稍长时重置音高记忆，避免下一句的第一个音被上一句拖拽。
        if (silenceLen > 0.32) {
          previousPitch = null;
          previousPoint = null;
          pitchHistory = [];
          pendingPitch = null;
          pendingPitchCount = 0;
          visualPitchState = null;
        }
        lastRmsForPitch = rms;
        readout.pitch.textContent = '休止';
        readout.note.textContent = '—';
        return;
      }

      const startedAfterSilence = silenceStartT !== null || (lastVoicedT > 0 && (t - lastVoicedT) > 0.18);
      const attackRise = frameRmsRiseRatio > 3.4 && rms > silenceThreshold * 2.4;
      if (startedAfterSilence || attackRise) {
        // 不再整段跳过起音。上一版 90ms 起音保护会导致短音、快节奏和小节开头识别不到旋律。
        // 这里仅记录状态，交给后面的“大跳复核”过滤真正的瞬态尖峰。
        onsetGuardUntil = Math.max(onsetGuardUntil, t + 0.015);
      }

      const detected = detectPitch(timeBuffer, audioCtx.sampleRate, analysisRange.minFreq, analysisRange.maxFreq);
      if (!detected || !isFinite(detected.frequency)) {
        lastRmsForPitch = rms;
        readout.pitch.textContent = '未稳定';
        readout.note.textContent = '—';
        return;
      }
      if (isProbablyNoisePitch(detected, rms, silenceThreshold, t)) {
        lastRmsForPitch = rms;
        readout.pitch.textContent = '未稳定';
        readout.note.textContent = '—';
        return;
      }

      const pitch = stabilizePitch(detected.frequency, detected.confidence, analysisRange.minFreq, analysisRange.maxFreq, rms, t);
      if (!pitch) {
        readout.pitch.textContent = '未稳定';
        readout.note.textContent = '—';
        return;
      }

      let breakBefore = false;
      if (silenceStartT !== null) {
        const silenceLen = t - silenceStartT;
        breakBefore = silenceLen > 0.12;
        if (silenceLen >= phraseGap && points.length) {
          phraseIndex += 1;
          phraseMarkers.push({ x, label: '第 ' + phraseIndex + ' 句' });
          breakBefore = true;
        }
        silenceStartT = null;
      }
      lastVoicedT = t;

      const note = freqToNote(pitch);
      const displayPitch = getStableDisplayPitch(pitch, detected.confidence);
      let y = freqToY(displayPitch, minFreq, maxFreq);
      if (previousPoint && !breakBefore && !previousPoint.breakBefore) {
        const visualJumpSemi = previousPoint.displayPitch ? Math.abs(12 * Math.log2(displayPitch / previousPoint.displayPitch)) : 0;
        if (visualJumpSemi < 4.5) {
          const yAlpha = getVisualSmoothingWeight();
          y = previousPoint.y * yAlpha + y * (1 - yAlpha);
          const deadZonePx = controls.steadyMode.checked ? 1.6 : 0.8;
          if (Math.abs(y - previousPoint.y) < deadZonePx) y = previousPoint.y;
        }
      }
      const ampNorm = clamp((rms - silenceThreshold) / 0.18, 0, 1);
      const width = 1.2 + ampNorm * 8.8;
      const alpha = 0.28 + ampNorm * 0.72;
      const color = pitchToColor(displayPitch, minFreq, maxFreq);
      const p = { t, x, y, pitch, displayPitch, rms, width, alpha, color, note, breakBefore };
      points.push(p);
      if (points.length > 12000) points.splice(0, points.length - 12000);
      snapshotCurrentTrace();
      previousPoint = p;

      readout.pitch.textContent = Math.round(pitch) + ' Hz';
      readout.note.textContent = note.name + ' / ' + note.solfege + '（' + formatCents(note.cents) + '）';
      readout.phrase.textContent = '第 ' + phraseIndex + ' 句';
      draw();
      if (controls.autoScroll.checked) scroller.scrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth - 12);
    }

    function growCanvasIfNeeded(requiredWidth) {
      if (requiredWidth <= virtualWidth) return;
      virtualWidth = Math.ceil(requiredWidth / 400) * 400;
      ensureCanvasSize();
    }

    function computeRMS(buf) {
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return Math.sqrt(sum / buf.length);
    }


    function isProbablyNoisePitch(detected, rms, silenceThreshold, t) {
      if (!detected || !isFinite(detected.frequency)) return true;
      const f = detected.frequency;
      const conf = clamp(detected.confidence || 0, 0, 1);
      const nearGate = rms < Math.max(0.010, silenceThreshold * 1.45);
      const justStarted = silenceStartT !== null || !lastVoicedT || (t - lastVoicedT) > 0.16 || t < onsetGuardUntil;
      const prev = previousPitch || (previousPoint && previousPoint.pitch) || null;
      const jumpSemi = prev ? Math.abs(12 * Math.log2(f / prev)) : 0;

      // 低电平时的高频候选通常是口风、齿音、键盘/鼠标点击或电流噪声。
      if (nearGate && conf < 0.62) return true;
      if (nearGate && f > 1400 && conf < 0.78) return true;
      // 人声起音瞬间若直接跳到 2kHz 以上，多数会形成截图中的竖直尖峰。
      if (justStarted && f > 1800 && conf < 0.84) return true;
      // 极端大跳且置信度不高，交给 pending 复核，不直接画入线条。
      if (prev && jumpSemi > 21 && conf < 0.82) return true;
      return false;
    }

    function stabilizePitch(rawPitch, confidence, minFreq, maxFreq, rms = 0, t = 0) {
      if (!isFinite(rawPitch) || rawPitch <= 0) return null;
      let corrected = clamp(rawPitch, minFreq, maxFreq);
      let rawMidi = freqToMidiFloat(corrected);
      let conf = clamp(confidence || 0, 0, 1);

      // 钢琴音高校准：若候选非常接近半音，略微吸附到十二平均律，避免标签在相邻音之间抖动。
      // 只吸附读数，不改变大跳判断。
      const nearestMidi = Math.round(rawMidi);
      const centError = Math.abs((rawMidi - nearestMidi) * 100);
      if (controls.pitchLock && controls.pitchLock.checked && centError < 18 && conf > 0.48) {
        corrected = corrected * 0.72 + midiToFreq(nearestMidi) * 0.28;
        rawMidi = freqToMidiFloat(corrected);
      }

      const prev = previousPitch || (previousPoint && previousPoint.pitch) || null;
      const sinceVoiced = lastVoicedT ? (t - lastVoicedT) : Infinity;
      const justStarted = silenceStartT !== null || sinceVoiced > 0.16 || t < onsetGuardUntil;
      let isLargeLeap = false;
      let leapSemi = 0;

      if (prev) {
        leapSemi = 12 * Math.log2(corrected / prev);
        isLargeLeap = Math.abs(leapSemi) >= 5.0;

        // 关键修复：过滤“单帧极端尖峰”，但保留真实大音程。
        // 真正的大跳会在下一帧继续落在相近音高；喷麦/辅音/点击通常只出现一帧。
        const extremeLeap = Math.abs(leapSemi) > 18;
        const highSpike = corrected > 1600 && prev < 1100;
        const weakOrAttack = rms < Math.max(0.018, Number(controls.silence.value) * 2.2) || frameRmsRiseRatio > 3.0 || justStarted;
        const needsConfirm = (extremeLeap || highSpike) && (weakOrAttack || conf < 0.86);
        if (needsConfirm) {
          const similarPending = pendingPitch && Math.abs(12 * Math.log2(corrected / pendingPitch)) < 1.6;
          pendingPitch = corrected;
          pendingPitchCount = similarPending ? pendingPitchCount + 1 : 1;
          if (pendingPitchCount < 2) return null;
        } else if (isLargeLeap) {
          pitchHistory = [];
          pendingPitch = null;
          pendingPitchCount = 0;
          visualPitchState = null;
        } else {
          pendingPitch = null;
          pendingPitchCount = 0;
        }
      } else if (justStarted) {
        // 乐句第一个音的高频候选要复核一次，避免小节开头出现竖直冲高。
        const riskyFirst = corrected > 1500 || conf < 0.50;
        if (riskyFirst) {
          const similarPending = pendingPitch && Math.abs(12 * Math.log2(corrected / pendingPitch)) < 1.6;
          pendingPitch = corrected;
          pendingPitchCount = similarPending ? pendingPitchCount + 1 : 1;
          if (pendingPitchCount < 2) return null;
        }
      }

      pitchHistory.push({ midi: rawMidi, f: corrected, c: conf });
      const historySize = isLargeLeap ? 1 : ((controls.steadyMode && controls.steadyMode.checked) ? 4 : 2);
      if (pitchHistory.length > historySize) pitchHistory.splice(0, pitchHistory.length - historySize);

      let midiForUse = rawMidi;
      if (!isLargeLeap && pitchHistory.length > 1) {
        const weighted = pitchHistory.slice().sort((a, b) => a.midi - b.midi);
        midiForUse = weighted[Math.floor(weighted.length / 2)]?.midi ?? rawMidi;
      }
      let pitchForUse = midiToFreq(midiForUse);

      if (prev && !isLargeLeap) {
        const deltaSemi = 12 * Math.log2(pitchForUse / prev);
        const holdZone = controls.steadyMode && controls.steadyMode.checked ? 0.10 : 0.06;
        if (Math.abs(deltaSemi) < holdZone) {
          pitchForUse = prev;
        } else {
          const alpha = controls.steadyMode && controls.steadyMode.checked ? 0.22 : 0.10;
          pitchForUse = prev * Math.pow(2, Math.log2(pitchForUse / prev) * (1 - alpha));
        }
      }

      previousPitch = clamp(pitchForUse, minFreq, maxFreq);
      lastGoodPitchTime = performance.now();
      return previousPitch;
    }

    function getStableDisplayPitch(pitch, confidence = 1) {
      if (!isFinite(pitch) || pitch <= 0) return pitch;
      const snapOn = !controls.pitchSnap || controls.pitchSnap.checked;
      let target = pitch;
      if (snapOn) {
        const midi = Math.round(69 + 12 * Math.log2(pitch / 440));
        const snapped = midiToFreq(midi);
        const cents = 1200 * Math.log2(pitch / snapped);
        // 接近半音时吸附；偏差较大时保留真实音高，兼顾课堂稳定和音准反馈。
        if (Math.abs(cents) <= 38) target = snapped;
      }
      if (!visualPitchState) {
        visualPitchState = target;
        return target;
      }
      const deltaSemi = Math.abs(12 * Math.log2(target / visualPitchState));
      const holdZone = controls.steadyMode && controls.steadyMode.checked ? 0.08 : 0.05;
      if (deltaSemi < holdZone) return visualPitchState;
      // 大跳音程、八度与超八度直接响应，避免视觉线被上一音拖住。
      const alpha = deltaSemi >= 4.5 ? 0.04 : (controls.steadyMode && controls.steadyMode.checked ? 0.42 : 0.26);
      visualPitchState = visualPitchState * Math.pow(2, Math.log2(target / visualPitchState) * (1 - alpha));
      return visualPitchState;
    }

    function getVisualSmoothingWeight() {
      const smoothing = Number(controls.smooth.value);
      if (controls.steadyMode && controls.steadyMode.checked) return clamp(0.42 + smoothing * 0.28, 0.42, 0.76);
      return clamp(0.18 + smoothing * 0.42, 0.18, 0.58);
    }

    function detectPitch(buf, sampleRate, minFreq, maxFreq) {
      // 课堂稳定版：先用 YIN 找真实基频，再用归一化自相关校正八度。
      // 目标是避免截图中的 4kHz 尖峰，同时保留一到八度、超八度真实跳进。
      if (!buf || !buf.length || !sampleRate) return null;
      const source = buf.length > 8192 ? buf.subarray(buf.length - 8192) : buf;
      const prepared = prepareFastPitchBuffer(source);
      if (!prepared || prepared.rms < 0.0010) return null;
      const x = prepared.data;
      const n = x.length;
      const lo = Math.max(25, minFreq || 45);
      const hi = Math.min(2800, maxFreq || 2200);
      const tauMin = Math.max(2, Math.floor(sampleRate / hi));
      const tauMax = Math.min(Math.floor(sampleRate / lo), Math.floor(n * 0.62));
      if (tauMax <= tauMin + 4) return null;

      const yin = detectPitchYINFast(x, sampleRate, lo, hi);

      let bestTau = 0;
      let bestCorr = -1;
      const corrs = new Float32Array(tauMax + 2);
      const sampleStep = tauMax > 1100 ? 2 : 1;
      for (let tau = tauMin; tau <= tauMax; tau++) {
        let sum = 0, e1 = 0, e2 = 0;
        const limit = n - tau;
        for (let i = 0; i < limit; i += sampleStep) {
          const a = x[i];
          const b = x[i + tau];
          sum += a * b;
          e1 += a * a;
          e2 += b * b;
        }
        const corr = sum / (Math.sqrt(e1 * e2) + 1e-12);
        corrs[tau] = corr;
        if (corr > bestCorr) {
          bestCorr = corr;
          bestTau = tau;
        }
      }

      // 选择较早的强峰，防止 C4 被最大相关峰误拉到 C3；但门槛不能太低，避免高频噪声成峰。
      const strongLevel = Math.max(0.46, bestCorr * 0.86);
      let chosenTau = bestTau;
      for (let tau = tauMin + 2; tau < tauMax - 2; tau++) {
        const c = corrs[tau];
        if (c >= strongLevel && c >= corrs[tau - 1] && c >= corrs[tau + 1]) {
          chosenTau = tau;
          break;
        }
      }

      let refined = chosenTau;
      if (chosenTau > tauMin && chosenTau < tauMax) {
        const ym = corrs[chosenTau - 1];
        const y0 = corrs[chosenTau];
        const yp = corrs[chosenTau + 1];
        const denom = (ym - 2 * y0 + yp);
        if (Math.abs(denom) > 1e-9) refined = chosenTau + 0.5 * (ym - yp) / denom;
      }
      let acfFreq = sampleRate / refined;
      let acfConf = clamp(corrs[chosenTau] || bestCorr, 0, 1);

      let frequency = acfFreq;
      let confidence = acfConf;
      let sourceName = 'acf-stable';

      if (yin && isFinite(yin.frequency)) {
        const diffSemi = Math.abs(12 * Math.log2(yin.frequency / acfFreq));
        // YIN 与 ACF 接近时取平均；不接近时选置信度更高且更接近半音的候选。
        if (diffSemi < 0.7) {
          frequency = Math.sqrt(yin.frequency * acfFreq);
          confidence = Math.max(acfConf, yin.confidence);
          sourceName = 'yin+acf';
        } else {
          const yinErr = Math.abs(freqToMidiFloat(yin.frequency) - Math.round(freqToMidiFloat(yin.frequency)));
          const acfErr = Math.abs(freqToMidiFloat(acfFreq) - Math.round(freqToMidiFloat(acfFreq)));
          if (yin.confidence > acfConf + 0.06 || (yin.confidence > 0.58 && yinErr + 0.10 < acfErr)) {
            frequency = yin.frequency;
            confidence = yin.confidence;
            sourceName = 'yin';
          }
        }
      }

      // 八度校正：围绕当前候选比较 1/2、1、2 倍频，选“相关高 + 接近十二平均律 + 不超过上限”的候选。
      const candidates = [];
      [0.5, 1, 2].forEach(mult => {
        const f = frequency * mult;
        if (f < lo * 0.82 || f > hi * 1.08) return;
        const tau = Math.round(sampleRate / f);
        if (tau < tauMin || tau > tauMax) return;
        const corr = corrs[tau] || 0;
        const midi = freqToMidiFloat(f);
        const chromaErr = Math.abs(midi - Math.round(midi));
        const extremePenalty = f > 1800 ? 0.10 : 0;
        candidates.push({ f, score: corr * 0.78 + (1 - Math.min(0.5, chromaErr) * 2) * 0.22 - extremePenalty, corr });
      });
      if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        if (candidates[0].score > confidence * 0.62) {
          frequency = candidates[0].f;
          confidence = Math.max(confidence, candidates[0].corr);
        }
      }

      // 最后防线：高频候选若相关不够高，直接拒绝，避免 B7 这类尖峰进入旋律线。
      if (frequency > 2200 && confidence < 0.82) return null;
      if (frequency > 1600 && confidence < 0.58) return null;
      if (!isFinite(frequency) || frequency < lo * 0.85 || frequency > hi * 1.15) return null;
      return { frequency, confidence, source: sourceName };
    }

    function prepareFastPitchBuffer(buf) {
      const n = buf.length;
      if (!n) return null;
      let mean = 0;
      for (let i = 0; i < n; i++) mean += buf[i];
      mean /= n;
      const data = new Float32Array(n);
      let energy = 0;
      for (let i = 0; i < n; i++) {
        // 不使用过重窗函数，降低运算；仅去直流并做轻微边缘衰减。
        const edge = i < 64 ? i / 64 : (i > n - 65 ? (n - 1 - i) / 64 : 1);
        const w = Math.max(0, Math.min(1, edge));
        const v = (buf[i] - mean) * w;
        data[i] = v;
        energy += v * v;
      }
      return { data, rms: Math.sqrt(energy / n) };
    }

    function detectPitchYINFast(x, sampleRate, minFreq, maxFreq) {
      const n = x.length;
      const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
      const tauMax = Math.min(Math.floor(sampleRate / minFreq), Math.floor(n * 0.55));
      if (tauMax <= tauMin + 3) return null;
      const diff = new Float32Array(tauMax + 1);
      for (let tau = 1; tau <= tauMax; tau++) {
        let d = 0;
        const limit = n - tau;
        const step = tauMax > 1300 ? 2 : 1;
        for (let i = 0; i < limit; i += step) {
          const delta = x[i] - x[i + tau];
          d += delta * delta;
        }
        diff[tau] = d;
      }
      let running = 0;
      let bestTau = 0;
      let bestVal = Infinity;
      const threshold = 0.18;
      for (let tau = 1; tau <= tauMax; tau++) {
        running += diff[tau];
        const cmnd = diff[tau] * tau / (running || 1);
        diff[tau] = cmnd;
        if (tau >= tauMin && cmnd < bestVal) {
          bestVal = cmnd;
          bestTau = tau;
        }
        if (tau >= tauMin && cmnd < threshold) {
          while (tau + 1 <= tauMax && diff[tau + 1] < diff[tau]) tau++;
          bestTau = tau;
          bestVal = diff[tau];
          break;
        }
      }
      if (!bestTau || bestVal > 0.72) return null;
      let refined = bestTau;
      if (bestTau > 1 && bestTau < tauMax) {
        const s0 = diff[bestTau - 1];
        const s1 = diff[bestTau];
        const s2 = diff[bestTau + 1];
        const denom = s0 - 2 * s1 + s2;
        if (Math.abs(denom) > 1e-9) refined = bestTau + 0.5 * (s0 - s2) / denom;
      }
      const frequency = sampleRate / refined;
      return { frequency, confidence: clamp(1 - bestVal, 0, 1), source: 'yin-fast' };
    }

    function preprocessPitchBuffer(buf) {
      const size = buf.length;
      let mean = 0;
      for (let i = 0; i < size; i++) mean += buf[i];
      mean /= size;
      const centered = new Float32Array(size);
      let energy = 0;
      for (let i = 0; i < size; i++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, size - 1));
        const x = (buf[i] - mean) * w;
        centered[i] = x;
        energy += x * x;
      }
      return { centered, rms: Math.sqrt(energy / size) };
    }

    function estimateZeroCrossFrequency(buf, sampleRate) {
      if (!buf || !buf.length || !sampleRate) return null;
      let mean = 0;
      for (let i = 0; i < buf.length; i++) mean += buf[i];
      mean /= buf.length;
      let energy = 0;
      for (let i = 0; i < buf.length; i++) {
        const x = buf[i] - mean;
        energy += x * x;
      }
      const rms = Math.sqrt(energy / buf.length);
      if (rms < 0.001) return null;
      const gate = Math.max(0.0015, rms * 0.18);
      let crossings = 0;
      let lastSign = 0;
      for (let i = 0; i < buf.length; i++) {
        const x = buf[i] - mean;
        if (Math.abs(x) < gate) continue;
        const sign = x > 0 ? 1 : -1;
        if (lastSign && sign !== lastSign) crossings++;
        lastSign = sign;
      }
      const duration = buf.length / sampleRate;
      const f = crossings / (2 * duration);
      return isFinite(f) && f > 20 ? f : null;
    }

    function getLagRange(sampleRate, minFreq, maxFreq, size) {
      let tauMin = Math.floor(sampleRate / maxFreq);
      let tauMax = Math.floor(sampleRate / minFreq);
      tauMin = clamp(tauMin, 2, size - 4);
      tauMax = clamp(tauMax, tauMin + 2, Math.floor(size / 2) - 2);
      return { tauMin, tauMax };
    }

    function detectPitchYIN(buf, sampleRate, minFreq, maxFreq) {
      const size = buf.length;
      const { centered, rms } = preprocessPitchBuffer(buf);
      const minRms = Math.max(0.0012, Number(controls.silence ? controls.silence.value : 0.015) * 0.055);
      if (rms < minRms) return null;

      const { tauMin, tauMax } = getLagRange(sampleRate, minFreq, maxFreq, size);
      const diff = new Float32Array(tauMax + 2);
      const cmnd = new Float32Array(tauMax + 2);
      const maxSamples = Math.min(12000, Math.max(768, size - tauMax - 1));

      for (let tau = 1; tau <= tauMax; tau++) {
        let sum = 0;
        const limit = Math.min(size - tau, maxSamples);
        for (let i = 0; i < limit; i++) {
          const delta = centered[i] - centered[i + tau];
          sum += delta * delta;
        }
        diff[tau] = sum / limit;
      }

      cmnd[0] = 1;
      let runningSum = 0;
      for (let tau = 1; tau <= tauMax; tau++) {
        runningSum += diff[tau];
        cmnd[tau] = runningSum ? diff[tau] * tau / runningSum : 1;
      }

      const threshold = controls.steadyMode && controls.steadyMode.checked ? 0.20 : 0.24;
      let tau = -1;
      for (let i = tauMin; i <= tauMax; i++) {
        if (cmnd[i] < threshold) {
          while (i + 1 <= tauMax && cmnd[i + 1] < cmnd[i]) i++;
          tau = i;
          break;
        }
      }

      if (tau < 0) {
        let bestTau = -1;
        let bestVal = Infinity;
        for (let i = tauMin + 1; i <= tauMax - 1; i++) {
          if (cmnd[i] <= cmnd[i - 1] && cmnd[i] <= cmnd[i + 1] && cmnd[i] < bestVal) {
            bestVal = cmnd[i];
            bestTau = i;
          }
        }
        if (bestTau < 0 || bestVal > 0.46) return null;
        tau = bestTau;
      }

      tau = chooseStableLag(tau, cmnd, tauMin, tauMax, sampleRate);
      const refinedTau = refineLagParabolic(tau, cmnd, tauMin, tauMax);
      const frequency = sampleRate / refinedTau;
      const confidence = clamp(1 - cmnd[tau], 0, 1);

      if (frequency < minFreq || frequency > maxFreq || confidence < 0.34) return null;
      return { frequency, confidence };
    }

    function chooseStableLag(tau, cmnd, tauMin, tauMax, sampleRate) {
      // 钢琴音高校准修复：YIN 已经找到第一个低谷时，不再偏向更大的 lag。
      // 对纯音或稳定人声，tau 与 2*tau 都可能很低；若选择 2*tau，就会把 C4(261.63Hz)误判为 C3(130.81Hz)。
      // 因此：默认保留首个可信周期；只有更大 lag 明显更好时才允许降八度。
      let best = tau;
      const baseVal = cmnd[tau];

      // 若出现更短周期且低谷接近，优先更短周期，避免半频/低八度误判。
      for (const d of [2, 3, 4]) {
        const v = Math.round(tau / d);
        if (v >= tauMin && cmnd[v] <= baseVal * 1.08 + 0.025) {
          best = v;
          break;
        }
      }

      // 只有当倍周期显著更优，才认为前一个周期可能是泛音；门槛很严格，防止 C4→C3。
      for (const m of [2, 3, 4]) {
        const v = Math.round(tau * m);
        if (v <= tauMax && cmnd[v] + 0.060 < cmnd[best] && cmnd[v] < cmnd[best] * 0.72) {
          best = v;
        }
      }
      return best;
    }

    function refineLagParabolic(tau, values, tauMin, tauMax) {
      if (tau <= tauMin || tau >= tauMax) return tau;
      const left = values[tau - 1];
      const center = values[tau];
      const right = values[tau + 1];
      const denom = left - 2 * center + right;
      if (!isFinite(denom) || Math.abs(denom) < 1e-9) return tau;
      return tau + clamp((left - right) / (2 * denom), -0.5, 0.5);
    }

    function detectPitchMPM(buf, sampleRate, minFreq, maxFreq) {
      const size = buf.length;
      const { centered, rms } = preprocessPitchBuffer(buf);
      if (rms < Math.max(0.0012, Number(controls.silence ? controls.silence.value : 0.015) * 0.055)) return null;
      const { tauMin, tauMax } = getLagRange(sampleRate, minFreq, maxFreq, size);
      const nsdf = new Float32Array(tauMax + 2);
      const maxSamples = Math.min(12000, Math.max(768, size - tauMax - 1));
      for (let tau = tauMin; tau <= tauMax; tau++) {
        let acf = 0, m = 0;
        const limit = Math.min(size - tau, maxSamples);
        for (let i = 0; i < limit; i++) {
          const a = centered[i];
          const b = centered[i + tau];
          acf += a * b;
          m += a * a + b * b;
        }
        nsdf[tau] = m ? (2 * acf / m) : 0;
      }
      let bestTau = -1, best = 0;
      const peaks = [];
      for (let tau = tauMin + 1; tau <= tauMax - 1; tau++) {
        const v = nsdf[tau];
        if (v > nsdf[tau - 1] && v >= nsdf[tau + 1] && v > 0.36) {
          peaks.push(tau);
          if (v > best) { best = v; bestTau = tau; }
        }
      }
      if (bestTau < 0 || best < 0.38) return null;
      let chosen = bestTau;
      // 选择接近最高峰的一处较早峰值，避免选到倍周期而偏低。
      for (const tau of peaks) {
        if (nsdf[tau] >= best * 0.88) { chosen = tau; break; }
      }
      const refinedTau = refinePeakParabolic(chosen, nsdf, tauMin, tauMax);
      const frequency = sampleRate / refinedTau;
      if (frequency < minFreq || frequency > maxFreq) return null;
      return { frequency, confidence: clamp(nsdf[chosen], 0, 1) };
    }

    function refinePeakParabolic(tau, values, tauMin, tauMax) {
      if (tau <= tauMin || tau >= tauMax) return tau;
      const left = values[tau - 1];
      const center = values[tau];
      const right = values[tau + 1];
      const denom = left - 2 * center + right;
      if (!isFinite(denom) || Math.abs(denom) < 1e-9) return tau;
      return tau + clamp((left - right) / (2 * denom), -0.5, 0.5);
    }

    function detectPitchACF(buf, sampleRate, minFreq, maxFreq) {
      const size = buf.length;
      const { centered, rms } = preprocessPitchBuffer(buf);
      if (rms < 0.0012) return null;
      let minLag = Math.floor(sampleRate / maxFreq);
      let maxLag = Math.floor(sampleRate / minFreq);
      minLag = clamp(minLag, 2, size - 2);
      maxLag = clamp(maxLag, minLag + 2, Math.floor(size / 2));

      let bestLag = -1;
      let bestCorr = 0;
      const correlations = new Float32Array(maxLag + 1);

      for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0, normA = 0, normB = 0;
        const limit = Math.min(size - lag, 12000);
        for (let i = 0; i < limit; i++) {
          const a = centered[i];
          const b = centered[i + lag];
          corr += a * b;
          normA += a * a;
          normB += b * b;
        }
        corr = corr / Math.sqrt(normA * normB || 1);
        correlations[lag] = corr;
        if (corr > bestCorr) {
          bestCorr = corr;
          bestLag = lag;
        }
      }
      if (bestLag < 0 || bestCorr < 0.32) return null;

      // 钢琴音高校准修复：ACF 对纯音会在 1、2、3 个周期处都出现高相关。
      // 不能只因倍周期相关度接近就选择更大 lag，否则 C4 会变成 C3。
      // 只在倍周期显著高于首个峰时才降八度。
      let chosenLag = bestLag;
      for (const m of [2, 3, 4]) {
        const v = Math.round(bestLag * m);
        if (v <= maxLag && correlations[v] > bestCorr + 0.08 && correlations[v] >= 0.92) chosenLag = v;
      }
      const c0 = correlations[chosenLag - 1] || correlations[chosenLag] || bestCorr;
      const c1 = correlations[chosenLag] || bestCorr;
      const c2 = correlations[chosenLag + 1] || c1;
      const shift = (c2 - c0) / (2 * (2 * c1 - c2 - c0) || 1);
      const betterLag = chosenLag + clamp(shift, -0.5, 0.5);
      const frequency = sampleRate / betterLag;
      if (frequency < minFreq || frequency > maxFreq) return null;
      return { frequency, confidence: clamp(c1, 0, 1) };
    }

    function freqToY(freq, minFreq, maxFreq) {
      const topPad = 38;
      const bottomPad = 58;
      const rel = clamp(Math.log2(freq / minFreq) / Math.log2(maxFreq / minFreq), 0, 1);
      return canvasHeight - bottomPad - rel * (canvasHeight - topPad - bottomPad);
    }

    function pitchToColor(freq, minFreq, maxFreq) {
      if (!controls.colorMode.checked) return 'hsl(190 90% 62%)';
      const rel = clamp(Math.log2(freq / minFreq) / Math.log2(maxFreq / minFreq), 0, 1);
      const hue = Math.round(215 - rel * 195);
      const light = Math.round(56 + rel * 5);
      return `hsl(${hue} 92% ${light}%)`;
    }

    function midiToFreq(midi) {
      return PIANO_A4_HZ * Math.pow(2, (Number(midi) - PIANO_A4_MIDI) / 12);
    }

    function freqToMidiFloat(freq) {
      return PIANO_A4_MIDI + 12 * Math.log2(Number(freq) / PIANO_A4_HZ);
    }

    function midiToName(midi) {
      const rounded = Math.round(Number(midi));
      return NOTE_NAMES[((rounded % 12) + 12) % 12] + Math.floor(rounded / 12 - 1);
    }

    function freqToNote(freq) {
      if (!isFinite(freq) || freq <= 0) return { midi: null, name: '—', solfege: '—', cents: 0 };
      const midi = Math.round(freqToMidiFloat(freq));
      const name = midiToName(midi);
      const solfege = SOLFEGE[((midi % 12) + 12) % 12];
      const cents = Math.round(1200 * Math.log2(freq / midiToFreq(midi)));
      return { midi, name, solfege, cents };
    }

    function formatCents(cents) {
      if (!isFinite(cents)) return '—';
      if (Math.abs(cents) <= 3) return '接近标准音';
      return (cents > 0 ? '+' : '') + cents + ' 音分';
    }

    

    function snapshotCurrentTrace() {
      if (!points || !points.length) return;
      const copy = points.map(p => ({t:p.t, x:p.x, y:p.y, pitch:p.pitch, rms:p.rms}));
      if (mode === 'file') importedTracePoints = copy;
      if (mode === 'mic' || mode === 'recording') recordedTracePoints = copy;
      updateCurrentSegmentTrace();
      drawComparisonPanel();
    }
    function drawTraceOnComparison(ctx2, arr, color, w, h) {
      if (!arr || arr.length < 2) return;
      const minT = Math.min(...arr.map(p => p.t));
      const maxT = Math.max(...arr.map(p => p.t));
      const spanT = Math.max(1, maxT - minT);
      const pad = 22;
      ctx2.save(); ctx2.strokeStyle = color; ctx2.lineWidth = 2.5; ctx2.lineJoin = 'round'; ctx2.lineCap = 'round'; ctx2.beginPath();
      arr.forEach((p, i) => { const x = pad + ((p.t - minT) / spanT) * (w - pad * 2); const y = pad + (p.y / Math.max(1, canvasHeight)) * (h - pad * 2); if (i === 0) ctx2.moveTo(x, y); else ctx2.lineTo(x, y); });
      ctx2.stroke(); ctx2.restore();
    }
    function drawComparisonPanel() {
      if (!comparisonCanvas || !comparisonCtx) return;
      const wrap = comparisonCanvas.parentElement;
      const rectW = Math.max(900, wrap ? wrap.clientWidth : 900);
      const h = 250;
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      comparisonCanvas.style.width = rectW + 'px'; comparisonCanvas.style.height = h + 'px'; comparisonCanvas.width = Math.floor(rectW * ratio); comparisonCanvas.height = Math.floor(h * ratio);
      const c = comparisonCtx; c.setTransform(ratio, 0, 0, ratio, 0, 0); c.clearRect(0,0,rectW,h);
      const grd = c.createLinearGradient(0,0,0,h); grd.addColorStop(0,'rgba(8,20,38,.96)'); grd.addColorStop(1,'rgba(4,12,24,.96)'); c.fillStyle = grd; c.fillRect(0,0,rectW,h);
      c.strokeStyle = 'rgba(162,191,217,.12)'; c.lineWidth = 1; for(let x=0;x<rectW;x+=80){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();} for(let y=0;y<h;y+=50){c.beginPath();c.moveTo(0,y);c.lineTo(rectW,y);c.stroke();}
      if (!importedTracePoints.length && !recordedTracePoints.length) { c.fillStyle = 'rgba(226,238,249,.72)'; c.font = '15px ui-sans-serif, system-ui, sans-serif'; c.fillText('暂无对比数据：先上传音频播放，再录音生成两条旋律线。', 26, 44); return; }
      drawTraceOnComparison(c, importedTracePoints, 'rgba(99,199,216,.95)', rectW, h); drawTraceOnComparison(c, recordedTracePoints, 'rgba(245,190,106,.96)', rectW, h);
    }


    function drawSavedTraceOnMain(arr, color, label) {
      if (!arr || arr.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.8;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      let started = false;
      arr.forEach((p) => {
        if (!isFinite(p.x) || !isFinite(p.y)) return;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      const first = arr.find(p => isFinite(p.x) && isFinite(p.y));
      if (first) {
        ctx.globalAlpha = .95;
        ctx.fillStyle = color;
        roundRect(ctx, first.x + 8, Math.max(18, first.y - 28), 74, 24, 12);
        ctx.fill();
        ctx.fillStyle = '#07111f';
        ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(label, first.x + 18, Math.max(35, first.y - 12));
      }
      ctx.restore();
    }
    function drawComparisonInMainView() {
      // 多段导入音频与多段录音统一叠加在同一个观察区显示，不再另设对比画布。
      audioSegments.forEach((seg, i) => {
        if (seg.trace && seg.trace.length > 1) drawSavedTraceOnMain(seg.trace, segmentColor(i), seg.type === 'recording' ? '录音' + (i+1) : '导入' + (i+1));
      });
      // 兼容旧版单条缓存。
      if (!audioSegments.length) {
        drawSavedTraceOnMain(importedTracePoints, 'rgba(125,211,252,.92)', '导入音频');
        drawSavedTraceOnMain(recordedTracePoints, 'rgba(250,204,21,.92)', '录音');
      }
    }

function draw() {
      ctx.clearRect(0, 0, virtualWidth, canvasHeight);
      drawBackground();
      drawMarkers();
      drawComparisonInMainView();
      drawMelody();
      if (controls.noteLabels && controls.noteLabels.checked) drawNoteLabelsOnMelody();
      drawPlaybackCursor();
      drawPitchAxisOverlay();
      drawAxisCaption();
      drawComparisonPanel();
    }

    function drawPlaybackCursor() {
      const t = getCursorTime();
      if (t === null) return;
      const x = cursorXFromTime(t);
      if (!isFinite(x)) return;
      ctx.save();
      ctx.strokeStyle = mode === 'mic' ? 'rgba(34, 211, 238, .92)' : 'rgba(251, 191, 36, .94)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
      ctx.fillStyle = mode === 'mic' ? 'rgba(8, 145, 178, .95)' : 'rgba(217, 119, 6, .95)';
      roundRect(ctx, x + 8, 22, 112, 30, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText((mode === 'mic' ? '实时 ' : '播放 ') + formatTime(t), x + 18, 42);
      ctx.restore();
    }

    function drawBackground() {
      const grd = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      grd.addColorStop(0, 'rgba(255, 237, 213, .07)');
      grd.addColorStop(.45, 'rgba(56, 189, 248, .035)');
      grd.addColorStop(1, 'rgba(59, 130, 246, .09)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, virtualWidth, canvasHeight);

      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, .15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < virtualWidth; x += 95) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasHeight); ctx.stroke();
      }
      for (let y = 40; y < canvasHeight - 20; y += 54) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(virtualWidth, y); ctx.stroke();
      }
      drawPitchGuides();
      drawBeatGridOnMelody();
      ctx.restore();
    }


    function drawBeatGridOnMelody() {
      const sig = getTimeSignature();
      const tempo = getTempoInfo();
      const pxPerSec = Number(controls.speed.value || 95);
      const beatSec = (60 / tempo.bpm) * (4 / sig.bottom);
      if (!isFinite(beatSec) || beatSec <= 0) return;
      const startX = 48;
      let beat = 0;
      for (let x = startX; x < virtualWidth; x += beatSec * pxPerSec) {
        const inMeasure = beat % sig.top;
        ctx.strokeStyle = inMeasure === 0 ? 'rgba(251, 191, 36, .32)' : 'rgba(125, 211, 252, .12)';
        ctx.lineWidth = inMeasure === 0 ? 1.5 : 1;
        ctx.setLineDash(inMeasure === 0 ? [] : [4, 8]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
        if (inMeasure === 0) {
          ctx.fillStyle = 'rgba(251, 191, 36, .72)';
          ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
          ctx.fillText('小节 ' + (Math.floor(beat / sig.top) + 1), x + 5, 14);
        }
        beat += 1;
      }
      ctx.setLineDash([]);
    }

    function getPitchScaleInfo() {
      const minFreq = Math.min(Number(controls.minFreq.value), Number(controls.maxFreq.value) - 20);
      const maxFreq = Math.max(Number(controls.maxFreq.value), minFreq + 20);
      const minMidi = Math.ceil(freqToMidiFloat(minFreq));
      const maxMidi = Math.floor(freqToMidiFloat(maxFreq));
      const naturalSet = new Set([0, 2, 4, 5, 7, 9, 11]);
      const viewportLeft = scroller.scrollLeft || 0;
      const axisX = clamp(viewportLeft + 12, 12, Math.max(12, virtualWidth - 150));
      const axisTop = 18;
      const axisBottom = canvasHeight - 38;
      const axisLineX = axisX + 74;
      const labelX = axisX + 8;
      const hzX = axisX + 82;
      const rangeSemis = Math.max(1, maxMidi - minMidi);
      const pitchArea = canvasHeight - 34 - 48;
      const avgSemiPx = pitchArea / rangeSemis;
      return { minFreq, maxFreq, minMidi, maxMidi, naturalSet, viewportLeft, axisX, axisTop, axisBottom, axisLineX, labelX, hzX, avgSemiPx };
    }

    function drawPitchGuides() {
      const { minFreq, maxFreq, minMidi, maxMidi, naturalSet } = getPitchScaleInfo();
      ctx.save();

      // 完整十二平均律半音线：每个半音一条，位置使用 log2 频率映射，和旋律线 Y 轴完全一致。
      for (let midi = minMidi; midi <= maxMidi; midi++) {
        const pc = ((midi % 12) + 12) % 12;
        const freq = midiToFreq(midi);
        const y = freqToY(freq, minFreq, maxFreq);
        const isC = pc === 0;
        const isA4 = midi === 69;
        const isNatural = naturalSet.has(pc);

        ctx.setLineDash(isNatural ? [] : [2, 7]);
        ctx.lineWidth = isC || isA4 ? 1.35 : isNatural ? 0.85 : 0.55;
        ctx.strokeStyle = isA4
          ? 'rgba(56, 189, 248, .42)'
          : isC
            ? 'rgba(226, 232, 240, .28)'
            : isNatural
              ? 'rgba(148, 163, 184, .17)'
              : 'rgba(148, 163, 184, .075)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(virtualWidth, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPitchAxisOverlay() {
      const { minFreq, maxFreq, minMidi, maxMidi, naturalSet, viewportLeft, axisX, axisTop, axisBottom, axisLineX, labelX, hzX, avgSemiPx } = getPitchScaleInfo();
      const axisW = 132;
      ctx.save();

      // 半透明“贴边”刻度面板。由于 canvas 会横向滚动，面板按 scrollLeft 重绘，视觉上接近固定 Y 轴。
      ctx.fillStyle = 'rgba(2, 6, 23, .70)';
      roundRect(ctx, axisX - 8, axisTop, axisW, axisBottom - axisTop, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, .22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Y 轴主线与刻度。
      ctx.strokeStyle = 'rgba(226, 232, 240, .35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisLineX, axisTop + 18);
      ctx.lineTo(axisLineX, axisBottom - 8);
      ctx.stroke();

      ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(226, 232, 240, .82)';
      ctx.fillText('音高刻度', labelX, axisTop + 18);
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, .82)';
      ctx.fillText('十二平均律 / Hz', labelX, axisTop + 33);

      let lastLabelY = -999;
      for (let midi = minMidi; midi <= maxMidi; midi++) {
        const pc = ((midi % 12) + 12) % 12;
        const freq = midiToFreq(midi);
        const y = freqToY(freq, minFreq, maxFreq);
        const isC = pc === 0;
        const isA4 = midi === 69;
        const isNatural = naturalSet.has(pc);
        const isSharp = !isNatural;

        const tickLen = isC || isA4 ? 17 : isNatural ? 12 : 7;
        ctx.strokeStyle = isC || isA4 ? 'rgba(226, 232, 240, .72)' : isNatural ? 'rgba(203, 213, 225, .45)' : 'rgba(148, 163, 184, .25)';
        ctx.lineWidth = isC || isA4 ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(axisLineX - tickLen, y);
        ctx.lineTo(axisLineX + 4, y);
        ctx.stroke();

        // 标注策略：宽音域下标 C 与 A4；中等音域标自然音；窄音域标全部半音。
        let shouldLabel = false;
        if (isC || isA4) shouldLabel = true;
        if (avgSemiPx >= 13 && isNatural) shouldLabel = true;
        if (avgSemiPx >= 20) shouldLabel = true;
        if (avgSemiPx < 13 && isNatural && Math.abs(y - lastLabelY) >= 26) shouldLabel = true;

        if (shouldLabel && y > axisTop + 44 && y < axisBottom - 8 && Math.abs(y - lastLabelY) >= 13) {
          const name = midiToName(midi);
          ctx.font = isC || isA4 ? 'bold 11px ui-sans-serif, system-ui, sans-serif' : '10px ui-sans-serif, system-ui, sans-serif';
          ctx.fillStyle = isA4 ? 'rgba(125, 211, 252, .95)' : isSharp ? 'rgba(148, 163, 184, .72)' : 'rgba(226, 232, 240, .86)';
          ctx.fillText(name, labelX, y + 4);
          ctx.fillStyle = isA4 ? 'rgba(125, 211, 252, .82)' : 'rgba(148, 163, 184, .72)';
          ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
          const hzText = freq >= 1000 ? (freq / 1000).toFixed(2) + 'k' : Math.round(freq) + 'Hz';
          ctx.fillText(hzText, hzX, y + 4);
          lastLabelY = y;
        }
      }

      // 标出当前最新音高在 Y 轴上的位置，便于核对线条与刻度是否对应。
      const last = points.length ? points[points.length - 1] : null;
      if (last && isFinite(last.pitch)) {
        const note = freqToNote(last.pitch);
        const y = freqToY(last.pitch, minFreq, maxFreq);
        ctx.strokeStyle = 'rgba(56, 189, 248, .75)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(axisLineX + 8, y);
        ctx.lineTo(Math.min(virtualWidth, viewportLeft + scroller.clientWidth), y);
        ctx.stroke();
        ctx.setLineDash([]);

        const tag = note.name + ' ' + Math.round(last.pitch) + 'Hz';
        ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
        const tagW = Math.max(82, ctx.measureText(tag).width + 18);
        const tagY = clamp(y - 14, axisTop + 38, axisBottom - 28);
        ctx.fillStyle = 'rgba(8, 47, 73, .94)';
        roundRect(ctx, axisLineX + 10, tagY, tagW, 25, 12);
        ctx.fill();
        ctx.fillStyle = '#bae6fd';
        ctx.fillText(tag, axisLineX + 19, tagY + 17);
      }

      ctx.restore();
    }

    function drawMarkers() {
      ctx.save();
      for (const m of restMarkers) {
        ctx.strokeStyle = 'rgba(203, 213, 225, .28)';
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(m.x, 32); ctx.lineTo(m.x, canvasHeight - 36); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(15, 23, 42, .8)';
        roundRect(ctx, m.x + 8, canvasHeight - 74, 86, 28, 12);
        ctx.fill();
        ctx.fillStyle = 'rgba(226, 232, 240, .9)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(m.label, m.x + 16, canvasHeight - 55);
      }
      for (const m of phraseMarkers) {
        ctx.strokeStyle = 'rgba(251, 191, 36, .86)';
        ctx.setLineDash([8, 7]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(m.x, 18); ctx.lineTo(m.x, canvasHeight - 18); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(251, 191, 36, .16)';
        roundRect(ctx, m.x + 10, 20, 74, 30, 14);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(m.label, m.x + 20, 40);
      }
      ctx.restore();
    }

    function drawMelody() {
      if (!points.length) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (b.breakBefore || b.t - a.t > 0.24) continue;
        const segmentJumpSemi = (a.displayPitch && b.displayPitch) ? Math.abs(12 * Math.log2(b.displayPitch / a.displayPitch)) : 0;
        // 视觉层过滤：真实旋律大跳仍可显示，但 0.1秒内超过 18 个半音的单帧竖线多为瞬态误判，避免画成冲天尖峰。
        if (segmentJumpSemi > 18 && (b.t - a.t) < 0.12) continue;
        ctx.globalAlpha = Math.min(a.alpha, b.alpha);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = (a.width + b.width) / 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        const midX = (a.x + b.x) / 2;
        ctx.bezierCurveTo(midX, a.y, midX, b.y, b.x, b.y);
        ctx.stroke();
      }
      if (controls.dots.checked) {
        for (let i = 0; i < points.length; i += 2) {
          const p = points[i];
          ctx.globalAlpha = Math.min(.92, p.alpha + .05);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.7, p.width * .36), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawAxisCaption() {
      ctx.save();
      ctx.fillStyle = 'rgba(226, 232, 240, .82)';
      ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('高音 / 暖色', virtualWidth - 112, 28);
      ctx.fillText('低音 / 冷色', virtualWidth - 112, canvasHeight - 18);
      ctx.fillStyle = 'rgba(148, 163, 184, .78)';
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('时间 →', 50, canvasHeight - 18);
      ctx.restore();
    }



    function pitchToMidi(freq) {
      return Math.round(69 + 12 * Math.log2(freq / 440));
    }

    function midiPitchClass(midi) {
      return ((midi % 12) + 12) % 12;
    }

    function quantizeDurationLabel(seconds, unit) {
      const quarterSec = Math.max(0.12, unit || (60 / (getTempoInfo ? getTempoInfo().bpm : 92)));
      const beatsRaw = seconds / quarterSec;
      const choices = [
        {beats:0.25, symbol:'♬', text:'十六分', underline:2, extend:0, noteValue:'16'},
        {beats:0.5, symbol:'♪', text:'八分', underline:1, extend:0, noteValue:'8'},
        {beats:1, symbol:'♩', text:'四分', underline:0, extend:0, noteValue:'4'},
        {beats:1.5, symbol:'♩.', text:'附点四分', underline:0, extend:0, noteValue:'4.'},
        {beats:2, symbol:'𝅗𝅥', text:'二分', underline:0, extend:1, noteValue:'2'},
        {beats:3, symbol:'𝅗𝅥.', text:'附点二分', underline:0, extend:1, noteValue:'2.'},
        {beats:4, symbol:'𝅝', text:'全音', underline:0, extend:2, noteValue:'1'}
      ];
      let best = choices[0];
      for (const c of choices) if (Math.abs(c.beats - beatsRaw) < Math.abs(best.beats - beatsRaw)) best = c;
      return { ...best, beats: best.beats, rawBeats: beatsRaw };
    }

    function estimateBeatUnit(events) {
      const tempo = getTempoInfo ? getTempoInfo() : { bpm: 92 };
      return 60 / tempo.bpm;
    }

    function quantizeNotationRhythm(events) {
      if (!events || !events.length) return [];
      const tempo = getTempoInfo ? getTempoInfo() : { bpm: 92 };
      const quarterSec = 60 / tempo.bpm;
      const gridSec = quarterSec / 4; // 十六分音符网格
      const base = events[0].start || 0;
      const pxPerSec = Number(controls.speed ? controls.speed.value : 95) || 95;
      const minDur = gridSec;
      return events.map(e => {
        const startGrid = Math.max(0, Math.round((e.start - base) / gridSec));
        const rawDurGrid = Math.max(1, Math.round((e.duration || (e.end - e.start) || gridSec) / gridSec));
        const start = base + startGrid * gridSec;
        const duration = Math.max(minDur, rawDurGrid * gridSec);
        const end = start + duration;
        const x = (events[0].x || 0) + (start - base) * pxPerSec;
        const endX = x + duration * pxPerSec;
        const durInfo = quantizeDurationLabel(duration, quarterSec);
        return { ...e, start, end, duration, x, endX, durationBeats: durInfo.beats, rawDurationBeats: durInfo.rawBeats, noteValue: durInfo.noteValue };
      }).filter(e => e.type === 'rest' ? e.duration >= gridSec * .75 : true);
    }

    function midiToJianpu(midi, keyPc) {
      const chromaticMap = {
        0: ['1', ''], 1: ['1', '#'], 2: ['2', ''], 3: ['2', '#'], 4: ['3', ''], 5: ['4', ''],
        6: ['4', '#'], 7: ['5', ''], 8: ['5', '#'], 9: ['6', ''], 10: ['6', '#'], 11: ['7', '']
      };
      const pc = midiPitchClass(midi);
      const rel = ((pc - keyPc) + 12) % 12;
      const [num, acc] = chromaticMap[rel] || ['?', ''];
      const rootMidi = 60 + Number(keyPc || 0);
      const octave = Math.floor((midi - rootMidi) / 12);
      const aboveDots = octave > 0 ? '•'.repeat(Math.min(octave, 3)) : '';
      const belowDots = octave < 0 ? '•'.repeat(Math.min(-octave, 3)) : '';
      return { text: acc + num, aboveDots, belowDots, octave };
    }

    function buildNotationEvents() {
      if (points.length < 2) return [];
      const frames = points
        .filter(p => isFinite(p.t) && isFinite(p.pitch) && isFinite(p.x))
        .map(p => ({
          t: p.t,
          x: p.x,
          y: p.y,
          midi: pitchToMidi(p.pitch),
          pitch: p.pitch,
          breakBefore: !!p.breakBefore
        }))
        .filter(f => isFinite(f.midi));
      if (frames.length < 2) return [];

      // 对 MIDI 序列做小窗口中值滤波，避免颤音和识别抖动把一个长音切成很多碎音。
      for (let i = 0; i < frames.length; i++) {
        const bucket = [];
        for (let k = Math.max(0, i - 2); k <= Math.min(frames.length - 1, i + 2); k++) bucket.push(frames[k].midi);
        bucket.sort((a, b) => a - b);
        frames[i].qMidi = bucket[Math.floor(bucket.length / 2)];
      }

      const events = [];
      let segStart = frames[0];
      let segLast = frames[0];
      let segMidi = frames[0].qMidi;
      let sumPitch = frames[0].pitch;
      let sumY = frames[0].y;
      let count = 1;

      const closeNote = (endT, endX) => {
        const startT = segStart.t;
        const duration = Math.max(0.04, endT - startT);
        events.push({
          type: 'note',
          start: startT,
          end: endT,
          duration,
          x: segStart.x,
          endX,
          midi: Math.round(segMidi),
          pitch: sumPitch / Math.max(1, count),
          y: sumY / Math.max(1, count)
        });
      };

      for (let i = 1; i < frames.length; i++) {
        const cur = frames[i];
        const gap = cur.t - segLast.t;
        const changed = cur.qMidi !== segMidi;
        const broken = cur.breakBefore || gap > 0.24;

        if (broken || changed) {
          const splitT = broken ? segLast.t : (segLast.t + cur.t) / 2;
          const splitX = broken ? segLast.x : (segLast.x + cur.x) / 2;
          closeNote(splitT, splitX);
          if (broken && gap > 0.18) {
            events.push({ type: 'rest', start: segLast.t, end: cur.t, duration: gap, x: segLast.x, endX: cur.x });
          }
          segStart = cur;
          segMidi = cur.qMidi;
          sumPitch = cur.pitch;
          sumY = cur.y;
          count = 1;
        } else {
          sumPitch += cur.pitch;
          sumY += cur.y;
          count += 1;
        }
        segLast = cur;
      }
      closeNote(segLast.t + 0.06, segLast.x + 6);

      // 合并过短碎音，保留课堂上能看清的主要旋律骨架。
      let merged = events.slice();
      for (let pass = 0; pass < 3; pass++) {
        const next = [];
        for (let i = 0; i < merged.length; i++) {
          const e = merged[i];
          if (e.type === 'note' && e.duration < 0.13 && next.length) {
            const prev = next[next.length - 1];
            if (prev.type === 'note') {
              prev.end = e.end;
              prev.endX = e.endX;
              prev.duration = prev.end - prev.start;
              prev.pitch = (prev.pitch + e.pitch) / 2;
              prev.midi = Math.round((prev.midi + e.midi) / 2);
              continue;
            }
          }
          if (e.type === 'rest' && e.duration < 0.16) continue;
          const prev = next[next.length - 1];
          if (prev && prev.type === e.type && e.type === 'note' && prev.midi === e.midi && e.start - prev.end < 0.18) {
            prev.end = e.end;
            prev.endX = e.endX;
            prev.duration = prev.end - prev.start;
            continue;
          }
          next.push({ ...e });
        }
        merged = next;
      }
      return quantizeNotationRhythm(merged).slice(0, 220);
    }

    function renderJianpu(events) {
      if (!notationOutput) return;
      const mode = controls.notationMode ? controls.notationMode.value : 'both';
      if (mode === 'staff') {
        notationOutput.innerHTML = '<span class="pill">已隐藏简谱</span>当前选择为“只显示五线谱”。';
        return;
      }
      if (!events.length) {
        notationOutput.textContent = '暂无可转换的稳定旋律。请先录入或播放一段单声部旋律。';
        return;
      }
      const keyInfo = getKeyInfo();
      const keyPc = keyInfo.pc;
      const sig = getTimeSignature();
      const tempo = getTempoInfo();
      const unit = estimateBeatUnit(events);
      const html = [];
      let lastPhraseX = -Infinity;
      html.push('<span class="pill">简谱参考</span>');
      html.push('<div class="notation-meta"><span>调号：1=' + keyInfo.keyName + '（' + keyInfo.accidentalLabel + '）</span><span>调式：' + keyInfo.modeLabel + '</span><span>拍号：' + sig.label + '</span><span>速度：' + tempo.label + ' · ' + tempo.bpm + ' BPM</span></div>');
      for (const e of events) {
        if (e.type === 'rest') {
          if (e.duration > Number(controls.phraseGap.value || 0.7) && e.x - lastPhraseX > 60) {
            html.push('<span class="jianpu-bar">|</span>');
            lastPhraseX = e.x;
          }
          html.push('<span class="jianpu-rest"><span class="jianpu-oct">&nbsp;</span><span class="jianpu-num">0</span><span class="jianpu-dur">' + (e.durationBeats || quantizeDurationLabel(e.duration, unit).beats || 1) + '拍</span></span>');
          continue;
        }
        const jp = midiToJianpu(e.midi, keyPc);
        const dur = quantizeDurationLabel(e.duration, unit);
        const under = dur.underline ? '<span class="jianpu-under"></span>' : '<span style="height:4px"></span>';
        const extend = dur.extend ? '<span class="jianpu-extend">' + '—'.repeat(dur.extend) + '</span>' : '';
        html.push('<span class="jianpu-note" title="' + midiToName(e.midi) + ' / ' + Math.round(midiToFreq(e.midi)) + 'Hz / ' + e.duration.toFixed(2) + 's">' +
          '<span class="jianpu-oct">' + (jp.aboveDots || '&nbsp;') + '</span>' +
          '<span class="jianpu-num">' + jp.text + '</span>' + under +
          '<span class="jianpu-oct">' + (jp.belowDots || '&nbsp;') + '</span>' +
          '<span class="jianpu-dur">' + dur.text + ' · ' + (e.durationBeats || dur.beats || 1) + '拍</span>' + extend +
          '</span>');
      }
      notationOutput.innerHTML = html.join('');
    }

    function ensureNotationCanvasSize() {
      if (!notationCanvas || !notationCtx) return;
      notationCanvasHeight = 260;
      const width = Math.max(virtualWidth, notationScroller ? notationScroller.clientWidth : 1200, 1200);
      notationCanvas.style.width = width + 'px';
      notationCanvas.style.height = notationCanvasHeight + 'px';
      notationCanvas.width = Math.floor(width * dpr);
      notationCanvas.height = Math.floor(notationCanvasHeight * dpr);
      notationCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function renderEmptyNotation() {
      if (!notationCanvas || !notationCtx) return;
      ensureNotationCanvasSize();
      notationCtx.clearRect(0, 0, virtualWidth, notationCanvasHeight);
      notationCtx.fillStyle = 'rgba(2, 6, 23, .25)';
      notationCtx.fillRect(0, 0, Math.max(virtualWidth, 1200), notationCanvasHeight);
      notationCtx.fillStyle = 'rgba(226, 232, 240, .72)';
      notationCtx.font = 'bold 16px ui-sans-serif, system-ui, sans-serif';
      notationCtx.fillText('等待生成简谱 / 五线谱', 28, 54);
      notationCtx.font = '13px ui-sans-serif, system-ui, sans-serif';
      notationCtx.fillStyle = 'rgba(148, 163, 184, .88)';
      notationCtx.fillText('录入或播放音频后点击上方“生成简谱 / 五线谱”。谱例会与上方旋律线使用同一时间轴。', 28, 82);
    }

    function renderNotation(events) {
      renderJianpu(events);
      const mode = controls.notationMode ? controls.notationMode.value : 'both';
      if (mode === 'jianpu') {
        if (notationScroller) notationScroller.style.display = 'none';
        return;
      }
      if (notationScroller) notationScroller.style.display = 'block';
      drawStaffNotation(events);
    }

    function drawStaffNotation(events) {
      if (!notationCanvas || !notationCtx) return;
      ensureNotationCanvasSize();
      const c = notationCtx;
      const w = Math.max(virtualWidth, notationScroller ? notationScroller.clientWidth : 1200, 1200);
      const h = notationCanvasHeight;
      c.clearRect(0, 0, w, h);
      const bg = c.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, 'rgba(15, 23, 42, .96)');
      bg.addColorStop(1, 'rgba(2, 6, 23, .98)');
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);

      const staffTop = 74;
      const lineGap = 12;
      const bottomLineY = staffTop + lineGap * 4;
      c.strokeStyle = 'rgba(226, 232, 240, .62)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const y = staffTop + i * lineGap;
        c.beginPath(); c.moveTo(24, y); c.lineTo(w - 24, y); c.stroke();
      }

      // 节拍 / 小节网格，和旋律线横向速度一致。
      const pxPerSec = Number(controls.speed.value || 95);
      const sigForGrid = getTimeSignature();
      const tempoForGrid = getTempoInfo();
      const beatSec = (60 / tempoForGrid.bpm) * (4 / sigForGrid.bottom);
      c.lineWidth = 1;
      let beatIndex = 0;
      for (let x = 48; x < w; x += beatSec * pxPerSec) {
        const inMeasure = beatIndex % sigForGrid.top;
        c.strokeStyle = inMeasure === 0 ? 'rgba(251, 191, 36, .34)' : 'rgba(148, 163, 184, .12)';
        c.setLineDash(inMeasure === 0 ? [] : [3, 7]);
        c.beginPath(); c.moveTo(x, 28); c.lineTo(x, h - 22); c.stroke();
        if (inMeasure === 0) {
          c.fillStyle = 'rgba(251, 191, 36, .72)';
          c.font = '10px ui-sans-serif, system-ui, sans-serif';
          c.fillText('小节 ' + (Math.floor(beatIndex / sigForGrid.top) + 1), x + 4, h - 12);
        }
        beatIndex += 1;
      }
      c.setLineDash([]);

      const keyInfo = getKeyInfo();
      const sig = getTimeSignature();
      const tempo = getTempoInfo();
      c.fillStyle = '#e5e7eb';
      c.font = 'bold 26px Georgia, serif';
      c.fillText('𝄞', 30, staffTop + lineGap * 3.5);
      drawKeySignature(c, 64, staffTop, lineGap, keyInfo.sig);
      drawTimeSignature(c, 112, staffTop, lineGap, sig);
      c.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
      c.fillStyle = '#bae6fd';
      c.fillText('五线谱参考｜调号：' + keyInfo.keyName + '（' + keyInfo.accidentalLabel + '）｜调式：' + keyInfo.modeLabel + '｜拍号：' + sig.label + '｜速度：' + tempo.label + ' · ' + tempo.bpm + ' BPM', 160, 34);
      c.fillStyle = 'rgba(148, 163, 184, .82)';
      c.font = '12px ui-sans-serif, system-ui, sans-serif';
      c.fillText('说明：已按当前 BPM 与十六分网格量化节奏，五线谱与上方旋律线共用时间轴；复杂伴奏仍建议校对。', 160, 54);

      if (!events.length) {
        c.fillStyle = 'rgba(226, 232, 240, .8)';
        c.font = '15px ui-sans-serif, system-ui, sans-serif';
        c.fillText('暂无可显示的五线谱。', 96, 132);
        return;
      }

      for (const e of events) {
        if (e.type === 'rest') {
          const x = (e.x + e.endX) / 2;
          if (e.duration > 0.16) drawRestSymbol(c, x, staffTop + lineGap * 1.8, e.duration);
          continue;
        }
        drawStaffNote(c, e, bottomLineY, lineGap);
      }
    }


    function drawKeySignature(c, startX, staffTop, lineGap, sigCount) {
      const count = Math.min(7, Math.abs(sigCount || 0));
      if (!count) return;
      const sharpOrder = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B, approximated staff positions
      const flatOrder = [6, 2, 5, 1, 4, 0, 3];  // B E A D G C F
      const order = sigCount > 0 ? sharpOrder : flatOrder;
      const symbol = sigCount > 0 ? '♯' : '♭';
      c.save();
      c.fillStyle = '#e2e8f0';
      c.font = 'bold 18px Georgia, serif';
      for (let i = 0; i < count; i++) {
        const step = order[i];
        const y = staffTop + lineGap * 2 - (step - 3) * (lineGap / 2);
        c.fillText(symbol, startX + i * 10, y + 6);
      }
      c.restore();
    }

    function drawTimeSignature(c, x, staffTop, lineGap, sig) {
      c.save();
      c.fillStyle = '#f8fafc';
      c.font = 'bold 23px Georgia, serif';
      c.textAlign = 'center';
      c.fillText(String(sig.top), x, staffTop + lineGap * 1.5);
      c.fillText(String(sig.bottom), x, staffTop + lineGap * 3.5);
      c.restore();
    }

    function diatonicStepFromE4(midi) {
      // 根据自然音名计算相对 E4 的五线谱级数。升降号仍放在相邻自然音位置。
      const pcToLetter = {0:'C',1:'C',2:'D',3:'D',4:'E',5:'F',6:'F',7:'G',8:'G',9:'A',10:'A',11:'B'};
      const letterOrder = {C:0, D:1, E:2, F:3, G:4, A:5, B:6};
      const pc = midiPitchClass(midi);
      const letter = pcToLetter[pc];
      // 找到接近的八度：MIDI C4=60，E4=64。
      const octave = Math.floor((midi - 12) / 12);
      return (octave - 4) * 7 + (letterOrder[letter] - letterOrder.E);
    }

    function drawStaffNote(c, e, bottomLineY, lineGap) {
      const stepPx = lineGap / 2;
      const x = e.x;
      let y = bottomLineY - diatonicStepFromE4(e.midi) * stepPx;
      y = clamp(y, 24, notationCanvasHeight - 28);
      const name = midiToName(e.midi);
      const isSharp = name.includes('♯');
      const dur = quantizeDurationLabel(e.duration, estimateBeatUnit(notationEvents));

      // ledger lines
      const topLineY = bottomLineY - lineGap * 4;
      c.strokeStyle = 'rgba(226, 232, 240, .62)';
      c.lineWidth = 1.1;
      for (let ly = bottomLineY + lineGap; ly <= y + 1; ly += lineGap) {
        c.beginPath(); c.moveTo(x - 13, ly); c.lineTo(x + 13, ly); c.stroke();
      }
      for (let ly = topLineY - lineGap; ly >= y - 1; ly -= lineGap) {
        c.beginPath(); c.moveTo(x - 13, ly); c.lineTo(x + 13, ly); c.stroke();
      }

      if (isSharp) {
        c.fillStyle = '#cbd5e1';
        c.font = 'bold 17px Georgia, serif';
        c.fillText('♯', x - 22, y + 6);
      }
      c.save();
      c.translate(x, y);
      c.rotate(-0.22);
      c.fillStyle = dur.symbol === '𝅝' ? 'rgba(15, 23, 42, .92)' : '#f8fafc';
      c.strokeStyle = '#f8fafc';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, 0, 9, 6.2, 0, 0, Math.PI * 2);
      if (dur.symbol === '𝅝' || dur.symbol === '𝅗𝅥') c.stroke(); else c.fill();
      c.restore();

      if (dur.symbol !== '𝅝') {
        const stemUp = y > bottomLineY - lineGap * 2;
        const stemX = stemUp ? x + 8 : x - 8;
        const stemY2 = stemUp ? y - 42 : y + 42;
        c.strokeStyle = '#f8fafc';
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(stemX, y); c.lineTo(stemX, stemY2); c.stroke();
        if (dur.symbol === '♪') {
          c.beginPath();
          if (stemUp) {
            c.moveTo(stemX, stemY2); c.quadraticCurveTo(stemX + 16, stemY2 + 8, stemX + 8, stemY2 + 20);
          } else {
            c.moveTo(stemX, stemY2); c.quadraticCurveTo(stemX - 16, stemY2 - 8, stemX - 8, stemY2 - 20);
          }
          c.stroke();
        }
      }

      c.fillStyle = 'rgba(186, 230, 253, .95)';
      c.font = '10px ui-sans-serif, system-ui, sans-serif';
      c.fillText(name + ' ' + (e.noteValue || ''), x - 14, Math.min(notationCanvasHeight - 12, y + 32));
    }

    function drawRestSymbol(c, x, y, duration) {
      c.fillStyle = 'rgba(203, 213, 225, .85)';
      c.font = 'bold 23px Georgia, serif';
      c.fillText('𝄽', x - 7, y + 8);
      c.font = '10px ui-sans-serif, system-ui, sans-serif';
      c.fillStyle = 'rgba(148, 163, 184, .82)';
      c.fillText((duration / Math.max(0.12, estimateBeatUnit(notationEvents))).toFixed(1) + '拍', x - 10, y + 28);
    }

    function generateNotation() {
      if (!points.length) {
        setStatus('<span class="pill">暂无旋律</span>请先开启麦克风演唱，或上传音频并播放，让系统先绘制旋律线。');
        renderEmptyNotation();
        return;
      }
      notationEvents = buildNotationEvents();
      renderNotation(notationEvents);
      const noteCount = notationEvents.filter(e => e.type === 'note').length;
      const restCount = notationEvents.filter(e => e.type === 'rest').length;
      const modeText = controls.notationMode ? controls.notationMode.options[controls.notationMode.selectedIndex].textContent : '简谱 + 五线谱';
      const keyInfo = getKeyInfo();
      const sig = getTimeSignature();
      const tempo = getTempoInfo();
      if (notationSummary) {
        notationSummary.textContent = '已生成 ' + noteCount + ' 个音符、' + restCount + ' 个休止/换气片段；当前显示：' + modeText + '；调号：' + keyInfo.keyName + '（' + keyInfo.accidentalLabel + '）；调式：' + keyInfo.modeLabel + '；拍号：' + sig.label + '；速度：' + tempo.label + ' · ' + tempo.bpm + ' BPM。谱例横向位置与上方旋律线对应，可横向滚动对照查看。';
      }
      setStatus('<span class="pill">转谱完成</span>已根据当前旋律线生成课堂参考简谱 / 五线谱。复杂伴奏、多人合唱或噪声环境下，建议教师再人工校对。');
      if (notationPanel) notationPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function drawNoteLabelsOnMelody() {
      if (!points.length) return;
      const events = notationEvents.length ? notationEvents : buildNotationEvents();
      const keyPc = Number(controls.keyRoot ? controls.keyRoot.value : 0);
      ctx.save();
      ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
      let lastX = -999;
      for (const e of events) {
        if (e.type !== 'note') continue;
        if (e.x - lastX < 30) continue;
        const jp = midiToJianpu(e.midi, keyPc);
        const label = midiToName(e.midi) + ' / ' + jp.text;
        const textW = ctx.measureText(label).width + 14;
        const y = clamp(e.y - 30, 38, canvasHeight - 76);
        ctx.fillStyle = 'rgba(15, 23, 42, .78)';
        roundRect(ctx, e.x - 4, y - 14, textW, 23, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 211, 252, .36)';
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.fillText(label, e.x + 3, y + 2);
        lastX = e.x;
      }
      ctx.restore();
    }

    function exportNotationImage() {
      if (!notationCanvas || !notationEvents.length) {
        setStatus('<span class="pill">暂无谱图</span>请先点击“生成简谱 / 五线谱”。');
        return;
      }
      drawStaffNotation(notationEvents);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = 'melody-notation-' + stamp + '.png';
      link.href = notationCanvas.toDataURL('image/png');
      link.click();
      setStatus('<span class="pill">已导出谱图</span>五线谱参考图已保存，可放入课件或课堂评价记录。');
    }


    function ensureAudioContextForMetronome() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function playMetronomeClick(accent = false) {
      const ac = ensureAudioContextForMetronome();
      const volume = clamp(Number(controls.metroVolume ? controls.metroVolume.value : 0.6), 0, 1);
      const sound = controls.metroSound ? controls.metroSound.value : 'wood';
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      let freq = accent ? 1200 : 780;
      let type = 'sine';
      let attack = 0.004;
      let decay = accent ? 0.105 : 0.075;
      if (sound === 'wood') { type = 'triangle'; freq = accent ? 1180 : 760; decay = accent ? 0.085 : 0.06; }
      if (sound === 'stick') { type = 'square'; freq = accent ? 980 : 640; decay = accent ? 0.045 : 0.035; }
      if (sound === 'soft') { type = 'sine'; freq = accent ? 880 : 660; decay = accent ? 0.13 : 0.10; }
      if (sound === 'electronic') { type = 'square'; freq = accent ? 1320 : 880; decay = accent ? 0.08 : 0.055; }
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * (accent ? 0.55 : 0.34)), now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + decay + 0.02);
    }

    function updateMetronomeIndicator(active = false) {
      if (!metroIndicator) return;
      const sig = getTimeSignature();
      const tempo = getTempoInfo();
      if (!active) {
        metroIndicator.textContent = '等待开始';
        metroIndicator.classList.remove('active');
        return;
      }
      const beatInMeasure = (metronomeBeat % sig.top) + 1;
      metroIndicator.textContent = '第 ' + beatInMeasure + ' / ' + sig.top + ' 拍 · ' + tempo.bpm + ' BPM';
      metroIndicator.classList.add('active');
    }

    function startMetronome() {
      stopMetronome(false);
      ensureAudioContextForMetronome();
      metronomeBeat = 0;
      const tick = () => {
        const sig = getTimeSignature();
        const tempo = getTempoInfo();
        const accent = metronomeBeat % sig.top === 0;
        playMetronomeClick(accent);
        updateMetronomeIndicator(true);
        metronomeBeat += 1;
      };
      tick();
      const sig = getTimeSignature();
      const tempo = getTempoInfo();
      const beatMs = Math.max(80, (60000 / tempo.bpm) * (4 / sig.bottom));
      metronomeTimer = window.setInterval(tick, beatMs);
      if (startMetroBtn) startMetroBtn.disabled = true;
      if (stopMetroBtn) stopMetroBtn.disabled = false;
      setStatus('<span class="pill">速度提示已开启</span>当前拍号 ' + sig.label + '，速度 ' + tempo.label + ' · ' + tempo.bpm + ' BPM。第一拍为重音。');
      draw();
      if (notationEvents.length) renderNotation(notationEvents);
    }

    function stopMetronome(showStatus = true) {
      if (metronomeTimer) {
        window.clearInterval(metronomeTimer);
        metronomeTimer = null;
      }
      updateMetronomeIndicator(false);
      if (startMetroBtn) startMetroBtn.disabled = false;
      if (stopMetroBtn) stopMetroBtn.disabled = true;
      if (showStatus) setStatus('<span class="pill">速度提示已停止</span>可继续调整拍号、速度或提示音。');
    }

    function restartMetronome() {
      if (!metronomeTimer) return;
      startMetronome();
    }

    function roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function formatTime(seconds) {
      seconds = Math.max(0, Number(seconds) || 0);
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      const d = Math.floor((seconds - Math.floor(seconds)) * 10);
      return m + ':' + String(s).padStart(2, '0') + '.' + d;
    }

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function escapeHtml(str) {
      return String(str).replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    }

    if (generateNotationBtn) generateNotationBtn.addEventListener('click', generateNotation);
    if (exportNotationBtn) exportNotationBtn.addEventListener('click', exportNotationImage);

    clearBtn.addEventListener('click', () => {
      resetAnalysisState();
      importedTracePoints = [];
      recordedTracePoints = [];
      drawComparisonPanel();
      setStatus('<span class="pill">画布已清空</span>可重新演唱、演奏或播放音频。');
    });

    saveBtn.addEventListener('click', () => {
      draw();
      const link = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = 'melody-line-' + stamp + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatus('<span class="pill">已导出图片</span>图片可用于课件、课堂记录、学生学习单或教学反思。');
    });

    if (stageAudioEl) {
      stageAudioEl.muted = true;
      stageAudioEl.addEventListener('play', playFromStageAudio);
      stageAudioEl.addEventListener('pause', pauseFromStageAudio);
      stageAudioEl.addEventListener('seeking', seekFromStageAudio);
      stageAudioEl.addEventListener('seeked', seekFromStageAudio);
      stageAudioEl.addEventListener('timeupdate', () => {
        if (!stageAudioSyncing && !stageAudioEl.paused && audioEl && audioEl.src) {
          const diff = Math.abs((audioEl.currentTime || 0) - (stageAudioEl.currentTime || 0));
          if (diff > 0.28) seekFromStageAudio();
        }
      });
    }

    if (stagePlayPauseBtn) stagePlayPauseBtn.addEventListener('click', toggleStagePlayback);
    if (stageSeek) {
      ['pointerdown', 'mousedown', 'touchstart'].forEach(evt => {
        stageSeek.addEventListener(evt, () => { stageSeekDragging = true; }, { passive: true });
      });
      stageSeek.addEventListener('input', () => {
        // 观察区进度条拖动时立即同步到底层 audio.currentTime，确保可拖、可定位、光标实时跟随。
        stageSeekDragging = true;
        seekStagePlaybackFromSlider({ previewOnly: false });
      });
      stageSeek.addEventListener('change', () => {
        stageSeekDragging = false;
        seekStagePlaybackFromSlider({ previewOnly: false });
      });
      ['pointerup', 'mouseup', 'touchend', 'blur', 'keyup'].forEach(evt => {
        stageSeek.addEventListener(evt, () => {
          if (stageSeekDragging) {
            stageSeekDragging = false;
            seekStagePlaybackFromSlider();
          }
        });
      });
    }

    startMicBtn.addEventListener('click', startMic);
    if (pauseRecordingBtn) pauseRecordingBtn.addEventListener('click', pauseRecording);
    stopMicBtn.addEventListener('click', finishRecording);
    if (stageStartRecordingBtn) stageStartRecordingBtn.addEventListener('click', startMic);
    if (stagePauseRecordingBtn) stagePauseRecordingBtn.addEventListener('click', pauseRecording);
    if (stageStopRecordingBtn) stageStopRecordingBtn.addEventListener('click', finishRecording);



    function openManual() {
      if (!manualOverlay) return;
      manualOverlay.classList.add('open');
      manualOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('manual-open');
      if (location.hash !== '#manual') history.replaceState(null, '', '#manual');
    }

    function closeManual() {
      if (!manualOverlay) return;
      manualOverlay.classList.remove('open');
      manualOverlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('manual-open');
      if (location.hash === '#manual') history.replaceState(null, '', location.pathname + location.search);
    }

    if (openManualBtn) openManualBtn.addEventListener('click', openManual);
    if (closeManualBtn) closeManualBtn.addEventListener('click', closeManual);
    if (manualOverlay) {
      manualOverlay.addEventListener('click', (event) => {
        if (event.target === manualOverlay) closeManual();
      });
    }
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && manualOverlay && manualOverlay.classList.contains('open')) closeManual();
    });
    window.addEventListener('hashchange', () => {
      if (location.hash === '#manual') openManual();
    });
    if (location.hash === '#manual') setTimeout(openManual, 0);

    updateRecordingControls();
    resetAnalysisState();
  