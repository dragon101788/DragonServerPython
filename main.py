from nt import mkdir
import src.webdav.WebdavService as WebdavService
import src.WebServer as WebServer
import uvicorn
import Resource
import logging
import asyncio
import sys
import os
import time
import argparse
import pystray
import threading
import random

from datetime import datetime

def setup_tray(name,icon,menu):

        tray_menu = []
        for k,item in menu.items():
            meit = pystray.MenuItem(k,item)
            tray_menu.append(meit)
        
        systray = pystray.Icon(
            name,
            icon,
            name,
            menu=pystray.Menu( *tray_menu),
        )

        # 立即在独立线程中启动托盘图标
        threading.Thread(target=systray.run, daemon=True).start()

start_time = datetime.now().strftime("%y%m%d%H%M%S")
log_path = f"{Resource.get_executable_path()}/log/{start_time}.txt"
os.makedirs(os.path.dirname(log_path), exist_ok=True)
log_file = open(log_path, "w", encoding="utf-8")

def stdout_put(text):
    log_file.write(text)
    log_file.flush()

    if original_stdout and original_stdout.isatty():
        original_stdout.write(text)
        original_stdout.flush()

# 创建自定义的日志处理类
class LogHandler:
    def __init__(self,callback):
        self.callback = callback

    def write(self, text):
        self.callback(text)
    def flush(self):
        pass
    def isatty(self):
        # 返回False表示这不是一个终端设备
        if original_stdout and original_stdout.isatty():
            return True
        return False

original_stdout = sys.stdout
original_stderr = sys.stderr
sys.stdout = LogHandler(stdout_put)
sys.stderr = LogHandler(stdout_put)




if __name__ == "__main__":
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description='DragonServer配置')
    
    # 添加参数
    parser.add_argument('--port', type=int, default=8900, help='服务器端口')
    parser.add_argument('--log_level', type=str, default='error', help='日志级别')
    parser.add_argument('--ssl', action='store_true', help='启用SSL')
    parser.add_argument('--certfile', type=str, help='SSL证书文件路径')
    parser.add_argument('--keyfile', type=str, help='SSL密钥文件路径')
    
    # 解析参数
    args = parser.parse_args()
    # 创建配置
    config = uvicorn.Config(WebServer.app, host="0.0.0.0", port=8900, log_level="error")
    

    if args.port:
        config.port = args.port
    if args.log_level:
        config.log_level = args.log_level
    # 处理SSL配置
    if args.ssl:
        # 如果没有指定证书和密钥文件，尝试自动查找
        if not args.certfile:
            args.certfile = Resource.find_file_by_suffix(".crt")
        if not args.keyfile:
            args.keyfile = Resource.find_file_by_suffix(".key")
    
    # 设置SSL配置
    if args.certfile:
        config.ssl_certfile = args.certfile
    if args.keyfile:
        config.ssl_keyfile = args.keyfile
    

    
    print("version:"+Resource.version.version)
    print("build_date:"+Resource.version.build_date)
    
    print(Resource.debug_path)
    print("port:"+str(config.port))
    print("log_level:"+str(config.log_level))
    print("ssl_certfile:"+str(config.ssl_certfile))
    print("ssl_keyfile:"+str(config.ssl_keyfile))

    
    server = uvicorn.Server(config)

    def exit_app():
        server.shutdown()
        log_file.close()
        sys.stdout = original_stdout
        sys.stderr = original_stderr
        # 使用os._exit代替sys.exit，确保能从任何线程退出整个进程
        os._exit(0)
    hue = random.randint(0,360)
    setup_tray(f"DragonServer{str(config.port)}",
        Resource.DragonImg(hue=hue),{
        f"端口:{config.port}":lambda: print(f"端口:{config.port}"),
        f"SSL:{'开启' if config.ssl_certfile and config.ssl_keyfile else '关闭'}" :lambda: print("SSL"),
        f"版本:{Resource.version.version}":lambda: print(f"版本:{Resource.version.version}"),
        f"构建日期:{Resource.version.build_date}":lambda: print(f"构建日期:{Resource.version.build_date}"),
        "退出": exit_app,
    })
    server.run()
