// 基类 BaseModal
export class BaseModal extends HTMLElement {
    // 用于存储所有打开的模态框实例
    static openModals = [];

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    static isMobile(){
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768) {
            return true;
        } else {
            return false;
        }
    }
    connectedCallback() {
        // this.render();
        // this.setupEventListeners();
    }

    render() {
        const style = /*css*/`
            <style>
                :host {
                    display: flex;
                    align-items: center;
                    padding: 4px 12px;
                    background: var(--bg-secondary,#f2f3f5);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.2s;
                    gap: 8px;
                    margin-right: auto;
                }
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    z-index: 1000;
                }
                .modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: var(--bg-secondary,#f2f3f5);
                    padding: 20px;
                    
                    border: 1px solid #888;
                    border-radius: 8px;
                    width: ${BaseModal.isMobile() ? '90%' : '400px'};
                    max-width: 500px;
                    display: flex; /* 添加弹性布局 */
                    flex-direction: column; /* 垂直排列 */
                }
                .form-group {
                    display: flex; 
                    flex-direction: column; 
                    flex-grow: 1;
                    margin-bottom: 15px;
                    flex-grow: 1; /* 占满剩余空间 */
                    overflow-y: hidden; /* 内容过多时显示滚动条 */
                }
                .button-group {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: auto; /* 固定在底部 */
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .header h2 {
                    margin: 0;
                }
                h2 {
                    color: var(--text-primary,#2e3338);
                }
                p {
                    color: var(--text-primary,#2e3338);
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    color: var(--text-primary,#2e3338);
                }
                input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: var(--input-bg);
                    color: var(--text-primary,#2e3338);
                    box-sizing: border-box;
                }
                .checkbox-group {
                    margin: 10px 0;
                }
                .checkbox-group label {
                    display: inline-flex; /* 修改为行内弹性布局 */
                    align-items: center; /* 垂直居中对齐 */
                    gap: 4px; /* 添加间距 */
                }
                .checkbox-group input[type="checkbox"] {
                    width: auto; /* 恢复复选框原始宽度 */
                    margin: 0; /* 移除默认外边距 */
                }
                
                textarea {
                    width: 100%;
                    height: 100%;
                    padding: 1rem;
                    border: 1px solid #ccc;
                    border-radius: 0.375rem;
                    box-sizing: border-box;
                    resize: none; /* 允许垂直调整大小 */
                    font-family: inherit;
                    font-size: inherit;
                    overflow-y: auto; /* 内容超出时显示垂直滚动条，未超出则不显示 */
                }

                .button-group {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end; /* 按钮靠右对齐 */
                }
                .flex_left {
                    justify-content: flex-start; /* 按钮靠左对齐 */ 
                }
                .flex_center {
                    justify-content: center; /* 按钮居中对齐 */
                }
                .flex_right {
                    justify-content: flex-end; /* 按钮靠右对齐 */ 
                }
                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                    color: white;
                    background-color: #2196F3;
                    font-weight: 500;
                }

                button:hover {
                    background-color: #1976D2; /* 悬停颜色 */
                }

                .secondary {
                    background: var(--danger-color,#da373c);
                    color: white;
                }
                .primary {
                    background: var(--success-color,#23a559);
                    color: white;
                }
                .red {
                    background: rgba(221, 55, 61, 0.93);
                    color: white;
                }
                .green {
                    background: rgba(35, 165, 89, 0.93);
                    color: white; 
                }
                .blue {
                    background: rgba(55, 125, 221, 0.93);
                    color: white;
                }
                .light_blue {
                    background: rgba(55, 221, 205, 0.93);
                    color: white;
                }
                .light_green {
                    background: rgba(125, 221, 55, 0.93);
                    color: white;
                }
               .light_red {
                    background: rgba(243, 111, 111, 0.93);
                    color: white;
                }
                .close {
                    color: #aaa;
                    float: right;
                    font-size: 2.5rem;
                    font-weight: bold;
                    line-height: 1; /* 调整行高 */
                    transition: color 0.3s ease;
                }

                .close:hover,
                .close:focus {
                    color: black;
                    text-decoration: none;
                    cursor: pointer;
                }
            </style>
        `;
        this.shadowRoot.innerHTML = style;
    }

    setupEventListeners() {
        // 子类实现具体逻辑
    }

    show() {
        this.render();
        this.setupEventListeners();
        const modal = this.shadowRoot.querySelector('.modal')
        if (modal){
            modal.style.display = 'block';
        }
        
    }

    close() {
        const modal = this.shadowRoot.querySelector('.modal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        this.remove();
        this.dispatchEvent(new Event('close'));
        // 关闭模态框时从列表中移除实例
        const index = BaseModal.openModals.indexOf(this);
        if (index > -1) {
            BaseModal.openModals.splice(index, 1);
        }
        
    }

    // 将 open 方法移到基类
    static open(attributes = {}) {
        const modal = new this();
        for (const [key, value] of Object.entries(attributes)) {
            if (typeof value === 'string') {
                modal.setAttribute(key, value);
            }else{
                modal[key] = value;
            }
        }
        
        document.body.appendChild(modal);
        modal.show();
        BaseModal.openModals.push(modal);
        return modal;
    }

    // 静态关闭方法
    static close() {
        // 复制列表以避免在循环中修改原列表
        const modalsToClose = [...this.openModals];
        modalsToClose.forEach(modal => modal.close());
    }
}

