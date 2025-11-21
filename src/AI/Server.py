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
from src.account import verfiy_by_request,get_profile

from fastapi import FastAPI, Request
import httpx
import src.config as config
# 创建路由器
router = APIRouter()

chatapi_config = config.PythonConfig("config/chatAPI.py",default_config={
        "apiBase": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        "apiKey": "5d3230ea-6b77-42cf-bc0b-2a686fcba565",
        "model": "doubao-seed-1-6-251015"
    })
prompt_config = config.PythonConfig("config/AI/prompt.py",default_config={
    "system_prompt":[
        { "pos" : 2 , "role": "system", "content": "你(assistant)是dragon的助手" },#正数为接近最旧一条,0为最旧
        { "pos" : -4 , "role": "system", "content": "dragon是一个技术大神" } #负数接近于最新的一条，-1为最新
    ],
        "first_message" : "你好,有什么可以帮到你?"
    })

async def proxy_chat_completions(request: Request):
    data = await request.json()
    url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data)
    return response.json()

@router.post("/api/ChatAI/completions")
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


@router.get("/api/ChatAI/prompt")
async def get_prompt():
    return prompt_config.instance()

@router.post("/api/ChatAI/prompt")
async def set_prompt(request: Request,data: dict):
    await verfiy_by_request(request);
    role = get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    prompt = data.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="提示内容不能为空")
    prompt_config.update(prompt)
    return {"message": "Prompt updated"}

@router.get("/api/ChatAI/chatapi_config")
async def get_chatapi_config(request: Request):
    await verfiy_by_request(request);
    role = get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    return chatapi_config.instance()

@router.post("/api/ChatAI/chatapi_config")
async def set_chatapi_config(request: Request,data: dict):
    await verfiy_by_request(request);
    role = get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    chatapi_config.update(data)
    return {"message": "chatapi_config updated"}

