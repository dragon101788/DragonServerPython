import { WebdavAdapter } from '/webdav/WebdavAdapter.js';
import { AccountManager } from '/AccountManager.js';
import { WebdavApi } from '/webdav/WebdavApi.js';
import { CopyToClipboardDialog } from '/BaseModal.js';
import { cacheManager } from '/CacheManager.js';



export class MasonryView extends HTMLElement {
    static {
        
        MasonryView.imageCache = new Map(); // 用于缓存图片尺寸信息
        this.matchers = [];
        MasonryView.offset = '/';

    }
    static register(matchers){
        this.matchers.push(matchers);
    }
    static matchType(item){
        for (const matcher of this.matchers) {
            let adapter = matcher(item);
            if(adapter){
                return adapter;
            }
        }
        return undefined;
    }
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.allItems = {}; // 存储所有项目信息
        this.loadedItems = []; // 已加载的项目
        this.pageSize = 20; // 每页加载的项目数量
        this.currentPage = 0; // 当前页码
        this.loading = false; // 加载状态标记
        this.observer = null; // 用于检测滚动加载的IntersectionObserver
        this.columns = []; // 存储列元素引用
        this.columnHeights = []; // 存储列高度

        
    }

    async connectedCallback() {

        this.render();
        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }
        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            
            const browers = document.getElementById('sidebar-browers');
            const topStatusBarSelf = document.createElement('div');
            topStatusBarSelf.className = 'top-status-bar-self';
            topStatusBarSelf.innerHTML = /*html*/`
                <style>
                    .top-status-bar-self {
                        background-color: transparent;
                        float: right;
                        border: none;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                </style>
                    <button id="share-button" class="align-left">分享</button>
            `;
            topStatusBar.appendChild(topStatusBarSelf);
                
                

                const shareBtn = topStatusBarSelf.querySelector('#share-button');
                if (shareBtn) {
                    shareBtn.addEventListener('click', async () => {
                        // photoWall 分享当前路径
                        if (browers ) {
                            const protocol = window.location.protocol;
                            //获取当前域名
                            const host = window.location.host;
                            const token = await AccountManager.CreateShareToken(60*24*365);
                            const src = this.getAttribute('path');
                            //传递search参数
                            const searchParams = new URLSearchParams({
                                src: src,
                                token: token,
                            });
                            const url = protocol + "//" + host + "/MasonryExplorer/index.html?" + searchParams.toString();

                            console.log("分享按钮点击",url);
                            //打开新窗口
                            //window.open(url, '_blank');
                            CopyToClipboardDialog.open({
                                title: `分享链接`,
                                message: "",
                                text: `${url}`
                            });
                        }
                    });
                }
                
        }
        this.setupEventListeners();
        
        // 添加窗口大小变化监听
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }
    
    async disconnectedCallback() {
        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }
        
        // 断开observer连接，避免内存泄漏
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        // 移除窗口大小变化监听
        window.removeEventListener('resize', this.handleResize);
    }
    
    getBaseWidth(){
        const container = this.shadowRoot.getElementById('masonry-container');
        return container.clientWidth / this.columnCount;
    }

    
    getThumbnailSize(path){
        
        const baseWidth = this.getBaseWidth();
        let size = Math.ceil(baseWidth / 256) * 256
        if (size === 0) {
            size = 256;
        }else if (size > 768) {
            size = 768;
        }
        return size;
    }
    // 根据容器宽度自动计算列数
    calculateColumnCount() {
        const container = this.shadowRoot.getElementById('masonry-container') || this;
        const containerWidth = container.clientWidth || window.innerWidth;
        
        // 根据宽度设置不同的列数
        return Math.floor(containerWidth / 512);
    }
    async loadWebdavDir(path){
        // 重置状态
        const contents =  await WebdavApi.getDirectoryContents(path);

        const container = this.shadowRoot.getElementById('masonry-container');
        const columnCount = this.columnCount || this.calculateColumnCount();
        
        this.loadedItems = [];
        this.currentPage = 0;
        this.loading = false;
        this.columns = [];
        this.columnHeights = [];
        this.allItems = {};
        this.totalItems = contents.length;
        // 清空容器
        container.innerHTML = '';
        
        // 创建列容器
        this.columns = [];
        for (let i = 0; i < columnCount; i++) {
            const column = document.createElement('div');
            column.className = 'masonry-column';
            container.appendChild(column);
            this.columns.push(column);
        }
        await new Promise(resolve => {
            const waitForContainerWidth = () => {
                if (container.clientWidth > 0) {
                    resolve();
                } else {
                    requestAnimationFrame(waitForContainerWidth);
                }
            };
            waitForContainerWidth();
        });
        console.log(`container-width:${container.clientWidth}`);
        // 初始化列高度
        this.columnHeights = new Array(columnCount).fill(0);

        if (contents) {
            contents.forEach(item => {
                if (item.path === path ) {
                    item.currentPath = path;
                    item.type = 'goback'
                }
                const itemInstance = MasonryView.matchType(item);
                if(itemInstance){
                    itemInstance.item = item;
                    itemInstance.father = this;
                    this.allItems[itemInstance.item.path] = itemInstance;
                }
            });
            
            for (let [path, itemInstance] of Object.entries(this.allItems)) {
                console.log(`Adding ${Object.keys(this.allItems).length} items to layout`);
                //判断是否存在ViewHTML
                try {
                    await itemInstance.ViewHTML().then(itemHTML => {    
                        if(itemHTML){
                            let minHeightValue = Math.min(...this.columnHeights);
                            let columnIndex = this.columnHeights.indexOf(minHeightValue);

                            console.log(`Adding item ${itemInstance.path} to column ${columnIndex}`);
                            this.columns[columnIndex].appendChild(itemHTML);
                            // 更新列高度
                            this.columnHeights[columnIndex] += itemHTML.itemHeight + 10; // 加上间距
                            this.loadedItems = [...this.loadedItems, itemInstance];
                            this.updateImageCounter();
                        }
                    });
                } catch (error) {
                    console.error(`Error loading item ${path}:`, error);
                }
            };
        }
    }
    render() {
        
        this.columnCount = this.calculateColumnCount();

        // 先渲染基本框架
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --column-count: ${this.columnCount};
                }
                .Masonry-wall {
                    flex: 1;
                    box-sizing: border-box;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #8f5344ff 0%, #4d975dff 50%, #794e8dff 100%);
                }

                .masonry-container {
                    display: grid;
                    grid-template-columns: repeat(${this.columnCount}, 1fr);
                    grid-gap: 0px;
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                    padding: 0px;
                }

                .masonry-column {
                    display: flex;
                    flex-direction: column;
                    gap: 0px;
                }

                .masonry-item {
                    position: relative;
                    cursor: pointer;
                    transition: transform 0.2s;
                    overflow: hidden;
                    height: auto;
                }

                .masonry-item:hover {
                    transform: scale(1.0);
                    box-shadow: 0 3px 8px rgba(0,0,0,0.2);
                    z-index: 10;
                }


                .item-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover; /* 使用cover确保图片完全填充容器，不会有白边 */
                    transition: transform 0.3s;
                }
                

                .masonry-item:hover .item-image {
                    transform: scale(1.0);
                }

                .file-icon {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100%;
                    width: 100%;
                    background-color: #f8f9fa;
                }
                
                .item-name-float {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    text-align: center;
                    word-break: break-word;
                    padding: 4px 6px;
                    box-sizing: border-box;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    background-color: rgba(0,0,0,0.6);
                    color: white;
                    font-size: 12px;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .masonry-item:hover .item-name-float {
                    opacity: 1;
                }
                
                .item-name {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    text-align: center;
                    word-break: break-word;
                    padding: 4px 6px;
                    box-sizing: border-box;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    background-color: rgba(0,0,0,0.6);
                    color: white;
                    font-size: 12px;
                    opacity: 1;
                    transition: opacity 0.2s;
                }
                

                .empty-state {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 50px;
                    color: #666;
                }
                
                .loading-indicator {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 20px;
                    color: #666;
                }
                
                .image-counter {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    z-index: 100;
                }
                
                
            </style>
            <div class="Masonry-wall">
                <div class="masonry-container" id="masonry-container">
                    ${this.allItems.size === 0 ? '<div class="empty-state">没有找到文件</div>' : ''}
                </div>
                <div class="image-counter" id="image-counter">已加载: 0 / ${Object.keys(this.allItems).length}</div>
            </div>
        `;
        
    }

    
    // 更新项目计数器
    updateImageCounter() {
        const counter = this.shadowRoot.getElementById('image-counter');
        if (counter) {
            counter.textContent = `已加载: ${this.loadedItems.length} / ${Object.keys(this.allItems).length}`;
        }
    }
    
    
    
  
    

    // 处理窗口大小变化
    handleResize() {
        const newColumnCount = this.calculateColumnCount();
        if (newColumnCount !== this.columnCount) {
            this.columnCount = newColumnCount;
            this.shadowRoot.host.style.setProperty('--column-count', this.columnCount);
            this.render();
            this.flush();
        }
    }
    // 获取当前项目在数组中的索引
    getCurrentIndex() {
        const paths = Object.keys(this.allItems);
        return paths.indexOf(this.currentModal.item.path);
    };
    
    // 加载上一张图片
    loadPrevItem() {
        const paths = Object.keys(this.allItems);
        const currentIndex = this.getCurrentIndex();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : paths.length - 1; // 循环到最后一项
        const item = this.allItems[paths[prevIndex]];
        this.currentModal.doClose();
        if (item) {
            this.currentModal = item;
            item.doPlay();
        }else{
            this.currentModal = null;
        }
    };

    // 加载下一张图片
    loadNextItem() {
        const paths = Object.keys(this.allItems);
        const currentIndex = this.getCurrentIndex();
        const nextIndex = currentIndex < paths.length - 1 ? currentIndex + 1 : 0; // 循环到第一项
        const item = this.allItems[paths[nextIndex]];
        this.currentModal.doClose();
        if (item) {
            this.currentModal = item;
            item.doPlay();
        }else{
            this.currentModal = null;
        }
    };
    setupEventListeners() {
        const container = this.shadowRoot.getElementById('masonry-container');
        if (!container) return;

        
        
        
        // 点击图片或视频打开查看器
        container.addEventListener('click', (e) => {
            const masonryItem = e.target.closest('.masonry-item');
            if (masonryItem) {
                const path = masonryItem.dataset.path;
                
                if (path) {
                    const item = this.allItems[path];
                    
                    this.currentModal = item;
                    item.doPlay();
                    
                    
                    // 隐藏文档滚动
                    document.body.style.overflow = 'hidden';
                }
            }
        });
        
        // 右键菜单
        container.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            const masonryItem = e.target.closest('.masonry-item');
            if (masonryItem) {
                const path = masonryItem.dataset.path;
                if (path) {
                    const item = this.allItems[path];
                    if (item) {
                        await item.doContextMenu(e.clientX, e.clientY);
                    }
                }
            }
        });

        this.flush();
    }
    async flush(){
        const path = this.getAttribute('path');
        if (path) {
            await this.loadWebdavDir(path);
        }
    }
}

customElements.define('masonry-view', MasonryView);
WebdavAdapter.register((item) => {
    if (item.type === "directory") {
        const view = new MasonryView();
        view.setAttribute('path', item.path);
        return view;
    } else {
        return undefined;
    }
});
