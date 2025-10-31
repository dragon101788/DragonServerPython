// UserSettingBox.js

class UserSettingBox extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.data = {};
    }

    connectedCallback() {
        this.render();
        this.setupEvents();
    }

    setProfileData(data) {
        this.data = data;
        this.updateContent();
    }

    updateContent() {
        if (!this.shadowRoot) return;

        const { nickname, description } = this.data;
        this.shadowRoot.querySelector('#nickname-input').value = nickname;
        this.shadowRoot.querySelector('#description-input').value = description;
    }

    async handleAvatarChange(event) {
        
    }

  

    setupEvents() {
        const avatarInput = this.shadowRoot.querySelector('#avatar-input');
        const avatarContainer = this.shadowRoot.querySelector('#avatarContainer');
        avatarContainer.addEventListener('click', () => {
            avatarInput.click();
        });
        avatarInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    await uploadAvatar(file);
                    await all_user_flush_cache(); 
                    // 可以在这里更新头像显示
                    document.dispatchEvent(new CustomEvent('flush'));
                } catch (error) {
                    console.error('上传头像失败:', error);
                }
            }
        });
    
        const saveButton = this.shadowRoot.querySelector('#save-button');
        saveButton.addEventListener('click', async () => {
            const nickname = this.shadowRoot.querySelector('#nickname-input').value;
            const description = this.shadowRoot.querySelector('#description-input').value;
            const profileData = {
                nickname,
                description
            };
            try {
                await saveProfile(profileData);
                await all_user_flush_cache();
                alert('设置保存成功');
                currentProfile.nickname = nickname;
                currentProfile.description = description;
                
                document.dispatchEvent(new Event('flush'));
            } catch (error) {
                console.error('保存设置失败:', error);
            }
        });

        document.addEventListener('flush', () => {
            this.render();
            this.setupEvents()
        });
    }

    render() {
        if (!this.shadowRoot) return;

        const style = /*css*/`
            :host {
                --profile-bg: var(--cc-background, white);
                --text-color: var(--cc-message-text-color, #000);
                --nickname-color: var(--cc-nickname-color, rgba(91, 91, 91, 0.88));
                height: 100vh; /* 使用视口高度实现全屏 */
                width: 100vw; /* 使用视口宽度实现全屏 */
                display: flex; /* 使用 flex 布局 */
                justify-content: center; /* 水平居中 */
                position: absolute;
            }

            .setting-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%; /* 占满父容器宽度 */
                height: 100%; /* 占满父容器高度 */
                padding: 20px; /* 添加内边距 */
                box-sizing: border-box; /* 确保内边距不影响宽度 */
            }

            .avatar {
                width: 200px;
                height: 200px;
                border-radius: 50%;
                object-fit: cover;
                margin: 20px;
                border: 2px solid #ddd;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                cursor: pointer;
            }

            .input-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: 100%;
            }

            input, textarea {
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }

            button {
                position: fixed;
                right: 20px;
                bottom: 20px;
                
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s ease;
                color: white;
                background-color: #2196F3;
                margin-top: 20px;
            }

            button:hover {
                filter: brightness(0.9);
            }

            .form-group {
                display: flex;
                flex-direction: column;
                flex-wrap: wrap;
                margin-bottom: 16px;
                width: 100%;
                box-sizing: border-box; /*确保padding计入总宽度*/
            }
            .max_height.form-group  {
                display: flex;
                flex-direction: column;
                flex-wrap: wrap;
                
                flex: 1;
                margin-bottom: 100px;
            }
            #description-input {
                flex: 1;
            }
            input[type="file"] {
                display: none;
            }

            .avatar-container {
                cursor: pointer;
            }
            .username {
                font-size: 14px;
                color: #888;
                text-align: center;
                margin-bottom: 5px;
            }
        `;

        const html = /*html*/`
            <div class="setting-container">
                <div class="profile-header">
                    <div class="avatar-container" id="avatarContainer">
                            <avatar-component id="avatar" class="avatar" username="${currentProfile.username}" nickname="${currentProfile.nickname}"></avatar-component>
                            <input type="file" id="avatar-input" hidden accept="image/*">
                    </div>
                </div>
                <div class="username" id="username">${currentProfile.username}</div>

                <div class="form-group">
                    <label>昵称</label>
                    <input type="text" id="nickname-input" placeholder="请输入昵称" value="${currentProfile.nickname}">
                </div>

                <div class="max_height form-group">
                    <label>个人描述</label>
                    <textarea id="description-input" placeholder="写点什么来介绍自己吧...">${currentProfile.description}</textarea>
                </div>
                <button id="save-button">保存设置</button>
            </div>
        `;

        this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
    }
}

customElements.define('user-setting-box', UserSettingBox);