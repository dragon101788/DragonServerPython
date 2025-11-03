import { WebdavApi } from '/webdav/WebdavApi.js';



export class WebdavAdapter  extends HTMLElement {
    static {
        WebdavAdapter.matchers = []
        
        
    }
    static register(matcher){
        WebdavAdapter.matchers.push(matcher );
    }
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        // 初始化事件监听器引用
        this.eventListeners = {
            WebdavOpen: null,
            WebdavClose: null,
            WebdavError: null,
            WebdavChdir: null,
            WebdavProperty: null
        };
    }

    fileDetails(item) {
        this.shadowRoot.innerHTML = `
            <style>
                .file-details  {
                    padding: 20px;
                    height: 100%;
                    box-sizing: border-box;
                }

                .detail-row {
                    margin: 10px 0;
                    display: flex;
                }

                .detail-label {
                    font-weight: bold;
                    width: 100px;
                }

                .detail-value {
                    flex: 1;
                }
            </style>
            <div class="file-details">
                <h2>${item.name}</h2>
                <div class="detail-row">
                    <span class="detail-label">路径:</span>
                    <span class="detail-value">${item.path}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">类型:</span>
                    <span class="detail-value">${item.contentType}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">大小:</span>
                    <span class="detail-value">${this.formatFileSize(item.size)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">${item.created}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">修改时间:</span>
                    <span class="detail-value">${item.modified}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">只读:</span>
                    <span class="detail-value">${item.readonly ? '是' : '否'}</span>
                </div>
            </div>
        `;

        if (item.type === 'file' && item.limits.includes('download')) {
            const downloadButton = document.createElement('button');
            downloadButton.textContent = '下载';
            downloadButton.addEventListener('click', async () => {
                downloadButton.disabled = true;
                downloadButton.textContent = '下载中...';
                const progressBar = document.createElement('progress');
                progressBar.value = 0;
                progressBar.max = 100;
                this.shadowRoot.querySelector('.file-details').appendChild(progressBar);

                await WebdavApi.downloadFile(item.path, (proress) => {
                    progressBar.value = proress;
                });
                this.shadowRoot.querySelector('.file-details').removeChild(progressBar);
                progressBar.remove();
                downloadButton.disabled = false;
                downloadButton.textContent = '下载';
            });
            this.shadowRoot.querySelector('.file-details').appendChild(downloadButton);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    openWebSite(url){
        this.shadowRoot.innerHTML = `
            <iframe id="html-frame" src="${url}" style="width: 100%; height: 100%; border: none; "></iframe>
        `;
    }
    openHTMLElement(element){
        this.gobackElement = this.shadowRoot.innerHTML;
        this.shadowRoot.replaceChildren(element);
    }
    openHTMLString(htmlString){
        this.gobackElement = this.shadowRoot.innerHTML;
        this.shadowRoot.innerHTML = htmlString;
    }
    goback(){
        this.shadowRoot.innerHTML = this.gobackElement;
    }
    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <div class="main-display-area">主要显示区域内容</div>
        `;

        // 移除可能存在的监听器
        this._removeAllEventListeners();
        
        // 注册WebdavOpen事件监听器
        this.eventListeners.WebdavOpen = (event) => {
            const {item, path, options} = event.detail;
            for (const matcher of WebdavAdapter.matchers){
                const adp = matcher(item);
                if (adp){
                    this.gobackElement = this.shadowRoot.innerHTML;
                    this.shadowRoot.replaceChildren(adp);
                    break;
                }
            }
        };
        document.addEventListener('WebdavOpen', this.eventListeners.WebdavOpen);
        
        // 注册WebdavClose事件监听器
        this.eventListeners.WebdavClose = (event) => {
            this.shadowRoot.innerHTML = `
                <div class="main-display-area">主要显示区域内容</div>
            `;
        };
        document.addEventListener('WebdavClose', this.eventListeners.WebdavClose);
        
        // 注册WebdavError事件监听器
        this.eventListeners.WebdavError = (event) => {
            this.shadowRoot.innerHTML = `
                <div class="main-display-area">打开失败</div>
            `;
        };
        document.addEventListener('WebdavError', this.eventListeners.WebdavError);
        
        // 注册WebdavChdir事件监听器
        this.eventListeners.WebdavChdir = (event) => {
            const {item, path, options} = event.detail;
            for (const matcher of WebdavAdapter.matchers){
                const adp = matcher(item);
                if (adp){
                    this.shadowRoot.replaceChildren(adp);
                }
            }
        };
        document.addEventListener('WebdavChdir', this.eventListeners.WebdavChdir);
        
        // 注册WebdavProperty事件监听器
        this.eventListeners.WebdavProperty = (event) => {
            const {path, item} = event.detail;
            this.fileDetails(item);
        };
        document.addEventListener('WebdavProperty', this.eventListeners.WebdavProperty);
    }
    
    // 组件断开连接时清理事件监听器
    disconnectedCallback() {
        this._removeAllEventListeners();
    }
    // 移除所有事件监听器的辅助方法
    _removeAllEventListeners() {
        for (const [eventName, listener] of Object.entries(this.eventListeners)) {
            if (listener) {
                document.removeEventListener(eventName, listener);
                this.eventListeners[eventName] = null;
            }
        }
    }

}
    

customElements.define('webdav-adapter', WebdavAdapter);

