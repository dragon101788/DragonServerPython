import { WebdavApi } from '/webdav/WebdavApi.js';
import { commonWebdavProperty } from '/webdav/CommonFileProperty.js';

export class WebdavAdapter  extends HTMLElement {
    static {
        WebdavAdapter.matchers = []
        WebdavAdapter.WebdavProperty = []
        
    }
    static register(matcher){
        WebdavAdapter.matchers.push(matcher );
    }
    static registerProperty(property){
        WebdavAdapter.WebdavProperty.push(property );
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
        
        this.eventListeners.WebdavProperty = async (event) => {
            
            const {path, item} = event.detail;

            let propertyElement = undefined;

            for (const property of WebdavAdapter.WebdavProperty){
                propertyElement = await property(item);
                
            }
            
            if (propertyElement === undefined){
                propertyElement = await commonWebdavProperty(item);
            }
            this.shadowRoot.replaceChildren(propertyElement);
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


import '/webdav/CommonFileProperty.js';