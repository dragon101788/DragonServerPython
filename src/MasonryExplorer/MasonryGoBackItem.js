import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';
import { getParentDir } from '/webdav/WebdavApi.js';

export class MasonryGoBackItem extends MasonryBaseModal {
    constructor() {
        super();
    }
    async ViewHTML(){
        // 创建目录项
        const ViewHTML = document.createElement('div');
        ViewHTML.className = 'masonry-item item-goback';
        ViewHTML.dataset.path = this.item.path;
        ViewHTML.dataset.type = 'goback';
        
        // 设置固定高度
        ViewHTML.itemHeight = this.father.getBaseWidth() * 0.5;
        ViewHTML.style.height = `${ViewHTML.itemHeight}px`;
        
        ViewHTML.style.color = '#333333'; // 文字颜色保持深色以适应浅色背景
        
        // 创建返回箭头图标 - 简洁现代的返回功能指示
        const dirSvg = `
            <svg width="64" height="64" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <!-- 返回箭头 -->
            <path d="M19 12H5" stroke="#4a5568" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M12 19l-7-7 7-7" stroke="#4a5568" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        ViewHTML.innerHTML = `
            <div class="item-icon" style="display: flex; justify-content: center; align-items: center; height: 100%;">
                ${dirSvg}
            </div>

        `;
        
        return ViewHTML;
    }
    doPlay(){
        document.dispatchEvent(new CustomEvent('WebdavChdir', {
            detail: {
                item: this.item,
                path: this.item.path,
            }
        }));
    }
    doClose(){ }
}


MasonryView.register((item)=>{
    if (item.type === 'goback'){
        const normalizePath = (p) => p.replace(/^\/+|\/+$/g, '');
        if (normalizePath(item.currentPath) === normalizePath(MasonryView.offset)) {
            return;
        }
        const parentDir = getParentDir(item.currentPath);
        item.path = parentDir;
        item.name = "返回上级目录";
        item.contentType = 'directory';
        item.type = 'directory';
        return new MasonryGoBackItem(item);
    }
    else{
        return undefined;
    }
});
