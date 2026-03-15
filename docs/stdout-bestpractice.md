# Stdout-Based Agent Design - Best Practices

**Source**: [I was backend lead at Manus. After building agents for 2 years, I stopped using function calling entirely](https://www.reddit.com/r/LocalLLaMA/comments/1rrisqn/i_was_backend_lead_at_manus_after_building_agents/)

**Author**: Former backend lead at Manus (before Meta acquisition)

---

## 核心思想：为什么 Unix 哲学适用于 LLM Agents

### Unix 与 LLM 的惊人相似

Unix (50年前): **一切皆文本流**  
LLM (现在): **一切皆 Token**

两个相隔半个世纪的系统，基于完全不同的出发点，却收敛到了相同的接口模型。当 LLM 使用工具时，它本质上就是一个**终端操作员**——只不过速度比人类快得多，并且在训练数据中见过海量的 shell 命令和 CLI 模式。

**核心原则**：不要发明新的工具接口。直接把 Unix 50年验证过的方案交给 LLM。

---

## 单一工具假设 vs 多工具目录

### 传统方式：工具目录

```yaml
tools: [search_web, read_file, write_file, run_code, send_email, ...]
```

问题：

- LLM 必须先做**工具选择**——选哪个？什么参数？
- 工具越多，选择越困难，准确率下降
- 认知负荷花在"用哪个工具？"而非"我要完成什么？"

### 推荐方式：单一 run 工具

```bash
run(command="cat notes.md")
run(command="cat log.txt | grep ERROR | wc -l")
run(command="see screenshot.png")
run(command="memory search 'deployment issue'")
run(command="clip sandbox bash 'python3 analyze.py'")
```

优势：

- 命令选择是**统一命名空间内的字符串组合**
- 函数选择是**在不同 API 之间切换上下文**
- LLM 已经知道 CLI —— **数十亿行 GitHub 代码**都是 CLI

### 实际对比

**任务**：读取日志文件，统计错误行数

| 方式             | 调用次数 | 过程                                          |
| ---------------- | -------- | --------------------------------------------- |
| Function Calling | 3 次     | read_file → search_text → count_lines         |
| CLI              | 1 次     | `cat /var/log/app.log \| grep ERROR \| wc -l` |

### 支持链式操作

通过解析器支持 Unix 操作符：

- `\|` - Pipe：前一个命令的 stdout 成为下一个的 stdin
- `&&` - And：前一个成功才执行下一个
- `\|\|` - Or：前一个失败才执行下一个
- `;` - Seq：无论结果如何都执行下一个

```bash
# 一次工具调用完成完整工作流
curl -sL $URL -o data.csv && cat data.csv | head 5
cat access.log | grep "500" | sort | head 10
cat config.yaml || echo "config not found, using defaults"
```

---

## 渐进式发现：如何让 CLI 引导 Agent

### 技巧 1：渐进式 --help 发现

**Level 0: 工具描述 → 命令列表注入**

每次对话开始时动态生成 `run` 工具的描述，列出所有可用命令：

```
Available commands:
  cat    — 读取文本文件。图片用 'see'，二进制用 'cat -b'
  see    — 查看图片（自动附加到 vision）
  ls     — 列出当前目录文件
  write  — 写入文件。用法: write <path> [content] 或 stdin
  grep   — 过滤匹配行（支持 -i, -v, -c）
  memory — 搜索或管理记忆
  clip   — 操作外部环境（沙盒、服务）
  ...
```

**Level 1: command（无参数）→ 用法**

```bash
→ run(command="memory")
[error] memory: usage: memory search|recent|store|facts|forget

→ run(command="clip")
  clip list                              — 列出可用 clips
  clip <name>                            — 显示 clip 详情和命令
  clip <name> <command> [args...]        — 调用命令
```

**Level 2: command subcommand（缺少参数）→ 具体参数**

```bash
→ run(command="memory search")
[error] memory: usage: memory search <query> [-t topic_id] [-k keyword]
```

**关键洞察**：动态发现 vs 静态注入的平衡仍在探索中。命令越来越多时，完整列表本身会消耗上下文预算。

### 技巧 2：错误消息作为导航

**传统 CLI 错误**（为人类设计）：

```
$ cat photo.png
cat: binary file (standard output)
→ 人类去 Google "how to view image in terminal"
```

**Agent 友好的错误**（包含"怎么做"）：

```
[error] cat: binary image file (182KB). Use: see photo.png
→ Agent 直接调用 see，一步纠正

[error] unknown command: foo
Available: cat, ls, see, write, grep, memory, clip, ...
→ Agent 立即知道有哪些命令

[error] not an image file: data.csv (use cat to read text files)
→ Agent 从 see 切换到 cat

[error] clip "sandbox" not found. Use 'clip list' to see available clips
→ Agent 知道要先列出 clips
```

**关键教训：stderr 是 Agent 最需要的信息，特别是在命令失败时。永远不要丢弃它。**

### 技巧 3：一致的输出格式

每个工具结果附加一致的元数据：

```
file1.txt
file2.txt
dir1/
[exit:0 | 12ms]
```

LLM 提取两个信号：

- **Exit codes**：0=成功, 1=一般错误, 127=命令未找到（Unix 惯例，LLM 已知）
- **Duration**：成本意识（12ms=便宜，45s=昂贵，少用）

看到 `[exit:N | Xs]` 几十次后，Agent 会内化这个模式。

**三个技巧形成递进**：

```
--help    →  "我能做什么？"      → 主动发现
Error Msg →  "我应该做什么？"    → 被动纠正
Output Fmt→  "结果怎么样？"      → 持续学习
```

---

## 双层架构：工程实现

### 两个硬性约束

**约束 A：上下文窗口有限且昂贵**  
10MB 文件不仅浪费预算，还会把前面的对话推出窗口，导致 Agent "遗忘"。

**约束 B：LLM 只能处理文本**  
二进制数据经过 tokenizer 会变成高熵的无意义 token，不仅浪费上下文，还会**破坏周围有效 token 的注意力**。

### 架构分层

```
┌─────────────────────────────────────────────┐
│  Layer 2: LLM Presentation Layer            │  ← 为 LLM 约束设计
│  Binary guard | Truncation+overflow | Meta  │
├─────────────────────────────────────────────┤
│  Layer 1: Unix Execution Layer              │  ← 纯 Unix 语义
│  Command routing | pipe | chain | exit code │
└─────────────────────────────────────────────┘
```

**Layer 1 必须保持原始、无损、无元数据** —— 否则管道会断裂。

**Layer 2 的四个机制**：

1. **Binary Guard**（处理约束 B）
   - 检测空字节 → 二进制
   - UTF-8 验证失败 → 二进制
   - 控制字符比例 > 10% → 二进制

   ```
   [error] binary image (182KB). Use: see photo.png
   [error] binary file (1.2MB). Use: cat -b file.bin
   ```

2. **Overflow Mode**（处理约束 A）

   输出 > 200 行或 > 50KB？
   - 截断到前 200 行（rune-safe，不截断 UTF-8）
   - 完整输出写入 /tmp/cmd-output/cmd-{n}.txt
   - 返回给 LLM：

   ```
   [前 200 行内容]

   --- output truncated (5000 lines, 245.3KB) ---
   Full output: /tmp/cmd-output/cmd-3.txt
   Explore: cat /tmp/cmd-output/cmd-3.txt | grep <pattern>
            cat /tmp/cmd-output/cmd-3.txt | tail 100
   [exit:0 | 1.2s]
   ```

   **关键洞察**：LLM 已经知道如何用 `grep`、`head`、`tail` 导航文件。Overflow mode 把"大数据探索"转化为 LLM 已有的技能。

3. **Metadata Footer**

   ```
   actual output here
   [exit:0 | 1.2s]
   ```

4. **stderr Attachment**
   ```
   output + "\n[stderr] " + stderr
   ```

---

## 生产环境教训

### 故事 1：PNG 导致 20 次迭代震荡

用户上传架构图，Agent 用 `cat` 读取，收到 182KB 原始 PNG 字节。tokenizer 把这些字节变成数千个无意义 token 塞进上下文。LLM 无法理解，开始尝试不同读取方式 —— `cat -f`、`cat --format`、`cat --type image` —— 每次都收到同样的垃圾。20 次迭代后被强制终止。

**根因**：`cat` 没有二进制检测，Layer 2 没有 guard。  
**修复**：`isBinary()` guard + 错误引导 `Use: see photo.png`。  
**教训**：工具结果是 Agent 的眼睛。返回垃圾 = Agent 失明。

### 故事 2：静默 stderr 和 10 次盲目重试

Agent 需要读取 PDF，尝试 `pip install pymupdf`，得到 exit code 127。stderr 包含 `bash: pip: command not found`，但代码因为"有 stdout 就忽略 stderr"而丢弃了它。

Agent 只知道"失败了"，不知道"为什么"。然后开始盲目猜测：

```
pip install         → 127  (不存在)
python3 -m pip      → 1    (模块未找到)
uv pip install      → 1    (用法错误)
pip3 install        → 127
sudo apt install    → 127
... 5 更多次尝试 ...
uv run --with pymupdf python3 script.py → 0 ✓  (第 10 次)
```

10 次调用，每次约 5 秒推理。如果 stderr 第一次就可见，一次调用就够了。

**根因**：`InvokeClip` 在 stdout 非空时静默丢弃 stderr。  
**修复**：失败时始终附加 stderr。  
**教训**：stderr 是 Agent 最需要的信息，特别是在命令失败时。永远不要丢弃它。

### 故事 3：Overflow mode 的价值

Agent 分析 5,000 行日志文件。没有截断时，完整文本（~200KB）塞进上下文。LLM 注意力不堪重负，响应质量急剧下降，前面的对话被推出上下文窗口。

使用 overflow mode 后：

```
[日志前 200 行]

--- output truncated (5000 lines, 198.5KB) ---
Full output: /tmp/cmd-output/cmd-3.txt
Explore: cat /tmp/cmd-output/cmd-3.txt | grep <pattern>
         cat /tmp/cmd-output/cmd-3.txt | tail 100
[exit:0 | 45ms]
```

Agent 看到前 200 行，理解文件结构，然后用 `grep` 精确定位问题 —— 总共 3 次调用，上下文不到 2KB。

**教训**：给 Agent 一张"地图"远比给整个"领土"有效。

---

## 边界和限制

CLI 不是银弹。以下场景可能更适合 Typed API：

1. **强类型交互**：数据库查询、GraphQL API 等需要结构化输入/输出的场景。Schema 验证比字符串解析更可靠。

2. **高安全要求**：CLI 的字符串拼接存在注入风险。在不可信输入场景下，typed 参数更安全。（可通过沙盒隔离缓解）

3. **原生多模态**：纯音频/视频处理等二进制流场景，CLI 的文本管道是瓶颈。

### 安全保障

- **沙盒隔离**：命令在 BoxLite 容器内执行，无法逃逸
- **API 预算**：LLM 调用有账户级消费上限
- **用户取消**：前端提供取消按钮，后端支持优雅关闭

---

## 问答：关于 "Tool name is required (--tool)"

**Q: 系统提示 "Tool name is required (--tool)"，如何获取可用工具列表？**

根据本文的渐进式发现设计：

1. **首先检查 tool 描述** —— 良好的 Agent 系统会在对话开始时注入可用命令列表

2. **直接调用不带参数的 command** —— 返回用法信息：

   ```
   → run(command="memory")
   [error] memory: usage: memory search|recent|store|facts|forget
   ```

3. **查看错误消息中的 Available 列表** —— 当命令不存在时：
   ```
   [error] unknown command: foo
   Available: cat, ls, see, write, grep, memory, clip, ...
   ```

**最佳实践**：Agent 开发者应该在 system prompt 中预先注入命令列表，或在首次调用时提供发现机制，而不是让 Agent 盲目猜测。

---

## 核心公式

> 把 Unix 哲学交给执行层，  
> 把 LLM 的认知约束交给表示层，  
> 用 help、错误消息和输出格式作为三种渐进式启发式导航技术。
>
> **CLI 就是 Agent 所需的一切。**

---

## 参考实现

**Go 源码**: [github.com/epiral/agent-clip](https://github.com/epiral/agent-clip)

核心文件：

- `internal/tools.go` — 命令路由
- `internal/chain.go` — 管道实现
- `internal/loop.go` — 双层 Agent 循环
- `internal/fs.go` — 二进制 guard
- `internal/clip.go` — stderr 处理
- `internal/browser.go` — vision 自动附加
- `internal/memory.go` — 语义记忆

---

_最后更新: 基于 Manus 后端负责人的生产经验总结_
