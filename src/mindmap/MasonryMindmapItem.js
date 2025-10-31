import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';

export class MasonryMindmapItem extends MasonryBaseModal {
    async ViewHTML(){
         // 创建其他文件项
        const ViewHTML = document.createElement('div');
        ViewHTML.className = 'masonry-item item-mindmap';
        ViewHTML.dataset.path = this.item.path;
        ViewHTML.dataset.type = 'mindmap';
        // 设置固定高度
        ViewHTML.itemHeight = this.father.getBaseWidth() * 0.8;
        ViewHTML.style.height = `${ViewHTML.itemHeight}px`;

        
        // 获取文件扩展名
        const fileExtension = this.item.name.split('.').pop()?.toLowerCase() || '';
        ViewHTML.innerHTML = /*html*/`
        <div class="item-icon" style="display: flex; justify-content: center; align-items: center; height: 70%; ">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <!-- 背景 -->
            <rect width="64" height="64" rx="12" ry="12" fill="#F9FAFB"/>

            <!-- 连线 -->
            <path d="M32 32 L50 18" stroke="#60A5FA" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M32 32 L14 18" stroke="#F472B6" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M32 32 L50 46" stroke="#34D399" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M32 32 L14 46" stroke="#FBBF24" stroke-width="3" fill="none" stroke-linecap="round"/>

            <!-- 节点 -->
            <circle cx="32" cy="32" r="8" fill="#3B82F6"/>
            <circle cx="50" cy="18" r="5" fill="#60A5FA"/>
            <circle cx="14" cy="18" r="5" fill="#F472B6"/>
            <circle cx="50" cy="46" r="5" fill="#34D399"/>
            <circle cx="14" cy="46" r="5" fill="#FBBF24"/>

            <!-- 小标题 -->
            <text x="32" y="60" font-size="8" text-anchor="middle" fill="#6B7280" font-family="sans-serif">${fileExtension.toUpperCase()}</text>
            </svg>


        </div>
        <div style="text-align: center; padding: 5px 0; word-break: break-all; overflow: hidden; text-overflow: ellipsis; color: #ffffff; font-weight: bold;">${this.item.name}</div>
        `;
        return ViewHTML;
    }
}

MasonryView.register((item)=>{
    if (
        item.path.endsWith(".smm") 
        || item.path.endsWith(".SMM")
    ){
        return new MasonryMindmapItem(item);
    }else{
        return undefined;
    }
});