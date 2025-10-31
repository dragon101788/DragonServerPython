//UserProfile.js






class UserProfile extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this._avatar = this.shadowRoot.querySelector('#avatar');
    }

    render() {
        const style = /*css*/`
            <style>
                :host {
                    /*从全局继承CSS变量*/
                    --modal-bg: var(--ac-modal-bg, rgba(0, 0, 0, 0.5));
                    --content-bg: var(--ac-content-bg, #2b2d31);
                    --text-color: var(--text-primary, #ffffff);
                    --text-secondary: var(--text-secondary, #949ba4);
                    --accent-color: var(--accent-color, #5865f2);
                    --danger-color: var(--danger-color, #da373c);
                    --input-bg: var(--ac-input-bg, #1e1f22);
                }

                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: var(--modal-bg);
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: var(--content-bg);
                    padding: 24px;
                    border-radius: 8px;
                    width: 400px;
                    max-width: 90vw; /*添加最大宽度，防止在小屏幕上溢出*/
                    color: var(--text-color);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    box-sizing: border-box; /*确保padding计入总宽度*/
                }

                .modal-content::-webkit-scrollbar {
                    width: 8px;
                }

                .modal-content::-webkit-scrollbar-track {
                    background: transparent;
                }

                .modal-content::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }

                .modal-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .profile-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .avatar-container {
                    position: relative;
                    width: 128px;
                    height: 128px;
                    margin: 0 auto 16px;
                }

                .avatar {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                    background-color: var(--input-bg);
                }

                .avatar-upload {
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    background: var(--accent-color);
                    border-radius: 50%;
                    padding: 8px;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    color: white;
                    transition: background-color 0.2s;
                }

                .avatar-upload:hover {
                    background: var(--accent-hover, #4752c4);
                }

                .form-group {
                    margin-bottom: 16px;
                    width: 100%;
                    box-sizing: border-box; /*确保padding计入总宽度*/
                }

                label {
                    display: block;
                    margin-bottom: 8px;
                    color: var(--text-secondary);
                    font-size: 14px;
                    font-weight: 500;
                }

                input, textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 4px;
                    background: var(--input-bg);
                    color: var(--text-color);
                    margin-bottom: 8px;
                    box-sizing: border-box; /*关键修复：确保padding和border计入输入框总宽度*/
                }
                input {
                    margin-bottom: 12px;
                }

                input:last-of-type {
                    margin-bottom: 4px;
                }

                input:focus, textarea:focus {
                    outline: none;
                    border-color: var(--accent-color);
                }

                textarea {
                    resize: vertical;
                    min-height: 100px;
                    max-width: 100%; /*防止textarea超出容器*/
                }
    

                button {
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.2s ease;
                    min-width: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                
                .primary {
                    background: var(--accent-color);
                    color: var(--text-color);
                    border: none;
                }
                
                .primary:hover {
                    background: var(--accent-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                }
                
                .secondary {
                    background: transparent;
                    color: var(--text-color);
                    border: 2px solid var(--accent-color);
                }
                
                .secondary:hover {
                    background: rgba(88, 101, 242, 0.1);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                }
                
                .buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;  /*增加按钮间距*/
                    margin-top: 24px;
                }
                
                /*响应式设计中的按钮样式*/
                @media (max-width: 480px) {
                    .buttons {
                        flex-direction: column;
                        gap: 8px;
                    }
                
                    button {
                        width: 100%;
                        padding: 12px 20px;  /*在移动端增加按钮高度*/
                    }
                }

                .error {
                    color: var(--danger-color);
                    font-size: 14px;
                    margin-top: 4px;
                    min-height: 20px;
                }
                
                .tabs {
                    display: flex;
                    margin-bottom: 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
        
                .tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    color: var(--text-secondary);
                    position: relative;
                }
        
                .tab.active {
                    color: var(--text-color);
                }
        
                .tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: var(--accent-color);
                }
        
                .tab-content {
                    display: none;
                }
        
                .tab-content.active {
                    display: block;
                }
        
                /*优化头像点击区域样式*/
                .avatar-container {
                    cursor: pointer;
                }

                /*响应式设计*/
                @media (max-width: 480px) {
                    .modal-content {
                        width: 95vw;
                        padding: 16px;
                    }

                    .avatar-container {
                        width: 96px;
                        height: 96px;
                    }

                    .buttons {
                        flex-direction: column;
                    }

                    button {
                        width: 100%;
                    }
                }

                /*动画效果*/
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .modal {
                    animation: fadeIn 0.2s ease-out;
                }
            </style>
        `;


        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="tabs">
                        <div class="tab active" data-tab="profile">个人资料</div>
                        <div class="tab" data-tab="password">修改密码</div>
                    </div>

                    <!-- 个人资料标签页 -->
                    <div class="tab-content active" data-content="profile">
                        <div class="profile-header">
                            <div class="avatar-container" id="avatarContainer">
                                 <avatar-component id="avatar" class="avatar"></avatar-component>
                                <input type="file" id="avatarInput" hidden accept="image/*">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>昵称</label>
                            <input type="text" id="nickname" placeholder="请输入昵称">
                        </div>

                        <div class="form-group">
                            <label>个人描述</label>
                            <textarea id="description" placeholder="写点什么来介绍自己吧..."></textarea>
                        </div>

                        <div class="buttons">
                            <button class="secondary" id="profileCancelBtn">取消</button>
                            <button class="primary" id="saveProfileBtn">保存</button>
                        </div>
                    </div>

                    <!-- 修改密码标签页 -->
                    <div class="tab-content" data-content="password">
                        <div class="form-group">
                            <label>新密码</label>
                            <input type="password" id="newPassword" placeholder="请输入新密码">
                        </div>

                        <div class="form-group">
                            <label>确认密码</label>
                            <input type="password" id="confirmPassword" placeholder="请再次输入新密码">
                            <div id="passwordError" class="error"></div>
                        </div>

                        <div class="buttons">
                            <button class="secondary" id="passwordCancelBtn">取消</button>
                            <button class="primary" id="changePasswordBtn">修改密码</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = style + html;
    }


    // 修改事件监听设置
    setupEventListeners() {
        const tabs = this.shadowRoot.querySelectorAll('.tab');
        const avatarInput = this.shadowRoot.querySelector('#avatarInput');
        const avatarContainer = this.shadowRoot.querySelector('#avatarContainer');

        // 标签页切换
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // // 模态框点击关闭
        // modal.addEventListener('click', (e) => {
        //     if (e.target === modal) this.close();
        // });

        // 头像上传
        avatarContainer.addEventListener('click', () => {
            avatarInput.click();
        });
        avatarInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.uploadAvatar(e.target.files[0]);

            }
        });

        // 个人资料页面按钮
        this.shadowRoot.querySelector('#profileCancelBtn').addEventListener('click', () => this.close());
        this.shadowRoot.querySelector('#saveProfileBtn').addEventListener('click', () => this.saveProfile());

        // 修改密码页面按钮
        this.shadowRoot.querySelector('#passwordCancelBtn').addEventListener('click', () => this.close());
        this.shadowRoot.querySelector('#changePasswordBtn').addEventListener('click', () => this.changePassword());
    }
    switchTab(tabName) {
        // 更新标签页状态
        const tabs = this.shadowRoot.querySelectorAll('.tab');
        const contents = this.shadowRoot.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        contents.forEach(content => {
            content.classList.toggle('active', content.dataset.content === tabName);
        });
    }

    async uploadAvatar(file) {
        
    
        try {
            uploadAvatar(file);
            all_user_flush_cache();
    
            const username = this.getAttribute('username');
            const nickname = this.getAttribute('nickname');  // 修正拼写错误，将 nikename 改为 nickname

            // 头像缓存路径
            const avatarCachePath = `${username}/avatar`;

            // 清除头像缓存
            await cacheManager.removeCache(avatarCachePath);

            // 更新个人设置中的头像
            await this._avatar.update( username, nickname);

            // 更新 toolbar 中的头像
            const userInfoTitle = document.querySelector('#userInfoTitle');
            
        } catch (error) {
            console.error('上传头像失败：', error);
            alert('上传头像失败');
        }
    }


    async loadProfile() {
        try {
            // 这里使用不带username的调用，因为是加载自己的资料
            const data = await fetchUserProfile(this.getAttribute('username'));
            this.shadowRoot.querySelector('#nickname').value = data.nickname || '没有';
            this.shadowRoot.querySelector('#description').value = data.description || '没有';
        } catch (error) {
            console.error('加载个人信息失败：', error);
        }
    }


    async saveProfile() {
        const profileData = {
            nickname: this.shadowRoot.querySelector('#nickname').value || '',
            description: this.shadowRoot.querySelector('#description').value || ''
        };
        
        try {
            await saveProfile(profileData);
            await all_user_flush_cache();
            // 发送自定义事件通知昵称更新
                const event = new CustomEvent('nickname-updated', {
                    detail: { nickname: profileData.nickname },
                    bubbles: true,
                    composed: true
                });
                this.dispatchEvent(event);
                alert('保存成功');
                
                this.close();
            
        } catch (error) {
            console.error('保存个人信息失败：', error);
            alert(`保存失败 ${error}`);
        }
    }

    async changePassword() {
        const newPassword = this.shadowRoot.querySelector('#newPassword').value;
        const confirmPassword = this.shadowRoot.querySelector('#confirmPassword').value;
        const passwordError = this.shadowRoot.querySelector('#passwordError');

        // 验证密码
        if (newPassword !== confirmPassword) {
            passwordError.textContent = '新密码与确认密码不匹配';
            return;
        }

        if (!newPassword) {
            passwordError.textContent = '请输入新密码';
            return;
        }
        try {
            
            await changePassword(newPassword);
            
            alert('密码修改成功');
            
            this.close();
            
        } catch (error) {
            console.error('修改密码失败：', error);
            passwordError.textContent = '修改密码失败';
        }
    }

    async show() {
        this.shadowRoot.querySelector('.modal').style.display = 'block';
        await this.loadProfile();
    }
 
    static get observedAttributes() {
        return [ 'username', 'nickname'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            
            if (name === 'username' && newValue) {
                this.username = newValue;
            }
            if (name === 'nickname' && newValue) {
                this.nickname = newValue;
            }
        }

    }

    close() {
        this.shadowRoot.querySelector('.modal').style.display = 'none';

        // 清空所有输入框
        const inputs = {
            // 个人资料页面
            nickname: this.shadowRoot.querySelector('#nickname'),
            description: this.shadowRoot.querySelector('#description'),
            // 密码页面
            newPassword: this.shadowRoot.querySelector('#newPassword'),
            confirmPassword: this.shadowRoot.querySelector('#confirmPassword'),
            passwordError: this.shadowRoot.querySelector('#passwordError')
        };

        // 安全地清空输入框
        Object.values(inputs).forEach(element => {
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = '';
                } else {
                    element.textContent = '';
                }
            }
        });
    }
}

customElements.define('user-profile', UserProfile);