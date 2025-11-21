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
 */

export class AIServerAPI {
    static {

    }

    static async send(messages, onResponse = undefined) {
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
}