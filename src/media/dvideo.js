//dvide.js是一个继承了video标签的自定义video标签,拥有美化的外观,进度条,支持鼠标滑动调整音量,记录上一次音量大小,支持全屏播放
import {ContextMenu} from '/ContextMenu.js';
import { AccountManager } from '/AccountManager.js';
import { WebdavApi } from '/webdav/WebdavApi.js';
import { WebdavAdapter } from '/webdav/WebdavAdapter.js';
import { HTMLElementModal } from '/BaseModal.js';

export class DVideo extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._isDragging = false;
        this._progressBarWidth = 0;
        this._progressBarLeft = 0;
        this._volume = parseFloat(localStorage.getItem('dvideo-volume')) || 0.7;
        this._muted = localStorage.getItem('dvideo-muted') === 'true' || false;
        // 添加控制栏自动隐藏相关属性
        this._hideControlsTimeout = null;
        this._controlsHidden = false;
        this._hideControlsDelay = 3000; // 3秒无操作后隐藏控制栏
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
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                video {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    background-color: #000;
                }
                
                /* 加载提示样式 */
                .loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: rgba(0, 0, 0, 0.7);
                    padding: 20px 40px;
                    border-radius: 8px;
                    font-size: 18px;
                    color: #fff;
                    z-index: 1000;
                }
                
                /* 错误提示样式 */
                .error {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: rgba(255, 0, 0, 0.7);
                    padding: 20px 40px;
                    border-radius: 8px;
                    font-size: 18px;
                    color: #fff;
                    z-index: 1000;
                    display: none;
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
                    opacity: 1;
                }

                .controls.hidden {
                    opacity: 0;
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

                .controls-center {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 20px;
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

                .file-name {
                    color: #fff;
                    font-size: 12px;
                    font-family: Arial, sans-serif;
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .fullscreen-btn {
                    font-size: 18px;
                }
                
                /* 暂停图标样式 */
                .pause-icon {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: none;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    padding: 15px;
                    z-index: 999;
                    pointer-events: none;
                }
                
                .pause-icon svg {
                    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.5));
                }
                
                .pause-icon.visible {
                    display: block;
                }
            </style>

            <div class="video-container">
                <context-menu id="video-context-menu"></context-menu>
                <video preload="auto" id="video-element"></video>
                <!-- 加载提示 -->
                <div class="loading">正在加载视频...</div>
                
                <!-- 错误提示 -->
                <div class="error">视频加载失败，请稍后重试</div>
                <!-- 暂停图标 -->
                <div class="pause-icon" id="pause-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="4" width="4" height="16"/>
                        <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                </div>
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
                        <div class="controls-center">
                            <span class="file-name" id="file-name"></span>
                        </div>
                        <div class="controls-right">
                            <div class="volume-container">
                                <button class="control-btn" id="volume-btn">🔊</button>
                                <div class="volume-bar-container" id="volume-bar-container">
                                    <div class="volume-bar" id="volume-bar"></div>
                                </div>
                            </div>
                            <button class="control-btn fullscreen-btn" id="fullscreen-btn">⛶</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 获取DOM元素
        this._container = this.shadowRoot.querySelector('.video-container');
        this._videoElement = this.shadowRoot.querySelector('video');
        this._controls = this.shadowRoot.querySelector('.controls');
        this._progressContainer = this.shadowRoot.getElementById('progress-container');
        this._progressBar = this.shadowRoot.getElementById('progress-bar');
        this._progressHandle = this.shadowRoot.getElementById('progress-handle');
        this._playPauseBtn = this.shadowRoot.querySelectorAll('#play-pause-btn');
        this._currentTimeDisplay = this.shadowRoot.getElementById('current-time');
        this._durationDisplay = this.shadowRoot.getElementById('duration');
        this._fileNameDisplay = this.shadowRoot.getElementById('file-name');
        this._volumeBtn = this.shadowRoot.querySelectorAll('#volume-btn');
        this._volumeBarContainer = this.shadowRoot.getElementById('volume-bar-container');
        this._volumeBar = this.shadowRoot.getElementById('volume-bar');

        // 绑定事件
        this._bindEvents();

        // 初始化音量和静音状态
        this._videoElement.volume = this._volume;
        this._videoElement.muted = this._muted;
        this._updateVolumeBar();
        this._updateVolumeIcon();
    }
    async _closeVideo(){
         // 彻底关闭并释放视频资源
        const videoElement = this.shadowRoot.querySelector('#video-element');
        
        // 1. 暂停视频播放
        videoElement.pause();
        
        // 2. 清除视频源
        if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => {
                track.stop();
            });
            videoElement.srcObject = null;
        }
        
        // 3. 清空src属性并触发load事件以释放资源
        videoElement.src = '';
        videoElement.load();
        
        // 4. 短暂延迟确保资源释放
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 5. 从DOM中移除视频元素
        videoElement.remove();
    }
    _bindEvents() {
        const videoContextMenu = this.shadowRoot.getElementById('video-context-menu');
        if (videoContextMenu) {
            videoContextMenu.items = {
                '播放/暂停' : () => {
                    this._togglePlayPause();
                },
                '全屏' : () => {
                    this._toggleFullscreen();
                },
                '静音/取消静音' : () => {
                    this._toggleMute();
                },
            };
            const browser = document.querySelector('sidebar-browers');
            if (browser && AccountManager.isInitialized()) {
                AccountManager.get_profile().then((profile) => {
                    if (profile.role.includes('Admin')) {
                        videoContextMenu.items['删除'] = async () => {
                            console.log(`删除视频: ${this.getAttribute('src')}`);
                            
                            await this._closeVideo();
                            try {
                                await WebdavApi.deleteFile(this.getAttribute('src'));
                                console.log('视频删除成功');
                            } catch (error) {
                                console.error('视频删除失败:', error);
                            }

                            this.dispatchEvent(new CustomEvent('close'));

                            document.dispatchEvent(new CustomEvent('WebdavFlush'));
                        };
                        videoContextMenu.items['属性'] = async () => {
                            const items = await WebdavApi.getItems(this.getAttribute('src'));
                            if(items.length === 0){
                                console.error('获取视频属性失败: 视频不存在');
                                return;
                            }
                            const propertyElement = await WebdavAdapter.getProperty(items[0]);
                            HTMLElementModal.open({
                                html: propertyElement,
                                width: '80%',
                                height: '90vh',
                            });
                        };
                    }
                    console.log(profile);
                });
            }
        }
        
        // 监听视频错误事件
        this._videoElement.addEventListener('error', () => {
            console.error('视频播放错误:', this._videoElement.error);
            this.hideLoading();
            
            // 处理不同类型的错误
            let errorMessage = '未知错误';
            if (this._videoElement.error) {
                switch (this._videoElement.error.code) {
                    case 1:
                        errorMessage = '用户中止了视频加载';
                        break;
                    case 2:
                        errorMessage = '网络错误';
                        break;
                    case 3:
                        errorMessage = '解码错误';
                        break;
                    case 4:
                        errorMessage = '视频格式不支持';
                        break;
                }
            }
            this.showError(`播放错误：${errorMessage}`);
        });
        
        // 监听视频加载开始事件
        this._videoElement.addEventListener('loadstart', () => {
            this.showLoading();
        });
        
        // 监听视频可以播放事件
        this._videoElement.addEventListener('canplay', () => {
            this.hideLoading();
            this.hideError();
        });
        // 视频事件
        this._videoElement.addEventListener('play', () => {
            this._playPauseBtn.forEach((btn) => {
                btn.textContent = '⏸';
            });
            // 隐藏暂停图标
            const pauseIcon = this.shadowRoot.getElementById('pause-icon');
            if (pauseIcon) {
                pauseIcon.classList.remove('visible');
            }
            this._resetHideControlsTimer();
        });

        this._videoElement.addEventListener('pause', () => {
            this._playPauseBtn.forEach((btn) => {
                btn.textContent = '▶';
            });
            // 显示暂停图标
            const pauseIcon = this.shadowRoot.getElementById('pause-icon');
            if (pauseIcon) {
                pauseIcon.classList.add('visible');
            }
            this._showControls(); // 暂停时始终显示控制栏
        });

        this._videoElement.addEventListener('timeupdate', () => {
            this._updateProgress();
        });

        this._videoElement.addEventListener('loadedmetadata', () => {
            this._updateVideoInfo();
        });

        this._videoElement.addEventListener('ended', () => {
            this._playPauseBtn.forEach((btn) => {
                btn.textContent = '▶';
            });
            // 视频结束时显示暂停图标
            const pauseIcon = this.shadowRoot.getElementById('pause-icon');
            if (pauseIcon) {
                pauseIcon.classList.add('visible');
            }
            this._showControls(); // 结束时显示控制栏
        });

        // 控制按钮事件
        this._playPauseBtn.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
                this._togglePlayPause();
            });
        });

        // 进度条事件
        this._progressContainer.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._startProgressDrag(e);
        });

        this._progressContainer.addEventListener('mousemove', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._onProgressDrag(e);
        });

        this._progressContainer.addEventListener('mouseup', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._stopProgressDrag();
        });

        this._progressContainer.addEventListener('mouseleave', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._stopProgressDrag();
        });

        // 用户操作检测事件（重置控制栏隐藏定时器）
        const container = this.shadowRoot.querySelector('.video-container');
        container.addEventListener('mousemove', (e) => {
            // 检查是否在控制区域内
                this._resetHideControlsTimer();
        });

        container.addEventListener('click', (e) => {
            // 检查是否在控制区域内
            const isControlArea = e.target.closest('.controls, .loading, .error, .pause-icon');
            if (!isControlArea) {
                this._resetHideControlsTimer();
                // 鼠标单击暂停/播放
                this._togglePlayPause();
            }
        });

        container.addEventListener('dblclick', (e) => {
            // 检查是否在控制区域内
            const isControlArea = e.target.closest('.controls, .loading, .error, .pause-icon');
            if (!isControlArea) {
                // 鼠标双击全屏
                this._toggleFullscreen();
            }
        });
        
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            // 检查是否在控制区域内
            const isControlArea = e.target.closest('.controls, .loading, .error, .pause-icon');
            if (!isControlArea) {
                //换算成当前容器的坐标
                const x = e.clientX - container.getBoundingClientRect().left;
                const y = e.clientY - container.getBoundingClientRect().top;
                container.querySelector('#video-context-menu').show(x, y);
            }
        });

        // 音量控制事件
        this._volumeBtn.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
                this._toggleMute();
            });
        });

        this._volumeBarContainer.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._startVolumeDrag(e);
        });

        this._volumeBarContainer.addEventListener('mousemove', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._onVolumeDrag(e);
        });

        this._volumeBarContainer.addEventListener('mouseup', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._stopVolumeDrag();
        });

        this._volumeBarContainer.addEventListener('mouseleave', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
            this._stopVolumeDrag();
        });

        // 鼠标滚轮调整音量
        this._videoElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._onWheelVolumeChange(e);
        });

        const fullscreenBtns = this.shadowRoot.querySelectorAll('#fullscreen-btn');
        // 全屏事件
        fullscreenBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到容器，避免与容器的单击事件冲突
                this._toggleFullscreen();
            });
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
            this._volumeBtn.forEach((btn) => {
                btn.textContent = '🔇';
            });
        } else if (this._videoElement.volume < 0.5) {
            this._volumeBtn.forEach((btn) => {
                btn.textContent = '🔉';
            });
        } else {
            this._volumeBtn.forEach((btn) => {
                btn.textContent = '🔊';
            }); 
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

    // 重置控制栏隐藏定时器
    _resetHideControlsTimer() {
        // 如果控制栏已隐藏，则显示它
        if (this._controlsHidden) {
            this._showControls();
        }
        
        // 清除现有的定时器
        if (this._hideControlsTimeout) {
            clearTimeout(this._hideControlsTimeout);
        }
        
        // 设置新的定时器
        this._hideControlsTimeout = setTimeout(() => {
            // 只有在视频播放时才隐藏控制栏
            if (!this._videoElement.paused) {
                this._hideControls();
            }
        }, this._hideControlsDelay);
    }

    // 显示控制栏
    _showControls() {
        const controls = this.shadowRoot.querySelector('.controls');
        controls.classList.remove('hidden');
        this._controlsHidden = false;
    }

    // 隐藏控制栏
    _hideControls() {
        const controls = this.shadowRoot.querySelector('.controls');
        controls.classList.add('hidden');
        this._controlsHidden = true;
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
    }

    // 鼠标滚轮调整音量
    _onWheelVolumeChange(e) {
        // 定义音量调整步长
        const volumeStep = 0.05;
        
        // 根据滚轮方向调整音量
        let newVolume;
        if (e.deltaY < 0) {
            // 向上滚动，增加音量
            newVolume = Math.min(1, this._volume + volumeStep);
        } else {
            // 向下滚动，减少音量
            newVolume = Math.max(0, this._volume - volumeStep);
        }
        
        // 设置新音量
        this.volume = newVolume;
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
    
    // 加载相关方法
    showLoading() {
        this.shadowRoot.querySelector('.loading').style.display = 'block';
    }
    
    hideLoading() {
        this.shadowRoot.querySelector('.loading').style.display = 'none';
    }
    
    // 错误相关方法
    showError(message = '视频加载失败，请稍后重试') {
        const errorEl = this.shadowRoot.querySelector('.error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
    
    hideError() {
        this.shadowRoot.querySelector('.error').style.display = 'none';
    }

    // 公开方法
    play() {
        return this._videoElement.play();
    }

    pause() {
        return this._videoElement.pause();
    }

    load() {
        this.showLoading();
        this._videoElement.load();
        this._updateVideoInfo();
    }

    connectedCallback() {
        this.src = this.getAttribute('src');//触发set src
        this._videoElement.type = this.getAttribute('type') || 'video/mp4';
        const autoPlay = this.getAttribute('autoplay') !== null;
        if (autoPlay) {
            this._videoElement.autoplay = true;
        }
    }
    // 属性访问器
    set src(value) {
        console.log('设置视频源:', value);
        this.showLoading();
        this.hideError();
        // 处理包含 # 符号的 URL
        let processedValue = decodeURIComponent(value);
        if (processedValue && processedValue.includes('#')) {
            // 替换 # 为 %23，确保它被视为 URL 路径的一部分而不是片段标识符
            processedValue = processedValue.replace(/#/g, '%23');
        }
        this._videoElement.src = processedValue;
        this._updateVideoInfo();
        this._updateFileName(value);
    }

    _updateFileName(url) {
        if (!url) {
            this._fileNameDisplay.textContent = '';
            return;
        }
        
        // 从URL中提取文件名
        try {
            // 解码URL
            const decodedUrl = decodeURIComponent(url);
            // 提取文件名
            const fileName = decodedUrl.split('/').pop();
            // 移除可能的查询参数
            const cleanFileName = fileName.split('?')[0].split('#')[0];
            this._fileNameDisplay.textContent = cleanFileName;
        } catch (error) {
            console.error('提取文件名失败:', error);
            this._fileNameDisplay.textContent = '';
        }
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
        localStorage.setItem('dvideo-muted', value.toString());
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

import {BaseModal} from '/BaseModal.js';

// 视频播放模态框
class VideoModal extends BaseModal {
    render() {
        super.render();
        // 获取宽高属性，如果没有则使用默认值
        const width = this.getAttribute('width') || (BaseModal.isMobile() ? '95%' : '80%');
        const height = this.getAttribute('height') || '90vh';
        const videoUrl = this.getAttribute('videoUrl') || '';
        const videoTitle = this.getAttribute('title') || undefined;
        const html = /*html*/`
            <style>
                .modal-content {
                    padding: 0px !important;
                    margin: 0px !important;
                    background-color: #000 !important;
                }
                .close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 30px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1001;
                    transition: all 0.3s ease;
                }
                .close:hover,
                .close:focus {
                    color: #fff;
                    background-color: rgba(0, 0, 0, 0.8);
                    transform: scale(1.1);
                    text-decoration: none;
                    cursor: pointer;
                }
                .form-group {
                    margin: 0 !important;
                    padding: 0 !important;
                    height: 100% !important;
                    display: flex;
                    flex-direction: column;
                }
                .video-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                video {
                    max-width: 100%;
                    max-height: 100%;
                    width: 100%;
                    height: 100%;
                    object-fit: contain; 
                }
                .video-title {
                    position: absolute;
                    top: 10px;
                    left: 15px;
                    color: #fff;
                    font-size: 18px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    padding: 5px 15px;
                    border-radius: 20px;
                    z-index: 1001;
                }
            </style>
            <div class="modal" id="modal">
                <div class="modal-content" style="width: ${width}; height: ${height}; max-width: none; max-height: none; overflow: hidden;">
                    ${videoTitle ? `<div class="video-title">${videoTitle}</div>` : ''}
                    <span class="close">&times;</span>
                    <div class="form-group">
                        <div class="video-container">
                            <d-video controls autoplay src="${videoUrl}" id="videoElement">
                                <source src="${videoUrl}" type="video/mp4">
                                您的浏览器不支持HTML5视频播放。
                            </d-video>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
        const videoElement = this.shadowRoot.querySelector('#videoElement');
        videoElement.addEventListener('close', () => {
            console.log('关闭视频元素');
            this.close();
        });
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const modal = this.shadowRoot.querySelector('.modal');
        const videoElement = this.shadowRoot.querySelector('video');

        // 尝试自动播放，如果失败则在用户交互时播放
        if (videoElement) {
            // 确保视频加载完成后尝试播放
            videoElement.addEventListener('loadedmetadata', () => {
                // 尝试播放，如果失败（可能是由于浏览器策略），则不做处理
                videoElement.play().catch(error => {
                    console.log('自动播放失败，需要用户交互:', error);
                });
            });
        }

        closeButton.addEventListener('click', () => {
            if (videoElement) {
                videoElement.pause();
            }
            this.close();
        });
        
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                if (videoElement) {
                    videoElement.pause();
                }
                this.close();
            }
        });
        
    }

    show() {
        super.show();
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    close() {
        super.close();
        document.body.style.overflow = 'auto'; // 恢复背景滚动
    }
}

customElements.define('video-modal', VideoModal);
export { VideoModal };