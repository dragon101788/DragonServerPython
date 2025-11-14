import sys
from unittest import result
import os
sys.path.append(os.getcwd())
from src.process import process
from datetime import datetime
from collections import deque

import json


# 导入配置
import src.config as config
ffmpeg_config = config.PythonConfig("config/ffmpeg_server.py",default_config = 
    {
        'path': 'ffmpeg/bin/ffmpeg.exe', 
        'ffprobe': 'ffmpeg/bin/ffprobe.exe', 
        'ffmpeg_option': ' -threads 2  -thread_queue_size 512  -preset fast ', 
        'thumb_pos': 0.3
    }
)



#参考用例
#    info = ffprobe(input_file)
#    print(info.get("format",{}).get("duration","未知"))
class ffprobe():
    class std_err():
        def __init__(self):
            self.error = ""
        def write(self,data):
            self.error += data
        def flush(self):
            pass
    def __init__(self,input_file = None):
        self.input_file = input_file
        
        self.info = {}
        self.buffer = []
        if self.input_file:
            self.immediate(self.input_file)
        
    def immediate(self,input_file):
        self.input_file = input_file

        cmd = ffmpeg_config['ffprobe'] + f" -i {self.input_file} -show_format -show_streams -of json"
        print(cmd)
        self.stderr = self.std_err()
        ffmpeg_process = process(cmd,stdout=self,stderr=self.stderr)
        ffmpeg_process.run()
        # 确保在返回前调用flush来解析数据
        self.flush()
    def __str__(self):
        ret = ""
        ret += f'文件时长: {self.info.get("format",{}).get("duration","未知")}\n'
        ret += f'流数量: {len(self.info.get("streams",[]))}\n'
        ret += f'音频流数量: {len([s for s in self.info.get("streams",[]) if s.get("codec_type") == "audio"])}\n'
        ret += f'视频流数量: {len([s for s in self.info.get("streams",[]) if s.get("codec_type") == "video"])}\n'
        ret += f'视频流编码: {[s.get("codec_name","未知") for s in self.info.get("streams",[]) if s.get("codec_type") == "video"]}\n'
        ret += f'音频流编码: {[s.get("codec_name","未知") for s in self.info.get("streams",[]) if s.get("codec_type") == "audio"]}\n'
        return ret  

    def write(self,data):
        # 收集输出数据到缓冲区
        self.buffer.append(data)

    def flush(self):
        # 尝试解析收集到的所有数据
        try:
            # 合并缓冲区内容并尝试解析JSON
            full_output = ''.join(self.buffer)
            # 过滤掉可能的非JSON输出（如错误信息），只保留有效的JSON部分
            # 尝试从输出中提取JSON内容
            if full_output.strip():
                self.info = json.loads(full_output)
        except json.JSONDecodeError as e:
            print(f"解析ffprobe输出失败: {e}")
            # 尝试找到有效的JSON部分
            try:
                # 简单方法：查找第一个{和最后一个}之间的内容
                start = full_output.find('{')
                end = full_output.rfind('}') + 1
                if start != -1 and end != 0:
                    json_str = full_output[start:end]
                    self.info = json.loads(json_str)
            except Exception as e2:
                print(f"二次解析也失败: {e2}")
                print(f"原始输出: {full_output}")
    def isatty(self):
        return False
    def __getitem__(self,key):
        return self.info.get(key,None)
    def get(self,key,default = None):
        return self.info.get(key,default)

