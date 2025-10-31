import { BaseModal, MessageDialog } from '/BaseModal.js';
import { create_user_dav_config } from '/webdav/ServerAPI.js';
import { get_profile ,new_user ,changePassword  , saveProfile  } from '/DragonServerAPI.js';


// 密码模态框类
class PasswordModal extends BaseModal {
    render() {
        super.render();
        const html = /*html*/`
            <div class="modal" id="passwordModal">
                <div class="modal-content">
                    <h3>${this.getAttribute("username")}</h3>
                    <div class="form-group">
                        <label for="password">密码</label>
                        <input type="password" id="password" placeholder="请输入密码">
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">确认密码</label>
                        <input type="password" id="confirmPassword" placeholder="请再次输入密码">
                    </div>
                    <div class="button-group">
                        <button class="primary" id="nextPasswordBtn">注册</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const passwordModal = this.shadowRoot.querySelector('#passwordModal');
        const nextPasswordBtn = this.shadowRoot.querySelector('#nextPasswordBtn');

        nextPasswordBtn.addEventListener('click', () => {
            const password = this.shadowRoot.querySelector('#password').value;
            const confirmPassword = this.shadowRoot.querySelector('#confirmPassword').value;

            if (!password || !confirmPassword) {
                alert('请输入密码和确认密码');
                return;
            }

            if (password !== confirmPassword) {
                alert('两次输入的密码不一致，请重新输入');
                return;
            }

            this.close();
            this.dispatchEvent(new CustomEvent('done', { detail: { password } }));
        });
    }
}

customElements.define('password-modal', PasswordModal);
export {PasswordModal};


class ChangePasswordModal extends BaseModal {
    render() {
        super.render();
        const html = /*html*/`
            <div id="password-modal" class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h2>修改密码</h2>
                        <span class="close">&times;</span>
                    </div>
                    
                    
                    <div class="form-group">
                        <label>新密码</label>
                        <input type="password" id="new-password">
                    </div>
                    <div class="form-group">
                        <label>确认新密码</label>
                        <input type="password" id="confirm-password">
                    </div>
                    <div class="button-group">
                        <button id="submit-password-change" class="light_red flex_left">确认修改</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const passwordModal = this.shadowRoot.querySelector('#password-modal');
        const closeModal = this.shadowRoot.querySelector('.close');
        const submitPasswordChange = this.shadowRoot.querySelector('#submit-password-change');

        const close = () => {
            this.close();
        };

        closeModal.addEventListener('click', close);

        window.addEventListener('click', (event) => {
            if (event.target === passwordModal) {
                close();
            }
        });

        submitPasswordChange.addEventListener('click', async () => {
            const newPassword = this.shadowRoot.querySelector('#new-password').value;
            const confirmPassword = this.shadowRoot.querySelector('#confirm-password').value;

            if (newPassword !== confirmPassword) {
                alert('两次输入的密码不一致，请重新输入');
                return;
            }

            try {
                await changePassword(newPassword, this.getAttribute('username'));
                MessageDialog.open({message : '密码修改成功'});
                close();
            } catch (error) {
                console.error('密码修改失败:', error);
                alert('密码修改失败，请重试');
            }
        });
    }
}

customElements.define('change-password-modal', ChangePasswordModal);
export {ChangePasswordModal};

// 假设 BaseModal 已经在文件中导入
class EditDescriptionModal extends BaseModal {
    constructor() {
        super();
        // 基类可能已经处理了 shadowRoot，这里可以移除
        // this.attachShadow({ mode: 'open' }); 
    }

    connectedCallback() {
        // 可根据基类逻辑决定是否保留
    }

    async render() {
        super.render(); // 调用基类的 render 方法
        let profile = await get_profile(this.getAttribute('username'));
    

        const html = /*html*/`
            <div id="description-modal" class="modal">
                <div class="modal-content" style="width: 50vw; height: 50vh; ">
                    <div class="header">
                        <h2>编辑个人描述</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <textarea id="modal-description-input" placeholder="写点什么来介绍自己吧...">${profile.description}</textarea>
                    </div>
                    <div class="button-group">
                        <button id="save-description-button">保存描述</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const descriptionModal = this.shadowRoot.querySelector('#description-modal');
        const closeDescriptionModal = this.shadowRoot.querySelector('#description-modal .close');
        const saveDescriptionButton = this.shadowRoot.querySelector('#save-description-button');

        const closeModal = () => {
            this.close(); // 调用基类的 close 方法
        };

        closeDescriptionModal.addEventListener('click', closeModal);

        window.addEventListener('click', (event) => {
            if (event.target === descriptionModal) {
                closeModal();
            }
        });

        saveDescriptionButton.addEventListener('click', async () => {
            let username = this.getAttribute('username');
            let profile = await get_profile(username);  
            profile.description = this.shadowRoot.querySelector('#modal-description-input').value;
           
            try {
                await saveProfile(profile, username); // 确保使用 await
                this.setAttribute('description', profile.description);
                closeModal();
            } catch (error) {
                console.error('保存个人描述失败:', error);
            }
        });
    }

    // 显示模态框
    async show() {
        await this.render();
        this.setupEventListeners(); // 方法名与基类保持一致
        this.shadowRoot.querySelector('.modal').style.display = 'block';
    }
}

customElements.define('edit-description-modal', EditDescriptionModal);
export {EditDescriptionModal};


class ShowTokenModal extends BaseModal {
    render() {
        super.render();
        const html = /*html*/`
            <div id="token-modal" class="modal">
                <div class="modal-content" style="width: 50vw; height:30vh"> 
                    <div class="header">
                        <h2>用户令牌</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        <label for="token-textarea">复制key之后请妥善保存于安全易保存的地方,出于安全原因,您将无法再次查看到它</label>
                        <textarea id="token-textarea" readonly>${this.token}</textarea>
                    </div>
                    <div class="button-group">
                        <button id="copy-token-button">复制令牌</button>
                        <button id="close-token-modal">关闭</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const tokenModal = this.shadowRoot.querySelector('#token-modal');
        const closeTokenModal = this.shadowRoot.querySelector('#close-token-modal');
        const tokenModalCloseSpan = this.shadowRoot.querySelector('#token-modal .close');
        const copyTokenButton = this.shadowRoot.querySelector('#copy-token-button');
        const tokenTextarea = this.shadowRoot.querySelector('#token-textarea');

        const closeModal = () => {
            this.close();
        };

        closeTokenModal.addEventListener('click', closeModal);
        tokenModalCloseSpan.addEventListener('click', closeModal);

        copyTokenButton.addEventListener('click', async () => {
            if (tokenTextarea) {
                const token = tokenTextarea.value;
                try {
                    await navigator.clipboard.writeText(token);
                    console.log('令牌已复制到剪贴板');
                } catch (err) {
                    console.error('复制失败:', err);
                }
            }
        });

        window.addEventListener('click', (event) => {
            if (event.target === tokenModal) {
                closeModal();
            }
        });
    }

    // 显示模态框的方法
    showToken(token) {
        this.token = token;
        this.show();
    }
}

customElements.define('show-token-modal', ShowTokenModal);
export { ShowTokenModal };