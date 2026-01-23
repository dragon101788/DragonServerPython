import { BaseModal } from '/BaseModal.js';
import { WebdavApi } from '/webdav/WebdavApi.js';
import { getParentDir } from '/webdav/WebdavApi.js';

class SelectFileDialog extends BaseModal {
    constructor() {
        super();
        this.currentPath = '/';
        this.selectMode = 'file'; // 'file' 或 'directory'
        this.selectedPath = null;
    }

    render() {
        super.render();
        const isMobile = BaseModal.isMobile();
        const width = isMobile ? '90%' : '60%';
        const height = isMobile ? '80%' : '70%';
        
        const html = /*html*/`
            <div class="modal">
                <div class="modal-content" style="width: ${width}; height: ${height};">
                    <div class="header">
                        <h2>${this.getAttribute('title') || '选择文件'}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group" style="height: calc(100% - 120px); display: flex; flex-direction: column;">
                        <div class="path-bar" style="margin-bottom: 10px; padding: 5px; background-color: #f5f5f5; border-radius: 4px;">
                            <span id="currentPath">${this.currentPath}</span>
                        </div>
                        <div class="directory-content" id="directoryContent" style="flex-grow: 1; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 5px;">
                            <!-- 目录内容将通过 JavaScript 动态添加 -->
                            <div class="loading">加载中...</div>
                        </div>
                    </div>
                    <div class="button-group">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="confirmBtn" disabled>${this.selectMode === 'directory' ? '移动到当前目录' : '确认'}</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
        this.loadDirectoryContents();
    }

    async loadDirectoryContents() {
        const directoryContent = this.shadowRoot.getElementById('directoryContent');
        const confirmButton = this.shadowRoot.getElementById('confirmBtn');
        try {
            const items = await WebdavApi.getDirectoryContents(this.currentPath);
            directoryContent.innerHTML = '';
            
            // 添加上级目录
            if (this.currentPath !== '/') {
                const parentItem = document.createElement('div');
                parentItem.className = 'directory-item';
                parentItem.innerHTML = `
                    <span class="item-icon">📁</span>
                    <span class="item-name">..</span>
                `;
                parentItem.addEventListener('click', () => {
                    this.currentPath = getParentDir(this.currentPath);
                    this.shadowRoot.getElementById('currentPath').textContent = this.currentPath;
                    this.loadDirectoryContents();
                });
                directoryContent.appendChild(parentItem);
            }
            
            // 按类型排序：目录在前，文件在后
            const directories = items.filter(item => item.type === 'directory' && item.name !== '.');
            const files = items.filter(item => item.type === 'file');
            
            // 添加目录
            directories.forEach(dir => {
                const dirItem = document.createElement('div');
                dirItem.className = 'directory-item';
                dirItem.innerHTML = `
                    <span class="item-icon">📁</span>
                    <span class="item-name">${dir.name}</span>
                `;
                dirItem.addEventListener('click', () => {
                    this.currentPath = dir.path;
                    this.shadowRoot.getElementById('currentPath').textContent = this.currentPath;
                    this.loadDirectoryContents();
                });
                directoryContent.appendChild(dirItem);
            });
            
            // 添加文件（仅当选择模式为文件时）
            if (this.selectMode === 'file') {
                files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = `
                        <span class="item-icon">📄</span>
                        <span class="item-name">${file.name}</span>
                        <span class="item-size">${this.formatFileSize(file.size)}</span>
                    `;
                    fileItem.addEventListener('click', () => {
                        this.selectItem(file.path);
                    });
                    directoryContent.appendChild(fileItem);
                });
            }
            
            // 添加样式
            const style = document.createElement('style');
            style.textContent = /*css*/`
                .directory-item, .file-item {
                    display: flex;
                    align-items: center;
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-bottom: 2px;
                }
                .directory-item:hover, .file-item:hover {
                    background-color: #e3f2fd;
                }
                .directory-item.selected, .file-item.selected {
                    background-color: #bbdefb;
                    font-weight: bold;
                }
                .item-icon {
                    margin-right: 10px;
                    font-size: 16px;
                }
                .item-name {
                    flex-grow: 1;
                }
                .item-size {
                    color: #666;
                    font-size: 14px;
                }
                .loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                    color: #666;
                }
                .path-bar {
                    font-size: 14px;
                    color: #333;
                }
            `;
            this.shadowRoot.appendChild(style);
            
            // 根据选择模式设置确认按钮状态
            if (this.selectMode === 'directory') {
                // 目录模式下，只要加载了目录就启用确认按钮
                confirmButton.disabled = false;
            }
            
        } catch (error) {
            directoryContent.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
            console.error('Failed to load directory contents:', error);
        }
    }

    selectItem(path) {
        // 清除之前的选择
        const items = this.shadowRoot.querySelectorAll('.directory-item, .file-item');
        items.forEach(item => item.classList.remove('selected'));
        
        // 标记当前选择
        this.selectedPath = path;
        
        // 启用确认按钮
        this.shadowRoot.getElementById('confirmBtn').disabled = false;
        
        // 突出显示选中项
        const selectedItem = Array.from(items).find(item => {
            const itemName = item.querySelector('.item-name').textContent;
            return itemName === path.split('/').pop() || (path === this.currentPath && itemName === '..');
        });
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const cancelButton = this.shadowRoot.getElementById('cancelBtn');
        const confirmButton = this.shadowRoot.getElementById('confirmBtn');
        const directoryContent = this.shadowRoot.getElementById('directoryContent');
        
        closeButton.addEventListener('click', () => {
            this.close();
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
        
        confirmButton.addEventListener('click', () => {
            let pathToSend;
            if (this.selectMode === 'directory') {
                // 目录模式下发送当前目录路径
                pathToSend = this.currentPath;
            } else {
                // 文件模式下发送选中的文件路径
                pathToSend = this.selectedPath;
            }
            
            if (pathToSend) {
                const confirmEvent = new CustomEvent('confirm', {
                    detail: { path: pathToSend }
                });
                this.dispatchEvent(confirmEvent);
                this.close();
            }
        });
        
        // 点击目录内容区域的空白处取消选择
        directoryContent.addEventListener('click', (e) => {
            if (e.target === directoryContent && this.selectMode === 'file') {
                this.selectedPath = null;
                confirmButton.disabled = true;
                const items = directoryContent.querySelectorAll('.directory-item, .file-item');
                items.forEach(item => item.classList.remove('selected'));
            }
        });
        
        // 双击目录进入，双击文件选择
        directoryContent.addEventListener('dblclick', (e) => {
            const item = e.target.closest('.directory-item, .file-item');
            if (item) {
                const itemName = item.querySelector('.item-name').textContent;
                if (itemName === '..') {
                    // 双击上级目录
                    this.currentPath = getParentDir(this.currentPath);
                    this.shadowRoot.getElementById('currentPath').textContent = this.currentPath;
                    this.loadDirectoryContents();
                } else if (item.classList.contains('directory-item')) {
                    // 双击目录进入
                    const dirPath = this.currentPath + itemName + '/';
                    this.currentPath = dirPath;
                    this.shadowRoot.getElementById('currentPath').textContent = this.currentPath;
                    this.loadDirectoryContents();
                } else if (item.classList.contains('file-item')) {
                    // 双击文件选择
                    const filePath = this.currentPath + itemName;
                    this.selectItem(filePath);
                    confirmButton.click();
                }
            }
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 静态打开方法
    static open(options = {}) {
        const modal = new this();
        
        // 设置选项
        if (options.title) {
            modal.setAttribute('title', options.title);
        }
        if (options.mode) {
            modal.selectMode = options.mode; // 'file' 或 'directory'
        }
        if (options.initialPath) {
            modal.currentPath = options.initialPath;
        }
        
        document.body.appendChild(modal);
        modal.show();
        BaseModal.openModals.push(modal);
        return modal;
    }
}

customElements.define('select-file-dialog', SelectFileDialog);
export { SelectFileDialog };

 