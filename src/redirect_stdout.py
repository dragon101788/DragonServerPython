import sys
import os


class RedirectStdout:
    def __init__(self, **kwargs):
        self.callback = []

        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        sys.stdout = self
        sys.stderr = self
        if kwargs.get("original", True):
            self.register_callback(self.original_write)

        if kwargs.get("log_file", None):
            self.set_log_file(kwargs["log_file"])

    def set_log_file(self, log_file):
        self.unregister_callback(self.write_log)
        self.log_file = log_file
        if type(self.log_file) == str:
            os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
            self.log_file = open(self.log_file, "w", encoding="utf-8")
            print(f"log file: {self.log_file.name}")
        self.register_callback(self.write_log)

    def write_log(self, text):
        if self.log_file:
            self.log_file.write(text)
            self.log_file.flush()

    def __del__(self):
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr
        if self.log_file:
            self.log_file.close()

    def register_callback(self, callback):
        self.callback.append(callback)

    def unregister_callback(self, callback):
        if callback in self.callback:
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