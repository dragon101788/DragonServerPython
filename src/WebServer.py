
from fastapi import APIRouter, FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from urllib3 import response
import Resource
import src.config as config
import os
import time
import io
from src.server_config import *    
import timestamp   
from src.AI.Server import router as chat_router
import mimetypes    
import aiofiles
from src.webdav.Thumb import ResponseThumb ,remove_cache

from src.account import account_router
import  src.SystemManager  as SystemManager

import src.webdav.WebdavService as WebdavService
import src.webdav.ServerAPI as WebdavServiceAPI
import src.ffmpeg.Server as FFMPEGServer

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
app.include_router(WebdavServiceAPI.router)
app.mount("/WEBDAV", WebdavService.app)
app.include_router(SystemManager.router)


@app.get("/api/version")
async def get_version():
    return JSONResponse({"version": timestamp.SERVER_START_TIME});


def responseFile(request: Request, file_path: str):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    # 获取文件大小
    file_size = os.path.getsize(file_path)
    

    # 获取文件的MIME类型
    content_type, _ = mimetypes.guess_type(file_path)
    content_type = content_type or "application/octet-stream"
    
    
    thumb = request.query_params.get("thumb",None)
    if thumb is not None:
        return ResponseThumb(file_path,size = int(thumb),mimetype=content_type)
        
    # 解析Range头
    range_header = request.headers.get('Range')
    CHUNK_SIZE = 1024*1024*2  # 2MB chunks
    
    if range_header:
        try:
            start, end = range_header.replace('bytes=', '').split('-')
            start = int(start)
            end = int(end) if end else file_size - 1
            # 验证范围是否有效
            if start < 0 or end >= file_size or start > end:
                raise HTTPException(status_code=416, detail="Range Not Satisfiable")
            length = end - start + 1

            async def file_generator():
                try:
                    async with aiofiles.open(file_path, 'rb') as f:
                        await f.seek(start)
                        remaining = length
                        while remaining > 0:
                            chunk_size = min(remaining, CHUNK_SIZE)
                            chunk = await f.read(chunk_size)
                            if not chunk:
                                break
                            try:
                                yield chunk
                            except GeneratorExit:
                                break
                            remaining -= chunk_size
                except Exception:
                    pass

            import urllib.parse
            filename = os.path.basename(file_path)
            encoded_filename = urllib.parse.quote(filename)
            headers = {
                'Content-Range': f'bytes {start}-{end}/{file_size}',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(length),
                'Content-Type': content_type,
                'Connection': 'keep-alive',
                "Content-Disposition": f"inline; filename={encoded_filename}; filename*=UTF-8''{encoded_filename}"
            }
            return StreamingResponse(file_generator(), status_code=206, headers=headers)
        except Exception:
            # 处理解析Range头或其他错误，返回完整文件
            pass
    
    # 对于大文件（>10MB）使用流式响应
    if file_size > 10 * 1024 * 1024:
        # 定义流式读取生成器函数
        async def file_generator():
            try:
                async with aiofiles.open(file_path, 'rb') as f:
                    while True:
                        chunk = await f.read(CHUNK_SIZE)
                        if not chunk:
                            break
                        try:
                            yield chunk
                        except GeneratorExit:
                            break
            except Exception:
                pass
        
        import urllib.parse
        filename = os.path.basename(file_path)
        encoded_filename = urllib.parse.quote(filename)
        headers = {
            "Content-Disposition": f"inline; filename={encoded_filename}; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
            'Connection': 'keep-alive'
        }
        return StreamingResponse(
            file_generator(),
            media_type=content_type,
            headers=headers
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

@app.api_route("/{path:path}",methods=["GET"])
async def AccessFiles(request: Request, path: str = ""):
    try:
        if not path:
            path = "index.html"
        
        try:
            return await WebdavService.do_GET(request, path);
        except HTTPException as e:
            for extra_static in server_config["extra_static"]:
                if os.path.exists(os.path.join(extra_static, path)):
                    return responseFile(request, os.path.join(extra_static, path))
            if os.path.exists(os.path.join(Resource.path.executable, path)):
                return responseFile(request, os.path.join(Resource.path.executable, path))
            elif os.path.exists(os.path.join(Resource.path.src, path)):
                if path.endswith(".py"):
                    raise Exception("禁止访问.py文件")
                return responseFile(request, os.path.join(Resource.path.src, path))
            elif os.path.exists(os.path.join(Resource.path.templates, path)):
                return templates.TemplateResponse(request, path)
            
            raise e
    except HTTPException as e:
        user_agent = request.headers.get("User-Agent","")
        if "Mozilla" in user_agent:
            return templates.TemplateResponse(request, "error.html", {"reason": str(e.detail) if hasattr(e, 'detail') else str(e), "status_code": str(e.status_code)}, status_code=e.status_code)
        else:
            raise e



app.include_router(WebdavService.router)
