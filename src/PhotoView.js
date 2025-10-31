
/**
 * 幻灯片组件 - 继承自HTMLElement
 * 功能：
 * 1. 每秒自动切换图片
 * 2. 后台缓存加载图片
 * 3. 响应式设计
 * 4. 支持自定义样式 
 * 5. 显示模式
 * contain 自适应：图片会等比例缩放，保持原始比例，可能会有部分区域被裁剪
 * cover 铺满：图片会拉伸以铺满容器，可能会改变原始比例
 * fill 填充：图片会拉伸以填充容器，可能会改变原始比例
 * 
 * 使用方法：
 * <photo-view duration="1000" path="/D/test" display-mode="contain"></photo-view>
 */
class PhotoView extends HTMLElement {
    // 定义私有常量
    #TRANSITION_DURATION = 300; // 过渡动画持续时间(毫秒)
    
    constructor() {
        super();
        // 创建影子DOM
        this.attachShadow({ mode: 'open' });
        
        // 组件状态
        this.currentIndex = 0;
        this.imageList = [];
        this.timer = null;
        this.isLoading = false;
        this.duration = 1000; // 默认1秒切换一次
        this.token = '';
        this.path = '/';
        this.imageCache = new Map(); // 图片缓存，使用Map存储
        this.displayMode = 'cover'; // 默认显示模式: cover(铺满)
        this.boundHandleKeyDown = null; // 保存绑定后的事件处理函数引用
        this.showindex = true; // 是否显示索引
        this.showFilename = true; // 是否显示文件名
    }
    
    
    // 组件连接到DOM时触发
    async connectedCallback() {
        // 初始化样式和HTML结构
        this.render();
        
        // 从属性中获取初始值
        this.duration = parseInt(this.getAttribute('duration')) || 1000;
        this.token = this.getAttribute('token') || undefined;
        let path = this.getAttribute('path') || '/';
        this.displayMode = this.getAttribute('display-mode') || 'cover'; // 从属性获取显示模式
        
        // 添加事件监听器
        this.addEventListeners();
        
        if(path) {
            await this.loadImages(path);
        }
    }
    
    // 添加事件监听器
    addEventListeners() {
        // 保存绑定后的事件处理函数引用，以便后续正确解绑
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }
    
    // 设置显示模式
    setDisplayMode(mode) {
        const validModes = ['contain', 'cover', 'fill', 'scale-down'];
        if (!validModes.includes(mode)) {
            console.error('无效的显示模式:', mode);
            return;
        }
        
        this.displayMode = mode;
        
        const imgElement = this.shadowRoot.querySelector('.photo-viewer-image');
        if (imgElement) {
            imgElement.style.objectFit = mode;
        }
        
        
        console.log('显示模式已更改为:', mode);
    }
    
    // 处理键盘事件
    handleKeyDown(event) {
        // 只在组件聚焦或文档活跃时响应
        if (document.activeElement === document.body) {
            switch (event.key) {
                case 'ArrowLeft':
                    this.prevImage();
                    event.preventDefault();
                    break;
                case 'ArrowRight':
                    this.nextImage();
                    event.preventDefault();
                    break;
            }
        }
    }
    
