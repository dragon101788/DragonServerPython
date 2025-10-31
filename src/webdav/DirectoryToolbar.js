class SortSelect extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupEventListeners();
    }

    // 初始化渲染组件
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                }
                select {
                    height: 24px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 0 5px;
                    background-color: white;
                    box-sizing: border-box;
                }
                select:focus {
                    outline: none;
                    border-color: #2196F3;
                }
            </style>
            <select>
                <option value="name">按名称</option>
                <option value="modified">按修改时间</option>
                <option value="size">按大小</option>
            </select>
        `;
        this.selectElement = this.shadowRoot.querySelector('select');
        // 初始化时设置默认值
        if (this.getAttribute('value')) {
            this.selectElement.value = this.getAttribute('value');
        }

    }

    // 设置事件监听
    setupEventListeners() {
        this.selectElement.addEventListener('change', (e) => {
            // 派发自定义事件，供外部监听
            this.dispatchEvent(new CustomEvent('sort-change', {
                detail: { value: e.target.value },
                bubbles: true,
                composed: true
            }));
        });
    }


    // 实现value属性的getter和setter
    get value() {
        return this.getAttribute('value') || 'name';
    }

    set value(newValue) {
        this.setAttribute('value', newValue);
    }

    // 当属性变化时更新UI
    static get observedAttributes() {
        return ['value'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'value' && this.selectElement) {
            this.selectElement.value = newValue;
        }
    }
}



// 注册自定义元素
customElements.define('sort-select', SortSelect);


class DirectoryToolbarSwitch extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.checked = this.hasAttribute('checked');
        this.render();
        this.setupEventListeners();
    }

    // 初始化渲染组件
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    position: relative;
                    width: 36px;
                    height: 16px;
                    vertical-align: middle; 
                }

                input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .2s;
                    border-radius: 16px;
                }

                .slider:before {
                    position: absolute;
                    content: "";
                    height: 12px;
                    width: 12px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    transition: .2s;
                    border-radius: 50%;
                }

                input:checked + .slider {
                    background-color: #2196F3;
                }

                input:checked + .slider:before {
                    transform: translateX(20px);
                }
            </style>
            <label>
                <input type="checkbox" ${this.checked ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        `;
        this.inputElement = this.shadowRoot.querySelector('input');
    }

    // 设置事件监听
    setupEventListeners() {
        this.inputElement.addEventListener('change', (e) => {
            this.checked = e.target.checked;
            this.dispatchEvent(new CustomEvent('switch-change', {
                detail: { checked: this.checked },
                bubbles: true,
                composed: true
            }));
        });
    }

    // 对外暴露设置开关状态的方法
    setChecked(checked) {
        this.checked = checked;
        if (this.inputElement) {
            this.inputElement.checked = checked;
        }
    }

    // 实现checked属性的getter和setter
    get checked() {
        return this.hasAttribute('checked');
    }

    set checked(value) {
        if (value) {
            this.setAttribute('checked', '');
        } else {
            this.removeAttribute('checked');
        }
    }

    // 当属性变化时更新UI
    static get observedAttributes() {
        return ['checked'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'checked' && this.inputElement) {
            this.inputElement.checked = this.checked;
        }
    }
}

// 注册自定义元素
customElements.define('toolbar-switch', DirectoryToolbarSwitch);

class DirectoryToolbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.multiSelectEnabled = false;
    }

    connectedCallback() {
        this.render();
        this.setupEventDelegation();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .toolbar {
                    height: 30px;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #ddd;
                    display: flex;
                    align-items: center;
                    padding: 0 10px;
                    gap: 15px;
                    vertical-align: middle; 
                }


                ::slotted(button) {
                    cursor: pointer;
                }

                ::slotted(button:hover) {
                    background-color: #e9e9e9;
                }

                ::slotted(.align-left) {
                    margin-right: 0; /* 取消自动margin */
                    margin-left: 0;
                    vertical-align: middle; 
                }

                ::slotted(.align-right) {
                    margin-left: auto; /* 仅保留右对齐的自动margin */
                    margin-right: 0;
                    vertical-align: middle; 
                }
            </style>
            <div class="toolbar">
                <slot></slot>
            </div>
        `;
    }
    
    setupEventDelegation() {
        // 事件委托处理所有子元素事件
        this.shadowRoot.querySelector('.toolbar').addEventListener('change', (e) => {
            const target = e.composedPath()[0];
            if (target.id) {
                this.dispatchEvent(new CustomEvent(`${target.id}-change`, {
                    detail: { value: target.value, checked: target.checked },
                    bubbles: true,
                    composed: true
                }));
            }
        });

        this.shadowRoot.querySelector('.toolbar').addEventListener('click', (e) => {
            const target = e.composedPath()[0];
            if (target.id && target.tagName === 'BUTTON') {
                this.dispatchEvent(new CustomEvent(`${target.id}-click`, {
                    bubbles: true,
                    composed: true
                }));
            }
        });
    }
}
/* 参考用例：
<top-toolbar id="top-toolbar">
    <sort-select id="sort-select" class="align-left"></sort-select>
    <button id="photo-wall-btn" class="align-left">照片墙式浏览</button>
    <div class="align-right">
        <lable >多选</lable>
        <toolbar-switch id="multi-select-switch" ></toolbar-switch>
    </div>
</top-toolbar>
*/
customElements.define('top-toolbar', DirectoryToolbar);