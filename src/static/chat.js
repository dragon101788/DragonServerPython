export class ChatManager {
    constructor(apiBase, apiKey, model, temperature, maxTokens, stream = true) {
        this.apiBase = apiBase;
        this.apiKey = apiKey;
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.stream = stream; // 将 stream 作为类成员
        this.context = JSON.parse(localStorage.getItem('chatHistory')) || [];
    }

    async loadSystemPrompt() {
        if (this.systemPrompt === null) {
            try {
                const response = await fetch('/api/system_prompt', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                this.systemPrompt = await response.json();
            } catch (error) {
                console.error('Error loading system prompt:', error);
                this.systemPrompt = {};
            }
        }
        return this.systemPrompt;
    }

    async loadPrompt() {
        let promptConfig = JSON.parse(localStorage.getItem('promptConfig') || '{}');
        if (Object.keys(promptConfig).length === 0) {
            try {
                const response = await fetch('/api/custom_prompt', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                promptConfig = await response.json();
                localStorage.setItem('promptConfig', JSON.stringify(promptConfig));
            } catch (error) {
                console.error('Error loading prompt config:', error);
                promptConfig = {};
            }
        }
        return promptConfig;
    }

    async prepareMessage(userMessage) {
        const prompt = await this.loadPrompt();
        const systemPrompt = await this.loadSystemPrompt();
        let slicedContext = this.context.slice(-20);
        let retContext = JSON.parse(JSON.stringify(slicedContext));

        let insertPosition = slicedContext.length - 2;
        if (insertPosition < 0) insertPosition = 0;

        retContext.splice(insertPosition, 0, { role: "system", content: prompt.prompt });
        retContext.splice(insertPosition, 0, { role: "system", content: systemPrompt.system_prompt });

        // 添加用户消息到上下文
        retContext.push({ role: "user", content: userMessage });

        return retContext;
    }

    async send(userMessage, onDataReceived) {
        try {
            // 自动添加上下文
            this.addContext({ role: "user", content: userMessage });

            // 准备消息
            const messages = await this.prepareMessage(userMessage);

            const response = await fetch(`${this.apiBase}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    messages,
                    model: this.model,
                    temperature: parseFloat(this.temperature || 0.7),
                    max_tokens: parseInt(this.maxTokens || 1000),
                    stream: this.stream // 使用类成员 stream
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (this.stream) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let context = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
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
                                    onDataReceived(context);
                                }
                            } catch (e) {
                                console.error('Error parsing JSON:', e);
                            }
                        }
                    }
                }

                // 自动添加上下文
                this.addContext({ role: "assistant", content: context });
            } else {
                const data = await response.json();
                const content = data.choices[0].message.content;
                onDataReceived(content);

                // 自动添加上下文
                this.addContext({ role: "assistant", content: content });
            }
        } catch (error) {
            console.error('Error during sending message:', error);
            throw error;
        }
    }

    addContext(message) {
        this.context.push(message);
        localStorage.setItem('chatHistory', JSON.stringify(this.context));
    }

    clearContext() {
        this.context = [];
        localStorage.removeItem('chatHistory');
    }

    getContext() {
        return this.context;
    }
}