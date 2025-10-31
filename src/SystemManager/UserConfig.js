import { AccountManager } from '/AccountManager.js';
import {  get_profile  ,deleteUser ,saveProfile ,getUserToken ,uploadAvatar,new_user } from '/DragonServerAPI.js';
import { get_dav_users ,create_user_dav_config } from "/webdav/ServerAPI.js";
import { WebdavApi } from '/webdav/WebdavApi.js'
import { InputDialog ,MessageDialog ,BaseModal ,TextAreaDialog ,CopyToClipboardDialog} from '/BaseModal.js';
import { ChangePasswordModal    } from '/SystemManager/UsualDialog.js';
import '/AvatarComponent.js'
import '/SystemManager/WebdavConfigComponent.js'

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

class UserConfig extends HTMLElement {

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentUser = null;
    }

    async connectedCallback() {
        this.setAttribute('username', await AccountManager.getUsername());
        await this.render();
        await this.setupEvents();
    }
    async updateContent() {
        if (!this.shadowRoot) return;
        const username = this.getAttribute('username');

        let profile = await get_profile(username);
        this.shadowRoot.querySelector('#nickname-input').value = profile.nickname;
    }

    async handleAvatarChange(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                const username = this.getAttribute('username');
                await uploadAvatar(file, username);
                document.dispatchEvent(new CustomEvent('flush'));
            } catch (error) {
                console.error('上传头像失败:', error);
            }
        }
    }

    async render() {
        if (!this.shadowRoot) return;
        const username = this.getAttribute('username');
        const session = await AccountManager.getUserSession();
        const profile = await get_profile(username);
        const users = await get_dav_users();

        const style = /*css*/`
            :host {
                --profile-bg: var(--cc-background, white);
                --text-color: var(--cc-message-text-color, #000);
                --nickname-color: var(--cc-nickname-color, rgba(91, 91, 91, 0.88));
                display: flex;
                height: 100%;
                flex: 1;
                /* 修改 flex-direction 为 row-reverse 使侧边栏在右侧 */
                flex-direction: row; 
            }  

            #user-list-sidebar {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 250px;
                background-color: var(--profile-bg);
                color: var(--text-color);
                box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
            }

            .user-list {
                flex :1;
                height: 100%;
                box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
                flex-shrink: 0;
                /* 当内容超出容器高度时显示垂直滚动条 */
                overflow-y: auto; 
                overflow-x: hidden;
                transition: width 0.3s ease;
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
                overflow-x: hidden;
                padding: 12px 15px;
                margin: 5px 0;
                border-radius: 6px;
                transition: all 0.3s ease;
            }

            .user-list li:hover {
                overflow-x: hidden;
                transform: translateX(5px);
            }

            .user-list li.selected {
                background-color: #2980b9;
                color: white;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }

            .setting-container {
                display: flex;
                flex-direction: column;
                flex: 1;
                padding: 20px;
                box-sizing: border-box;
                height: 100%;
                /* 当内容超出容器高度时显示垂直滚动条 */
                overflow-y: auto; 
            }

            .profile-header {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 20px;
            }

            .avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid #ddd;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                cursor: pointer;
            }

            .input-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                flex: 1;
            }

            input, textarea {
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
                height: 40px;
                box-sizing: border-box;
                resize: none;
            }

            button {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s ease;
                color: white;
                background-color: #2196F3;
                margin-top: 0;
                height: 40px;
                box-sizing: border-box;
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
                font-size: 12px;
                color: #888;
                text-align: center;
                margin-bottom: 5px;
            }

            .text-bold{
                font-size: 18px;
                color: #888;
                text-align: center; 
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
                margin: 10% auto;
                padding: 20px;
                border: 1px solid #888;
                width: 600px;
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
            #sidebar-browers {
                width: 350px;
                height: 100%;
            }
        `;

        const webdavConfigHtml = `<webdav-config username="${username}"></webdav-config>`;
        const html = /*html*/`
            
            <div id="user-list-sidebar">
                <!--添加用户按钮--> 
                <div class="user-list" >
                    <div style="padding: 10px; border-bottom: 1px solid #eee;">
                        <button id="add-user-button" style="width: 100%; background-color: #4CAF50;">添加用户</button>
                    </div>
                    <ul id="user-list-items">
                        ${users.map(user => `<li ${user === username ? 'class="selected"' : ''}>${user}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="setting-container">
                
                <div class="profile-header">
                    <div class="avatar-container" id="avatarContainer">
                        <div class="text">${username}</div>
                        <avatar-component id="avatar" class="avatar" username="${username}"></avatar-component>
                        <input type="file" id="avatar-input" hidden accept="image/*">
                        <div class="text-bold" id="nikename">${profile.nickname}</div>
                    </div>
                    <div class="input-container">
                        <div class="form-group">
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button id="edit-description-button">用户描述</button>
                                <button id="change-password-button">修改密码</button>
                                <button id="get-token-button">获取令牌</button>
                                <button id="seting-role" style="background-color: green;">权限</button>
                                <button id="delete-user-button" style="background-color: #f44336;">删除用户</button>
                            </div>
                        </div>
                    </div>
                </div>
                ${webdavConfigHtml}
            </div>
            
            <sidebar-browers id="sidebar-browers"></sidebar-browers>
        `;

        this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
        const switchRoleButton = this.shadowRoot.querySelector('#seting-role');
        switchRoleButton.textContent = '权限';
        const rgb_color = this.getRgbColorByRole(profile.role);
        switchRoleButton.style.backgroundColor = rgb_color;

        const deleteUserButton = this.shadowRoot.querySelector('#delete-user-button');
        if (profile.role.includes("Admin")) {
            deleteUserButton.style.display = 'block';
        } else {
            deleteUserButton.style.display = 'none';
        }
    }

    async setupEvents() {

        const browers = this.shadowRoot.querySelector('#sidebar-browers');
        const avatarInput = this.shadowRoot.querySelector('#avatar-input');
        const avatarContainer = this.shadowRoot.querySelector('#avatar');
        avatarContainer.addEventListener('click', () => {
            avatarInput.click();
        });
        const nickname = this.shadowRoot.querySelector('#nikename');
        nickname.addEventListener('click', () => {
            InputDialog.open({title:"修改昵称",message:"请输入新的昵称" ,defaultValue : this.profile.nickname}).addEventListener('confirm', async (event) => {
                const username = this.getAttribute('username');
                const profile = await get_profile(username);
                profile.nickname = event.detail.value; 
                await saveProfile(profile, username);
                nickname.textContent = event.detail.value;
            })
        });
        avatarInput.addEventListener('change', this.handleAvatarChange.bind(this));

        if (browers) {
            const username = this.getAttribute('username');
            const token = await getUserToken(username);  
            browers.webdavApi = new WebdavApi({ token });
            await browers.loadDirectory('/');
        }
        
        const webdavConfig = this.shadowRoot.querySelector('webdav-config');
        if (webdavConfig) {
            webdavConfig.addEventListener('config-saved', (event) => {
                const username = event.detail.username;
                getUserToken(username).then(async token => {
                        if (browers) {
                            browers.webdavApi = new WebdavApi({ token });
                            await browers.loadDirectory('/');
                        }
                    })
            });
        }

        const changePasswordButton = this.shadowRoot.querySelector('#change-password-button');
        changePasswordButton.addEventListener('click', () => {
            const passwordModalComponent = ChangePasswordModal.open();
            const username = this.getAttribute('username');
            passwordModalComponent.setAttribute('username', username);
            passwordModalComponent.show();
        });

        document.addEventListener('flush', async () => {
            await this.render();
            await this.setupEvents()
        });

        const editDescriptionButton = this.shadowRoot.querySelector('#edit-description-button');
        editDescriptionButton.addEventListener('click', async () => {
            const username = this.getAttribute('username');
            const profile = await get_profile(username);
            TextAreaDialog.open({title:"编辑描述",defaultValue : profile.description}).addEventListener('confirm', async (event) => {
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
                    const username = this.getAttribute('username');
                    let token = await getUserToken(username, parseInt(time)*24*60);

                    
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
            const username = this.getAttribute('username');
            let profile = await get_profile(username);
            RoleSettingDialog.open({title:"设置权限",checkedRoles:JSON.stringify(profile.role)}).addEventListener('confirm', async (event) => {
                const selectedRoles = event.detail.selectedRoles;
                profile.role = selectedRoles;
                await saveProfile(profile, username);
                const rgb_color = this.getRgbColorByRole(profile.role);
                switchRoleButton.style.backgroundColor = rgb_color;
                RoleSettingDialog.close();
            })
        });

        const deleteUserButton = this.shadowRoot.querySelector('#delete-user-button');
        deleteUserButton.addEventListener('click', async () => {
            InputDialog.open({title:"删除用户",message:"注意:此操作不可逆.你确定要删除用户么?\n 请输入[确认删除]\n将会删除用户"}).addEventListener('confirm', async (event) => {
                if (event.detail.value === '确认删除') {
                    const username = this.getAttribute('username');
                    await deleteUser(username); 
                    const session = await AccountManager.getUserSession();
                    this.setAttribute('username', session.username);
                    await this.render();
                }
            })
        });

        const userListItems = this.shadowRoot.querySelector('#user-list-items');
        userListItems.addEventListener('click', async (event) => {
            if (event.target.tagName === 'LI') {
                const allLis = userListItems.querySelectorAll('li');
                allLis.forEach(li => li.classList.remove('selected'));
                event.target.classList.add('selected');
                const selectedUser = event.target.textContent;
                this.setAttribute('username', selectedUser);
                await this.render();
                await this.setupEvents();
            }
        });

        const addUserButton = this.shadowRoot.querySelector('#add-user-button');
        if (addUserButton) {
            addUserButton.addEventListener('click', async () => {
                InputDialog.open({title:"添加用户",message:"请输入新的用户名"}).addEventListener('confirm', async (event) => {
                    const username = event.detail.value; 
                    try{
                        const profile =  await get_profile( username);
                        await create_user_dav_config(username); 
                        MessageDialog.open({message:`对象${username}赋予访问权限成功`});
                        this.ReloadUserList();
                    }
                    catch (error) {
                        console.error('获取用户信息失败:', error);
                        InputDialog.open({title:"添加用户",message:"请输入密码"}).addEventListener('confirm', async (event) => {
                            await new_user(username, event.detail.password);
                            const profile =  await get_profile( username);
                            await create_user_dav_config(username); 
                            MessageDialog.open({message:`创建对象${username}成功,并赋予访问权限`});
                            this.ReloadUserList();
                        })
                        
                    }
                })
            });
        }
    }

    async ReloadUserList() {
        const username = this.getAttribute('username');
        const users = await get_dav_users();
        const userListItems = this.shadowRoot.querySelector('#user-list-items');
        userListItems.innerHTML = users.map(user => 
            `<li ${user === username ? 'class="selected"' : ''}>${user}</li>`
        ).join('');
    }

    getRgbColorByRole(roles) {
        const roleHierarchy = {
            'SuperAdmin': 3,
            'Admin': 2,
            'User': 1
        };

        let totalLevel = 0;
        let roleCount = 0;

        roles.forEach(role => {
            if (roleHierarchy[role]) {
                totalLevel += roleHierarchy[role];
                roleCount++;
            }
        });

        if (roleCount === 0) {
            return 'rgb(100, 50, 150)';
        }

        const averageLevel = totalLevel / roleCount;
        const maxLevelValue = Math.max(...Object.values(roleHierarchy));
        const normalizedLevel = averageLevel / maxLevelValue;

        const red = Math.round(100 + 155 * normalizedLevel);
        const green = Math.round(50 + 100 * normalizedLevel);
        const blue = Math.round(150 - 100 * normalizedLevel);

        return `rgb(${red}, ${green}, ${blue})`;
    }
}

customElements.define('user-config', UserConfig);
export {UserConfig}