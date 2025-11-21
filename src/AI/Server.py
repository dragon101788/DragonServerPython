from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import os
import random
import requests
import uvicorn
import Resource
import json

from fastapi import FastAPI, Request
import httpx
import src.config as config
# 创建路由器
chat_router = APIRouter()

chatapi_config = config.PythonConfig("config/chatAPI.py",default_config={
        "apiBase": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        "apiKey": "5d3230ea-6b77-42cf-bc0b-2a686fcba565",
        "model": "doubao-seed-1-6-251015"
    })
system_prompt = config.PythonConfig("config/system_prompt.py",default_config={"system_prompt":[
        { "pos" : 2 , "role": "system", "content": "你(assistant)是dragon的助手" },#正数为接近最旧一条,0为最旧
        { "pos" : -4 , "role": "system", "content": "dragon是一个技术大神" } #负数接近于最新的一条，-1为最新
    ]})
first_message = config.PythonConfig("config/first_message.py",default_config={
         "first_message" : "你好,有什么可以帮到你?"
         })

async def proxy_chat_completions(request: Request):
    data = await request.json()
    url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data)
    return response.json()

@chat_router.post("/api/chat-ai/completions")
async def chat_ai_completions(data: dict):
    # 假设请求数据中包含 messages 字段，它是一个消息列表
    messages = data.get("messages")
    if not messages:
        raise HTTPException(status_code=400, detail="消息内容不能为空")
    
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {chatapi_config.apiKey}",
    }
    payload = {
        "messages": messages,
        "model": chatapi_config.model,
        "stream": True
    }


    def generate():
        response = requests.post(chatapi_config.apiBase, headers=headers, json=payload, stream=True)
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data_str = line_str[6:]
                    if (data_str == '[DONE]'):
                        return;
                    data = json.loads(data_str)
                    delta = data["choices"][0]["delta"]
                    content = delta.get("content", None)
                    if content:
                        yield content
    return StreamingResponse(generate(), media_type="text/event-stream")
@chat_router.get("/api/haiguitang")
async def api_haiguitang():
    story_dir = os.path.join(Resource.get_executable_path() , "story");
    
    try:
        story_files = os.listdir(story_dir)
    except FileNotFoundError:
        return {"error": "Story directory not found"}
    
    story_files = [f for f in story_files if f.endswith('.py')]
    
    if not story_files:
        return {"error": "No stories found in the directory"}
    
    selected_story = random.choice(story_files)
    
    story_path = os.path.join(story_dir, selected_story)
    
    return config.PythonConfig(story_path).instance();


@chat_router.get("/api/system_prompt")
async def get_system_prompt():
    return system_prompt.system_prompt;

@chat_router.get("/api/custom_prompt")
async def get_prompt():
    return {
        "prompt": "你是一个人工智能",
        "first_message": "你好,有什么可以帮到你?"
    }


@chat_router.get("/api/first_message")
async def get_first_message():
    
    return first_message.instance();