// ResourceLoader.js
class ResourceLoader extends HTMLElement {
    constructor() {
        super();
        this.resources = [];
        this.loaded = 0;
        this.failed = [];
        this.onComplete = null;
        this.retryCount = 3; // 自动重试次数

        this.attachShadow({ mode: 'open' });
        this.render();

        this.loaderContainer = this.shadowRoot.getElementById('loader-container');
        this.loadingText = this.shadowRoot.getElementById('loading-text');
        this.loadingProgress = this.shadowRoot.getElementById('loading-progress');
        this.loadingError = this.shadowRoot.getElementById('loading-error');
        this.retryButton = this.shadowRoot.getElementById('retry-button');
        this.skipButton = this.shadowRoot.getElementById('skip-button');

        this.retryButton.addEventListener('click', () => this.retryFailedResources());
        this.skipButton.addEventListener('click', () => this.skipFailedResources());
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                #loader-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.7);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    color: white;
                }
                .spinner {
                    width: 60px;
                    height: 60px;
                    border: 5px solid #f3f3f3;
                    border-top: 5px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1.5s linear infinite;
                    margin-bottom: 20px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                #loading-text {
                    font-size: 18px;
                    margin-bottom: 10px;
                }
                #loading-progress {
                    font-size: 14px;
                    margin-top: 10px;
                }
                #loading-error {
                    color: #ff6b6b;
                    margin-top: 10px;
                    max-width: 80%;
                    text-align: center;
                }
                .button {
                    margin-top: 15px;
                    padding: 8px 16px;
                    background-color: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    display: none;
                }
                .button:hover {
                    background-color: #2980b9;
                }
                #skip-button {
                    background-color: #e74c3c;
                }
                #skip-button:hover {
                    background-color: #c0392b;
                }
                .button-container {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                }
            </style>
            <div id="loader-container">
                <div class="spinner"></div>
                <div id="loading-text">正在加载资源...</div>
                <div id="loading-progress">0/0 已加载</div>
                <div id="loading-error"></div>
                <div class="button-container">
                    <button id="retry-button" class="button">重试失败的资源</button>
                    <button id="skip-button" class="button">忽略并继续</button>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        // 组件连接到DOM时的逻辑
    }

    add(url, type = 'script') {
        this.resources.push({ url, type, loaded: false, retries: 0 });
        return this;
    }

    load(callback) {
        this.onComplete = callback;
        this.updateProgress();

        if (this.resources.length === 0) {
            this.complete();
            return;
        }

        this.resources.forEach(resource => this.loadResource(resource));
    }

    loadResource(resource) {
        const { url, type } = resource;

        if (type === 'script') {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;

            script.onload = () => this.resourceLoaded(resource);
            script.onerror = () => this.resourceFailed(resource);

            document.head.appendChild(script);
        } else if (type === 'stylesheet') {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;

            link.onload = () => this.resourceLoaded(resource);
            link.onerror = () => this.resourceFailed(resource);

            document.head.appendChild(link);
        }
    }

    resourceLoaded(resource) {
        resource.loaded = true;
        this.loaded++;
        this.updateProgress();

        if (this.isAllLoaded()) {
            this.complete();
        }
    }

    isAllLoaded() {
        return this.resources.every(r => r.loaded || this.failed.includes(r));
    }

    resourceFailed(resource) {
        // 自动重试
        if (resource.retries < this.retryCount) {
            resource.retries++;
            console.log(`重试 ${resource.url} (${resource.retries}/${this.retryCount})...`);
            setTimeout(() => this.loadResource(resource), 1000);
            return;
        }

        // 达到最大重试次数
        if (!this.failed.includes(resource)) {
            this.failed.push(resource);
            this.updateError();
        }

        // 显示重试和跳过按钮
        if (this.failed.length > 0) {
            this.retryButton.style.display = 'block';
            this.skipButton.style.display = 'block';
        }

        // 检查是否所有资源都已处理完毕（成功加载或失败）
        if (this.isAllLoaded()) {
            this.loadingText.textContent = '部分资源加载失败，请选择：';
        }
    }

    retryFailedResources() {
        this.loadingText.textContent = '正在重试...';
        this.loadingError.textContent = '';
        this.retryButton.style.display = 'none';
        this.skipButton.style.display = 'none';

        const failedResources = [...this.failed];
        this.failed = [];

        failedResources.forEach(resource => {
            resource.retries = 0;
            resource.loaded = false;
            this.loadResource(resource);
        });
    }

    updateProgress() {
        this.loadingProgress.textContent = `${this.loaded}/${this.resources.length} 已加载`;
    }

    updateError() {
        if (this.failed.length > 0) {
            const failedUrls = this.failed.map(r => r.url.split('/').pop()).join(', ');
            this.loadingError.textContent = `无法加载: ${failedUrls}`;
        } else {
            this.loadingError.textContent = '';
        }
    }

    complete() {
        if (this.failed.length > 0) {
            // 有失败的资源，用户需要选择操作
            this.loadingText.textContent = '部分资源加载失败，请选择：';
        } else {
            // 全部加载成功，隐藏加载界面并调用回调
            this.hide();

            if (typeof this.onComplete === 'function') {
                this.onComplete(true);
            }
        }
    }

    skipFailedResources() {
        this.hide();

        if (typeof this.onComplete === 'function') {
            // 传递false表示存在跳过的资源
            this.onComplete(this.failed.length === 0);
        }
    }

    hide() {
        this.loaderContainer.style.display = 'none';
    }

    getFailedResources() {
        return [...this.failed];
    }
}

// 注册自定义元素
customElements.define('resource-loader', ResourceLoader);