class ExtraStaticConfig extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        // 配置数据 - 纯字符串数组
        this.configList = [];
    }

    async fetchExtraStatic() {
        try {
            const response = await fetch('/api/get_extra_static');
            const data = await response.json();
            this.configList = data || [];
        } catch (error) {
            console.error('获取额外静态目录失败:', error);
        }
    }
    async postExtraStatic() {
        try {
            const response = await fetch('/api/set_extra_static', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.configList),
            });
            const data = await response.json();
            if (response.ok) {
                console.log('额外静态目录更新成功:', data);
            } else {
                console.error('更新额外静态目录失败:', data);
            }
        } catch (error) {
            console.error('更新额外静态目录失败:', error);
        }
    }
    async connectedCallback() {
        
        await this.fetchExtraStatic();
        await this.render();
    }
    async render() {
        const html = /*html*/`
            <style>
                #extra-static-config {
                    padding: 20px;
                    font-family: Arial, sans-serif;
                }
                h2 {
                    margin-top: 0;
                    color: #333;
                }
                .config-list {
                    margin: 20px 0;
                    min-height: 100px;
                    border: 2px dashed #ccc;
                    padding: 10px;
                    border-radius: 5px;
                }
                .config-item {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    margin: 5px 0;
                    background: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                .config-item:hover {
                    background: #f0f0f0;
                }
                .drag-handle {
                    margin-right: 10px;
                    color: #999;
                    font-size: 18px;
                    cursor: grab;
                }
                .config-path {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }
                .add-btn, .save-btn {
                    padding: 10px 20px;
                    margin-right: 10px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .add-btn:hover, .save-btn:hover {
                    background: #45a049;
                }
                .remove-btn {
                    padding: 8px 12px;
                    margin-left: 10px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .remove-btn:hover {
                    background: #d32f2f;
                }
                .button-group {
                    margin-top: 20px;
                }
                .dragging {
                    opacity: 0.5;
                    border: 2px dashed #4CAF50;
                }
            </style>
            <div id="extra-static-config">
                <h2>额外静态配置</h2>
                <div class="config-list" id="configList">
                    ${this.configList.map((path, index) => this.renderConfigItem(path, index)).join('')}
                </div>
                <div class="button-group">
                    <button class="add-btn" id="addConfigBtn">添加配置项</button>
                    <button class="save-btn" id="saveConfigBtn">保存配置</button>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML = html;
        
        this.setupEventListeners();
    }
    renderConfigItem(path, index) {
        return /*html*/`
            <div class="config-item" data-index="${index}">
                <span class="drag-handle" draggable="true">☰</span>
                <input type="text" class="config-path" placeholder="请输入静态文件路径" value="${path}">
                <button class="remove-btn">删除</button>
            </div>
        `;
    }
    setupEventListeners() {
        // 添加配置项
        this.shadowRoot.getElementById('addConfigBtn').addEventListener('click', () => {
            this.configList.push('新建项,请填写路径');
            this.render();
        });
        
        // 保存配置（暂不实现具体内容）
        this.shadowRoot.getElementById('saveConfigBtn').addEventListener('click', () => {
            console.log('保存配置', this.getConfigData());
            this.postExtraStatic();
            this.render();
        });
        
        // 设置拖动相关事件
        const configItems = this.shadowRoot.querySelectorAll('.config-item');
        let draggedItem = null;
        
        configItems.forEach(item => {
            const dragHandle = item.querySelector('.drag-handle');
            
            // 拖动开始 - 只在drag-handle上监听
            dragHandle.addEventListener('dragstart', (e) => {
                draggedItem = item;
                setTimeout(() => item.classList.add('dragging'), 0);
                // 设置拖动数据
                e.dataTransfer.setData('text/plain', item.dataset.index);
            });
            
            // 拖动结束
            dragHandle.addEventListener('dragend', () => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                    draggedItem = null;
                }
            });
            
            // 拖动经过
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            
            // 拖动进入
            item.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (item !== draggedItem) {
                    item.style.borderTop = '2px solid #4CAF50';
                }
            });
            
            // 拖动离开
            item.addEventListener('dragleave', () => {
                item.style.borderTop = '';
            });
            
            // 放置
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.style.borderTop = '';
                
                if (draggedItem !== item) {
                    const draggedIndex = parseInt(draggedItem.dataset.index);
                    const targetIndex = parseInt(item.dataset.index);
                    
                    // 更新数据顺序
                    const [removed] = this.configList.splice(draggedIndex, 1);
                    this.configList.splice(targetIndex, 0, removed);
                    
                    // 重新渲染
                    this.render();
                    this.setupEventListeners();
                }
            });
            
            // 删除按钮事件
            item.querySelector('.remove-btn').addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.configList.splice(index, 1);
                this.render();
                this.setupEventListeners();
            });
            
            // 路径输入事件
            const pathInput = item.querySelector('.config-path');
            const index = parseInt(item.dataset.index);
            pathInput.addEventListener('input', (e) => {
                this.configList[index] = e.target.value;
            });
        });
    }
    getConfigData() {
        // 直接返回纯字符串数组
        return this.configList;
    }
}
customElements.define('extra-static-config', ExtraStaticConfig);