// 消息对话框
class MessageDialog extends BaseModal {
    render() {
        super.render();
        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h2>${this.getAttribute('title') || '消息'}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <p>${this.getAttribute('message') || ''}</p>
                    </div>
                    <div class="button-group">
                        <button class="primary" id="confirmBtn">${this.getAttribute('btn_text') || "确定"}</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const confirmButton = this.shadowRoot.querySelector('#confirmBtn');

        closeButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('confirm'));
            this.close()
        });
        confirmButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('confirm'));
            this.close();
        });
    }
}

customElements.define('message-dialog', MessageDialog);
export { MessageDialog };
// 确认对话框
class ConfirmDialog extends BaseModal {
    render() {
        super.render();
        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h2>${this.getAttribute('title') || '确认'}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <p>${this.getAttribute('message') || '你确定要执行此操作吗？'}</p>
                    </div>
                    <div class="button-group">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="confirmBtn">确认</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const cancelButton = this.shadowRoot.querySelector('#cancelBtn');
        const confirmButton = this.shadowRoot.querySelector('#confirmBtn');

        closeButton.addEventListener('click', () => this.close());
        cancelButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('cancel'));
            this.close();
        });
        confirmButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('confirm'));
            this.close();
        });
    }
}

customElements.define('confirm-dialog', ConfirmDialog);
export { ConfirmDialog };
// 输入对话框
class InputDialog extends BaseModal {
    render() {
        super.render();
        // 获取 message 属性值并将 \n 替换为 <br> 标签
        const message = (this.getAttribute('message') || '请输入内容').replace(/\n/g, '<br>');
        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h2>${this.getAttribute('title') || '输入'}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <p>${message}</p>
                        <input 
                            type="text" 
                            id="inputField"
                            value="${this.getAttribute('defaultValue') || ''}"
                            placeholder="${this.getAttribute('placeholder') || ''}"
                        >
                    </div>
                    <div class="button-group">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="confirmBtn">确认</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const cancelButton = this.shadowRoot.querySelector('#cancelBtn');
        const confirmButton = this.shadowRoot.querySelector('#confirmBtn');
        const inputField = this.shadowRoot.querySelector('#inputField');

        closeButton.addEventListener('click', () => this.close());
        cancelButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('cancel'));
            this.close();
        });
        confirmButton.addEventListener('click', () => {
            const inputValue = inputField.value;
            const confirmEvent = new CustomEvent('confirm', {
                detail: { value: inputValue }
            });
            this.dispatchEvent(confirmEvent);
            this.close();
        });
        
        // 添加回车键响应
        inputField.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                confirmButton.click();
            }
        });
    }
}

