import { WebdavAdapter } from '/webdav/WebdavAdapter.js';

export class WebImagePlayer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentZoom = 1.0; // 初始缩放比例
        this.isFullscreen = false; // 全屏状态标记
        // 绑定事件处理函数的this上下文
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }
    static is_supported_format(item){
        if (item.contentType === "image/png" ||
            item.contentType === "image/jpeg" ||
            item.contentType === "image/gif" ||
            item.contentType === "image/bmp" ||
            item.contentType === "image/webp" ||
            item.contentType === "image/svg+xml" ||
            item.contentType === "image/x-icon" ||
            item.contentType === "image/tiff" ||
            item.contentType === "image/x-tiff" 
        ) {
            return true;
        }else{
            return false;
        }
    }
    async connectedCallback() {

        await this.render();
        // 设置tabIndex使元素可聚焦（移到focus()之前）
        this.tabIndex = 0;
        // 使用requestAnimationFrame确保DOM更新后再聚焦
        requestAnimationFrame(() => {
            this.focus();
            console.log('WebImagePlayer focused automatically');
        });
        console.log('WebImagePlayer::connectedCallback');
        // 添加键盘事件监听
        this.addEventListener('keydown', this.handleKeyDown);
        // 设置tabindex使元素可聚焦以接收键盘事件
        this.tabIndex = 0;
    }

    disconnectedCallback() {
        // 移除事件监听
        console.log('WebImagePlayer::disconnectedCallback');
        this.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown(event) {
        // 检查shift+上/下箭头组合键
        if (event.shiftKey) {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.previousImage();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.nextImage();
            }
        }
    }

    // 上一曲方法，功能留空
    async previousImage() {
        // 这里添加实际的上一曲逻辑
        const browers = document.getElementById('sidebar-browers'); // 修复拼写错误
        if (browers) {
            const path =  await this.getAttribute("path");
            await browers.OpenPrevFile(path)
        }
    }

    // 下一曲方法，功能留空
    async nextImage() {
        // 这里添加实际的下一曲逻辑
        const browers = document.getElementById('sidebar-browers');
        if (browers) {
            const path = await this.getAttribute("path");
            await browers.OpenNextFile(path)
        }
    }
    // 缩放功能实现
    zoomIn() {
        this.currentZoom += 0.1;
        this.updateImageTransform();
    }

    zoomOut() {
        if (this.currentZoom > 0.2) { // 最小缩放到20%
            this.currentZoom -= 0.1;
            this.updateImageTransform();
        }
    }

    resetZoom() {
        this.currentZoom = 1.0;
        this.updateImageTransform();
    }

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        const container = this.shadowRoot.querySelector('.image-container');
        const image = this.shadowRoot.querySelector('.image-viewer');

        if (this.isFullscreen) {
            // 进入全屏模式 - 图片缩放至填满容器
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100vw';
            container.style.height = '100vh';
            container.style.zIndex = '9999';
            container.style.overflow = 'hidden'; // 隐藏超出容器的部分
            
            // 关键修改：使用cover模式缩放至填满容器，保持比例
            image.style.objectFit = 'cover'; 
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.transform = 'none'; // 清除之前的缩放变换
        } else {
            // 退出全屏模式 - 恢复原始状态
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.zIndex = '';
            container.style.overflow = '';
            
            // 恢复原始缩放和适应方式
            image.style.objectFit = 'contain';
            image.style.width = '';
            image.style.height = '';
            this.resetZoom(); // 恢复默认缩放比例
        }
    }

    updateImageTransform() {
        const image = this.shadowRoot.querySelector('.image-viewer');
        if (image) {
            image.style.transform = `scale(${this.currentZoom})`;
        }
    }

    async render() {
        const path = this.getAttribute('path');
        try {
            const browers = document.getElementById('sidebar-browers');
            const response = await browers.fetchFile(path)
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            this.shadowRoot.innerHTML = `
                <style>
                    .image-container {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        overflow: auto;
                        position: relative;
                    }
                    .image-viewer {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                        transition: transform 0.2s ease;
                    }
                    .nav-button {
                        position: absolute;
                        top: 50%;
                        transform: translateY(-50%);
                        background-color: rgba(0, 0, 0, 0.5);
                        color: white;
                        border: none;
                        padding: 10px;
                        cursor: pointer;
                        font-size: 20px;
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        z-index: 10;
                    }
                    .prev-button {
                        left: 20px;
                    }
                    .next-button {
                        right: 20px;
                    }
                    .zoom-controls {
                        position: absolute;
                        bottom: 20px;
                        display: flex;
                        gap: 10px;
                        z-index: 10;
                    }
                    .zoom-button {
                        background-color: rgba(0, 0, 0, 0.5);
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        cursor: pointer;
                        border-radius: 4px;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 40px;
                        height: 40px;
                    }
                </style>
                <div class="image-container">
                    <button class="nav-button prev-button" onclick="this.getRootNode().host.previousImage()">❮</button>
                    <img class="image-viewer" src="${url}">
                    <button class="nav-button next-button" onclick="this.getRootNode().host.nextImage()">❯</button>
                    <div class="zoom-controls">
                        <button class="zoom-button" onclick="this.getRootNode().host.zoomOut()">−</button>
                        <button class="zoom-button" onclick="this.getRootNode().host.resetZoom()">⟲</button>
                        <button class="zoom-button" onclick="this.getRootNode().host.zoomIn()">+</button>
                        <button class="zoom-button" onclick="this.getRootNode().host.toggleFullscreen()">⛶</button>
                    </div>
                </div>
            `;
        } catch (error) {
            this.shadowRoot.innerHTML = `
                <div class="image-container">
                    <p>图片加载失败</p>
                </div>
            `;
        }
    }
}

customElements.define('web-image-player', WebImagePlayer);
WebdavAdapter.register((item)=>{
    if (
        item.contentType === "image/png" ||
        item.contentType === "image/jpeg" ||
        item.contentType === "image/gif" ||
        item.contentType === "image/bmp" ||
        item.contentType === "image/webp" ||
        item.contentType === "image/svg+xml" ||
        item.contentType === "image/x-icon" ||
        item.contentType === "image/tiff" ||
        item.contentType === "image/x-tiff" 
    ) {
        const webview = new WebImagePlayer();
        webview.setAttribute('path', item.path);
        return webview;
    } else {
        return undefined;
    }
});