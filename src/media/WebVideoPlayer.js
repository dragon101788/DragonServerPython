import { WebdavAdapter } from '/webdav/WebdavAdapter.js';
import { WebdavApi } from '/webdav/WebdavApi.js';
import { AccountManager } from '/AccountManager.js';
import { CopyToClipboardDialog, ProgressModal } from '/BaseModal.js';
import { SidebarBrowers } from '/webdav/SidebarBrowers.js';
import { FFmpeg } from '/ffmpeg/FFmpeg.js';


function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 将秒数转换为小时:分钟:秒格式
function formatDuration(seconds) {
    // 确保输入是数字并转换为整数
    const totalSeconds = Math.floor(parseFloat(seconds));
    
    // 计算小时、分钟和秒
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    
    // 格式化输出，根据是否有小时来决定格式
    if (hours > 0) {
        // 小时:分钟:秒 格式，分钟和秒都保持两位数
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
        // 分钟:秒 格式，分钟和秒都保持两位数
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

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
    static async createPropertiesPage(item){
        const info = await FFmpeg.get_media_info(item.path);
        console.log(info);
        let ffmpeg_info_html = '';
        if (info.format && info.format.duration) {
            const duration = info.format.duration;
            const formattedDuration = formatDuration(duration);
            ffmpeg_info_html += `
                <div class="detail-row">
                    <span class="detail-label">视频时长:</span>
                    <span class="detail-value">${formattedDuration}</span>
                </div>
            `;
        }
        if (info.format && info.format.filename) {
            ffmpeg_info_html += `
                <div class="detail-row">
                    <span class="detail-label">文件名:</span>
                    <span class="detail-value">${info.format.filename}</span>
                </div>
            `;
        }
        if (info.format && info.format.format_name) {
            ffmpeg_info_html += `
                <div class="detail-row">
                    <span class="detail-label">格式:</span>
                    <span class="detail-value">${info.format.format_name}</span>
                </div>
            `;
        }
        if (info.format && info.format.size) {
            ffmpeg_info_html += `
                <div class="detail-row">
                    <span class="detail-label">文件大小:</span>
                    <span class="detail-value">${formatFileSize(info.format.size)}</span>
                </div>
            `;
        }
        if (info.format && info.format.nb_streams && info.streams) {
            for (let i = 0; i < info.format.nb_streams; i++) {
                const stream = info.streams[i];
                ffmpeg_info_html += `
                    <div class="detail-row">
                        <span class="detail-label">流${stream.index}:</span>
                        <span class="detail-value">${stream.codec_type} - ${stream.codec_name} - ${stream.codec_long_name}</span>
                    </div>
                `;
            }
        }
        const properties_page = document.createElement('div');
        properties_page.innerHTML = `
            <style>
                .file-details {
                    padding: 20px;
                }
                .detail-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .detail-label {
                    font-weight: bold;
                    width: 120px;
                }
                .detail-value {
                    flex: 1;
                }
            </style>
            <div class="file-details">
                <h2>${item.name}</h2>
                <div class="detail-row">
                    <span class="detail-label">路径:</span>
                    <span class="detail-value">${item.path}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">类型:</span>
                    <span class="detail-value">${item.contentType}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">大小:</span>
                    <span class="detail-value">${formatFileSize(item.size)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">${item.created}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">修改时间:</span>
                    <span class="detail-value">${item.modified}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">只读:</span>
                    <span class="detail-value">${item.readonly ? '是' : '否'}</span>
                </div>
                ${ffmpeg_info_html}
                <button id="transcode-btn" class="transcode-btn">加入转码</button>
                <button id="regenerate-thumb-btn" class="regenerate-thumb-btn">重新生成缩略图</button>
            </div>
        `;
        
        // 为转码按钮添加点击事件
        const transcodeBtn = properties_page.querySelector('.transcode-btn');
        transcodeBtn.addEventListener('click', () => {
            FFmpeg.transcodeFile(item.path);
        });

        // 为重新生成缩略图按钮添加点击事件
        const regenerateThumbBtn = properties_page.querySelector('.regenerate-thumb-btn');
        regenerateThumbBtn.addEventListener('click', () => {
            WebdavApi.deleteThumb(item.path);
        });

        return properties_page;
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
    if (item && (
            item.contentType.startsWith("video/") ||
            item.path.endsWith(".flv") ||
            item.path.endsWith(".rmvb") ||
            item.path.endsWith(".rm") 
        ) 
    ) {
        return () => {
            const MainDisplay = document.querySelector('.main-display-area');
            FFmpeg.transcodeFile(item.path);
            MainDisplay.openWebSite("/ffmpeg/index.html");
        }
    }
});

WebdavAdapter.registerProperty(async (item) => {
    if (item.contentType.startsWith("video/") ||
        item.path.endsWith(".flv") ||
        item.path.endsWith(".rmvb") ||
        item.path.endsWith(".rm") 
    ){
        return await WebVideoPlayer.createPropertiesPage(item);
    }else{
        return undefined;
    }
});