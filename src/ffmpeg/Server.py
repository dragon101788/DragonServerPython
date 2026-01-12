
import os
import sys
import threading
from queue import Queue
import json
from src.account import recv_messages,UserWebsocket
from .FFmpeg import ffprobe,ffmpeg_transcode,ffmpeg_merger_video_list,ffmpeg_create_thumbnail,ffmpeg_merge_audio_video,ffmpeg_extract_audio,ffmpeg_extract_image
from src.webdav.WebdavService import get_full_path
from datetime import datetime
import shutil
import re



FFMPEG_TEMP_DIR = "FFmpegBackup"

class FFmpegServer():
    
    def __init__(self):
        self.task_queue = Queue()
        
        self.current_task = None

        try:
            with open("done_task.json", "r") as f:
                self.done_task_list = json.load(f)
        except:
            self.done_task_list = []
            
        self.ffmpeg_thread = threading.Thread(target=self.run)
        self.ffmpeg_thread.start()
    
    def stop(self):
        self.ffmpeg.stop()
        self.ffmpeg_thread.join()
        print("FFmpeg server stopped")
    
    def push_task(self, name, task):
        task.name = name
        task.status = "queue"
        self.task_queue.put(task)
    def pop_task(self):
        return self.task_queue.get()

    def done_task(self,task):
        self.done_task_list.append(task.toDict(task))
        with open("done_task.json", "w") as f:
            json.dump(self.done_task_list, f, indent=4)
    def progress_callback(self):
        percent = self.progress * 100
        print(f"Task progress: {percent:.1f}% ")

    def del_task(self,name):
        # 修复done_task_list的迭代删除问题
        for i in range(len(self.done_task_list)-1, -1, -1):
            if self.done_task_list[i].get("name") == name:
                del self.done_task_list[i]
                break
        
        # 修复task_queue.queue的迭代删除问题
        # 创建副本进行迭代，避免deque mutated during iteration错误
        for item in list(self.task_queue.queue):
            if item.name == name:
                self.task_queue.queue.remove(item)

        with open("done_task.json", "w") as f:
            json.dump(self.done_task_list, f, indent=4)
    
    def cancel_task(self,name):
        """
        取消指定名称的任务
        
        参数:
            name: 任务名称
            
        返回:
            bool: 是否成功取消
        """
        # 1. 检查是否是当前正在执行的任务
        if self.current_task is not None and self.current_task.name == name:
            # 调用任务的stop方法停止执行
            self.current_task.stop()
            return True
        
        # 2. 检查是否是排队中的任务
        for item in list(self.task_queue.queue):
            if item.name == name:
                self.task_queue.queue.remove(item)
                return True
        
        # 3. 对于已完成的任务，我们可以选择删除它
        # 调用del_task方法处理已完成的任务
        self.del_task(name)
        return True
    
    def is_exist(self,name):
        for item in self.done_task_list:
            if item.get("name") == name:
                return True
        if self.current_task is not None and self.current_task.name == name:
            return True
        for item in self.task_queue.queue:
            if item.name == name:
                return True
        return False
    def get_list(self):
        return_task = []
        for item in self.done_task_list:
            return_task.append(item)
        
        if self.current_task is not None:
            return_task.append(self.current_task.toDict(self.current_task))
        
        for item in self.task_queue.queue:
            return_task.append(item.toDict(item))

        return return_task
    def get_dict(self,name):
        for item in self.done_task_list:
            if item.get("name") == name:
                return item
        if self.current_task is not None and self.current_task.name == name:
            return self.current_task.toDict(self.current_task)
        for item in self.task_queue.queue:
            if item.name == name:
                return item.toDict(item)
        return None
    def run(self):
        while True:
            task = self.pop_task()
            if task is None:
                break
            try:
                task.status = "run"
                self.current_task = task
                if task.progress_callback is None:
                    task.progress_callback = self.progress_callback
                task.run()
                
                task.status = "done"
                if task.finish_callback is not None:
                    task.finish_callback(task)
                self.current_task = None
                self.done_task(task)
            except Exception as e:
                task.status = "error"
                print(f"Task failed: {e}") 
                self.current_task = None
                if task.error_callback is not None:
                    task.error_callback(task,e)
                
                self.done_task(task)       

ffmpeg_server = FFmpegServer()
connect_list = []

