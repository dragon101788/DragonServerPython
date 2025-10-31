import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';

export class MasonryDrawIOItem extends MasonryBaseModal {
    async ViewHTML(){
         // 创建其他文件项
        const ViewHTML = document.createElement('div');
        ViewHTML.className = 'masonry-item item-drawio';
        ViewHTML.dataset.path = this.item.path;
        ViewHTML.dataset.type = 'drawio';
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
            <line x1="32" y1="12" x2="32" y2="20" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
            <line x1="32" y1="44" x2="32" y2="52" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="32" x2="20" y2="32" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
            <line x1="44" y1="32" x2="52" y2="32" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>

            <!-- 节点：开始/结束 -->
            <rect x="26" y="6" width="12" height="8" rx="4" ry="4" fill="#3B82F6"/>
            <rect x="26" y="50" width="12" height="8" rx="4" ry="4" fill="#10B981"/>

            <!-- 节点：输入输出 -->
            <rect x="8" y="26" width="12" height="12" rx="2" ry="2" fill="#F59E0B"/>

            <!-- 节点：处理 -->
            <rect x="44" y="26" width="12" height="12" rx="2" ry="2" fill="#F472B6"/>

            <!-- 菱形判断节点 -->
            <polygon points="32,22 44,32 32,42 20,32" fill="#60A5FA"/>

            <!-- 小标题 -->
            <text x="32" y="62" font-size="8" text-anchor="middle" fill="#6B7280" font-family="sans-serif">${fileExtension.toUpperCase()}</text>
            </svg>


        </div>
        <div style="text-align: center; padding: 5px 0; word-break: break-all; overflow: hidden; text-overflow: ellipsis; color: #ffffff; font-weight: bold;">${this.item.name}</div>
        `;
        return ViewHTML;
    }
}

MasonryView.register((item)=>{
    if (
        item.path.endsWith(".drawio") 
        || item.path.endsWith(".DRAWIO")
    ){
        return new MasonryDrawIOItem(item);
    }else{
        return undefined;
    }
});