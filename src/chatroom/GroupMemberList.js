class GroupMemberList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.members = [];
    }

    async connectedCallback() {
        this.members = await loadContacts(ActiveUsername);
        await this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
       document.addEventListener('flush', async () => {
            this.members = await loadContacts(ActiveUsername);
            await this.render();
        }); 
    }


    updateContent() {
        if (!this.shadowRoot) return;
        
        const memberList = this.shadowRoot.querySelector('#member-list');
        memberList.innerHTML = this.members.map(member => `
            <div class="member-item">
                <avatar-component class="avatar" username="${member.username}" nickname="${member.nickname}"></avatar-component>
                <div class="member-info">
                    <div class="nickname">${member.nickname}</div>
                    <div class="username">@${member.username}</div>
                </div>
            </div>
        `).join('');
    }

    async render() {
        if (!this.shadowRoot) return;

        // 清空现有内容
        this.shadowRoot.innerHTML = '';

        // 创建style元素
        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            .member-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 10px;
            }
            .member-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                border-radius: 8px;
                background-color: #f5f5f5;
            }
            .avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
            }
            .member-info {
                display: flex;
                flex-direction: column;
            }
            .nickname {
                font-weight: bold;
                color: #333;
            }
            .username {
                font-size: 12px;
                color: #666;
            }
            .button-container {
                margin-left: auto;
                display: flex;
                gap: 8px;
            }
            .action-button {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            .kick-button {
                background-color: #ff4444;
                color: white;
            }
            .add-friend-button {
                background-color: #4CAF50;
                color: white;
            }
            .invite-button {
                margin: 10px;
                padding: 8px 16px;
                background-color: #2196F3;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
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
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                width: 600px;
            }
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
        `;
        this.shadowRoot.appendChild(style);

        

        // 创建成员列表容器
        const memberList = document.createElement('div');
        memberList.className = 'member-list';
        memberList.id = 'member-list';

        // 创建邀请新成员按钮
        const inviteButton = document.createElement('button');
        inviteButton.className = 'invite-button';
        inviteButton.textContent = '邀请新成员';
        inviteButton.addEventListener('click', () => this.showInviteModal());
        memberList.appendChild(inviteButton);
        
        const group_profile = await get_profile(ActiveUsername);

        const session = AccountManager.getUserSession();
        const currentUserContacts = await loadContacts(session.username);

        this.members.forEach(async member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'member-item';
            
            // 创建按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';

            if( ! currentUserContacts.includes(member) && member!== session.username){
                // 创建加为好友按钮
                const addFriendButton = document.createElement('button');
                addFriendButton.className = 'action-button add-friend-button';
                addFriendButton.textContent = '加为好友';
                addFriendButton.addEventListener('click', async () => {
                    await addContact(member);
                });
                // 将按钮添加到容器
                buttonContainer.append(addFriendButton);
            }
            


            if (member !== session.username && group_profile.admin === session.username) {
                // 创建踢出群聊按钮
                const kickButton = document.createElement('button');
                kickButton.className = 'action-button kick-button';
                kickButton.textContent = '踢出群聊';
                kickButton.addEventListener('click', async () => {
                    await kickGroupMember(ActiveUsername,member); 
                })
                buttonContainer.append(kickButton);
            }
            
            
            

            const profile = await get_profile(member);
            const avatar = document.createElement('avatar-component');
            avatar.className = 'avatar';
            avatar.setAttribute('username', profile.username);
            avatar.setAttribute('nickname', profile.nickname);

            const memberInfo = document.createElement('div');
            memberInfo.className = 'member-info';

            const nickname = document.createElement('div');
            nickname.className = 'nickname';
            nickname.textContent = profile.nickname;

            const username = document.createElement('div');
            username.className = 'username';
            username.textContent = `@${profile.username}`;

            memberInfo.append(nickname, username);
            memberItem.append(avatar, memberInfo);
            memberItem.appendChild(buttonContainer);
            memberList.appendChild(memberItem);
        });


        this.shadowRoot.appendChild(memberList);

    }

    async showInviteModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const memberContainer = document.createElement('div');
        memberContainer.className = 'member-container';
        
        const availableMembers = document.createElement('div');
        availableMembers.className = 'member-column';
        availableMembers.id = 'availableMembers';
        availableMembers.innerHTML = '<h4>可选成员</h4>';
        
        const selectedMembers = document.createElement('div');
        selectedMembers.className = 'member-column';
        selectedMembers.id = 'selectedMembers';
        selectedMembers.innerHTML = '<h4>已选成员</h4>';
        
        const buttons = document.createElement('div');
        buttons.className = 'buttons';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', () => modal.remove());
        
        const inviteBtn = document.createElement('button');
        inviteBtn.className = 'primary';
        inviteBtn.textContent = '邀请';
        inviteBtn.addEventListener('click', async () => {
            const selected = Array.from(selectedMembers.querySelectorAll('.member-item'))
                .map(item => item.dataset.username);
            try {
                await Promise.all(selected.map(async username => 
                    await addGroupMember(ActiveUsername, username)
                ));
                modal.remove();
            } catch (error) {
                alert('邀请失败: ' + error.message);
            }
        });
        
        buttons.append(cancelBtn, inviteBtn);
        memberContainer.append(availableMembers, selectedMembers);
        modalContent.append(memberContainer, buttons);
        modal.appendChild(modalContent);
        this.shadowRoot.appendChild(modal);
        
        // 加载可用成员
        const members = await loadContacts();
        this.updateMemberList(availableMembers, members);
        
        modal.style.display = 'block';
    }

    updateMemberList(container, members) {
        members.forEach(member => {
            if (member.startsWith('group_') || this.members.includes(member)) return;
            
            const item = document.createElement('div');
            item.className = 'member-item';
            item.dataset.username = member;
            
            const avatar = document.createElement('avatar-component');
            avatar.className = 'avatar';
            avatar.setAttribute('username', member);
            
            const name = document.createElement('div');
            name.className = 'member-name';
            name.textContent = member;
            
            item.append(avatar, name);
            item.addEventListener('click', () => {
                const modal = this.shadowRoot.querySelector('.modal');
                const targetColumnId = item.parentElement.id === 'availableMembers' 
                    ? 'selectedMembers' 
                    : 'availableMembers';
                const targetColumn = modal.querySelector(`#${targetColumnId}`);
                item.remove();
                targetColumn.appendChild(item);
            });
            
            container.appendChild(item);
        });
    }

}

customElements.define('group-member-list', GroupMemberList);