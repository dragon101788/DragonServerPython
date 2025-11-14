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
            self.error = []
        def write(self,data):
            self.error.append(data)
        def flush(self):
            pass
        def __str__(self):
            return "\n".join(self.error)
    
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
            self.progress_callback(self)

    
    
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
            self.error_message = str(self.stderr)
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
        # 智能查找视频流和音频流
        streams = info.get('streams', [])
        # 获取第一个视频流的编码
        video_streams = [s for s in streams if s.get('codec_type') == 'video']
        src_video_codec = video_streams[0].get('codec_name', None) if video_streams else None
        # 获取第一个音频流的编码
        audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
        src_audio_codec = audio_streams[0].get('codec_name', None) if audio_streams else None
        
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
        

class ffmpeg_extract_image(ffmpeg):
    """
    从视频中提取图片帧
    """
    def __init__(self, **kwargs):
        """
        初始化视频帧提取功能
        
        参数:
            input_file: 输入视频文件路径（必需）
            output_pattern: 输出图片路径模式，如 'frame_%04d.jpg'（必需）
            start_time: 开始时间，格式为秒或 'MM:SS'（可选）
            duration: 提取时长，单位为秒（可选）
            frame_rate: 提取帧率，如 1 表示每秒1帧（可选）
            quality: JPEG质量，0-31，数值越小质量越好（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_pattern = kwargs.get('output_pattern')
        
        # 验证必需参数
        if not input_file or not output_pattern:
            raise ValueError("input_file和output_pattern是必需参数")
        
        # 提取其他可选参数
        start_time = kwargs.get('start_time')
        duration = kwargs.get('duration')
        frame_rate = kwargs.get('frame_rate')
        
        # 添加开始时间选项
        if start_time:
            options.append(f"-ss {start_time}")
        
        # 添加时长选项
        if duration:
            options.append(f"-t {duration}")
        
        # 添加帧率选项
        if frame_rate:
            options.append(f"-r {frame_rate}")
        
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_pattern
        
        # 获取视频总时长
        info = ffprobe(input_file)
        self.total_duration = float(info.get('format', {}).get('duration', 0))
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str} -i \"{input_file}\" -y -progress pipe:1 \"{output_pattern}\"{ffmpeg_config['ffmpeg_option']}"


class ffmpeg_extract_audio(ffmpeg):
    """
    从视频中提取音频
    """
    def __init__(self, **kwargs):
        """
        初始化音频提取功能
        
        参数:
            input_file: 输入视频文件路径（必需）
            output_file: 输出音频文件路径（必需）
            audio_codec: 音频编码器，如 'aac', 'mp3', 'opus' 等（可选）
            audio_bitrate: 音频比特率，如 '192k'（可选）
            start_time: 开始时间，格式为秒或 'MM:SS'（可选）
            duration: 提取时长，单位为秒（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not input_file or not output_file:
            raise ValueError("input_file和output_file是必需参数")
        
        # 提取其他可选参数
        audio_codec = kwargs.get('audio_codec', 'aac')
        audio_bitrate = kwargs.get('audio_bitrate')
        start_time = kwargs.get('start_time')
        duration = kwargs.get('duration')
        
        options.append(f"-i \"{input_file}\"")

        # 添加开始时间选项
        if start_time:
            options.append(f"-ss {start_time}")
        
        # 添加时长选项
        if duration:
            options.append(f"-t {duration}")
        
        # 添加音频编码器选项
        options.append(f"-c:a {audio_codec}")
        
        # 添加音频比特率选项
        if audio_bitrate:
            options.append(f"-b:a {audio_bitrate}")
        
        # 仅提取音频流
        options.append("-vn")  # 禁用视频
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_file
        
        # 获取视频总时长
        info = ffprobe(input_file)
        self.total_duration = float(info.get('format', {}).get('duration', 0))
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str}  -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"


