from ftplib import error_perm
from nt import error
import threading
import subprocess
import os
import time
from queue import Queue
import shutil

from fastapi.responses import JSONResponse
import config
import account
import json
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect ,HTTPException
from urllib.parse import unquote


ffmpeg_config = config.PythonConfig(f"config/ffmpeg_server.py", default_config={
                    "path": 'ffmpeg/bin/ffmpeg.exe',
                    "ffprobe": 'ffmpeg/bin/ffprobe.exe',
                    "ffmpeg_option" : (
                        f" -threads 2 "
                        f" -thread_queue_size 512 "
                        " -preset fast "
                     )
                })


from src.webdav.WebdavService import get_full_path

router = APIRouter()

class Server:
    # 静态任务队列，便于多个实例共享
    task_queue = Queue()
    done_queue = Queue()
    def get_instance():
        if not hasattr(Server, "_instance"):  # 检查是否已经创建了实例
            Server._instance = Server()  # 创建实例
        return Server._instance
    def __init__(self):
        self.current_progress = 0
        self.current_file = ''
        self.status = 'Idle'  # Idle, Transcoding, Error
        self.reason = ''
        self.elapsed_time = 0
        self.lock = threading.Lock()
        self.is_running = False

    def add_task(self, input_path):
        # 检查队列中是否已存在相同路径
        with self.lock:
            # 检查父目录是否是TranscoderBackup
            parent_dir = os.path.basename(os.path.dirname(input_path))
            if parent_dir == 'TranscoderBackup':
                raise HTTPException(status_code=400, detail="跳过TranscoderBackup目录中的文件")
                
            
            if any(task['path'] == input_path for task in list(Server.task_queue.queue)):
                raise HTTPException(status_code=400, detail="文件已存在于队列中")

            if input_path == self.current_file:
                raise HTTPException(status_code=400, detail="文件正在处理中")
                
            Server.task_queue.put({
                "status": "pending",
                "path":input_path,
                "start_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            })

    def get_info(self):
        with self.lock:
            return {
                'progress': self.current_progress,
                'current_file': self.current_file,
                'status': self.status,
                'reason' : self.reason,
                'elapsed_time': self.elapsed_time,
            }

    def get_video_info(self, input_path):
        """获取视频文件的详细信息
        Args:
            input_path: 视频文件路径
        Returns:
            dict: 包含视频信息的字典，格式如下:
                {
                    'duration': 总时长(秒),
                    'size': 文件大小(字节),
                    'format': 容器格式,
                    'video_codec': 视频编码格式,
                    'audio_codec': 音频编码格式,
                    'width': 视频宽度,
                    'height': 视频高度,
                    'bitrate': 比特率,
                    'fps': 帧率
                }
        """
        ffprobe_path = ffmpeg_config.path.replace('ffmpeg.exe', 'ffprobe.exe')
        info_cmd = (
            f'"{ffprobe_path}" '
            '-v error '
            '-show_entries format=duration,size,format_name,bit_rate '
            '-show_entries stream=codec_name,width,height,avg_frame_rate '
            '-show_streams '  # 明确要求显示流信息
            '-of json '
            f'"{input_path}"'
        )
        
        try:
            print(f"执行命令: {info_cmd}")  # 添加调试输出
            process = subprocess.Popen(info_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()
            if process.returncode != 0:
                raise Exception(f"ffprobe error: {stderr.decode('utf-8')}")
            
            info = json.loads(stdout.decode('utf-8'))
            result = {
                'duration': float(info['format'].get('duration', 0)),
                'size': int(info['format'].get('size', 0)),
                'format': info['format'].get('format_name', ''),
                'bitrate': int(info['format'].get('bit_rate', 0))
            }
            
            # 获取视频流信息
            for stream in info.get('streams', []):
                if stream.get('codec_type') == 'video':
                    result.update({
                        'video_codec': stream.get('codec_name', ''),
                        'width': int(stream.get('width', 0)),
                        'height': int(stream.get('height', 0)),
                    })
                    try:
                        result['fps'] = eval(stream.get('avg_frame_rate', '0/1'))
                    except:
                        result['fps'] = 25

                elif stream.get('codec_type') == 'audio':
                    result['audio_codec'] = stream.get('codec_name', '')
            
            return result
            
        except Exception as e:
            print(f"获取视频信息失败: {e}")
            return {
                'duration': 0,
                'size': 0,
                'format': '',
                'video_codec': '',
                'audio_codec': '',
                'width': 0,
                'height': 0,
                'bitrate': 0,
                'fps': 0
            }
    def _transcode(self, input):
        input_path = input["path"]
        self.current_file = input_path
        self.status = 'Transcoding'
        start_time = time.time()

        output_path = os.path.splitext(input_path)[0] + '.ts.mp4'

        ffmpeg_path = ffmpeg_config.path;
        # 获取文件总时长

        info = self.get_video_info(input_path)
        total_duration = info['duration']
        video_codec = info['video_codec']
        audio_codec = info['audio_codec']
        video_code_math = "";
        if video_codec == 'h264':
            video_code_math = "-c:v copy"
        else:
            video_code_math = "-c:v libx264"
        audio_code_math = "";
        if audio_codec == 'aac':
            audio_code_math = "-c:a copy"
        else:
            audio_code_math = "-c:a aac"
        
        command = (
            f'"{ffmpeg_path}"'
            f' -i "{input_path}" '
            f" {ffmpeg_config.ffmpeg_option} "
            f" {video_code_math} "
            f" {audio_code_math} "
            f' "{output_path}" '
            "-y"
        )

         # 创建 STARTUPINFO 对象以隐藏控制台窗口
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE  # 隐藏窗口
        process = subprocess.Popen(command,  stdout=subprocess.PIPE, stderr=subprocess.PIPE,errors='replace' ,encoding='utf-8' , startupinfo=startupinfo)
        error_out = ""
        print(command)
        for line in iter(process.stderr.readline, ''):  # 这里line现在是字符串类型
            #line = line.decode('utf-8', errors='ignore').strip() 
            try:
                #print(line)
                if 'time=' in line:
                    time_str = line.split('time=')[1].split(' ')[0]
                    try:
                        h, m, s = time_str.split(':')
                        s, ms = s.split('.')
                        elapsed = int(h) *3600 + int(m)* 60 + int(s) + int(ms) / 1000
                    except:
                        elapsed = 0
                    if total_duration > 0:
                        progress = min(int((elapsed / total_duration) *100), 100)
                    else:
                        progress = 0
                    with self.lock:
                        self.current_progress = progress
                        self.elapsed_time = int(time.time() - start_time)
                if 'Error' in line:
                    error_out += line;
                if 'error' in line:
                    error_out += line;

                account.send_to_all_clients("ffmpeg_status",{
                    'progress': self.current_progress,
                    'current_file': self.current_file,
                    'status': self.status,
                    'reason' : self.reason,
                    'elapsed_time': self.elapsed_time,
                })
            except Exception as e:
                print(f"Error processing line: {line}")
                print(f"Error details: {e}")
        ret = process.wait()
        if ret != 0:
            self.status = 'Error'
            self.reason = f"转码失败：{ret}"
            input["status"] = "error"
            input["reason"] = f"转码失败：\n {error_out}"
            input["error_time"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            Server.done_queue.put(input)
            account.send_to_all_clients("ffmpeg_queue",{
                "queue" : list(Server.task_queue.queue),
                "done" : list(Server.done_queue.queue)
            })
            print(f"转码失败：\n{ret} {error_out}")
            return
        # 转码完成后，源文件移动到对应目录下的TranscoderBackup文件夹
        backup_dir = os.path.join(os.path.dirname(input_path), 'TranscoderBackup')
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
        try:
            shutil.move(input_path, backup_dir)
            shutil.move(output_path, output_path.replace('.ts.mp4', '.mp4'))
            input["status"] = "success"
            input["reason"] = ""
            input["finish_time"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            Server.done_queue.put(input)
            account.send_to_all_clients("ffmpeg_queue",{
                "queue" : list(Server.task_queue.queue),
                "done" : list(Server.done_queue.queue)
            })
        except Exception as e:
            print(f"文件移动失败：{e}")

        self.status = 'Idle'

    def _worker(self):
        while self.is_running:
            try:
                input = Server.task_queue.get()
                self._transcode(input)
            except Exception as e:
                print(f"转码失败：{e}")
                self.status = 'Error'
                self.reason = f"转码失败{repr(e)}"
                input["status"] = "error"
                input["reason"] = f"转码失败{repr(e)}"
                input["error_time"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
                Server.done_queue.put(input)
                account.send_to_all_clients("ffmpeg_queue",{
                    "queue" : list(Server.task_queue.queue),
                    "done" : list(Server.done_queue.queue)
                })
                continue

    def start(self):
        if not self.is_running:
            self.is_running = True
            self.thread = threading.Thread(target=self._worker)
            self.thread.start()

    def stop(self):
        self.is_running = False
        self.thread.join()


Server.get_instance().start()

@router.get("/api/ffmpeg/get_queue", include_in_schema=False)
async def get_queue(request: Request):
    await account.verfiy_by_request(request);
    # return json.dumps({
    #     "queue" : list(Server.task_queue.queue),
    #     "done" : list(Server.done_queue.queue)
    # })
    return JSONResponse(content={
        "queue" : list(Server.task_queue.queue),
        "done" : list(Server.done_queue.queue)
    })
    return list(Server.task_queue.queue)

@router.get("/api/ffmpeg/get_info", include_in_schema=False)
async def get_info(request: Request):
    await account.verfiy_by_request(request);
    return Server.get_instance().get_info()

@router.post("/api/ffmpeg/add_task/{path:path}", include_in_schema=False)
async def add_task(request: Request, path: str):
    await account.verfiy_by_request(request)
    if path.startswith("/"):
        path = path[1:]  # 移除开头的斜杠
    if not os.path.exists(path):
        path = get_full_path(request, path)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="文件不存在")
    Server.get_instance().add_task(path)
    return JSONResponse(content={
        "message": "任务已添加",
        "path": path
    })

@router.get("/api/ffmpeg/ffmpeg_get_config", include_in_schema=False)
async def ffmpeg_get_config(request: Request):
    await account.verfiy_by_request(request)
    return ffmpeg_config.to_dict()  # 修正为函数调用

@router.post("/api/ffmpeg/ffmpeg_set_config", include_in_schema=False)
async def ffmpeg_set_config(request: Request, config: dict):
    await account.verfiy_by_request(request)
    ffmpeg_config.update(config)
    return {"message": "配置已保存"}


# 使用示例
if __name__== "__main__":
    server.start()
    # 添加任务（请根据实际路径修改）
    server.add_task('D:/test/c.mp4')

    # 监控运行状态
    try:
        while True:
            info = server.get_info()
            if info['status'] == 'Transcoding':
                print(f"状态：{info['status']}, 进度：{info['progress']}%, 文件：{info['current_file']}, 用时：{info['elapsed_time']}秒")
            
            time.sleep(1)

    except KeyboardInterrupt:
        print("停止服务")
        server.stop()
