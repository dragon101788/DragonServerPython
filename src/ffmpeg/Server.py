
import os
import sys
import threading
from queue import Queue
import json
from src.account import recv_messages,UserWebsocket
from .FFmpeg import ffmpeg_transcode,ffmpeg_merger_video_list,ffmpeg_create_thumbnail,ffmpeg_merge_audio_video,ffmpeg_extract_audio,ffmpeg_extract_image
from src.webdav.WebdavService import get_full_path

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
                if task.finish_callback is not None:
                    task.finish_callback(task)
                self.current_task = None
                task.status = "done"
                self.done_task(task)
            except Exception as e:
                task.status = "error"
                print(f"Task failed: {e}")
                self.done_task(task)        
                self.current_task = None
                if task.error_callback is not None:
                    task.error_callback(task,e)

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
async def webdav_ffmpeg_disconnect(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","ffmpeg_disconnect")
    ffmpeg


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
    output_path = os.path.join(input_dir, "TranscoderBackup",input_name.replace(".rm", ".mp4"))
    output_dir = os.path.dirname(output_path)
    output_name = os.path.basename(output_path)
    output_vir_path = input_vir_path.replace(input_name,output_name)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    if ffmpeg_server.is_exist(input_vir_path):
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":"Transcode task already exists"}}))
        return
    if os.path.exists(output_path):
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"error","msg":"Transcode output file already exists"}}))
        return
    transcode_task = ffmpeg_transcode(
        input_file=input_path,
        output_file=output_path,
        video_codec="h264",
        audio_codec="aac",
        video_bitrate="1M",
        audio_bitrate="192k"
    )

    def toDict(self):
        return {
            "name":self.name,
            "status":self.status,
            "input_vir_path":input_vir_path,
            "output_vir_path":output_vir_path,
            "input_path":input_path,
            "output_path":output_path,
            "progress":self.progress,
        }
    transcode_task.toDict = toDict


    def transcode_error_callback(self,error):
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

