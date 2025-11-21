/**
 * 与AI服务器交互的API
 
使用示例1:AIServerAPI.send 发送消息与AI服务器交互
<div id="chat-container"></div>
<script type="module">
    import { AIServerAPI } from "./AIServerAPI.js";
    //流式响应
    AIServerAPI.send([{ role: "user", content: "你好" }], (content) => {
        document.getElementById("chat-container").innerHTML += content;
    });
    //非流式响应
    const context = await AIServerAPI.send([{ role: "user", content: "你好" }]);
    document.getElementById("chat-container").innerHTML = context;
</script>

使用示例2:AIServerAPI.get_prompt 获取提示内容
<div id="prompt-container"></div>
<script type="module">
    import { AIServerAPI } from "./AIServerAPI.js";
    //获取提示内容
    const prompt = await AIServerAPI.get_prompt();
    for (const [k,v] of Object.entries(prompt)) {
        document.getElementById("prompt-container").innerHTML += `${k}: ${v}<br>`;
    }
</script>   
一般返回{"system_prompt":[
        { "pos" : 2 , "role": "system", "content": "你(assistant)是dragon的助手" },#正数为接近最旧一条,0为最旧
        { "pos" : -4 , "role": "system", "content": "dragon是一个技术大神" } #负数接近于最新的一条，-1为最新
    ],"first_message" : "你好,有什么可以帮到你?"}

 */

export class AIServerAPI {
    static {

    }

    static async send(messages, onResponse = undefined) {
        const response = await fetch(`/api/ChatAI/completions`, {
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
            if (done) 
                break;
            const line = decoder.decode(value, {stream: true});
            if (onResponse) {
                onResponse(line);
                context += line;
            }
        }
        return context;
    }

    static async get_prompt() {
        const response = await fetch(`/api/ChatAI/prompt`);
        return await response.json();
    }

    static async set_prompt(prompt) {
        const response = await fetch(`/api/ChatAI/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt
            })
        });
    }
}