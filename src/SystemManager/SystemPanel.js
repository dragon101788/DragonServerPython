// 引入Chart.js用于绘制动态曲线图
const chartJS = document.createElement('script');
chartJS.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(chartJS);

import { AccountManager } from "/AccountManager.js";

class SystemPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.dataHistory = {
            network_download: [],
            network_upload: [],
            memory_usage: [],
            cpu_usage: []
        };
        this.maxDataPoints = 60;
        this.charts = {};
        this.updateInterval = null;
    }

    connectedCallback() {
        this.render();
        this.initCharts().then(() => {
            this.loadTrafficData();
        });

        AccountManager.Interact("get_system_info", {}, (body) => {
            if (body.type === "system_info_list") {
                for (let [k, v] of Object.entries(body.data)) {
                    this.updatePanel(v);
                }
            }
            else if (body.type === "system_info") {
                this.updatePanel(body.data);
            }
        });

    }

    async loadTrafficData() {
        try {
            // 获取24小时流量数据（示例时间范围）
            const flow_data = await AccountManager.Fetch("get_stage_flow_rate", {
                start: "2025-12-08 15:00:00",
                end: "2025-12-09 15:00:00"
            });

            // 处理24小时流量数据
            this.update24hTrafficChart(flow_data);

            // 获取7天流量数据（示例时间范围）
            const week_flow_data = await AccountManager.Fetch("get_stage_flow_rate", {
                start: "2025-12-02 00:00:00",
                end: "2025-12-09 23:59:59"
            });

            // 处理7天流量数据（按天汇总）
            this.update7dTrafficChart(week_flow_data);
        } catch (error) {
            console.error("加载流量数据失败:", error);
        }
    }

    update24hTrafficChart(data) {
        if (!data || !Array.isArray(data) || data.length === 0) return;

        const labels = data.map(item => {
            // 只显示小时:分钟
            const time = new Date(item.time);
            return `${time.getHours()}:00`;
        });
        const downloadData = data.map(item => item.download);
        const uploadData = data.map(item => item.upload);

        // 更新图表
        this.charts['24h-traffic'].data.labels = labels;
        this.charts['24h-traffic'].data.datasets[0].data = downloadData;
        this.charts['24h-traffic'].data.datasets[1].data = uploadData;
        this.charts['24h-traffic'].update();
    }

    update7dTrafficChart(data) {
        if (!data || !Array.isArray(data) || data.length === 0) return;

        // 按天汇总数据
        const dailyData = {};
        
        data.forEach(item => {
            // 获取日期部分（YYYY-MM-DD）
            const date = item.time.split(' ')[0];
            
            if (!dailyData[date]) {
                dailyData[date] = {
                    download: 0,
                    upload: 0
                };
            }
            
            dailyData[date].download += item.download;
            dailyData[date].upload += item.upload;
        });

        // 转换为图表所需格式
        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates;
        const downloadData = sortedDates.map(date => dailyData[date].download);
        const uploadData = sortedDates.map(date => dailyData[date].upload);

        // 更新图表
        this.charts['7d-traffic'].data.labels = labels;
        this.charts['7d-traffic'].data.datasets[0].data = downloadData;
        this.charts['7d-traffic'].data.datasets[1].data = uploadData;
        this.charts['7d-traffic'].update();
    }
    disconnectedCallback() {
    }

    disconnectedCallback() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        // 销毁图表实例以防止内存泄漏
        Object.values(this.charts).forEach(chart => chart.destroy());
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            .system-panel {
                background: #f5f5f5;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                font-family: Arial, sans-serif;
            }
            .panel-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 20px;
                color: #333;
            }
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 20px;
                padding: 20px;
            }
            .metric-card {
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .metric-label {
                font-size: 14px;
                color: #666;
                margin-bottom: 5px;
            }
            .metric-value {
                font-size: 24px;
                font-weight: bold;
                color: #333;
            }
            .charts-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                padding: 20px;
            }
            .chart-container {
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .chart-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
                color: #333;
            }
            canvas {
                max-width: 100%;
                height: 200px !important;
            }
            @media (max-width: 768px) {
                .charts-container {
                    grid-template-columns: 1fr;
                }
            }
        </style>
        
        <div class="system-panel">
            <h2 class="panel-title">系统监控面板</h2>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">CPU 使用率</div>
                    <div class="metric-value" id="cpu-usage">--</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">内存使用率</div>
                    <div class="metric-value" id="memory-usage">--</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">下载速度</div>
                    <div class="metric-value" id="download-speed">--</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">上传速度</div>
                    <div class="metric-value" id="upload-speed">--</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">系统运行时间</div>
                    <div class="metric-value" id="uptime">--</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">应用运行时间</div>
                    <div class="metric-value" id="app-run-time">--</div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-container">
                    <div class="chart-title">网速监控</div>
                    <canvas id="network-chart"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">CPU使用率监控</div>
                    <canvas id="cpu-chart"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">内存使用率监控</div>
                    <canvas id="memory-chart"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">24小时流量监控</div>
                    <canvas id="24h-traffic-chart"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">7天流量监控</div>
                    <canvas id="7d-traffic-chart"></canvas>
                </div>
            </div>
        </div>
        `;
    }

    async initCharts() {
        // 等待Chart.js加载完成
        if (typeof Chart === 'undefined') {
            await new Promise(resolve => {
                chartJS.onload = resolve;
            });
        }

        // 网速图表
        const networkCtx = this.shadowRoot.getElementById('network-chart').getContext('2d');
        this.charts.network = new Chart(networkCtx, {
            type: 'line',
            data: {
                labels: Array(this.maxDataPoints).fill(''),
                datasets: [
                    {
                        label: '下载速度 (MB/s)',
                        data: Array(this.maxDataPoints).fill(0),
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.1,
                        fill: true
                    },
                    {
                        label: '上传速度 (MB/s)',
                        data: Array(this.maxDataPoints).fill(0),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'MB/s'
                        }
                    }
                },
                animation: {
                    duration: 0 // 禁用动画以提高性能
                }
            }
        });

        // CPU使用率图表
        const cpuCtx = this.shadowRoot.getElementById('cpu-chart').getContext('2d');
        this.charts.cpu = new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: Array(this.maxDataPoints).fill(''),
                datasets: [
                    {
                        label: 'CPU使用率 (%)',
                        data: Array(this.maxDataPoints).fill(0),
                        borderColor: 'rgb(255, 159, 64)',
                        backgroundColor: 'rgba(255, 159, 64, 0.1)',
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: '百分比 (%)'
                        }
                    }
                },
                animation: {
                    duration: 0 // 禁用动画以提高性能
                }
            }
        });

        // 内存使用率图表
        const memoryCtx = this.shadowRoot.getElementById('memory-chart').getContext('2d');
        this.charts.memory = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: Array(this.maxDataPoints).fill(''),
                datasets: [
                    {
                        label: '内存使用率 (%)',
                        data: Array(this.maxDataPoints).fill(0),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: '百分比 (%)'
                        }
                    }
                },
                animation: {
                    duration: 0 // 禁用动画以提高性能
                }
            }
        });

        // 24小时流量监控图表
        const traffic24hCtx = this.shadowRoot.getElementById('24h-traffic-chart').getContext('2d');
        this.charts['24h-traffic'] = new Chart(traffic24hCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '下载流量',
                        data: [],
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '上传流量',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '流量'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '时间'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                animation: {
                    duration: 500
                }
            }
        });

        // 7天流量监控图表
        const traffic7dCtx = this.shadowRoot.getElementById('7d-traffic-chart').getContext('2d');
        this.charts['7d-traffic'] = new Chart(traffic7dCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '下载流量',
                        data: [],
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '上传流量',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '总流量'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '日期'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                animation: {
                    duration: 500
                }
            }
        });
    }


    updatePanel(data) {
        // 更新指标卡片
        this.shadowRoot.getElementById('cpu-usage').textContent = `${data.cpu_usage.toFixed(1)}%`;
        this.shadowRoot.getElementById('memory-usage').textContent = `${data.memory_usage.toFixed(1)}%`;
        this.shadowRoot.getElementById('download-speed').textContent = `${data.network_download[data.network_download.length - 1] || 0} MB/s`;
        this.shadowRoot.getElementById('upload-speed').textContent = `${data.network_upload[data.network_upload.length - 1] || 0} MB/s`;
        this.shadowRoot.getElementById('uptime').textContent = this.formatTime(data.uptime);
        this.shadowRoot.getElementById('app-run-time').textContent = this.formatTime(data.app_run_time);

        // 更新数据历史
        this.updateDataHistory(data);
        
        // 更新图表
        this.updateCharts();
    }

    updateDataHistory(data) {
        // 更新网速数据
        if (data.network_download.length > 0) {
            const lastDownload = data.network_download[data.network_download.length - 1];
            this.dataHistory.network_download.push(lastDownload);
            if (this.dataHistory.network_download.length > this.maxDataPoints) {
                this.dataHistory.network_download.shift();
            }
        }

        if (data.network_upload.length > 0) {
            const lastUpload = data.network_upload[data.network_upload.length - 1];
            this.dataHistory.network_upload.push(lastUpload);
            if (this.dataHistory.network_upload.length > this.maxDataPoints) {
                this.dataHistory.network_upload.shift();
            }
        }

        // 更新CPU使用率数据
        this.dataHistory.cpu_usage.push(data.cpu_usage);
        if (this.dataHistory.cpu_usage.length > this.maxDataPoints) {
            this.dataHistory.cpu_usage.shift();
        }

        // 更新内存使用率数据
        this.dataHistory.memory_usage.push(data.memory_usage);
        if (this.dataHistory.memory_usage.length > this.maxDataPoints) {
            this.dataHistory.memory_usage.shift();
        }
    }

    updateCharts() {
        // 更新网速图表
        if (this.charts.network) {
            this.charts.network.data.datasets[0].data = [...this.dataHistory.network_download];
            this.charts.network.data.datasets[1].data = [...this.dataHistory.network_upload];
            this.charts.network.update('none');
        }

        // 更新CPU使用率图表
        if (this.charts.cpu) {
            this.charts.cpu.data.datasets[0].data = [...this.dataHistory.cpu_usage];
            this.charts.cpu.update('none');
        }

        // 更新内存使用率图表
        if (this.charts.memory) {
            this.charts.memory.data.datasets[0].data = [...this.dataHistory.memory_usage];
            this.charts.memory.update('none');
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// 定义自定义元素
customElements.define('system-panel', SystemPanel);