customElements.define('input-dialog', InputDialog);
export { InputDialog };
// 登录对话框
class LoginDialog extends BaseModal {
    render() {
        super.render();
        const showRegisterButton = this.hasAttribute('goRegister');
        const LoginGuest = this.hasAttribute('LoginGuest');
        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header" style="justify-content: center;">
                        <h2>${this.getAttribute('title') || '登录'}</h2>
                    </div>
                    <div class="form-group">
                        <label for="username">用户名:</label>
                        <input 
                            type="text" 
                            id="username"
                            value="${this.getAttribute('defaultUsername') || ''}"
                            placeholder="请输入用户名"
                        >
                        <label for="password">密码:</label>
                        <input 
                            type="password" 
                            id="password"
                            placeholder="请输入密码"
                        >
                    </div>
                    <div class="button-group" style="justify-content: center;">
                        <button class="primary" id="loginBtn">登录</button>
                        ${showRegisterButton ? '<button class="secondary" id="goRegisterBtn">去注册</button>' : ''}
                        ${LoginGuest ? '<button class="red" id="guestLoginBtn">游客登录</button>' : ''}
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const loginButton = this.shadowRoot.querySelector('#loginBtn');
        const usernameInput = this.shadowRoot.querySelector('#username');
        const passwordInput = this.shadowRoot.querySelector('#password');
        
        loginButton.addEventListener('click', () => {
            const username = usernameInput.value;
            const password = passwordInput.value;
            const loginEvent = new CustomEvent('login', {
                detail: { username, password }
            });
            this.dispatchEvent(loginEvent);
        });

        if (this.hasAttribute('goRegister')) {
            const goRegisterButton = this.shadowRoot.querySelector('#goRegisterBtn');
            goRegisterButton.addEventListener('click', () => {
                RegisterDialog.open().addEventListener('register', (event) => {     
                    const { username, password } = event.detail;
                    usernameInput.value = username;
                    passwordInput.value = password;
                   })
            });
        }
        if (this.hasAttribute('LoginGuest')) {
            const LoginGuest = this.getAttribute('LoginGuest');
            const guestLoginButton = this.shadowRoot.querySelector('#guestLoginBtn');
            guestLoginButton.addEventListener('click', () => {
                const username = LoginGuest;
                const password = LoginGuest;
                const loginEvent = new CustomEvent('login', {
                    detail: { username, password }
                });
                this.dispatchEvent(loginEvent);
            });
        }
    }
}

customElements.define('login-dialog', LoginDialog);
export { LoginDialog };

// 注册对话框
class RegisterDialog extends BaseModal {
    render() {
        super.render();
        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h2>${this.getAttribute('title') || '注册'}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <label for="username">用户名:</label>
                        <input 
                            type="text" 
                            id="username"
                            value=""
                            placeholder="请输入用户名"
                        >
                        <label for="password">密码:</label>
                        <input 
                            type="password" 
                            id="password"
                            placeholder="请输入密码"
                        >
                        <label for="confirmPassword">确认密码:</label>
                        <input 
                            type="password" 
                            id="confirmPassword"
                            placeholder="请再次输入密码"
                        >
                    </div>
                    <div class="button-group" style="justify-content: center;">
                        <button class="primary" id="registerBtn">注册</button>
                        <button class="secondary" id="cancelBtn">取消</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const cancelButton = this.shadowRoot.querySelector('#cancelBtn');
        const registerButton = this.shadowRoot.querySelector('#registerBtn');
        const usernameInput = this.shadowRoot.querySelector('#username');
        const passwordInput = this.shadowRoot.querySelector('#password');
        const confirmPasswordInput = this.shadowRoot.querySelector('#confirmPassword');

        closeButton.addEventListener('click', () => this.close());
        cancelButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('cancel'));
            this.close();
        });
        registerButton.addEventListener('click', () => {
            const username = usernameInput.value;
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (password !== confirmPassword) {
                MessageDialog.open({
                    title: '错误',
                    message: '两次输入的密码不一致，请重新输入。'
                });
                return;
            }

            const registerEvent = new CustomEvent('register', {
                detail: { username, password }
            });
            this.dispatchEvent(registerEvent);
            this.close();
        });
    }
}

