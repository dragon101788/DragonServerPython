import { WebdavAdapter } from '/webdav/WebdavAdapter.js';
import { AccountManager } from '/AccountManager.js';
import {  CopyToClipboardDialog } from '/BaseModal.js';
import { WebdavApi } from '/webdav/WebdavApi.js';
import { MasonryBaseModal } from '/MasonryExplorer/MasonryBaseModal.js';
import { MasonryView } from '/MasonryExplorer/MasonryView.js';

export class WebHtmlViewer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // 使用iframe实现完整的HTML文档环境，支持脚本执行
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                }
                #html-frame {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .loading-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(255, 255, 255, 0.8);
                    z-index: 10;
                }
                .loading {
                    color: #666;
                    font-size: 14px;
                }
                .error {
                    color: #ff0000;
                    font-size: 14px;
                }
            </style>
            <div class="loading-container">
                <div class="loading">加载中...</div>
            </div>
            <iframe id="html-frame"></iframe>
        `;

        this.iframe = this.shadowRoot.getElementById('html-frame');
        this.loadingContainer = this.shadowRoot.querySelector('.loading-container');
        this.loadingMessage = this.shadowRoot.querySelector('.loading');

        // 监听iframe加载事件
        this.iframe.addEventListener('load', () => {
            this.loadingContainer.style.display = 'none';
        });

        this.iframe.addEventListener('error', () => {
            this.loadingMessage.textContent = '加载失败: 无法加载内容';
            this.loadingMessage.className = 'error';
        });
    }

    async connectedCallback() {
        
        await this.loadHtmlContent();
        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }
        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            const topStatusBarSelf = document.createElement('div');
            topStatusBarSelf.classList.add('top-status-bar-self');
            topStatusBarSelf.innerHTML = /*html*/`
                <style>
                    .top-status-bar-self {
                        background-color: transparent;
                        float: right;
                        border: none;
                        cursor: pointer;
                    }
                    button {
                        float: right;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                </style>
                
                
                <button id="Download-btn">下载</button>
                <button id="edit-btn">编辑</button>
                <button id="preview-btn" style="display: none;">预览</button>
                <button id="share-btn">分享</button>

            `;
            topStatusBar.appendChild(topStatusBarSelf);

            const DownloadButton = document.getElementById('Download-btn');
            DownloadButton.addEventListener('click', () => {
                const browers = document.getElementById('sidebar-browers');
                const src = this.getAttribute('src');
                console.log("保存按钮点击");
                // 保存HTML内容
                browers.webdavApi.downloadFile(src);
            });

            const editButton = document.getElementById('edit-btn');
            editButton.addEventListener('click', () => {
                const browers = document.getElementById('sidebar-browers');
                console.log("编辑按钮点击");
                // 隐藏预览按钮
                previewButton.style.display = 'block';
                // 确保编辑按钮可见
                editButton.style.display = 'none';
                // 编辑HTML内容
                this.editHtmlContent();
            });
            const previewButton = document.getElementById('preview-btn');
            previewButton.addEventListener('click',async () => {
                    const browers = document.getElementById('sidebar-browers');
                console.log("预览按钮点击");
                // 隐藏编辑按钮
                editButton.style.display = 'block';
                // 确保预览按钮可见
                previewButton.style.display = 'none';

                await this.loadHtmlContent();
            });

            const shareButton = document.getElementById('share-btn');
            shareButton.addEventListener('click', async     () => {
                const protocol = window.location.protocol;
                //获取当前域名
                const host = window.location.host;
                const token = await AccountManager.getToken();
                const src = this.getAttribute('src');
                //传递search参数
                const searchParams = new URLSearchParams({
                    src: src,
                    token: token,
                });
                const url = "/TinyMCE/preview.html?" + searchParams.toString();

                console.log("分享按钮点击",url);
                //打开新窗口
                window.open(url, '_blank');
            });

        }
    }
    async disconnectedCallback() {
        const topStatusBarSelf = document.querySelector('.top-status-bar-self');
        if (topStatusBarSelf) {
            topStatusBarSelf.remove();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.loadHtmlContent();
        }
    }

    async editHtmlContent() {
        const src = this.getAttribute('src');

        // 显示加载状态
        this.loadingContainer.style.display = 'flex';


        const browers = document.getElementById('sidebar-browers');
        
        const token = await AccountManager.getToken();
        //传递search参数
        const searchParams = new URLSearchParams({
            src: src,
            token: token,
        });
        this.url = "/TinyMCE/index.html?" + searchParams.toString();

        
        // 通过URL加载完整网页
        this.iframe.src = this.url;

       
    }
    async loadHtmlContent() {
        const src = this.getAttribute('src');
        const htmlContent = this.getAttribute('html');

        // 显示加载状态
        this.loadingContainer.style.display = 'flex';
        this.loadingMessage.textContent = '加载中...';
        this.loadingMessage.className = 'loading';

        try {
            if (src) {

                // 通过URL加载完整网页
                this.iframe.src = WebdavApi.serverUrl + encodeURIComponent(src);
            } else if (htmlContent) {
                // 直接加载HTML内容，包括脚本
                const doc = this.iframe.contentDocument;
                doc.open();
                doc.write(htmlContent);
                doc.close(); // 触发文档加载完成，执行脚本
            } else {
                this.loadingMessage.textContent = '未指定src或html属性';
                this.loadingMessage.className = 'error';
            }
        } catch (error) {
            this.loadingMessage.textContent = `加载失败: ${error.message}`;
            this.loadingMessage.className = 'error';
        }
    }
}

customElements.define('web-html-viewer', WebHtmlViewer);

WebdavAdapter.register((item)=>{
    if (item.contentType === "text/html" && item.path.endsWith(".html")) {
        const webview = new WebHtmlViewer();
        webview.setAttribute('src', item.path);
        return webview;
    } else {
        return undefined;
    }
});