import re
from fastapi import APIRouter, FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response ,StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from urllib.parse import quote ,unquote
import mimetypes
import hashlib
import src.account as account 
from src.config import PythonConfig
import shutil
import time
import io
import json
import os
from fnmatch import fnmatch
from xml.etree import ElementTree as ET
import aiofiles

from PIL import Image
from src.server_config import *    
from src.webdav.Thumb import ResponseThumb ,remove_cache
# 定义 WebDAV 命名空间
ns = {'D': 'DAV:'}

# 注册命名空间前缀
ET.register_namespace('D', ns['D'])

userconfig = {}

app = FastAPI()
router = APIRouter()

app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"]
        )





def log(log_level ,message :str):
    if server_config.log_level > log_level :
        print(message);

def log_requst(log_level,request):
    if server_config.log_level < log_level :
        return;
    def element2str(element, indent=0):
        outstr = '  ' * indent + f" {element.tag}"
        if element.text is not None:
            outstr += f" {element.text.strip()}"
        if element.attrib is not None and len(element.attrib) > 0:
            outstr += f" {element.attrib}"
        outstr += "\n"
        for child in element:
            outstr += element2str(child, indent + 1)
        return outstr
        
    print(element2str(request))

def get_full_path(request: Request, webpath: str) -> str:
    """
    获取文件或目录的完整路径，并检查是否在根目录下，防止路径遍历攻击。
    返回完整路径
    """
    user_config = get_user_config(request.username)
    user_dir = user_config["path"]

    if user_config.get("virtual_paths") is not None:
        for virtual_path, config in user_config["virtual_paths"].items():
            if webpath.startswith(virtual_path) or webpath.startswith("/" + virtual_path):
                if not virtual_path.endswith("/"):
                    virtual_path += "/"
                real_path = os.path.abspath(os.path.join(config["path"], webpath[len(virtual_path):].lstrip("/")))
                return real_path
                
    full_path = os.path.abspath(os.path.join(user_dir, webpath.lstrip("/")))
    if full_path.startswith(os.path.abspath(user_dir)):
        return full_path
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

def path_is_readonly(request: Request, webpath: str) -> bool:
    """
    检查路径是否为只读模式
    返回布尔值表示是否只读
    """
    return path_attribute(request, webpath,"readonly")


def path_attribute(request: Request, webpath: str,math :str,default = False) -> bool:

    user_config = get_user_config(request.username)
    ret = user_config.get(math, default)

    if user_config.get("virtual_paths") is not None:
        for virtual_path, config in user_config["virtual_paths"].items():
            if webpath.startswith(virtual_path):
                return config.get(math, ret)
    
    return ret

def get_user_config(username):
    try:
        if username is not None:
            config = userconfig.get(username);
            if config is None:
                userconfig[username] = PythonConfig(f"{account.ACCOUNT_DIR}/{username}/webdav.py")

            return userconfig[username] 
    except Exception as e:
        #用户没有访问权限
        create_user_dav_config(username)
        return userconfig[username];
    
    
def create_user_dav_config(username):
    userconfig[username] = PythonConfig(f"{account.ACCOUNT_DIR}/{username}/webdav.py", default_config={
                    "path": f"{account.ACCOUNT_DIR}/{username}/webdav/",
                    "readonly": False,
                    "disk_quota": "1GB",  
                })
    os.makedirs(os.path.dirname(userconfig[username].get("path")), exist_ok=True)


# 定义支持的 WebDAV 方法
methods = ["OPTIONS", "GET", "HEAD", "POST", "PUT", "DELETE", "MOVE", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "LOCK", "UNLOCK"]

# 处理 OPTIONS 请求
@router.api_route("/{path:path}", methods=["OPTIONS"], include_in_schema=False)
async def do_OPTIONS(request: Request, path: str):
    """
    处理 OPTIONS 请求，返回服务器支持的方法列表。
    """
    log(5, f"do_OPTIONS {path}")
    await account.verfiy_by_request(request);
    allow = ', '.join(methods)
    headers = {
        "Allow": allow,
        "DAV": "1, 2"
    }
    return Response(headers=headers, status_code=200)

