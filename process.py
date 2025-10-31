import subprocess
import sys
import threading

class process:
    def __init__(self, command, **kwargs):
        self.process = None
        self.return_code = None
        self.error = ""
        self.command = command
        self.stdout = sys.stdout
        self.stderr = sys.stderr
        self.cwd = None
        self.option = kwargs

    def run(self):
        if self.command is None:
            return -1

        if "stdout" in self.option:
            self.stdout = self.option["stdout"]

        if "stderr" in self.option:
            self.stderr = self.option["stderr"]

        if "cwd" in self.option and self.option["cwd"] != None:
            self.cwd = self.option["cwd"]

        if "args" in self.option and self.option["args"] is not None:
            self.command = self.command + ' ' + self.option["args"]

        if "show_widnow" in self.option and self.option["show_widnow"] == True:
            # 创建 STARTUPINFO 对象以隐藏控制台窗口
            startupinfo = None
        else:
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE  # 隐藏窗口
            


        self.process = subprocess.Popen(
            self.command,
            cwd=self.cwd,
            stdout=subprocess.PIPE if self.stdout is not None else subprocess.STDOUT,
            stderr=subprocess.PIPE if self.stderr is not None else subprocess.STDOUT,
            #shell=True,
            errors='replace',
            encoding='utf-8',
            startupinfo=startupinfo  # 使用 startupinfo 参数
        )

        self.error = ""

        def read_output(pipe, fp):
            for line in iter(pipe.readline, ''):
                out = line.rstrip()
                if "prefix" in self.option:
                    out = self.option["prefix"] + out
                if "suffix" in self.option:
                    out = out + self.option["suffix"]
                fp.write(out)
                if fp == sys.stderr:
                    self.error += line.rstrip()
            pipe.close()

        
        if self.stdout is not None:
            threading.Thread(
                target = read_output,
                args=(self.process.stdout,self.stdout),
                daemon=True
            ).start()

        if self.stderr is not None:
            threading.Thread(
                target = read_output,
                args=(self.process.stderr,self.stderr),
                daemon=True
            ).start()
        self.return_code = self.process.wait()
        return self.return_code;
    def stop(self):
        if hasattr(self, 'process') and self.process is not None:
            try:
                self.process.terminate()
                self.return_code = self.process.wait(timeout=2.0)  # 添加超时以避免无限等待
            except subprocess.TimeoutExpired:
                # 如果超时，强制终止进程
                self.process.kill()
                self.return_code = -1
            except Exception as e:
                print(f"停止进程时出错: {e}")
                self.return_code = -1
class thread_process(process):
    def __init__(self,command,**kwargs):
        super().__init__(command,**kwargs)
        self.thread = None  # 初始化为 None
        # 回调函数
        self.callback = kwargs.get("callback", None)
        
    def run(self):
        ret = super().run()
        if self.callback:
            self.callback(ret)
    def stop(self):
        if self.thread and self.thread.is_alive():
            super().stop()
            self.thread.join(timeout=0)
            self.thread = None  # 确保线程对象被正确释放
    
    def start(self):
        if self.thread and self.thread.is_alive():
            return
        # 每次调用 start 时创建新的线程实例
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()
    
    def wait(self):
        if self.thread:
            self.thread.join()
        return self.return_code
    
    def is_alive(self):
        return self.thread.is_alive() if self.thread else False

if __name__ == "__main__":
    process = thread_process("ping www.baidu.com",prefix="[ping] ",suffix="\n")
    process.start()
    process.wait()