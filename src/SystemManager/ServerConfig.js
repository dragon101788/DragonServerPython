// 导入接口函数
import { AccountManager } from '/AccountManager.js';
import { get_server_config, update_server_config,rebootServer } from './api.js';

class ServerConfig extends HTMLElement {

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.config = null;
    }

    
    connectedCallback() {
        this.render();
        this.setupEventListeners();
        
    }

    init()
    {
        this.loadConfig();
    }
    async loadConfig() {
        try {
            this.renderServerList();
            this.updateSettingsDisplay();
        } catch (error) {
            console.error('加载服务器配置失败:', error);
        }
    }

    updateSettingsDisplay() {
        if (this.config) {
            const logLevelInput = this.shadowRoot.getElementById('log-level');
            const systemMonitorSpeedInput = this.shadowRoot.getElementById('system-monitor-speed');
            if (logLevelInput) {
                logLevelInput.value = this.config.log_level || 1;
            }
            if (systemMonitorSpeedInput) {
                systemMonitorSpeedInput.value = this.config.SystemMonitorSpeed || '';
            }
        }
    }


 

    removeServer(index) {
        this.config.server_list.splice(index, 1);
        this.renderServerList();
    }

    createUvicornServerItem(server,index) {
        return /*html*/ `
        <div class="server-item">
            <!-- 新增服务类型标签 -->
            <div class="setting-item inline-items">
                <label>服务类型:</label>
                <label>${server.type}</label>
                <label>启用状态:</label>
                <input type="checkbox" ${server.enabled ? 'checked' : ''} data-field="enabled" data-index="${index}">
            </div>
            <div class="setting-item inline-items">
                <label>App 路径:</label>
                <input type="text" value="${server.app}" data-field="app" data-index="${index}" style="width:400px;">
            </div>
            <!-- 将主机地址和端口号放在同一行 -->
            <div class="setting-item inline-items">
                <label>主机地址:</label>
                <input type="text" value="${server.config.host}" data-field="config.host" data-index="${index}" style="width: 200px; margin-right: 10px;">
                <label>端口号:</label>
                <input type="number" value="${server.config.port}" data-field="config.port" data-index="${index}" style="width: 100px;">
            </div>
            <div class="setting-item inline-items">
                <label>启用 SSL:</label>
                <!-- 修改为勾选框 -->
                <input type="checkbox" ${server.config.ssl === 'search_file' ? 'checked' : ''} data-field="config.ssl" data-index="${index}">
                <label>队列长度:</label>
                <input type="number" value="${server.config.backlog}" data-field="config.backlog" data-index="${index}">
            </div>
            <button class="remove-btn" data-index="${index}">删除</button>
        </div>
        `;
    }
    createHostedServiceItem(server,index) {
        return /*html*/ `
        <div class="server-item">
            <!-- 新增服务类型标签 -->
            <div class="setting-item inline-items">
                <label>服务类型:</label>
                <label>${server.type}</label>
                
                <label>启用状态:</label>
                <input type="checkbox" ${server.enabled ? 'checked' : ''} data-field="enabled" data-index="${index}">
            </div>
            <div class="setting-item inline-items">
                <label>程序路径:</label>
                <input type="text" value="${server.path}" data-field="path" data-index="${index}" style="width:400px;">
            </div> 
            <div class="setting-item inline-items">
                <label>工作目录:</label>
                <input type="text" value="${server.cwd}" data-field="cwd" data-index="${index}" style="width: 200px; margin-right: 10px;">
                <label>启动参数:</label>
                <input type="text" value="${server.args}" data-field="args" data-index="${index}" style="width: 100px;">
            </div>
            <button class="remove-btn" data-index="${index}">删除</button>
        </div>
        `;
    }
    renderServerList() {
        const serverListElement = this.shadowRoot.getElementById('server-list');
        if (serverListElement && this.config && this.config.server_list) {
            // 初始化 innerHTML 为空字符串
            serverListElement.innerHTML = '';
            // 使用 for 循环遍历 server_list
            for (let index = 0; index < this.config.server_list.length; index++) {
                const server = this.config.server_list[index];
                if (server.type === 'uvicorn') {
                    serverListElement.innerHTML += this.createUvicornServerItem(server,index);
                }
                else if (server.type === 'Hosted Service') {
                    serverListElement.innerHTML += this.createHostedServiceItem(server,index); 
                }
                
            }
        }
    }

    setupEventListeners() {
        const addBtn = this.shadowRoot.getElementById('add-unicorn-server-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {

                const newServer = {
                    "type": "uvicorn",
                    "enabled": true,
                    "app": "WebServer:app",
                    "config": {
                        "host": "0.0.0.0",
                        "port": 8000,
                        "ssl": "search_file",
                        "backlog": 100
                    }
                };
                this.config.server_list.push(newServer);
                this.renderServerList();
            });
        }
        const addHostedServiceBtn = this.shadowRoot.getElementById('add-hosted-server-btn');
        if (addHostedServiceBtn) {
            addHostedServiceBtn.addEventListener('click', () => {

                const newServer = {
                    "type": "Hosted Service",
                    "enabled": true,
                    "path": "D:/aaa.exe",
                    "cwd" : null,
                    "args" : null, 
                };
                this.config.server_list.push(newServer);
                this.renderServerList();
            }) 
        }

        const saveBtn = this.shadowRoot.getElementById('save-config-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                try {
                    await update_server_config(this.config);
                } catch (error) {
                    console.error('保存服务器配置失败:', error);
                    alert('配置保存失败');
                }
            });
        }

        const SaveAndResetBtn = this.shadowRoot.getElementById('save-config-and-reset-btn');
        if (SaveAndResetBtn) {
            SaveAndResetBtn.addEventListener('click', async () => {
                try {
                    await update_server_config(this.config);
                    await rebootServer();
                    alert('配置保存成功，正在重启服务器');
                    window.location.reload();
                }
                catch (error) {
                    console.error('保存服务器配置失败:', error);
                    alert('配置保存失败'); 
                }
                
            });
        }


        const serverListElement = this.shadowRoot.getElementById('server-list');
        if (serverListElement) {
            // 处理删除按钮点击事件
            serverListElement.addEventListener('click', (event) => {
                if (event.target.classList.contains('remove-btn')) {
                    const index = parseInt(event.target.dataset.index);
                    this.removeServer(index);
                }
            });

            // 处理输入框值变化事件
            serverListElement.addEventListener('input', (event) => {
                if (event.target.tagName === 'INPUT') {
                    const index = parseInt(event.target.dataset.index);
                    const field = event.target.dataset.field;
                    const value = event.target.type === 'number' ? parseInt(event.target.value) : event.target.value;

                    if (field.includes('.')) {
                        const [objKey, propKey] = field.split('.');
                        this.config.server_list[index][objKey][propKey] = value;
                    } else {
                        this.config.server_list[index][field] = value;
                    }
                }
            });

            // 处理 checkbox 变化事件
            serverListElement.addEventListener('change', (event) => {
                if (event.target.type === 'checkbox') {
                    const index = parseInt(event.target.dataset.index);
                    const field = event.target.dataset.field;
                    if (field === 'config.ssl') {
                        this.config.server_list[index].config.ssl = event.target.checked ? 'search_file' : 'off';
                    } else if (field === 'enabled') {
                        this.config.server_list[index].enabled = event.target.checked;
                    }
                }
            });
        }

        const logLevelInput = this.shadowRoot.getElementById('log-level');
        if (logLevelInput) {
            logLevelInput.addEventListener('change', (event) => {
                this.config.log_level = parseInt(event.target.value);
            });
        }

        const systemMonitorSpeedInput = this.shadowRoot.getElementById('system-monitor-speed');
        if (systemMonitorSpeedInput) {
            systemMonitorSpeedInput.addEventListener('change', (event) => {
                this.config.SystemMonitorSpeed = event.target.value;
            });
        }
    }

    render() {
        const style = /*css*/`
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            .container {
                padding: 20px;
            }
            .server-item {
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 10px;
                margin-bottom: 10px;
            }
            .remove-btn {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 5px 15px;
                border-radius: 4px;
                cursor: pointer;
            }
            .action-buttons {
                margin-top: 20px;
            }
            button {
                background-color: #007bff;
                color: white;
                border: none;
                padding: 5px 15px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
            }
            button:hover {
                background-color: #0056b3;
            }
            label {
                display: inline-block;
                width: auto; /* 移除固定宽度 */
                margin-right: 5px;
                margin-bottom: 10px;
                vertical-align: middle; /* 垂直居中对齐 */
            }
            span {
                display: inline-block;
                vertical-align: middle; /* 垂直居中对齐 */
                margin-right: 20px; /* 增加服务类型和启用状态之间的间距 */
            }
            input {
                padding: 5px;
                border: 1px solid #ccc;
                border-radius: 4px;
                vertical-align: middle; /* 垂直居中对齐 */
            }
            /* 新增样式让地址和端口在同一行 */
            .inline-items {
                display: flex;
                align-items: center;
                width: 100%; /* 设置宽度为 100% */
            }
            .inline-items label {
                width: auto;
                margin-right: 5px;
                margin-bottom: 10px;
            }
        `;

        const html = /*html*/`
            <div class="container">
                <h2>服务器配置</h2>
                <div class="inline-items">
                    <label for="log-level">日志级别 (log_level):</label>
                    <input type="number" id="log-level" min="1" value="1">
                </div>
                <div class="inline-items">
                    <label for="system-monitor-speed">系统监控速度 (SystemMonitorSpeed):</label>
                    <input type="number" id="system-monitor-speed">
                </div>
                <div id="server-list"></div>
                <div class="action-buttons">
                    <button id="add-unicorn-server-btn">新增uvicorn服务</button>
                    <button id="add-hosted-server-btn">新增托管服务</button>
                    <button id="save-config-btn">保存配置</button>
                    <button id="save-config-and-reset-btn" style="background-color:#ff2222;">保存配置并重启服务</button>
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = `
            <style>
                ${style}
            </style>
            ${html}
        `;
    }
}

customElements.define('server-config', ServerConfig);
