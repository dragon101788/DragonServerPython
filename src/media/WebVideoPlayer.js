import { WebdavAdapter } from '/webdav/WebdavAdapter.js';
import { AccountManager } from '/AccountManager.js';
import { CopyToClipboardDialog, ProgressModal } from '/BaseModal.js';
import { SidebarBrowers } from '/webdav/SidebarBrowers.js';
import { FFmpeg } from '/ffmpeg/FFmpeg.js';

export class WebVideoPlayer extends HTMLElement {
    static get observedAttributes() {
        return ['src', 'token', 'path'];
    }
    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // 使用iframe实现完整的HTML文档环境，支持脚本执行
        this.shadowRoot.innerHTML = /*html*/`
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    position: relative;
                }
                #html-frame {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .loading-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(255, 255, 255, 0.8);
                    z-index: 10;
                }
                .loading {
                    color: #666;
                    font-size: 14px;
                }
                .error {
                    color: #ff0000;
                    font-size: 14px;
                }

            </style>
            <div class="loading-container">
                <div class="loading">加载中...</div>
            </div>

            <iframe id="html-frame"></iframe>
        `;

        this.iframe = this.shadowRoot.getElementById('html-frame');
        this.loadingContainer = this.shadowRoot.querySelector('.loading-container');
        this.loadingMessage = this.shadowRoot.querySelector('.loading');
        

