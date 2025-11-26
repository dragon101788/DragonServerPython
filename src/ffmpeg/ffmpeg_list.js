import { VideoModal,TextAreaDialog } from "/BaseModal.js";
import { FFmpeg } from "./FFmpeg.js";



// 定义FFmpeg任务列表自定义组件
export class FFmpegListComponent extends HTMLElement {
    constructor() {
        super();
        
        // 创建影子DOM
        this.attachShadow({ mode: 'open' });
        
        // 初始化任务列表数据
        this.tasks = [];
        
        // 构建组件
        this._buildComponent();
    }
    
    // 组件连接到DOM时执行
    connectedCallback() {
        // 连接到FFmpeg服务并监听任务更新
        FFmpeg.connect((body) => {
            if (body.status === "update_list") {
                this.updateTaskList(body.list);
            } else {
                console.warn("未知响应:", body);
            }
        });
    }
    
    // 构建组件结构和样式
    _buildComponent() {
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .task-list {
                margin-top: 20px;
            }
            .task-item {
                padding: 15px;
                margin-bottom: 10px;
                border-radius: 5px;
                border: 1px solid #ddd;
                transition: all 0.3s ease;
            }
            .task-item:hover {
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            .task-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .task-name {
                font-weight: bold;
                flex: 1;
            }
            .task-status {
                font-size: 14px;
                padding: 3px 8px;
                border-radius: 3px;
                color: white;
            }
            .status-run {
                background-color: #ff9800;
            }
            .status-done {
                background-color: #4caf50;
            }
            .status-queue {
                background-color: #2196f3;
            }
            .status-error {
                background-color: #f44336;
            }
            .progress-bar {
                width: 100%;
                height: 20px;
                background-color: #e0e0e0;
                border-radius: 10px;
                overflow: hidden;
                margin: 10px 0;
            }
            .progress-fill {
                height: 100%;
                background-color: #4caf50;
                transition: width 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
            }
            .confirm-btn {
                background-color: #2196f3;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .confirm-btn:hover {
                background-color: #1976d2;
            }
            .blue-btn {
                background-color: #2196f3;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .blue-btn:hover {
                background-color: #1976d2;
            }
            .red-btn {
                background-color: #f44336;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .red-btn:hover {
                background-color: #e53935;
            }
            .task-info {
                font-size: 14px;
                color: #666;
                margin-top: 10px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .empty-message {
                text-align: center;
                color: #999;
                padding: 20px;
            }
        `;
        
        // 创建任务列表容器
        this.taskListElement = document.createElement('div');
        this.taskListElement.className = 'task-list';
        this.taskListElement.innerHTML = '<div class="empty-message">暂无任务</div>';
        
        // 将样式和任务列表添加到影子DOM
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(this.taskListElement);
    }
    
    
    // 更新任务列表
    updateTaskList(taskList) {
        // 判断是否需要完全重建任务列表
        const needsFullUpdate = this._checkIfListNeedsFullUpdate(taskList);
        
        // 如果任务列表为空，显示空状态
        if (taskList.length === 0) {
            if (this.tasks.length > 0) { // 只有当之前有任务时才更新
                this.taskListElement.innerHTML = "<div class='empty-message'>暂无任务</div>";
                this.tasks = [];
            }
            return;
        }
        
        // 按照状态排序：正在运行 > 排队 > 已完成 > 错误
        taskList.sort((a, b) => {
            const statusOrder = { "run": 0, "queue": 1, "done": 2, "error": 3 };
            return statusOrder[a.status] - statusOrder[b.status];
        });
        
        // 只在列表需要完全更新时才重建DOM
        if (needsFullUpdate) {
            this.taskListElement.innerHTML = "";
            
            taskList.forEach(task => {
                let taskElement;
                
                // 根据任务状态调用相应的创建函数
                switch (task.status) {
                    case "run":
                        taskElement = this._createRunItem(task);
                        break;
                    case "queue":
                        taskElement = this._createQueueItem(task);
                        break;
                    case "done":
                        taskElement = this._createDoneItem(task);
                        break;
                    case "error":
                        taskElement = this._createErrorItem(task);
                        break;
                    default:
                        // 未知状态的默认处理
                        taskElement = this._createUnknownItem(task);
                }
                
                this.taskListElement.appendChild(taskElement);
            });
        } else {
            // 只更新运行中任务的进度条
            this._updateRunningTaskProgress(taskList);
        }
        
        // 更新任务数据
        this.tasks = [...taskList];
    }
    
    // 检查任务列表是否需要完全更新
    _checkIfListNeedsFullUpdate(newTaskList) {
        // 如果之前没有任务，需要完全更新
        if (this.tasks.length === 0) {
            return true;
        }
        
        // 如果任务数量发生变化，需要完全更新
        if (this.tasks.length !== newTaskList.length) {
            return true;
        }
        
        // 检查任务状态或任务名称是否发生变化（不包括运行中的任务进度）
        for (let i = 0; i < newTaskList.length; i++) {
            const newTask = newTaskList[i];
            const oldTask = this.tasks.find(t => t.name === newTask.name);
            
            // 如果找不到相同名称的任务，需要完全更新
            if (!oldTask) {
                return true;
            }
            
            // 如果任务状态发生变化，需要完全更新
            if (oldTask.status !== newTask.status) {
                return true;
            }
        }
        
        // 其他情况下不需要完全更新DOM
        return false;
    }
    
    // 更新运行中任务的进度条
    _updateRunningTaskProgress(taskList) {
        // 只处理运行中的任务
        const runningTasks = taskList.filter(task => task.status === 'run');
        
        runningTasks.forEach(task => {
            // 查找对应的任务元素
            const taskElements = this.taskListElement.querySelectorAll('.task-item');
            for (const element of taskElements) {
                const taskNameElement = element.querySelector('.task-name');
                if (taskNameElement && taskNameElement.textContent === task.name) {
                    // 更新进度条
                    const progressFill = element.querySelector('.progress-fill');
                    if (progressFill) {
                        const progressPercent = Math.round((task.progress || 0) * 100);
                        progressFill.style.width = `${progressPercent}%`;
                        progressFill.textContent = `${progressPercent}%`;
                    }
                    break;
                }
            }
        });
    }
    showDetail( task){
        // 显示任务信息
        let detail = ` <div class="task-info">`;
        // 检查是否有输入文件列表（用于合并任务）
        if(task.input_vir_path_list){
            detail += `<div>输入文件列表:</div>`;
            for(let input_vir_path of task.input_vir_path_list){
                detail += `<div>${input_vir_path}</div>`;
            }
        } 
        if(task.input_vir_path){
            // 普通转码任务，直接显示输入输出路径
            detail += `<div>输入: ${task.input_vir_path || '未知'}</div>`;
        }
        if(task.output_vir_path){
            // 普通转码任务，直接显示输入输出路径
            detail += `<div>输出: ${task.output_vir_path || '未知'}</div>`;
        }
        detail += `</div>`;
        return detail;
    }
    // 创建运行中状态的任务项
    _createRunItem(task) {
        const taskElement = document.createElement("div");
        taskElement.className = "task-item";
        
        // 设置任务状态样式
        const statusClass = "status-run";
        const statusText = "运行中";
        
        // 构建任务内容
        let taskContent = `
            <div class="task-header">
                <div class="task-name" style="color: ${this._getTaskColor('run')}">${task.name || '未命名任务'}</div>
                <div class="task-status ${statusClass}">${statusText}</div>
            </div>
        `;
        
        // 显示进度条
        const progressPercent = Math.round((task.progress || 0) * 100);
        taskContent += `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressPercent}%">
                    ${progressPercent}%
                </div>
            </div>
        `;
        
        // 显示任务信息
        taskContent += this.showDetail(task);
        
        // 添加取消按钮
        taskContent += `
            <button class="red-btn">
                取消任务
            </button>
        `;

        taskElement.innerHTML = taskContent;

        // 添加取消按钮事件
        const cancelBtn = taskElement.querySelector('.red-btn');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            FFmpeg.cancelTask(task.name);
        });

        taskElement.addEventListener('click', () => {
            TextAreaDialog.open({
                title: "FFMPEG命令",
                value: task.cmd,
            });
        });

        return taskElement;
    }
    
    // 创建排队中状态的任务项
    _createQueueItem(task) {
        const taskElement = document.createElement("div");
        taskElement.className = "task-item";
        
        // 设置任务状态样式
        const statusClass = "status-queue";
        const statusText = "排队中";
        
        // 构建任务内容
        let taskContent = `
            <div class="task-header">
                <div class="task-name" style="color: ${this._getTaskColor('queue')}">${task.name || '未命名任务'}</div>
                <div class="task-status ${statusClass}">${statusText}</div>
            </div>
        `;
        
        // 显示任务信息
        taskContent += this.showDetail(task);
        
        // 添加取消按钮
        taskContent += `
            
            <button class="blue-btn">
                取消任务
            </button>
        `;
        
        taskElement.innerHTML = taskContent;
        
        // 添加取消事件监听
        const cancelBtn = taskElement.querySelector('.blue-btn');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            FFmpeg.cancelTask(task.name);
        });
        
        taskElement.addEventListener('click', () => {
            TextAreaDialog.open({
                title: "FFMPEG命令",
                value: task.cmd,
            });
        });

        return taskElement;
    }

    
    
    // 创建已完成状态的任务项
    _createDoneItem(task) {
        const taskElement = document.createElement("div");
        taskElement.className = "task-item";
        taskElement.style.cursor = "pointer";
        
        // 设置任务状态样式
        const statusClass = "status-done";
        const statusText = "已完成";
        
        // 构建任务内容
        let taskContent = `
            <div class="task-header">
                <div class="task-name" style="color: ${this._getTaskColor('done')}">${task.name || '未命名任务'}</div>
                <div class="task-status ${statusClass}">${statusText}</div>
            </div>
        `;
        
        taskContent += this.showDetail(task);
        
        // 添加按钮
        taskContent += `
            <button class="confirm-btn">
                播放验证
            </button>
            <button class="red-btn">
                已确认
            </button>
        `;
        
        taskElement.innerHTML = taskContent;
        
        // 添加播放验证按钮事件
        const confirmBtn = taskElement.querySelector('.confirm-btn');
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            this._playVideo(task);
        });
        
        // 添加已确认按钮事件
        const delBtn = taskElement.querySelector('.red-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            FFmpeg.delTaskWithFile(task.name);
        });

        taskElement.addEventListener('click', () => {
            TextAreaDialog.open({
                title: "FFMPEG命令",
                value: task.cmd,
            });
        });
        
        return taskElement;
    }
    
    // 创建错误状态的任务项
    _createErrorItem(task) {
        const taskElement = document.createElement("div");
        taskElement.className = "task-item";
        
        // 设置任务状态样式
        const statusClass = "status-error";
        const statusText = "错误";
        
        // 构建任务内容
        let taskContent = `
            <div class="task-header">
                <div class="task-name" style="color: ${this._getTaskColor('error')}">${task.name || '未命名任务'}</div>
                <div class="task-status ${statusClass}">${statusText}</div>
            </div>
        `;
        
        // 显示任务信息
        taskContent += this.showDetail(task);
        
        
        // 添加确认按钮
        taskContent += `
            <button id="view-error-btn" class="red-btn">
                查看错误
            </button>
            <button class="confirm-btn">
                已知晓
            </button>
        `;
        
        taskElement.innerHTML = taskContent;
        
        // 添加已知晓按钮事件
        const confirmBtn = taskElement.querySelector('.confirm-btn');
        confirmBtn.addEventListener('click', (e) => {
            //防止点击按钮也触发任务点击事件
            e.stopPropagation();

            FFmpeg.delTask(task.name);
        });
        
        
        taskElement.addEventListener('click', () => {

            TextAreaDialog.open({
                title: "错误信息",
                value: task.error_message,
            });
        });
        
        return taskElement;
    }
    
    // 创建未知状态的任务项
    _createUnknownItem(task) {
        const taskElement = document.createElement("div");
        taskElement.className = "task-item";
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-name">${task.name || '未命名任务'}</div>
                <div class="task-status status-unknown">未知状态</div>
            </div>
        `;
        
        // 显示任务信息
        taskContent += this.showDetail(task);
        
        return taskElement;
    }
    
    // 获取任务颜色
    _getTaskColor(status) {
        const colorMap = { 
            "run": "#ff9800", 
            "done": "#4caf50", 
            "queue": "#000000", 
            "error": "#f44336" 
        };
        return colorMap[status] || "#666";
    }
    
    // 播放视频
    _playVideo(task) {
        const videoUrl = encodeURIComponent(task.output_vir_path);
        const host = window.location.hostname;
        const port = window.location.port;
        const videoUrlWithHost = `http://${host}:${port}/${videoUrl}`;
        
        if (videoUrl) {
            VideoModal.open({
                videoUrl: videoUrlWithHost,
            });
        } else {
            console.warn("无法播放视频：缺少输出路径");
        }
    }
}

// 定义自定义元素
customElements.define('ffmpeg-list', FFmpegListComponent);