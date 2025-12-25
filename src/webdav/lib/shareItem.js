import { AccountManager } from '/AccountManager.js';
import { BaseModal, MessageDialog } from '/BaseModal.js';


// 复制到剪贴板对话框
class ShareItemDialog extends BaseModal {
    render() {
        super.render();
        const text = this.getAttribute('text') || '';
        // 根据文本内容计算合适的尺寸
        const lineCount = (text.match(/\n/g) || []).length + 1;
        const maxLineLength = Math.max(...text.split('\n').map(line => line.length));
        
        // 动态计算高度和宽度
        const baseHeight = 250; // 基础高度
        const lineHeight = 20;  // 每行高度
        const baseWidth = 400;  // 基础宽度
        const charWidth = 8;    // 每个字符宽度
        
        const isMobile = BaseModal.isMobile();
        const width = isMobile ? '90vw' : Math.min(baseWidth + (maxLineLength * charWidth), 800) + 'px'; // 最大800px
        const height = isMobile ? '50vh' : Math.min(baseHeight + (lineCount * lineHeight), 600) + 'px'; // 最大600px

        const html = /*html*/`
            <div class="modal">
                <div class="modal-content" style="width: ${width}; height: ${height};">
                    <div class="header">
                        <h2>${this.getAttribute('title') || '复制内容'}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <label for="shareExpire">分享期限 (小时):</label>
                        <input type="number" id="shareExpire" min="1" max="87600" value="8760" style="margin-bottom: 15px;">
                        <textarea id="copyText" readonly>${text}</textarea>
                    </div>
                    <div class="button-group">
                        <button class="primary" id="copyBtn">复制到剪贴板</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    async setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const copyButton = this.shadowRoot.querySelector('#copyBtn');
        const textarea = this.shadowRoot.querySelector('#copyText');
        const shareExpireInput = this.shadowRoot.querySelector('#shareExpire');

        closeButton.addEventListener('click', () => this.close());
        
        // 更新分享链接函数
        const updateShareLink = async () => {
            if (!this.item) return;
            
            const protocol = window.location.protocol;
            const host = window.location.host;
            const expires = parseInt(shareExpireInput.value);
            const token = await AccountManager.CreateShareToken(expires);
            const url = protocol + "//" + host + this.item.path + "?token=" + token;
            textarea.value = url;
        };
        
        // 监听分享期限变化事件
        shareExpireInput.addEventListener('change', updateShareLink);
        
        copyButton.addEventListener('click', async () => {
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(textarea.value);
                } else {
                    textarea.select();
                    document.execCommand('copy');
                }
                MessageDialog.open({
                    title: '成功',
                    message: '内容已复制到剪贴板'
                });
                this.close();
            } catch (err) {
                console.error('复制失败:', err);
                MessageDialog.open({
                    title: '错误',
                    message: '复制失败，请重试'
                });
            }
        });
    }
}

export async function shareItem(item){
    const protocol = window.location.protocol;
    //获取当前域名
    const host = window.location.host;
    // 默认使用1年（8760小时）的分享期限
    const expires = 999999;
    const token = await AccountManager.CreateShareToken(expires);
    const url = protocol + "//" + host  + item.path + "?token=" + token;

    console.log("分享按钮点击",url);
    ShareItemDialog.open({
        title: `分享链接`,
        message: "",
        text: `${url}`,
        item: item
    });
}

// 注册分享对话框为自定义元素
customElements.define('share-item-dialog', ShareItemDialog);

// 导出 ShareItemDialog 类
export { ShareItemDialog };