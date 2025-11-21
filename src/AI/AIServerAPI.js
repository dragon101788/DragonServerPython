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
                            if (onResponse) {
                                onResponse(content);
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
        }
        return context;
    }
}