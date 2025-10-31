//  ProfileBox.js

class ProfileBox extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.data = {};
    }

    connectedCallback() {
        this.render();
        this.setupEvents();
    }


    setupEvents() {
        document.addEventListener('flush', () => {
            get_profile(ActiveUsername).then(data => {
                this.avatar.setAttribute('nickname', data.nickname);
                this.avatar.setAttribute('username', data.username);
                this.avatar.flush();
                this.nickname.textContent = data.nickname;
                this.username.textContent = data.username;
                this.description.textContent = data.description;
            });
            
        });
        // 添加按钮点击事件
        const clearChatButton = this.shadowRoot.querySelector('#clear-chat-button');
        const delContactButton = this.shadowRoot.querySelector('#del-contact-button');

        if (clearChatButton) {
            clearChatButton.addEventListener('click', () => {
                const session = AccountManager.getUserSession();
                // 清空聊天记录逻辑
                console.log('清空聊天记录');
                // 这里可以添加实际的清空逻辑
                clearHistoryMessageCaches(session.username);
                clearHissory(session.username, ActiveUsername);
                document.dispatchEvent(new CustomEvent('load-message-history'));
            });
        }

        if (delContactButton) {
            delContactButton.addEventListener('click', () => {
                // 删除联系人逻辑
                console.log('删除联系人');
                delContact(ActiveUsername);
                showWebSession();
                // 这里可以添加实际的删除逻辑
            });
        }
    }

    render() {
        if (!this.shadowRoot) return;
        const style = /*css*/`
            :host {
                --profile-bg: var(--cc-background, white);
                --text-color: var(--cc-message-text-color, #000);
                --nickname-color: var(--cc-nickname-color, rgba(91, 91, 91, 0.88));
                height: 100%;
                display: block;
                position: relative;  // 新增定位上下文
            }


            .profile-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                height: 100%;
                position: relative;
            }

            .avatar {
                width: 200px;
                height: 200px;
                border-radius: 50%;
                object-fit: cover;
                margin: 20px;
                border: 2px solid #ddd;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .username {
                font-size: 14px;
                color: #888;
                text-align: center;
                margin-bottom: 5px;
            }

            .nickname {
                font-size: 24px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 10px;
            }

            .description {
                flex: 1;
                margin-bottom: 100px;
                border: 1px solid #ccc;
                padding: 10px;
                border-radius: 5px;
                width: 80%;
                text-align: center;
            }

            .button-container {
                position: absolute;
                right: 140px;
                bottom: 50px;
                display: flex;
                gap: 10px;
            }

            button {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s ease;
                color: white;
            }

            #clear-chat-button {
                background-color: #FFA500;
            }

            #del-contact-button {
                background-color: #f44336;
            }

            button:hover {
                filter: brightness(0.9);
            }
        `;

        
        const html = /*html*/`
            <div class="profile-container">
                <avatar-component id="avatar" class="avatar" ></avatar-component>
                <div class="username" id="username">加载中...</div>
                <div class="nickname" id="nickname">加载中...</div>
                <div class="description" id="description">加载中...</div>
                <div class="button-container">
                    <button id="clear-chat-button">清空双方聊天记录(谨慎)</button>
                    <button id="del-contact-button">删除好友</button>
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
        
        this.avatar = this.shadowRoot.querySelector('avatar-component')
        this.username = this.shadowRoot.querySelector('#username');
        this.nickname = this.shadowRoot.querySelector('#nickname');
        this.description = this.shadowRoot.querySelector('#description')
    }
}

customElements.define('profile-box', ProfileBox);