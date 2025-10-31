import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';

export class MasonryPackageItem extends MasonryBaseModal {
    constructor() {
        super();
    }
    async ViewHTML(){
        // 创建其他文件项
        const ViewHTML = document.createElement('div');
        ViewHTML.className = 'masonry-item item-image';
        ViewHTML.dataset.path = this.item.path;
        ViewHTML.dataset.type = 'other';
        // 设置固定高度
        ViewHTML.itemHeight = this.father.getBaseWidth() * 0.8;
        ViewHTML.style.height = `${ViewHTML.itemHeight}px`;
        ViewHTML.style.color = '#ecf0f1';   
        
        // 获取文件扩展名
        const fileExtension = this.item.name.split('.').pop()?.toLowerCase() || '';
        // 主颜色
        const colorHex = MasonryBaseModal.strToHex(fileExtension);
        const colorHex2 = MasonryBaseModal.darkenColor(colorHex, 30);    

        // 压缩包SVG图标
        ViewHTML.style.background = `linear-gradient(135deg, #${colorHex} 0%, #${colorHex2} 100%)`;
        ViewHTML.innerHTML = /*html*/`
        <div class="item-icon" style="display: flex; justify-content: center; align-items: center; height: 70%; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%); border-radius: 8px;">
            <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Archive file icon">
            <!-- 背景阴影 -->
            <defs>
                <linearGradient id="archiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="100%" stop-color="#e0e0e0" />
                </linearGradient>
                <filter id="archiveShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
                </filter>
            </defs>
            
            <!-- 整体容器阴影 -->
            <g filter="url(#archiveShadow)">
                <!-- 压缩包主体 -->
                <rect x="12" y="14" width="40" height="36" rx="4" ry="4" fill="url(#archiveGradient)"/>
                
                <!-- 压缩包顶部拉链 -->
                <rect x="12" y="14" width="40" height="5" rx="2" ry="2" fill="#333"/>
                
                <!-- 拉链齿 -->
                <g fill="#666">
                    <circle cx="18" cy="16.5" r="1"/>
                    <circle cx="24" cy="16.5" r="1"/>
                    <circle cx="30" cy="16.5" r="1"/>
                    <circle cx="36" cy="16.5" r="1"/>
                    <circle cx="42" cy="16.5" r="1"/>
                    <circle cx="48" cy="16.5" r="1"/>
                </g>
                
                <!-- 压缩包上的文件夹图标 -->
                <g transform="translate(22, 22)">
                    <!-- 文件夹底座 -->
                    <rect x="0" y="6" width="20" height="16" rx="2" ry="2" fill="#4a6fa5"/>
                    <!-- 文件夹盖子 -->
                    <path d="M0 6 L0 0 Q0 -2 2 0 L20 0 Q22 -2 22 0 L22 6 Z" fill="#5b7aa6"/>
                    <!-- 文件夹内部文件线 -->
                    <line x1="4" y1="10" x2="18" y2="10" stroke="white" stroke-width="1.5" opacity="0.5"/>
                    <line x1="4" y1="14" x2="14" y2="14" stroke="white" stroke-width="1.5" opacity="0.5"/>
                </g>
            </g>
            
            <!-- 右下角扩展名标签 -->
            <g transform="translate(32, 46)">
                <rect x="0" y="0" width="20" height="12" rx="2" ry="2" fill="#333"/>
                <text x="10" y="7.5" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="7" font-weight="700" fill="#fff" text-anchor="middle" alignment-baseline="middle">${fileExtension.toUpperCase()}</text>
            </g>
            </svg>
        </div>
        <div style="text-align: center; padding: 5px 0; word-break: break-all; overflow: hidden; text-overflow: ellipsis; color: #ffffff; font-weight: bold;">${this.item.name}</div>
        `;
        return ViewHTML;
       
    }
}

MasonryView.register((item)=>{
    
    if (item.path.endsWith('.zip') || item.path.endsWith('.rar') || item.path.endsWith('.7z')){
        return new MasonryPackageItem(item);
    }
    return undefined;
});
