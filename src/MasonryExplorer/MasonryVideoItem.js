import { MasonryView } from '/MasonryExplorer/MasonryView.js';
import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';

export class MasonryVideoItem extends MasonryBaseModal {
    constructor() {
        super();
    }
    
    // 生成视频项HTML
    async ViewHTML(){
        // 创建图片项
        const ViewHTML = document.createElement('div');
        ViewHTML.className = `masonry-item`;
        ViewHTML.dataset.path = this.item.path;
        ViewHTML.dataset.type = this.item.type;
        
        ViewHTML.innerHTML = /*html*/`
            <style>
                 /* 视频指示器样式 */
                .video-indicator {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    opacity: 0;
                    transition: opacity 0.2s;
                    pointer-events: none;
                    z-index: 5;
                }
                
                .video-item:hover .video-indicator {
                    opacity: 1;
                }
                
                .video-indicator svg {
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                }
            </style>
            <img class="item-image" src="${this.father.getThumbnailUrl(this.item.path)}" alt="${this.item.name}">
            <div class="video-indicator">
                <svg viewBox="0 0 24 24" width="40" height="40">
                    <circle cx="12" cy="12" r="11" fill="rgba(0, 0, 0, 0.6)"/>
                    <path d="M8 5v14l11-7z" fill="white"/>
                </svg>
            </div>
            <div class="item-name-float">${this.item.name}</div>
        `;
        ViewHTML.classList.add('video-item');
        await new Promise((resolve) => {
            ViewHTML.querySelectorAll('.item-image').forEach((img) => {
                img.onload = () => {
                    ViewHTML.itemHeight = this.father.getBaseWidth() * ( img.height / img.width );
                    ViewHTML.style.height = `${ViewHTML.itemHeight}px`;
                    resolve();
                };
            });
        });
        return ViewHTML;
    }
    doClose(){        
        // 清理视频资源
        const viewModal = document.querySelector('.view-modal');
        const videoElement = viewModal?.querySelector('video');
        if (videoElement) {
            videoElement.pause();
            videoElement.src = '';
            videoElement.remove();
        }
        if (viewModal) {
            viewModal.style.display = 'none';
            viewModal.remove();
        }
    }
    
    setupEventListeners(){        
        const viewModal = document.querySelector('.view-modal');
        const videoElement = document.querySelector('.modal-media');
        const loadingIndicator = viewModal.querySelector('.loading-indicator');
        const closeBtn = viewModal.querySelector('.close-btn');
        const prevBtn = viewModal.querySelector('.prev-btn');
        const nextBtn = viewModal.querySelector('.next-btn');
        const modalCounter = viewModal.querySelector('#modal-counter');
        const viewModalContent = viewModal.querySelector('.view-modal-content');
        
        // 点击查看器空白处关闭
        viewModal.addEventListener('click', (e) => {
            if (e.target === viewModal || e.target === viewModal.querySelector('.view-modal-content')) {
                this.doClose();
            }
        });
        
        // 点击关闭按钮关闭
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.doClose();
        });
        
        // 点击上一张按钮
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.loadPrev();
        });
        
        // 点击下一张按钮
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.loadNext();
        });

        // 鼠标滚轮切换图片
        const handleWheel = (e) => {
            e.preventDefault(); // 阻止页面滚动
            
            // 根据滚轮方向切换图片
            if (e.deltaY < 0) {
                // 向上滚动，显示上一张
                this.loadPrev();
            } else {
                // 向下滚动，显示下一张
                this.loadNext();
            }
        };
        
        // 在查看器内容区域添加滚轮事件监听
        viewModalContent.addEventListener('wheel', handleWheel, { passive: false });

        // 阻止视频点击事件冒泡
        videoElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // 阻止视频被拖拽
        videoElement.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
        
        // 为视频元素也添加滚轮事件监听
        videoElement.addEventListener('wheel', handleWheel, { passive: false });
        
        // 按键盘箭头键和ESC键控制
        const handleKeydown = (e) => {
            switch (e.key) {
                case 'Escape':
                    this.doClose();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.loadPrev();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.loadNext();
                    break;
            }
        };
        
        // 添加键盘事件监听
        document.addEventListener('keydown', handleKeydown);
    }
    doPlay(){        
        const modal = document.createElement('div');
        modal.id = 'view-modal';
        modal.innerHTML = /*html*/`
        <style>
            ${MasonryBaseModal.css}
            .modal-media {
                max-width: 80%;
                max-height: 90vh;
                object-fit: contain;
                cursor: default;
            }
        </style>
        <div class="view-modal">
            <div class="view-modal-content">
                <button class="nav-btn prev-btn">&lt;</button>
                <button class="close-btn">&times;</button>
                <div class="loading-indicator">加载中...</div>
                <video class="modal-media" controls>
                    <source src="${MasonryView.getFileUrl(this.item.path)}" type="video/mp4">
                    您的浏览器不支持视频播放。
                </video>
                <button class="nav-btn next-btn">&gt;</button>
                <div class="image-counter" id="modal-counter">${this.getCurrentIndex()}/${this.getCounter()}</div>
            </div>
        </div>
        `
        
        document.body.appendChild(modal);
        const video = modal.querySelector('video');
        const loadingIndicator = modal.querySelector('.loading-indicator');
        
        // 视频加载完成处理
        video.onloadeddata = () => {
            loadingIndicator.style.display = 'none';
            video.style.display = 'block';
            video.play().catch(err => {
                console.warn('自动播放失败，需要用户交互:', err);
            });
        };
        
        // 视频加载失败处理
        video.onerror = () => {
            loadingIndicator.textContent = '视频加载失败';
        };
        
        // 设置事件监听器
        this.setupEventListeners();
    }
}

MasonryView.register((item)=>{
    if (
        item.contentType.startsWith("video/") 
        //|| item.path.endsWith(".flv")
        //|| item.path.endsWith(".rmvb") 
        //||item.path.endsWith(".rm") 
    ){
        return new MasonryVideoItem(item);
    }else{
        return undefined;
    }
});