def broadcast_update():
    backlist = ffmpeg_server.get_list()
    for uws in connect_list:
        callbackId = uws.callbackId
        uws.put(json.dumps({"tag":callbackId,"body":{
            "status":"update_list",
            "list":backlist
        }}))

@recv_messages("ffmpeg_del_task_item")
async def webdav_ffmpeg_del_task_item(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","ffmpeg_del_task_item")
    info = ffmpeg_server.get_dict(body.get("name"))
    del_file = body.get("del_file",None)
    if del_file is not None:
        if info is not None:
            if "del_files" in info and os.path.exists(info["del_files"]):
                if os.path.isdir(info["del_files"]):
                    shutil.rmtree(info["del_files"])
                elif os.path.isfile(info["del_files"]):
                    os.remove(info["del_files"])
                elif type(info["del_files"]) == list:
                    for item in info["del_files"]:
                        if os.path.isfile(item):
                            os.remove(item)
                        elif os.path.isdir(item):
                            shutil.rmtree(item)

    ffmpeg_server.del_task(body.get("name"))
    uws.put(json.dumps({"tag":callbackId,"body":{"status":"done"}}))
    broadcast_update()


@recv_messages("ffmpeg_get_media_info")
async def webdav_ffmpeg_get_media_info(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","ffmpeg_get_media_info")
    full_path = get_full_path(uws.ws, body.get("path"))
    try:
        info = ffprobe(full_path)
    except Exception as e:
        print(f"ffprobe运行失败:{e}")
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":str(e)}}))
        return

    if len(info.info) == 0:
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":info.stderr.error}}))
        return
    uws.put(json.dumps({"tag":callbackId,"body":{"status":"ok","info":info.info}}))

@recv_messages("ffmpeg_cancel_task")
async def webdav_ffmpeg_cancel_task(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","ffmpeg_cancel_task")
    name = body.get("name")
    if name is None:
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":"name is None"}}))
        return
    if not ffmpeg_server.is_exist(name):
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":"Task not found"}}))
        return
    ffmpeg_server.cancel_task(name)
    uws.put(json.dumps({"tag":callbackId,"body":{"status":"done"}}))
    broadcast_update()

@recv_messages("ffmpeg_connect")
async def webdav_ffmpeg_connect(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","ffmpeg_connect")
    uws.callbackId = callbackId     
    connect_list.append(uws)
    uws.put(json.dumps({"tag":callbackId,"body":{"status":"update_list","list":ffmpeg_server.get_list()}}))


@recv_messages("ffmpeg_transcode")
async def webdav_ffmpeg_transcode(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","deal_with_log")
    
    input_vir_path   = body.get("input_file")
    input_path = get_full_path(uws.ws, input_vir_path)
    input_dir = os.path.dirname(input_path)
    input_name = os.path.basename(input_path)
    input_ext = os.path.splitext(input_name)[-1]
    output_path = os.path.join(input_dir, FFMPEG_TEMP_DIR,input_name.replace(input_ext, ".mp4"))
    output_dir = os.path.dirname(output_path)
    output_name = os.path.basename(output_path)
    output_vir_path = input_vir_path.replace(input_name,output_name)

    
    #判断input_dir上一级目录是否是FFMPEG_TEMP_DIR目录
    if FFMPEG_TEMP_DIR in input_dir:
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":f"Transcode input file is in {FFMPEG_TEMP_DIR} directory"}}))
        return

    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    if ffmpeg_server.is_exist(input_vir_path):
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":"Transcode task already exists"}}))
        return
    if os.path.exists(output_path):
        os.remove(output_path)

    transcode_task = ffmpeg_transcode(
        input_file=input_path,
        output_file=output_path,
        # video_codec="h264",
        # audio_codec="aac",
        # video_bitrate="1M",
        # audio_bitrate="192k"
    )

    def toDict(self):
        return {
            "name":self.name,
            "status":self.status,
            "cmd" :self.cmd,
            "method":"transcode",
            "error_message":getattr(self,"error_message",""),
            "input_vir_path":input_vir_path,
            "output_vir_path":output_vir_path,
            "input_path":os.path.join(input_dir,output_name),
            "output_path":os.path.join(output_dir,input_name),
            "del_files":os.path.join(output_dir,input_name),
            "progress":self.progress,
        }
    transcode_task.toDict = toDict


    def transcode_error_callback(self,error):
        self.status = "error"
        error_message = str(error)
        #判断长度是否超过100k
        if len(error_message) < 1024*100:
            self.error_message = error_message
        else:
            self.error_message = f"error_message is too long, only keep 100k : {error_message[:1024*100]}"
        broadcast_update()
    transcode_task.error_callback = transcode_error_callback

    def transcode_progress_callback(self):
        percent = self.progress * 100
        broadcast_update()
    transcode_task.progress_callback = transcode_progress_callback

    def transcode_finish_callback(self):
        temp_file = os.path.join(output_dir,input_name+".mv")
        os.rename(input_path,temp_file)
        os.rename(output_path,os.path.join(input_dir,output_name))
        os.rename(temp_file,os.path.join(output_dir,input_name))
        broadcast_update()

    transcode_task.finish_callback = transcode_finish_callback

    ffmpeg_server.push_task(input_vir_path,transcode_task)
    uws.put(json.dumps({"tag":callbackId,"body":{"status":"ok"}}))

@recv_messages("ffmpeg_merger_video_list")
async def webdav_ffmpeg_merger_video_list(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","ffmpeg_merger_video_list")
    input_vir_path_list = body.get("input_file_list")
    if(len(input_vir_path_list) <= 1):
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":"input_file_list is empty"}}))
        return
    input_path_list = [get_full_path(uws.ws, input_vir_path) for input_vir_path in input_vir_path_list]
    input_dir = os.path.dirname(input_path_list[0])
    input_name = os.path.basename(input_path_list[0])
    input_ext = os.path.splitext(input_name)[-1]
    #input_path_list取最大公约数
    output_path = body.get("output_path",None)
    if output_path is None:
        #如果input_name是纯数字
        if os.path.splitext(input_name)[0].isdigit():
            output_name = datetime.now().strftime("合并%Y%m%d%H%M%S%f")+input_ext
            output_path = os.path.join(input_dir,FFMPEG_TEMP_DIR,output_name)
        else:
            input_names = [os.path.splitext(os.path.basename(input_path))[0] for input_path in input_path_list]
            common_prefix = os.path.commonprefix(input_names)
            #去掉 ( _ 等特殊字符
            common_prefix = re.sub(r'[()_-]', '#', common_prefix)
            #去掉开头与末尾的空格
            common_prefix = common_prefix.strip()
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
            output_path = os.path.join(input_dir,FFMPEG_TEMP_DIR,common_prefix+"_合并"+timestamp) + input_ext
    
    output_dir = os.path.dirname(output_path)
    output_name = os.path.basename(output_path)
    output_vir_path = input_vir_path_list[0].replace(input_name,output_name)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    if os.path.exists(output_path):
        os.remove(output_path)

    if ffmpeg_server.is_exist(output_vir_path):
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":"Merger task already exists"}}))
        return

    
    merge_taskr = ffmpeg_merger_video_list(
        video_list=input_path_list,
        output_file=output_path,
    )


    def toDict(self):
        return {
            "name":self.name,
            "status":self.status,
            "method":"concat",
            "cmd" :self.cmd,
            "error_message":getattr(self,"error_message",""),
            "input_vir_path_list":input_vir_path_list,
            "output_vir_path":output_vir_path,
            "input_path_list":input_path_list,
            "output_path":output_path,
            "del_files":os.path.join(output_dir,output_name),
            "progress":self.progress,
        }
    merge_taskr.toDict = toDict

    def merger_error_callback(self,error):
        self.status = "error"
        error_message = str(error)
        #判断长度是否超过100
        if len(error_message) < 1024*100:
            self.error_message = error_message
        else:
            self.error_message = f"error_message is too long, only keep 100k: {error_message[:1024*100]}"
        broadcast_update()
    merge_taskr.error_callback = merger_error_callback
    
    def merger_progress_callback(self):
        percent = self.progress * 100
        broadcast_update()
    merge_taskr.progress_callback = merger_progress_callback

    def merger_finish_callback(self):
        os.rename(output_path,os.path.join(input_dir,output_name))
        os.mkdir(os.path.join(output_dir,output_name))
        for input_path in input_path_list:
            os.rename(input_path,os.path.join(output_dir,output_name,os.path.basename(input_path)))
        broadcast_update()
    merge_taskr.finish_callback = merger_finish_callback


    ffmpeg_server.push_task(output_vir_path,merge_taskr)
    uws.put(json.dumps({"tag":callbackId,"body":{"status":"ok"}}))
