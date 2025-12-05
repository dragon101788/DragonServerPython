import { MasonryView } from '/MasonryExplorer/MasonryView.js';
import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { WebdavApi } from '/webdav/WebdavApi.js';
import { VideoModal } from '/media/dvideo.js';

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
        const thumbnailSize = this.father.getThumbnailSize(this.item.path);
        const img = await WebdavApi.getThumbnail(this.item.path,thumbnailSize);
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
            <img class="item-image" src="${img}" alt="${this.item.name}">
            <div class="video-indicator">
                <svg viewBox="0 0 24 24" width="40" height="40">
                    <circle cx="12" cy="12" r="11" fill="rgba(0, 0, 0, 0.6)"/>
                    <path d="M8 5v14l11-7z" fill="white"/>
                </svg>
            </div>
            <div class="item-name-float">${this.item.name}</div>
        `;
        ViewHTML.classList.add('video-item');
        ViewHTML.itemHeight = this.father.getBaseWidth() * ( img.height / img.width );
        ViewHTML.style.height = `${ViewHTML.itemHeight}px`;
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
    
    
    doPlay(){        
        VideoModal.open({
            videoUrl: `${this.item.path}`
        })
    }
}

MasonryView.register((item)=>{
    if (
        item.contentType.startsWith("video/") 
        || item.path.endsWith(".flv")
        || item.path.endsWith(".rmvb") 
        ||item.path.endsWith(".rm") 
    ){
        return new MasonryVideoItem(item);
    }else{
        return undefined;
    }
});
