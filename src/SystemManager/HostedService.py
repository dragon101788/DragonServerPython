

from src.server_config import *    
import process
import atexit
"""
"type" : "Hosted Service",#服务类型Hosted Service 
"enabled" : True, #是否启用，默认True
"path" : "D:/aaa.exe",
"cwd"  : None, #工作目录，默认None
"args" : None, #启动参数，默认None
"""
class HostedService():
    map = {}
    @staticmethod
    def loadmap_from_config():
        server_list = server_config.get("server_list", [])
        for server_info in server_list:
            try:
                type = server_info["type"]
                if type != "Hosted Service":
                    continue
                enabled = server_info.get("enabled", True)
                if not enabled:
                    continue
                path = server_info["path"]
                cwd = server_info.get("cwd", None)
                args = server_info.get("args", None)
                if cwd == "null" or cwd == "None" or cwd == "":
                    cwd = None
                if args == "null" or args == "None" or args == "":
                    args = None
                if not os.path.exists(path):
                    print(f"[托管服务] 配置文件有误: {path} 不存在")
                    continue
                if cwd and not os.path.exists(cwd):
                    print(f"[托管服务] 配置文件有误: {cwd} 不存在")
                    continue
                HostedService.map[path] = process.thread_process(path, cwd=cwd, args=args,prefix=f"[{path}] ")
            except Exception as e:
                print(f"[托管服务] 配置文件有误: {str(e)}")
                continue
    @staticmethod
    def stop_all():
        for path in HostedService.map:
            HostedService.map[path].stop()
    @staticmethod
    def start_all():
        for path in HostedService.map:
            HostedService.map[path].start()

atexit.register(HostedService.stop_all)