class ffmpeg_merge_audio_video(ffmpeg):
    """
    合并音频和视频
    """
    def __init__(self, **kwargs):
        """
        初始化音视频合并功能
        
        参数:
            video_file: 输入视频文件路径（必需）
            audio_file: 输入音频文件路径（必需）
            output_file: 输出文件路径（必需）
            video_codec: 视频编码器，使用 'copy' 表示直接复制流（可选）
            audio_codec: 音频编码器，使用 'copy' 表示直接复制流（可选）
            start_time: 开始时间，格式为秒或 'MM:SS'（可选）
            duration: 合并时长，单位为秒（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        video_file = kwargs.get('video_file')
        audio_file = kwargs.get('audio_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not video_file or not audio_file or not output_file:
            raise ValueError("video_file、audio_file和output_file是必需参数")
        
        info = ffprobe(video_file)
        # 智能查找视频流和音频流
        streams = info.get('streams', [])
        # 获取第一个视频流的编码
        video_streams = [s for s in streams if s.get('codec_type') == 'video']
        src_video_codec = video_streams[0].get('codec_name', None) if video_streams else None

        audio_info = ffprobe(audio_file)
        # 智能查找音频流
        audio_streams = audio_info.get('streams', [])
        # 获取第一个音频流的编码
        audio_streams = [s for s in audio_streams if s.get('codec_type') == 'audio']
        src_audio_codec = audio_streams[0].get('codec_name', None) if audio_streams else None

        # 提取其他可选参数
        video_codec = kwargs.get('video_codec')
        audio_codec = kwargs.get('audio_codec')
        start_time = kwargs.get('start_time')
        duration = kwargs.get('duration')
        
        # 添加开始时间选项
        if start_time:
            options.append(f"-ss {start_time}")
        
        # 添加时长选项
        if duration:
            options.append(f"-t {duration}")

        
        
        
        options.append(f"-i \"{video_file}\"")
        # 输入文件和流指定
        options.append(f"-i \"{audio_file}\"")
        
        # 指定使用的流
        options.append("-map 0:v:0 -map 1:a:0")
        
        # 添加编码器选项
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
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = f"视频: {video_file}, 音频: {audio_file}"
        self.output_file = output_file
        
        # 获取视频总时长（使用视频文件的时长作为参考）
        self.total_duration = float(info.get('format', {}).get('duration', 0))
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str} -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"


class ffmpeg_create_thumbnail(ffmpeg):
    """
    创建视频缩略图
    """
    def __init__(self, **kwargs):
        """
        初始化缩略图创建功能
        
        参数:
            input_file: 输入视频文件路径（必需）
            output_file: 输出缩略图路径（必需）
            position: 缩略图位置，0-1之间的小数，表示视频进度位置，默认为配置中的thumb_pos（可选）
            width: 缩略图宽度，高度会按比例自动调整（可选）
            quality: JPEG质量，0-31，数值越小质量越好（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not input_file or not output_file:
            raise ValueError("input_file和output_file是必需参数")
        
        # 提取其他可选参数
        position = kwargs.get('position', ffmpeg_config['thumb_pos'])
        width = kwargs.get('width')
        quality = kwargs.get('quality', 2)
        
        # 获取视频信息
        info = ffprobe(input_file)
        duration = float(info.get('format', {}).get('duration', 0))
        
        # 计算缩略图时间点
        thumbnail_time = duration * position
        
        # 添加时间点选项
        options.append(f"-ss {thumbnail_time}")
        
        options.append(f"-i \"{input_file}\"")
        # 只提取一帧
        options.append("-vframes 1")
        
        # 添加宽度选项
        if width:
            options.append(f"-vf scale={width}:-1")
        
        # 添加质量选项
        options.append(f"-q:v {quality}")
        
        # # 禁用音频处理
        # options.append("-vn")
        
        options.append(f"{ffmpeg_config['ffmpeg_option']}")

        options.append(f"-y -progress pipe:1  \"{output_file}\"")
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_file
        
        # 设置总时长和当前进度（对于缩略图，我们直接设为100%完成）
        self.total_duration = 1.0
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str}"