customElements.define('register-dialog', RegisterDialog);
export { RegisterDialog };

class TextAreaDialog extends BaseModal {
    render() {
        super.render();
        // 获取 message 属性值并将 \n 替换为 <br> 标签
        let message = this.getAttribute('message');
        if (message) {
            message = message.replace(/\n/g, '<br>');
            message = `
                <p>
                    ${message}
                </p>
            `;
        }
        else {
            message = '';
        }
        let title = this.getAttribute('title');
        if (title) {
            title = `
                <h2>
                    ${title}
                </h2>
            `;
        }
        else {
            title = '';
        }
        let placeholder = this.getAttribute('placeholder');
        if (placeholder) {
        }else{
            placeholder = '';
        }

        let defaultValue = this.getAttribute('defaultValue');
        if (defaultValue) {
        }else{
            defaultValue = '';
        }

        let value = this.getAttribute('value');
        if (value) {
        }else{
            value = '';
        }
        let width = this.getAttribute('width') || '50%';
        let height = this.getAttribute('height') || '50%';
        const isMobile = BaseModal.isMobile();
        if (isMobile) {
          width = '90%';
          height = '50%';
        }
        
        const html = /*html*/`
            <div class="modal">
                <div class="modal-content" style="width: ${width}; height: ${height}; max-width: 500px;">
                    <div class="header">
                        ${title}
                        <span class="close">&times;</span>
                    </div>
                     <div class="form-group">
                        ${message}
                        <textarea id="textareaField" placeholder="${placeholder}" >${defaultValue}${value}</textarea>
                    </div>
                    <div class="button-group">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="confirmBtn">确认</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const cancelButton = this.shadowRoot.querySelector('#cancelBtn');
        const confirmButton = this.shadowRoot.querySelector('#confirmBtn');
        const textareaField = this.shadowRoot.querySelector('#textareaField');

        closeButton.addEventListener('click', () => this.close());
        cancelButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('cancel'));
            this.close();
        });
        confirmButton.addEventListener('click', () => {
            const inputValue = textareaField.value;
            const confirmEvent = new CustomEvent('confirm', {
                detail: { value: inputValue }
            });
            this.dispatchEvent(confirmEvent);
            this.close();
        });
    }
}

customElements.define('textarea-dialog', TextAreaDialog);
export { TextAreaDialog };

// 复选框对话框
class CheckBoxDialog extends BaseModal {
    render() {
        super.render();
        const title = this.getAttribute('title') || '选择';
        const message = this.getAttribute('message') || '请选择选项';
        const options = JSON.parse(this.getAttribute('options') || '[]');
        const selected = JSON.parse(this.getAttribute('selected') || '[]');

        const optionsHtml = options.map(option => `
            <div class="checkbox-group">
                <label>
                    <input 
                        type="checkbox" 
                        value="${option.value || option}" 
                        ${selected.includes(option.value || option) ? 'checked' : ''}
                    >
                    ${option.label || option}
                </label>
            </div>
        `).join('');

        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h2>${title}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <p>${message}</p>
                        ${optionsHtml}
                    </div>
                    <div class="button-group">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="confirmBtn">确认</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const cancelButton = this.shadowRoot.querySelector('#cancelBtn');
        const confirmButton = this.shadowRoot.querySelector('#confirmBtn');
        const checkboxes = this.shadowRoot.querySelectorAll('input[type="checkbox"]');

        closeButton.addEventListener('click', () => this.close());
        cancelButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('cancel'));
            this.close();
        });
        confirmButton.addEventListener('click', () => {
            const selectedValues = Array.from(checkboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => checkbox.value);
            
            const confirmEvent = new CustomEvent('confirm', {
                detail: { selected: selectedValues }
            });
            this.dispatchEvent(confirmEvent);
            this.close();
        });
    }
}

customElements.define('checkbox-dialog', CheckBoxDialog);
export { CheckBoxDialog };

// 文件选择对话框
class FileSelectDialog extends BaseModal {

    constructor() {
        super();
    }
    render() {
        this.shadowRoot.innerHTML += /*html*/`
            <div class="modal">
                <input 
                    type="file" 
                    id="fileInput"
                    style="display: none;"
                    ${this.hasAttribute('multiple') ? 'multiple' : ''}
                    ${this.getAttribute('accept') ? `accept="${this.getAttribute('accept')}"` : ''}
                >
            </div>
        `;
        
    }
    
    setupEventListeners() {
        const fileInput = this.shadowRoot.querySelector('#fileInput');
        
        fileInput.click();
        fileInput.addEventListener('change', () => {
            const files = fileInput.files;
            const confirmEvent = new CustomEvent('confirm', {
                detail: { files }
            });
            this.dispatchEvent(confirmEvent);
            this.close();
        });
        
    }

}

customElements.define('file-select-dialog', FileSelectDialog);
export { FileSelectDialog };


// 复制到剪贴板对话框
class CopyToClipboardDialog extends BaseModal {
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
                        <p>${this.getAttribute('message') || ''}</p>
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

        closeButton.addEventListener('click', () => this.close());
        
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

customElements.define('copy-dialog', CopyToClipboardDialog);
export { CopyToClipboardDialog };

// 下载进度条模态框
class ProgressModal extends BaseModal {
    render() {
        this.canCancel = this.hasAttribute('cancel');
        this.title = this.getAttribute('title') || undefined;
        this.onCancel = null;
        const html = /*html*/`
            <style>
                :host {
                    display: block;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    z-index: 1000;
                }
                .download-progress-container {
                    width: 100%;
                    background-color: rgba(0, 0, 0, 0.7);
                    padding: 10px;
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                }
                .download-progress-bar {
                    flex: 1;
                    height: 8px;
                    background-color: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 0 10px;
                }
                .download-progress-fill {
                    height: 100%;
                    background-color: #4CAF50;
                    width: 0%;
                    transition: width 0.3s ease;
                }
                .download-progress-text {
                    color: white;
                    font-size: 14px;
                    white-space: nowrap;
                }
                .download-progress-percentage {
                    color: white;
                    font-size: 14px;
                    min-width: 40px;
                    text-align: right;
                }
                .download-cancel-btn {
                    background-color: #f44336;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-left: 10px;
                }
                .download-cancel-btn:hover {
                    background-color: #d32f2f;
                }
            </style>
            <div class="download-progress-container">
                ${this.title ? `<span class="download-progress-text">${this.title}</span>` : ''}
                
                <div class="download-progress-bar">
                    <div class="download-progress-fill"></div>
                </div>
                <span class="download-progress-percentage">0%</span>
                ${this.canCancel ? '<button class="download-cancel-btn">取消</button>' : ''}
            </div>
        `;
        this.shadowRoot.innerHTML = html;

        // 获取元素引用
        this.progressContainer = this.shadowRoot.querySelector('.download-progress-container');
        this.progressFill = this.shadowRoot.querySelector('.download-progress-fill');
        this.progressText = this.shadowRoot.querySelector('.download-progress-text');
        this.progressPercentage = this.shadowRoot.querySelector('.download-progress-percentage');
        this.cancelBtn = this.shadowRoot.querySelector('.download-cancel-btn');
            
        if (this.canCancel) {
            // 设置取消按钮事件
            this.cancelBtn.addEventListener('click', () => {
                this.hide();
                if (this.onCancel && typeof this.onCancel === 'function') {
                    this.onCancel();
                }
            });
        }
    }

    // 更新进度
    updateProgress(percentage, text) {
        if (percentage !== undefined && percentage >= 0 && percentage <= 100) {
            this.progressFill.style.width = `${percentage}%`;
            this.progressPercentage.textContent = `${Math.round(percentage)}%`;
        }
        if (text) {
            this.progressText.textContent = text;
        }
    }

    // 显示进度条
    show() {
        this.render();
        this.style.display = 'block';
        this.progressContainer.style.display = 'flex';
    }

    // 隐藏进度条
    hide() {
        this.style.display = 'none';
        this.progressContainer.style.display = 'none';
    }

    // 设置取消回调
    setCancelCallback(callback) {
        this.onCancel = callback;
    }

    // 销毁实例
    destroy() {
        this.remove();
    }
}

customElements.define('download-progress', ProgressModal);
export { ProgressModal  };

// URL内容模态框
class UrlModal extends BaseModal {
    render() {
        super.render();
        // 获取宽高属性，如果没有则使用默认值
        const width = this.getAttribute('width') || (BaseModal.isMobile() ? '95%' : '80%');
        const height = this.getAttribute('height') || '90vh';
        const html = /*html*/`
            <style>
                .modal-content {
                    padding: 0px !important;
                    margin: 0px !important;
                }
                .close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 30px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1001;
                    transition: all 0.3s ease;
                }
                .close:hover,
                .close:focus {
                    color: #fff;
                    background-color: rgba(0, 0, 0, 0.8);
                    transform: scale(1.1);
                    text-decoration: none;
                    cursor: pointer;
                }
                .form-group {
                    margin: 0 !important;
                    padding: 0 !important;
                    height: 100% !important;
                }
                #modalIframe {
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                }
            </style>
            <div class="modal" id="modal">
                <div class="modal-content" style="width: ${width}; height: ${height}; max-width: none; max-height: none; overflow: hidden;">
                    <span class="close">&times;</span>
                    <div class="form-group">
                        <iframe id="modalIframe" 
                            src="${this.getAttribute('url') || ''}">
                        </iframe>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const modal = this.shadowRoot.querySelector('.modal');

        closeButton.addEventListener('click', () => this.close());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.close();
            }
        });
    }

    show() {
        super.show();
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    close() {
        super.close();
        document.body.style.overflow = 'auto'; // 恢复背景滚动
    }
}

