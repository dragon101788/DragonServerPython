/*
使用示例:
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
});
menuItems['转码'] = () => {
    console.log('转码');
    MainDisplay.openWebSite("/ffmpeg/index.html");
});
ContextMenu.open(100, 100, menuItems);
*/

export class ContextMenu {
    // 存储所有已打开的菜单
    static openedMenus = [];

    static open(x, y, menuItems) {
        // 不再自动关闭之前的菜单，而是让它们保持打开状态
        // ContextMenu.close();

        const contextMenu = document.createElement('div');
        contextMenu.id = 'context-menu';
        
        // 创建菜单内容
        contextMenu.innerHTML = `
            <style>
                .context-menu {
                    position: absolute;
                    background: white;
                    border: 1px solid #ddd;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 999999;
                    display: block;
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
            <div class="context-menu">
                ${Object.entries(menuItems).map(([label]) => {
                    // 检查首字母是否为'-'，如果是则显示为分隔符
                    if (label && label.charAt(0) === '-') {
                        return `<div class="context-menu-separator"></div>`;
                    }
                    // 检查首字母是否为'>'，如果是则显示为二级菜单项
                    if (label && label.charAt(0) === '>') {
                        return `<div class="context-menu-item context-menu-submenu" data-label="${label}">${label.substring(1)}</div>`;
                    }
                    return `<div class="context-menu-item" data-label="${label}">${label}</div>`;
                }).join('')}
            </div>
        `;

        const fsElement = document.body;
        fsElement.appendChild(contextMenu);
        
        // 将新打开的菜单添加到容器中
        ContextMenu.openedMenus.push(contextMenu);
        
        // 获取菜单元素和计算位置
        const menuElement = contextMenu.querySelector('.context-menu');
        const menuHeight = menuElement.offsetHeight;
        const viewportHeight = window.innerHeight;
        const menuWidth = menuElement.offsetWidth;
        
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
        menuElement.style.left = `${leftPosition}px`;
        menuElement.style.top = `${topPosition}px`;

        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            const label = item.dataset.label;
            // 不为分隔符项添加点击事件
            if (label && label.charAt(0) !== '-') {
                item.addEventListener('click', (event) => {
                    // 阻止事件冒泡，避免关闭菜单
                    event.stopPropagation();
                    
                    // 检查是否为二级菜单（首字母为'>'）
                    if (label.charAt(0) === '>') {
                        // 获取当前菜单项的位置，计算子菜单的位置
                        const rect = item.getBoundingClientRect();
                        const submenuX = rect.right;
                        const submenuY = rect.top;
                        
                        // 不再关闭当前菜单，直接打开子菜单
                        ContextMenu.open(submenuX, submenuY, menuItems[label]);
                    } else {
                        // 普通菜单项，执行对应的函数
                        menuItems[label]();
                        ContextMenu.close();
                    }
                });
            }
        });

        
        // 鼠标移出检测函数
        const handleMouseMove = (event) => {
            // 设置检测距离阈值（像素）
            const threshold = 50;
            
            // 检查鼠标是否在任何一个已打开的菜单或其附近
            const isNearAnyMenu = ContextMenu.openedMenus.some(menu => {
                if (!menu) return false;
                
                const menuElement = menu.querySelector('.context-menu');
                if (!menuElement) return false;
                
                const rect = menuElement.getBoundingClientRect();
                return event.clientX >= rect.left - threshold &&
                       event.clientX <= rect.right + threshold &&
                       event.clientY >= rect.top - threshold &&
                       event.clientY <= rect.bottom + threshold;
            });
            
            // 如果鼠标不在任何菜单附近，关闭所有菜单
            if (!isNearAnyMenu) {
                ContextMenu.close();
            }
        };
        
        // 添加鼠标移动事件监听器
        document.addEventListener('mousemove', handleMouseMove);
        
        // 在关闭菜单时移除事件监听器
        ContextMenu.closeCurrentMenu = function() {
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }

    static close() {
        // 调用closeCurrentMenu清理当前菜单的事件监听器
        if (ContextMenu.closeCurrentMenu) {
            ContextMenu.closeCurrentMenu();
        }
        
        // 关闭所有已打开的菜单
        while (ContextMenu.openedMenus.length > 0) {
            const menu = ContextMenu.openedMenus.pop();
            if (menu && menu.parentNode) {
                menu.remove();
            }
        }
        // 移除全局事件监听器
        document.removeEventListener('click', ContextMenu.close);
    }
}