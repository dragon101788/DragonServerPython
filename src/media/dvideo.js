//dvide.js是一个继承了video标签的自定义video标签,拥有美化的外观,进度条,支持鼠标滑动调整音量,记录上一次音量大小,支持全屏播放

class DVideo extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._isDragging = false;
        this._progressBarWidth = 0;
        this._progressBarLeft = 0;
        this._volume = parseFloat(localStorage.getItem('dvideo-volume')) || 0.7;
        this._muted = false;
        this._init();
    }

    _init() {
        // 创建组件结构
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .video-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                video {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    background-color: #000;
                }

                .controls {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
                    padding: 20px 10px 10px;
                    box-sizing: border-box;
                    transition: opacity 0.3s;
                    opacity: 0;
                }

                .video-container:hover .controls {
                    opacity: 1;
                }

                .progress-container {
                    position: relative;
                    width: 100%;
                    height: 5px;
                    background-color: rgba(255, 255, 255, 0.3);
                    border-radius: 3px;
                    margin-bottom: 10px;
                    cursor: pointer;
                }

                .progress-bar {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background-color: #ff6b6b;
                    border-radius: 3px;
                    width: 0;
                }

                .progress-handle {
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 12px;
                    height: 12px;
                    background-color: #fff;
                    border-radius: 50%;
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .progress-container:hover .progress-handle {
                    opacity: 1;
                }

                .controls-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .controls-left {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .controls-right {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .control-btn {
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .control-btn:hover {
                    color: #ff6b6b;
                }

                .time-display {
                    color: #fff;
                    font-size: 12px;
                    font-family: Arial, sans-serif;
                }

                .volume-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .volume-bar-container {
                    width: 80px;
                    height: 3px;
                    background-color: rgba(255, 255, 255, 0.3);
                    border-radius: 2px;
                    cursor: pointer;
                }

                .volume-bar {
                    height: 100%;
                    background-color: #fff;
                    border-radius: 2px;
                    width: 70%;
                }

                .volume-handle {
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 8px;
                    height: 8px;
                    background-color: #fff;
                    border-radius: 50%;
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .volume-container:hover .volume-handle {
                    opacity: 1;
                }

                .fullscreen-btn {
                    font-size: 18px;
                }
            </style>

            <div class="video-container">
                <video preload="auto"></video>
                <div class="controls">
                    <div class="progress-container" id="progress-container">
                        <div class="progress-bar" id="progress-bar"></div>
                        <div class="progress-handle" id="progress-handle"></div>
                    </div>
                    <div class="controls-row">
                        <div class="controls-left">
                            <button class="control-btn" id="play-pause-btn">▶</button>
                            <span class="time-display" id="current-time">00:00</span>
                            <span class="time-display">/</span>
                            <span class="time-display" id="duration">00:00</span>
                        </div>
                        <div class="controls-right">
                            <div class="volume-container">
                                <button class="control-btn" id="volume-btn">🔊</button>
                                <div class="volume-bar-container" id="volume-bar-container">
                                    <div class="volume-bar" id="volume-bar"></div>
                                    <div class="volume-handle" id="volume-handle"></div>
                                </div>
                            </div>
                            <button class="control-btn fullscreen-btn" id="fullscreen-btn">⛶</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 获取DOM元素
        this._videoElement = this.shadowRoot.querySelector('video');
        this._controls = this.shadowRoot.querySelector('.controls');
        this._progressContainer = this.shadowRoot.getElementById('progress-container');
        this._progressBar = this.shadowRoot.getElementById('progress-bar');
        this._progressHandle = this.shadowRoot.getElementById('progress-handle');
        this._playPauseBtn = this.shadowRoot.getElementById('play-pause-btn');
        this._currentTimeDisplay = this.shadowRoot.getElementById('current-time');
        this._durationDisplay = this.shadowRoot.getElementById('duration');
        this._volumeBtn = this.shadowRoot.getElementById('volume-btn');
        this._volumeBarContainer = this.shadowRoot.getElementById('volume-bar-container');
        this._volumeBar = this.shadowRoot.getElementById('volume-bar');
        this._volumeHandle = this.shadowRoot.getElementById('volume-handle');
        this._fullscreenBtn = this.shadowRoot.getElementById('fullscreen-btn');

        // 绑定事件
        this._bindEvents();

        // 初始化音量
        this._videoElement.volume = this._volume;
        this._updateVolumeBar();
        this._updateVolumeIcon();
    }

    _bindEvents() {
        // 视频事件
        this._videoElement.addEventListener('play', () => {
            this._playPauseBtn.textContent = '⏸';
        });

        this._videoElement.addEventListener('pause', () => {
            this._playPauseBtn.textContent = '▶';
        });

        this._videoElement.addEventListener('timeupdate', () => {
            this._updateProgress();
        });

        this._videoElement.addEventListener('loadedmetadata', () => {
            this._updateVideoInfo();
        });

        this._videoElement.addEventListener('ended', () => {
            this._playPauseBtn.textContent = '▶';
        });

        // 控制按钮事件
        this._playPauseBtn.addEventListener('click', () => {
            this._togglePlayPause();
        });

        // 进度条事件
        this._progressContainer.addEventListener('mousedown', (e) => {
            this._startProgressDrag(e);
        });

        this._progressContainer.addEventListener('mousemove', (e) => {
            this._onProgressDrag(e);
        });

        this._progressContainer.addEventListener('mouseup', () => {
            this._stopProgressDrag();
        });

        this._progressContainer.addEventListener('mouseleave', () => {
            this._stopProgressDrag();
        });

        // 音量控制事件
        this._volumeBtn.addEventListener('click', () => {
            this._toggleMute();
        });

        this._volumeBarContainer.addEventListener('mousedown', (e) => {
            this._startVolumeDrag(e);
        });

        this._volumeBarContainer.addEventListener('mousemove', (e) => {
            this._onVolumeDrag(e);
        });

        this._volumeBarContainer.addEventListener('mouseup', () => {
            this._stopVolumeDrag();
        });

        this._volumeBarContainer.addEventListener('mouseleave', () => {
            this._stopVolumeDrag();
        });

        // 全屏事件
        this._fullscreenBtn.addEventListener('click', () => {
            this._toggleFullscreen();
        });

        // 监听全屏变化
        document.addEventListener('fullscreenchange', () => {
            this._updateFullscreenIcon();
        });

        document.addEventListener('webkitfullscreenchange', () => {
            this._updateFullscreenIcon();
        });

        document.addEventListener('mozfullscreenchange', () => {
            this._updateFullscreenIcon();
        });

        document.addEventListener('msfullscreenchange', () => {
            this._updateFullscreenIcon();
        });
    }

    _togglePlayPause() {
        if (this._videoElement.paused || this._videoElement.ended) {
            this._videoElement.play();
        } else {
            this._videoElement.pause();
        }
    }

    _updateProgress() {
        if (isNaN(this._videoElement.duration)) return;

        const progress = (this._videoElement.currentTime / this._videoElement.duration) * 100;
        this._progressBar.style.width = `${progress}%`;
        this._progressHandle.style.left = `${progress}%`;

        this._currentTimeDisplay.textContent = this._formatTime(this._videoElement.currentTime);
    }

    _updateVideoInfo() {
        this._durationDisplay.textContent = this._formatTime(this._videoElement.duration);
    }

    _formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    _startProgressDrag(e) {
        this._isDragging = true;
        this._updateProgressFromEvent(e);
    }

    _onProgressDrag(e) {
        if (this._isDragging) {
            this._updateProgressFromEvent(e);
        }
    }

    _stopProgressDrag() {
        this._isDragging = false;
    }

    _updateProgressFromEvent(e) {
        const rect = this._progressContainer.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
        const time = (percentage / 100) * this._videoElement.duration;
        this._videoElement.currentTime = time;
        this._updateProgress();
    }

    _toggleMute() {
        this._videoElement.muted = !this._videoElement.muted;
        this._muted = this._videoElement.muted;
        this._updateVolumeIcon();
    }

    _updateVolumeIcon() {
        if (this._videoElement.muted || this._videoElement.volume === 0) {
            this._volumeBtn.textContent = '🔇';
        } else if (this._videoElement.volume < 0.5) {
            this._volumeBtn.textContent = '🔉';
        } else {
            this._volumeBtn.textContent = '🔊';
        }
    }

    _startVolumeDrag(e) {
        this._isVolumeDragging = true;
        this._updateVolumeFromEvent(e);
    }

    _onVolumeDrag(e) {
        if (this._isVolumeDragging) {
            this._updateVolumeFromEvent(e);
        }
    }

    _stopVolumeDrag() {
        this._isVolumeDragging = false;
    }

    _updateVolumeFromEvent(e) {
        const rect = this._volumeBarContainer.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
        const volume = percentage / 100;
        this.volume = volume;
    }

    _updateVolumeBar() {
        const percentage = this._volume * 100;
        this._volumeBar.style.width = `${percentage}%`;
        this._volumeHandle.style.left = `${percentage}%`;
    }

    _toggleFullscreen() {
        const container = this.shadowRoot.querySelector('.video-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    _updateFullscreenIcon() {
        if (document.fullscreenElement) {
            this._fullscreenBtn.textContent = '⛶';
        } else {
            this._fullscreenBtn.textContent = '⛶';
        }
    }

    // 公开方法
    play() {
        return this._videoElement.play();
    }

    pause() {
        return this._videoElement.pause();
    }

    load() {
        this._videoElement.load();
        this._updateVideoInfo();
    }

    // 属性访问器
    set src(value) {
        this._videoElement.src = value;
        this._updateVideoInfo();
    }

    get src() {
        return this._videoElement.src;
    }

    set currentTime(value) {
        this._videoElement.currentTime = value;
        this._updateProgress();
    }

    get currentTime() {
        return this._videoElement.currentTime;
    }

    get duration() {
        return this._videoElement.duration;
    }

    set volume(value) {
        this._videoElement.volume = value;
        this._volume = value;
        this._updateVolumeBar();
        localStorage.setItem('dvideo-volume', value.toString());
        this._updateVolumeIcon();
    }

    get volume() {
        return this._videoElement.volume;
    }

    set muted(value) {
        this._videoElement.muted = value;
        this._muted = value;
        this._updateVolumeIcon();
    }

    get muted() {
        return this._videoElement.muted;
    }

    set preload(value) {
        this._videoElement.preload = value;
    }

    get preload() {
        return this._videoElement.preload;
    }
}

// 注册自定义元素
if (!customElements.get('d-video')) {
    customElements.define('d-video', DVideo);
}

// 导出组件供其他模块使用
export { DVideo };