import { BaseModal } from './BaseModal.js';

export class AlbumModal extends BaseModal {
    constructor() {
        super();
        this.images = [];
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
                }
                
                .album-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #ddd;
                }
                
                .album-title {
                    margin: 0;
                    font-size: 1.5rem;
                    color: var(--text-primary, #2e3338);
                }
                
                .album-grid {
                    flex: 1;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .image-item {
                    position: relative;
                    aspect-ratio: 1;
                    overflow: hidden;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                }
                
                .image-item:hover {
                    transform: scale(1.05);
                }
                
                .image-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
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
                }
                
                .loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                    font-size: 1.2rem;
                    color: var(--text-primary, #2e3338);
                }
                
                .error {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                    font-size: 1.2rem;
                    color: #da373c;
                }
            </style>
            <div class="modal">
                <div class="modal-content">
                    <div class="album-header">
                        <h2 class="album-title">相册浏览</h2>
                        <span class="close">&times;</span>
                    </div>
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
        const closeButton = this.shadowRoot.querySelector('.close');
        closeButton.addEventListener('click', () => this.close());

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

            // 过滤出图片文件
            this.images = files.filter(file => file.contentType?.startsWith('image/'));

            // 渲染图片网格
            if (this.images.length === 0) {
                grid.innerHTML = '<div class="error">该目录中没有图片</div>';
                return;
            }

            grid.innerHTML = this.images.map(image => {
                const fileName = image.path.split('/').pop();
                return /*html*/`
                    <div class="image-item" onclick="viewImage('${image.path}')">
                        <img src="${image.path}" alt="${fileName}">
                        <div class="image-caption">${fileName}</div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading album:', error);
            grid.innerHTML = '<div class="error">加载相册失败</div>';
        }
    }

}

// 注册自定义元素
customElements.define('album-modal', AlbumModal);
