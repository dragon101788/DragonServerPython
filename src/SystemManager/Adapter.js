
export class SystemManagerAdapter extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
        const sidebarBrowers = document.getElementById('sidebar-browers');
        if (sidebarBrowers) {
            const hideSidebarBtn = document.getElementById('hide-sidebar-btn');
            sidebarBrowers.setHiden(true);
            hideSidebarBtn.style.display = 'none';
        }
        
        const systemSettingsBtn = document.getElementById('system-settings-btn');
        if (systemSettingsBtn) {
            systemSettingsBtn.style.display = 'none';
        }

        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            

            const topStatusBarSelf = document.createElement('div');
            topStatusBarSelf.classList.add('top-status-bar-SystemMenager');
            topStatusBarSelf.innerHTML = /*html*/`
                <style>
                    .top-status-bar-SystemMenager {
                        background-color: transparent;
                        float: right;
                        border: none;
                        cursor: pointer;
                    }
                    button {
                        float: right;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                </style>
                <button class="exit-btn">退出管理</button>
            `;
            topStatusBar.appendChild(topStatusBarSelf);
            const exitBtn = topStatusBarSelf.querySelector('.exit-btn');
            exitBtn.addEventListener('click', () => {
                const MainDisplay = document.querySelector('.main-display-area');
                if (MainDisplay) {
                    MainDisplay.goback();
                }
            });
        }
        
        const url = "/SystemManager/index.html";
        this.shadowRoot.innerHTML  = `
            <iframe id="html-frame" src="${url}" style="width: 100%; height: 100%; border: none; "></iframe>
        `;
    }
    disconnectedCallback() {
        const sidebarBrowers = document.getElementById('sidebar-browers');
        if (sidebarBrowers) {
            const hideSidebarBtn = document.getElementById('hide-sidebar-btn');
            sidebarBrowers.setHiden(false);
            hideSidebarBtn.style.display = 'block';
        }
        const systemSettingsBtn = document.getElementById('system-settings-btn');
        if (systemSettingsBtn) {
            systemSettingsBtn.style.display = 'block';
        }

        const topStatusBar = document.querySelector('.top-status-bar');
        if (topStatusBar) {
            const topStatusBarSelf = topStatusBar.querySelector('.top-status-bar-SystemMenager');
            if (topStatusBarSelf) {
                topStatusBar.removeChild(topStatusBarSelf);
            }
        }
    }
}

customElements.define('system-manager', SystemManagerAdapter);