class ffmpeg():
    """
    ffmpeg类：用于执行ffmpeg命令，如视频转码、截图等操作
    参考ffprobe类设计，提供更灵活的ffmpeg命令执行功能
    """
    class std_err():
        def __init__(self):
            self.error = ""
        def write(self,data):
            self.error += data
        def flush(self):
            pass
    
    def __init__(self):
        """
        初始化ffmpeg类
        """
        self.input_file = None
        self.output_file = None
        self.cmd = ""
        self.info = {}
        self.buffer = []
        self.stderr = self.std_err()
        self.status = "idle"  # idle, running, completed, error
        self.progress = 0.0
        self.process = None
        self.error_message = ""
    
    def __str__(self):
        ret = f"状态: {self.status}\n"
        ret += f"进度: {self.progress * 100:.1f}%\n"
        ret += f"输入文件: {self.input_file}\n"
        ret += f"输出文件: {self.output_file}\n"
        ret += f"错误信息: {self.error_message}\n"
        return ret
    
    def write(self,data):
        """
        收集输出数据到缓冲区
        """
        self.buffer.append(data)
        # 尝试解析进度信息
        self._parse_progress(data)
    
    def flush(self):
        """
        刷新缓冲区内容
        """
        pass
    
    def isatty(self):
        return False
    
    def _parse_progress(self, data):
        """
        解析ffmpeg输出的进度信息
        支持两种格式的进度输出：
        1. ffmpeg默认输出格式: frame=  123 fps= 30 q=-1.0 size=   12345kB time=00:00:04.10 bitrate=24567.8kbits/s speed=1.2x
        2. -progress pipe:1格式输出的键值对
        """
        import re
        
        # 尝试解析-progress格式的输出
        if "out_time_ms" in data or "total_size" in data or "frame" in data:
            lines = data.strip().split('\n')
            for line in lines:
                if line.startswith("out_time_ms="):
                    try:
                        # 提取时间戳（毫秒）
                        time_ms = int(line.split("=")[1])
                        # 如果我们知道总时长，可以计算进度百分比
                        if hasattr(self, 'total_duration') and self.total_duration > 0:
                            self.progress = min(time_ms / (self.total_duration * 1000), 1.0)
                    except:
                        pass
                elif line.startswith("frame="):
                    try:
                        self.current_frame = int(line.split("=")[1])
                    except:
                        pass
        
        # 尝试解析标准输出格式
        # 匹配类似: frame=  123 fps= 30 q=-1.0 size=   12345kB time=00:00:04.10 bitrate=24567.8kbits/s speed=1.2x
        time_match = re.search(r'time=(\d+):(\d+):(\d+\.\d+)', data)
        if time_match:
            try:
                hours, minutes, seconds = time_match.groups()
                current_time = float(hours) * 3600 + float(minutes) * 60 + float(seconds)
                
                # 如果有总时长信息，计算进度百分比
                if hasattr(self, 'total_duration') and self.total_duration > 0:
                    self.progress = min(current_time / self.total_duration, 1.0)
                
                # 保存当前时间信息
                self.current_time = current_time
            except:
                pass
        
        # 提取帧率信息
        fps_match = re.search(r'fps=(\d+\.?\d*)', data)
        if fps_match:
            try:
                self.current_fps = float(fps_match.group(1))
            except:
                pass
        
        # 提取比特率信息
        bitrate_match = re.search(r'bitrate=(\d+\.?\d*)kbits/s', data)
        if bitrate_match:
            try:
                self.current_bitrate = float(bitrate_match.group(1))
            except:
                pass
        
        # 提取速度信息
        speed_match = re.search(r'speed=(\d+\.?\d*)x', data)
        if speed_match:
            try:
                self.speed = float(speed_match.group(1))
            except:
                pass
            
        if hasattr(self, 'progress_callback'):
            self.progress_callback(self.get_progress_info())

    def get_progress_info(self):
        """
        获取当前进度信息
        
        返回:
            dict: 包含进度相关信息的字典
        """
        info = {
            "status": self.status,
        }
        
        # 添加可选信息
        if hasattr(self, 'current_time'):
            info["current_time"] = self.current_time
        if hasattr(self, 'total_duration'):
            info["total_duration"] = self.total_duration
            info["progress_percent"] = round(self.progress * 100, 1)
            info["progress"] = self.progress
        if hasattr(self, 'current_fps'):
            info["fps"] = self.current_fps
        if hasattr(self, 'current_bitrate'):
            info["bitrate"] = self.current_bitrate
        if hasattr(self, 'speed'):
            info["speed"] = self.speed
        if hasattr(self, 'current_frame'):
            info["frame"] = self.current_frame
        
        return info
    
    def run(self):
        """
        执行ffmpeg命令
        前提条件：派生类必须在调用此方法前设置好self.cmd
        
        返回:
            bool: 操作是否成功启动
        """
        # 检查是否已设置cmd
        if not hasattr(self, 'cmd') or not self.cmd:
            raise ValueError("命令未设置，请在调用run方法前设置self.cmd")
        
        print(f"执行ffmpeg命令: {self.cmd}")
        
        # 重置状态
        self.buffer = []
        self.stderr = self.std_err()
        self.status = "running"
        self.progress = 0.0
        self.error_message = ""
        self.error_type = None  # 错误类型分类
        
        # 创建并启动进程
        self.process = process(self.cmd, stdout=self, stderr=self.stderr)
        
        # 运行进程
        ret = self.process.run()
        
        # 检查执行结果
        if ret == 0:
            self.status = "completed"
            return True
        elif ret == -15 or ret == 137:  # SIGTERM 或 SIGKILL
            self.status = "stopped"
            self.error_type = "terminated_by_user"
            return False
        else:
            self.status = "error"
            self.error_message = self.stderr.error
            print(f"ffmpeg执行错误 [代码:{ret}]: {self.error_message}")
            return False
                
    
    def stop(self):
        """
        停止当前正在执行的ffmpeg进程
        
        返回:
            bool: 是否成功停止
        """
        if self.status == "running" and self.process:
            try:
                if hasattr(self.process, 'terminate'):
                    self.process.terminate()
                elif hasattr(self.process, 'kill'):
                    self.process.kill()
                self.status = "stopped"
                return True
            except Exception as e:
                self.error_message = f"停止进程时出错: {str(e)}"
                self.error_type = "termination_error"
                print(f"停止进程错误: {e}")
                return False
        return False
    
    def get_status(self):
        """
        获取当前状态信息
        
        返回:
            dict: 包含状态和错误信息的字典
        """
        status_info = {
            "status": self.status,
            "input_file": self.input_file,
            "output_file": self.output_file,
            "error_message": self.error_message,
            "error_type": self.error_type,
            "progress": self.progress
        }
        return status_info
    
    
    
