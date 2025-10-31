//  TabContainerComponent.js

class TabContainerComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.tabs = [];
    }

    connectedCallback() {
        this.render();
        this.setupTabEvents();
        // 新增：执行子元素中的 script 标签
        this.executeChildScripts();
    }

    // 新增方法：执行子元素中的 script 标签
    executeChildScripts() {
        const scripts = this.querySelectorAll(':scope > script');
        scripts.forEach(script => {
            try {
                // 使用 Function 构造函数来执行脚本内容
                new Function(script.textContent)();
            } catch (error) {
                console.error('Error executing script:', error);
            }
        });
    }

    // 在class内部新增以下方法
    static get observedAttributes() {
        return ['active-tab'];
    }

    tab_change(title) {
        if (!title) return;

        // 找出当前激活的 tab 按钮
        const currentActiveBtn = this.shadowRoot.querySelector('.tab-button.active');
        if (currentActiveBtn) {
            const currentTabId = currentActiveBtn.dataset.tab;
            const currentTargetChild = Array.from(this.children).find(child => child.slot === currentTabId);
            if (currentTargetChild) {
                const currentTitle = currentTargetChild.getAttribute('title');
                // 若请求的 title 和当前激活标签页的 title 相同，直接返回
                if (currentTitle === title) {
                    return;
                }
                if (typeof currentTargetChild.onTabEscape === 'function') {
                    currentTargetChild.onTabEscape();
                }
            }

        }

        // 查找所有子元素，根据 title 属性找到对应的 tabId
        const targetChild = Array.from(this.children).find(child => child.getAttribute('title') === title);
        if (!targetChild) return;
        const tabId = targetChild.slot;

        const tabButtons = this.shadowRoot.querySelectorAll('.tab-button');
        const tabContents = this.shadowRoot.querySelectorAll('slot[name^="tab"]');
        
        // 同步更新按钮和内容状态
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.style.display = 'none');
        
        const targetBtn = this.shadowRoot.querySelector(`.tab-button[data-tab="${tabId}"]`);
        const targetSlot = this.shadowRoot.querySelector(`slot[name="${tabId}"]`);
        
        if (targetBtn && targetSlot) {
            targetBtn.classList.add('active');
            targetSlot.style.display = 'block';
            if (typeof targetChild.onTabActive === 'function') {
                targetChild.onTabActive();
            }
        }
        this.dispatchEvent(new CustomEvent('tab-change', { detail: { title } }));
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'active-tab' && oldValue !== newValue) {
            this.tab_change(newValue);
        }
    }

    setupTabEvents() {
        const tabButtons = this.shadowRoot.querySelectorAll('.tab-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 修改点：获取按钮对应的 title
                let title = button.textContent;
                //去掉空格换行
                title = title.replace(/\s+/g, '');
                this.tab_change(title);
            });
        });
    }

    render() {
        
        
        const style = /*css*/`
            :host {
                --tab-button-bg: #f0f0f0;
                --tab-button-hover-bg: #e0e0e0;
                --tab-button-active-bg: #ccc;
                --tab-title-text-color: #333;
                height: 100%; 
                display: block;
            }

            .tab-container {
                height: 100%;
                display: flex;
                flex-direction: column;
                //box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                overflow: hidden;
                margin: 0;
                padding: 0;
            }

            .tab-buttons {
                height: 3vh;
                display: flex;
                background: color-mix(in srgb, var(--tab-button-bg), white 10%);
                border-bottom: 1px solid #ddd;
            }

            .tab-button {
                background: var(--tab-button-bg);
                color: var(--tab-title-text-color);
                border: none;
                border-right: 1px solid color-mix(in srgb, var(--tab-button-bg), black 20%);
                cursor: pointer;
                transition: background 0.3s ease;
                padding-inline: 10px;
            }

            .tab-button:hover {
                background: var(--tab-button-hover-bg);
            }

            .tab-button.active {
                background: var(--tab-button-active-bg);
            }

            .content-wrapper {
                flex: 1; /* 让内容区域占满剩余空间 */
                position: relative;
                overflow-y: auto; /* 确保内容溢出时显示垂直滚动条 */
                margin: 0;
                padding: 0;
            }

            .wrapper {
                height: 100%; /* 设置 slot 高度 */
                width: 100%;
                overflow-y: auto;
                margin: 0;
                padding: 0;
            }
            ::slotted([slot^="tab"]) {
                height: 100%;
                width: 100%;
                overflow-y: auto;
            }
        `;

        // 初始化 tab 按钮和内容的 HTML 字符串
        let tabButtonsHTML = '';
        let contentWrapperHTML = '';

        Array.from(this.children).forEach((child, index) => {
            const tabId = `tab${index + 1}`;
            child.slot = tabId; // 自动设置 slot 属性

            // 生成 tab 按钮 HTML
            tabButtonsHTML += `
                <button class="tab-button${index === 0 ? ' active' : ''}" data-tab="${tabId}">
                    ${child.getAttribute('title') || ''}
                </button>
            `;

            
            // 生成内容区域 HTML
            contentWrapperHTML += `
                <slot name="${tabId}" class="wrapper" style="display: ${index === 0 ? 'block' : 'none'}"></slot>
            `;

        });

        const html = `
            <div class="tab-container">
                <div class="tab-buttons">
                    ${tabButtonsHTML}
                </div>
                <div class="content-wrapper">
                    ${contentWrapperHTML}
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
        this.tab_change(this.getAttribute('active-tab'));
    }
    appendChild(child) {
        // 将子元素添加到组件
        super.appendChild(child);

        this.render();
        this.setupTabEvents();
        // 新增：执行子元素中的 script 标签
        this.executeChildScripts();
    }

   
}

customElements.define('tab-container', TabContainerComponent);