import { AccountManager } from '/AccountManager.js';

class FFmpegControl extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
    }
    async connectedCallback() {
        await this.render();
        await this.setupEventListeners();

        AccountManager.register_ws_recv_callback("ffmpeg_status",async (data)=>{
            await this.updateStatus(data);
        })
        AccountManager.register_ws_recv_callback("ffmpeg_queue",async (data)=>{
            await this.updateQueue(data);
        })
  

        // 初始加载
        fetch('/api/ffmpeg/get_info', {
            method: 'GET',
            credentials: 'include'
        }).then(async response => {
            if (response.ok) {
                const data = await response.json();
                await this.updateStatus(data);
            }
        })
        
        await fetch('/api/ffmpeg/get_queue',{
            method: 'GET',
            credentials: 'include'
        }).then(async response => {
            if (response.ok) {
                const data = await response.json();
                await this.updateQueue(data);
            }
        })
    }
    disconnectedCallback() {
        AccountManager.unregister_ws_recv_callback("ffmpeg_status");
        AccountManager.unregister_ws_recv_callback("ffmpeg_queue");
    }
    async render() {
        
        this.shadowRoot.innerHTML = /*html*/`
            <style>
                body {
                    font-family: 'Microsoft YaHei', sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .section {
                    margin-bottom: 20px;
                    padding: 15px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                }
                .progress-container {
                    margin-top: 10px;
                }
                progress {
                    width: 100%;
                    height: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                }
                input[type="text"] {
                    width: 70%;
                    padding: 8px;
                    margin-right: 10px;
                }
                button {
                    padding: 8px 15px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                .status {
                    font-weight: bold;
                }
                .idle {
                    color: green;
                }
                .transcoding {
                    color: orange;
                }
                .error {
                    color: red;
                }
                /* 新增的队列项样式 */
                .queue-item, .done-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px;
                    margin: 5px 0;
                    border-radius: 4px;
                    background-color: #f8f9fa;
                }
                .pending {
                    border-left: 4px solid #ffc107;
                    opacity: 0.7;
                }
                .success {
                    border-left: 4px solid #28a745;
                    opacity: 0.7;
                }
                .error {
                    border-left: 4px solid #dc3545;
                    opacity: 0.7;
                }
                .queue-item span, .done-item span {
                    flex: 1;
                    min-width: 0;
                    padding: 0 5px;
                    white-space: normal;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    text-overflow: ellipsis;
                }
            </style>
            
            <h2 title id="title"></h2>
            <div class="config-section">
            <h3>FFmpeg 配置</h3>
                <label for="ffmpeg-path">FFmpeg 路径:</label>
                <input type="text" id="ffmpeg-path" placeholder="请输入 FFmpeg 路径">
                <button id="save-config">保存配置</button>
            </div>
            <div class="section" id="status-info">
                <div>
                    <p>状态: <span id="status" class="status idle">Idle</span></p>
                    <p>当前文件: <span id="current-file">无</span></p>
                    <p>已用时: <span id="elapsed-time">0</span>秒</p>
                    <p>剩余时间: <span id="remaining-time">0</span>秒</p>
                    <div class="progress-container">
                        <p>进度: <span id="progress">0</span>%</p>
                        <progress id="progress-bar" value="0" max="100"></progress>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>转码队列</h2>
                <table id="queue-table">
                </table>
            </div>
                
            </div>
        `;

        
        const response = await fetch('/api/ffmpeg/ffmpeg_get_config',{
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            }
        })
        if (response.ok) {
            this.config = await response.json();
            this.shadowRoot.querySelector('#ffmpeg-path').value = this.config.path;
        }
    }

    async setupEventListeners() {
        
        const saveConfigButton = this.shadowRoot.getElementById('save-config');
        saveConfigButton.addEventListener('click', async () => {
            const ffmpegPath = this.shadowRoot.getElementById('ffmpeg-path').value;
            this.config.path = ffmpegPath;
            try {
                
                const response = await fetch('/api/ffmpeg/ffmpeg_set_config', {
                    method: 'POST',
                    credentials: 'include',
            headers: {
                        'Content-Type': 'application/json',
                        
                    },
                    body: JSON.stringify(this.config)
                });
                if (!response.ok) {
                    throw new Error('保存配置失败');
                }
                const title = this.shadowRoot.getElementById('title');
                title.textContent = 'FFmpeg 配置已保存';
            } catch (error) {
                const title = this.shadowRoot.getElementById('title');
                title.textContent = `保存配置失败: ${error.message}`;
            }
        });
        
    }
    // 以下是原文件中的功能方法
    async updateStatus(data) {
        
        const statusInfo = this.shadowRoot.getElementById('status-info');
        if (data.status === 'Idle') {
            
            statusInfo.style.display = 'none';
        }else if (data.status ===  'Error') {

            statusInfo.style.display = 'block';
            statusInfo.innerHTML = `
                <div>
                    <p>状态: <span id="status" class="status error">${data.status}</span></p>
                    <p>当前文件: <span id="current-file">${data.current_file}</span></p>
                    <p>错误信息: <span id="error-info">${data.reason}</span></p>
                </div>
            `;
        } else {
            
            statusInfo.style.display = 'block';

            let remainingTime = '--';
            if (data.progress > 0) {
                remainingTime = this.formatTime(Math.round((data.elapsed_time * 100 / data.progress) - data.elapsed_time));
            } 

            statusInfo.innerHTML = `
                <div>
                    <p>当前文件: <span id="current-file">${data.current_file }</span></p>
                    <p>已用时: <span id="elapsed-time">${this.formatTime(data.elapsed_time)}</p>
                    <p>剩余时间: <span id="remaining-time">${remainingTime}</p>
                    <div class="progress-container">
                        <p>进度: <span id="progress">${data.progress}</span>%</p>
                        <progress id="progress-bar" value="${data.progress}" max="100"></progress>
                    </div>
                </div>
            `;
        }
    }

    async updateQueue(data) {
        try {
            
            
            // 更新任务队列
            const queueTable = this.shadowRoot.querySelector('#queue-table');
            queueTable.innerHTML = data.queue.map(task => `
                <div class="queue-item ${task.status}">
                    <span>${task.path}</span>
                    <span>${task.reason|| ""}</span>
                    <span>${task.start_time|| ""}</span>
                </div>
            `).join('');
            
            queueTable.innerHTML += data.done.map(task => `
                <div class="done-item ${task.status}">
                    <span>${task.path}</span>
                    <span>${task.reason|| ""}</span>
                    <span>${task.start_time|| ""}</span>
                    <span>${task.finish_time|| ""}</span>
                </div>
            `).join('');

            
        } catch (error) {
            console.error('获取队列失败:', error);
        }
    }

    async  addTask(filePath ) {
        try {
            // 对路径进行URL编码
            const encodedPath = encodeURIComponent(filePath);
            const response = await fetch(`/api/ffmpeg/add_task/${encodedPath}`, {
                method: 'POST',
                credentials: 'include',
            headers: {
                    'Content-Type': 'application/json',
                    
                }
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                
                throw new Error(errorData.detail || '添加任务失败');
            }
            const title = this.shadowRoot.getElementById('title');
            title.textContent = `
                ${filePath}正在转码中,请稍后访问,先预览其他已转码的视频..
            `;
            const result = await response.json();
            this.filePath = result.path;
            return result;
        } catch (error) {
            const title = this.shadowRoot.getElementById('title');
            title.textContent = `
                ${filePath}  ${error.message}
            `;
            throw error;
        }
    }


    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

customElements.define('ffmpeg-control', FFmpegControl);