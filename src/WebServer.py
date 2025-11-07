
from fastapi import APIRouter, FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from urllib3 import response
import Resource
import config
import os
import time
import io
from src.server_config import *    
import timestamp   
from ChatAI import chat_router
import mimetypes    

from account import account_router
from src.chatroom.chatroom import chatroom_app
import  src.SystemManager  as SystemManager

import src.webdav.WebdavService as WebdavService
import src.webdav.ServerAPI as WebdavServiceAPI
import src.ffmpeg as ffmpeg

app = FastAPI()


# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)





templates = Jinja2Templates(Resource.path.templates)

# 设置WebDAV服务器的根目录

app.include_router(chat_router)
app.include_router(account_router)
app.mount("/chatroom", chatroom_app)
app.include_router(WebdavServiceAPI.router)
app.mount("/WEBDAV", WebdavService.app)
app.include_router(SystemManager.router)
app.include_router(ffmpeg.router)

@app.get("/api/version")
async def get_version():
    return JSONResponse({"version": timestamp.SERVER_START_TIME});


def responseFile(file_path: str):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    # 获取文件大小
    file_size = os.path.getsize(file_path)
    
    # 对于大文件（>10MB）使用流式响应
    if file_size > 10 * 1024 * 1024:
        # 定义流式读取生成器函数
        async def file_streamer(file_path, chunk_size=8192):
            with open(file_path, "rb") as file:
                while chunk := file.read(chunk_size):
                    yield chunk
                    # 可以选择在每个chunk之间添加短暂的延迟
                    # await asyncio.sleep(0.001)
        
        # 获取文件的MIME类型
        import mimetypes
        content_type, _ = mimetypes.guess_type(file_path)
        content_type = content_type or "application/octet-stream"
        
        return StreamingResponse(
            file_streamer(file_path),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename={os.path.basename(file_path)}",
                "Content-Length": str(file_size)
            }
        )
    else:
        # 小文件仍然使用普通的FileResponse
        return FileResponse(file_path)


def scan_dir(path: str,dst : str,source : str):
    file_list = []
    try:
        real_path = dst+path
        for item in os.listdir(real_path):
            file_path = os.path.join(real_path, item)
            is_dir = os.path.isdir(file_path)
            size = os.path.getsize(file_path) if not is_dir else 0
            modified = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(file_path)))
            contentType = ""
            if not is_dir:
                contentType = mimetypes.guess_type(file_path)[0]
            elif is_dir:
                contentType = "application/directory"
            file_list.append ({
                "path": path+"/"+item,
                "is_dir": is_dir,
                "size": size,
                "modified": modified,
                "source": source,
                "contentType": contentType
            })
    except Exception as e:
        pass
    return file_list
#返回遍历目录下的所有文件
@app.get("/api/list_files/{path:path}")
async def list_files(path: str = ""):
    
    # 存储文件和目录信息
    file_list = []
    
    file_list.extend(scan_dir(path,Resource.path.src,"src"))
    file_list.extend(scan_dir(path,Resource.path.executable,"exec"))
    for extra_static in server_config["extra_static"]:
        file_list.extend(scan_dir(path,extra_static,"extraStatic"))
    
    return JSONResponse(file_list)


#判断路径是否存在
@app.get("/api/check_path/{path:path}")
async def check_path(path: str = ""):
    try:
        for extra_static in server_config["extra_static"]:
            if os.path.exists(os.path.join(extra_static, path)):
                return JSONResponse({"exists": True})
        if os.path.exists(os.path.join(Resource.path.templates, path)):
            return JSONResponse({"exists": True})
        elif os.path.exists(os.path.join(Resource.path.executable, path)):
            return JSONResponse({"exists": True})
        elif os.path.exists(os.path.join(Resource.path.src, path)):
            return JSONResponse({"exists": True})
        else:
            return JSONResponse({"exists": False})
    except Exception as e:
        return JSONResponse({"exists": False})

@app.get("/{path:path}")
async def AccessFiles(request: Request, path: str = ""):
    try:
        if not path:
            path = "index.html"
            
        for extra_static in server_config["extra_static"]:
            if os.path.exists(os.path.join(extra_static, path)):
                return responseFile(os.path.join(extra_static, path))
        if os.path.exists(os.path.join(Resource.path.executable, path)):
            return responseFile(os.path.join(Resource.path.executable, path))
        elif os.path.exists(os.path.join(Resource.path.src, path)):
            if path.endswith(".py"):
                raise Exception("禁止访问.py文件")
            return responseFile(os.path.join(Resource.path.src, path))
        elif os.path.exists(os.path.join(Resource.path.templates, path)):
            return templates.TemplateResponse(path, {"request": request})
            
        
        raise Exception("文件不存在")
    except Exception as e:
        return templates.TemplateResponse("error.html", {"request": request ,"reason" : e.__str__() ,"status_code" : "404"}, status_code=404)