        this.iframe.addEventListener('error', () => {
            this.handleVideoError();
        });
    }

    
    // 处理视频错误，显示ffmpeg-control组件
    async handleVideoError() {
        try {
            this.loadingMessage.textContent = '视频播放错误，尝试使用FFmpeg转换...';
            this.loadingMessage.className = 'loading';
            this.loadingContainer.style.display = 'flex';
            
            const path = this.getAttribute("path") || this.getAttribute("src");
            if (!path) {
                throw new Error('无法获取视频路径');
            }
            
            
        } catch (error) {
            console.error('处理视频错误失败:', error);
            this.shadowRoot.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background-color: #f5f5f5;">
                    <div style="color: #ff0000; font-size: 14px;">视频处理失败: ${error.message}</div>
                </div>
            `;
        }
    }

    async connectedCallback() {
        
        await this.loadHtmlContent();
        
        // 添加键盘快捷键支持
        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.handleKeyDown);

        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }

        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            const topStatusBarSelf = document.createElement('div');
            topStatusBarSelf.className = 'top-status-bar-self';
            topStatusBarSelf.innerHTML = /*html*/`
                <style>
                    .top-status-bar-self {
                        background-color: transparent;
                        float: right;
                        border: none;
                        cursor: pointer;
                    }
                    button {
                        float: right;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                </style>
                <button id="share-btn" class="share-btn">分享</button>
                <button id="download-btn" class="download-btn">下载</button>
                <button id="ffmpeg-btn" class="ffmpeg-btn">转码</button>
            `
            topStatusBar.appendChild(topStatusBarSelf);
            const shareBtn = topStatusBarSelf.querySelector('.share-btn');
            const downloadBtn = topStatusBarSelf.querySelector('.download-btn');
            const ffmpegBtn = topStatusBarSelf.querySelector('.ffmpeg-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', async () => {
                    const protocol = window.location.protocol;
                    //获取当前域名
                    const host = window.location.host;
                    const token = await AccountManager.getToken();
                    const src = this.getAttribute('src');
                    //传递search参数
                    const searchParams = new URLSearchParams({
                        src: src,
                        token: token,
                    });
                    const url = "/media/index.html?" + searchParams.toString();

                    console.log("分享按钮点击",url);
                    //打开新窗口
                    window.open(url, '_blank');
                });
            }
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    const browers = document.getElementById('sidebar-browers');
                    const path = this.getAttribute("path") || this.getAttribute("src");
                    console.log("保存按钮点击");
                    const downloadProgressModal = ProgressModal.open({title: '下载中2...'}); 
                    // 保存HTML内容
                    browers.webdavApi.downloadFile(path, (progress) => {
                        if (progress >= 99) {
                            //下载完成后，隐藏进度条
                            setTimeout(() => {
                                downloadProgressModal.close();
                            }, 500); // 显示完成状态一会儿再隐藏
                        } else {
                            // 更新下载进度条
                            downloadProgressModal.updateProgress(progress);
                        }
                    });
                });
            }
            if (ffmpegBtn) {
                ffmpegBtn.addEventListener('click', () => {
                    const path = this.getAttribute("path") || this.getAttribute("src");
                    if (!path) {
                        throw new Error('无法获取视频路径');
                    }
                    this.iframe.src = "/ffmpeg/index.html";

                    // 等待FFmpeg控件加载完成,并添加任务addTask(path)
                    const handleIframeLoad = () => {
                        try {
                            // 向iframe发送消息，调用addTask函数
                            this.iframe.contentWindow.postMessage({
                                action: 'currentFile',
                                path: path
                            }, '*');
                        } catch (error) {
                            console.error('向FFmpeg控件发送消息失败:', error);
                        } finally {
                            // 移除事件监听器，避免重复调用
                            this.iframe.removeEventListener('load', handleIframeLoad);
                        }
                    };
                    
                    // 添加iframe加载完成事件监听器
                    this.iframe.addEventListener('load', handleIframeLoad);
                });
            }

        }
    }
    async disconnectedCallback() {
        // 移除键盘事件监听器
        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }

    }
    
    // 上一曲方法，功能留空
    async previousVideo() {
        // 这里添加实际的上一曲逻辑
        const browers = document.getElementById('sidebar-browers');
        if (browers) {
            const path =  await this.getAttribute("path");
            await browers.OpenPrevFile(path)
        }
    }

    // 下一曲方法，功能留空
    async nextVideo() {
        // 这里添加实际的下一曲逻辑
        const browers = document.getElementById('sidebar-browers');
        if (browers) {
            const path = await this.getAttribute("path");
            await browers.OpenNextFile(path)
        }
    }
    // 处理键盘事件
    handleKeyDown(event) {
        // 防止在输入框中触发快捷键
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const browers = document.getElementById('sidebar-browers');
        if (!browers) {
            return;
        }
        
        
        // 处理上一曲和下一曲
        if (event.key === 'ArrowUp') {
            // 上一曲
            this.previousVideo();
        } else if (event.key === 'ArrowDown') {
            // 下一曲
            this.nextVideo();
        }
    }
    
    // 导航到指定视频
    navigateToVideo(videoPath) {
        // 设置新的视频路径
        this.setAttribute('src', videoPath);
        this.setAttribute('path', videoPath);
        
        // 加载新视频
        this.loadHtmlContent();
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.loadHtmlContent();
        }
    }

  
    async loadHtmlContent() {
        const src = this.getAttribute('src');
        
        // 如果没有设置path属性，将src作为path
        if (!this.hasAttribute('path')) {
            this.setAttribute('path', src);
        }

        // 显示加载状态
        this.loadingContainer.style.display = 'flex';
        this.loadingMessage.textContent = '加载中...';
        this.loadingMessage.className = 'loading';

        const token = await AccountManager.getToken();
        //传递search参数
        const searchParams = new URLSearchParams({
            src: src,
            token: token,
        });
        this.url = "/media/index.html?" + searchParams.toString();

        
        // 通过URL加载完整网页
        this.iframe.src = this.url;

        this.loadingContainer.style.display = 'none';
    }
    
}

customElements.define('web-video-player', WebVideoPlayer);
WebdavAdapter.register((item) => {
        if (item.contentType.startsWith("video/") ||
            item.path.endsWith(".flv") ||
            item.path.endsWith(".rmvb") ||
            item.path.endsWith(".rm") 
        ){
            const videoPlayer = new WebVideoPlayer();
            videoPlayer.setAttribute('src', item.path);
            videoPlayer.setAttribute('path', item.path);
            return videoPlayer;
        }else{
            return undefined;
        }
});


SidebarBrowers.registerExternalContextMenu('视频转码', (item) => {
    if (typeof item === 'object'  && item.contentType.startsWith("video/") ||
            item.path.endsWith(".flv") ||
            item.path.endsWith(".rmvb") ||
            item.path.endsWith(".rm") ) {
        return () => {
            const MainDisplay = document.querySelector('.main-display-area');
            FFmpeg.transcodeFile(item.path);
            MainDisplay.openWebSite("/ffmpeg/index.html");
        }
    }
});