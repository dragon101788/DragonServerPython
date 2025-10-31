import { AccountManager } from '/AccountManager.js';
import {  get_profile  ,deleteUser ,saveProfile ,getUserToken ,uploadAvatar,new_user } from '/DragonServerAPI.js';
import { get_dav_users ,create_user_dav_config } from "/webdav/ServerAPI.js";
import { WebdavApi } from '/webdav/WebdavApi.js'
import { InputDialog ,MessageDialog ,BaseModal ,TextAreaDialog ,CopyToClipboardDialog} from '/BaseModal.js';
import { ChangePasswordModal    } from '/webdav/UsualDialog.js';
import '/AvatarComponent.js'
import '/webdav/WebdavConfigComponent.js'

// 设置权限对话框
class RoleSettingDialog extends BaseModal {
    render() {
        super.render();
        const roles = this.getAttribute("roles") || ['SuperAdmin', 'Admin', 'User']; // 示例角色列表
        const checkedRolesStr = this.getAttribute('checkedRoles') || '[]';
        // 将 checkedRoles 字符串解析为数组
        const checkedRoles = JSON.parse(checkedRolesStr);
        const roleCheckboxes = roles.map(role => `
            <div class="checkbox-group">
                <label>
                    <input 
                        type="checkbox" 
                        value="${role}" 
                        ${checkedRoles.includes(role) ? 'checked' : ''}
                    >
                    ${role}
                </label>
            </div>
        `).join('');

        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h2>${this.getAttribute('title') || '设置权限'}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="form-group">
                        ${roleCheckboxes}
                    </div>
                    <div class="button-group">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="confirmBtn">确认</button>
                    </div>
                </div>
            </div>
        `;
        this.shadowRoot.innerHTML += html;
    }

    setupEventListeners() {
        const closeButton = this.shadowRoot.querySelector('.close');
        const cancelButton = this.shadowRoot.querySelector('#cancelBtn');
        const confirmButton = this.shadowRoot.querySelector('#confirmBtn');

        closeButton.addEventListener('click', () => this.close());
        cancelButton.addEventListener('click', () => {
            this.dispatchEvent(new Event('cancel'));
            this.close();
        });
        confirmButton.addEventListener('click', () => {
            const checkboxes = this.shadowRoot.querySelectorAll('.checkbox-group input[type="checkbox"]');
            const selectedRoles = Array.from(checkboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => checkbox.value);

            const confirmEvent = new CustomEvent('confirm', {
                detail: { selectedRoles }
            });
            this.dispatchEvent(confirmEvent);
        });
    }
}

customElements.define('role-setting-dialog', RoleSettingDialog);

export class MobileUserConfig extends HTMLElement {
    static get observedAttributes() {
        return ['username'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentUser = null;
        this.showUserList = true; // 控制用户列表显示状态
    }

    connectedCallback() {
        this.username = this.getAttribute('username');
        if (this.username) {
            this.render();
            this.setupEvents();
        }else{
            this.init();
        }
    }
    async init()
    {
        const session = await AccountManager.getUserSession();
        this.username = session.username;
        this.setAttribute('username', session.username);
        await this.render();
        this.setupEvents();
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'username' && oldValue !== newValue) {
            this.username = newValue;
            await this.render();
            this.setupEvents();
        }
    }

    async updateContent() {
        if (!this.shadowRoot) return;

        let profile = await get_profile(this.username);
        this.shadowRoot.querySelector('#nickname-input').value = profile.nickname;
    }

    async handleAvatarChange(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                await uploadAvatar(file, this.username);
                document.dispatchEvent(new CustomEvent('flush'));
            } catch (error) {
                console.error('上传头像失败:', error);
            }
        }
    }

    async render() {
        if (!this.shadowRoot) return;
        if (!this.username) return;
        const session = await AccountManager.getUserSession();
        let profile = await get_profile(session.username);
        const isAdmin = profile.role.includes("Admin");
        if(isAdmin){
            this.showUserList = true;
        }else{
            this.showUserList = false;
        }
        this.profile = await get_profile(this.username);
        const users = await get_dav_users();

        const style = /*css*/`
            :host {
                --profile-bg: var(--cc-background, white);
                --text-color: var(--cc-message-text-color, #000);
                --nickname-color: var(--cc-nickname-color, rgba(91, 91, 91, 0.88));
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                padding: 10px;
                box-sizing: border-box;
            }

            #toggle-user-list {
                position: fixed;
                top: 3px;
                right: 10px;
                z-index: 10;
                background-color:rgb(23, 85, 23);
                color: white;
                border: none;
                //border-radius: 50%;
                width: 80px;
                height: 50px;
                padding: 0px 0px;
                margin-top : 0px;
                //font-size: 24px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }

            #user-list-sidebar {
                position: fixed;
                top: 0;
                left: 0;
                width: 80%;
                height: 100%;
                background-color: var(--profile-bg);
                z-index: 999;
                transform: translateX(-100%);
                transition: transform 0.3s ease;
                box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
            }

            #user-list-sidebar.active {
                transform: translateX(0);
            }

