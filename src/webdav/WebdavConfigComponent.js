import { AccountManager } from '/AccountManager.js';
import { get_webdav_config ,set_webdav_config  } from '/webdav/ServerAPI.js';
import { get_profile   } from '/DragonServerAPI.js';
import { WebdavApi } from '/webdav/WebdavApi.js';
import { CheckBoxDialog } from '/BaseModal.js';

class WebdavConfigComponent extends HTMLElement {
    static get observedAttributes() {
        // 声明要监控的 username 属性
        return ['username'];
    }
    static isMobile(){
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768) {
            return true;
        } else {
            return false;
        }
    }
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        // 初始化默认配置
        this.config = undefined;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'username' && oldValue !== newValue) {
            // 当 username 属性变化时，调用 API 获取配置
            this.fetchWebdavConfig(newValue);
        }
    }

    async fetchWebdavConfig(username) {
        try {
            const config = await get_webdav_config(username);
            this.config = config;
            // 重新渲染组件
            this.render();
            this.setupEvents();
        } catch (error) {
            console.error('获取 WebDAV 配置失败:', error);
        }
    }

    connectedCallback() {
        try{    
            username = this.getAttribute('username');
            fetchWebdavConfig(username);
        }
        catch(error){
        }

        
    }
    StringUnit2Unit(str) {
        if (typeof str !== 'string') {
            return [null, null]; 
        }
        const regex = /^(\d+)([a-zA-Z]*)$/;
        const match = str.match(regex);
        if (!match) {
            return [null, null];
        }

        const value = parseInt(match[1], 10);
        let unit = match[2].toUpperCase();

        // 统一单位
        if (unit === 'K' || unit === 'KB') {
            unit = 'KB';
        } else if (unit === 'M' || unit === 'MB') {
            unit = 'MB';
        } else if (unit === 'G' || unit === 'GB') {
            unit = 'GB';
        } else {
            return [null, null];
        }

        return [value, unit];
    }

    // 提取生成虚拟路径条目的函数
    createVirtualPathItem(name, item, index) {
        if(WebdavConfigComponent.isMobile()){
            return /*html*/`
                <div class="virtual-path-item mobile">
                    <div class="inline-group">
                        <label>名称:</label> 
                        <input type="text" value="${name}">
                    </div>
                    
                    <div class="inline-group">
                        <label>路径:</label> 
                        <input type="text" value="${item.path}"">
                    </div>
                    <div class="inline-group">
                        <label>只读:</label>
                        <input type="checkbox" ${item.readonly ? 'checked' : ''}>
                        <button class="button-right-align" id="limit" data-index="${index}" >限制</button>
                        <button class="button-right-align" id="delete" data-index="${index}" style="background-color:red;" >删除条目</button>
                    </div>
                </div>
            `
        }else{
            return /*html*/`
                <div class="virtual-path-item">
                    <label>名称:</label>
                    <input type="text" value="${name}">
                    <label>路径:</label>
                    <input type="text" value="${item.path}">
                    <label>只读:</label>
                    <input type="checkbox" ${item.readonly ? 'checked' : ''}>
                    <!-- 新增按钮 "限制" -->
                    <button class="button-right-align" id="limit" data-index="${index}" >限制</button>
                    <button class="button-right-align" id="delete" data-index="${index}"  style="background-color:red;">删除条目</button>
                </div>
            `;
        }
        
    }

    async render() {
        const session = await AccountManager.getUserSession();
        const profile = await get_profile(session.username);
        const isAdmin = profile.role.includes("Admin");
        const style = /*css*/`
            :host {
                display: block;
                padding: 20px;
            }
            label {
                display: block;
                margin-bottom: 5px;
            }
            h3 {
                margin-bottom: 2px;
            }
            input[type="text"] {
                width: 100%;
                padding: 8px;
                box-sizing: border-box;
            }
            input[type="checkbox"] {
                margin-right: 5px;
            }
            .virtual-path-item {
                display: flex;
                gap: 10px;
                margin-bottom: 10px;
                align-items: center; /* 垂直居中对齐 */
                flex-wrap: nowrap; /* 禁止换行 */
                
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #ddd;
            }
            .virtual-path-item label {
                margin-bottom: 0; /* 移除标签底部外边距 */
                margin-right: 5px; /* 为标签右侧添加间距 */
                white-space: nowrap; /* 防止标签文本换行 */
                
            }
            .virtual-path-item input[type="text"]:first-of-type {
                width: 20%; /* 设置第一个文本输入框宽度为 20% */
            }
            .virtual-path-item input[type="text"]:not(:first-of-type) {
                flex: 1; /* 让其他文本输入框自动分配剩余空间 */
                min-width: 0; /* 允许输入框缩小 */
            }
            .add-virtual-path {
                margin-top: 10px;
            }
            button {
                padding: 8px 15px;
                background-color: #2196F3;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: #0b7dda;
            }
            /* 新增样式，让输入框和复选框在同一行 */
            .inline-group {
                width : 100%;
                display: flex;
                gap: 15px;
                align-items: center;
            }
            .inline-group input[type="text"] {
                flex: 1;
            }
            /* 新增样式，让按钮右对齐 */
            .button-right-align {
                margin-left: auto;
            }
            
            /* 移动端样式 */
            @media (max-width: 768px) {
                :host {
                    padding: 10px;
                }
                
                .mobile-container {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .mobile-form-row {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    margin-bottom: 10px;
                }
                
                .mobile-form-row.button-group {
                    flex-direction: row;
                    justify-content: space-between;
                }
                
                .virtual-path-item.mobile {
                    background-color: #f5f5f5;
                    flex-direction: column;
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                }
                
                input[type="text"], select {
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }
                
                button {
                    padding: 10px;
                    width: 100%;
                    margin-bottom: 5px;
                }
                
                .add-virtual-path {
                    margin-top: 5px;
                }
            }
            /* 新增样式，用于让保存按钮右对齐 */
            .save-button-container {
                display: flex;
                justify-content: flex-end;
                margin-top: 15px;
            }
            /* 新增分割线样式 */
            hr {
                border: 0;
                height: 1px;
                background-color: #ccc;
                margin: 20px 0;
            }
        `;

        let virtualPathItems = '';
        if (this.config.virtual_paths) {
            virtualPathItems = Object.entries(this.config.virtual_paths).map(([name, item], index) => 
                this.createVirtualPathItem(name, item, index)
            ).join('');
        }

        let [disk_quota, disk_quota_unit] = this.StringUnit2Unit(this.config.disk_quota);
        if (!disk_quota) {
            disk_quota = '1';
            disk_quota_unit = 'GB';
        }
        console.log(disk_quota,disk_quota_unit)

        if(WebdavConfigComponent.isMobile()){
            const html = /*html*/`
                <style>${style}</style>
                <div class="mobile-container">
                    <!-- 用户路径配置 -->
                    <h3>用户路径配置:</h3>
                    <div class="inline-group">
                            <input type="text" id="user-path-input" value="${this.config.path}" >                       
                            <label>只读</label>
                            <input type="checkbox" id="user-readonly-checkbox" ${this.config.readonly ? 'checked' : ''} >
                    </div>

                    <!-- 磁盘配额配置 -->
                    <h3>磁盘配额:</h3>
                    <div class="inline-group">
                        <input type="text" id="disk-quota-input" value="${disk_quota || ''}" >
                        <label>单位:</label>
                        <select id="disk-quota-unit-select">
                            <option value="MB" ${disk_quota_unit === 'MB' ? 'selected' : ''}>MB</option>
                            <option value="GB" ${disk_quota_unit === 'GB' ? 'selected' : ''}>GB</option>
                        </select>
                    </div>

                    <!-- 虚拟路径配置 -->
                    <div class="virtual-paths">
                        <div class="mobile-form-row">
                            <h3>虚拟路径配置</h3>
                            <button class="add-virtual-path" >添加条目</button>
                        </div>
                        ${virtualPathItems}
                    </div>

                    <!-- 保存按钮 -->
                    <div class="save-button-container">
                        <button id="save-config-button">保存设置</button> 
                    </div>
                </div>
            `;
            this.shadowRoot.innerHTML = html;
        }else{
                const html = /*html*/`
                <style>${style}</style>
                <div class="inline-group">
                    <!-- 用户路径配置 -->
                    <div class="from-group" style="width : 70%;">
                        <h3>用户路径配置:</h3>
                        <div class="inline-group">
                                <input type="text" id="user-path-input" value="${this.config.path}" >                       
                                <label>只读</label>
                                <input type="checkbox" id="user-readonly-checkbox" ${this.config.readonly ? 'checked' : ''} >
                        </div>
                    </div>
                    <!-- 新增分割线 -->
                    <hr>
                    <!-- 磁盘配额配置 -->
                    <div class="from-group" style="width : 30%;">
                        <h3>磁盘配额:</h3>
                        <div class="inline-group">
                            <input type="text" id="disk-quota-input" value="${disk_quota || ''}" >
                        
                            <label>单位:</label>
                            <select id="disk-quota-unit-select">
                                    <option value="MB" ${disk_quota_unit === 'MB' ? 'selected' : ''}>MB</option>
                                    <option value="GB" ${disk_quota_unit === 'GB' ? 'selected' : ''}>GB</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="virtual-paths">
                    <div class="inline-group">
                        <h3>虚拟路径配置</h3>
                        <button class="add-virtual-path button-right-align" >添加条目</button>
                    </div>
                    ${virtualPathItems}
                </div>
                <!-- 新增容器包裹保存按钮，实现右对齐 -->
                <div class="save-button-container">
                    <button id="save-config-button">保存设置</button> 
                </div>
            `;

            this.shadowRoot.innerHTML = html;
        }
        
    }
    async limitConfig(index){
        const names = Object.keys(this.config.virtual_paths);
        const name = names[index];
        
        const config = this.config.virtual_paths[name];
        
        CheckBoxDialog.open({
            title: '目录限制',
            message: '支持的权限:',
            options: JSON.stringify ([
                { value: 'download', label: '下载' },
                { value: 'upload', label: '上传' },
                { value: 'delete', label: '删除' },
                { value: 'shared', label: '分享' }
            ]),
            selected: JSON.stringify(config.limits||[])
        }).addEventListener('confirm',(event) => {
            const selected = event.detail.selected;
            console.log(selected);
            this.config.virtual_paths[name].limits = selected;
        });
    }
    async deleteIndex(index){
        const names = Object.keys(this.config.virtual_paths);
        const name = names[index];
        delete this.config.virtual_paths[name]; 
        await this.render();
        await this.setupEvents();
    }
    async setupEvents() {
        const session = await AccountManager.getUserSession();
        const profile = await get_profile(session.username);
        const isAdmin = profile.role.includes("Admin");
        if (!isAdmin) return;

        const addVirtualPathButton = this.shadowRoot.querySelector('.add-virtual-path');
        if (addVirtualPathButton) {
            addVirtualPathButton.addEventListener('click', async () => {
                if (!this.config.virtual_paths) {
                    this.config.virtual_paths = {}; 
                }
                const newName = `new_${Object.keys(this.config.virtual_paths).length + 1}/`;
                this.config.virtual_paths[newName] = {
                    path: '',
                    readonly: false
                };

        
                // 动态添加新的虚拟路径条目
                const virtualPathsContainer = this.shadowRoot.querySelector('.virtual-paths');
                const newIndex = Object.keys(this.config.virtual_paths).length - 1;
                const newItem = document.createElement('div');
                newItem.innerHTML = this.createVirtualPathItem(newName, this.config.virtual_paths[newName], newIndex);
                virtualPathsContainer.appendChild(newItem);

                // 为新添加的删除按钮绑定事件
                const deleteButton = newItem.querySelector('#delete');
                if (deleteButton) {
                    deleteButton.addEventListener('click', async () => {
                        const index = parseInt(deleteButton.dataset.index);
                        this.deleteIndex(index);
                    });
                }

                const limitButton = newItem.querySelector('#limit');
                if (limitButton) {
                    limitButton.addEventListener('click', async () => {
                        const index = parseInt(limitButton.dataset.index);
                        this.limitConfig(index);
                    }) 
                }
            });
        }


        const deleteButtons = this.shadowRoot.querySelectorAll('#delete');
        deleteButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const index = parseInt(button.dataset.index);
                this.deleteIndex(index);
            });
        });

        const limitButtons = this.shadowRoot.querySelectorAll('#limit');
        limitButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const index = parseInt(button.dataset.index);
                this.limitConfig(index);
            })
        });

        // 新增保存按钮事件监听
        const saveButton = this.shadowRoot.getElementById('save-config-button');
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                try {
                    // 获取用户路径输入框的值
                    const userPathInput = this.shadowRoot.getElementById('user-path-input');
                    if (userPathInput) {
                        this.config.path = userPathInput.value;
                    }

                    // 获取用户只读复选框的值
                    const readonlyCheckbox = this.shadowRoot.getElementById('user-readonly-checkbox');
                    if (readonlyCheckbox) {
                        this.config.readonly = readonlyCheckbox.checked;
                    }

                    // 获取磁盘配额输入框和单位选择框的值
                    const diskQuotaInput = this.shadowRoot.getElementById('disk-quota-input');
                    const diskQuotaUnitSelect = this.shadowRoot.getElementById('disk-quota-unit-select');
                    if (diskQuotaInput && diskQuotaUnitSelect) {
                        const value = diskQuotaInput.value;
                        const unit = diskQuotaUnitSelect.value;
                        // 组合成磁盘配额字符串
                        this.config.disk_quota = `${value}${unit}`;
                    }

                    // 获取虚拟路径输入框和只读复选框的值
                    const virtualPathItems = this.shadowRoot.querySelectorAll('.virtual-path-item');
                    const newVirtualPaths = {};
                    virtualPathItems.forEach((item, index) => {
                        const nameInput = item.querySelectorAll('input[type="text"]')[0];
                        const pathInput = item.querySelectorAll('input[type="text"]')[1];
                        const readonlyCheckbox = item.querySelector('input[type="checkbox"]');
                        if (nameInput && pathInput && readonlyCheckbox) {
                            const name = nameInput.value;
                            newVirtualPaths[name] = {
                                path: pathInput.value,
                                readonly: readonlyCheckbox.checked,
                                limits: this.config.virtual_paths[name]?.limits || []
                            };
                        }
                    });
                    this.config.virtual_paths = newVirtualPaths;

                    await set_webdav_config(this.config, this.getAttribute('username'));
                    
                    this.dispatchEvent(new CustomEvent('config-saved', { detail: {
                        config :this.config,
                        username : this.getAttribute('username'),
                    
                    } }));
                } catch (error) {
                    console.error('保存 WebDAV 配置失败:', error);
                    alert('保存失败，请重试');
                }
            });
        }
    }
}

customElements.define('webdav-config', WebdavConfigComponent);
