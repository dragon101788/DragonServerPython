import src.account as account 
from fastapi import APIRouter, Request, Response
import os
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi import APIRouter, FastAPI, Request, HTTPException
from src.config import PythonConfig
import src.webdav.WebdavService as WebdavService


router = APIRouter()

@router.get("/api/get_dav_users")
async def get_dav_users(request :Request):
    await account.verfiy_by_request(request);
    #帮我实现,遍历ACCOUNT_DIR目录下的所有目录,如果目录下有webdav.py,那么加入列表,并返回
    users = []
    for root, dirs, files in os.walk(account.ACCOUNT_DIR):
        for dir in dirs:
            if os.path.exists(os.path.join(root, dir, "webdav.py")):
                users.append(dir)
    return users


@router.post("/api/create_user_dav_config")
async def create_user_dav_config(request: Request,data: dict):
    await account.verfiy_by_request(request);
    profile = account.get_profile(request.username);
    if "Admin" not in profile.get("role",[]):
        raise HTTPException(status_code=403, detail="Permission denied")
    username = data.get("username")
    try:
        WebdavService.create_user_dav_config(username)
        return JSONResponse(content={"message": "WebDAV config created successfully"})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")
    
# 新增接口，获取 WebDAV 配置
@router.get("/api/get_webdav_config")  # 修改路由装饰器，去掉路径参数
async def get_webdav_config(request: Request, username: str = None):
    """
    从请求中获取用户名，并返回对应的 WebDAV 配置。

    :param request: FastAPI 请求对象
    :return: 包含用户 WebDAV 配置的 JSON 响应
    :raises HTTPException: 若认证失败或用户配置不存在，抛出异常
    """
    await account.verfiy_by_request(request);
    if username is None:
        username = request.username
    config = WebdavService.get_user_config(username)
    if config:
        return JSONResponse(content=config.to_dict())  # 假设 PythonConfig 有 to_dict 方法
    else:
        raise HTTPException(status_code=404, detail="User WebDAV config not found")

@router.post("/api/set_webdav_config")
async def set_webdav_config(request: Request, username: str = None):
    """
    从请求中获取用户名和新的 WebDAV 配置，并更新对应的配置。

    :param request: FastAPI 请求对象
    :return: 包含更新结果的 JSON 响应
    :raises HTTPException: 若认证失败、用户配置不存在或请求体格式错误，抛出异常
    """
    await account.verfiy_by_request(request);
    if username is None:
        username = request.username
    user_config = WebdavService.get_user_config(username)
    if not user_config:
        raise HTTPException(status_code=404, detail="User WebDAV config not found")
    
    try:
        new_config = await request.json()
        # 假设 PythonConfig 有 update 方法用于更新配置
        user_config.update(new_config)
        return JSONResponse(content={"message": "WebDAV config updated successfully"})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")


