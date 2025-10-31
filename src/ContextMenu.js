export class ContextMenu {
    static open(x, y, menuItems) {

        ContextMenu.close();

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
                    z-index: 1000;
                    display: block;
                }
                .context-menu-item {
                    padding: 8px 15px;
                    cursor: pointer;
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
            </style>
            <div class="context-menu">
                ${Object.entries(menuItems).map(([label]) => {
                    // 检查首字母是否为'-'，如果是则显示为分隔符
                    if (label && label.charAt(0) === '-') {
                        return `<div class="context-menu-separator"></div>`;
                    }
                    return `<div class="context-menu-item" data-label="${label}">${label}</div>`;
                }).join('')}
            </div>
        `;

        // 添加到DOM以便计算尺寸
        document.body.appendChild(contextMenu);
        
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
                item.addEventListener('click', () => {
                    menuItems[label]();
                    ContextMenu.close();
                });
            }
        });

        
        // 鼠标移出检测函数
        const handleMouseMove = (event) => {
            // 获取菜单的位置和尺寸
            const rect = menuElement.getBoundingClientRect();
            const menuX = rect.left;
            const menuY = rect.top;
            const menuWidth = rect.width;
            const menuHeight = rect.height;
            
            // 设置检测距离阈值（像素）
            const threshold = 50;
            
            // 检查鼠标是否移出了菜单周围指定距离
            if (event.clientX < menuX - threshold ||
                event.clientX > menuX + menuWidth + threshold ||
                event.clientY < menuY - threshold ||
                event.clientY > menuY + menuHeight + threshold) {
                ContextMenu.close();
            }
        };
        
        // 添加鼠标移动事件监听器
        document.addEventListener('mousemove', handleMouseMove);
        
        // 在关闭菜单时移除事件监听器
        const originalClose = ContextMenu.close;
        ContextMenu.close = function() {
            document.removeEventListener('mousemove', handleMouseMove);
            originalClose();
        };
    }

    static close() {
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
            contextMenu.remove();
            document.removeEventListener('click', ContextMenu.close);
        }
    }
}