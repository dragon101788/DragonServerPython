import {accountManager} from "/AccountManager.js"
import {get_profile ,fetchTextFromUrl } from "/DragonServerAPI.js"

// 在现有的 UserProfile 类之前添加 UserInfoTitle 类
class UserInfoTitle extends HTMLElement {
    constructor() {
        super();
        this.SessionWeb = '';
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        
    }

    render() {
        const style = /*css*/`
            <style>
                :host {
                    display: flex;
                    align-items: center;
                    padding: 4px 12px;
                    background: var(--bg-secondary);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.2s;
                    gap: 8px;
                    margin-right: auto;
                }

                
                .avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .user-info {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .username {
                    color: var(--text-secondary);
                    font-size: 12px;
                    font-weight: 500;
                }

                .nickname {
                    color: var(--text-primary);
                    font-size: 18px;
                }
            </style>
        `;
        const html = /*html*/`
                <avatar-component class="avatar"></avatar-component>
                <div class="user-info">
                    <span class="nickname">加载中</span>
                    <span class="username">加载中</span>
                </div>
            `;
        this.shadowRoot.innerHTML = style + html;
        this.avatar = this.shadowRoot.querySelector('.avatar');
        this.nickname = this.shadowRoot.querySelector('.nickname');
        this.username = this.shadowRoot.querySelector('.username');
    }


    setupEventListeners() {
        document.addEventListener('login-success',  async (e) => {
            
            const session = await AccountManager.getUserSession()
            const profile = await get_profile(session.username)
            this.SessionWeb = await fetchTextFromUrl("/chatroom/user_seting.html")
            this.avatar.setAttribute('nickname', profile.nickname);
            this.avatar.setAttribute('username', session.username);
            document.dispatchEvent(new Event('flush'));
        });

        document.addEventListener('flush', async () => {
            const session = await AccountManager.getUserSession()
            const profile = await get_profile(session.username)
            this.nickname.textContent = profile.nickname;
            this.username.textContent = session.username;
        });

    }

}

// 注册 UserInfoTitle 组件
customElements.define('user-info-title', UserInfoTitle);


