import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';
import { cacheManager } from '/CacheManager.js';

export class MasonryDirectoryItem extends MasonryBaseModal {
    constructor() {
        super();
    }
    static checkType(item) {
        if (item.type === 'directory') {
            return true;
        }
        return false;
    }
    async ViewHTML() {
        const ViewHTML = document.createElement('div');
        ViewHTML.className = `masonry-item`;
        ViewHTML.dataset.path = this.item.path;
        ViewHTML.dataset.type = 'directory';

        try {
            const img = await this.father.getThumbnail(this.item.path);
            ViewHTML.innerHTML = `
                <div style="padding: 2px; background: linear-gradient(135deg, #4CAF50, #2196F3, #9C27B0); margin-bottom: 5px; display: inline-block;">
                    <img class="item-image" src="${img}" alt="${this.item.name}">
                </div>
                <div class="item-name-float">${this.item.name}</div>
            `;
            ViewHTML.classList.add('image-item');
    
            ViewHTML.itemHeight = img.height * 0.8;
            ViewHTML.style.height = `${ViewHTML.itemHeight}px`;
        }catch(error){
            ViewHTML.innerHTML = `
                <div class="item-icon" style="display: flex; justify-content: center; align-items: center; height: 70%;">
                    <svg width="64" height="64" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <!-- 文件夹主体 -->
                        <path d="M3 7h18a1 1 0 0 1 1 1v10.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5V8a1 1 0 0 1 1-1z" 
                                fill="#F3C13A" />
                        <!-- 顶盖 -->
                        <path d="M3 6.5L5.5 4h4.5a1.5 1.5 0 0 1 1.1.5L12.5 6h8a1.5 1.5 0 0 1 1.5 1.5V8H3V6.5z" 
                                fill="#FFD85A"/>
                        <!-- 阴影层 -->
                        <path d="M3 8h18v.8H3z" fill="#E2B23A" opacity="0.7"/>
                    </svg>
                </div>
                <div style="text-align: center; padding: 5px 0; word-break: break-all; overflow: hidden; text-overflow: ellipsis; color: #faf8f8ff; font-weight: bold;">${this.item.name}</div>
            `;
            ViewHTML.itemHeight = this.father.getBaseWidth() * 0.8;
            ViewHTML.style.height = `${ViewHTML.itemHeight}px`;
        }

        return ViewHTML;
    }
    doPlay() {
        document.dispatchEvent(new CustomEvent('WebdavChdir', {
            detail: {
                item: this.item,
                path: this.item.path,
            }
        }));
    }
    doClose() { }
}


MasonryView.register((item) => {
    if (item.type === 'directory') {
        return new MasonryDirectoryItem(item);
    } else {
        return undefined;
    }
});
