import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';

export class MasonryHtmlItem extends MasonryBaseModal {
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
        
        ViewHTML.innerHTML = /*html*/`
        <div class="item-icon" style="display: flex; justify-content: center; align-items: center; height: 70%; ">
            <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code file icon">
            <!-- 背景阴影 -->
            <defs>
                <linearGradient id="codeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="100%" stop-color="#e6e6e6" />
                </linearGradient>
                <filter id="codeShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
                </filter>
            </defs>
            
            <!-- 整体容器阴影 -->
            <g filter="url(#codeShadow)">
                <!-- 代码文件主体 -->
                <rect x="10" y="10" width="44" height="44" rx="4" ry="4" fill="url(#codeGradient)"/>
                
                <!-- 折角效果 -->
                <path d="M54 10 L54 14 L50 10 Z" fill="#f0f0f0"/>
                
                <!-- 代码行 -->
                <g stroke="#666" stroke-width="1" opacity="0.8">
                    <line x1="16" y1="18" x2="48" y2="18"/>
                    <line x1="16" y1="24" x2="48" y2="24"/>
                    <line x1="16" y1="30" x2="40" y2="30"/>
                    <line x1="20" y1="36" x2="44" y2="36"/>
                    <line x1="16" y1="42" x2="48" y2="42"/>
                    <line x1="20" y1="48" x2="40" y2="48"/>
                </g>
                
                <!-- 特殊代码标记（根据文件类型显示不同颜色） -->
                <g font-family="Consolas, Monaco, 'Courier New', monospace" font-size="6" font-weight="bold">
                    ${fileExtension === 'html' ? `
                    <text x="16" y="23" fill="#e74c3c">&lt;div&gt;</text>
                    <text x="16" y="29" fill="#3498db">class="container"</text>
                    <text x="16" y="35" fill="#e74c3c">&lt;/div&gt;</text>
                    ` : ''}
                    ${fileExtension === 'css' ? `
                    <text x="16" y="23" fill="#9b59b6">.container</text>
                    <text x="20" y="29" fill="#3498db">display:</text>
                    <text x="38" y="29" fill="#2ecc71">flex</text>
                    <text x="20" y="35" fill="#3498db">color:</text>
                    <text x="38" y="35" fill="#e67e22">#333</text>
                    ` : ''}
                    ${fileExtension === 'js' ? `
                    <text x="16" y="23" fill="#f39c12">function</text>
                    <text x="30" y="23" fill="#2980b9">myFunc()</text>
                    <text x="20" y="29" fill="#27ae60">{</text>
                    <text x="24" y="35" fill="#3498db">console.log</text>
                    <text x="44" y="35" fill="#27ae60">();</text>
                    <text x="20" y="41" fill="#27ae60">}</text>
                    ` : ''}
                </g>
            </g>
            
            <!-- 右下角扩展名标签 -->
            <g transform="translate(36, 46)">
                <rect x="0" y="0" width="18" height="12" rx="2" ry="2" fill="#333"/>
                <text x="9" y="7.5" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="7" font-weight="700" fill="#fff" text-anchor="middle" alignment-baseline="middle">${fileExtension.toUpperCase()}</text>
            </g>
            </svg>
        </div>
        <div style="text-align: center; padding: 5px 0; word-break: break-all; overflow: hidden; text-overflow: ellipsis; color: #ffffff; font-weight: bold;">${this.item.name}</div>
        `;
        return ViewHTML;
    }
}

MasonryView.register((item)=>{
    if (
        item.path.endsWith(".html") 
        || item.path.endsWith(".HTML")
    ){
        return new MasonryHtmlItem(item);
    }else{
        return undefined;
    }
});