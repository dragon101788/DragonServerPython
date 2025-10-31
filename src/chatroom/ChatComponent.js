// ChatComponent.js



// 定义 MessageItemComponent 组件
class MessageItemComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.layout = "right"; // 默认靠左
    }

    
    static get observedAttributes() {
        return ['layout'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'layout') {
            this.layout = newValue;
        }
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        const style = /*css*/`
            .message {
                margin: 8px 12px;
                padding: 8px 12px;
                border-radius: 18px;
                max-width: 80%;
                color: var(--message-text-color);
                animation: messageAppear 0.3s ease;
                white-space: normal;
                word-wrap: break-word;
                word-break: break-word;
            }

            .message.right {
                background: var(--sent-message-bg);
                margin-left: auto;
            }

            .message.left {
                background: var(--received-message-bg);
            }

            .message-container {
                display: flex;
                gap: 8px;
                align-items: flex-start; 
                max-width: 100%;
            }

            .message.right .message-container {
                flex-direction: row-reverse;
            }

            .message-avatar {
                width: 32px;
                height: 32px;
                flex-shrink: 0;
                border-radius: 50%;
                align-self: flex-start;
                margin-top: 0;
                padding: 0;
            }

            .content-wrapper {
                max-width: calc(100% - 40px);
                display: flex;
                flex-direction: column;
            }

            .message-nickname {
                font-size: var(--nickname-font-size);
                color: var(--nickname-color);
                margin-bottom: 4px;
                padding-left: 8px;
            }

            .message.right .message-nickname {
                margin-left: auto;
            }

            .message-bubble {
                padding: 8px 12px;
                border-radius: 18px;
                position: relative;
                word-break: break-word;
            }

            .message.left .message-bubble {
                background: var(--received-message);
                margin-left: 4px;
            }

            .message.right .message-bubble {
                background: var(--sent-message);
                margin-right: 4px;
            }

            @keyframes messageAppear {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        
        
        this.setAttribute('data-timestamp', this.timestamp);
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(this.layout);

        // 创建消息内容容器
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container');



        // 创建头像组件
        const avatarComponent = document.createElement('avatar-component');
        avatarComponent.classList.add('message-avatar');
        avatarComponent.setAttribute('username', this.profile.username);
        avatarComponent.setAttribute('nickname', this.profile.nickname);
        messageContainer.appendChild(avatarComponent);  

        // 创建内容包装器
        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('content-wrapper');

        // 如果显示昵称，则添加昵称元素
        if (this.getAttribute('show-nickname') === 'true') {
            const messageNickname = document.createElement('div');
            messageNickname.classList.add('message-nickname');
            messageNickname.textContent = this.profile.nickname;
            contentWrapper.appendChild(messageNickname);
        }

        // 创建消息气泡
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');
        messageBubble.innerHTML = this.getAttribute('content');
        contentWrapper.appendChild(messageBubble);

        // 将内容包装器添加到消息内容容器
        messageContainer.appendChild(contentWrapper);

        // 将消息内容容器添加到消息容器
        messageDiv.appendChild(messageContainer);

        // 将样式和消息容器添加到 shadowRoot
        this.shadowRoot.innerHTML = `<style>${style}</style>`;
        this.shadowRoot.appendChild(messageDiv);
    }
    set text(text){
        const bubble = this.shadowRoot.querySelector('.message-bubble');
        bubble.innerHTML = ChatComponent.formatMessage(text);
    }
   
}

customElements.define('message-item-component', MessageItemComponent);

class ChatComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.username = '';
        this.chatManager = null;
        this.showNickname = true; // 默认显示昵称
        this.showOwnNickname = true; // 默认不显示自己的昵称
    }

    static get observedAttributes() {
        return ['token', 'username', 'chat-user', 'visible', 'show-nickname', 'show-own-nickname'];
    }
 

    
    async loadMessageHistory(receiver) {
        if (!receiver) return null;
        try {
            const messages = await loadMessageHistory(receiver);

            this.clearMessages(); // 清空现有消息
            messages.forEach(async message => {
                await this.displayMessage( message);
            });
            //添加完了之后根据data-timestamp排序一下
            this.scrollBottom();

            return messages;
        }
        catch (error) {
            console.error('加载历史消息失败：', error);
            return null; 
        }
        
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (name === 'username') this.username = newValue;
            if (name === 'show-nickname') {
                this.showNickname = newValue === 'true';
            }
            if (name === 'show-own-nickname') {
                this.showOwnNickname = newValue === 'true';
            }
        }
    }


    // 优化清空消息的方法
    clearMessages() {
        const messagesDiv = this.shadowRoot.querySelector('.messages');
        while (messagesDiv.firstChild) {
            messagesDiv.removeChild(messagesDiv.firstChild);
        }
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.loadMessageHistory(ActiveUsername);
    }

    render() {
        const style = /*css*/`
            :host {
                --chat-padding: var(--cc-padding, 0);
                --messages-padding: var(--cc-messages-padding, 10px);
                --message-spacing: var(--cc-message-spacing, 10px);
                --message-padding: var(--cc-message-padding, 10px);
                --message-radius: var(--cc-message-radius, 8px);
                --message-max-width: var(--cc-message-max-width, 90%);
                --nickname-color: var(--cc-nickname-color,rgba(91, 91, 91, 0.88));
                --nickname-font-size: var(--cc-nickname-font-size, 12px);
                --sent-message-bg: var(--cc-sent-message-bg,rgba(20, 0, 130, 0.05));
                --received-message-bg: var(--cc-received-message-bg,rgba(0, 101, 22, 0.05));
                --sent-message: var(--cc-sent-message,#5865f2);
                --received-message: var(--cc-received-message,#028d3b);
                --message-text-color: var(--cc-message-text-color, #fff);

                --input-height: var(--cc-input-height, 50px);
                --input-border: var(--cc-input-border, 1px solid #ddd);
                --input-radius: var(--cc-input-radius, 4px);
                --input-padding: var(--cc-input-padding, 10px);

                --button-bg: var(--cc-button-bg, #0084ff);
                --button-color: var(--cc-button-color, white);
                --button-hover-bg: var(--cc-button-hover-bg, #0073e6);
                --button-width: var(--cc-button-width, 100px);
                
                flex: 1;
                display: block;
                background: var(--cc-background);
            }

            .chat-main {
                flex: 1;
                height: calc(100vh - var(--input-height) - 2 * var(--input-padding) - 2*var(--messages-padding));
                display: flex;
                flex-direction: column;
                overflow: hidden;
                padding: var(--chat-padding);
            }

            .messages {
                flex: 1;
                height: 100%;
                overflow-y: auto;
                padding: var(--messages-padding);
                margin-bottom: var(--message-spacing);
                scroll-behavior: auto;
            }

            .message {
                margin: var(--message-spacing) 0;
                padding: var(--message-padding);
                border-radius: var(--message-radius);
                max-width: var(--message-max-width);
                color: var(--message-text-color);
                animation: messageAppear 0.3s ease;
                white-space: normal; /*支持换行符显示*/
                word-wrap: break-word; /*长单词自动换行*/
                word-break: break-word; /*防止文字溢出*/
            }

            .message.sent {
                background: var(--sent-message-bg);
                margin-left: auto;
            }

            .message.received {
                background: var(--received-message-bg);
            }

            .message-input {
                display: flex;
                padding: var(--input-padding);
                min-height: var(--input-height);
                gap: 10px; /*输入框和按钮之间的间距*/
            }

            .message-input textarea {  /*将 input 改为 textarea*/
                flex-grow: 1;
                padding: var(--input-padding);
                background: var(--input-bg);
                color: var(--input-text-color);
                border: var(--input-border);
                border-radius: var(--input-radius);
                font-size: inherit;
                font-family: inherit;
                resize: none; /*禁用手动调整大小*/
                min-height: 40px; /*最小高度*/
                max-height: 120px; /*最大高度*/
                line-height: 1.5;
                overflow-y: auto;
            }

            .message-input button {
                width: var(--button-width);
                background: var(--button-bg);
                color: var(--button-color);
                border: none;
                border-radius: var(--input-radius);
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .message-input button:hover {
                background: var(--button-hover-bg);
            }

            // 在render()的style中添加
            .message {
                max-width: 80%;
                margin: 8px 12px;
            }

            .message.sent {
                margin-left: auto;
            }

            .message-container {
                display: flex;
                gap: 8px;
                align-items: flex-start; 
                max-width: 100%;
            }

            .message.sent .message-container {
                flex-direction: row-reverse;
            }

            .message-avatar {
                width: 32px;
                height: 32px;
                flex-shrink: 0;
                border-radius: 50%;
                align-self: flex-start; /* 保留这个设置 */
                margin-top: 0; /* 确保没有额外的上边距 */
                padding: 0; /* 确保没有内边距 */
            }

            .content-wrapper {
                max-width: calc(100% - 40px);
                display: flex;
                flex-direction: column;
            }

            .message-nickname {
                font-size: var(--nickname-font-size);
                color: var(--nickname-color);
                margin-bottom: 4px;
                padding-left: 8px;
            }

            .message.sent .message-nickname {
                font-size: var(--nickname-font-size);
                color: var(--nickname-color);
                margin-bottom: 4px;
                padding-left: 8px;
                margin-left: auto;
            }

            .message-bubble {
                padding: 8px 12px;
                border-radius: 18px;
                position: relative;
                word-break: break-word;
            }

            .message.received .message-bubble {
                background: var(--received-message);;
                //border: 1px solid #e5e5ea;
                margin-left: 4px;
            }

            .message.sent .message-bubble {
                background: var(--sent-message);;
                //border: 1px solid #e5e5ea;
                margin-right: 4px;
            }

     

            @keyframes messageAppear {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /*自定义滚动条*/
            .messages::-webkit-scrollbar {
                width: var(--scrollbar-width, 6px);
            }

            .messages::-webkit-scrollbar-track {
                background: var(--scrollbar-track-bg, transparent);
            }

            .messages::-webkit-scrollbar-thumb {
                background: var(--scrollbar-thumb-bg, rgba(0,0,0,0.2));
                border-radius: var(--scrollbar-radius, 3px);
            }

            .messages::-webkit-scrollbar-thumb:hover {
                background: var(--scrollbar-thumb-hover-bg, rgba(0,0,0,0.3));
            }
            
        `;

        const html = /*html*/`
        <div class="chat-main">
            <div class="messages">
                <slot name="messages"></slot>
            </div>
            <div class="message-input">
                <slot name="input">
                    <textarea rows="1" placeholder="${this.getAttribute('placeholder') || '输入消息...'}"></textarea>
                </slot>
                <slot name="send-button">
                    <button>发送</button>
                </slot>
            </div>
        </div>
        `;

        this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
    }

    setupEventListeners() {
        const textarea = this.shadowRoot.querySelector('textarea');
        const button = this.shadowRoot.querySelector('button');

        document.addEventListener('load-message-history', (event) => {
            this.loadMessageHistory(ActiveUsername); 
        })
        document.addEventListener('chat-receive-message',(event) => {
                const message = event.detail.message;
                if(message.session_id === ActiveSessionID){
                        this.receiveMessage(message)
                } 
        })

        // 处理回车发送（按住Shift+Enter换行）
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 自动调整文本框高度
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        });

        button.addEventListener('click', () => this.sendMessage());
    }

    // 接收新消息
    async receiveMessage(message) {
        const messagesDiv = this.shadowRoot.querySelector('.messages');
        let messageDiv = messagesDiv.querySelector(`[data-timestamp="${message.timestamp}"]`);
        if (messageDiv == null) {
            
            await this.displayMessage( message );
        }
        else {
            messageDiv.text = message.content;
        }
        
        this.scrollBottom();
    }

    // 显示队列中的消息



    async sendMessage() {

        const textarea = this.shadowRoot.querySelector('textarea');
        const content = textarea.value.trim();
        if (!content) return;

        try {
            const session = AccountManager.getUserSession()
            const profile = await get_profile(ActiveUsername)
            await sendMessage(generateSessionId(ActiveUsername,session.username),content,profile);
     
            textarea.value = '';
            textarea.style.height = 'auto'; 
        }
        catch (error) {
            console.error('发送消息失败：', error); 
        }
        
    }

    scrollBottom() {
        const messagesDiv = this.shadowRoot.querySelector('.messages');
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    static formatMessage(message) {
        // 处理换行和基础Markdown
        let formatted = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')    // 加粗
            .replace(/\*(.*?)\*/g, '<em>$1</em>')                // 斜体
            .replace(/`(.*?)`/g, '<code>$1</code>')              // 代码块
            .replace(/\n/g, '<br>');                             // 换行符

        // 处理链接自动识别
        formatted = formatted.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener">$1</a>'
        );

        return formatted;
    }
    
    async displayMessage(message) {
        const profile = await get_profile(message.sender);
        const session = await AccountManager.getUserSession()
        const username = session.username;
        const layout = message.sender === username? "right" : "left";
        const showNickname = layout ==="left" ? this.showNickname : this.showOwnNickname;
        const timestamp = message.timestamp;
        const content = message.content;

        const messagesDiv = this.shadowRoot.querySelector('.messages');

        // 创建 MessageItemComponent 实例
        const messageItem = document.createElement('message-item-component');
        messageItem.timestamp = timestamp;
        messageItem.setAttribute('layout',layout); 
        messageItem.profile =  profile;
        messageItem.setAttribute('show-nickname', showNickname);

        messageItem.setAttribute('content', ChatComponent.formatMessage(content));

        messagesDiv.appendChild(messageItem);
        this.scrollBottom();

    }

}

customElements.define('chat-component', ChatComponent);

