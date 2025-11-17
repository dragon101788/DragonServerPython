
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
        self.ffmpeg_thread = threading.Thread(target=self.run)
        self.ffmpeg_thread.start()
    
    def stop(self):
        self.ffmpeg.stop()
        self.ffmpeg_thread.join()
        print("FFmpeg server stopped")
    
    def push_task(self, task):
        self.task_queue.put(task)
    def pop_task(self):
        return self.task_queue.get()

    def progress_callback(self):
        percent = self.progress * 100
        print(f"Task progress: {percent:.1f}% ")
    def run(self):
        while True:
            task = self.pop_task()
            if task is None:
                break
            try:
                if task.progress_callback is None:
                    task.progress_callback = self.progress_callback
                task.run()
                if task.finish_callback is not None:
                    task.finish_callback(task)
            except Exception as e:
                print(f"Task failed: {e}")
                if task.error_callback is not None:
                    task.error_callback(task,e)

ffmpeg_server = FFmpegServer()

@recv_messages("ffmpeg_transcode")
async def webdav_ffmpeg_transcode(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","deal_with_log")
    
    input_path = get_full_path(uws.ws, body.get("input_file"))
    input_dir = os.path.dirname(input_path)
    input_name = os.path.basename(input_path)
    output_path = os.path.join(input_dir, "TranscoderBackup",input_name.replace(".rm", ".mp4"))
    output_dir = os.path.dirname(output_path)
    output_name = os.path.basename(output_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    transcode_task = ffmpeg_transcode(
        input_file=input_path,
        output_file=output_path,
        video_codec="h264",
        audio_codec="aac",
        video_bitrate="1M",
        audio_bitrate="192k"
    )

    def transcode_error_callback(self,error):
        uws.put(json.dumps({"tag":callbackId,"body":{
                "status":"error",
                "msg":["Transcode failed: "+str(error),
                    f"input_file: {input_path}",
                    f"output_file: {output_path}"]
            }
        }))
    transcode_task.error_callback = transcode_error_callback

    def transcode_progress_callback(self):
        percent = self.progress * 100
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"running","progress": percent}}))
    transcode_task.progress_callback = transcode_progress_callback

    def transcode_finish_callback(self):
        uws.put(json.dumps({"tag":callbackId,"body":{"status":"success","msg":"Transcode finished"}}))
        temp_file = os.path.join(output_dir,input_name+".mv")
        os.rename(input_path,temp_file)
        os.rename(output_path,os.path.join(input_dir,output_name))
        os.rename(temp_file,os.path.join(output_dir,input_name))

    transcode_task.finish_callback = transcode_finish_callback

    ffmpeg_server.push_task(transcode_task)

if __name__ == "__main__":
    
    test_video_file = "account/dragon/webdav/aa.rm"  # 替换为实际的测试视频文件路径
    
    transcode_task = ffmpeg_transcode(
            input_file=test_video_file,
            output_file=test_video_file.replace(".rm", ".mp4"),
            video_codec="h264",
            audio_codec="aac",
            video_bitrate="1M",
            audio_bitrate="192k"
        )
    def transcode_progress_callback(self, task):
        percent = task.progress * 100
        print(f"Transcode progress: {percent:.1f}% ")
    transcode_task.progress_callback = transcode_progress_callback

    def transcode_finish_callback(self, task):
        print("Transcode finished")
    transcode_task.finish_callback = transcode_finish_callback

    ffmpeg_server.push_task(transcode_task)