# 处理 HEAD 请求
@router.api_route("/{path:path}", methods=["HEAD"], include_in_schema=False)
async def do_HEAD(request: Request, path: str):
    """
    处理 HEAD 请求，返回文件的响应头信息。
    """
    log(5, f"do_HEAD {path}")
    await account.verfiy_by_request(request)
    full_path = get_full_path(request, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Not Found")
    if os.path.isdir(full_path):
        raise HTTPException(status_code=404, detail="Not Found")

    mimetype, _ = mimetypes.guess_type(full_path)
    file_size = os.path.getsize(full_path)

    range_header = request.headers.get('Range')
    if range_header:
        start, end = range_header.replace('bytes=', '').split('-')
        start = int(start)
        end = int(end) if end else file_size - 1
        length = end - start + 1

        headers = {
            'Content-Range': f'bytes {start}-{end}/{file_size}',
            'Accept-Ranges': 'bytes',
            'Content-Length': str(length),
            'Content-Type': mimetype or "application/octet-stream"
        }
        return Response(headers=headers, status_code=206)
    else:
        headers = {
            'Content-Length': str(file_size),
            'Content-Type': mimetype or "application/octet-stream"
        }
        return Response(headers=headers, status_code=200)


CHUNK_SIZE = 1024*1024*1  # 每次读取的字节数
# 处理 GET 请求
@router.api_route("/{path:path}", methods=["GET"], include_in_schema=False)
async def do_GET(request: Request, path: str):
    """
    处理 GET 请求，返回文件的内容。
    """
    
    await account.verfiy_by_request(request)
    full_path = get_full_path(request, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Not Found")

    mimetype, _ = mimetypes.guess_type(full_path)
    file_size = os.path.getsize(full_path)

    thumb = request.query_params.get("thumb",None)
    if thumb is not None:
        return ResponseThumb(full_path,size = int(thumb),mimetype=mimetype)

    # 增加连接超时设置
    CHUNK_SIZE = 1024*1024*2  # 增加块大小以减少IO操作次数，提高大文件传输效率
    
    range_header = request.headers.get('Range')
    if range_header:
        log(4, f"do_GET {request.username} {path} range_header={range_header}")
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
                    async with aiofiles.open(full_path, 'rb') as f:
                        await f.seek(start)
                        remaining = length
                        while remaining > 0:
                            chunk_size = min(remaining, CHUNK_SIZE)
                            chunk = await f.read(chunk_size)
                            if not chunk:
                                break
                            # 在yield时捕获可能的异常，如客户端断开连接
                            try:
                                yield chunk
                            except GeneratorExit:
                                # 客户端断开连接，优雅地退出生成器
                                log(3, f"Client disconnected during range file transfer for {path}")
                                break
                            remaining -= chunk_size
                except Exception as e:
                    log(1, f"Error during range file transfer for {path}: {str(e)}")
                    # 不抛出异常，避免在日志中显示不必要的错误

            headers = {
                'Content-Range': f'bytes {start}-{end}/{file_size}',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(length),
                'Content-Type': mimetype or "application/octet-stream",
                'Connection': 'keep-alive'  # 保持连接活跃
            }
            return StreamingResponse(file_generator(), status_code=206, headers=headers)
        except Exception as e:
            # 处理解析Range头或其他错误
            log(2, f"Error processing range header for {path}: {str(e)}")
            # 出错时返回完整文件而不是失败
            pass
    
    # 无论是否有Range请求或处理Range请求失败，都能返回文件
    log(4, f"do_GET {request.username} {path} all")
    async def file_generator():
        try:
            async with aiofiles.open(full_path, 'rb') as f:
                while True:
                    chunk = await f.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    # 在yield时捕获可能的异常，如客户端断开连接
                    try:
                        yield chunk
                    except GeneratorExit:
                        # 客户端断开连接，优雅地退出生成器
                        log(3, f"Client disconnected during full file transfer for {path}")
                        break
        except Exception as e:
            log(1, f"Error during full file transfer for {path}: {str(e)}")
            # 不抛出异常，避免在日志中显示不必要的错误

    headers = {
        'Content-Length': str(file_size),
        'Content-Type': mimetype or "application/octet-stream",
        'Connection': 'keep-alive'  # 保持连接活跃
    }
    return StreamingResponse(file_generator(), headers=headers, media_type=mimetype or "application/octet-stream")

# 处理 MOVE 请求
@router.api_route("/{path:path}", methods=["MOVE"], include_in_schema=False)
async def do_MOVE(request: Request, path: str):
    """
    处理 MOVE 请求，将文件或目录移动到指定位置。
    """
    
    await account.verfiy_by_request(request);
    # 获取源路径及其只读状态
    src_path = get_full_path(request, path)
    src_readonly = path_is_readonly(request, path)
    # 检查源路径是否为只读模式
    if src_readonly:
        raise HTTPException(status_code=405, detail="Method Not Allowed: Source path is read-only")

    # 从请求头中获取 Destination 字段
    destination = request.headers.get("Destination")
    if not destination:
        raise HTTPException(status_code=400, detail="Missing Destination header")
    # 解码 Destination 字段
    decoded_destination = unquote(destination)
    # 从请求头中获取 Overwrite 字段，默认为 T
    overwrite = request.headers.get("Overwrite", "T").upper() == "T"

    web_dest_path = decoded_destination.replace(request.url.scheme + "://" + request.url.netloc + "/", "")
    # 获取目标路径及其只读状态
    dest_path = get_full_path(request, web_dest_path)
    dest_readonly = path_is_readonly(request, web_dest_path)
    # 检查目标路径是否为只读模式
    if dest_readonly:
        raise HTTPException(status_code=405, detail="Method Not Allowed: Destination path is read-only")

    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="Not Found")
    if os.path.exists(dest_path) and not overwrite:
        raise HTTPException(status_code=409, detail="Conflict")

    try:
        log(5, f"{request.username} move {src_path} to {dest_path}")
        if os.path.exists(dest_path):
            if os.path.isdir(dest_path):
                shutil.rmtree(dest_path)
            else:
                os.remove(dest_path)
        # 移动文件或目录
        if os.path.isdir(src_path):
            shutil.move(src_path, dest_path)
        else:
            shutil.move(src_path, dest_path)
        return Response(status_code=201 if os.path.isdir(src_path) else 204)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 处理 COPY 请求
@router.api_route("/{path:path}", methods=["COPY"], include_in_schema=False)
async def do_COPY(request: Request, path: str):
    """
    处理 COPY 请求，复制文件或目录。
    """
    log(5, f"do_COPY {path}")
    await account.verfiy_by_request(request);
    # 获取源路径及其只读状态
    src_path = get_full_path(request, path)
    # 从请求头中获取 Destination 字段
    destination = request.headers.get("Destination")
    if not destination:
        raise HTTPException(status_code=400, detail="Missing Destination header")
    # 解码 Destination 字段
    decoded_destination = unquote(destination)
    # 获取目标路径及其只读状态
    dest_path = get_full_path(request, decoded_destination.replace(request.url.scheme + "://" + request.url.netloc + "/", ""))
    dest_readonly = path_is_readonly(request, decoded_destination.replace(request.url.scheme + "://" + request.url.netloc + "/", ""))
    # 检查目标路径是否为只读模式
    if dest_readonly:
        raise HTTPException(status_code=405, detail="Method Not Allowed: Destination path is read-only")

    # 从请求头中获取 Overwrite 字段，默认为 T
    overwrite = request.headers.get("Overwrite", "T").upper() == "T"
    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="Not Found")
    if os.path.exists(dest_path) and not overwrite:
        raise HTTPException(status_code=409, detail="Conflict")
    try:
        if os.path.isdir(src_path):
            if os.path.exists(dest_path):
                shutil.rmtree(dest_path)
            shutil.copytree(src_path, dest_path)
            return Response(status_code=201)
        else:
            shutil.copy2(src_path, dest_path)
            return Response(status_code=204)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_directory_size(directory):
    """
    计算指定目录的大小（以字节为单位）。

    :param directory: 要计算大小的目录路径
    :return: 目录的总大小（字节）
    """
    total_size = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                total_size += os.path.getsize(file_path)
            except OSError:
                pass
    return total_size
