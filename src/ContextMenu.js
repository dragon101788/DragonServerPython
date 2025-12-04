/*
使用示例1: 通过静态方法快速创建
menuItems = {}
menuItems['-----------------'] = null;
menuItems['>其他'] = {
    '分享链接' : () => {
        console.log('分享链接');
    },
    '删除' : () => {
        console.log('删除');
    },
    '重命名' : () => {
        console.log('重命名');
    },
};
menuItems['转码'] = () => {
    console.log('转码');
    MainDisplay.openWebSite("/ffmpeg/index.html");
};
ContextMenu.open(100, 100, menuItems);

使用示例2: 作为自定义元素使用
<context-menu id="myMenu">
    <div>分享链接</div>
    <div class="context-menu-separator"></div>
    <context-menu name="其他">
        <div id="deleteItem">删除</div>
        <div id="renameItem">重命名</div>
    </context-menu>
</context-menu>

// 显示菜单
document.getElementById('myMenu').show(100, 100);

// 为菜单项添加事件监听器
document.getElementById('deleteItem').addEventListener('click', () => {
    console.log('执行删除操作');
});
*/

export class ContextMenu extends HTMLElement {
    // 存储所有已打开的菜单
    static openedMenus = [];
    static closeCurrentMenu = null;
    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isVisible = false;
        this.menuElement = null;
        this.mouseMoveListener = null;
    }
    
    connectedCallback() {
        // 解析HTML结构并创建菜单
        this.createMenuFromHTML();
        
        // 隐藏菜单
        this.hide();
    }
    
    createMenuFromHTML() {
        // 创建菜单容器
        this.shadowRoot.innerHTML = `
            <style>
                .context-menu {
                    position: absolute;
                    background: white;
                    border: 1px solid #ddd;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 999999;
                    display: none;
                    min-width: 150px;
                    padding: 4px 0;
                }
                .context-menu-item {
                    padding: 8px 15px;
                    cursor: pointer;
                    color: #000000;
                }
                .context-menu-item:hover {
                    background: #f0f0f0;
                }
                .context-menu-separator {
                    height: 1px;
                    background-color: #ddd;
                    margin: 4px 0;
                    pointer-events: none;
                }
                .context-menu-submenu {
                    position: relative;
                }
                .context-menu-submenu::after {
                    content: '▶';
                    position: absolute;
                    right: 10px;
                    font-size: 10px;
                    color: #666;
                }
            </style>
            <div class="context-menu"></div>
        `;
        
        this.menuElement = this.shadowRoot.querySelector('.context-menu');
        
        // 解析子元素
        this.parseMenuItems(this, this.menuElement);
    }
    
    parseMenuItems(sourceElement, targetElement) {
        // 确保目标元素存在
        if (!targetElement) {
            return;
        }
        
        // 清空目标元素
        targetElement.innerHTML = '';
        
        // 遍历源元素的子元素
        Array.from(sourceElement.children).forEach(child => {
            // 检查是否为分隔符
            if (child.classList.contains('context-menu-separator')) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                targetElement.appendChild(separator);
            } 
            // 检查是否为子菜单
            else if (child.tagName.toLowerCase() === 'context-menu') {
                const submenuName = child.getAttribute('name') || '子菜单';
                const submenuItem = document.createElement('div');
                submenuItem.className = 'context-menu-item context-menu-submenu';
                submenuItem.textContent = submenuName;
                
                // 创建新的context-menu元素作为子菜单
                const submenuElement = document.createElement('context-menu');
                submenuElement.classList.add('temp-submenu'); // 添加临时标记
                
                // 保存对子菜单原始元素的引用
                submenuItem.originalSubmenu = child;
                
                // 保存子菜单元素的引用
                submenuItem.submenuElement = submenuElement;
                
                // 添加点击事件 - 在点击时才初始化子菜单
                submenuItem.addEventListener('click', (event) => {
                    event.stopPropagation();
                    
                    // 获取当前菜单项的位置
                    const rect = submenuItem.getBoundingClientRect();
                    const submenuX = rect.right;
                    const submenuY = rect.top;
                    
                    // 将子菜单添加到DOM
                    document.body.appendChild(submenuElement);
                    
                    // 确保子菜单已经初始化
                    if (!submenuElement.menuElement) {
                        submenuElement.createMenuFromHTML();
                    }
                    
                    // 递归解析子菜单内容
                    this.parseMenuItems(child, submenuElement.menuElement);
                    
                    // 显示子菜单
                    submenuElement.show(submenuX, submenuY);
                });
                
                targetElement.appendChild(submenuItem);
            } 
            // 普通菜单项
            else {
                // 创建菜单项的副本
                const menuItem = child.cloneNode(true);
                menuItem.className = 'context-menu-item';
                
                // 保存对原始元素的引用
                menuItem.originalItem = child;
                
                // 添加点击事件冒泡到原始子元素
                menuItem.addEventListener('click', (event) => {
                    event.stopPropagation();
                    
                    // 创建一个新的点击事件来模拟原始事件
                    const newEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: event.clientX,
                        clientY: event.clientY
                    });
                    
                    // 分发布新创建的事件到原始子元素
                    child.dispatchEvent(newEvent);
                    
                    // 关闭所有菜单
                    ContextMenu.close();
                });
                
                targetElement.appendChild(menuItem);
            }
        });
    }
    
    show(x, y) {
        // 关闭其他菜单
        // ContextMenu.close();
        
        // 先临时显示菜单以获取正确的尺寸
        this.menuElement.style.display = 'block';
        
        // 设置位置
        this.positionMenu(x, y);
        
        this.isVisible = true;
        
        // 添加到已打开菜单列表
        ContextMenu.openedMenus.push(this);
        
        
        // 添加鼠标移动事件监听器
        this.mouseMoveListener = (event) => {
            this.handleMouseMove(event);
        };
        document.addEventListener('mousemove', this.mouseMoveListener);
        
        // 更新closeCurrentMenu引用
        ContextMenu.closeCurrentMenu = () => {
            if (this.mouseMoveListener) {
                document.removeEventListener('mousemove', this.mouseMoveListener);
                this.mouseMoveListener = null;
            }
        };
    }
    
    hide() {
        // 隐藏菜单
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
        }
        this.isVisible = false;
        
        // 移除事件监听器
        if (this.mouseMoveListener) {
            document.removeEventListener('mousemove', this.mouseMoveListener);
            this.mouseMoveListener = null;
        }
    }
    
    positionMenu(x, y) {
        if (!this.menuElement) return;
        
        const menuHeight = this.menuElement.offsetHeight;
        const viewportHeight = window.innerHeight;
        const menuWidth = this.menuElement.offsetWidth;
        
        // 计算左右位置，确保不超出视口
        let leftPosition = x;
        if (leftPosition + menuWidth > window.innerWidth) {
            leftPosition = window.innerWidth - menuWidth;
        }
        
        // 计算上下位置，判断是否需要朝上打开
        let topPosition;
        // 计算从点击位置到底部的剩余空间
        const spaceBelow = viewportHeight - y;
        
        // 如果下方空间不足以显示菜单，则朝上打开
        if (spaceBelow < menuHeight) {
            topPosition = y - menuHeight;
            // 确保菜单不会超出视口顶部
            if (topPosition < 0) {
                topPosition = 0;
            }
        } else {
            topPosition = y;
        }
        
        // 设置最终位置
        this.menuElement.style.left = `${leftPosition}px`;
        this.menuElement.style.top = `${topPosition}px`;
    }
    
    handleMouseMove(event) {
        // 设置检测距离阈值（像素）
        const threshold = 50;
        
        // 检查鼠标是否在任何一个已打开的菜单或其附近
        const isNearAnyMenu = ContextMenu.openedMenus.some(menu => {
            if (!menu || !menu.menuElement) return false;
            
            const rect = menu.menuElement.getBoundingClientRect();
            return event.clientX >= rect.left - threshold &&
                   event.clientX <= rect.right + threshold &&
                   event.clientY >= rect.top - threshold &&
                   event.clientY <= rect.bottom + threshold;
        });
        
        // 如果鼠标不在任何菜单附近，关闭所有菜单
        if (!isNearAnyMenu) {
            ContextMenu.close();
        }
    }
    
    // 静态方法：通过JavaScript对象快速创建并打开菜单
    static open(x, y, menuItems) {
        // 创建临时ContextMenu元素
        const contextMenu = document.createElement('context-menu');
        contextMenu.classList.add('temp-context-menu'); // 添加临时标记
        document.body.appendChild(contextMenu);
        
        // 创建菜单内容
        const menuContainer = contextMenu.shadowRoot.querySelector('.context-menu');
        menuContainer.innerHTML = '';
        
        // 递归创建菜单项
        function createMenuItems(items, container) {
            Object.entries(items).forEach(([label, action]) => {
                // 检查首字母是否为'-'，如果是则显示为分隔符
                if (label && label.charAt(0) === '-') {
                    const separator = document.createElement('div');
                    separator.className = 'context-menu-separator';
                    container.appendChild(separator);
                }
                // 检查首字母是否为'>'，如果是则显示为子菜单项
                else if (label && label.charAt(0) === '>') {
                    const submenuItem = document.createElement('div');
                    submenuItem.className = 'context-menu-item context-menu-submenu';
                    submenuItem.textContent = label.substring(1);
                    
                    // 保存子菜单数据
                    submenuItem.submenuData = action;
                    
                    // 添加点击事件
                    submenuItem.addEventListener('click', (event) => {
                        event.stopPropagation();
                        
                        // 获取当前菜单项的位置
                        const rect = submenuItem.getBoundingClientRect();
                        const submenuX = rect.right;
                        const submenuY = rect.top;
                        
                        // 打开子菜单 - 递归调用支持任意深度
                        ContextMenu.open(submenuX, submenuY, action);
                    });
                    
                    container.appendChild(submenuItem);
                }
                // 普通菜单项
                else {
                    const menuItem = document.createElement('div');
                    menuItem.className = 'context-menu-item';
                    menuItem.textContent = label;
                    
                    // 添加点击事件
                    menuItem.addEventListener('click', (event) => {
                        event.stopPropagation();
                        
                        // 执行对应的函数
                        if (typeof action === 'function') {
                            action();
                        }
                        
                        // 关闭所有菜单
                        ContextMenu.close();
                    });
                    
                    container.appendChild(menuItem);
                }
            });
        }
        
        // 调用递归函数创建菜单
        createMenuItems(menuItems, menuContainer);
        
        // 显示菜单
        contextMenu.show(x, y);
        
        return contextMenu;
    }
    
    // 静态方法：关闭所有菜单
    static close() {
        // 调用closeCurrentMenu清理当前菜单的事件监听器
        if (ContextMenu.closeCurrentMenu) {
            ContextMenu.closeCurrentMenu();
            ContextMenu.closeCurrentMenu = null;
        }
        
        // 关闭所有已打开的菜单
        while (ContextMenu.openedMenus.length > 0) {
            const menu = ContextMenu.openedMenus.pop();
            if (menu && menu.hide) {
                menu.hide();
            }
        }
        
        // 移除全局事件监听器
        document.removeEventListener('click', ContextMenu.close);
        
        // 清理临时创建的菜单元素
        document.querySelectorAll('context-menu.temp-context-menu, context-menu.temp-submenu').forEach(menu => {
            menu.remove();
        });
    }
}

// 注册自定义元素 - 确保只注册一次
if (!customElements.get('context-menu')) {
    customElements.define('context-menu', ContextMenu);
}