customElements.define('url-modal', UrlModal);
export { UrlModal };

export class HTMLElementModal extends BaseModal {
    render() {
        super.render();
        // 获取宽高属性，如果没有则使用默认值
        const width = this.getAttribute('width') || (BaseModal.isMobile() ? '95%' : '80%');
        const height = this.getAttribute('height') || '90vh';
        const html = /*html*/`
            <style>
                .modal-content {
                    padding: 0px !important;
                    margin: 0px !important;
                }
                .close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 30px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1001;
                    transition: all 0.3s ease;
                }
                .close:hover,
                .close:focus {
                    color: #fff;
                    background-color: rgba(0, 0, 0, 0.8);
                    transform: scale(1.1);
                    text-decoration: none;
                    cursor: pointer;
                }
                .form-group {
                    margin: 0 !important;
                    padding: 0 !important;
                    height: 100% !important;
                }
                #modalIframe {
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                }
            </style>
            <div class="modal" id="modal">
                <div class="modal-content" style="width: ${width}; height: ${height}; max-width: none; max-height: none; overflow: hidden;">
                    <span class="close">&times;</span>
                    <div class="form-group" id="modalIframeContainer">
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
        const iframeContainer = this.shadowRoot.querySelector('#modalIframeContainer');
        iframeContainer.replaceChildren(this.html);
    }
    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const modal = this.shadowRoot.querySelector('.modal');

        closeButton.addEventListener('click', () => this.close());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.close();
            }
        });
    }

    show() {
        super.show();
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    close() {
        super.close();
        document.body.style.overflow = 'auto'; // 恢复背景滚动
    }
}
customElements.define('html-modal', HTMLElementModal);

export class HTMLStringModal extends HTMLElementModal {
    render() {
        super.render();
        // 获取宽高属性，如果没有则使用默认值
        const width = this.getAttribute('width') || (BaseModal.isMobile() ? '95%' : '80%');
        const height = this.getAttribute('height') || '90vh';
        const html = /*html*/`
            <style>
                .modal-content {
                    padding: 0px !important;
                    margin: 0px !important;
                }
                .close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 30px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1001;
                    transition: all 0.3s ease;
                }
                .close:hover,
                .close:focus {
                    color: #fff;
                    background-color: rgba(0, 0, 0, 0.8);
                    transform: scale(1.1);
                    text-decoration: none;
                    cursor: pointer;
                }
                .form-group {
                    margin: 0 !important;
                    padding: 0 !important;
                    height: 100% !important;
                }
                #modalIframe {
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                }
            </style>
            <div class="modal" id="modal">
                <div class="modal-content" style="width: ${width}; height: ${height}; max-width: none; max-height: none; overflow: hidden;">
                    <span class="close">&times;</span>
                    <div class="form-group" id="modalIframeContainer">
                        <iframe id="modalIframe" src="${this.html}" style="width: 100%; height: 100%; border: none;"></iframe>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }
    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const modal = this.shadowRoot.querySelector('.modal');

        closeButton.addEventListener('click', () => this.close());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.close();
            }
        });
    }

    show() {
        super.show();
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    close() {
        super.close();
        document.body.style.overflow = 'auto'; // 恢复背景滚动
    }
}
customElements.define('html-string-modal', HTMLStringModal);