def parse_disk_quota(quota_str):
    """
    解析磁盘配额字符串，返回总字节数。

    :param quota_str: 磁盘配额字符串，如 "1GB", "2g", "3MB", "3m"
    :return: 总字节数，若解析失败则返回 None
    """
    # 使用正则表达式匹配字符串
    match = re.match(r'^(\d+)([a-zA-Z]*)$', quota_str)
    if not match:
        return None

    disk_quota = int(match.group(1))
    disk_quota_unit = match.group(2).upper()

    # 统一单位并转换为字节数
    if disk_quota_unit == 'K' or disk_quota_unit == 'KB':
        multiplier = 1024
    elif disk_quota_unit == 'M' or disk_quota_unit == 'MB':
        multiplier = 1024 ** 2
    elif disk_quota_unit == 'G' or disk_quota_unit == 'GB':
        multiplier = 1024 ** 3
    else:
        return None

    return disk_quota * multiplier

class PropfindResponse:
    def __init__(self):
        # 构建 WebDAV 标准的 XML 响应
        self.multistatus = ET.Element("{DAV:}multistatus")
    def add_resource_info(self,info):
        if info is not None:
            self.multistatus.append(info)
    def to_string(self):
        # 将 ElementTree 转换为 XML 字符串
        return ET.tostring(self.multistatus, encoding="utf-8", xml_declaration=True)
    def __str__(self):
        return self.to_string()

    @staticmethod
    async def RequestProp(request):
        body = await request.body()
        if body != None and body != b'':
            return ET.fromstring(body)
        return None
    #磁盘容量与配额限制,后期可以加入更合理的逻辑,目前仅支持固定值,等待后续优化
    @staticmethod
    async def add_external_prop(request :Request,prop:ET.Element,resource_path):
        # if("user_config" in kwargs):
        #     user_config = kwargs.get("user_config")
        
        ExternalRequest = await PropfindResponse.RequestProp(request)
        if ExternalRequest is not None:
            
            log(10,"add_external_prop")
            #嵌套遍历打印ExternalRequest
            log_requst(10,request)

            user_config = request.user_config;
            if (len(ExternalRequest.findall(".//{DAV:}quota-available-bytes")) > 0):
                total_size = get_directory_size(resource_path)
                # 调用 parse_disk_quota 获取总字节数
                disk_quota_bytes = parse_disk_quota(user_config.get("disk_quota","1GB"))
                if disk_quota_bytes is not None:
                    available_bytes = disk_quota_bytes - total_size
                else:
                    available_bytes = 0
                p1 = ET.Element("{DAV:}quota-available-bytes")
                p1.text= str(available_bytes)
                prop.append(p1)
                p2 = ET.Element("{DAV:}quota-used-bytes");
                p2.text = str(total_size)
                prop.append(p2)
            if (len(ExternalRequest.findall(".//{DAV:}limits")) > 0):
                p1 = ET.Element("{DAV:}limits");
                limits = path_attribute(request, resource_path,"limits",["download", "upload", "delete"])
                p1.text = json.dumps(limits)
                prop.append(p1)
            

    @staticmethod
    async def build_resource_info(webpath, resource_path, request  ):  # 增加只读参数，默认值为 False
        # 创建临时节点
        response = ET.Element("{DAV:}response")
        try:
            # 对路径进行编码
            encoded_webpath = quote(webpath.replace(os.sep, '/'), safe='/')
            href = ET.SubElement(response, "{DAV:}href")
            href.text = f"/{encoded_webpath}"
            propstat = ET.SubElement(response, "{DAV:}propstat")
            prop = ET.SubElement(propstat, "{DAV:}prop")
    
            # 修改时间
            getlastmodified = ET.SubElement(prop, "{DAV:}getlastmodified")
            getlastmodified.text = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime(os.path.getmtime(resource_path)))
    
            # 资源类型
            resourcetype = ET.SubElement(prop, "{DAV:}resourcetype")
            if os.path.isdir(resource_path):
                ET.SubElement(resourcetype, "{DAV:}collection")
    
            # 显示名称
            displayname = ET.SubElement(prop, "{DAV:}displayname")
            displayname.text = os.path.basename(webpath)
    
            # 支持的锁定类型
            supportedlock = ET.SubElement(prop, "{DAV:}supportedlock")
            lockentry = ET.SubElement(supportedlock, "{DAV:}lockentry")
            lockscope = ET.SubElement(lockentry, "{DAV:}lockscope")
            ET.SubElement(lockscope, "{DAV:}exclusive")
            locktype = ET.SubElement(lockentry, "{DAV:}locktype")
            ET.SubElement(locktype, "{DAV:}write")
    
            # 创建时间
            creationdate = ET.SubElement(prop, "{DAV:}creationdate")
            creationdate.text = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(os.path.getctime(resource_path)))
    
            # 文件大小
            if os.path.isfile(resource_path):
                getcontentlength = ET.SubElement(prop, "{DAV:}getcontentlength")
                getcontentlength.text = str(os.path.getsize(resource_path))
            else:
                getcontentlength = ET.SubElement(prop, "{DAV:}getcontentlength")
                getcontentlength.text = "0"
    
            # MIME 类型
            getcontenttype = ET.SubElement(prop, "{DAV:}getcontenttype")
            if os.path.isdir(resource_path):
                getcontenttype.text = "httpd/unix-directory"
            else:
                mimetype, encoding = mimetypes.guess_type(resource_path)
                if mimetype is None:
                    getcontenttype.text = "application/octet-stream"
                else:
                    if encoding is not None:
                        getcontenttype.text = mimetype + ";" + encoding
                    else:
                        getcontenttype.text = mimetype
            # ETag 属性
            getetag = ET.SubElement(prop, "{DAV:}getetag")
            if os.path.isfile(resource_path):
                # 获取文件名、修改时间和文件大小
                file_name = os.path.basename(resource_path)
                file_mtime = os.path.getmtime(resource_path)
                file_size = os.path.getsize(resource_path)
                # 组合信息并计算 MD5 哈希值
                combined_info = f"{file_name}{file_mtime}{file_size}".encode()
                etag = hashlib.md5(combined_info).hexdigest()
                getetag.text = f'"{etag}"'
            elif os.path.isdir(resource_path):
                # 目录的 ETag 可以基于修改时间和子文件数量生成
                dir_mtime = os.path.getmtime(resource_path)
                dir_items = len(os.listdir(resource_path))
                etag = hashlib.md5(f"{dir_mtime}{dir_items}".encode()).hexdigest()
                getetag.text = f'"{etag}"'

            
            readonly = path_is_readonly(request,webpath);
            # 增加只读属性
            isreadonly = ET.SubElement(prop, "{DAV:}readonly")
            isreadonly.text = str(readonly).lower()
    
            # 添加 lockdiscovery 和 activelock 元素
            lockdiscovery = ET.SubElement(prop, "{DAV:}lockdiscovery")
            if readonly:
                activelock = ET.SubElement(lockdiscovery, "{DAV:}activelock")
                lockscope = ET.SubElement(activelock, "{DAV:}lockscope")
                ET.SubElement(lockscope, "{DAV:}exclusive")
                locktype = ET.SubElement(activelock, "{DAV:}locktype")
                ET.SubElement(locktype, "{DAV:}write")
                lockroot = ET.SubElement(activelock, "{DAV:}lockroot")
                ET.SubElement(lockroot, "{DAV:}href").text = f"/{quote(webpath.replace(os.sep, '/'), safe='/')}"
                locktoken = ET.SubElement(activelock, "{DAV:}locktoken")
                ET.SubElement(locktoken, "{DAV:}href").text = "opaquelocktoken:readonly"

            #磁盘容量与配额限制,后期可以加入更合理的逻辑
            await PropfindResponse.add_external_prop(request,prop,resource_path)

            status = ET.SubElement(propstat, "{DAV:}status")
            status.text = "HTTP/1.1 200 OK"
        except PermissionError as e:
            # 捕获权限错误，不做处理，跳过该资源信息的添加
            #print(f"访问{webpath} {resource_path}权限错误，不做处理，跳过该资源信息的添加 PermissionError: {e}")
            return None
        
        return response
