import { InputDialog, MessageDialog, FileSelectDialog, CopyToClipboardDialog } from '/BaseModal.js';
import { ContextMenu } from '/ContextMenu.js';


//防止重复加载 /lib/video-js.min.css, 避免重复加载
if (document.querySelector('link[href="/lib/font-awesome/6.4.0/css/all.min.css"]') === null) {
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = '/lib/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(styleLink);
}

export class SidebarBrowers extends HTMLElement {
    constructor() {
        super();
        this.sortOption = 'modified'; // 默认按名称排序
        this.currentPath = '/';
        this.attachShadow({ mode: 'open' });
        this.chdirEventListener = null;
    }
    static {
        SidebarBrowers.ExternalContextMenus = {};
    }
    static registerExternalContextMenu(name, matcher) {
        SidebarBrowers.ExternalContextMenus[name] = matcher;
    }

    // 监控属性变化
    static get observedAttributes() {
        return ['auth'];
    }

    getCurrentPath() {
        return this.currentPath;
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'auth' && oldValue !== newValue) {
            const auth = newValue;
            console.log('auth changed:', auth.token);
            this.render();
        }
    }
    setHiden(onoff) {
        if(onoff){
            this.style.display = 'none';
        }else{
            this.style.display = 'block';
        }
    }
    isHidden() {
        return this.style.display === 'none';
    }

    // 生成面包屑导航
    generateBreadcrumb(path) {
        const parts = path.split('/').filter(part => part);
        let currentPath = '/';
        let breadcrumb = `<span class="breadcrumb-link" data-path="/">/</span>`;

        parts.forEach((part, index) => {
            currentPath += `${part}/`;
            const isLast = index === parts.length - 1;
            breadcrumb += `
                <span class="breadcrumb-link" data-path="${currentPath}">${part}</span>
            `;
            if (!isLast) {
                breadcrumb += `
                <span class="separator">/</span> 
               `;
            }
        });

        return breadcrumb;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }
    disconnectedCallback() {
        // 移除事件监听器，防止重复注册
        if (this.chdirEventListener) {
            document.removeEventListener('WebdavChdir', this.chdirEventListener);
            this.chdirEventListener = null;
        }
    }

    openContextMenu(path, x, y) {
        const item = this.items[path];
        if (!item) return;


        const contextMenuList = {};
        if (!item.readonly) {
            if (item.limits.includes('delete')  ) {
                contextMenuList['重命名'] = () => { this.renameFile(item) };
                contextMenuList['删除'] = () => { this.deleteFile(item.path) };
            }
        }


        contextMenuList['属性'] = () => {
            document.dispatchEvent(new CustomEvent('WebdavProperty', {
                detail: {
                    path: item.path,
                    item: item,
                }
            }));
        };

        // 合并外部上下文菜单项到当前菜单列表
        for (const [name, matcher] of Object.entries(SidebarBrowers.ExternalContextMenus)) {
            const ret = matcher(item)
            if (typeof ret === 'function') {
                contextMenuList[name] = ret;
            }
        }

        ContextMenu.open(x, y, contextMenuList)
    }

    getPathItem(path) {
        return this.items[path];
    }

    //外部遍历目录,参数回调
    traverseDirectory(callback) {
        this.file_list = [];
        this.dir_list = [];
        for (const [path, item] of Object.entries(this.items)) {
            if (path === this.currentPath) continue;  // 跳过当前目录
            if (item.type === 'directory') {
                this.dir_list.push(item);
            } else {
                this.file_list.push(item);
            }
        }


        if (this.sortOption === 'name') {
            this.file_list.sort((a, b) => a.name.localeCompare(b.name));  // 按名称排序
            this.dir_list.sort((a, b) => a.name.localeCompare(b.name));  // 按名称排序
        }
        else if (this.sortOption === 'size') {
            this.file_list.sort((a, b) => b.size - a.size);  // 按大小排序(降序)
            this.dir_list.sort((a, b) => b.size - a.size);  // 按大小排序(降序)
        }
        else if (this.sortOption === 'modified') {
            this.file_list.sort((a, b) => {
                return new Date(b.modified).getTime() - new Date(a.modified).getTime();  // 降序排列(最新的在前)
            });
            this.dir_list.sort((a, b) => {
                return new Date(b.modified).getTime() - new Date(a.modified).getTime();  // 降序排列(最新的在前)
            })
        }


        for (const item of this.file_list) {

            callback(item.path, item);
        }
        for (const item of this.dir_list) {
            callback(item.path, item);
        }
    }

    openFile(path) {
        const item = this.items[path];
        document.dispatchEvent(new CustomEvent('WebdavOpen', { detail: { path ,item } }));
    }


    DirectoryContextMenu( x, y) {
        const contextMenuList = {};
        
        const path = this.currentPath;
        const item = this.items[path];
        
        
        contextMenuList['搜索'] = () => { this.searchFile(this.currentPath) };

        // 添加属性查看功能
        contextMenuList['属性'] = () => {
            document.dispatchEvent(new CustomEvent('WebdavProperty', {
                detail: {
                    path: item.path,
                    item: item,
                }
            }));
        };
        
        contextMenuList['刷新'] = () => { this.loadDirectory(path) };

        contextMenuList['新建文件'] = async () => { 
            InputDialog.open({
                title: "新文件名称",
                message: `请输入新文件名称 
                    .smm脑图 
                    .drawio拓扑图 
                    .html网页文档`,
                defaultValue: ""
            }).addEventListener('confirm', async (e) => {
                const name = e.detail.value;
                await this.webdavApi.pushFile(path + `/${name}`,{});
                await this.loadDirectory(path);

            })
            
         };

         contextMenuList['新建文件夹'] = async () => { 
            InputDialog.open({
                title: "新文件夹名称",
                message: `请输入新文件夹名称`,
                defaultValue: ""
            }).addEventListener('confirm', async (e) => {
                const name = e.detail.value;
                await this.webdavApi.mkdir(path + `/${name}`);
                await this.loadDirectory(path);

            })
            
         };
        
         
         // 合并外部上下文菜单项到当前菜单列表
         for (const [name, matcher] of Object.entries(SidebarBrowers.ExternalContextMenus)) {
            const ret = matcher(undefined)
            if (typeof ret === 'function') {
                contextMenuList[name] = ret;
            }
         }
         
        ContextMenu.open(x, y, contextMenuList);
    }
    
    
    setupEventListeners() {
        // 先移除可能存在的监听器，确保只存在一个
        if (this.chdirEventListener) {
            document.removeEventListener('WebdavChdir', this.chdirEventListener);
        }
        
        // 创建新的事件监听器并保存引用
        this.chdirEventListener = (event) => {
            const {item, path, options} = event.detail;
            if (item.type === 'directory' && path !== this.currentPath && item.path !== this.currentPath) {
                this.currentPath = path;
                this.loadDirectory(path);
            }
        };
        
        // 在document上监听事件，确保与WebdavAdapter兼容
        document.addEventListener('WebdavChdir', this.chdirEventListener);
        this.shadowRoot.getElementById('directory-list').addEventListener('click', async (event) => {
            const itemElement = event.target.closest('.directory-item, .file-item');
            if (itemElement) {
                const path = itemElement.dataset.path
                if (this.items[path].type === 'directory') {
                    await this.loadDirectory(path);
                }
                else {
                    this.openFile(path);
                }

            }
        });

        this.shadowRoot.getElementById('directory-list').addEventListener('contextmenu', (event) => {
            const itemElement = event.target.closest('.directory-item, .file-item');
            if (itemElement) {
                event.preventDefault();

                const path = itemElement.dataset.path
                this.openContextMenu(path, event.clientX, event.clientY);

            }
        });



        // 为面包屑中的目录添加点击事件
        this.shadowRoot.getElementById('current-path').addEventListener('click', async (event) => {
            const link = event.target.closest('.breadcrumb-link');
            if (link) {
                const targetPath = link.dataset.path;
                await this.loadDirectory(targetPath);
            }
        });

        this.shadowRoot.querySelector('.breadcrumb').addEventListener('contextmenu', (event) => {
            event.preventDefault(); // 阻止默认右键菜单
            this.DirectoryContextMenu( event.clientX, event.clientY);
        });



    }


    async renameFile(item) {
        await InputDialog.open({
            title: "重命名",
            message: "请输入新名称",
            defaultValue: item.name
        }).addEventListener('confirm', async (e) => {
            const newName = e.detail.value;
            const newPath = item.path.replace(item.name, newName);
            await this.webdavApi.moveFile(item.path, newPath);
            await this.loadDirectory(this.currentPath);
        });
    }

    setSortMethod(option) {
        this.sortOption = option;
    }

    getSortMethod() {
        return this.sortOption;
    }
    Sort(option) {
        this.setSortMethod(option);
        this.flush();
    }

    async downloadFile(path, onProgress = undefined) {
        try {
            await this.webdavApi.downloadFile(path, (progress) => {
                if (onProgress)
                    onProgress(progress);
                console.log(`Downloaded ${progress.toFixed(2)}%`);
            });


        } catch (error) {
            console.error('Download error:', error);
            await MessageDialog.open({
                title: "下载错误",
                message: `下载文件失败: ${error.message}`,
                type: "error"
            });
        }
    }
    async fetchFile(path) {
        try {
            return this.webdavApi.fetchFile(path)
        }
        catch (error) {
            console.error('Fetch error:', error);
        }
    }
    async flush() {

        // 生成面包屑导航
        const breadcrumbElement = this.shadowRoot.getElementById('current-path');
        breadcrumbElement.innerHTML = this.generateBreadcrumb(this.currentPath);

        const directoryList = this.shadowRoot.getElementById('directory-list');
        directoryList.innerHTML = '';


        this.traverseDirectory((path, item) => {
            this.items[path] = item;  // 使用path作为key
            const listItem = this.createFileItem(item);
            directoryList.appendChild(listItem);
        })



        this.generateParentFileItem();

        // 获取 showBottomBar 属性值，若未设置则默认为 true
        this.loadBottomBar();
    }
    async uploadFile(path, file) {
        await FileSelectDialog.open({
            title: '选择文件',
            message: '请选择想上传的文件',
            accept: '*'
        }).addEventListener('confirm', async (e) => {
            const file = e.detail.files[0];
            const path = this.currentPath + '/' + file.name;
            await this.webdavApi.uploadFile(path, file, (progress) => {
                console.log(`Uploaded ${progress.toFixed(2)}%`);
            });
            await this.loadDirectory(this.currentPath);
        });
    }
    async deleteFile(path) {
        if (this.items[path]) {  // 直接通过path查找
            console.log("deleteFile", path);
            await this.webdavApi.deleteFile(path)
            await this.loadDirectory(this.currentPath);
        }
        else {
            MessageDialog.open({
                title: "错误",
                message: `文件 ${path} 不存在`,
                type: "error"
            });
        }
    }
    NextFile(path) {
        for (let index = 0; index < this.file_list.length - 1; index++) {
            const item = this.file_list[index];
            if (item.path === path) {
                return this.file_list[index + 1].path;
            }

        }
        console.log("NextFile not found");
        return undefined;
    }
    OpenNextFile(path) {
        const nextPath = this.NextFile(path);
        if (nextPath)
            this.openFile(nextPath);
    }
    PrevFile(path) {
        for (let index = this.file_list.length - 1; index > 0; index--) {
            const item = this.file_list[index];
            if (item.path === path) {
                return this.file_list[index - 1].path;
            }
        }
        console.log("PrevFile not found");
        return undefined;
    }
    OpenPrevFile(path) {
        const prevPath = this.PrevFile(path);
        if (prevPath)
            this.openFile(prevPath);
    }


    async mkdir(path) {
        console.log("mkdir", path);
        if (!this.items[path]) {
            this.webdavApi.mkdir(path);
        }
        else {
            MessageDialog.open({
                title: "错误",
                message: `文件 ${path} 已存在`,
                type: "error"
            });
        }
    }

    render() {
        const style = /*css*/`
            :host {
                height: 100%;
                width: 100%;
                border-right: 1px solid #dee2e6;
                display: block;
                /* 确保边框和内边距包含在高度内 */
                box-sizing: border-box;        }        .sort-select {            margin: 0 5px;            padding: 5px;            border-radius: 4px;            border: 1px solid #ccc;            background-color: #fff;            font-size: 14px;        }        .sort-select:focus {            outline: none;            border-color: #66afe9;            box-shadow: 0 0 8px rgba(102, 175, 233, 0.6);
            }
            .sidebar-container {
                height: 100%;
                display: flex;
                flex-direction: column;
                /* 确保边框和内边距包含在高度内 */
                box-sizing: border-box;
            }
            .sidebar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid #dee2e6;
                /* 防止 header 缩小 */
                flex-shrink: 0;
            }
            .breadcrumb {
                padding: 10px;
                border-bottom: 1px solid #dee2e6;
                /* 防止面包屑导航缩小 */
                flex-shrink: 0;
            }
            .directory-list {
                flex-grow: 1;
                overflow-y: auto;
                /* 确保内容超出时能正确滚动 */
                min-height: 0;
            }
            .breadcrumb:hover {
                background: #f8f9fa;
            }
            .directory-item, .file-item {
                display: flex;
                align-items: center;
                padding: 10px;
                cursor: pointer;
                /* 允许内容换行 */
                flex-wrap: wrap;
                /* 防止横向滚动条 */
                overflow-wrap: break-word;
                word-break: break-word;
            }
            .directory-item:hover, .file-item:hover {
                background: #f8f9fa;
            }
            .item-icon {
                margin-right: 10px;
            }
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            .btn-primary {
                background: #007bff;
                color: white;
            }
            .breadcrumb-link {
                font-size: 16px; 
                margin: 0 0;
                padding: 0 0; 
                color: #007bff;
                cursor: pointer;
                display: inline-block; 
            }
            .breadcrumb-link:hover {
                text-decoration: underline;
            }
            .separator {
                color: #007bff;
                padding: 0 0; 
                margin: 0 0;
            }
            .bottom-bar {
                display: flex;
                justify-content: space-around;
                padding: 3px;
                border-top: 1px solid #dee2e6;
                background: #f8f9fa;
                /* 防止底部栏缩小 */
                flex-shrink: 0;
            }
            .btn {
                padding: 4px 8px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin: 0 3px;
            }
            .btn-primary {
                background: #007bff;
                color: white;
            }
            .btn-primary:hover {
                background: #0069d9;
            }
            .fas {
                font-size: 16px;
                color: inherit;
            }
            .bottom-bar {
                display: flex;
                justify-content: space-around;
                padding: 8px;
                gap: 8px;
            }
            .bottom-bar .btn {
                flex: 1;
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

        `;

        const html = /*html*/`
            <div class="sidebar-container">
                <div class="breadcrumb" id="current-path"></div>
                <div class="directory-list" id="directory-list"></div>
                <div class="bottom-bar" id="bottom-bar"></div>
            </div>  
        `;

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="/lib/font-awesome/6.4.0/css/all.min.css">
            <style>
                ${style}
            </style>
            ${html}
        `;
    }

    async loadBottomBar() {

        const bottomBar = this.shadowRoot.querySelector('#bottom-bar');
        let html = '';
        html += `<select id="sort-select" class="sort-select"> 
                    <option value="name" ${this.sortOption === 'name' ? 'selected' : ''}>按名称</option> 
                    <option value="modified" ${this.sortOption === 'modified' ? 'selected' : ''}>按修改时间</option> 
                    <option value="size" ${this.sortOption === 'size' ? 'selected' : ''}>按大小</option> 
                </select>`;
        html += `<button class="btn btn-primary" id="refresh-btn"><i class="fas fa-sync-alt"></i></button>`;

        const item = this.getPathItem(this.currentPath);
        if (item && item.readonly !== true ) {
            html += `<button class="btn btn-primary" id="upload-btn"><i class="fas fa-upload"></i></button>`;
        }

        
        html += `<button class="btn btn-primary" id="menu-btn"><i class="fas fa-ellipsis-v"></i></button>`;

        bottomBar.innerHTML = html;

        // 添加底部按钮事件监听
        const sortSelect = this.shadowRoot.getElementById('sort-select');
        if (sortSelect){
            sortSelect.addEventListener('change', (e) => { 
                this.setSortMethod(e.target.value);
                this.loadDirectory(this.currentPath);
             }); 
            
        }

        const refreshBtn = this.shadowRoot.getElementById('refresh-btn');
        if(refreshBtn){
            refreshBtn.addEventListener('click', async () => {
                await this.loadDirectory(this.currentPath);
            });
        }
        

        const uploadBth = this.shadowRoot.getElementById('upload-btn')
        if (uploadBth) {
            uploadBth.addEventListener('click', async () => {
                await this.uploadFile(this.currentPath);
            });
        }
        const menuBtn = this.shadowRoot.getElementById('menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', async (event) => {
                this.DirectoryContextMenu(event.clientX, event.clientY);
            });
        }

    }
    generateParentFileItem() {
        const directoryList = this.shadowRoot.getElementById('directory-list');
        if (this.currentPath !== '/') {
            const path = this.currentPath;
            const lastSlashIndex = path.substring(0, path.length - 1).lastIndexOf('/');
            const parentDir = path.substring(0, lastSlashIndex + 1);
            const item = {
                name: '..',
                path: parentDir,
                type: 'directory'
            }
            this.items[item.path] = item;  // 使用path作为key
            const backItem = this.createFileItem(item);
            directoryList.insertBefore(backItem, directoryList.firstChild);
        }
    }
    async loadDirectory(path) {
        try {

            const contents = await this.webdavApi.getDirectoryContents(path);

            this.currentPath = path;


            this.items = {};
            for (const item of contents) {
                this.items[item.path] = item;
            }

            this.flush();

            // 触发目录加载完成事件到document，确保WebdavAdapter可以接收
            document.dispatchEvent(new CustomEvent('WebdavChdir', { detail: { path ,item:this.items[path] } }));
        } catch (error) {
            console.error('Load directory error:', error);
            alert('Failed to load directory: ' + error.message);
        }
    }

    async searchFile(path) {
        try {
            InputDialog.open({
                title: "搜索文件",
                message: `模糊搜索文件名称`,
                defaultValue: ""
            }).addEventListener('confirm', async (e) => {
                const name = e.detail.value;
                const contents = await this.webdavApi.Search(path, `${name}`);
                this.items = {};
                for (const item of contents) {
                    this.items[item.path] = item;
                }
                this.flush();
            })

            
        } catch (error) {
            console.error('Search file error:', error);
            alert('Failed to search file: ' + error.message);
        }
    }

    createFileItem(item) {
        const icon = item.type === 'directory' ? '📁' : '📄';
        const html = `
            <div class="${item.type === 'directory' ? 'directory-item' : 'file-item'}" data-path="${item.path}">
                <span class="item-icon">${icon}</span>
                <span class="item-name">${item.name}</span>
            </div>
        `;

        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstElementChild;
    }

}

customElements.define('sidebar-browers', SidebarBrowers);
