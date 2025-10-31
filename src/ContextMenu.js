export class ContextMenu {
    static open(x, y, menuItems) {

        ContextMenu.close();

        const contextMenu = document.createElement('div');
        contextMenu.id = 'context-menu';
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
            </style>
            <div class="context-menu" style="left:${x}px;top:${y}px;">
                ${Object.entries(menuItems).map(([label]) => `
                    <div class="context-menu-item" data-label="${label}">${label}</div>
                `).join('')}
            </div>
        `;

        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            const label = item.dataset.label;
            item.addEventListener('click', () => {
                menuItems[label]();
                ContextMenu.close();
            });
        });

        document.body.appendChild(contextMenu);
        document.addEventListener('click', ContextMenu.close);
    }

    static close() {
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
            contextMenu.remove();
            document.removeEventListener('click', ContextMenu.close);
        }
    }
}