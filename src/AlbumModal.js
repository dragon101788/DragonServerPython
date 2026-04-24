import { BaseModal } from './BaseModal.js';
import { VideoModal  } from '/media/dvideo.js';

export class AlbumModal extends BaseModal {
    constructor() {
        super();
        this.files = [];
    }

    render() {
        super.render();
        const html = /*html*/`
            <style>
                .modal-content {
                    width: 90% !important;
                    max-width: 1200px !important;
                    height: 90vh !important;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    background: transparent !important;
                }
                

                
                .close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 30px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1001;
                    transition: all 0.3s ease;
                }
                .close:hover,
                .close:focus {
                    color: #fff;
                    background-color: rgba(0, 0, 0, 0.8);
                    transform: scale(1.1);
                    text-decoration: none;
                    cursor: pointer;
                }
                
                .album-grid {
                    flex: 1;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    grid-auto-rows: 10px;
                    gap: 0;
                    overflow-y: auto;
                    padding: 0;
                    margin-top: 0;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                }

                .album-grid::-webkit-scrollbar {
                    width: 6px;
                }

                .album-grid::-webkit-scrollbar-track {
                    background: transparent;
                }

                .album-grid::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                }

                .album-grid::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(255, 255, 255, 0.4);
                }
                
                .image-item {
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                }
                
                .image-item:hover {
                    transform: scale(1.02);
                    z-index: 5;
                }
                
                .image-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                
                .image-caption {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0, 0, 0, 0.6);
                    color: white;
                    padding: 8px;
                    font-size: 0.8rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                
                .image-item:hover .image-caption {
                    opacity: 1;
                }
                
                .loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                    font-size: 1.2rem;
                    color: white;
                    background: rgba(0, 0, 0, 0.3);
                }
                
                .error {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                    font-size: 1.2rem;
                    color: #ff6b6b;
                    background: rgba(0, 0, 0, 0.3);
                }
            </style>
            <div class="modal">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <div class="form-group">
                        <div id="album-grid" class="album-grid">
                            <div class="loading">加载中...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    async setupEventListeners() {
        // 点击模态框背景关闭
        const modal = this.shadowRoot.querySelector('.modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });
        // 点击关闭按钮关闭
        const close = this.shadowRoot.querySelector('.close');
        close.addEventListener('click', () => {
            console.log('关闭相册模态框');
            this.close();
        });

        // 加载相册内容
        await this.loadAlbumContent();
    }

    async loadAlbumContent() {
        const grid = this.shadowRoot.querySelector('#album-grid');
        try {
            const dir = this.getAttribute('dir');
            // 调用 API 获取文件列表
            const response = await fetch(`/api/list_files/${encodeURIComponent(dir)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch files');
            }
            const files = await response.json();

            // 过滤出图片和视频文件
            this.files = files.filter(file => 
                file.contentType?.startsWith('image/') || 
                file.contentType?.startsWith('video/')
            );

            // 渲染图片网格
            if (this.files.length === 0) {
                grid.innerHTML = '<div class="error">该目录中没有图片</div>';
                return;
            }

            // 创建图片项并设置动态高度
            const fragment = document.createDocumentFragment();
            
            for (const file of this.files) {
                const fileName = file.path.split('/').pop();
                const imageItem = document.createElement('div');
                imageItem.className = 'image-item';
                imageItem.onclick = () => this.onOpen(file);
                
                const img = document.createElement('img');
                img.src = file.path + '?thumb=512';
                img.alt = fileName;
                
                const caption = document.createElement('div');
                caption.className = 'image-caption';
                caption.textContent = fileName;
                
                imageItem.appendChild(img);
                imageItem.appendChild(caption);
                fragment.appendChild(imageItem);
                
                // 加载图片后计算高度
                img.onload = function() {
                    const aspectRatio =   this.naturalHeight / this.naturalWidth;
                    const rowSpan = Math.ceil(aspectRatio * 20); // 调整系数以获得合适的高度
                    imageItem.style.gridRowEnd = `span ${rowSpan}`;
                };
            }
            
            grid.innerHTML = '';
            grid.appendChild(fragment);
        } catch (error) {
            console.error('Error loading album:', error);
            grid.innerHTML = '<div class="error">加载相册失败</div>';
        }
    }

     onOpen(file) {
        if(file.contentType?.startsWith('video/'))
        {
            this.openVideoViewer(file);
        }
        else
        {
            // 图片文件
            this.openImageViewer(file);
        }
    }

    openVideoViewer(file){
        VideoModal.open({videoUrl: file.path});
    }

    openImageViewer(file) {
        // 创建图片查看器模态框
        const viewerModal = document.createElement('div');
        viewerModal.className = 'image-viewer-modal';
        viewerModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = file.path;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
        `;
        
        // 点击关闭查看器
        viewerModal.addEventListener('click', () => {
            document.body.removeChild(viewerModal);
        });
        
        // 防止点击图片时关闭
        img.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        viewerModal.appendChild(img);
        document.body.appendChild(viewerModal);
    }

}

// 注册自定义元素
customElements.define('album-modal', AlbumModal);
