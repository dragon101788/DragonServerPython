import { MasonryView } from '/MasonryExplorer/MasonryView.js';
import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';

export class MasonryImageItem extends MasonryBaseModal {
    constructor() {
        super();
    }
   

    async ViewHTML(){

        // 创建图片项
        const ViewHTML = document.createElement('div');
        ViewHTML.className = `masonry-item`;
        ViewHTML.dataset.path = this.item.path;
        ViewHTML.dataset.type = this.item.type;

        
        ViewHTML.innerHTML = `
            <img class="item-image" src="${await this.father.getThumbnail(this.item.path)}" alt="${this.item.name}">
            <div class="item-name-float">${this.item.name}</div>
        `;
        ViewHTML.classList.add('image-item');
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
    setupEventListeners(){
        const viewModal = document.querySelector('.view-modal');
        const modalImage = document.querySelector('#modal-image');
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

         // 阻止图片点击事件冒泡
        modalImage.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // 阻止图片被拖拽
        modalImage.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
        
        // 为图片元素也添加滚轮事件监听，确保在图片上滚动也能切换
        modalImage.addEventListener('wheel', handleWheel, { passive: false });
        
        // 图片加载完成处理
        modalImage.onload = () => {
            loadingIndicator.style.display = 'none';
        };
        
        // 图片加载失败处理
        modalImage.onerror = () => {
            loadingIndicator.textContent = '加载失败';
        };

        
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
        
        // 在查看器内容区域添加键盘事件监听
        document.addEventListener('keydown', handleKeydown);
    }
    doClose(){
        const viewModal = document.querySelector('.view-modal');
        viewModal.style.display = 'none';
        viewModal.remove();
    }
    doPlay(){
        const modal = document.createElement('div');
        modal.id = 'view-modal';
        modal.innerHTML = /*html*/`
        <style>
            ${MasonryBaseModal.css}
        </style>
        <div class="view-modal">
            <div class="view-modal-content">
                <button class="nav-btn prev-btn">&lt;</button>
                <button class="close-btn">&times;</button>
                <div class="loading-indicator">加载中...</div>
                <img id="modal-image" src="${MasonryView.getFileUrl(this.item.path)}" alt="查看图片">
                <button class="nav-btn next-btn">&gt;</button>
                <div class="image-counter" id="modal-counter">${this.getCurrentIndex()}/${this.getCounter()}</div>
            </div>
        </div>
        `
        document.body.appendChild(modal);
        this.setupEventListeners();
    }
}

MasonryView.register((item)=>{
    if (item.contentType.startsWith('image')){
        return new MasonryImageItem(item);
    }else{
        return undefined;
    }
});