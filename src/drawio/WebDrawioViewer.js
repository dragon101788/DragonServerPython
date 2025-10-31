import { WebdavAdapter } from '/webdav/WebdavAdapter.js';
import { AccountManager } from '/AccountManager.js';
import {  CopyToClipboardDialog } from '/BaseModal.js';

export class WebDrawioViewer extends HTMLElement {
    static get observedAttributes() {
        return ['src', 'html'];
    }
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
        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            // 添加按钮
            const button = document.createElement('button');
            button.textContent = '分享';
            button.style.float = "right";
            button.style.marginRight = "10px";
            button.classList.add('share-btn');
            button.addEventListener('click', () => {
                const protocol = window.location.protocol;
                //获取当前域名
                const host = window.location.host;
                const url = protocol + "//" + host  + this.url;

                console.log("分享按钮点击",url);
                CopyToClipboardDialog.open({
                    title: `分享链接`,
                    message: "",
                    text: `${url}`
                });

            });
            topStatusBar.appendChild(button);
        }
    }
    async disconnectedCallback() {
        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            // 移除按钮
            const button = topStatusBar.querySelector('.share-btn');
            if (button) {
                topStatusBar.removeChild(button);
            }
        }
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            await this.loadHtmlContent();
        }
    }

    async loadHtmlContent() {
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
        this.url = "/drawio/index.html?" + searchParams.toString();

        
        // 通过URL加载完整网页
        this.iframe.src = this.url;

       
    }
}

customElements.define('web-drawio-viewer', WebDrawioViewer);
WebdavAdapter.register((item)=>{
    if (item.contentType === "application/octet-stream" && item.path.endsWith(".drawio")) {
        const webview = new WebDrawioViewer();
        webview.setAttribute('src', item.path);
        return webview;
    } else {
        return undefined;
    }
});
