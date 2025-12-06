#!/bin/bash

# 启动 Obsidian 并开启调试端口
# 用法: ./start-obsidian.sh

OBSIDIAN_PATH="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
DEBUG_PORT=9222

echo "🚀 启动 Obsidian (debug port: $DEBUG_PORT)..."

# 检查是否已运行
if curl -s "http://localhost:$DEBUG_PORT/json/version" > /dev/null 2>&1; then
    echo "✅ Obsidian 已在调试模式运行"
    exit 0
fi

# 启动 Obsidian
"$OBSIDIAN_PATH" --remote-debugging-port=$DEBUG_PORT &

echo "⏳ 等待 Obsidian 启动..."
sleep 3

# 验证
if curl -s "http://localhost:$DEBUG_PORT/json/version" > /dev/null 2>&1; then
    echo "✅ Obsidian 启动成功！"
    echo ""
    echo "现在可以运行测试:"
    echo "  npm run test:e2e"
    echo ""
    echo "或者交互式运行:"
    echo "  npm run test:e2e:ui"
else
    echo "❌ Obsidian 启动失败"
    exit 1
fi