    // 加载图片列表
    async loadImages(path) {
        if ( this.isLoading) return;
        
        this.path = path;
        this.isLoading = true;
        this.imageList = [];
        this.stopSlideshow();
        try {
            // 构建API URL
            let apiUrl = '/api/list_files';
            if (path) {
                apiUrl += '/' + encodeURIComponent(path);
            }
            
            // 调用API
            await fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP错误! 状态码: ${response.status}`);
                    }
                    return response.json();
                })
                .then(file_list => {
                    file_list.forEach(file => {
                        if ( file.contentType && file.contentType.startsWith('image/')) {
                            this.imageList.push({
                                path: file.path,
                                contentType: file.contentType
                            });
                        }
                    })
                })

            
            if (this.imageList.length > 0) {
                this.currentIndex = 0;
                this.showImage(this.imageList[this.currentIndex]);
                this.updateIndexDisplay();
                if(this.imageList.length > 1)
                    this.startSlideshow();
            }
        } catch (error) {
            console.error('加载图片失败:', error);
        } finally {
            this.isLoading = false;
        }
    }
    
    // 显示图片
    showImage(image) {
        const currentImg = this.shadowRoot.querySelector('.photo-viewer-current-image');
        const nextImg = this.shadowRoot.querySelector('.photo-viewer-next-image');
        
        if (currentImg && nextImg) {
            
            // 检查缓存中是否已有该图片
            const cacheKey = image.path;
            if (this.imageCache.has(cacheKey)) {
                // 使用缓存的图片
                const cachedData = this.imageCache.get(cacheKey);
                this.performTransition(cachedData.url, image.path);
                console.log('使用缓存的图片:', image.path);
                return;
            }
            
            // 使用fetchFile方法获取图片
            fetch(image.path).then(response => {
                if (response.ok) {
                    return response.blob();
                }
                throw new Error('图片请求失败');
            }).then(blob => {
                // 创建临时URL
                const imageUrl = URL.createObjectURL(blob);
                
                // 存储到缓存
                this.imageCache.set(cacheKey, {
                    url: imageUrl,
                    blob: blob,
                    timestamp: Date.now()
                });
                
                // 创建临时图片进行预加载
                const tempImg = new Image();
                tempImg.onload = () => {
                    tempImg.style.objectFit = this.displayMode;
                    this.performTransition(imageUrl, image.name);
                };
                tempImg.onerror = () => {
                    console.error('图片加载失败:', image.name);
                    // 从缓存中删除加载失败的图片
                    this.imageCache.delete(cacheKey);
                    URL.revokeObjectURL(imageUrl);
                };
                
                tempImg.src = imageUrl;
            }).catch(error => {
                console.error('加载图片时发生错误:', error);
            });
        }
    }
    // 执行渐变过渡效果
    performTransition(imageUrl, imageName) {
        const currentImg = this.shadowRoot.querySelector('.photo-viewer-current-image');
        const nextImg = this.shadowRoot.querySelector('.photo-viewer-next-image');

        if (!currentImg || !nextImg) return;

        nextImg.src = imageUrl;
        nextImg.alt = imageName;
        nextImg.style.objectFit = this.displayMode;
        nextImg.style.opacity = '0';
        nextImg.style.zIndex = '2';
        currentImg.style.zIndex = '1';

        requestAnimationFrame(() => {
            currentImg.style.opacity = '0';
            nextImg.style.opacity = '1';

            // 使用私有常量控制过渡时间
            setTimeout(() => {
                currentImg.classList.remove('photo-viewer-current-image');
                currentImg.classList.add('photo-viewer-next-image');
                nextImg.classList.remove('photo-viewer-next-image');
                nextImg.classList.add('photo-viewer-current-image');
            }, this.#TRANSITION_DURATION);
        });
    }

    
    // 开始幻灯片播放
    startSlideshow() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.timer = setInterval(() => {
            this.nextImage();
        }, this.duration);
        
        // 更新容器class，移除暂停状态
        const container = this.shadowRoot.querySelector('.photo-viewer-container');
        if (container) {
            container.classList.remove('paused');
        }
    }
    
    // 停止幻灯片播放
    stopSlideshow() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // 更新容器class，添加暂停状态
        const container = this.shadowRoot.querySelector('.photo-viewer-container');
        if (container) {
            container.classList.add('paused');
        }
    }
    
    // 上一张图片
    prevImage() {
        if (this.imageList.length === 0) return;
        
        this.stopSlideshow();
        this.currentIndex = (this.currentIndex - 1 + this.imageList.length) % this.imageList.length;
        this.showImage(this.imageList[this.currentIndex]);
        this.updateIndexDisplay();
        this.startSlideshow();
    }
    
    // 下一张图片
    nextImage() {
        if (this.imageList.length === 0) return;
        
        this.currentIndex = (this.currentIndex + 1) % this.imageList.length;
        this.showImage(this.imageList[this.currentIndex]);
        this.updateIndexDisplay();
    }
    
    // 更新索引显示
    updateIndexDisplay() {
        const indexElement = this.shadowRoot.querySelector('.photo-viewer-index');
        if (indexElement) {
            indexElement.textContent = `${this.currentIndex + 1}/${this.imageList.length}`;
        }
        
        // 更新文件名显示
        this.updateFilenameDisplay();
    }
    
    // 更新文件名显示
    updateFilenameDisplay() {
        const filenameElement = this.shadowRoot.querySelector('.photo-viewer-filename');
        if (filenameElement && this.imageList.length > 0 && this.currentIndex >= 0) {
            const currentImage = this.imageList[this.currentIndex];
            filenameElement.textContent = currentImage.name;
        }
    }
    
    
    // 组件断开连接时触发
    disconnectedCallback() {
        this.stopSlideshow();
        // 清理事件监听器
        if (this.boundHandleKeyDown) {
            document.removeEventListener('keydown', this.boundHandleKeyDown);
        }
        
        // 清理缓存中的URL对象
        this.imageCache.forEach(cacheData => {
            URL.revokeObjectURL(cacheData.url);
        });
        this.imageCache.clear();
    }
    
    // 渲染组件
    render() {
        const style = /*css*/`
            .photo-viewer-container {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background-color: #000;
                cursor: default;
            }
            /* 让组件能够响应外部设置的尺寸 */
            :host {
                display: block;
                box-sizing: border-box;
            }
            
            .photo-viewer-current-image,
            .photo-viewer-next-image {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                transition: opacity ${this.#TRANSITION_DURATION}ms ease;
            }
            
            .photo-viewer-current-image {
                opacity: 1;
                z-index: 1;
            }
            
            .photo-viewer-next-image {
                opacity: 0;
                z-index: 0;
            }
            
            .photo-viewer-index {
                position: absolute;
                bottom: 10px;
                right: 10px;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 9;
            }
            
            .photo-viewer-filename {
                position: absolute;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 9;
                max-width: 70%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        `;
        
        const html = /*html*/`
            <div class="photo-viewer-container">
                <img class="photo-viewer-current-image" src="" alt="当前图片" style="object-fit: ${this.displayMode};">
                <img class="photo-viewer-next-image" src="" alt="下一张图片" style="object-fit: ${this.displayMode};">
                ${this.showindex === true ? '<div class="photo-viewer-index">0/0</div>' : ''}
                ${this.showFilename === true ? '<div class="photo-viewer-filename"></div>' : ''}
            </div>
        `;
        
        this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
    }
}

// 定义自定义元素
customElements.define('photo-view', PhotoView);