// 图片查看模态框
class ImageModal extends BaseModal {
    render() {
        super.render();
        // 获取宽高属性，如果没有则使用默认值
        const width = this.getAttribute('width') || (BaseModal.isMobile() ? '95%' : '80%');
        const height = this.getAttribute('height') || '90vh';
        const imageUrl = this.getAttribute('url') || '';
        const imageTitle = this.getAttribute('title') || undefined;
        const html = /*html*/`
            <style>
                .modal-content {
                    padding: 0px !important;
                    margin: 0px !important;
                    background-color: #000 !important;
                }
                .close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 30px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1001;
                    transition: all 0.3s ease;
                }
                .close:hover,
                .close:focus {
                    color: #fff;
                    background-color: rgba(0, 0, 0, 0.8);
                    transform: scale(1.1);
                    text-decoration: none;
                    cursor: pointer;
                }
                .form-group {
                    margin: 0 !important;
                    padding: 0 !important;
                    height: 100% !important;
                    display: flex;
                    flex-direction: column;
                }
                .image-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .image-title {
                    position: absolute;
                    top: 10px;
                    left: 15px;
                    color: #fff;
                    font-size: 18px;
                    font-weight: bold;
                    background-color: rgba(0, 0, 0, 0.5);
                    padding: 5px 15px;
                    border-radius: 20px;
                    z-index: 1001;
                }
            </style>
            <div class="modal" id="modal">
                <div class="modal-content" style="width: ${width}; height: ${height}; max-width: none; max-height: none; overflow: hidden;">
                    ${imageTitle ? `<div class="image-title">${imageTitle}</div>` : ''}
                    <span class="close">&times;</span>
                    <div class="form-group">
                        <div class="image-container">
                            <img src="${imageUrl}" alt="${imageTitle || '图片'}">
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const modal = this.shadowRoot.querySelector('.modal');

        closeButton.addEventListener('click', () => {
            this.close();
        });
        
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.close();
            }
        });
    }

    show() {
        super.show();
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    close() {
        super.close();
        document.body.style.overflow = 'auto'; // 恢复背景滚动
    }
}

customElements.define('image-modal', ImageModal);
export { ImageModal };
