
// 添加联系人组件
class AddContact extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        const style = /*css*/`
            <style>
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
                    width: 300px;
                }

                input {
                    width: 100%;
                    padding: 10px;
                    margin: 10px 0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                }

                .buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 20px;
                }

                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .primary {
                    background: #0084ff;
                    color: white;
                }

                .secondary {
                    background: #e0e0e0;
                }
            </style>
        `;

        const html = /*html*/`
            <div class="modal">
                <div class="modal-content">
                    <h3>添加联系人</h3>
                    <input type="text" id="ContactUsername" placeholder="请输入联系人用户名">
                    <div class="buttons">
                        <button class="secondary" id="cancelBtn">取消</button>
                        <button class="primary" id="addBtn">添加</button>
                    </div>
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = style + html;
    }

    setupEventListeners() {
        const modal = this.shadowRoot.querySelector('.modal');
        const cancelBtn = this.shadowRoot.querySelector('#cancelBtn');
        const addBtn = this.shadowRoot.querySelector('#addBtn');

        cancelBtn.addEventListener('click', () => this.close());
        addBtn.addEventListener('click', () => this.addContact());

        // 点击模态框外部关闭模态框  --取消
        // modal.addEventListener('click', (e) => {
        //     if (e.target === modal) this.close();
        // });
    }

    show() {
        this.shadowRoot.querySelector('.modal').style.display = 'block';
    }

    close() {
        this.shadowRoot.querySelector('.modal').style.display = 'none';
        this.shadowRoot.querySelector('#ContactUsername').value = '';
    }

    async addContact() {
        const ContactUsername = this.shadowRoot.querySelector('#ContactUsername').value;
    
        try {
            await addContact(ContactUsername);
            alert('添加联系人成功！');
            this.close();
            
        } catch (error) {
            alert('添加联系人失败：' + error);
        }
    }
}



customElements.define('add-contact', AddContact);