if __name__ == "__main__":
    import os
    import time
    
    # 测试文件路径（请根据实际情况修改）
    test_video_file = "test_video.mp4"  # 替换为实际的测试视频文件路径
    
    # 确保测试文件存在
    if not os.path.exists(test_video_file):
        print(f"警告：测试文件 '{test_video_file}' 不存在，请修改测试代码中的文件路径。")
        # 尝试找一个默认的测试文件
        for root, dirs, files in os.walk("."):
            for file in files:
                if file.lower().endswith((".mp4", ".avi", ".mkv", ".rm", ".rmvb")):
                    test_video_file = os.path.join(root, file)
                    print(f"找到测试文件：{test_video_file}")
                    break
            else:
                continue
            break
    
    if not os.path.exists(test_video_file):
        print("未找到可用的视频文件，请手动指定测试文件路径。")
        exit(1)
    
    print("=== FFmpeg功能测试程序 ===")
    print(f"使用测试文件：{test_video_file}")
    
    # 1. 测试ffprobe功能
    print("\n1. 测试ffprobe功能")
    try:
        info = ffprobe(test_video_file)
        print(str(info))
        print(f"视频时长: {info.get('format', {}).get('duration', '未知')}")
        print(f"视频编码: {[s.get('codec_name', '未知') for s in info.get('streams', []) if s.get('codec_type') == 'video']}")
    except Exception as e:
        print(f"ffprobe测试失败: {e}")
    
    # 2. 测试ffmpeg_transcode功能
    print("\n2. 测试视频转码功能")
    try:
        output_file = os.path.splitext(test_video_file)[0] + "_transcoded.mp4"
        print(f"转码输出文件: {output_file}")
        
        transcode_task = ffmpeg_transcode(
            input_file=test_video_file,
            output_file=output_file,
            video_codec="h264",
            audio_codec="aac",
            video_bitrate="1M",
            audio_bitrate="192k"
        )
        
        # 定义进度回调函数
        def progress_callback(ffmpeg):
            percent = ffmpeg.progress * 100
            print(f"转码进度: {percent:.1f}% ", end="\r")
        
        transcode_task.progress_callback = progress_callback
        print("开始转码...")
        start_time = time.time()
        success = transcode_task.run()
        end_time = time.time()
        
        if success:
            print(f"\n转码成功！耗时: {end_time - start_time:.2f}秒")
            if os.path.exists(output_file):
                print(f"输出文件大小: {os.path.getsize(output_file) / (1024 * 1024):.2f} MB")
        else:
            print(f"\n转码失败: {transcode_task.error_message}")
    except Exception as e:
        print(f"转码测试失败: {e}")
    
    # 3. 测试ffmpeg_extract_image功能
    print("\n3. 测试视频帧提取功能")
    try:
        output_pattern = os.path.splitext(test_video_file)[0] + "_frame_%04d.jpg"
        print(f"帧输出模式: {output_pattern}")
        
        extract_task = ffmpeg_extract_image(
            input_file=test_video_file,
            output_pattern=output_pattern,
            start_time=10,  # 从第10秒开始
            duration=5,     # 提取5秒
            frame_rate=2,   # 每秒提取2帧
            quality=2       # JPEG质量
        )
        
        print("开始提取视频帧...")
        start_time = time.time()
        success = extract_task.run()
        end_time = time.time()
        
        if success:
            print(f"\n视频帧提取成功！耗时: {end_time - start_time:.2f}秒")
            # 检查生成的文件
            output_dir = os.path.dirname(test_video_file)
            base_name = os.path.splitext(os.path.basename(test_video_file))[0]
            frame_files = [f for f in os.listdir(output_dir) if f.startswith(base_name + "_frame_")]
            print(f"共提取 {len(frame_files)} 帧图片")
        else:
            print(f"\n视频帧提取失败: {extract_task.error_message}")
    except Exception as e:
        print(f"视频帧提取测试失败: {e}")
    
    # 4. 测试ffmpeg_extract_audio功能
    print("\n4. 测试音频提取功能")
    try:
        output_audio = os.path.splitext(test_video_file)[0] + "_audio.mp3"
        print(f"音频输出文件: {output_audio}")
        
        audio_task = ffmpeg_extract_audio(
            input_file=test_video_file,
            output_file=output_audio,
            audio_codec="mp3",
            audio_bitrate="192k"
        )
        
        # 定义进度回调函数
        def audio_progress_callback(ffmpeg):
            percent = ffmpeg.progress * 100
            print(f"音频提取进度: {percent:.1f}%", end="\r")
        
        audio_task.progress_callback = audio_progress_callback
        print("开始提取音频...")
        start_time = time.time()
        success = audio_task.run()
        end_time = time.time()
        
        if success:
            print(f"\n音频提取成功！耗时: {end_time - start_time:.2f}秒")
            if os.path.exists(output_audio):
                print(f"输出音频大小: {os.path.getsize(output_audio) / (1024 * 1024):.2f} MB")
        else:
            print(f"\n音频提取失败: {audio_task.error_message}")
    except Exception as e:
        print(f"音频提取测试失败: {e}")
    
    # 5. 测试ffmpeg_create_thumbnail功能
    print("\n5. 测试缩略图创建功能")
    try:
        output_thumbnail = os.path.splitext(test_video_file)[0] + "_thumbnail.jpg"
        print(f"缩略图输出文件: {output_thumbnail}")
        
        thumbnail_task = ffmpeg_create_thumbnail(
            input_file=test_video_file,
            output_file=output_thumbnail,
            position=0.3,  # 在视频30%的位置
            width=800,     # 宽度800像素
            quality=2      # JPEG质量
        )
        
        print("开始创建缩略图...")
        start_time = time.time()
        success = thumbnail_task.run()
        end_time = time.time()
        
        if success:
            print(f"缩略图创建成功！耗时: {end_time - start_time:.2f}秒")
            if os.path.exists(output_thumbnail):
                print(f"缩略图大小: {os.path.getsize(output_thumbnail) / 1024:.2f} KB")
        else:
            print(f"\n缩略图创建失败: {thumbnail_task.error_message}")
    except Exception as e:
        print(f"缩略图创建测试失败: {e}")
    
    # 6. 测试ffmpeg_merge_audio_video功能（需要先有分离的音频文件）
    print("\n6. 测试音视频合并功能")
    try:
        # 使用前面提取的音频文件
        audio_file = os.path.splitext(test_video_file)[0] + "_audio.mp3"
        if not os.path.exists(audio_file):
            print("跳过音视频合并测试，因为没有找到音频文件")
        else:
            output_merged = os.path.splitext(test_video_file)[0] + "_merged.mp4"
            print(f"合并输出文件: {output_merged}")
            
            merge_task = ffmpeg_merge_audio_video(
                video_file=test_video_file,
                audio_file=audio_file,
                output_file=output_merged
            )
            
            # 定义进度回调函数
            def merge_progress_callback(ffmpeg):
                percent = ffmpeg.progress * 100
                print(f"合并进度: {percent}%", end="\r")
            
            merge_task.progress_callback = merge_progress_callback
            print("开始合并音视频...")
            start_time = time.time()
            success = merge_task.run()
            end_time = time.time()
            
            if success:
                print(f"\n音视频合并成功！耗时: {end_time - start_time:.2f}秒")
                if os.path.exists(output_merged):
                    print(f"输出文件大小: {os.path.getsize(output_merged) / (1024 * 1024):.2f} MB")
            else:
                print(f"\n音视频合并失败: {merge_task.error_message}")
    except Exception as e:
        print(f"音视频合并测试失败: {e}")
    
    print("\n=== 测试完成 ===")
