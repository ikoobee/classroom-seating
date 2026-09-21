# classroom-seating

纯前端教室排座工具：硬约束 + 10 条规则加权，爬山×模拟退火求解，数据全本地。

## 快速命令

```bash
npx serve .        # 本地预览（ES Modules 需 HTTP 服务）
```

## 约定

- 排座数据仅存浏览器 localStorage，**永不引入后端/上传**
- git hooks：`.githooks/commit-msg`（禁尾注钩子），`core.hooksPath=.githooks`（相对路径，可移植）
