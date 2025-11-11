import sys
import inspect



class RedirectStdout:
    def __init__(self):
        self.callback = []

        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        sys.stdout = self
        sys.stderr = self
    def __del__(self):
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr

    def register_callback(self, callback):
        self.callback.append(callback)

    def unregister_callback(self, callback):
        self.callback.remove(callback)

    def original_write(self, text):
        self.original_stdout.write(text)
        self.original_stdout.flush()

    def write(self, text):
        for callback in self.callback:
            callback(text)
    def flush(self):
        pass
    def isatty(self):
        # 返回False表示这不是一个终端设备
        if self.original_stdout and self.original_stdout.isatty():
            return True
        return False