            .user-list {
                height: 100%;
                overflow-y: auto;
                padding: 20px;
            }
            .user-list-header {
                padding: 15px;
                background-color: #2c3e50;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .user-list h3 {
                margin-top: 0;
                color: #3498db;
                font-size: 1.2em;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .user-list ul {
                list-style-type: none;
                padding-left: 0;
            }

            .user-list li {
                padding: 12px 15px;
                margin: 5px 0;
                border-radius: 6px;
                transition: all 0.3s ease;
                font-size: 16px;
            }

            .user-list li:hover {
                background-color: #f0f0f0;
            }

            .user-list li.selected {
                background-color: #2980b9;
                color: white;
            }

            .close-sidebar {
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
            }

            .setting-container {
                display: flex;
                flex-direction: column;
                flex: 1;
                padding: 10px;
                box-sizing: border-box;
                height: 100%;
                overflow-y: auto;
            }

            .profile-header {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
                margin-bottom: 20px;
                text-align: center;
            }

            .avatar {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid #ddd;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .input-container {
                display: flex;
                flex-direction: column;
                gap: 15px;
                width: 100%;
            }

            input, textarea {
                padding: 12px;
                border: 1px solid #ccc;
                border-radius: 8px;
                width: 100%;
                font-size: 16px;
                box-sizing: border-box;
            }

            button {
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: background-color 0.3s ease;
                color: white;
                background-color: #2196F3;
                font-size: 16px;
                width: 100%;
                margin-top: 10px;
            }

            .button-row {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }

            .button-row button {
                flex: 1;
                min-width: 120px;
            }

            .form-group div {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .max_height.form-group  {
                display: flex;
                flex-direction: column;
                flex-wrap: wrap;
                flex: 1;
                margin-bottom: 100px;
            }

            input[type="file"] {
                display: none;
            }

            .avatar-container {
                cursor: pointer;
            }

            .text {
                font-size: 14px;
                color: #888;
                margin-bottom: 5px;
            }

            .text-bold{
                font-size: 22px;
                color: #333;
                margin: 10px 0;
            }

            .modal {
                display: none;
                position: fixed;
                z-index: 1;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.4);
            }

            .modal-content {
                background-color: #fefefe;
                margin: 20% auto;
                padding: 20px;
                border: 1px solid #888;
                width: 90%;
                max-width: 500px;
            }

            .close {
                color: #aaa;
                float: right;
                font-size: 28px;
                font-weight: bold;
            }

            .close:hover,
            .close:focus {
                color: black;
                text-decoration: none;
                cursor: pointer;
            }

            .button-group {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
        `;

        const webdavConfigHtml = profile.role.includes("Admin") ? `<webdav-config username="${this.username}"></webdav-config>` : '';
        let html = ``;
        if(isAdmin){
            html += /*html*/`
            <button id="toggle-user-list">用户列表</button>
            <div id="user-list-sidebar" class="${this.showUserList ? 'active' : ''}">
                <div class="user-list-header">
                    <span>用户列表</span>
                    <span class="close-btn close-sidebar">&times;</span>
                </div>
                <div class="user-list">
                    <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                        <button id="add-user-button" style="width: 100%; background-color: #4CAF50;">添加用户</button>
                    </div>
                    <ul id="user-list-items">
                        ${users.map(user => `<li ${user === this.username ? 'class="selected"' : ''}>${user}</li>`).join('')}
                    </ul>
                </div>
            </div>
            `;
        }
        html = /*html*/`
            <div class="setting-container">
                <div class="profile-header">
                    <div class="avatar-container" id="avatarContainer">
                        <div class="text">${this.username}</div>
                        <avatar-component id="avatar" class="avatar" username="${this.username}"></avatar-component>
                        <input type="file" id="avatar-input" hidden accept="image/*">
                        <div class="text-bold" id="nikename">${this.profile.nickname}</div>
                    </div>
                    <div class="input-container">
                        <div class="form-group">
                            <div class="button-row">
                                <button id="edit-description-button">用户描述</button>
                                <button id="change-password-button">修改密码</button>
                            </div>
                            <div class="button-row">
                                <button id="get-token-button">获取令牌</button>
                                <button id="seting-role" style="background-color: green;">权限</button>
                                <button id="delete-user-button" style="background-color: #f44336;">删除用户</button>
                            </div>
                        </div>
                    </div>
                </div>
                ${webdavConfigHtml}
            </div>
        `;

        this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
        const switchRoleButton = this.shadowRoot.querySelector('#seting-role');
        switchRoleButton.textContent = '权限';
        const rgb_color = this.getRgbColorByRole(this.profile.role);
        switchRoleButton.style.backgroundColor = rgb_color;

        const deleteUserButton = this.shadowRoot.querySelector('#delete-user-button');
        if (profile.role.includes("Admin")) {
            deleteUserButton.style.display = 'block';
        } else {
            deleteUserButton.style.display = 'none';
        }
    }

    getRgbColorByRole(roles) {
        if (roles.includes('SuperAdmin')) return '#ff5722';
        if (roles.includes('Admin')) return '#4caf50';
        return '#2196F3';
    }

    setupEvents() {
        const browers = document.getElementById('sidebar-browers');
        const avatarInput = this.shadowRoot.querySelector('#avatar-input');
        const avatarContainer = this.shadowRoot.querySelector('#avatar');
        avatarContainer.addEventListener('click', () => {
            avatarInput.click();
        });
        const nickname = this.shadowRoot.querySelector('#nikename');
        nickname.addEventListener('click', () => {
            InputDialog.open({title:"修改昵称",message:"请输入新的昵称" ,defaultValue : this.profile.nickname}).addEventListener('confirm', async (event) => {
                this.profile.nickname = event.detail.value; 
                await saveProfile(this.profile, this.username);
                nickname.textContent = event.detail.value;
            })
        });
        avatarInput.addEventListener('change', this.handleAvatarChange.bind(this));

        
        const webdavConfig = this.shadowRoot.querySelector('webdav-config');
        if (webdavConfig) {
            webdavConfig.addEventListener('config-saved', (event) => {
                const username = event.detail.username;
                getUserToken(username).then(token => {
                        if (browers) {
                            browers.webdavApi = new WebdavApi({ token });
                            browers.loadDirectory('/');
                        }
                    })
            });
        }

        const changePasswordButton = this.shadowRoot.querySelector('#change-password-button');
        changePasswordButton.addEventListener('click', () => {
            const passwordModalComponent = ChangePasswordModal.open();
            passwordModalComponent.setAttribute('username', this.username);
            passwordModalComponent.show();
        });

        document.addEventListener('flush', () => {
            this.render();
            this.setupEvents()
        });

        const editDescriptionButton = this.shadowRoot.querySelector('#edit-description-button');
        editDescriptionButton.addEventListener('click', async () => {
            TextAreaDialog.open({title:"编辑描述",defaultValue : this.profile.description}).addEventListener('confirm', async (event) => {
                const username = this.getAttribute('username');
                let profile = await get_profile(username);  
                profile.description = event.detail.value;
                await saveProfile(profile, username); 
                MessageDialog.open({message:"修改成功"});
            })
        });

        const getTokenButton = this.shadowRoot.querySelector('#get-token-button');
        getTokenButton.addEventListener('click', async () => {
            try {
                InputDialog.open({title:"获取令牌",message:"请输入令牌时效(天)"}).addEventListener('confirm', async (event) => {
                    const time = event.detail.value;
                    let token = await getUserToken(this.username, parseInt(time)*24*60);

                    
                    CopyToClipboardDialog.open({
                        title: `已生成有效期${time}天的令牌`,
                        message: "复制key之后请妥善保存于安全易保存的地方,出于安全原因,您将无法再次查看到它",
                        text: token
                    });

                })
                
            } catch (error) {
                console.error('获取令牌失败:', error);
                alert('获取令牌失败，请重试');
            }
        });

        const switchRoleButton = this.shadowRoot.querySelector('#seting-role');
        switchRoleButton.addEventListener('click', async () => {
            let profile = await get_profile(this.username);
            RoleSettingDialog.open({title:"设置权限",checkedRoles:JSON.stringify(profile.role)}).addEventListener('confirm', async (event) => {
                const selectedRoles = event.detail.selectedRoles;
                profile.role = selectedRoles;
                await saveProfile(profile, this.username);
                const rgb_color = this.getRgbColorByRole(profile.role);
                switchRoleButton.style.backgroundColor = rgb_color;
                RoleSettingDialog.close();
            })
        });

        const deleteUserButton = this.shadowRoot.querySelector('#delete-user-button');
        deleteUserButton.addEventListener('click', async () => {
            InputDialog.open({title:"删除用户",message:"注意:此操作不可逆.你确定要删除用户么?\n 请输入[确认删除]\n将会删除用户"}).addEventListener('confirm', async (event) => {
                if (event.detail.value === '确认删除') {
                    await deleteUser(this.username);
                    const session = await AccountManager.getUserSession();
                    this.setAttribute('username', session.username);
                    await this.render();
                }
            })
        });

        const userListItems = this.shadowRoot.querySelector('#user-list-items');
        if(userListItems){
            userListItems.addEventListener('click',async (event) => {
                if (event.target.tagName === 'LI') {
                    const allLis = userListItems.querySelectorAll('li');
                    allLis.forEach(li => li.classList.remove('selected'));
                    event.target.classList.add('selected');
                    const selectedUser = event.target.textContent;
                    this.setAttribute('username', selectedUser);
                    this.showUserList = false;
                    await this.render();
                    this.setupEvents();
                    if (browers) {
                        getUserToken(selectedUser).then(token => {
                            if (browers) {
                                browers.webdavApi = new WebdavApi({ token });
                                browers.loadDirectory('/');
                            }
                        })
                    }
                }
            });
        }
        

        const addUserButton = this.shadowRoot.querySelector('#add-user-button');
        if (addUserButton) {
            addUserButton.addEventListener('click', async () => {
                InputDialog.open({title:"添加用户",message:"请输入新的用户名"}).addEventListener('confirm', async (event) => {
                    const username = event.detail.value; 
                    try{
                        const profile =  await get_profile( username);
                        await create_user_dav_config(username); 
                        MessageDialog.open({message:`对象${username}赋予访问权限成功`});
                        this.render();
                    }
                    catch (error) {
                        console.error('获取用户信息失败:', error);
                        InputDialog.open({title:"添加用户",message:"请输入密码"}).addEventListener('confirm', async (event) => {
                            await new_user(username, event.detail.password);
                            const profile =  await get_profile( username);
                            await create_user_dav_config(username); 
                            MessageDialog.open({message:`用户${username}创建成功`});
                            this.render();
                        });
                    }
                });
            });
        }

        // 用户列表显示/隐藏切换
        const toggleButton = this.shadowRoot.querySelector('#toggle-user-list');
        const userListSidebar = this.shadowRoot.querySelector('#user-list-sidebar');
        const closeSidebarButton = this.shadowRoot.querySelector('.close-sidebar');

        if(toggleButton){
            toggleButton.addEventListener('click', () => {
                this.showUserList = !this.showUserList;
                userListSidebar.classList.toggle('active', this.showUserList);
            });
    
            closeSidebarButton.addEventListener('click', () => {
                this.showUserList = false;
                userListSidebar.classList.remove('active');
            });
        }
        
    }
}

customElements.define('mobile-user-config', MobileUserConfig);