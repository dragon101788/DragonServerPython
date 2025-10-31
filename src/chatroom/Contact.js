//Contact.js
import { loadContacts  } from '/DragonServerAPI.js';
import {get_profile} from "/DragonServerAPI.js"

// 联系人项组件
class ContactItem extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        await this.render();
        await this.setupEventListeners();
    }

    async render() {
        const style = /*css*/`
            :host {
                display: flex;
                align-items: center;
                padding: var(--contact-item-padding);
                cursor: pointer;
                border-bottom: var(--contact-item-border);
                color: var(--contact-item-text-color);
            }
    
            :host(:hover) {
                background: var(--contact-item-hover-bg);
            }
    
            :host(.active) {
                background: var(--contact-item-active-bg);
            }
    
            .avatar {
                margin-right: 10px;
                display: block;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                background-color: var(--input-bg);
                min-width: 40px;
                min-height: 40px;
                transition: transform 0.3s ease, box-shadow 0.3s ease; /* 添加过渡效果 */
            }
    
            .avatar:hover {
                background-color: #e0e0e0; /* 鼠标悬停时的高亮颜色 */
                transform: translateY(-3px); /* 上浮效果 */
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* 阴影效果 */
            }
    
            .nickname {
                cursor: pointer;
                transition: transform 0.3s ease, text-shadow 0.3s ease; /* 添加过渡效果 */
            }
    
            .nickname:hover {
                transform: translateY(-3px); /* 上浮效果 */
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* 阴影效果 */
                font-weight: bold; // 悬停时加粗
            }
        `;
    
        // 创建 style 元素
        const styleElement = document.createElement('style');
        styleElement.textContent = style;
        this.shadowRoot.appendChild(styleElement);
        
        const username = this.getAttribute('username');
        const profile = await get_profile(username);
        const nickname = profile.nickname;
        // 创建 avatar-component
        this.avatar = document.createElement('avatar-component');
        this.avatar.className = 'avatar';
        this.avatar.setAttribute('username', username);
        this.shadowRoot.appendChild(this.avatar);
    
        // 创建昵称 span 元素
        this.nicknameSpan = document.createElement('span');
        this.nicknameSpan.className = 'nickname';
        this.nicknameSpan.textContent = nickname;
        this.shadowRoot.appendChild(this.nicknameSpan);
    }

    setupEventListeners() {
        const avatar = this.shadowRoot.querySelector('avatar-component');
        const nickname = this.shadowRoot.querySelector('.nickname');
    
        avatar.addEventListener('click', (e) => {
            // 阻止事件冒泡
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent('avatarClicked', {
                detail: { username: this.username },
                bubbles: true, // 确保事件可以冒泡
                composed: true // 确保事件可以穿过 Shadow DOM
            }));
        });
    
        nickname.addEventListener('click', (e) => {
            // 阻止事件冒泡
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent('nicknameClicked', {
                detail: { username: this.username },
                bubbles: true, // 确保事件可以冒泡
                composed: true // 确保事件可以穿过 Shadow DOM
            }));
        });

        document.addEventListener('flush',async () => {
            const username = this.getAttribute('username');
            const profile = await get_profile(username);
            const nickname = profile.nickname;
            this.nicknameSpan.textContent = nickname;
        })
    }
}

// 注册联系人项组件
customElements.define('contact-item', ContactItem);

// 联系人列表组件
class ContactList extends HTMLElement {
    constructor() {
        super();
        this.contacts = [];
        this.currentSelect = '';
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.setupEventListeners();
        
    }

    setupEventListeners() {
        document.addEventListener('flush', async () => {
            try {
                const data = await loadContacts();
                if(data.length === this.contacts.length && 
                    data.every((value, index) => value === this.contacts[index])){//减少非必要的缓存刷新的次数
                }else{
                    this.contacts = data;
                    this.render();
                }
    
            } catch (error) {
                console.error('加载联系人列表失败：', error);
            }
        })
    }

    async render() {
        const style = /*css*/`
            :host {
                --contact-list-width: 250px;
                --contact-list-bg: var(--cl-background, white);
                --contact-list-padding: var(--cl-padding, 20px);
                --contact-list-border-radius: var(--cl-border-radius, 8px);
                --contact-item-padding: var(--cl-item-padding, 10px);
                --contact-item-border: var(--cl-item-border, 1px solid #eee);
                --contact-item-hover-bg: var(--cl-item-hover-bg, #f5f5f5);
                --contact-item-active-bg: var(--cl-item-active-bg, #e3f2fd);
                --contact-item-text-color: var(--cl-item-text-color, inherit);

                display: block;
                width: var(--contact-list-width);
                background: var(--contact-list-bg);
                border-radius: var(--contact-list-border-radius);
                padding: var(--contact-list-padding);
            }

            .contact-list {
                width: 100%;
            }

            .contact-item {
                display: flex;
                align-items: center;
                padding: var(--contact-item-padding);
                cursor: pointer;
                border-bottom: var(--contact-item-border);
                color: var(--contact-item-text-color);
            }

            .contact-item:hover {
                background: var(--contact-item-hover-bg);
            }

            .contact-item.active {
                background: var(--contact-item-active-bg);
            }

            .contact-item avatar-component {
                margin-right: 10px;
                width: 40px;  /*设置固定宽度*/
                height: 40px; /*设置固定高度，确保是正方形*/
                display: block; /*确保显示为块级元素*/
            }

            .avatar {
                width: 100%;    /*改为100%填充父容器*/
                height: 100%;   /*改为100%填充父容器*/
                border-radius: 50%;
                object-fit: cover;
                background-color: var(--input-bg);
                min-width: 40px;  /*设置最小宽度*/
                min-height: 40px; /*设置最小高度*/
            }
            ::slotted([slot="contact-item"]) {
                /*允许外部定制联系人项的样式*/
            }
        `;

        this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div class="contact-list"></div>
        `;
        
        const contactListElement = this.shadowRoot.querySelector('.contact-list');

        // 使用 JavaScript 创建和插入元素
        this.contacts.forEach(async username => {

            const contactItem = document.createElement('contact-item');
            contactItem.className = `contact-item ${username === this.currentSelect ? 'active' : ''}`;
            contactItem.username = username;
            contactItem.setAttribute('username', username)  ;

            contactListElement.appendChild(contactItem);
        });

        // 添加点击事件监听
        contactListElement.addEventListener('click', (e) => {
            const contactItem = e.target.closest('.contact-item');
            if (contactItem) {
                this.currentSelect = contactItem.username;
                this.dispatchEvent(new CustomEvent('contactSelected', {
                    detail: { username: contactItem.username }
                }));

                // 更新活动状态
                this.shadowRoot.querySelectorAll('.contact-item').forEach(item => {
                    item.classList.toggle('active', item.username === this.currentSelect);
                });
            }
        });

    }

}

// 注册自定义元素
customElements.define('contact-list', ContactList);