# 处理 PROPFIND 请求
@router.api_route("/{path:path}", methods=["PROPFIND"], include_in_schema=False)
async def do_PROPFIND(request: Request, path: str):
    await account.verfiy_by_request(request);
    # 从请求头中获取 Depth 参数，默认为 0
    depth = request.headers.get("Depth", "0")
    if depth not in ["0", "1", "infinity"]:
        raise HTTPException(status_code=400, detail="Invalid Depth header")


    Search = request.headers.get("Search", None)
    
    
    user_config = get_user_config(request.username)
    request.user_config = user_config;

    response = PropfindResponse()
    
    # 定义需要跳过的系统目录列表
    SKIP_DIRS = ["$RECYCLE.BIN", "System Volume Information" ,"Recovery" , "$WINDOWS.~BT", "$WINDOWS.~WS", "$SysReset"]

    async def traverse_directory(path, full_path, current_depth):
        if depth == "0" or current_depth > 0 and depth == "1":
            return
        if os.path.isdir(full_path):
            for name in os.listdir(full_path):
                sub_path = os.path.join(full_path, name)
                # 检查目录名是否在需要跳过的列表中
                if name in SKIP_DIRS:
                    continue
                sub_webpath = os.path.join(path, name)
                sub_full_path = get_full_path(request, sub_webpath)
                node = await PropfindResponse.build_resource_info(sub_webpath, sub_full_path, request)
                response.add_resource_info(node) 
                if depth == "infinity" and os.path.isdir(sub_path):
                    await traverse_directory(sub_webpath, sub_path, current_depth + 1)
        if path == "" and "virtual_paths" in user_config:
            for virtual_path, config in user_config["virtual_paths"].items():
                if os.path.exists(config["path"]):
                    virtual_response = await PropfindResponse.build_resource_info(
                        virtual_path, config["path"],  request)
                    response.add_resource_info(virtual_response)

    async def search_directory(path, full_path, current_depth):
        if depth == "0" or current_depth > 0 and depth == "1":
            return
        if os.path.isdir(full_path):
            for name in os.listdir(full_path):
                sub_path = os.path.join(full_path, name)
                # 检查目录名是否在需要跳过的列表中
                if name in SKIP_DIRS:
                    continue
                sub_webpath = os.path.join(path, name)
                
                if fnmatch(name, Search):
                    node = await PropfindResponse.build_resource_info(sub_webpath, sub_path, request)
                    print(f"add {sub_webpath}({sub_path})")
                    response.add_resource_info(node) 

                if depth == "infinity" and os.path.isdir(sub_path):
                    await search_directory(sub_webpath, sub_path, current_depth + 1)

        if path == "" and "virtual_paths" in user_config:
            for virtual_path, config in user_config["virtual_paths"].items():
                if os.path.exists(config["path"]):
                    await search_directory(virtual_path, config["path"], 0)
                    

    full_path = get_full_path(request, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"{path} Not Found")
    
    if Search == None:
        log(6,f"{request.username}浏览目录:{full_path}({depth}) ");

        node = await PropfindResponse.build_resource_info(path, full_path, request)

        response.add_resource_info(node) 

        # 当 Depth 不为 0 且当前路径是目录时，遍历子目录
        if depth != "0" and os.path.isdir(full_path):
            await traverse_directory(path, full_path, 0)
    else:
        log(6,f"{request.username}搜索目录:{full_path}({depth}) Search:{Search}");
        await search_directory(path, full_path, 0)
   
            
    return Response(content=response.to_string(), media_type="application/xml", status_code=207)

