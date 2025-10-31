import { InputDialog, MessageDialog, BaseModal, TextAreaDialog } from '/BaseModal.js';

import { AccountManager } from '/AccountManager.js';
import { WebVideoPlayer } from "/media/WebVideoPlayer.js";
import { WebImagePlayer } from "/MasonryExplorer/WebImagePlayer.js";
import { WebMindMap } from "/mindmap/WebMindMap.js";
import { WebHtmlViewer } from "/TinyMCE/WebHtmlViewer.js";
import { WebDrawioViewer } from "/drawio/WebDrawioViewer.js";
import { MasonryView } from "/MasonryExplorer/MasonryView.js";
import "/webdav/DirectoryToolbar.js";



class DirectoryGrid extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    static is_supported_format(item) {
        if (item.type === "directory") {
            return true;
        } else {
            return false;
        }
    }
    async connectedCallback() {
        await this.render();
        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }
        const browers = document.getElementById('sidebar-browers');
        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            const topStatusBarSelf = document.createElement('div');
            topStatusBarSelf.className = 'top-status-bar-self';
            topStatusBarSelf.innerHTML = /*html*/`
                <style>
                    .top-status-bar-self {
                        background-color: transparent;
                        float: right;
                        border: none;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                </style>
                <sort-select id="sort-select" class="align-left" value="${browers.getSortMethod()}"></sort-select>
                <button id="photo-wall-btn" class="align-left">照片墙式浏览</button>
            `
            topStatusBar.appendChild(topStatusBarSelf);
        }
        this.setupEventListeners();
    }
    async disconnectedCallback() {
        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }
    }

    async render() {
        const browers = document.getElementById('sidebar-browers');
        const path = this.getAttribute('path');
        let gridItems = '';

        if (browers) {
            browers.traverseDirectory((p, item) => {
                if (p !== path && item.name !== '..') {
                    gridItems += `
                        <div class="grid-item" data-path="${p}">
                            <div class="item-icon">${item.type === 'directory' ? '📁' : '📄'}</div>
                            <div class="item-name">${item.name}</div>
                        </div>`;
                }
            });
        }

        this.shadowRoot.innerHTML = `
            <style>
                .directory-grid {
                    padding: 20px;
                    flex: 1;
                    box-sizing: border-box;
                }

                .grid-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                    flex: 1;
                }

                .grid-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                    border-radius: 5px;
                    transition: background-color 0.2s;
                    height: 120px;
                    width: 120px;
                    justify-content: center;
                }

                .grid-item:hover {
                    background-color: #f0f0f0;
                }

                .item-icon {
                    font-size: 32px;
                    margin-bottom: 5px;
                    flex-shrink: 0;
                }

                .item-name {
                    text-align: center;
                    word-break: break-word;
                    width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }
            </style>
            <div class="directory-grid">
                <div class="grid-container" id="grid-container">
                    ${gridItems} 
                </div>
            </div>
        `;
    }

    setupEventListeners() {

        const browers = document.getElementById('sidebar-browers');
        const gridContainer = this.shadowRoot.getElementById('grid-container');
        if (!gridContainer) return;

        const toolbar = document.querySelector('.top-status-bar-self');
        if (toolbar) {
            toolbar.addEventListener('sort-change', async (e) => {
                browers.Sort(e.detail.value);
                await this.render();
                this.setupEventListeners();
            });
            const photoWallBtn = toolbar.querySelector('#photo-wall-btn');
            if (photoWallBtn) {
                photoWallBtn.addEventListener('click', async () => {
                    this.shadowRoot.innerHTML = `
                        <masonry-view path="${browers.getCurrentPath()}" "></masonry-view>
                    `;
                });
            }
        }
        const gridItems = gridContainer.querySelectorAll('.grid-item');
        gridItems.forEach((gridItem) => {
            const path = gridItem.dataset.path;
            gridItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                browers.openContextMenu(path, e.clientX, e.clientY);
            });
            gridItem.addEventListener('click', () => {
                const item = browers.getPathItem(path);
                if (item.type === 'directory') {
                    browers.loadDirectory(path);
                }
                else if (item.type === 'file') {
                    browers.openFile(path);
                }
            });
        });
    }
}

customElements.define('directory-grid', DirectoryGrid);



class WebTextEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    static is_supported_format(item) {
        if (item.contentType === "text/plain") {
            return true;
        } else {
            return false;
        }
    }
    async connectedCallback() {
        const path = this.getAttribute('path');
        const token = this.getAttribute('token');
        const readonly = this.getAttribute('readonly') === 'true';

        try {
            const browers = document.getElementById('sidebar-browers');
            const response = await browers.fetchFile(path)
            const text = await response.text();

            this.shadowRoot.innerHTML = /*html*/`
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%; 
                    overflow: hidden;
                }
                .text-viewer {
                    width: 100%;
                    height: calc(100%);
                    border: 1px solid #ccc;
                    font-family: monospace;
                    resize: none;
                }
            </style>
            <textarea class="text-viewer" ${readonly ? 'readonly' : ''}>${text}</textarea>
        `;

        } catch (error) {
            this.shadowRoot.innerHTML = `
            <div class="text-container">
                <p>文本加载失败</p>
            </div>
        `;
        }
    }
}

customElements.define('web-text-editor', WebTextEditor);


export  class WebExplorer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // 监控属性变化

    async connectedCallback() {

        console.log("WebExplorer connectedCallback");
        const browers = document.getElementById('sidebar-browers');
        if (!browers) {
            this.shadowRoot.innerHTML = '<div>未加载任何内容</div>';
            return;
        }
        const path = this.getAttribute('path');
        const item = browers.getPathItem(this.getAttribute('path'));
        let option = undefined
        if (this.getAttribute("options")) {
            option = JSON.parse(decodeURIComponent(this.getAttribute("options")))
        }
        if (option && option.request === "property") {
            this.shadowRoot.innerHTML = `<file-details path="${path}" option=${this.getAttribute("options")}></file-details>`;
            return;
        }
        if (MasonryView.is_supported_format(item)) {

            this.shadowRoot.innerHTML = `<directory-grid path="${path}"></directory-grid>`;
        } else if (WebVideoPlayer.is_supported_format(item)) {
            this.shadowRoot.innerHTML = /*html*/ `
                    <web-video-player autoplay="true" src="${item.path}" > </web-video-player>
                `;
        } else if (WebImagePlayer.is_supported_format(item)) {
            this.shadowRoot.innerHTML = /*html*/ `
                    <web-image-player 
                        path="${item.path}" >
                    </web-image-player>
                `;
        } else if (WebMindMap.is_supported_format(item)) {
            this.shadowRoot.innerHTML = /*html*/`
                    <web-mind-map src="${item.path}">
                    </web-mind-map>
                `;
        } else if (WebTextEditor.is_supported_format(item)) {
            this.shadowRoot.innerHTML = /*html*/`
                    <web-text-editor path="${item.path}">
                    </web-text-editor>
                `;
        } else if (WebHtmlViewer.is_supported_format(item)) {
            this.shadowRoot.innerHTML = /*html*/`
                    <web-html-viewer src="${item.path}">
                    </web-html-viewer>
                `;
        } else if (WebDrawioViewer.is_supported_format(item)) {
            this.shadowRoot.innerHTML = /*html*/`
                    <web-drawio-viewer src="${item.path} ">
                    </web-drawio-viewer>
                `;
        } else {
            this.shadowRoot.innerHTML = `<file-details path="${path}"></file-details>`;
        }

    }
    disconnectedCallback() {
        console.log("WebExplorer disconnectedCallback");
    }


}

customElements.define('web-explorer', WebExplorer);