class ffmpeg_transcode(ffmpeg):
        
    def __init__(self, **kwargs):
        """
        视频转码功能
        
        参数:
            input_file: 输入文件路径（必需）
            output_file: 输出文件路径（必需）
            video_codec: 视频编码器 (如 h264, h265, vp9 等)
            audio_codec: 音频编码器 (如 aac, mp3 等)
            video_bitrate: 视频比特率 (如 "2M" 表示2Mbps)
            audio_bitrate: 音频比特率 (如 "192k" 表示192kbps)
            resolution: 分辨率 (如 "1280x720")
            fps: 帧率
        
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not input_file or not output_file:
            raise ValueError("input_file和output_file是必需参数")
        
        
        info = ffprobe(input_file)
        src_video_codec = info.get('streams', [{}])[0].get('codec_name', None)
        src_audio_codec = info.get('streams', [{}])[1].get('codec_name', None)
        
        # 提取其他可选参数
        video_codec = kwargs.get('video_codec')
        audio_codec = kwargs.get('audio_codec')
        video_bitrate = kwargs.get('video_bitrate')
        audio_bitrate = kwargs.get('audio_bitrate')
        resolution = kwargs.get('resolution')
        fps = kwargs.get('fps')
        
        # 添加视频编码器选项
        if video_codec:
            options.append(f"-c:v {video_codec}")
        else:
            if src_video_codec == "h264":
                options.append("-c:v copy")
            else:
                options.append("-c:v h264")
        
        # 添加音频编码器选项
        if audio_codec:
            options.append(f"-c:a {audio_codec}")
        else:
            if src_audio_codec == "aac":
                options.append("-c:a copy")
            else:
                options.append("-c:a aac")
        
        # 添加视频比特率选项
        if video_bitrate:
            options.append(f"-b:v {video_bitrate}")
        
        # 添加音频比特率选项
        if audio_bitrate:
            options.append(f"-b:a {audio_bitrate}")
        
        # 添加分辨率选项
        if resolution:
            options.append(f"-s {resolution}")
        
        # 添加帧率选项
        if fps:
            options.append(f"-r {fps}")
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_file

        self.total_duration = float(info.get('format', {}).get('duration', 0))
        # 构建基本命令，添加进度显示选项
        self.cmd = f"{ffmpeg_config['path']} -i \"{input_file}\" {options_str} -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"
        

# 暂未实现
# class ffmpeg_extract_image(ffmpeg):
# class ffmpeg_extract_audio(ffmpeg):
# class ffmpeg_merge_audio_video(ffmpeg):
# class ffmpeg_create_thumbnail(ffmpeg):

if __name__ == "__main__":

    print(ffprobe("aa.rm"))
    # 使用关键字参数调用
    task = ffmpeg_transcode(input_file="aa.rm", output_file="output.mp4")
    task.progress_callback = lambda x: print(x.get("progress_percent", 0))
    task.run()
