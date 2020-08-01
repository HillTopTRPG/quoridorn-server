export function notifyProgress(socket: any, all: number, current: number) {
  if (all > 1) socket.emit("notify-progress", null, { all, current });
}
