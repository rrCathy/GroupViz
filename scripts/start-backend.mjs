import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', 'backend');
const port = process.env.PORT || '8000';
const noReload = process.argv.includes('--no-reload');
const uvicornBin = process.env.UVICORN || 'uvicorn';

const args = ['main:app', '--host', '127.0.0.1', '--port', port];
if (!noReload) {
    args.push('--reload');
}

console.log(
    `[start-backend] uvicorn main:app -> http://127.0.0.1:${port} (cwd=${backendDir})${noReload ? ' [no-reload]' : ''}`
);
console.log(
    '[start-backend] node 托管 uvicorn：常规前台启动入口（后端 GAP 卡死已由 gap_service._run_gap_raw 根治：stdin=DEVNULL + 隐藏控制台，detached 亦可）'
);
console.log('[start-backend] 退出方式：Ctrl+C（无 --no-reload 时 uvicorn --reload 自动重载后端代码）');

const child = spawn(uvicornBin, args, {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    windowsHide: false,
});

child.on('error', (err) => {
    if (err.code === 'ENOENT') {
        console.error(`[start-backend] 未找到 ${uvicornBin}，请先安装后端依赖：`);
        console.error('  cd backend && pip install -r requirements.txt');
        console.error('  （或设置 UVICORN 环境变量指向完整路径，如 venv 内的 uvicorn.exe）');
    } else {
        console.error('[start-backend] 启动失败:', err);
    }
    process.exit(1);
});

child.on('exit', (code, signal) => {
    console.log(`[start-backend] uvicorn 已退出 (code=${code} signal=${signal})`);
    process.exit(code ?? (signal ? 1 : 0));
});

process.on('SIGINT', () => {
    child.kill('SIGINT');
    setTimeout(() => process.exit(0), 3000).unref();
});