import { AccountManager } from '/AccountManager.js';
import { get_profile ,getAvatar  } from '/DragonServerAPI.js';
import { cacheManager } from '/CacheManager.js';

class AvatarComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // 定义需要监控的属性
    static get observedAttributes() {
        return ['username'];
    }

    connectedCallback() {
        this.render();
        // 监听 flush 事件
        document.addEventListener('flush', () => {
            this.render(); // 示例：重新渲染组件
        });
    }

    // 当监控的属性发生变化时调用
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'username' && oldValue !== newValue) {
            this.render();
        }
    }

    async render() {
        const style = /*css*/`
            <style>
                :host {
                    display: inline-block;
                }
                img {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                }
            </style>
        `;
        const username = this.getAttribute('username');
        let AvatarPath = '/static/default_avatar.png';

        if (username) {
            const profile = await get_profile(username);
            const nickname = profile.nickname;
            try {
                if (username) {
                    const dataURL = await getAvatar(username);
                    AvatarPath = dataURL;
                }
            } catch (error) {
                if (nickname) {
                    const dataURL = await this._generateBase64FromStr(nickname || '');
                    await cacheManager.setCache(`${username}/avatar`, dataURL);
                    AvatarPath = dataURL;
                }
            }
        }
        
        const html = /*html*/`
            <img src="${AvatarPath}" alt="头像">
        `;

        this.shadowRoot.innerHTML = style + html;
    }

    // 生成随机背景色
    _getColorFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 60%)`; // 使用HSL确保颜色明亮且饱和
    }

    // 生成文字头像
    async _generateBase64FromStr(nickname) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // 设置背景色
        ctx.fillStyle = this._getColorFromString(nickname);
        ctx.beginPath();
        ctx.arc(100, 100, 100, 0, Math.PI * 2);
        ctx.fill();

        // 获取显示文字（首字母或第一个汉字）
        let displayText = nickname.charAt(0).toUpperCase();
        if (/[\u4e00-\u9fa5]/.test(nickname)) { // 如果是汉字
            displayText = nickname.charAt(0);
        }

        // 设置文字样式
        ctx.fillStyle = '#ffffff';
        ctx.font = '80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, 100, 100);

        return canvas.toDataURL('image/png');
    }

    // 触发 flush 事件
    flush() {
        this.render(); // 示例：重新渲染组件
    }

    setImageFromBase64(dataURL) {
        // 直接设置 DataURL 为 img 元素的 src 属性
        this.shadowRoot.querySelector('img').src = dataURL;
    }
}

customElements.define('avatar-component', AvatarComponent);