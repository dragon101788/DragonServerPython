from datetime import datetime, timezone


def generate():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")

def calculate_elapsed_seconds(start_time):
    if type(start_time) is str:
        # 将解析后的 start_time 转换为 UTC 时区
        start_time = datetime.strptime(start_time, "%Y%m%d%H%M%S%f").replace(tzinfo=timezone.utc)
    end_time = datetime.now(timezone.utc)
    elapsed_seconds = (end_time - start_time).total_seconds()
    return elapsed_seconds

SERVER_START_TIME = generate()