// ui.js
const chatMessages = document.getElementById('chat-messages');
const roleDescription = document.getElementById('roleDescription');
const firstMessage = document.getElementById('firstMessage');

// 初始化 ChatAI 实例
const chatAI = new ChatAI();




async function openPromptConfig() {
    const prompt = chatAI.prompt;
    roleDescription.value = prompt.prompt || '';
    firstMessage.value = prompt.first_message|| '';

    const dialogOverlay = document.querySelector('.dialog-overlay');
    dialogOverlay.style.display = 'block';
}

function closePromptConfig() {
    const dialogOverlay = document.querySelector('.dialog-overlay');
    dialogOverlay.style.display = 'none';
}

async function savePromptConfig() {
    chatAI.prompt.prompt = roleDescription.value;
    chatAI.prompt.first_message = firstMessage.value;
    //localStorage.setItem('promptConfig', JSON.stringify(prompt));
    closePromptConfig();
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function DefaultSettings() {
    localStorage.removeItem('chatSettings');
    loadSettings();
}

async function loadSettings() {
    let settings = JSON.parse(localStorage.getItem('chatSettings') || '{}');
    if (Object.keys(settings).length===0) {
        try {
            const response = await fetch('/api/chat_config');
            settings = await response.json();
            localStorage.setItem('chatSettings', JSON.stringify(settings));

         } catch (error) {
            console.error('Error loading config:', error);
        }
    }
    if (settings) {
        document.getElementById('api-base').value = settings.apiBase || '';
        document.getElementById('api-key').value = settings.apiKey || '';

        const modelSelect = document.getElementById('model');
        modelSelect.innerHTML = '';

        if (settings.model) {
            const option = document.createElement('option');
            option.value = settings.model;
            option.textContent = settings.model;
            modelSelect.appendChild(option);
            modelSelect.value = settings.model;
        }

        document.getElementById('max-tokens').value = settings.maxTokens || 4096;
        document.getElementById('temperature').value = settings.temperature || 0.7;
        document.getElementById('stream').checked = settings.stream !== undefined ? settings.stream : true;
    }
}

function saveSettings(e) {
    e.preventDefault();
    const settings = {
        apiBase: document.getElementById('api-base').value,
        apiKey: document.getElementById('api-key').value,
        model: document.getElementById('model').value,
        maxTokens: document.getElementById('max-tokens').value,
        temperature: document.getElementById('temperature').value,
        stream: document.getElementById('stream').checked
    };
    localStorage.setItem('chatSettings', JSON.stringify(settings));
    closeSettings();
}

function openSettings() {
    document.querySelector('.settings-modal').style.display = 'block';
    document.querySelector('.settings-overlay').style.display = 'block';
}

function closeSettings() {
    document.querySelector('.settings-modal').style.display = 'none';
    document.querySelector('.settings-overlay').style.display = 'none';
}

document.getElementById('temperature').addEventListener('input', function(e) {
    document.getElementById('temperature-value').textContent = e.target.value;
});

document.getElementById('settings-form').addEventListener('submit', saveSettings);

window.onload = function() {
    const chatMessages = document.getElementById('chat-messages');
    chatAI.context.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = msg.role === 'user' ? 'message user-message' : 'message ai-message';
        messageDiv.innerHTML = chatAI.formatMessage(msg.content);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

}

async function NewChat() {
    chatAI.resetContext();
    document.getElementById('chat-messages').innerHTML = '';
    context = chatAI.get_first_message()
    chatAI.addContext({ role: "assistant", content:  context});
    chatMessages.innerHTML += `
            <div class="message ai-message">
                ${chatAI.formatMessage(context)}
            </div>
        `;
}

async function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();

    if (!message) return;

    try {
        chatMessages.innerHTML += `
            <div class="message user-message">
                ${chatAI.formatMessage(message)}
            </div>
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        input.value = '';

        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai-message';
        chatMessages.appendChild(aiMessageDiv);

        const onResponse = (content) => {
            aiMessageDiv.innerHTML = chatAI.formatMessage(content);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        await chatAI.send(message, onResponse);
    } catch (error) {
        console.error('Error:', error);
        showToast('Error sending message: ' + error.message);
    }
}



// 复制代码功能
function copyCode(button) {
    const codeElement = button.previousElementSibling;
    const code = codeElement.textContent;

    // 创建临时文本区域
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();

    try {
        // 执行复制命令
        document.execCommand('copy');
        // 更新按钮文本和样式
        button.textContent = 'Copied!';
        button.classList.add('success');

        // 2秒后恢复按钮状态
        setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy code:', err);
        button.textContent = 'Failed';
    }

    // 移除临时文本区域
    document.body.removeChild(textarea);
}

// // 在页面加载完成后初始化 highlight.js
// document.addEventListener('DOMContentLoaded', (event) => {
//     hljs.configure({
//         ignoreUnescapedHTML: true,
//         languages: ['javascript', 'python', 'java', 'cpp', 'csharp', 'html', 'css', 'bash', 'json', 'yaml', 'markdown']
//     });
// });

document.getElementById('user-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

loadSettings();