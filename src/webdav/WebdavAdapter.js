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

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <div class="main-display-area">主要显示区域内容</div>
        `;

        document.addEventListener('WebdavOpen', (event) => {
            const {item, path, options} = event.detail;
            for (const matcher of WebdavAdapter.matchers){
                const adp = matcher(item);
                if (adp){
                    this.shadowRoot.replaceChildren(adp);
                }
            }
        });
        document.addEventListener('WebdavClose', (event) => {
            this.shadowRoot.innerHTML = `
                <div class="main-display-area">主要显示区域内容</div>
            `;
        });
        document.addEventListener('WebdavError', (event) => {
            this.shadowRoot.innerHTML = `
                <div class="main-display-area">打开失败</div>
            `;
        });
        document.addEventListener('WebdavChdir', (event) => {
            const {item, path, options} = event.detail;
            for (const matcher of WebdavAdapter.matchers){
                const adp = matcher(item);
                if (adp){
                    this.shadowRoot.replaceChildren(adp);
                }
            }
        });
        document.addEventListener('WebdavProperty', (event) => {
            const {path, item} = event.detail;
            this.fileDetails(item);
        });
    }

}
customElements.define('webdav-adapter', WebdavAdapter);
