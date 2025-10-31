// chatAI.js
class ChatAI {
    constructor() {
        
        this.context = JSON.parse(localStorage.getItem('chatHistory')) || [];
        this.initializePromise  =  this.initialize();
    }
    async initialize() {
        // 动态加载 go.min.js 和 highlight.min.js
        await this.loadScript('/static/third_party/highlight.min.js');

        // 确保 hljs 已经加载完成
        if (typeof hljs === 'undefined') {
            console.error('highlight.js 未加载成功');
            return;
        }
        hljs.configure({
            ignoreUnescapedHTML: true,
            languages: ['javascript', 'python', 'java', 'cpp', 'csharp', 'html', 'css', 'bash', 'json', 'yaml', 'markdown']
        });
        
        await this.loadScript('/static/third_party/go.min.js');

        this.systemPrompt = await this.LoadJsonFromServer('/api/system_prompt');

    }
    async getFristMessageByNet(){
        let js = await this.LoadJsonFromServer('/api/first_message')
        return js["first_message"];
    }
    async loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    LoadJsonFromLocalStorage(key){
        
        const data = localStorage.getItem(key);
        if (data) {
            return JSON.parse(data);
        }
        return null;
    }
    SaveJsonToLocalStorage(key, data){
        localStorage.setItem(key, JSON.stringify(data));
    }
    async LoadJsonFromServer(path){
        const response = await fetch(path, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return  await response.json();
    }
    
    async prepareMessage() {
        
        let slicedContext = [];
        //slicedContext = this.context.slice(-30);
    
        slicedContext = this.context;
      

        let retcontext = JSON.parse(JSON.stringify(slicedContext));

     

        Object.entries(this.systemPrompt).reverse().forEach(([key, item]) => {
            // console.log(`pos: ${item.pos}, role: ${item.role}, content: ${item.content}`);
            retcontext.splice(item.pos, 0, { role: item.role, content: item.content } );
        });
        
        return retcontext;
    }

    attachment_text(name,text){
        
        this.addContext({ role: "user", content: `上传文件《${name}》\n\n内容如下:\n\`\`\`\n${text}\n\`\`\`` });
    }
    formatMessageContent(content) {
        if (content.startsWith('上传文件')) {
            return `上传文件${content.split('\n')[0].replace('上传文件', '').trim()}`;
        }
        return content;
    }

    async send(message, onResponse) {
        this.addContext({ role: "user", content: message });

        const messages = await this.prepareMessage();
        const response = await fetch(`/api/chat-ai/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let context = '';
        while (true) {
            const {value, done} = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, {stream: true});
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const json = JSON.parse(data);
                        const content = json.choices[0].delta.content;
                        if (content) {
                            context += content;
                            onResponse(context);
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
        }
        this.addContext({ role: "assistant", content: context });
    }
    formatMessage(message) {
        // 处理代码块
        let formattedMessage = message.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, language, code) {
            const validLanguage = language || 'plaintext';
            const highlightedCode = hljs.highlight(code.trim(), {
                language: validLanguage,
                ignoreIllegals: true
            }).value;
    
            return `<div class="code-wrapper">
                <code class="hljs ${validLanguage}">${highlightedCode}</code>
                <button class="copy-button" onclick="copyCode(this)">Copy</button>
            </div>`;
        });
    
        // 处理其他 Markdown 语法
        formattedMessage = formattedMessage.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
        formattedMessage = formattedMessage.replace(/__([\s\S]*?)__/g, '<strong>$1</strong>');
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
    
        return formattedMessage;
    }

    addContext(message) {
        this.context.push(message);
        localStorage.setItem('chatHistory', JSON.stringify(this.context));
    }

    resetContext() {
        this.context = [];
        localStorage.removeItem('chatHistory');
    }
}