# 处理 MKCOL 请求
@router.api_route("/{path:path}", methods=["MKCOL"], include_in_schema=False)
async def do_MKCOL(request: Request, path: str):
    """
    处理 MKCOL 请求，创建目录。
    """

    await account.verfiy_by_request(request);
    full_path = get_full_path(request, path)
    readonly = path_is_readonly(request, path)
    if readonly:
        raise HTTPException(status_code=405, detail="Method Not Allowed")
    if os.path.exists(full_path):
        raise HTTPException(status_code=409, detail="Directory already exists")
    try:
        
        log(5,f"{request.username} 新建目录 {path} ");
        os.makedirs(full_path)
        return Response(status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 处理 PUT 请求
@router.api_route("/{path:path}", methods=["PUT"], include_in_schema=False)
async def do_PUT(request: Request, path: str):
    """
    处理 PUT 请求，上传文件，支持断点续传。
    """

    await account.verfiy_by_request(request);
    full_path = get_full_path(request, path)
    readonly = path_is_readonly(request, path)
    # 检查是否为只读模式
    if readonly:
        raise HTTPException(status_code=405, detail="Method Not Allowed")

    content_range = request.headers.get('Content-Range')
    if content_range:
        # 解析 Content-Range 头
        try:
            range_info = content_range.split(' ')[1]
            start_end, total = range_info.split('/')
            start, end = map(int, start_end.split('-'))
            total = int(total)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid Content-Range header")

        # 确保文件所在目录存在
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        
        log(5,f"{request.username} 上传文件 {path}");
        # 以追加模式打开文件
        with open(full_path, "r+b" if os.path.exists(full_path) else "wb") as f:
            f.seek(start)
            async for chunk in request.stream():
                f.write(chunk)

        if end + 1 == total:
            return Response(status_code=200)  # 上传完成
        else:
            return Response(status_code=206)  # 部分上传
    else:
        # 确保文件所在目录存在
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        try:
            with open(full_path, "wb") as f:
                async for chunk in request.stream():
                    f.write(chunk)
            return Response(status_code=201)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# 处理 DELETE 请求
@router.api_route("/{path:path}", methods=["DELETE"], include_in_schema=False)
async def do_DELETE(request: Request, path: str):
    """
    处理 DELETE 请求，删除文件或目录。
    """
    await account.verfiy_by_request(request);
    def check_is_virtual_path(path,username):
        user_config = get_user_config(username)
        if "virtual_paths" in user_config: 
            if path.endswith("/"):
                path = path[:-1]
            if path in user_config["virtual_paths"]:
                return True
        return False
    
    if check_is_virtual_path(path,request.username):
        raise HTTPException(status_code=405, detail="Method Not Allowed")

    full_path = get_full_path(request, path)
    readonly = path_is_readonly(request, path)

    only_thumb = request.headers.get("only_thumb","0")
    if only_thumb == "1":
        remove_cache(full_path)
        return Response(status_code=204)

    # 检查是否为只读模式
    if readonly:
        raise HTTPException(status_code=405, detail="Method Not Allowed")
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Not Found")
    try:

        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
        remove_cache(full_path, size)
        
        return Response(status_code=204)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 处理 PROPPATCH 请求
@router.api_route("/{path:path}", methods=["PROPPATCH"], include_in_schema=False)
async def do_PROPPATCH(request: Request, path: str):
    """
    处理 PROPPATCH 请求，修改资源的属性。
    """
    log(5,f"do_PROPPATCH {path}")
    await account.verfiy_by_request(request);
    full_path = get_full_path(request, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        # 解析请求的 XML 数据
        xml_data = await request.body()
        root = ET.fromstring(xml_data)

        # 查找 set 和 remove 元素
        set_element = root.find('{DAV:}set')
        remove_element = root.find('{DAV:}remove')

        # 目前仅支持显示名称的修改
        if set_element is not None:
            for prop in set_element.findall('.//{DAV:}prop'):
                displayname = prop.find('{DAV:}displayname')
                if displayname is not None:
                    # 这里简单示例，实际可能需要更复杂处理
                    new_name = displayname.text
                    parent_dir = os.path.dirname(full_path)
                    new_path = os.path.join(parent_dir, new_name)
                    os.rename(full_path, new_path)
                    full_path = new_path  # 更新当前路径

        # 构建 WebDAV 标准的 XML 响应
        multistatus = ET.Element('{DAV:}multistatus')
        response = ET.SubElement(multistatus, '{DAV:}response')
        href = ET.SubElement(response, '{DAV:}href')
        rel_path = os.path.relpath(full_path,  get_user_config(request.username)["path"])
        encoded_rel_path = quote(rel_path.replace(os.sep, '/'), safe='/')
        href.text = f"/{encoded_rel_path}"
        propstat = ET.SubElement(response, '{DAV:}propstat')
        prop = ET.SubElement(propstat, '{DAV:}prop')
        status = ET.SubElement(propstat, '{DAV:}status')
        status.text = "HTTP/1.1 200 OK"

        xml_response = ET.tostring(multistatus, encoding="utf-8", xml_declaration=True)
        return Response(content=xml_response, media_type="application/xml", status_code=207)

    except ET.ParseError:
        raise HTTPException(status_code=400, detail="Invalid XML format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





app.include_router(router)

if not os.path.exists(os.path.join(account.ACCOUNT_DIR,"guest")):
    create_user_dav_config("guest")

if not os.path.exists(os.path.join(account.ACCOUNT_DIR,"dragon","webdav")):
    create_user_dav_config("dragon")