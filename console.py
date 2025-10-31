# console_router.py
from fastapi import APIRouter, WebSocket, HTTPException, WebSocketDisconnect
import io
import sys
from typing import Dict
from fastapi.responses import FileResponse
import os
import asyncio
from contextlib import redirect_stdout, redirect_stderr
import json
import threading
import queue
from starlette.websockets import WebSocketState

console_router = APIRouter()

# 设置密码
CONSOLE_PASSWORD = "881017"
authenticated_sessions = set()
PERSISTENT_NAMESPACE = {}

class WebSocketOutputCapture:
    def __init__(self, websocket: WebSocket, output_queue: queue.Queue):
        self.websocket = websocket
        self.output_queue = output_queue
        self.buffer = ""

    def write(self, text):
        if text:
            self.buffer += text
            if self.buffer.endswith('\n'):
                self.output_queue.put(self.buffer.rstrip('\n'))
                self.buffer = ""
        return len(text)

    def flush(self):
        if self.buffer:
            self.output_queue.put(self.buffer)
            self.buffer = ""

@console_router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    try:
        if session_id not in authenticated_sessions:
            await websocket.close(code=1008)
            return

        await websocket.accept()

        while True:
            data = await websocket.receive_text()
            try:
                command = json.loads(data)
                code = command.get('code', '')

                if code:
                    output_queue = queue.Queue()
                    output_capture = WebSocketOutputCapture(websocket, output_queue)
                    error_capture = WebSocketOutputCapture(websocket, output_queue)

                    def execute_code():
                        try:
                            with redirect_stdout(output_capture), redirect_stderr(error_capture):
                                exec(code, PERSISTENT_NAMESPACE)
                            output_capture.flush()
                            error_capture.flush()
                        except Exception as e:
                            output_queue.put(f"Error: {str(e)}")
                        finally:
                            output_queue.put(None)

                    thread = threading.Thread(target=execute_code)
                    thread.start()

                    while True:
                        try:
                            output = output_queue.get_nowait()
                            if output is None:
                                break
                            if websocket.client_state == WebSocketState.CONNECTED:
                                await websocket.send_text(output)
                                await asyncio.sleep(0)
                        except queue.Empty:
                            await asyncio.sleep(0.01)
                            continue

                    thread.join()
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text("[EXECUTION_COMPLETE]")

            except json.JSONDecodeError:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text("Error: Invalid JSON")
            except Exception as e:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(f"Error: {str(e)}")
                    await websocket.send_text("[EXECUTION_COMPLETE]")

    except WebSocketDisconnect:
        print(f"Client disconnected: {session_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")

@console_router.post("/api/verify_password")
async def verify_password(password_data: Dict[str, str]):
    if password_data.get("password") == CONSOLE_PASSWORD:
        session_id = os.urandom(16).hex()
        authenticated_sessions.add(session_id)
        return {"success": True, "session_id": session_id}
    raise HTTPException(status_code=401, detail="Invalid password")
