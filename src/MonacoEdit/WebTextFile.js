import { WebdavAdapter } from '/webdav/WebdavAdapter.js';
import { AccountManager } from '/AccountManager.js';

export class WebTextFile extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                }
                #text-frame {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
            </style>
            <iframe id="text-frame"></iframe>
        `;
        this.iframe = this.shadowRoot.getElementById('text-frame');
        this.loadingMessage = this.shadowRoot.querySelector('.loading');
        this.editSrcContent();
    }
    async editSrcContent(){
        const src = this.getAttribute('src');


        
        const token = await AccountManager.getToken();
        //传递search参数
        const searchParams = new URLSearchParams({
            src: src,
            token: token,
        });
        this.url = "/MonacoEdit/index.html?" + searchParams.toString();

        
        // 通过URL加载完整网页
        this.iframe.src = this.url;
    }
}
customElements.define('web-text-file', WebTextFile);
WebdavAdapter.register((item)=>{
    if ( item.path.endsWith(".txt") ||
         item.path.endsWith(".md") ||
         item.path.endsWith(".html") ||
         item.path.endsWith(".css") ||
         item.path.endsWith(".js") ||
         item.path.endsWith(".json") ||
         item.path.endsWith(".py") ||
         item.path.endsWith(".sh") ||
         item.path.endsWith(".c") ||
         item.path.endsWith(".cpp") ||
            item.path.endsWith(".h") ||
            item.path.endsWith(".hpp") 
    ) {
        const webview = new WebTextFile();
        webview.setAttribute('src', item.path);
        return webview;
    } else {
        return undefined;
    }
});