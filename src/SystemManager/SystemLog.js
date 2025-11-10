
import { AccountManager } from '/AccountManager.js';

await AccountManager.init();

// SystemLog.js - 自定义日志组件
export class SystemLog extends HTMLElement {
    constructor() {
        super();
        
        // 创建Shadow DOM
        this.attachShadow({ mode: 'open' });
        
        // 状态变量
        this.autoscrollLog = true;
        this.isResizing = false;
    }
    
    // 当元素被插入到DOM中时调用
    connectedCallback() {
        // 渲染组件
        this.render();
        
        // 绑定事件
        this.bindEvents();

        
        // 获取日志
        this.getLogs();
        AccountManager.register_ws_recv_callback("system_log", (message) => {
            this.logMessage(message);
        });
    }
    disconnectedCallback() {
        // 注销WebSocket接收回调
        AccountManager.unregister_ws_recv_callback("system_log");
    }
    
    // 使用innerHTML渲染组件
    render() {
        const html = `
            <style>
                :host {
                    display: block;
                    background-color: #1f2937;
                    color: white;
                    border-top: 1px solid #374151;
                    display: flex;
                    flex-direction: column;
                    height: 300px;
                    position: relative;
                }
                
                .log-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem;
                    background-color: #111827;
                    border-bottom: 1px solid #374151;
                }
                
                .log-title {
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                
                .log-controls {
                    display: flex;
                    gap: 0.25rem;
                }
                
                .log-btn {
                    font-size: 0.75rem;
                    color: #9ca3af;
                    background: none;
                    border: none;
                    padding: 0.25rem;
                    border-radius: 0.25rem;
                    cursor: pointer;
                }
                
                .log-btn:hover {
                    color: white;
                    background-color: #374151;
                }
                
                .log-btn.active {
                    color: #34d399;
                }
                
                .log-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.5rem;
                    font-family: monospace;
                    font-size: 0.875rem;
                    line-height: 1.5;
                    /* 暗色滚动条样式 */
                    scrollbar-width: thin;
                    scrollbar-color: #4b5563 #1f2937;
                }
                
                /* WebKit浏览器滚动条样式 */
                .log-content::-webkit-scrollbar {
                    width: 8px;
                }
                
                .log-content::-webkit-scrollbar-track {
                    background: #1f2937;
                }
                
                .log-content::-webkit-scrollbar-thumb {
                    background-color: #4b5563;
                    border-radius: 4px;
                    border: 2px solid #1f2937;
                }
                
                .log-content::-webkit-scrollbar-thumb:hover {
                    background-color: #6b7280;
                }
                
                .log-entry {
                    margin-bottom: 0.25rem;
                    word-wrap: break-word;
                }
                
            </style>
            
            
            <div class="log-header">
                <div class="log-title">系统日志</div>
                <div class="log-controls">
                    <button id="clear-log-btn" class="log-btn">清除日志</button>
                    <button id="autoscroll-toggle" class="log-btn active">自动滚动</button>
                </div>
            </div>
            
            <div id="log-content" class="log-content"></div>
        `;
        
        this.shadowRoot.innerHTML = html;
        
        // 保存引用
        this.clearLogBtn = this.shadowRoot.getElementById('clear-log-btn');
        this.autoscrollToggle = this.shadowRoot.getElementById('autoscroll-toggle');
        this.logContent = this.shadowRoot.getElementById('log-content');
    }
    
    bindEvents() {
        // 绑定清除日志按钮事件
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
        
        // 绑定自动滚动切换事件
        this.autoscrollToggle.addEventListener('click', () => this.toggleAutoscroll());
    }
    
    
    
    // 公开方法
    async getLogs() {
        try {
            const response = await fetch('/api/get_history_log');
            if (!response.ok) throw new Error('获取日志失败');
            const data = await response.json();
            const logs = JSON.parse(data);
            
            // 检查返回的数据格式
            if (Array.isArray(logs)) {
                logs.forEach(log => this.logMessage(log));
            } else if (typeof logs === 'object' && logs.logs) {
                logs.logs.forEach(log => this.logMessage(log));
            }
        } catch (error) {
            console.error('获取日志出错:', error);
            this.logMessage(`错误: 获取日志失败 - ${error.message}`);
        }
    }
    
    logMessage(message) {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        // 格式化消息
        let formattedMessage = '';
        if (typeof message === 'object') {
            // 如果是对象，格式化显示
            const timestamp = new Date().toLocaleString();
            const level = message.level || 'INFO';
            const content = message.content || JSON.stringify(message);
            formattedMessage = `[${timestamp}] [${level}] ${content}`;
        } else {
            // 如果是字符串，直接使用
            const timestamp = new Date().toLocaleString();
            formattedMessage = `[${timestamp}] ${message}`;
        }
        
        logEntry.textContent = formattedMessage;
        
        // 根据消息内容设置样式
        if (formattedMessage.includes('错误') || formattedMessage.includes('ERROR')) {
            logEntry.style.color = '#ef4444';
        } else if (formattedMessage.includes('成功') || formattedMessage.includes('SUCCESS')) {
            logEntry.style.color = '#10b981';
        } else if (formattedMessage.includes('正在') || formattedMessage.includes('INFO')) {
            logEntry.style.color = '#3b82f6';
        }
        
        this.logContent.appendChild(logEntry);
        
        // 自动滚动到底部
        if (this.autoscrollLog) {
            this.logContent.scrollTop = this.logContent.scrollHeight;
        }
    }
    
    clearLog() {
        this.logContent.innerHTML = '';
    }
    
    toggleAutoscroll() {
        this.autoscrollLog = !this.autoscrollLog;
        
        // 更新按钮状态
        if (this.autoscrollLog) {
            this.autoscrollToggle.classList.add('active');
            // 立即滚动到底部
            this.logContent.scrollTop = this.logContent.scrollHeight;
        } else {
            this.autoscrollToggle.classList.remove('active');
        }
    }
}

// 定义自定义元素
customElements.define('system-log', SystemLog);