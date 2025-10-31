import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';



export class MasonryOtherItem extends MasonryBaseModal {
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


        // 移除多余的透明度代码，确保颜色更加饱和和区分明显
        ViewHTML.style.background = `linear-gradient(135deg, #${colorHex} 0%, #${colorHex2} 100%)`;
        //根据字符串计算颜色
        ViewHTML.innerHTML = /*html*/`
        <div class="item-icon" style="display: flex; justify-content: center; align-items: center; height: 70%; background: #linear-gradient(135deg, #333333 0%, #1a1a1a 100%); border-radius: 8px;">
            <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PDF file icon">
            <!-- 背景阴影 -->
            <defs>
                <linearGradient id="gFile" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stop-color="#ffffff"/>
                <stop offset="1" stop-color="#f2f2f2"/>
                </linearGradient>
                <linearGradient id="gFold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#fff6f6"/>
                <stop offset="1" stop-color="#ffdede"/>
                </linearGradient>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.12"/>
                </filter>
            </defs>

            <!-- 整体容器阴影 -->
            <g filter="url(#shadow)">
                <!-- 文件主体（圆角） -->
                <rect x="6" y="6" width="38" height="52" rx="4.5" ry="4.5" fill="url(#gFile)"/>

                <!-- 折角（右上） -->
                <path d="M44 6 H38 L44 12 V6 Z" fill="#fff" opacity="0.9"/>

                <!-- 折角阴影 / 轮廓（微妙） -->
                <path d="M38 6 L44 12 L44 12 L38 12 Z" fill="url(#gFold)" opacity="0.9"/>
            </g>

            <!-- 文件内线条（表示文本块）-->
            <g opacity="0.18" stroke="#000" stroke-linecap="round" stroke-width="1.4">
                <line x1="12" y1="18" x2="40" y2="18"/>
                <line x1="12" y1="24" x2="40" y2="24"/>
                <line x1="12" y1="30" x2="33" y2="30"/>
                <line x1="12" y1="36" x2="33" y2="36"/>
                <line x1="12" y1="42" x2="33" y2="42"/>
            </g>

            <!-- 右下角 PDF 红色徽章（带轻微圆角） -->
            <g transform="translate(28,34)">
                <rect x="0" y="0" width="24" height="18" rx="3" ry="3" fill="#E33D2D"/>
                <!-- 徽章小高光 -->
                <path d="M0 0 H24 V9 C18 9 12 9 0 9 Z" fill="#FF5A48" opacity="0.12"/>
                <!-- 文件扩展名文本 -->
                <text x="12" y="12.5" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="9.5" font-weight="700" fill="#fff" text-anchor="middle" alignment-baseline="middle">${fileExtension.toUpperCase()}</text>
            </g>

            <!-- 可选：细微外框（使图标在浅背景上更清晰）-->
            <rect x="6" y="6" width="38" height="52" rx="4.5" ry="4.5" fill="none" stroke="#000" opacity="0.03" />
            </svg>
        </div>
        <div style="text-align: center; padding: 5px 0; word-break: break-all; overflow: hidden; text-overflow: ellipsis; color: #ffffff; font-weight: bold;">${this.item.name}</div>
        
        `;
        return ViewHTML;
       
    }
}


MasonryView.register((item)=>{
    return new MasonryOtherItem(item);
});
