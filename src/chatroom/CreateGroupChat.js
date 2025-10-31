import { AccountManager } from '/AccountManager.js';
import { get_profile,getAvatar,loadContacts  } from '/DragonServerAPI.js';

class CreateGroup extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.members = []; // 存储已选成员
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        const style = /*css*/`
            <style>
                /* 保留原有样式 */
                :host {
                    display: flex;
                    align-items: center;
                    padding: 4px 12px;
                    background: var(--bg-secondary);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.2s;
                    gap: 8px;
                    margin-right: auto;
                }
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    z-index: 1000;
                }
                .modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: var(--bg-secondary);
                    padding: 20px;
                    border-radius: 8px;
                    width: 600px; /* 增加宽度 */
                }
                /* 新增样式 */
                .member-container {
                    display: flex;
                    height: 400px;
                    gap: 20px;
                    margin: 20px 0;
                }
                .member-column {
                    flex: 1;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px;
                    
                    overflow-y: auto;
                }
                .member-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px;
                    margin: 4px 0;
                    background: #f5f5f5;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .move-buttons {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 10px;
                }
                .move-buttons button {
                    padding: 8px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    background: #0084ff;
                    color: white;
                }
                .avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    margin-right: 10px;
                    align-items: left;
                }
                .member-name {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    text-align: left; 
                }
                .header {
                    display: flex;
                    justify-content: center;
                    align-items: center; 
                    flex-direction: row;
                    flex-wrap: nowrap;
                }
                #GroupName {
                    flex: 1;
                    margin: 20px;
                    padding-left: 20px;
                    padding-right: 20px;
                    padding-top: 10px;
                    padding-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                /* 保留其他样式 */
            </style>
        `;

        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <div class="header">
                        <h3>创建群聊</h3>
                        <input type="text" id="GroupName" placeholder="请输入群聊名称">
                    </div>
                    <div class="member-container">
                        <div class="member-column" id="availableMembers">
                            <h4>可选成员</h4>
                            <!-- 可选成员列表将动态插入 -->
                        </div>
                        <div class="member-column" id="selectedMembers">
                            <h4>已选成员</h4>
                            <!-- 已选成员列表将动态插入 -->
                        </div>
                    </div>
                    <div class="buttons">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="createBtn">创建</button>
                    </div>
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = style + html;
    }

    async loadAvailableMembers() {
        // 这里需要实现获取可用成员列表的逻辑
        const availableMembers = await loadContacts();
        this.updateMemberList('availableMembers', availableMembers);
    }
    moveSelected(toSelected) {
        const fromColumn = toSelected ? 'availableMembers' : 'selectedMembers';
        const toColumn = toSelected ? 'selectedMembers' : 'availableMembers';
        
        const selectedItems = this.shadowRoot.querySelectorAll(`#${fromColumn} .member-item.selected`);
        
        selectedItems.forEach(item => {
            const username = item.dataset.username;
            if (toSelected) {
                if (!this.members.includes(username)) {
                    this.members.push(username);
                }
            } else {
                this.members = this.members.filter(m => m !== username);
            }
            item.remove();
            this.updateMemberList(toColumn, [username], true);
        });
    }

    updateMemberList(columnId, members, append = false) {
        const column = this.shadowRoot.querySelector(`#${columnId}`);
        if (!append) {
            column.innerHTML = `<h4>${columnId === 'availableMembers' ? '可选成员' : '已选成员'}</h4>`;
        }
        
        members.forEach(member => {
            if (member.startsWith('group_')) {
                return;
            }
            const item = document.createElement('div');
            item.className = 'member-item';
            item.dataset.username = member;

            // 创建 avatar-component
            const avatar = document.createElement('avatar-component');
            avatar.className = 'avatar';
            avatar.setAttribute('username', member);
            item.appendChild(avatar);

            const div = document.createElement('div');
            div.className = 'member-name';
            div.textContent = member;
            item.appendChild(div);

            item.addEventListener('click', () => {
                if (columnId === 'availableMembers') {
                    // 如果是可选成员，直接移动到已选成员
                    this.members.push(member);
                    item.remove();
                    this.updateMemberList('selectedMembers', [member], true);
                } else {
                    // 如果是已选成员，移动到可选成员
                    this.members = this.members.filter(m => m !== member);
                    item.remove();
                    this.updateMemberList('availableMembers', [member], true);
                }
            });
            column.appendChild(item);
        });
    }


    setupEventListeners() {
        const modal = this.shadowRoot.querySelector('.modal');
        const cancelBtn = this.shadowRoot.querySelector('#cancelBtn');
        const createBtn = this.shadowRoot.querySelector('#createBtn');
        cancelBtn.addEventListener('click', () => this.close());
        createBtn.addEventListener('click', () => this.createGroup());
        

                
        // 初始化成员列表
        this.loadAvailableMembers();
        
    }

    static openModal() {
        const modal = new CreateGroup();
        document.body.appendChild(modal);
        modal.show();
        
        // 监听关闭事件
        const closeHandler = () => {
            modal.remove();
            modal.removeEventListener('close', closeHandler);
        };
        modal.addEventListener('close', closeHandler);
    }

    show() {
        this.shadowRoot.querySelector('.modal').style.display = 'block';
    }

    close() {
        this.shadowRoot.querySelector('.modal').style.display = 'none';
        this.shadowRoot.querySelector('#GroupName').value = '';
        this.members = [];
        //this.updateMemberList();
        this.dispatchEvent(new Event('close'));
    }



    async createGroup() {
        const groupName = this.shadowRoot.querySelector('#GroupName').value;
        
        if (!groupName) {
            alert('请输入群聊名称');
            return;
        }

        if (this.members.length === 0) {
            alert('请至少添加一个成员');
            return;
        }

        try {
            const session = await AccountManager.getUserSession();
            const members = [...this.members, session.username];
            // 这里需要实现实际的创建群聊逻辑
            await createGroup(groupName,members);
            alert('群聊创建成功！');
            this.close();
        } catch (error) {
            alert('创建群聊失败：' + error);
        }
    }
}

customElements.define('create-group', CreateGroup);
export { CreateGroup };