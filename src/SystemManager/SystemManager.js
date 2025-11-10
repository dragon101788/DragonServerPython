// 导入 rebootSystem 函数
import { AccountManager } from '/AccountManager.js';
import { InputDialog } from '/BaseModal.js';
import {SystemLog} from '/SystemManager/SystemLog.js';



import '/lib/chart.js';// 导入 Chart 组件 ,不要动这个,chart.js在本地目录下SystemManager,并没有esm导出

class SystemManager extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.logWebSocket = null;
        this.networkChart = null; // 新增图表实例
        this.lastserverStatusList = null;
    }

    async loadServerList(serverStatusList) {
        try {
            if (JSON.stringify(this.lastserverStatusList) !== JSON.stringify(serverStatusList))
            {
                this.lastserverStatusList = serverStatusList;
                const serverListElement = this.shadowRoot.getElementById('server-list');
                if (serverListElement) {
                    let serverHTML = "";
                    for (const server of serverStatusList) {
                        if (server.enabled === false) {
                            continue;
                        }
                        let actionButton = '';
                        if (server.type === 'uvicorn') {
                            // 根据服务状态生成不同按钮
                            if (server.status === 'Running') {
                                // 使用 encodeURIComponent 编码 JSON 字符串
                                actionButton = `<button class="stop-server" data-server="${encodeURIComponent(JSON.stringify(server))}" style="background-color:#cc2222;">停止</button>`;
                            } else {
                                // 使用 encodeURIComponent 编码 JSON 字符串
                                actionButton = `<button class="start-server" data-server="${encodeURIComponent(JSON.stringify(server))}" style="background-color:#229922;">启动</button>`;
                            }
                            serverHTML += /*html*/`
                            <div class="server-item">
                                <!-- 应用 row-form 类 -->
                                <div class="line-form" style="width: 90%;">
                                    <div class="row-form">
                                        <span class="info-label">服务类型:</span> <span class="info-value">${server.type}</span>
                                        <span class="info-label">端口号:</span> <span class="info-value">${server.port}</span>
                                        <span class="info-label">服务状态:</span> <span class="info-value">${server.status}</span>
                                        
                                    </div>
                                </div>
                                ${actionButton}
                            </div>`;
                        } else if (server.type === 'Hosted Service') {
                            // 根据服务状态生成不同按钮
                            if (server.status === 'Running') {
                                // 使用 encodeURIComponent 编码 JSON 字符串
                                actionButton = `<button class="stop-server" data-server="${encodeURIComponent(JSON.stringify(server))}" style="background-color:#cc2222;">停止</button>`;
                            } else {
                                // 使用 encodeURIComponent 编码 JSON 字符串
                                actionButton = `<button class="start-server" data-server="${encodeURIComponent(JSON.stringify(server))}" style="background-color:#229922;">启动</button>`;
                            }
                            serverHTML += /*html*/`
                            <div class="server-item">
                                <!-- 应用 line-form 类 -->
                                <div class="line-form" style="width: 90%;">
                                    <div class="row-form">
                                        <span class="info-label">服务路径:</span> <span class="info-value">${server.path}</span>
                                    </div>
                                    <!-- 应用 row-form 类 -->
                                    <div class="row-form">
                                        <span class="info-label">服务类型:</span> <span class="info-value" style="width: 90%;">${server.type}</span>
                                        <span class="info-label">服务状态:</span> <span class="info-value">${server.status}</span>
                                    </div>
                                </div>
                                ${actionButton}
                            </div>`; 
                        }
                    }

                    serverListElement.innerHTML = `
                        <h2>服务列表</h2>
                        ${serverHTML}
                    `;

                    // 为启动和停止按钮添加事件监听器
                    this.setupServerActionListeners();
                }
            }
            
        } catch (error) {
            console.error('加载服务列表失败:', error);
        }
    }

    setupServerActionListeners() {
        const startButtons = this.shadowRoot.querySelectorAll('.start-server');
        const stopButtons = this.shadowRoot.querySelectorAll('.stop-server');

        startButtons.forEach(button => {
            button.addEventListener('click', async () => {
                try {
                    // 使用 decodeURIComponent 解码并解析 JSON 字符串
                    const server = JSON.parse(decodeURIComponent(button.dataset.server));
                    const data = await start_server(server);
                } catch (parseError) {
                    console.error('解析 server 对象失败:', parseError);
                }
            });
        });

        stopButtons.forEach(button => {
            button.addEventListener('click', async () => {
                try {
                    // 使用 decodeURIComponent 解码并解析 JSON 字符串
                    const server = JSON.parse(decodeURIComponent(button.dataset.server));
                    const data = await stop_server(server);
                } catch (parseError) {
                    console.error('解析 server 对象失败:', parseError);
                }
            });
        });
    }

    async startUvicornServer(port) {
        try {
            // 调用启动 Uvicorn 服务的 API
            await startUvicornService(port);
            alert('Uvicorn 服务启动成功');
        } catch (error) {
            console.error('启动 Uvicorn 服务失败:', error);
            alert('启动 Uvicorn 服务失败');
        }
    }

    async stopUvicornServer(port) {
        try {
            // 调用停止 Uvicorn 服务的 API
            await stopUvicornService(port);
            alert('Uvicorn 服务停止成功');
        } catch (error) {
            console.error('停止 Uvicorn 服务失败:', error);
            alert('停止 Uvicorn 服务失败');
        }
    }

    async startHostedService(path) {
        try {
            // 调用启动托管服务的 API
            await startHostedServiceAPI(path);
            alert('托管服务启动成功');
        } catch (error) {
            console.error('启动托管服务失败:', error);
            alert('启动托管服务失败');
        }
    }

    async stopHostedService(path) {
        try {
            // 调用停止托管服务的 API
            await stopHostedServiceAPI(path);
            alert('托管服务停止成功');
        } catch (error) {
            console.error('停止托管服务失败:', error);
            alert('停止托管服务失败');
        }
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        
        console.log('SystemManager 加载');
    }

    disconnectedCallback() {
        // 销毁图表实例
        AccountManager.unregister_ws_recv_callback("system_log");
        AccountManager.unregister_ws_recv_callback("system_info");
        if (this.networkChart) {
            this.networkChart.destroy();
        }
    }
    


    // 更新图表数据（示例方法，需根据实际 API 调整）
    async updateNetworkChart() {
        try {
            // 假设存在获取网速数据的 API
            const networkData = await getNetworkData(); 
            this.networkChart.data.datasets[0].data = networkData;
            this.networkChart.update();
        } catch (error) {
            console.error('更新网速图表失败:', error);
        }
    }

    onTabActive() {
       console.log('SystemManager 激活'); 
       
       AccountManager.register_ws_recv_callback("system_info",async (data)=>{
        
            this.loadSystemInfo(data)
       })
    }
    onTabEscape() {
        console.log('SystemManager 离开');
        AccountManager.unregister_ws_recv_callback("system_info");
    }
    loadSystemInfo(systemInfo) {
        const systemInfoElement = this.shadowRoot.getElementById('system-info');
        systemInfoElement.innerHTML = `
            <p>CPU 使用率: ${systemInfo.cpu_usage}%</p>
            <p>内存使用率: ${systemInfo.memory_usage}%</p>
            <p>系统运行时间: ${this.formatUptime(systemInfo.uptime)}</p>
            <p>服务运行时间: ${this.formatUptime(systemInfo.app_run_time)}</p>
        `;

        const chartData = this.networkChart.data;

        
        chartData.datasets[0].data=systemInfo.network_download;
        const cur_download = systemInfo.network_download[systemInfo.network_download.length - 1];
        chartData.datasets[0].label = `入口网速 ${cur_download}M`;

        chartData.datasets[1].data=systemInfo.network_upload;
        const cur_upload = systemInfo.network_upload[systemInfo.network_upload.length - 1];
        chartData.datasets[1].label = `出口网速 ${cur_upload}M`;
        
        chartData.labels = Array.from({ length: systemInfo.network_download.length }, (_, i) => i + 1);

        this.networkChart.update('none'); // 更新图表
       
    }

    setupEventListeners() {
    }
    formatUptime(seconds) {
            const days = Math.floor(seconds / (3600 * 24));
            if (days > 0) {
                const hours = Math.floor((seconds % (3600 * 24)) / 3600);
                return `${days}天${hours}小时`;
            }
            const hours = Math.floor(seconds / 3600);
            if (hours > 0) {
                const minutes = Math.floor((seconds % 3600) / 60);
                return `${hours}小时${minutes}分钟`;
            }
            const minutes = Math.floor(seconds / 60);
            if (minutes > 0) {
                return `${minutes}分钟`; 
            }
            else {
                return `${seconds.toFixed(2)}秒`; 
            }
            
        }


    async init() {
        const session = await AccountManager.getUserSession();
    }

   

    render() {
        const style = /*css*/`
            :host {
                display: block;
                /* 确保在内容超出时显示滚动条 */
                overflow-y: auto;
                width: 100%;
                height: 100%;
            }
            .container {
                display: flex; 
                flex-direction: column; 
                /* 确保在内容超出时显示滚动条 */
                overflow-y: auto;
                /* 让容器高度自适应 */
                height: 100%; 
            }

            .system-info {
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 4px; 
                line-height: 0.2; 
            }
            .control-buttons  {
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 10px;
                
                display: grid;
                grid-template-columns: repeat(3, 1fr); 
                gap: 1px; 
            }

            .network-chart {
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 10px;
            }


            .top-section {
                flex-shrink: 0; 
                display: flex;
                flex-direction: row; 
                /* 确保在内容超出时显示滚动条 */
                overflow-x: auto;
            }
            button {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 5px 15px;
                border-radius: 4px;
                max-height : 40px;
                cursor: pointer;
                margin: 5px; 
            }

            button:hover {
                background-color: #c82333;
            }
            #network-chart-canvas {
                min-height: 200px; 
                max-width: 100%; 
            }

            /* 新增服务列表样式 */
            .server-item {
                border: 1px solid #dee2e6; /* 添加边框 */
                border-radius: 4px;
                padding: 10px;
                max-width :1200px;
                margin-bottom: 10px; /* 服务项之间的间距 */
                display: flex;
                align-items: center;
            }

            /* 合并横向布局样式 */
            .row-form {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
            }

            /* 合并纵向布局样式 */
            .line-form {
                display: flex;
                flex-direction: column;
            }

            .info-label {
                font-weight: bold; /* 标签加粗 */
                width: 80px; /* 设置固定宽度，可按需调整 */
                display: inline-block; /* 让元素以块级元素显示，支持宽度设置 */
                text-align: right; /* 文本右对齐 */
                margin-right: 5px; /* 右侧添加间距 */
            }

            .info-value {
                display: inline-block; /* 让元素以块级元素显示，支持宽度设置 */
                text-align: left; /* 文本左对齐 */
                margin-left: 5px; /* 左侧添加间距 */
                color: #333; /* 数值颜色 */
            }



            .hosted-service-path {
                margin-bottom: 10px;
            }


        `;

        const html = /*html*/`
            <div class="container">
                <div class="top-section">
                    <div class="system-info" id="system-info">
                        <h2>系统信息</h2>
                    </div>
                    
                    <canvas id="network-chart-canvas" width="500" height="200"></canvas>
                </div>
                
                <system-log></system-log>
            </div>
        `;

        this.shadowRoot.innerHTML = `
            <style>
                ${style}
            </style>
            ${html}
        `;

        const ctx = this.shadowRoot.getElementById('network-chart-canvas').getContext('2d');
        
        this.networkChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [], 
                datasets: [{
                    label: '入口网速 xx/bps', 
                    data: [], 
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    pointRadius: 0, 
                    tension: 0.4 
                },{
                    label: '出口网速 xx/bps', 
                    data: [], 
                    backgroundColor: 'rgba(192, 141, 75, 0.2)',
                    borderColor: 'rgb(240, 76, 0)',
                    borderWidth: 1,
                    pointRadius: 0, 
                    tension: 0.4 
                }]
            },
            options: {
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        beginAtZero: true
                    }
                },
            }
        });
    }
}

customElements.define('system-manager', SystemManager);
